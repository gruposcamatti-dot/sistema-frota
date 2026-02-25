import React, { useState, useMemo } from 'react';
import { FileText, ArrowUpDown, Search } from 'lucide-react';

const CATEGORY_MAP = {
  'Despesas Gerais': [
    'SERVIÇOS DE GUINCHO', 'RAT DESP FINANCEIRAS', 'MOTO TAXI',
    'MAT. SEGURANCA E PROT. VEICULOS', 'DESPESAS DE VIAGENS E HOSPEDAGENS',
    'EPI', "EPI'S", 'LAVAGEM DE FROTAS', 'REFEICAO E LANCHES', 'ESTACIONAMENTOS'
  ],
  'Manutenção Preventiva': [
    'MANUT. PREVENTIVA (FROTA / MAQ)', 'INSPECAO VEICULAR'
  ],
  'Manutenção Corretiva': [
    'MANUT. CORRETIVA (FROTA / MAQ)', 'MANUT. POR ACIDENTE (FROTA / MAQ)',
    'MANUTENCAO / PECAS E ACES. VEICULOS', 'SERVICOS DE TERCEIROS (FROTA E MAQ)'
  ],
  'Manutenção Reforma': [
    'REFORMA DE FROTA (VEICULOS / EQUIP.)'
  ],
  'Fretes - Compra Manutenção': [
    'FRETES S/ COMPRAS'
  ],
  'Serviço de Pneus - Borracharia': [
    'SERVICOS DE PNEUS / BORRACHARIA'
  ],
  'Pneus Novos': [
    'PNEUS E CAMERAS - NOVOS'
  ],
  'Ressolagem': [
    'PNEUS RESSOLADOS'
  ],
  'Multas': [
    'MULTAS'
  ],
  'Pedágio': [
    'PEDAGIOS'
  ],
  'Rastreamento': [
    'MENSALIDADES'
  ],
  'Seguro': [
    'SEGUROS'
  ],
  'DPVAT': [
    'DPVAT (SEGURO OBRIGATORIO)'
  ],
  'Licenciamento/Taxas': [
    'EMPLACAMENTO DE VEICULO', 'ANTT', 'LICENCIAMENTO',
    'SERVICOS DESPACHANTE POLICIAL', 'TAXAS INMETRO'
  ],
  'Melhorias em Frotas': [
    'MELHORIA EM FROTAS'
  ]
};

// Create a reverse map for faster lookup
const REVERSE_CAT_MAP = {};
Object.entries(CATEGORY_MAP).forEach(([colName, categories]) => {
  categories.forEach(cat => {
    REVERSE_CAT_MAP[cat.toUpperCase().trim()] = colName;
  });
});

const COLUMNS = [
  { id: 'fleetName', label: 'Frota', type: 'text', width: '120px' },
  { id: 'plate', label: 'Placa', type: 'text', width: '100px' },
  { id: 'assetCode', label: 'Tipo', type: 'text', width: '150px' },
  { id: 'model', label: 'Modelo/Marca', type: 'text', width: '200px' },
  { id: 'segment', label: 'Segmento', type: 'text', width: '150px' },
  { id: 'km', label: 'Km Percorrido', type: 'number', width: '130px' },
  { id: 'combustivel', label: 'Combustível', type: 'currency', width: '130px' },
  { id: 'Despesas Gerais', label: 'Despesas Gerais', type: 'currency', width: '150px' },
  { id: 'Manutenção Preventiva', label: 'Manutenção Preventiva', type: 'currency', width: '170px' },
  { id: 'Manutenção Corretiva', label: 'Manutenção Corretiva', type: 'currency', width: '170px' },
  { id: 'Manutenção Reforma', label: 'Manutenção Reforma', type: 'currency', width: '170px' },
  { id: 'Fretes - Compra Manutenção', label: 'Fretes - Compra Manutenção', type: 'currency', width: '180px' },
  { id: 'Serviço de Pneus - Borracharia', label: 'Serviço de Pneus - Borracharia', type: 'currency', width: '180px' },
  { id: 'Pneus Novos', label: 'Pneus Novos', type: 'currency', width: '140px' },
  { id: 'creditoPneus', label: 'Crédito de Pneus', type: 'currency', width: '140px' },
  { id: 'Ressolagem', label: 'Ressolagem', type: 'currency', width: '130px' },
  { id: 'Multas', label: 'Multas', type: 'currency', width: '120px' },
  { id: 'Pedágio', label: 'Pedágio', type: 'currency', width: '120px' },
  { id: 'Rastreamento', label: 'Rastreamento', type: 'currency', width: '130px' },
  { id: 'Seguro', label: 'Seguro', type: 'currency', width: '120px' },
  { id: 'DPVAT', label: 'DPVAT', type: 'currency', width: '120px' },
  { id: 'Licenciamento/Taxas', label: 'Licenciamento/Taxas', type: 'currency', width: '160px' },
  { id: 'ipva', label: 'IPVA', type: 'currency', width: '110px' },
  { id: 'operacional', label: 'Operacional', type: 'currency', width: '120px' },
  { id: 'administrativo', label: 'Administrativo', type: 'currency', width: '130px' },
  { id: 'custoTotal', label: 'Custo Total', type: 'currency', width: '140px', bold: true },
  { id: 'percentTotal', label: '% sob Total', type: 'percent', width: '110px', bold: true },
  { id: 'Melhorias em Frotas', label: 'Melhorias em Frotas', type: 'currency', width: '160px' }
];

const formatCurrency = (val) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

export default function FechamentoView({ expenses, filteredExpenses, filters, setFilters, vehicles, rateios, rateioExpenses }) {
  const [sortConfig, setSortConfig] = useState({ key: 'custoTotal', direction: 'desc' });
  const [search, setSearch] = useState('');

  // 1. Generate Base Data (All matching vehicles)
  const baseData = useMemo(() => {
    // Filter vehicles based on global fleetType filter
    const validVehicles = vehicles.filter(v =>
      filters.fleetType === 'Todos' || v.type === filters.fleetType
    );

    // Initialize data structure per vehicle
    const vehicleMap = {};
    validVehicles.forEach(v => {
      vehicleMap[v.fleetName] = {
        fleetName: v.fleetName || '-',
        plate: v.plate || '-',
        type: v.type || '-',
        assetCode: v.assetCode || '-',
        segment: v.segment || '-',
        model: `${v.brand || ''} ${v.model || ''}`.trim() || '-',
        km: 0,
        combustivel: 0,
        creditoPneus: 0,
        ipva: 0,
        operacional: 0,
        administrativo: 0,
        custoTotal: 0,
        percentTotal: 0,
        // Categories
        'Despesas Gerais': 0,
        'Manutenção Preventiva': 0,
        'Manutenção Corretiva': 0,
        'Manutenção Reforma': 0,
        'Fretes - Compra Manutenção': 0,
        'Serviço de Pneus - Borracharia': 0,
        'Pneus Novos': 0,
        'Ressolagem': 0,
        'Multas': 0,
        'Pedágio': 0,
        'Rastreamento': 0,
        'Seguro': 0,
        'DPVAT': 0,
        'Licenciamento/Taxas': 0,
        'Melhorias em Frotas': 0
      };
    });

    // 2. Aggregate Expenses
    // Ensure we only process expenses for fleets that match the vehicle mapping above.
    filteredExpenses.forEach(exp => {
      const fleet = exp.fleetName;
      if (!fleet || !vehicleMap[fleet]) return;

      const catOrig = String(exp.category || '').toUpperCase().trim();
      const colName = REVERSE_CAT_MAP[catOrig];
      const amount = Math.abs(parseFloat(exp.amount) || 0);

      // Handle Combustível explicitly if it's not in the map
      if (catOrig === 'COMBUSTIVEL' || catOrig === 'COMBUSTÍVEL') {
        vehicleMap[fleet].combustivel += amount;
        vehicleMap[fleet].custoTotal += amount;
      } else if (colName) {
        vehicleMap[fleet][colName] += amount;

        // Add to Custo Total if it's NOT Melhorias
        if (colName !== 'Melhorias em Frotas') {
          vehicleMap[fleet].custoTotal += amount;
        }
      }
    });

    // 2.5 Calculate Operacional from Rateios
    if (rateios && rateios.length > 0 && rateioExpenses) {
      // 2.5.1 Compute CC Stats (replicated logic from RateiosView)
      const empCountPerCC = {};
      rateios.forEach(r => {
        if (r.cc) empCountPerCC[r.cc] = (empCountPerCC[r.cc] || 0) + 1;
      });

      const ccSharedTotal = {};
      const employeeSpecificCosts = {};
      const individualCategories = ['SALARIOS E ORDENADOS', 'REFEICAO E LANCHES'];

      rateioExpenses.forEach(e => {
        const cc = e.fleetName ? String(e.fleetName).replace(/CCUS:|"/g, '').trim() : null;
        const category = String(e.category || '').trim().toUpperCase();
        const amount = Math.abs(parseFloat(e.amount) || 0); // Always positive cost for rateios calculation

        if (individualCategories.includes(category)) {
          const empName = e.assignedEmployee;
          if (empName) employeeSpecificCosts[empName] = (employeeSpecificCosts[empName] || 0) + amount;
        } else if (cc) {
          ccSharedTotal[cc] = (ccSharedTotal[cc] || 0) + amount;
        }
      });

      // 2.5.2 Apply Rateio to Vehicles
      rateios.forEach(r => {
        // Calculate this employee's total rateio value
        const sharedCC = ccSharedTotal[r.cc] || 0;
        const count = empCountPerCC[r.cc] || 1;
        const individualCost = employeeSpecificCosts[r.funcionario] || 0;
        const employeeTotalCost = Math.abs(sharedCC / count) + Math.abs(individualCost);

        if (employeeTotalCost === 0) return; // Nothing to distribute

        // Find eligible fleets based on Segment and Rateio Type rules
        const allowedSegments = (r.segmento || '').split(',').map(s => s.trim().toUpperCase());

        const eligibleFleets = Object.values(vehicleMap).filter(fleet => {
          // 1. Must match segment (if specified in Rateio)
          if (allowedSegments.length > 0 && r.segmento !== '' && !allowedSegments.includes(fleet.assetCode.toUpperCase())) {
            return false;
          }

          // 2. Must meet activity criteria based on Rateio Type
          if (r.tipoRateio === 'Manutenção') {
            const totalManutencao =
              fleet['Manutenção Preventiva'] +
              fleet['Manutenção Corretiva'] +
              fleet['Manutenção Reforma'] +
              fleet['Fretes - Compra Manutenção'];
            return totalManutencao > 0;
          } else if (r.tipoRateio === 'Combustível') {
            return fleet.combustivel > 0;
          }

          return true; // If somehow no type, assume eligible if segment matches
        });

        // Distribute equally among eligible fleets
        if (eligibleFleets.length > 0) {
          const costPerFleet = employeeTotalCost / eligibleFleets.length;
          eligibleFleets.forEach(fleet => {
            vehicleMap[fleet.fleetName].operacional += costPerFleet;
            vehicleMap[fleet.fleetName].custoTotal += costPerFleet;
          });
        }
      });
    }

    return Object.values(vehicleMap);
  }, [vehicles, filteredExpenses, filters.fleetType, rateios, rateioExpenses]);

  // 3. Process calculations (Totals, %, Search & Sort)
  const processedData = useMemo(() => {
    let result = [...baseData];

    // Search filter
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(row =>
        row.fleetName.toLowerCase().includes(s) ||
        row.plate.toLowerCase().includes(s) ||
        row.model.toLowerCase().includes(s) ||
        row.assetCode.toLowerCase().includes(s)
      );
    }

    // Calculate Overall Total
    const overallTotal = result.reduce((sum, row) => sum + row.custoTotal, 0);

    // Calculate % for each row
    result = result.map(row => ({
      ...row,
      percentTotal: overallTotal > 0 ? (row.custoTotal / overallTotal) * 100 : 0
    }));

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return { rows: result, overallTotal };
  }, [baseData, search, sortConfig]);

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // 4. Calculate Column Totals
  const columnTotals = useMemo(() => {
    const totals = {};
    COLUMNS.forEach(col => {
      if (col.type === 'currency' || col.type === 'number') {
        totals[col.id] = processedData.rows.reduce((sum, row) => sum + (Number(row[col.id]) || 0), 0);
      }
    });
    totals.percentTotal = 100;
    return totals;
  }, [processedData.rows, COLUMNS]);

  return (
    <div className="flex flex-col h-full space-y-4 animate-in fade-in duration-500">

      {/* Header & Local Filters */}
      <div className="flex flex-col xl:flex-row justify-between items-center gap-4 mb-4">
        <div className="text-center xl:text-left shrink-0">
          <h2 className="text-2xl font-bold text-slate-900">Fechamento de Frota</h2>
          <p className="text-slate-500 mt-1 text-sm">Análise detalhada de custos por veículo</p>
        </div>

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
            <option value={2027}>2027</option>
          </select>

          {/* Fleet Type Picker */}
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

      {/* Controls: Search */}
      <div className="flex justify-end mb-2">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar frota, placa ou modelo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm font-medium shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#0F172A] text-slate-300 sticky top-0 z-10 shadow-md">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.id}
                    onClick={() => requestSort(col.id)}
                    style={{ minWidth: col.width, maxWidth: col.width }}
                    className={`p-3 align-top text-[11px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-800 transition-colors border-b-2 border-slate-700 select-none whitespace-normal leading-snug ${col.type === 'currency' || col.type === 'percent' || col.type === 'number' ? 'text-right' : 'text-left'}`}
                  >
                    <div className={`flex items-center gap-1.5 ${col.type === 'currency' || col.type === 'percent' || col.type === 'number' ? 'justify-end' : 'justify-start'}`}>
                      <span className={col.type === 'currency' || col.type === 'percent' || col.type === 'number' ? 'text-right w-full' : 'text-left w-full'}>{col.label}</span>
                      {sortConfig.key === col.id && (
                        <ArrowUpDown size={12} className="text-teal-400 shrink-0" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {processedData.rows.length > 0 ? (
                processedData.rows.map((row, i) => (
                  <tr key={row.fleetName} className="hover:bg-teal-50/30 transition-colors group">
                    {COLUMNS.map(col => {
                      let displayValue = row[col.id];
                      let alignClass = 'text-left';
                      let formatClass = 'text-slate-700';
                      let cellContent = displayValue;
                      let tdClassExtras = 'whitespace-normal break-words p-3';

                      if (col.id === 'fleetName') {
                        cellContent = <span className="text-sm font-bold text-slate-800 truncate block" title={String(displayValue)}>{displayValue}</span>;
                        tdClassExtras = 'px-4 py-3 align-middle';
                      } else if (col.id === 'plate') {
                        cellContent = <span className="text-xs font-semibold text-slate-900 tracking-wide font-mono bg-slate-100 px-2 py-1 rounded">{displayValue}</span>;
                        tdClassExtras = 'px-2 py-3 align-middle';
                      } else if (col.id === 'assetCode') {
                        cellContent = <span className="text-sm text-slate-700 font-medium block uppercase" title={String(displayValue)}>{displayValue}</span>;
                        tdClassExtras = 'whitespace-normal break-words px-2 py-3 align-middle';
                      } else if (col.id === 'model') {
                        cellContent = <span className="text-sm text-slate-600 block" title={String(displayValue)}>{displayValue}</span>;
                        tdClassExtras = 'whitespace-normal break-words px-2 py-3 align-middle';
                      } else if (col.id === 'segment') {
                        cellContent = <span className="text-sm text-slate-600 block uppercase" title={String(displayValue)}>{displayValue}</span>;
                        tdClassExtras = 'whitespace-normal break-words px-2 py-3 align-middle';
                      }

                      if (col.type === 'currency') {
                        displayValue = formatCurrency(displayValue);
                        cellContent = displayValue;
                        alignClass = 'text-right';
                        formatClass = 'font-bold';

                        // Treat 0 differently to avoid clutter
                        if (displayValue === formatCurrency(0)) {
                          formatClass = 'text-slate-300 font-medium';
                        }
                      } else if (col.type === 'number') {
                        cellContent = displayValue;
                        alignClass = 'text-right';
                        if (displayValue === 0) formatClass = 'text-slate-300';
                      } else if (col.type === 'percent') {
                        displayValue = `${displayValue.toFixed(2)}%`;
                        cellContent = displayValue;
                        alignClass = 'text-right';
                        formatClass = 'text-slate-500 font-bold text-xs';
                        if (Number(row[col.id]) === 0) formatClass = 'text-slate-300 text-xs';
                      }

                      if (col.id === 'custoTotal') {
                        tdClassExtras += ' bg-slate-100/60 font-black text-slate-800';
                        if (displayValue === formatCurrency(0)) {
                          formatClass = 'text-slate-400 font-bold';
                        } else {
                          formatClass = 'text-slate-900 font-black';
                        }
                      } else if (col.bold && displayValue !== formatCurrency(0) && Number(row[col.id]) !== 0) {
                        formatClass += ' text-teal-700';
                      }

                      return (
                        <td key={col.id} className={`${tdClassExtras} ${alignClass} ${formatClass}`} style={{ minWidth: col.width, maxWidth: col.width }} title={['fleetName', 'plate', 'assetCode', 'model', 'segment'].includes(col.id) ? undefined : String(row[col.id])}>
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={COLUMNS.length} className="p-8 text-center text-slate-500">
                    Nenhuma frota encontrada.
                  </td>
                </tr>
              )}
            </tbody>
            {/* Table Footer - Totals */}
            <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0 z-10 text-sm">
              <tr>
                <td colSpan={5} className="p-3 font-black text-right text-slate-600 uppercase tracking-widest">
                  TOTAIS GERAIS
                </td>
                {COLUMNS.slice(5).map(col => {
                  const val = columnTotals[col.id] || 0;
                  return (
                    <td key={col.id} className={`p-3 font-black text-right ${col.id === 'custoTotal' ? 'text-teal-600 text-base' : 'text-slate-700'}`} style={{ minWidth: col.width, maxWidth: col.width }}>
                      {col.type === 'currency'
                        ? formatCurrency(val)
                        : col.type === 'percent'
                          ? '100.00%'
                          : val}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  );
}
