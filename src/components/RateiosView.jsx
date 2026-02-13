import React, { useState, useMemo } from 'react';
import { Plus, Trash2, PieChart, Save } from 'lucide-react';
import { collection, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import { formatCurrency } from '../utils/formatters';

export default function RateiosView({ rateios, db, appId, filters, setFilters }) {
  const [localRateios, setLocalRateios] = useState(rateios);
  const [editingId, setEditingId] = useState(null);

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

  // Add new empty row
  const handleAddRow = () => {
    const newRateio = {
      id: Math.random().toString(36).substr(2, 9),
      funcionario: '',
      segmento: '',
      tipoRateio: 'Manutenção',
      percentual: 0,
      salarioFunc: 0,
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

  // Calculate totals
  const totals = useMemo(() => {
    return {
      salarioFunc: localRateios.reduce((sum, r) => sum + r.salarioFunc, 0),
      distribuicao: localRateios.reduce((sum, r) => sum + r.distribuicao, 0)
    };
  }, [localRateios]);

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
          <table className="min-w-[1400px] w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[280px]">Funcionário</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[280px]">Segmento</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-[220px]">Tipo de Rateio</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right w-[150px]">%</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right w-[180px]">Salário Func.</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right w-[150px]">Distribuição</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-center w-[100px]">Ações</th>
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

                    {/* Segmento */}
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={rateio.segmento}
                        onChange={(e) => handleUpdateField(rateio.id, 'segmento', e.target.value)}
                        placeholder="Segmento"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                      />
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
                        <option value="Administrativo">Administrativo</option>
                        <option value="Operacional">Operacional</option>
                      </select>
                    </td>

                    {/* Percentual */}
                    <td className="px-6 py-4">
                      <input
                        type="number"
                        value={rateio.percentual}
                        onChange={(e) => handleUpdateField(rateio.id, 'percentual', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        min="0"
                        max="100"
                        step="0.01"
                        className="w-full px-3 py-2 text-sm text-right border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none font-bold text-slate-900"
                      />
                    </td>

                    {/* Salário Func. */}
                    <td className="px-6 py-4">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-semibold">R$</span>
                        <input
                          type="text"
                          value={formatSalaryDisplay(rateio.salarioFunc)}
                          onChange={(e) => {
                            const formatted = formatSalaryInput(e.target.value);
                            const numericValue = parseSalaryToNumber(formatted);
                            handleUpdateField(rateio.id, 'salarioFunc', numericValue);
                          }}
                          placeholder="0,00"
                          className="w-full pl-9 pr-3 py-2 text-sm text-right border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none font-bold text-slate-900"
                        />
                      </div>
                    </td>

                    {/* Distribuição (Calculado) */}
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-teal-600">
                        {formatCurrency(rateio.distribuicao)}
                      </span>
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
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
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
                  <td className="px-6 py-4 text-right text-sm text-slate-900 font-bold">
                    {formatCurrency(totals.salarioFunc)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-teal-600 font-bold">
                    {formatCurrency(totals.distribuicao)}
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
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Salários</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totals.salarioFunc)}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Distribuição</p>
          <p className="text-2xl font-bold text-teal-600">{formatCurrency(totals.distribuicao)}</p>
        </div>
      </div>
    </div>
  );
}