import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import {
  Search, Plus, Trash2, Edit2, X, Calendar,
  TrendingUp, TrendingDown, Package, Activity, User,
  Gauge, Wrench, DollarSign, BarChart3, FileSearch, Truck,
  AlertTriangle, ArrowRight, Save, Building2, CheckCircle2,
  ArrowUpCircle, ArrowDownCircle, Filter, Banknote, FileText, Download
} from 'lucide-react';
import {
  collection, doc, addDoc, updateDoc, setDoc,
  deleteDoc, onSnapshot, writeBatch, getDocs
} from 'firebase/firestore';
import { appId, FLEET_TYPES } from '../constants/appConstants';
import { formatCurrency, formatNumber, cleanValue } from '../utils/formatters';
import FilterGroup from './ui/FilterGroup';
import FormField from './ui/FormField';

export default function TransactionsView({ expenses, filteredExpenses, setExpenses, filters, setFilters, db, appId, vehicles, almoxarifadoItems, rateios }) {
  const [transactionType, setTransactionType] = useState('income');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [editingExpense, setEditingExpense] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newExpense, setNewExpense] = useState(null);
  const [showConferencia, setShowConferencia] = useState(false);

  // Clear selected IDs when changing transaction type
  useEffect(() => {
    setSelectedIds([]);
  }, [transactionType]);

  const handleSaveEdit = async () => {
    if (editingExpense) {
      try {
        // Verificar se é um item do almoxarifado
        const isAlmoxarifado = almoxarifadoItems?.some(item => item.id === editingExpense.id);
        const collectionName = isAlmoxarifado ? 'almoxarifado' : 'expenses';

        console.log(`Salvando edição em: ${collectionName} (ID: ${editingExpense.id})`);

        const docRef = doc(db, 'artifacts', appId, 'public', 'data', collectionName, editingExpense.id);

        // Criar payload limpo apenas com campos persistentes
        const cleanPayload = {
          date: editingExpense.date,
          vehicleId: editingExpense.vehicleId,
          fleetName: (() => {
            if (editingExpense.vehicleId === 'unknown') return '';
            const v = vehicles.find(v => v.id === editingExpense.vehicleId);
            return v ? v.fleetName : (editingExpense.fleetName || '');
          })(),
          description: editingExpense.description,
          category: editingExpense.category,
          provider: editingExpense.provider || '',
          amount: Number(editingExpense.amount),
          type: editingExpense.type,
          details: editingExpense.details || {}
        };

        if (editingExpense.type === 'expense' && editingExpense.details) {
          // Se for saída (estoque), garantir que campos chave do details sejam preservados
          cleanPayload.details = {
            ...editingExpense.details,
            // Manter campos críticos de auditoria de estoque se existirem
            codMateria: editingExpense.details.codMateria || cleanPayload.details.codMateria,
            quantidade: editingExpense.details.quantidade || cleanPayload.details.quantidade,
            almoxarifado: editingExpense.details.almoxarifado || cleanPayload.details.almoxarifado
          };
        }

        try {
          await updateDoc(docRef, cleanPayload);
        } catch (updateError) {
          // Se o documento não existir, criar ele agora (Fallback para itens fantasmas)
          if (updateError.code === 'not-found' || updateError.message.includes('No document to update')) {
            console.warn(`👻 Item fantasma detectado! Recriando documento ${editingExpense.id} em ${collectionName}...`);
            await setDoc(docRef, cleanPayload);
          } else {
            throw updateError; // Re-lançar se for outro erro
          }
        }

        // Atualizar estado local
        setExpenses(prev => prev.map(e => e.id === editingExpense.id ? { ...e, ...cleanPayload } : e));

        // Se for almoxarifado, tem que atualizar lá também se estiver sendo exibido (opcional, mas bom pra consistência)
        // Mas como expenses é o que alimenta a view principal, o setExpenses acima já deve refletir na UI imediata

        setEditingExpense(null);
        alert('Lançamento atualizado com sucesso!');
      } catch (error) {
        console.error("Erro ao salvar edição:", error);
        alert("Erro ao salvar: " + error.message);
      }
    }
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setNewExpense({
      date: new Date().toISOString().split('T')[0],
      type: transactionType,
      vehicleId: 'unknown',
      description: '',
      category: '',
      provider: '',
      amount: 0,
      details: {}
    });
  };

  const handleSaveNew = async () => {
    if (newExpense && newExpense.description && newExpense.amount) {
      const selectedVehicle = vehicles.find(v => v.id === newExpense.vehicleId);
      const expenseToSave = {
        ...newExpense,
        fleetName: selectedVehicle ? selectedVehicle.fleetName : '',
      };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), expenseToSave);
      setIsCreating(false);
      setNewExpense(null);
    } else {
      alert('Por favor, preencha os campos obrigatórios: Descrição e Valor');
    }
  };

  const handleDeleteExpense = async (id) => {
    try {
      console.log('Excluindo lançamento com ID:', id);
      console.log('Path:', `artifacts/${appId}/public/data/expenses/${id}`);
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id);
      await deleteDoc(docRef);
      console.log('Lançamento excluído com sucesso do Firebase');

      // Force update by removing from local state
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error('Erro ao excluir lançamento:', error);
      alert('Erro ao excluir lançamento: ' + error.message);
    }
  };



  const handleBulkDelete = async (ids) => {
    if (!ids || ids.length === 0) {
      console.warn('⚠️ Nenhum ID fornecido para exclusão');
      return;
    }

    try {
      console.log('=== INICIANDO EXCLUSÃO EM LOTE ===');
      console.log('Quantidade de lançamentos a excluir:', ids.length);
      console.log('Path Firebase:', `artifacts/${appId}/public/data/expenses`);
      console.log('IDs a excluir (primeiros 10):', ids.slice(0, 10));

      // Reduzir tamanho do batch para evitar quota exceeded
      const batchSize = 100; // Reduzido de 500 para 100
      const delayBetweenBatches = 2000; // 2 segundos entre cada batch
      let deleteCount = 0;
      const totalBatches = Math.ceil(ids.length / batchSize);

      for (let i = 0; i < ids.length; i += batchSize) {
        const batchIds = ids.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;
        const batch = writeBatch(db);

        batchIds.forEach(id => {
          if (!id) {
            console.warn('⚠️ ID inválido encontrado:', id);
            return;
          }

          // NUCLEAR OPTION: Tentar deletar de AMBAS as coleções para garantir
          // Firestore permite deletar documento inexistente (é no-op), então é seguro.

          // 1. Deletar de Expenses
          const expensesRef = doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id);
          batch.delete(expensesRef);

          // 2. Deletar de Almoxarifado
          const almoxRef = doc(db, 'artifacts', appId, 'public', 'data', 'almoxarifado', id);
          batch.delete(almoxRef);

          // 3. Deletar de Rateios (Novo)
          const rateiosRef = doc(db, 'artifacts', appId, 'public', 'data', 'rateios', id);
          batch.delete(rateiosRef);

          deleteCount++; // Contamos como 1 item deletado (mesmo que sejam 3 operações)

          if (deleteCount <= 5) {
            console.log(`  ✓ Adicionado à batch (Expenses + Almox + Rateios): ${id}`);
          }
        });

        console.log(`Executando batch ${batchNumber}/${totalBatches} com ${batchIds.length} documentos...`);

        try {
          await batch.commit();
          console.log(`✅ Batch ${batchNumber}/${totalBatches} executado! (${deleteCount}/${ids.length})`);

          // Delay entre batches para evitar quota exceeded
          if (batchNumber < totalBatches) {
            console.log(`⏳ Aguardando ${delayBetweenBatches / 1000}s antes do próximo batch...`);
            await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
          }
        } catch (batchError) {
          console.error(`❌ Erro no batch ${batchNumber}:`, batchError.message);
          if (batchError.code === 'resource-exhausted') {
            console.log('⚠️ Quota excedida! Aguardando 5 segundos...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            // Tentar novamente
            await batch.commit();
            console.log(`✅ Batch ${batchNumber} executado após retry!`);
          } else {
            throw batchError;
          }
        }
      }

      console.log('✅ TODAS AS BATCHES EXECUTADAS COM SUCESSO!');
      console.log(`Total de documentos excluídos: ${deleteCount}`);

      // Aguardar mais tempo para garantir que o Firebase processou tudo
      console.log('Aguardando propagação no Firebase (2 segundos)...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Limpar estado local COMPLETAMENTE
      setExpenses(prev => {
        const filtered = prev.filter(e => !ids.includes(e.id));
        console.log(`Estado local atualizado: ${prev.length} → ${filtered.length} lançamentos`);
        return filtered;
      });

      setSelectedIds([]);

      console.log('=== EXCLUSÃO CONCLUÍDA COM SUCESSO ===');
      console.log('Recarregue a página se ainda vir lançamentos antigos (pode ser cache do navegador)');

      alert(`✅ ${deleteCount} lançamentos excluídos com sucesso!\n\nSe ainda ver lançamentos antigos, pressione Ctrl+F5 para limpar o cache.`);

      // Forçar reload da página após 1 segundo
      setTimeout(() => {
        if (window.confirm('Deseja recarregar a página para garantir que o cache foi limpo?')) {
          window.location.reload();
        }
      }, 1000);

    } catch (error) {
      console.error('=== ERRO NA EXCLUSÃO ===', error);
      console.error('Detalhes:', error.message, error.code);
      alert('❌ Erro ao excluir lançamentos: ' + error.message + '\n\nCódigo: ' + (error.code || 'Desconhecido'));
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === tableData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(tableData.map(item => item.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const availableCategories = useMemo(() => {
    const categories = expenses
      .map(e => cleanValue(e.category))
      .filter(cat => cat && cat.trim() !== '')
      .filter((cat, index, self) => self.indexOf(cat) === index)
      .sort();
    return categories;
  }, [expenses]);

  // --- OTIMIZAÇÃO: Usar dados pré-filtrados do App.jsx ---
  // Apenas filtragem por TIPO (Income/Expense) é necessária aqui
  const typeFilteredData = useMemo(() => {
    // Fallback para expenses se filteredExpenses não estiver disponível (segurança)
    const sourceData = filteredExpenses || expenses;
    // Debugging: Monitorar filtragem de tipo
    console.log('DEBUG: typeFilteredData recalculado', {
      sourceLength: filteredExpenses?.length || expenses?.length,
      type: transactionType,
      resultLength: sourceData.filter(e => e.type === transactionType).length
    });
    return sourceData.filter(e => e.type === transactionType);
  }, [filteredExpenses, expenses, transactionType]);

  const parseDisplayDate = (dateStr) => {
    if (!dateStr) return '';

    const cleanDateStr = dateStr.trim().replace(/^["']|["']$/g, '');

    if (cleanDateStr.length === 8 && /^\d{8}$/.test(cleanDateStr)) {
      return `${cleanDateStr.substring(6, 8)}/${cleanDateStr.substring(4, 6)}/${cleanDateStr.substring(0, 4)}`;
    }

    if (cleanDateStr.includes('-')) {
      const [year, month, day] = cleanDateStr.split('-');
      if (year && month && day) {
        return `${day}/${month}/${year}`;
      }
    }

    if (cleanDateStr.includes('/')) {
      return cleanDateStr;
    }

    return cleanDateStr;
  };

  const getBestDate = (expense) => {
    if (expense.details?.lctoDate) {
      return expense.details.lctoDate;
    }
    if (expense.details?.emisDate) {
      return expense.details.emisDate;
    }
    return expense.date;
  };

  const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const tableData = useMemo(() => {
    return typeFilteredData
      .map(item => {
        const vehicle = vehicles.find(v => v.id === item.vehicleId);
        return {
          ...item,
          vehicle,
          fleetName: vehicle?.fleetName || item.fleetName || 'Não identificado',
          plate: vehicle?.plate || '---',
          model: vehicle?.model || ''
        };
      })
      .filter(item => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        const itemDate = parseDisplayDate(getBestDate(item));
        const itemValue = formatCurrency(item.amount).toLowerCase();

        return (
          item.description.toLowerCase().includes(searchLower) ||
          item.fleetName.toLowerCase().includes(searchLower) ||
          item.plate.toLowerCase().includes(searchLower) ||
          item.model.toLowerCase().includes(searchLower) ||
          String(item.category).toLowerCase().includes(searchLower) ||
          (item.provider && item.provider.toLowerCase().includes(searchLower)) ||
          itemDate.includes(searchLower) ||
          itemValue.includes(searchLower)
        );
      })
      .sort((a, b) => {
        return a.fleetName.localeCompare(b.fleetName, 'pt-BR', { numeric: true });
      });
  }, [typeFilteredData, vehicles, searchTerm]);

  const classSummary = useMemo(() => {
    const summary = {};

    typeFilteredData.forEach(expense => {
      const className = cleanValue(expense.category) || 'Sem Classe';
      summary[className] = (summary[className] || 0) + expense.amount;
    });

    return Object.entries(summary)
      .map(([className, total]) => ({ className, total }))
      .sort((a, b) => b.total - a.total);
  }, [typeFilteredData]);

  const totalConferencia = useMemo(() => {
    return classSummary.reduce((sum, item) => sum + item.total, 0);
  }, [classSummary]);

  const DetailItem = ({ label, value, colSpan = 1, isTotal = false }) => (
    <div className={`flex flex-col gap-1 ${colSpan === 2 ? 'col-span-2' : ''}`}>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{label}</span>
      <span className={`text-sm font-bold ${isTotal ? 'text-red-600 text-lg' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header & Controls */}
      <div className="flex flex-col gap-6 mb-8">

        {/* Row 1: Title and Filters */}
        <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
          {/* Title */}
          <div className="text-center xl:text-left shrink-0">
            <h2 className="text-2xl font-bold text-slate-900">Lançamentos Financeiros</h2>
            <p className="text-slate-500 mt-1 text-sm">
              Gestão detalhada de entradas e saídas de frota
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-center xl:justify-end gap-3 shrink-0">
            {/* Period Type Filter */}
            <select
              value={filters.periodType}
              onChange={(e) => setFilters({ ...filters, periodType: e.target.value, periodValue: 1 })}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all cursor-pointer"
            >
              <option value="Mês">Mês</option>
              <option value="Trimestre">Trimestre</option>
              <option value="Semestre">Semestre</option>
              <option value="Ano">Ano</option>
            </select>

            {/* Period Value Filter */}
            {filters.periodType !== 'Ano' && (
              <select
                value={filters.periodValue}
                onChange={(e) => setFilters({ ...filters, periodValue: parseInt(e.target.value) })}
                className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all cursor-pointer"
              >
                {filters.periodType === 'Mês' && ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
                {filters.periodType === 'Trimestre' && [1, 2, 3, 4].map(t => (
                  <option key={t} value={t}>{t}º Trimestre</option>
                ))}
                {filters.periodType === 'Semestre' && [1, 2].map(s => (
                  <option key={s} value={s}>{s}º Semestre</option>
                ))}
              </select>
            )}

            {/* Year Filter */}
            <select
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all cursor-pointer"
            >
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>

            {/* Fleet Type Filter */}
            <select
              value={filters.fleetType}
              onChange={(e) => setFilters({ ...filters, fleetType: e.target.value })}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all cursor-pointer flex items-center gap-2"
            >
              <option value="Todos">Todas Frotas</option>
              <option value="Leve">Frota Leve</option>
              <option value="Pesada">Frota Pesada</option>
            </select>
          </div>
        </div>

        {/* Row 2: Centered Transaction Type Toggle */}
        <div className="flex justify-center w-full">
          <div className="bg-slate-100 p-1.5 rounded-xl flex font-medium text-sm shadow-sm">
            <button
              onClick={() => setTransactionType('income')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${transactionType === 'income'
                ? 'bg-white text-emerald-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <ArrowUpCircle size={16} />
              <span>Entradas <span className="text-xs opacity-70">(Nota Fiscal)</span></span>
            </button>
            <button
              onClick={() => setTransactionType('expense')}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${transactionType === 'expense'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <ArrowDownCircle size={16} />
              <span>Saídas <span className="text-xs opacity-70">(Estoque)</span></span>
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Type & Title */}


      {/* Filters & Actions Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between gap-4">

          {/* Search */}
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por descrição, frota, placa ou fornecedor..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm transition-all shadow-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <>
                <button
                  onClick={() => {
                    if (window.confirm(`Deseja excluir definitivamente os ${selectedIds.length} lançamentos selecionados?`)) {
                      handleBulkDelete(selectedIds);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors animate-fade-in"
                >
                  <Trash2 size={18} />
                  Excluir ({selectedIds.length})
                </button>


              </>
            )}

            <button
              onClick={() => setShowConferencia(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors shadow-sm"
            >
              <FileText size={18} />
              Conferência
            </button>

            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 rounded-xl transition-colors shadow-lg"
            >
              <Plus size={18} />
              Novo
            </button>

            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors">
              <Download size={18} />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Data Table Virtualizada */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Header Fixo - Simula Tabela */}
        <div className="flex bg-slate-50/50 border-b border-slate-100 items-center px-4 py-3 w-full">
          <div className="w-[50px] flex justify-center">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
              checked={tableData.length > 0 && selectedIds.length === tableData.length}
              onChange={toggleSelectAll}
            />
          </div>
          <div className="w-[100px] text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">Data</div>
          <div className="flex-1 min-w-[120px] text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">Frota / Veículo</div>
          <div className="flex-1 min-w-[120px] text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">Descrição</div>
          <div className="flex-1 min-w-[100px] text-[11px] font-bold text-slate-400 uppercase tracking-widest px-2">Classe / Fornecedor</div>
          <div className="w-[140px] text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right px-2">Valor</div>
          <div className="w-[140px] text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right px-2">Ações</div>
        </div>

        {/* Lista Padrão (Sem Virtualização) */}
        <div className="w-full h-[600px] overflow-y-auto">
          {tableData.length > 0 ? (
            <div className="w-full">
              {tableData.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                // Funções auxiliares simplificadas para acesso direto
                const displayDate = parseDisplayDate(getBestDate(item));
                const description = cleanValue(item.description);
                const category = cleanValue(item.category);
                const provider = cleanValue(item.provider);
                const amount = formatCurrency(item.amount);

                return (
                  <div key={item.id} className={`flex items-center px-4 border-b border-slate-50 hover:bg-slate-50/80 transition-all group py-3 ${isSelected ? 'bg-teal-50/30' : ''}`}>

                    {/* Checkbox */}
                    <div className="w-[50px] flex justify-center flex-shrink-0">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(item.id)}
                      />
                    </div>

                    {/* Data */}
                    <div className="w-[100px] px-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-700 font-mono">
                        {displayDate}
                      </span>
                    </div>

                    {/* Frota */}
                    <div className="flex-1 min-w-[120px] px-2 flex-shrink-0">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-1.5 rounded-lg ${transactionType === 'expense' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                          <Truck size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{item.fleetName}</p>
                          <p className="text-xs text-slate-500 truncate">{item.model} • <span className="font-mono">{item.plate}</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Descrição */}
                    <div className="flex-1 min-w-[120px] px-2 flex-shrink-0">
                      <p className="text-sm text-slate-700 font-medium truncate" title={description}>
                        {description}
                      </p>
                    </div>

                    {/* Classe / Fornecedor */}
                    <div className="flex-1 min-w-[120px] px-2 flex flex-col gap-1 min-w-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 w-fit">
                        {category}
                      </span>
                      {item.provider && (
                        <span className="text-xs text-slate-400 font-medium truncate" title={provider}>
                          {provider}
                        </span>
                      )}
                    </div>

                    {/* Valor */}
                    <div className="w-[140px] px-2 text-right flex-shrink-0">
                      <span className={`text-sm font-bold font-mono ${transactionType === 'expense' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {amount}
                      </span>
                    </div>

                    {/* Ações */}
                    <div className="w-[140px] px-2 text-right flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => setSelectedExpense(item)}
                        className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Ver Detalhes"
                      >
                        <FileText size={16} />
                      </button>

                      <button
                        onClick={() => {
                          console.log('📝 EDITING ITEM:', item); // DIAGNÓSTICO
                          setEditingExpense(item);
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm('Tem certeza que deseja excluir este lançamento?')) {
                            handleDeleteExpense(item.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="bg-slate-50 p-4 rounded-full">
                <Filter size={24} className="text-slate-300" />
              </div>
              <p className="font-medium">Nenhum lançamento encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE DETALHES */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">

            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="text-orange-500" /> Detalhes do Lançamento
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">
                  TIPO: {selectedExpense.type === 'income' ? 'ENTRADA (NOTA FISCAL)' : 'SAÍDA (REQUISIÇÃO)'}
                </p>
              </div>
              <button onClick={() => setSelectedExpense(null)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8">
              {selectedExpense.type === 'income' ? (
                <div className="grid grid-cols-3 gap-y-8 gap-x-4">
                  <DetailItem label="DATA LANÇAMENTO" value={cleanValue(selectedExpense.details?.lctoDate) || cleanValue(selectedExpense.date)} />
                  <DetailItem label="DATA EMISSÃO" value={cleanValue(selectedExpense.details?.emisDate) || cleanValue(selectedExpense.date)} />
                  <DetailItem label="NOTA FISCAL" value={cleanValue(selectedExpense.details?.notaFiscal)} />
                  <DetailItem label="EMPRESA" value={cleanValue(selectedExpense.details?.empresa) || 'Manual'} />
                  <DetailItem label="FORNECEDOR" value={cleanValue(selectedExpense.details?.fornecedor) || cleanValue(selectedExpense.provider)} colSpan={2} />
                  <DetailItem label="CÓD. FORNECEDOR" value={cleanValue(selectedExpense.details?.codFornecedor)} />
                  <DetailItem label="CLASSE" value={cleanValue(selectedExpense.details?.classe) || cleanValue(selectedExpense.category)} />
                  <DetailItem label="ORDEM DE COMPRA" value={cleanValue(selectedExpense.details?.ordemCompra)} />
                  <DetailItem label="DESCRIÇÃO" value={cleanValue(selectedExpense.description)} colSpan={3} />
                  <DetailItem label="VALOR TOTAL" value={formatCurrency(selectedExpense.amount)} isTotal />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-y-8 gap-x-4">
                  <DetailItem label="DATA" value={cleanValue(selectedExpense.details?.date) || cleanValue(selectedExpense.date)} />
                  <DetailItem label="CÓD. LANÇAMENTO" value={cleanValue(selectedExpense.details?.codLancamento)} />
                  <DetailItem label="EMPRESA" value={cleanValue(selectedExpense.details?.empresa) || 'Manual'} />
                  <DetailItem label="MATÉRIA / DESCRIÇÃO" value={cleanValue(selectedExpense.details?.materia) || cleanValue(selectedExpense.description)} colSpan={2} />
                  <DetailItem label="DESCRIÇÃO (SISTEMA)" value={cleanValue(selectedExpense.description)} colSpan={3} />
                  <DetailItem label="CÓD. MATÉRIA" value={cleanValue(selectedExpense.details?.codMateria)} />
                  <DetailItem label="QUANTIDADE" value={selectedExpense.details?.quantidade || '0'} />
                  <DetailItem label="VALOR ENTRADA" value={formatCurrency(selectedExpense.details?.valorEntrada || selectedExpense.amount)} />
                  <DetailItem label="VALOR TOTAL" value={formatCurrency(selectedExpense.details?.valorTotal || selectedExpense.amount)} isTotal />
                  <DetailItem label="RECEBEDOR" value={cleanValue(selectedExpense.details?.recebedor)} />
                  <DetailItem label="ALMOXARIFADO" value={cleanValue(selectedExpense.details?.almoxarifado)} />
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedExpense(null)}
                className="px-8 py-2.5 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-lg"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFERÊNCIA */}
      {showConferencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">

            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-purple-50 to-blue-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="text-purple-600" /> Conferência de Lançamentos
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Tipo: <span className={`font-bold ${transactionType === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {transactionType === 'income' ? 'ENTRADAS (Nota Fiscal)' : 'SAÍDAS (Estoque)'}
                  </span> • Período: {filters.periodType} {filters.periodValue}/{filters.year}
                </p>
              </div>
              <button onClick={() => setShowConferencia(false)} className="p-2 hover:bg-white/50 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Classe
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Valor Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {classSummary.length > 0 ? (
                      classSummary.map((item, index) => (
                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3">
                            <span className="text-sm font-medium text-slate-900">{item.className}</span>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className={`text-sm font-bold font-mono ${transactionType === 'expense' ? 'text-red-600' : 'text-emerald-600'}`}>
                              {formatCurrency(item.total)}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-6 py-8 text-center text-slate-400">
                          Nenhum lançamento encontrado para este período.
                        </td>
                      </tr>
                    )}

                    {classSummary.length > 0 && (
                      <tr className="bg-gradient-to-r from-purple-50 to-blue-50 font-bold border-t-2 border-purple-200">
                        <td className="px-6 py-4 text-sm text-slate-900 uppercase tracking-wide">
                          Total Geral
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-lg font-bold font-mono ${transactionType === 'expense' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(totalConferencia)}
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Total de Classes</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{classSummary.length}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">Total de Lançamentos</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">{typeFilteredData.length}</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <button
                onClick={() => setShowConferencia(false)}
                className="px-6 py-2.5 bg-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-300 transition-all"
              >
                Fechar
              </button>
              <button
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-all shadow-lg"
              >
                <Download size={18} />
                Exportar Conferência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {editingExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Edit2 size={20} className="text-teal-600" />
                  Editar Lançamento
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Os campos foram limpos automaticamente para edição.</p>
              </div>
              <button onClick={() => setEditingExpense(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Data do Lançamento</label>
                <input
                  type="date"
                  value={editingExpense.date}
                  onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Frota / Veículo Vinculado</label>
                <select
                  value={editingExpense.vehicleId}
                  onChange={(e) => setEditingExpense({ ...editingExpense, vehicleId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
                >
                  <option value="unknown">Selecione um Veículo</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {cleanValue(v.fleetName)} - {cleanValue(v.model)} ({cleanValue(v.plate)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Descrição</label>
                <input
                  type="text"
                  value={cleanValue(editingExpense.description)}
                  onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Classe (Categoria)</label>
                <select
                  value={cleanValue(editingExpense.category)}
                  onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
                >
                  <option value="">Selecione uma categoria</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fornecedor</label>
                <input
                  type="text"
                  value={cleanValue(editingExpense.provider || '')}
                  onChange={(e) => setEditingExpense({ ...editingExpense, provider: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valor (R$)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editingExpense.amount}
                    onChange={(e) => setEditingExpense({ ...editingExpense, amount: Number(e.target.value) })}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-teal-600 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingExpense(null)}
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-10 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CRIAÇÃO */}
      {isCreating && newExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-green-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <ArrowUpCircle size={20} className="text-emerald-600" />
                  Novo Lançamento Manual
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Tipo: {transactionType === 'income' ? 'ENTRADA (NOTA FISCAL)' : 'SAÍDA (ESTOQUE)'}
                </p>
              </div>
              <button onClick={() => {
                setIsCreating(false);
                setNewExpense(null);
              }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Data do Lançamento *</label>
                <input
                  type="date"
                  value={newExpense.date || ''}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Frota / Veículo Vinculado</label>
                <select
                  value={newExpense.vehicleId || 'unknown'}
                  onChange={(e) => setNewExpense({ ...newExpense, vehicleId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="unknown">Selecione um Veículo</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {cleanValue(v.fleetName)} - {cleanValue(v.model)} ({cleanValue(v.plate)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Descrição *</label>
                <input
                  type="text"
                  value={newExpense.description || ''}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  placeholder="Informe a descrição do lançamento"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Classe (Categoria)</label>
                <select
                  value={newExpense.category || ''}
                  onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione uma categoria</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fornecedor</label>
                <input
                  type="text"
                  value={newExpense.provider || ''}
                  onChange={(e) => setNewExpense({ ...newExpense, provider: e.target.value })}
                  placeholder="Nome do fornecedor"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valor (R$) *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={newExpense.amount || 0}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewExpense(null);
                }}
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNew}
                className="px-10 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
              >
                Criar Lançamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}