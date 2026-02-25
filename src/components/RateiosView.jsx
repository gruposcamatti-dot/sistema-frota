import React, { useState, useMemo } from 'react';
import { Plus, Trash2, PieChart, Save, ArrowUpCircle, ArrowDownCircle, CheckCircle, FileText, X, Search, Edit2, Truck } from 'lucide-react';
import { collection, doc, writeBatch, deleteDoc, addDoc } from 'firebase/firestore';
import { formatCurrency } from '../utils/formatters';

export default function RateiosView({ rateios, expenses, db, appId, filters, setFilters, vehicles }) {
  const [localRateios, setLocalRateios] = useState(rateios);
  const [editingId, setEditingId] = useState(null);
  const [activeTab, setActiveTab] = useState('rateio'); // 'rateio' | 'despesas'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'income' | 'expense'

  // Actions State
  const [showConferencia, setShowConferencia] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newExpense, setNewExpense] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  // Segment Selection State
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [activeRateioId, setActiveRateioId] = useState(null);
  const [segmentSearch, setSegmentSearch] = useState('');
  const [expensesSearch, setExpensesSearch] = useState('');

  // Helper to clean values
  const cleanValue = (val) => {
    if (!val) return '';
    return String(val).replace(/['"]/g, '').trim();
  };

  // Helper to clean description
  const cleanDescription = (desc) => {
    if (!desc) return '-';
    const cleaned = String(desc).trim();
    // Se tiver uma sequência muito longa de zeros (pelo menos 10), provável lixo de importação/SAF
    if (/0{10,}/.test(cleaned)) return 'Lançamento SAF';
    // Se for composto apenas por zeros (pelo menos 3)
    if (/^000+$/.test(cleaned)) return 'Lançamento SAF';
    return desc;
  };

  // Format salary input value
  const formatSalaryInput = (value) => {
    // Remove tudo exceto números e vírgula
    const numericValue = value.replace(/[^\d,]/g, '');
    // Remove vírgulas extras, mantendo apenas a última
    const parts = numericValue.split(',');
    if (parts.length > 2) {
      return parts[0] + ',' + parts.slice(1).join('');
    }
    return numericValue;
  };

  // Parse formatted salary to number
  const parseSalaryToNumber = (formattedValue) => {
    const cleaned = formattedValue.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  // Format number to display in input
  const formatSalaryDisplay = (number) => {
    if (!number || number === 0) return '';
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper to format percentage display (pt-BR)
  const formatPercentDisplay = (val) => {
    if (val === undefined || val === null) return '0,00';
    return Number(val).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const parsePercentToNumber = (val) => {
    if (!val) return 0;
    const cleanValue = val.replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanValue) || 0;
  };

  const formatPercentInput = (val) => {
    let clean = val.replace(/[^\d]/g, '');
    if (!clean) return '0,00';
    let num = (parseInt(clean) / 100).toFixed(2);
    return num.replace('.', ',');
  };

  // Add new empty row
  const handleAddRow = () => {
    const newRateio = {
      id: Math.random().toString(36).substr(2, 9),
      funcionario: '',
      cc: '',
      segmento: '',
      tipoRateio: 'Manutenção',
      distribuicao: 0
    };
    setLocalRateios([...localRateios, newRateio]);
    setEditingId(newRateio.id);
  };

  // Update a field in a rateio
  const handleUpdateField = (id, field, value) => {
    setLocalRateios(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: value };
        // Recalculate distribuicao when salarioFunc or percentual changes
        if (field === 'salarioFunc' || field === 'percentual') {
          updated.distribuicao = updated.salarioFunc * (updated.percentual / 100);
        }
        return updated;
      }
      return r;
    }));
  };

  // Delete a rateio
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rateios', id));
      setLocalRateios(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error("Erro ao excluir rateio:", error);
    }
  };

  // Save all changes
  const handleSave = async () => {
    try {
      const batch = writeBatch(db);
      const rateiosRef = collection(db, 'artifacts', appId, 'public', 'data', 'rateios');

      localRateios.forEach((rateio) => {
        const docRef = doc(rateiosRef, rateio.id);
        const { id, ...data } = rateio;
        batch.set(docRef, data);
      });

      await batch.commit();
      setEditingId(null);
      alert('Rateios salvos com sucesso!');
    } catch (error) {
      console.error("Erro ao salvar rateios:", error);
      alert('Erro ao salvar rateios');
    }
  };

  // Calculate CC Statistics and individual costs
  const ccStats = useMemo(() => {
    // 1. Count employees per CC
    const empCountPerCC = {};
    const employeesInCC = {}; // To group employee names/ids per CC

    localRateios.forEach(r => {
      if (r.cc) {
        empCountPerCC[r.cc] = (empCountPerCC[r.cc] || 0) + 1;
        if (!employeesInCC[r.cc]) employeesInCC[r.cc] = [];
        employeesInCC[r.cc].push(r.funcionario);
      }
    });

    // 2. Sum expenses per CC (shared) and per Employee (specific salary/meal)
    const ccSharedTotal = {};
    const employeeSpecificCosts = {};

    // Help identify individual expense categories
    const individualCategories = ['SALARIOS E ORDENADOS', 'REFEICAO E LANCHES'];

    if (expenses) {
      expenses.forEach(e => {
        const cc = e.fleetName ? String(e.fleetName).replace(/CCUS:|"/g, '').trim() : null;
        const category = String(e.category || '').trim().toUpperCase();
        const amount = (e.type === 'income' ? e.amount : -e.amount);

        if (individualCategories.includes(category)) {
          // Specific cost for an employee
          const empName = e.assignedEmployee;
          if (empName) {
            employeeSpecificCosts[empName] = (employeeSpecificCosts[empName] || 0) + amount;
          }
        } else if (cc) {
          // Shared expense across CC
          ccSharedTotal[cc] = (ccSharedTotal[cc] || 0) + amount;
        }
      });
    }

    return { empCountPerCC, ccSharedTotal, employeeSpecificCosts };
  }, [localRateios, expenses]);

  // Calculate totals based on calculated costs
  const totals = useMemo(() => {
    let totalCusto = 0;
    localRateios.forEach(r => {
      const sharedCC = ccStats.ccSharedTotal[r.cc] || 0;
      const count = ccStats.empCountPerCC[r.cc] || 1;
      const individualCost = ccStats.employeeSpecificCosts[r.funcionario] || 0;

      const calculatedRowCusto = Math.abs(sharedCC / count) + Math.abs(individualCost);
      totalCusto += calculatedRowCusto;
    });

    return {
      salarioFunc: totalCusto,
      distribuicao: localRateios.reduce((sum, r) => sum + (r.distribuicao || 0), 0)
    };
  }, [localRateios, ccStats]);

  // Filter expenses for Despesas tab
  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];

    let base = expenses;
    if (typeFilter !== 'all') {
      base = base.filter(e => e.type === typeFilter);
    }

    if (expensesSearch) {
      const s = expensesSearch.toLowerCase();
      base = base.filter(e =>
        (e.description && cleanDescription(e.description).toLowerCase().includes(s)) ||
        (e.fleetName && e.fleetName.toLowerCase().includes(s)) ||
        (e.category && e.category.toLowerCase().includes(s))
      );
    }

    return base;
  }, [expenses, typeFilter, expensesSearch]);

  // Conference Summary
  const classSummary = useMemo(() => {
    const summary = {};
    filteredExpenses.forEach(expense => {
      const className = cleanValue(expense.category) || 'Sem Classe';
      // Income adds, Expense subtracts for the net total, but usually conference shows magnitude
      // For simplified conference, let's just sum the amounts regardless of sign, 
      // OR respect the sign if we want a balance. 
      // Usually "Conferência" is checking the totals of what's listed.
      // So let's just sum the amount field.
      summary[className] = (summary[className] || 0) + expense.amount;
    });

    return Object.entries(summary)
      .map(([className, total]) => ({ className, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  const totalConferencia = useMemo(() => {
    return classSummary.reduce((sum, item) => sum + item.total, 0);
  }, [classSummary]);

  const availableCategories = useMemo(() => {
    if (!expenses) return [];
    const categories = expenses
      .map(e => cleanValue(e.category))
      .filter(cat => cat && cat.trim() !== '')
      .filter((cat, index, self) => self.indexOf(cat) === index)
      .sort();
    return categories;
  }, [expenses]);

  // Unique Vehicle Types (Segments)
  const vehicleTypes = useMemo(() => {
    if (!vehicles) return [];
    const types = vehicles
      .map(v => cleanValue(v.assetCode))
      .filter(t => t && t.trim() !== '')
      .filter((t, index, self) => self.indexOf(t) === index)
      .sort();
    return types;
  }, [vehicles]);

  const filteredVehicleTypes = useMemo(() => {
    return vehicleTypes.filter(t =>
      t.toLowerCase().includes(segmentSearch.toLowerCase())
    );
  }, [vehicleTypes, segmentSearch]);


  const handleCreateNew = () => {
    setIsCreating(true);
    setNewExpense({
      date: new Date().toISOString().split('T')[0],
      type: 'expense', // Default to expense for Rateios, but user can change if we implement toggle
      scope: 'rateio', // CRITICAL: identified as rateio
      vehicleId: 'rateio', // Default marker
      fleetName: '', // Human readable CC
      description: '',
      category: '',
      amount: 0,
      assignedEmployee: '',
      details: {}
    });
  };

  const handleSaveNew = async () => {
    if (newExpense && newExpense.description && newExpense.amount) {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'expenses'), newExpense);
        setIsCreating(false);
        setNewExpense(null);
        alert('Lançamento adicionado com sucesso!');
      } catch (error) {
        console.error("Erro ao criar lançamento:", error);
        alert("Erro ao criar: " + error.message);
      }
    } else {
      alert('Por favor, preencha os campos obrigatórios: Descrição e Valor');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este lançamento?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id));
      alert('Lançamento excluído com sucesso!');
    } catch (error) {
      console.error("Erro ao excluir lançamento:", error);
      alert("Erro ao excluir: " + error.message);
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`Deseja excluir definitivamente os ${selectedIds.length} lançamentos selecionados?`)) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'expenses', id);
        batch.delete(docRef);
      });
      await batch.commit();
      setSelectedIds([]);
      alert(`${selectedIds.length} lançamentos excluídos com sucesso!`);
    } catch (error) {
      console.error("Erro na exclusão em lote:", error);
      alert("Erro ao excluir em lote: " + error.message);
    }
  };

  const handleSaveEdit = async () => {
    if (editingExpense) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'expenses', editingExpense.id);
        const { id, ...data } = editingExpense;
        const cleanData = {
          ...data,
          amount: Number(data.amount) || 0,
          date: data.date || new Date().toISOString().split('T')[0]
        };

        const batch = writeBatch(db);
        batch.set(docRef, cleanData, { merge: true });
        await batch.commit();

        setEditingExpense(null);
        alert('Lançamento atualizado com sucesso!');
      } catch (error) {
        console.error("Erro ao salvar edição:", error);
        alert("Erro ao salvar: " + error.message);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredExpenses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredExpenses.map(item => item.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

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
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rateios de Custos</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Distribua custos por funcionário, segmento e tipo de despesa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('rateio')}
          className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'rateio'
            ? 'border-teal-600 text-teal-700'
            : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          Rateios
        </button>
        <button
          onClick={() => setActiveTab('despesas')}
          className={`px-6 py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'despesas'
            ? 'border-teal-600 text-teal-700'
            : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          Despesas
        </button>
      </div>

      {/* --- TAB RATEIOS --- */}
      {activeTab === 'rateio' && (
        <>
          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 border border-teal-700 rounded-xl transition-colors shadow-lg"
            >
              <Plus size={18} />
              Adicionar Linha
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
            >
              <Save size={18} />
              Salvar Alterações
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex-1 flex flex-col">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[20%]">Funcionário</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[100px]">CC</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[180px]">Segmento</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[180px]">Tipo de Rateio</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center w-[180px]">Custo</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center w-[80px]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {localRateios.length > 0 ? (
                    localRateios.map((rateio) => (
                      <tr key={rateio.id} className="hover:bg-slate-50/80 transition-all group">

                        {/* Funcionário */}
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={rateio.funcionario}
                            onChange={(e) => handleUpdateField(rateio.id, 'funcionario', e.target.value)}
                            placeholder="Nome do funcionário"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                          />
                        </td>

                        {/* CC */}
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={rateio.cc}
                            onChange={(e) => handleUpdateField(rateio.id, 'cc', e.target.value)}
                            placeholder="Ex: 101"
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-center"
                          />
                        </td>

                        {/* Segmento */}
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setActiveRateioId(rateio.id);
                              setShowSegmentModal(true);
                              setSegmentSearch('');
                            }}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-left bg-white hover:bg-slate-50 transition-colors flex flex-wrap gap-1 min-h-[42px]"
                          >
                            {rateio.segmento ? (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-teal-50 text-teal-700 rounded-lg text-xs font-black border border-teal-100 uppercase tracking-tight">
                                  {rateio.segmento.split(',').length} {rateio.segmento.split(',').length === 1 ? 'segmento' : 'segmentos'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">Selecionar...</span>
                            )}
                          </button>
                        </td>

                        {/* Tipo de Rateio */}
                        <td className="px-6 py-4">
                          <select
                            value={rateio.tipoRateio}
                            onChange={(e) => handleUpdateField(rateio.id, 'tipoRateio', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                          >
                            <option value="Manutenção">Manutenção</option>
                            <option value="Combustível">Combustível</option>
                          </select>
                        </td>

                        {/* Custo (Automatizado) */}
                        <td className="px-6 py-4">
                          <div className="text-center font-bold text-slate-900">
                            {(() => {
                              const sharedCC = ccStats.ccSharedTotal[rateio.cc] || 0;
                              const count = ccStats.empCountPerCC[rateio.cc] || 1;
                              const individualCost = ccStats.employeeSpecificCosts[rateio.funcionario] || 0;
                              const calculated = Math.abs(sharedCC / count) + Math.abs(individualCost);
                              return formatCurrency(calculated);
                            })()}
                          </div>
                        </td>

                        {/* Ações */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleDelete(rateio.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        <PieChart size={48} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">Nenhum rateio cadastrado</p>
                        <p className="text-xs mt-1">Clique em "Adicionar Linha" para começar</p>
                      </td>
                    </tr>
                  )}
                </tbody>

                {/* Footer com Totais */}
                {localRateios.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                    <tr className="font-bold">
                      <td colSpan={4} className="px-6 py-4 text-sm text-slate-700 uppercase tracking-wider">
                        Total
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-slate-900 font-bold">
                        {formatCurrency(totals.salarioFunc)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total de Rateios</p>
              <p className="text-2xl font-bold text-slate-900">{localRateios.length}</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Custos</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(totals.salarioFunc)}</p>
            </div>
          </div>
        </>
      )}


      {/* --- TAB DESPESAS --- */}
      {activeTab === 'despesas' && (
        <>
          {/* Controls: Type Toggles & Actions */}
          <div className="flex flex-col xl:flex-row justify-between items-center gap-4 mb-6">

            {/* Centered Transaction Type Toggle */}
            <div className="bg-slate-100 p-1.5 rounded-xl flex font-medium text-sm shadow-sm order-2 xl:order-1">
              <button
                onClick={() => setTypeFilter('all')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all ${typeFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-sm ring-1 ring-black/5 font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
              >
                Todos
              </button>
              <button
                onClick={() => setTypeFilter('income')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all ${typeFilter === 'income'
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm ring-1 ring-emerald-500/20 font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
              >
                <ArrowUpCircle size={16} className={typeFilter === 'income' ? 'text-emerald-500' : ''} />
                Entrada
              </button>
              <button
                onClick={() => setTypeFilter('expense')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all ${typeFilter === 'expense'
                  ? 'bg-rose-50 text-rose-700 shadow-sm ring-1 ring-rose-500/20 font-bold'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
              >
                <ArrowDownCircle size={16} className={typeFilter === 'expense' ? 'text-rose-500' : ''} />
                Saída
              </button>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md w-full relative order-3 xl:order-2">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={18} />
              </span>
              <input
                type="text"
                value={expensesSearch}
                onChange={(e) => setExpensesSearch(e.target.value)}
                placeholder="Pesquisar por descrição, CC ou categoria..."
                className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 shadow-sm transition-all"
              />
              {expensesSearch && (
                <button
                  onClick={() => setExpensesSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Actions Buttons */}
            <div className="flex gap-3 order-1 xl:order-2 self-end xl:self-auto items-center">
              {selectedIds.length > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors animate-fade-in"
                >
                  <Trash2 size={18} />
                  Excluir ({selectedIds.length})
                </button>
              )}
              <button
                onClick={() => setShowConferencia(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                title="Visualizar Conferência"
              >
                <CheckCircle size={18} />
                Conferência
              </button>
              <button
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 border border-teal-700 rounded-xl transition-colors shadow-lg"
                title="Novo Lançamento Manual"
              >
                <Plus size={18} />
                Novo
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex-1 flex flex-col animate-in fade-in duration-300">
            <div className="overflow-x-auto flex-1">
              <table className="min-w-full w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-4 w-[40px] text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                        checked={filteredExpenses.length > 0 && selectedIds.length === filteredExpenses.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[140px]">Data</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[120px]">CC</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Descrição</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[200px]">Categoria</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[160px] text-right">Valor</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[140px] text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredExpenses && filteredExpenses.length > 0 ? (
                    filteredExpenses.map((expense) => {
                      const isSelected = selectedIds.includes(expense.id);
                      return (
                        <tr key={expense.id} className={`hover:bg-slate-50/80 transition-all ${isSelected ? 'bg-teal-50/30' : ''}`}>
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                              checked={isSelected}
                              onChange={() => toggleSelectOne(expense.id)}
                            />
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                            {expense.date ? new Date(expense.date).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700 font-bold whitespace-nowrap">
                            {expense.fleetName ? expense.fleetName.replace('CCUS:', '').replace(/"/g, '').trim() : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-900 font-medium">
                            {cleanDescription(expense.description)}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            <span className="px-2 py-1 bg-slate-100 rounded text-xs font-semibold text-slate-500">
                              {expense.category || 'Geral'}
                            </span>
                          </td>
                          <td className={`px-6 py-4 text-sm font-bold text-right ${expense.type === 'expense' ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(expense.amount)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedExpense(expense)}
                                className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                                title="Ver Lançamento"
                              >
                                <FileText size={16} />
                              </button>
                              <button
                                onClick={() => setEditingExpense(expense)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Excluir"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        <p className="text-sm font-medium">Nenhuma despesa encontrada para este filtro.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredExpenses && filteredExpenses.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                    <tr className="font-bold">
                      <td colSpan={5} className="px-6 py-4 text-sm text-slate-700 uppercase tracking-wider text-right">
                        Total
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-slate-900 font-bold">
                        {formatCurrency(filteredExpenses.reduce((acc, curr) => {
                          return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
                        }, 0))}
                      </td>
                      <td colSpan={1}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
      {/* MODAL DE CONFERÊNCIA */}
      {showConferencia && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle size={20} className="text-purple-600" />
                  Conferência de Rateios
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Resumo por categoria dos itens exibidos</p>
              </div>
              <button onClick={() => setShowConferencia(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</th>
                    <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classSummary.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-sm font-medium text-slate-700">{item.className}</td>
                      <td className="px-6 py-3 text-sm font-bold text-slate-900 text-right">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                  {classSummary.length === 0 && (
                    <tr><td colSpan={2} className="px-6 py-8 text-center text-slate-400 text-sm">Nenhum dado para conferência.</td></tr>
                  )}
                </tbody>
                {classSummary.length > 0 && (
                  <tfoot className="bg-purple-50 border-t border-purple-100 font-bold">
                    <tr>
                      <td className="px-6 py-4 text-purple-900 uppercase text-xs tracking-wider">Total Geral</td>
                      <td className="px-6 py-4 text-right text-purple-700">{formatCurrency(totalConferencia)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowConferencia(false)}
                className="px-6 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO LANÇAMENTO */}
      {isCreating && newExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Plus size={20} className="text-teal-600" />
                  Novo Rateio / Despesa
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Adicionar despesa manualmente ao rateio</p>
              </div>
              <button onClick={() => { setIsCreating(false); setNewExpense(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
              {/* Type Toggle inside Modal */}
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tipo da Transação</label>
                <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
                  <button
                    onClick={() => setNewExpense({ ...newExpense, type: 'expense' })}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${newExpense.type === 'expense' ? 'bg-white shadow text-rose-600' : 'text-slate-500'}`}
                  >
                    Saída
                  </button>
                  <button
                    onClick={() => setNewExpense({ ...newExpense, type: 'income' })}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${newExpense.type === 'income' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}
                  >
                    Entrada
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Data *</label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={e => setNewExpense({ ...newExpense, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Centro de Custo (Opcional)</label>
                <input
                  type="text"
                  value={newExpense.fleetName}
                  onChange={e => setNewExpense({ ...newExpense, fleetName: e.target.value })}
                  placeholder="Ex: 2002, ADM..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Descrição *</label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                  placeholder="Descrição da despesa"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Categoria</label>
                <select
                  value={newExpense.category}
                  onChange={e => {
                    const cat = e.target.value;
                    const update = { category: cat };
                    if (cat !== 'SALARIOS E ORDENADOS') {
                      update.assignedEmployee = '';
                    }
                    setNewExpense({ ...newExpense, ...update });
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Selecione...</option>
                  {availableCategories
                    .filter(cat => !['SALARIOS E ORDENADOS', 'REFEICAO E LANCHES'].includes(cat.toUpperCase()))
                    .map(cat => <option key={cat} value={cat}>{cat}</option>)
                  }
                  <option value="SALARIOS E ORDENADOS">SALARIOS E ORDENADOS</option>
                  <option value="REFEICAO E LANCHES">REFEICAO E LANCHES</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              {['SALARIOS E ORDENADOS', 'REFEICAO E LANCHES'].includes((newExpense.category || '').toUpperCase()) && (
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Funcionário *</label>
                  <select
                    value={newExpense.assignedEmployee || ''}
                    onChange={e => setNewExpense({ ...newExpense, assignedEmployee: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Selecione o funcionário...</option>
                    {localRateios.map(r => (
                      <option key={r.id} value={r.funcionario}>{r.funcionario}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valor (R$) *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={newExpense.amount}
                    onChange={e => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => { setIsCreating(false); setNewExpense(null); }}
                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNew}
                className="px-8 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-lg"
              >
                Salvar Lançamento
              </button>
            </div>

          </div>
        </div>
      )}
      {/* MODAL DE DETALHES */}
      {selectedExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100">

            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="text-orange-500" /> Detalhes do Lançamento
                </h3>
                <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
                  TIPO: {selectedExpense.type === 'income' ? 'ENTRADA (NOTA FISCAL)' : 'SAÍDA (ESTOQUE/REQUISIÇÃO)'}
                </p>
              </div>
              <button onClick={() => setSelectedExpense(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8">
              {selectedExpense.type === 'income' ? (
                <div className="grid grid-cols-3 gap-y-8 gap-x-4">
                  <DetailItem label="DATA LANÇAMENTO" value={selectedExpense.details?.lctoDate || selectedExpense.date} />
                  <DetailItem label="DATA EMISSÃO" value={selectedExpense.details?.emisDate || '-'} />
                  <DetailItem label="NOTA FISCAL" value={selectedExpense.details?.notaFiscal || '-'} />
                  <DetailItem label="EMPRESA" value={selectedExpense.details?.empresa || '-'} />
                  <DetailItem label="FORNECEDOR" value={selectedExpense.details?.fornecedor || selectedExpense.provider || '-'} colSpan={2} />
                  <DetailItem label="CÓD. FORNECEDOR" value={selectedExpense.details?.codFornecedor || '-'} />
                  <DetailItem label="CLASSE" value={selectedExpense.details?.classe || selectedExpense.category || '-'} />
                  <DetailItem label="ORDEM DE COMPRA" value={selectedExpense.details?.ordemCompra || '-'} />
                  <DetailItem label="DESCRIÇÃO" value={cleanDescription(selectedExpense.description)} colSpan={3} />
                  {selectedExpense.assignedEmployee && (
                    <DetailItem label="FUNCIONÁRIO" value={selectedExpense.assignedEmployee} colSpan={3} />
                  )}
                  <DetailItem label="VALOR TOTAL" value={formatCurrency(selectedExpense.amount)} isTotal />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-y-8 gap-x-4">
                  <DetailItem label="DATA" value={selectedExpense.details?.date || selectedExpense.date} />
                  <DetailItem label="CÓD. LANÇAMENTO" value={selectedExpense.details?.codLancamento || '-'} />
                  <DetailItem label="EMPRESA" value={selectedExpense.details?.empresa || '-'} />
                  <DetailItem label="MATÉRIA / DESCRIÇÃO" value={cleanDescription(selectedExpense.details?.materia || selectedExpense.description)} colSpan={2} />
                  <DetailItem label="CÓD. MATÉRIA" value={selectedExpense.details?.codMateria || '-'} />
                  <DetailItem label="QUANTIDADE" value={selectedExpense.details?.quantidade || '0'} />
                  <DetailItem label="VALOR ENTRADA" value={formatCurrency(selectedExpense.details?.valorEntrada || 0)} />
                  {selectedExpense.assignedEmployee && (
                    <DetailItem label="FUNCIONÁRIO" value={selectedExpense.assignedEmployee} colSpan={2} />
                  )}
                  <DetailItem label="VALOR TOTAL" value={formatCurrency(selectedExpense.details?.valorTotal || selectedExpense.amount)} isTotal />
                  <DetailItem label="RECEBEDOR" value={selectedExpense.details?.recebedor || '-'} />
                  <DetailItem label="ALMOXARIFADO" value={selectedExpense.details?.almoxarifado || '-'} />
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

      {/* MODAL DE EDIÇÃO */}
      {editingExpense && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Edit2 size={20} className="text-blue-600" />
                  Editar Lançamento
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Modificar dados da despesa de rateio</p>
              </div>
              <button onClick={() => setEditingExpense(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Data *</label>
                <input
                  type="date"
                  value={editingExpense.date}
                  onChange={e => setEditingExpense({ ...editingExpense, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Centro de Custo</label>
                <input
                  type="text"
                  value={editingExpense.fleetName}
                  onChange={e => setEditingExpense({ ...editingExpense, fleetName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Descrição *</label>
                <input
                  type="text"
                  value={editingExpense.description}
                  placeholder={cleanDescription(editingExpense.description)}
                  onChange={e => setEditingExpense({ ...editingExpense, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Categoria</label>
                <select
                  value={editingExpense.category}
                  onChange={e => {
                    const cat = e.target.value;
                    const update = { category: cat };
                    if (cat !== 'SALARIOS E ORDENADOS') {
                      update.assignedEmployee = '';
                    }
                    setEditingExpense({ ...editingExpense, ...update });
                  }}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione...</option>
                  {availableCategories
                    .filter(cat => !['SALARIOS E ORDENADOS', 'REFEICAO E LANCHES'].includes(cat.toUpperCase()))
                    .map(cat => <option key={cat} value={cat}>{cat}</option>)
                  }
                  <option value="SALARIOS E ORDENADOS">SALARIOS E ORDENADOS</option>
                  <option value="REFEICAO E LANCHES">REFEICAO E LANCHES</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              {['SALARIOS E ORDENADOS', 'REFEICAO E LANCHES'].includes((editingExpense.category || '').toUpperCase()) && (
                <div className="flex flex-col gap-2">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Funcionário *</label>
                  <select
                    value={editingExpense.assignedEmployee || ''}
                    onChange={e => setEditingExpense({ ...editingExpense, assignedEmployee: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione o funcionário...</option>
                    {localRateios.map(r => (
                      <option key={r.id} value={r.funcionario}>{r.funcionario}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Valor (R$) *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={editingExpense.amount}
                    onChange={e => setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
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
                className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg"
              >
                Salvar Alterações
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL SELETOR DE SEGMENTO (TIPOS DE VEÍCULO) */}
      {showSegmentModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Truck size={20} className="text-teal-600" />
                  Selecionar Segmentos
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Selecione os tipos de veículo para este funcionário</p>
              </div>
              <button onClick={() => setShowSegmentModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-4 bg-white border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar tipo de veículo..."
                  value={segmentSearch}
                  onChange={(e) => setSegmentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Seção Selecionados */}
              {(() => {
                const activeRateio = localRateios.find(r => r.id === activeRateioId);
                const selectedSegments = activeRateio?.segmento ? activeRateio.segmento.split(',').map(s => s.trim()) : [];

                return (
                  <>
                    {selectedSegments.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Selecionados ({selectedSegments.length})</h4>
                        <div className="flex flex-wrap gap-2 p-3 bg-teal-50/50 rounded-2xl border border-teal-100/50">
                          {selectedSegments.map(seg => (
                            <button
                              key={seg}
                              onClick={() => {
                                const newSegments = selectedSegments.filter(s => s !== seg);
                                handleUpdateField(activeRateioId, 'segmento', newSegments.sort().join(', '));
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-teal-700 rounded-xl text-xs font-bold border border-teal-200 shadow-sm hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all group"
                            >
                              <span>{seg}</span>
                              <X size={14} className="group-hover:scale-110 transition-transform" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Seção Para Selecionar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Para Selecionar</h4>
                        {filteredVehicleTypes.filter(type => !selectedSegments.includes(type)).length > 0 && (
                          <button
                            onClick={() => {
                              const available = filteredVehicleTypes.filter(type => !selectedSegments.includes(type));
                              const newSegments = [...selectedSegments, ...available];
                              handleUpdateField(activeRateioId, 'segmento', newSegments.sort().join(', '));
                            }}
                            className="text-[10px] font-bold text-teal-600 hover:text-teal-700 uppercase tracking-widest bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-md transition-colors"
                          >
                            Selecionar Todos
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-1">
                        {filteredVehicleTypes.filter(type => !selectedSegments.includes(type)).length > 0 ? (
                          filteredVehicleTypes.filter(type => !selectedSegments.includes(type)).map((type) => (
                            <button
                              key={type}
                              onClick={() => {
                                const newSegments = [...selectedSegments, type];
                                handleUpdateField(activeRateioId, 'segmento', newSegments.sort().join(', '));
                              }}
                              className="flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left hover:bg-slate-50 text-slate-700 hover:ring-1 hover:ring-slate-200 group"
                            >
                              <span className="text-sm font-semibold uppercase tracking-tight">{type}</span>
                              <Plus size={18} className="text-slate-300 group-hover:text-teal-600 transition-colors" />
                            </button>
                          ))
                        ) : (
                          <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-xs font-medium">Nenhum tipo de veículo disponível.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowSegmentModal(false)}
                className="px-8 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-lg w-full"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}