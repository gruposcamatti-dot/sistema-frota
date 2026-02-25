import React, { useState, useRef } from 'react';

import { Upload, FileText, AlertTriangle, ArrowRight, Save, Truck, X } from 'lucide-react';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { VALID_CLASSES, VIEWS } from '../constants/appConstants';
import { cleanValue, formatCurrency } from '../utils/formatters';

export default function ImportModule({ vehicles, db, appId, setCurrentView, almoxarifadoItems, expenses }) {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [importType, setImportType] = useState(null);
  const [error, setError] = useState(null);
  const [missingFleets, setMissingFleets] = useState([]);
  const [missingClasses, setMissingClasses] = useState([]);
  const [newMaterialsToAdd, setNewMaterialsToAdd] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);
  const saveIdRef = useRef(null);

  const isValidClass = (category) => {
    const normalized = category.toLowerCase().trim();
    return VALID_CLASSES.some(validClass =>
      normalized.includes(validClass) || validClass.includes(normalized)
    );
  };

  // Find class for material from almoxarifado
  const findClassForMaterial = (codMateria, descricaoMateria) => {
    if (!almoxarifadoItems || almoxarifadoItems.length === 0) return null;

    // Normalizar e limpar o código da matéria do TXT
    const codMateriaClean = (codMateria || '').replace(/^["']+|["']+$/g, '').trim().toUpperCase();
    const descricaoMateriaClean = (descricaoMateria || '').replace(/^["']+|["']+$/g, '').trim().toLowerCase();

    // First try to find by code (exact match)
    if (codMateriaClean) {
      const byCodigo = almoxarifadoItems.find(item => {
        const itemCod = (item.codMateria || '').replace(/^["']+|["']+$/g, '').trim().toUpperCase();
        return itemCod && itemCod === codMateriaClean;
      });

      if (byCodigo && byCodigo.classe && byCodigo.classe.trim() !== '') {
        console.log(`✓ Classe encontrada por CÓDIGO: ${codMateriaClean} -> ${byCodigo.classe}`);
        return byCodigo.classe.trim();
      }
    }

    // Then try to find by description (exact match)
    if (descricaoMateriaClean) {
      const byDescricao = almoxarifadoItems.find(item => {
        const itemDesc = (item.descricaoMateria || '').replace(/^["']+|["']+$/g, '').trim().toLowerCase();
        return itemDesc && itemDesc === descricaoMateriaClean;
      });

      if (byDescricao && byDescricao.classe && byDescricao.classe.trim() !== '') {
        console.log(`✓ Classe encontrada por DESCRIÇÃO: ${descricaoMateriaClean} -> ${byDescricao.classe}`);
        return byDescricao.classe.trim();
      }
    }

    console.log(`✗ Classe NÃO encontrada para: Código="${codMateriaClean}" / Descrição="${descricaoMateriaClean}"`);
    return null;
  };

  const parseDate = (dateStr) => {
    if (!dateStr || dateStr.trim() === '') {
      return new Date().toISOString().split('T')[0];
    }

    const cleaned = dateStr.trim().replace(/^["']|["']$/g, '');

    if (cleaned.length === 8 && /^\d{8}$/.test(cleaned)) {
      return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
    }

    const parts = cleaned.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[2].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
      if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }

    return new Date().toISOString().split('T')[0];
  };

  const handleFileChange = (e) => {
    if (isProcessing) return;

    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        processContent(event.target.result);
        setIsProcessing(false);
        // Limpar input para permitir selecionar o mesmo arquivo novamente
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      reader.onerror = () => {
        setError('Erro ao ler arquivo');
        setIsProcessing(false);
      };
      reader.readAsText(selectedFile, 'ISO-8859-1');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (isProcessing) return;

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        processContent(event.target.result);
        setIsProcessing(false);
      };
      reader.onerror = () => {
        setError('Erro ao ler arquivo');
        setIsProcessing(false);
      };
      reader.readAsText(droppedFile, 'ISO-8859-1');
    }
  };

  const processContent = (text) => {
    console.log('=== INICIANDO PROCESSAMENTO DO ARQUIVO ===');
    console.log('Quantidade de itens no almoxarifado:', almoxarifadoItems?.length || 0);

    setError(null);
    setPreviewData([]);
    setImportType(null);
    setMissingFleets([]);
    setMissingClasses([]);
    setNewMaterialsToAdd([]);

    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      setError("Arquivo vazio.");
      return;
    }

    const headerLine = lines[0];
    const separator = headerLine.includes(';') ? ';' : '\t';
    const headers = headerLine.split(separator).map(h => h.trim());

    let detectedType = null;
    if (headers.includes('PRMAT-CCUS')) {
      detectedType = 'saida';
    } else if (headers.includes('PRGER-CCUS')) {
      detectedType = 'entrada';
    } else {
      setError("Layout do arquivo não reconhecido. Colunas esperadas: PRGER-CCUS ou PRMAT-CCUS.");
      return;
    }

    setImportType(detectedType);
    const parsedExpenses = [];
    const unmatchedFleets = new Set();
    const unmatchedClasses = new Set();
    const materialsToAdd = new Map(); // Use Map to avoid duplicates

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator).map(c => c.trim());
      if (cols.length < 2) continue;

      const getCol = (name) => {
        const index = headers.indexOf(name);
        if (index !== -1) {
          // Remove aspas simples e duplas do início e fim
          return cols[index].replace(/^["']+|["']+$/g, '');
        }
        return '';
      };

      let expense = {
        id: Math.random().toString(36).substr(2, 9),
      };

      let rawFleetName = '';

      if (detectedType === 'entrada') {
        const ccusCode = getCol('PRGER-CCUS').trim();
        const ccusNumber = ccusCode.replace(/^0+/, '') || '0';

        rawFleetName = ccusNumber;

        expense.type = 'income';
        expense.date = parseDate(getCol('PRGER-LCTO') || getCol('PRGER-EMIS'));
        expense.amount = parseInt(getCol('PRGER-TOTA').replace(/\D/g, '') || '0', 10) / 100;
        expense.provider = getCol('PRGER-NFOR');
        expense.category = getCol('PRGER-NPLC') || 'Geral';
        expense.description = getCol('PR-SORT') || "Lançamento SAF";

        expense.details = {
          lctoDate: getCol('PRGER-LCTO'),
          emisDate: getCol('PRGER-EMIS'),
          notaFiscal: getCol('PRGER-NOTA'),
          empresa: getCol('DET01-EMPR'),
          especie: getCol('PRENT-ESPE'),
          fornecedor: getCol('PRGER-NFOR'),
          codFornecedor: getCol('PRGPR-FORN'),
          fiscal: getCol('PRGER-NFIS'),
          classe: getCol('PRGER-NPLC'),
          ordemCompra: getCol('PRENT-ORDE'),
        };

        // Regra robusta de detecção de Rateio (Visão/Divisão 2002 ou CCs específicos)
        const RATEIO_IDENTIFIERS = ['1034', '1058', '1065', '1088', '1097', '1233', '2002'];
        const division = (getCol('DET01-DIVISAO') || getCol('DET01-VISIAO') || '').replace(/\D/g, '');
        const cleanCCEntry = ccusNumber.replace(/\D/g, '');

        if (RATEIO_IDENTIFIERS.includes(division) || RATEIO_IDENTIFIERS.includes(cleanCCEntry)) {
          expense.scope = 'rateio';
        } else {
          expense.scope = 'fleet';
        }

      } else {
        rawFleetName = getCol('PRMAT-CCUS');
        expense.type = 'expense';
        expense.date = parseDate(getCol('PRGER-DATA'));

        // Verifica se é Rateio por Centro de Custo para Saída
        const RATEIO_IDENTIFIERS = ['1034', '1058', '1065', '1088', '1097', '1233', '2002'];
        const cleanCC = rawFleetName.replace(/\D/g, '');
        if (RATEIO_IDENTIFIERS.includes(cleanCC)) {
          expense.scope = 'rateio';
        }

        const rawTotal = parseInt(getCol('PRGER-TTEN').replace(/\D/g, '') || '0', 10);
        const rawVren = parseInt(getCol('PRGER-VREN').replace(/\D/g, '') || '0', 10);
        const rawQtd = parseInt(getCol('PRGER-QTDES').replace(/\D/g, '') || '0', 10);

        expense.amount = rawTotal / 1000;
        expense.description = getCol('PRMAT-NOME');
        expense.provider = "Movimentação de Estoque";

        // Limpar código e descrição da matéria
        const codMateria = getCol('PRMAT-CODI').replace(/^["']+|["']+$/g, '').trim();
        const descricaoMateria = getCol('PRMAT-NOME').replace(/^["']+|["']+$/g, '').trim();

        console.log(`Processando SAÍDA: Código="${codMateria}" / Descrição="${descricaoMateria}"`);

        // Buscar classe no almoxarifado
        const foundClass = findClassForMaterial(codMateria, descricaoMateria);

        if (foundClass) {
          expense.category = foundClass;
          console.log(`  ✓ Classe atribuída: ${foundClass}`);
        } else {
          expense.category = ''; // Ficará pendente
          console.log(`  ✗ Classe não encontrada - ficará PENDENTE`);
        }

        expense.details = {
          date: getCol('PRGER-DATA'),
          codLancamento: getCol('PRGER-CODI'),
          empresa: getCol('PRGER-EMPR'),
          materia: descricaoMateria,
          codMateria: codMateria,
          quantidade: rawQtd / 1000,
          valorEntrada: rawVren / 1000,
          valorTotal: rawTotal / 1000,
          recebedor: getCol('PRGER-RECE'),
          almoxarifado: getCol('PRGER-NALM')
        };
      }

      const ccusNumberOnly = rawFleetName.replace(/\D/g, '');

      const vehicle = vehicles.find(v => {
        const fleetNumbers = v.fleetName.replace(/\D/g, '');
        return ccusNumberOnly !== '' && fleetNumbers.includes(ccusNumberOnly);
      });

      if (vehicle) {
        expense.vehicleId = vehicle.id;
        expense.fleetName = vehicle.fleetName;
        if (!expense.scope) expense.scope = 'fleet';
      } else {
        // Se não achou veiculo:
        if (expense.scope === 'rateio') {
          expense.vehicleId = 'rateio';
          expense.fleetName = `CCUS: ${rawFleetName}`;
        } else if (detectedType === 'saida') {
          // Saída sem veiculo correspondente e não identificado previamente como CC de rateio
          // (Mas pela regra do usuário, se não tiver CC no sistema, deve ser rateio)
          expense.scope = 'rateio';
          expense.vehicleId = 'rateio';
          expense.fleetName = `CCUS: ${rawFleetName}`;
        } else {
          // Entrada sem veiculo e NAO é divisão 2002
          expense.vehicleId = 'unknown';
          expense.fleetName = `CCUS: " ${rawFleetName}"`;
          if (rawFleetName && rawFleetName.trim() !== '') {
            unmatchedFleets.add(rawFleetName.trim());
          }
          expense.scope = 'fleet';
        }
      }

      if (detectedType === 'entrada') {
        if (expense.category && expense.category !== 'Geral' && !isValidClass(expense.category) && expense.scope !== 'rateio') {
          unmatchedClasses.add(expense.category.trim());
        }
      } else if (detectedType === 'saida') {
        // For saida, check if material needs to be registered in almoxarifado
        const codMateria = expense.details.codMateria;
        const descricaoMateria = expense.details.materia;

        if (codMateria && descricaoMateria) {
          // Normalizar para comparação
          const codMateriaClean = codMateria.trim().toUpperCase();
          const descMateriaClean = descricaoMateria.trim().toLowerCase();

          const existsInAlmox = almoxarifadoItems?.some(item => {
            const itemCod = (item.codMateria || '').trim().toUpperCase();
            const itemDesc = (item.descricaoMateria || '').trim().toLowerCase();
            return (itemCod && itemCod === codMateriaClean) ||
              (itemDesc && itemDesc === descMateriaClean);
          });

          if (!existsInAlmox) {
            materialsToAdd.set(codMateria, {
              codMateria: codMateria.replace(/^["']+|["']+$/g, '').trim(),
              descricaoMateria: descricaoMateria.replace(/^["']+|["']+$/g, '').trim(),
              classe: '' // Will be pending
            });
            console.log(`  → Material será adicionado ao almoxarifado: ${codMateria}`);
          }
        }
      }

      parsedExpenses.push(expense);
    }

    setPreviewData(parsedExpenses);
    setMissingFleets(Array.from(unmatchedFleets));
    setMissingClasses(Array.from(unmatchedClasses));
    setNewMaterialsToAdd(Array.from(materialsToAdd.values()));
    console.log('=== PROCESSAMENTO CONCLUÍDO ===');
    console.log('Total de lançamentos processados:', parsedExpenses.length);
    console.log('Lançamentos com classe encontrada:', parsedExpenses.filter(e => e.category && e.category !== '').length);
    console.log('Lançamentos pendentes (sem classe):', parsedExpenses.filter(e => !e.category || e.category === '').length);
    console.log('Novos materiais a adicionar:', materialsToAdd.size);
  };

  const handleSave = async () => {
    // Gerar ID único para este salvamento
    const currentSaveId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    // Verificar se já está salvando
    if (isSaving) {
      console.warn('⚠️ BLOQUEADO: Já existe um salvamento em andamento!');
      return;
    }

    // Verificar se há dados para salvar
    if (previewData.length === 0) {
      console.warn('⚠️ BLOQUEADO: Nenhum dado para salvar!');
      return;
    }

    // Verificar se este salvamento já foi executado
    if (saveIdRef.current === currentSaveId) {
      console.warn('⚠️ BLOQUEADO: Este salvamento já foi executado! ID:', currentSaveId);
      return;
    }

    console.log('=== INICIANDO SALVAMENTO ===');
    console.log('ID do Salvamento:', currentSaveId);
    console.log('Quantidade de lançamentos a salvar:', previewData.length);
    console.log('Quantidade de materiais a adicionar:', newMaterialsToAdd.length);

    // Marcar como salvando e armazenar o ID
    setIsSaving(true);
    saveIdRef.current = currentSaveId;

    // Capturar os dados que serão salvos (cópia imutável)
    const dataToSave = [...previewData];
    const materialsToSave = [...newMaterialsToAdd];

    // --- IDEMPOTÊNCIA: Verificar duplicatas ---
    // Criar assinaturas dos lançamentos EXISTENTES
    // Criar mapa de assinaturas para verificação de duplicidade
    const existingSignatures = new Map();
    (expenses || []).forEach(e => {
      const sig = `${e.date}|${e.amount}|${(e.description || '').trim()}|${e.vehicleId}`;
      existingSignatures.set(sig, e);
    });

    // Filtrar lançamentos que JÁ EXISTEM
    const duplicates = [];
    const uniqueDataToSave = dataToSave.filter(item => {
      const signature = `${item.date}|${item.amount}|${(item.description || '').trim()}|${item.vehicleId}`;

      if (existingSignatures.has(signature)) {
        const existingItem = existingSignatures.get(signature);
        duplicates.push({ newItem: item, existingItem });
        console.warn(`⚠️ Duplicata detectada: ${item.description}`, existingItem);
        return false;
      }

      // Adicionar à lista de assinaturas para evitar duplicatas NO PRÓPRIO ARQUIVO
      // Nota: Para novos itens do arquivo, criamos um objeto temporário para bloquear repetições no mesmo upload
      existingSignatures.set(signature, { type: 'IMPORTAÇÃO ATUAL', id: 'NOVO' });
      return true;
    });

    let finalExpensesToSave = uniqueDataToSave;

    // Se houver duplicatas, perguntar ao usuário o que fazer
    if (duplicates.length > 0) {
      const duplicateList = duplicates.map(d =>
        `• ${d.newItem.date.split('-').reverse().join('/')} - ${d.newItem.description} (${formatCurrency(d.newItem.amount)})
          ↳ CONFLITA COM: ID ${d.existingItem.id} (${d.existingItem.type === 'income' ? 'ENTRADA' : (d.existingItem.type === 'expense' ? 'SAÍDA' : d.existingItem.type)})`
      ).slice(0, 10).join('\n'); // Limitar a 10 para não explodir a tela

      const moreCount = duplicates.length > 10 ? `\n... e mais ${duplicates.length - 10} itens.` : '';

      const userWantsDuplicates = window.confirm(
        `⚠️ DETECTADAs ${duplicates.length} DUPLICIDADES!\n\n` +
        `O sistema encontrou itens que já parecem existir:\n${duplicateList}${moreCount}\n\n` +
        `Deseja IMPORTAR MESMO ASSIM (Criar duplicatas)?\n` +
        `[OK] = Sim, importar TUDO (inclusive duplicados)\n` +
        `[Cancelar] = Não, importar APENAS OS NOVOS (ignorar duplicados)`
      );

      if (userWantsDuplicates) {
        finalExpensesToSave = dataToSave; // Usa a lista completa original
      }
    }

    if (finalExpensesToSave.length === 0 && materialsToSave.length === 0) {
      alert('Nenhum lançamento novo para importar.');
      setIsSaving(false);
      return;
    }

    // Assuming `selectedFleet` and `transactionType` are available in scope
    // If not, they need to be passed or derived. For now, using placeholders.
    const selectedFleet = 'N/A'; // Placeholder
    const transactionType = 'N/A'; // Placeholder

    if (!window.confirm(`Confirma a importação de:\n\n💰 ${finalExpensesToSave.length} Lançamentos Financeiros\n📦 ${materialsToSave.length} Itens de Almoxarifado\n\nFrota: ${selectedFleet}\nTipo: ${transactionType === 'income' ? 'Entrada' : 'Saída'}`)) {
      setIsSaving(false);
      return;
    }

    try {
      // Use writeBatch for atomic operation
      const batch = writeBatch(db);
      const expensesRef = collection(db, 'artifacts', appId, 'public', 'data', 'expenses');
      const almoxRef = collection(db, 'artifacts', appId, 'public', 'data', 'almoxarifado');

      console.log('Adicionando', finalExpensesToSave.length, 'lançamentos ao batch...');
      // Add all expenses to batch
      finalExpensesToSave.forEach((item, index) => {
        const newDocRef = doc(expensesRef);
        batch.set(newDocRef, item);
        if (index < 5) {
          console.log(`  Lançamento ${index + 1}:`, item.description, formatCurrency(item.amount));
        }
      });

      console.log('Adicionando', materialsToSave.length, 'materiais ao batch...');
      // Add new materials to batch
      materialsToSave.forEach(material => {
        const newDocRef = doc(almoxRef);
        batch.set(newDocRef, material);
      });

      console.log('Executando batch.commit()...');
      // Execute batch
      await batch.commit();

      console.log('=== SALVAMENTO CONCLUÍDO COM SUCESSO ===');
      console.log('ID do Salvamento:', currentSaveId);

      // Clear preview data and reset state
      setPreviewData([]);
      setNewMaterialsToAdd([]);
      setFile(null);

      // Aguardar um pouco antes de mudar de view para garantir que o salvamento foi processado
      setTimeout(() => {
        setCurrentView(VIEWS.TRANSACTIONS);
      }, 500);
    } catch (error) {
      console.error('=== ERRO NO SALVAMENTO ===', error);
      alert('Erro ao salvar lançamentos: ' + error.message);
      // Limpar o ID em caso de erro para permitir nova tentativa
      saveIdRef.current = null;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {newMaterialsToAdd.length > 0 && (
        <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-xl flex items-start gap-3">
          <AlertTriangle className="text-blue-600 flex-shrink-0" size={20} />
          <div>
            <h4 className="text-blue-800 font-bold text-sm">Novas Matérias Detectadas!</h4>
            <p className="text-blue-700 text-xs mt-1">
              {newMaterialsToAdd.length} {newMaterialsToAdd.length === 1 ? 'matéria' : 'matérias'} não cadastrada(s) no almoxarifado {newMaterialsToAdd.length === 1 ? 'será cadastrada' : 'serão cadastradas'} automaticamente como pendente(s).
            </p>
            <p className="text-blue-700 text-xs mt-1 font-semibold">
              Você poderá classificá-las posteriormente na aba Almoxarifado usando o filtro "Filtrar Pendentes".
            </p>
            <div className="mt-2 text-xs text-blue-600 max-h-24 overflow-y-auto">
              {newMaterialsToAdd.map((mat, idx) => (
                <div key={idx} className="font-mono">
                  • {mat.codMateria} - {mat.descricaoMateria}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {missingFleets.length > 0 && (
        <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
          <div>
            <h4 className="text-amber-800 font-bold text-sm">Atenção: Frotas não cadastradas detectadas!</h4>
            <p className="text-amber-700 text-xs mt-1">
              As seguintes frotas no arquivo não possuem cadastro no sistema:
              <span className="font-mono font-bold ml-1">{missingFleets.join(', ')}</span>
            </p>
            <p className="text-amber-700 text-xs mt-1 font-semibold underline">
              Cadastre estes veículos antes de prosseguir com a importação.
            </p>
          </div>
        </div>
      )}

      {missingClasses.length > 0 && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-r-xl flex items-start gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0" size={20} />
          <div>
            <h4 className="text-red-800 font-bold text-sm">Atenção: Classes não cadastradas detectadas!</h4>
            <p className="text-red-700 text-xs mt-1">
              As seguintes classes no arquivo não estão mapeadas no sistema:
              <span className="font-mono font-bold ml-1 block mt-1">{missingClasses.join(', ')}</span>
            </p>
            <p className="text-red-700 text-xs mt-2 font-semibold underline">
              Estas despesas não aparecerão nas colunas do Fechamento/Operacional até serem mapeadas.
            </p>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-2">
          Importação
        </h2>
        <p className="text-slate-500 text-sm">
          O sistema detecta automaticamente layouts de Entrada (Notas Fiscais) e Saída (Estoque).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all h-64
              ${file ? 'border-teal-500 bg-teal-50/30' : 'border-slate-300 hover:border-teal-400 bg-slate-50'}
            `}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".txt"
              className="hidden"
            />

            {file ? (
              <div className="animate-fade-in">
                <FileText size={48} className="text-teal-600 mx-auto mb-4" />
                <p className="font-bold text-slate-700 mb-1">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
                <button
                  onClick={() => { setFile(null); setPreviewData([]); setError(null); }}
                  className="mt-4 text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 mx-auto"
                >
                  <X size={14} /> Remover e Limpar
                </button>
              </div>
            ) : (
              <>
                <Upload size={32} className="text-slate-400 mb-4" />
                <p className="font-bold text-slate-700 mb-2">Arraste o arquivo aqui</p>
                <p className="text-xs text-slate-500 mb-4">ou</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition"
                >
                  Selecionar Arquivo
                </button>
              </>
            )}
          </div>

          {file && !error && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-4">Status da Leitura</h4>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Tipo Detectado:</span>
                  <span className="font-bold text-teal-600 uppercase">{importType || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Registros Encontrados:</span>
                  <span className="font-bold text-slate-800">{previewData.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Valor Total:</span>
                  <span className="font-bold text-slate-800">{formatCurrency(previewData.reduce((sum, e) => sum + e.amount, 0))}</span>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={previewData.length === 0 || isSaving}
                type="button"
                className={`w-full mt-6 flex items-center justify-center gap-2 py-3 text-white rounded-xl font-bold transition-all shadow-lg 
                  ${previewData.length === 0 || isSaving
                    ? 'bg-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/20'}
                `}
              >
                <Save size={18} />
                {isSaving ? 'Salvando... Aguarde!' : 'Salvar Lançamentos'}
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start text-red-700">
              <AlertTriangle className="flex-shrink-0 mt-0.5" size={18} />
              <div className="text-sm">
                <p className="font-bold">Erro ao processar arquivo</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <ArrowRight size={16} className="text-slate-400" />
              Pré-visualização dos Dados
            </h3>
            {previewData.length > 0 && (
              <span className="text-xs font-semibold text-slate-400">
                Mostrando {previewData.length} linhas
              </span>
            )}
          </div>

          <div className="overflow-auto flex-1">
            {previewData.length > 0 ? (
              <div className="flex flex-col h-full">
                {/* Header Fixo */}
                <div className="flex bg-slate-50 border-b border-slate-100 items-center px-4 py-3">
                  <div className="w-[100px] text-[10px] font-black uppercase text-slate-400">Data</div>
                  <div className="w-[20%] min-w-[120px] text-[10px] font-black uppercase text-slate-400 px-2">Frota</div>
                  <div className="flex-1 text-[10px] font-black uppercase text-slate-400 px-2">Descrição</div>
                  <div className="w-[20%] min-w-[120px] text-[10px] font-black uppercase text-slate-400 px-2">Fornecedor</div>
                  <div className="w-[100px] text-[10px] font-black uppercase text-slate-400 text-right">Valor</div>
                </div>

                {/* Lista Padrão (Sem Virtualização) */}
                <div className="h-[calc(100vh-220px)] overflow-y-auto">
                  <div className="w-full">
                    {previewData.map((item, index) => {
                      const fleetName = item.fleetName.replace(/CCUS:\s*["']?\s*/gi, '').replace(/["']/g, '');

                      return (
                        <div key={index} className="flex items-center px-4 border-b border-slate-50 hover:bg-slate-50 transition-colors py-2">
                          <div className="w-[100px] text-xs font-medium text-slate-700 flex-shrink-0">
                            {item.date.split('-').reverse().join('/')}
                          </div>
                          <div className="w-[20%] min-w-[120px] px-2 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              {item.vehicleId === 'unknown' && <Truck size={14} className="text-slate-400" />}
                              <span className={`text-xs font-bold truncate ${item.vehicleId === 'unknown' ? 'text-amber-600' : 'text-slate-800'}`} title={fleetName}>
                                {fleetName}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1 px-2 text-xs text-slate-600 truncate flex-shrink-0" title={cleanValue(item.description)}>
                            {cleanValue(item.description)}
                          </div>
                          <div className="w-[20%] min-w-[120px] px-2 text-xs text-slate-600 truncate flex-shrink-0" title={cleanValue(item.provider)}>
                            {cleanValue(item.provider || '—')}
                          </div>
                          <div className="w-[100px] text-xs font-bold text-right text-slate-800 flex-shrink-0">
                            {formatCurrency(item.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <FileText size={48} className="mb-4 opacity-50" />
                <p className="text-sm font-medium">Nenhum dado para exibir</p>
                <p className="text-xs mt-1">Selecione um arquivo para começar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
