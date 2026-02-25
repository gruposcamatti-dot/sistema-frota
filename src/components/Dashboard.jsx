import React, { useMemo } from 'react';
import { DollarSign, Gauge, Wrench, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Pie, PieChart as RePieChart
} from 'recharts';
import StatCard from './ui/StatCard';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { FLEET_TYPES } from '../constants/appConstants';

export default function Dashboard({ filteredExpenses, vehicles, filters, setFilters, abastecimentos }) {
  const stats = useMemo(() => {
    const totalCost = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Manutenção: Manut. Preventiva + Manut. Corretiva + Manut. Reforma + Fretes
    const maintenanceCost = filteredExpenses.filter(e => {
      const normalizedCategory = (e.category || '').replace(/^["']+|["']+$/g, '').toLowerCase().trim();

      // Manut. Preventiva
      if (normalizedCategory.includes('manut. preventiva') ||
        normalizedCategory.includes('manutencao preventiva')) {
        return true;
      }

      // Manut. Corretiva
      if (normalizedCategory.includes('manut. corretiva') ||
        normalizedCategory.includes('manutencao corretiva') ||
        normalizedCategory.includes('manut. maquinas e equipamentos') ||
        normalizedCategory.includes('manutencao / pecas e aces. veiculos') ||
        normalizedCategory.includes('material de uso e consumo') ||
        normalizedCategory.includes('ferramentas') ||
        normalizedCategory.includes('manut. por acidente') ||
        normalizedCategory.includes('servicos de terceiros') ||
        normalizedCategory.includes('ordenados')) {
        return true;
      }

      // Manut. Reforma
      if (normalizedCategory.includes('reforma de frota') ||
        normalizedCategory.includes('reforma de veiculos')) {
        return true;
      }

      // Fretes
      if (normalizedCategory.includes('fretes s/ compras') ||
        normalizedCategory.includes('fretes')) {
        return true;
      }

      return false;
    }).reduce((sum, exp) => sum + exp.amount, 0);

    const filteredVehicles = vehicles.filter(v => filters.fleetType === 'Todos' || v.type === filters.fleetType);

    // Filtrar abastecimentos baseando-se nos filtros de Data e Frota
    // Note: abastecimentos date is 'data_registro'
    const validAbastecimentos = abastecimentos.filter(e => {
      if (!e.data_registro) return false;
      const d = new Date(e.data_registro);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const yearMatch = y === filters.year;
      let periodMatch = false;

      if (filters.periodType === 'Mês') periodMatch = m === filters.periodValue;
      else if (filters.periodType === 'Trimestre') periodMatch = Math.ceil(m / 3) === filters.periodValue;
      else if (filters.periodType === 'Semestre') periodMatch = Math.ceil(m / 6) === filters.periodValue;
      else if (filters.periodType === 'Ano') periodMatch = true;

      let fleetMatch = false;
      const vRef = vehicles.find(veh => {
        const placaMatch = e.placa && veh.plate && e.placa.replace(/\W/g, '').toUpperCase() === veh.plate.replace(/\W/g, '').toUpperCase();
        const frotaMatch = e.frota && veh.fleetName && String(e.frota).trim().toUpperCase() === String(veh.fleetName).trim().toUpperCase();
        return placaMatch || frotaMatch;
      });

      if (vRef) {
        if (filters.fleetType === 'Todos') {
          fleetMatch = true;
        } else {
          fleetMatch = vRef.type === filters.fleetType;
        }

        if (fleetMatch && filters.vehicleCategory && filters.vehicleCategory !== 'Todos') {
          if (vRef.segment !== filters.vehicleCategory) fleetMatch = false;
        }
      }

      return yearMatch && periodMatch && fleetMatch;
    });

    // Calcular KM Real a partir dos horímetros por frota/placa
    const kmPorVeiculo = {};
    validAbastecimentos.forEach(item => {
      const key = item.placa || item.frota || 'Desconhecido';
      if (!kmPorVeiculo[key]) kmPorVeiculo[key] = [];

      let h = 0;
      if (typeof item.horimetro === 'number') h = item.horimetro;
      else if (typeof item.horimetro === 'string') {
        const cleanStr = item.horimetro.replace(/[^\d.,]/g, '');
        if (cleanStr.includes(',') && cleanStr.includes('.')) h = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
        else if (cleanStr.includes(',')) h = parseFloat(cleanStr.replace(',', '.'));
        else h = parseFloat(cleanStr);
      }
      if (!isNaN(h) && h > 0) kmPorVeiculo[key].push(h);
    });

    let totalKmRodado = 0;
    Object.values(kmPorVeiculo).forEach(horimetros => {
      if (horimetros.length > 1) {
        const minH = Math.min(...horimetros);
        const maxH = Math.max(...horimetros);
        totalKmRodado += (maxH - minH);
      }
    });

    return { totalCost, maintenanceCost, estimatedKm: totalKmRodado, costPerKm: totalKmRodado > 0 ? totalCost / totalKmRodado : 0 };
  }, [filteredExpenses, vehicles, filters, abastecimentos]);

  // Calcular variação percentual do período anterior
  const costTrend = useMemo(() => {
    // Determinar período anterior
    let previousYear = filters.year;
    let previousValue = filters.periodValue;

    if (filters.periodType === 'Mês') {
      previousValue = filters.periodValue === 1 ? 12 : filters.periodValue - 1;
      if (filters.periodValue === 1) previousYear = filters.year - 1;
    } else if (filters.periodType === 'Trimestre') {
      previousValue = filters.periodValue === 1 ? 4 : filters.periodValue - 1;
      if (filters.periodValue === 1) previousYear = filters.year - 1;
    } else if (filters.periodType === 'Semestre') {
      previousValue = filters.periodValue === 1 ? 2 : filters.periodValue - 1;
      if (filters.periodValue === 1) previousYear = filters.year - 1;
    } else if (filters.periodType === 'Ano') {
      previousYear = filters.year - 1;
    }

    // Filtrar despesas do período anterior
    const previousExpenses = filteredExpenses.filter(e => {
      const d = new Date(e.date);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const yearMatch = y === previousYear;
      let periodMatch = false;

      if (filters.periodType === 'Mês') periodMatch = m === previousValue;
      else if (filters.periodType === 'Trimestre') periodMatch = Math.ceil(m / 3) === previousValue;
      else if (filters.periodType === 'Semestre') periodMatch = Math.ceil(m / 6) === previousValue;
      else if (filters.periodType === 'Ano') periodMatch = true;

      return yearMatch && periodMatch;
    });

    const previousCost = previousExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    if (previousCost === 0) return 'N/A';

    const variation = ((stats.totalCost - previousCost) / previousCost) * 100;
    const sign = variation > 0 ? '+' : '';
    return `${sign}${variation.toFixed(1)}%`;
  }, [filteredExpenses, filters, stats.totalCost]);

  // Calcular variação percentual de KM do período anterior
  const kmTrend = useMemo(() => {
    // Determinar período anterior
    let previousYear = filters.year;
    let previousValue = filters.periodValue;

    if (filters.periodType === 'Mês') {
      previousValue = filters.periodValue === 1 ? 12 : filters.periodValue - 1;
      if (filters.periodValue === 1) previousYear = filters.year - 1;
    } else if (filters.periodType === 'Trimestre') {
      previousValue = filters.periodValue === 1 ? 4 : filters.periodValue - 1;
      if (filters.periodValue === 1) previousYear = filters.year - 1;
    } else if (filters.periodType === 'Semestre') {
      previousValue = filters.periodValue === 1 ? 2 : filters.periodValue - 1;
      if (filters.periodValue === 1) previousYear = filters.year - 1;
    } else if (filters.periodType === 'Ano') {
      previousYear = filters.year - 1;
    }

    // Calcular KM do período anterior com mesma lógica
    const previousAbastecimentos = abastecimentos.filter(e => {
      if (!e.data_registro) return false;
      const d = new Date(e.data_registro);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();

      const yearMatch = y === previousYear;
      let periodMatch = false;

      if (filters.periodType === 'Mês') periodMatch = m === previousValue;
      else if (filters.periodType === 'Trimestre') periodMatch = Math.ceil(m / 3) === previousValue;
      else if (filters.periodType === 'Semestre') periodMatch = Math.ceil(m / 6) === previousValue;
      else if (filters.periodType === 'Ano') periodMatch = true;

      let fleetMatch = false;
      const vRef = vehicles.find(veh => {
        const placaMatch = e.placa && veh.plate && e.placa.replace(/\W/g, '').toUpperCase() === veh.plate.replace(/\W/g, '').toUpperCase();
        const frotaMatch = e.frota && veh.fleetName && String(e.frota).trim().toUpperCase() === String(veh.fleetName).trim().toUpperCase();
        return placaMatch || frotaMatch;
      });

      if (vRef) {
        if (filters.fleetType === 'Todos') {
          fleetMatch = true;
        } else {
          fleetMatch = vRef.type === filters.fleetType;
        }

        if (fleetMatch && filters.vehicleCategory && filters.vehicleCategory !== 'Todos') {
          if (vRef.segment !== filters.vehicleCategory) fleetMatch = false;
        }
      }

      return yearMatch && periodMatch && fleetMatch;
    });

    const kmPorVeiculoPrev = {};
    previousAbastecimentos.forEach(item => {
      const key = item.placa || item.frota || 'Desconhecido';
      if (!kmPorVeiculoPrev[key]) kmPorVeiculoPrev[key] = [];
      let h = 0;
      if (typeof item.horimetro === 'number') h = item.horimetro;
      else if (typeof item.horimetro === 'string') {
        const cleanStr = item.horimetro.replace(/[^\d.,]/g, '');
        if (cleanStr.includes(',') && cleanStr.includes('.')) h = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
        else if (cleanStr.includes(',')) h = parseFloat(cleanStr.replace(',', '.'));
        else h = parseFloat(cleanStr);
      }
      if (!isNaN(h) && h > 0) kmPorVeiculoPrev[key].push(h);
    });

    let previousKm = 0;
    Object.values(kmPorVeiculoPrev).forEach(horimetros => {
      if (horimetros.length > 1) {
        const minH = Math.min(...horimetros);
        const maxH = Math.max(...horimetros);
        previousKm += (maxH - minH);
      }
    });

    if (previousKm === 0) return 'N/A';

    const variation = ((stats.estimatedKm - previousKm) / previousKm) * 100;
    const sign = variation > 0 ? '+' : '';
    return `${sign}${variation.toFixed(1)}%`;
  }, [vehicles, filters, stats.estimatedKm, abastecimentos]);

  const chartData = useMemo(() => {
    const data = {};
    filteredExpenses.forEach(exp => {
      // Limpar aspas da categoria
      const cleanCategory = (exp.category || '').replace(/^["']+|["']+$/g, '').trim();
      if (cleanCategory) {
        data[cleanCategory] = (data[cleanCategory] || 0) + exp.amount;
      }
    });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .filter(i => i.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const top5FleetData = useMemo(() => {
    const vehicleCosts = {};
    filteredExpenses.forEach(exp => {
      const vehicle = vehicles.find(v => v.id === exp.vehicleId || v.fleetName === exp.fleetName);
      if (vehicle) {
        const key = vehicle.fleetName;
        vehicleCosts[key] = (vehicleCosts[key] || 0) + exp.amount;
      }
    });
    return Object.entries(vehicleCosts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredExpenses, vehicles]);

  const COLORS = ['#14b8a6', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Visão geral de indicadores de performance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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

          {/* Fleet Type Filter */}
          <select
            value={filters.fleetType}
            onChange={(e) => setFilters({ ...filters, fleetType: e.target.value, vehicleCategory: 'Todos' })}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all cursor-pointer flex items-center gap-2"
          >
            <option value="Todos">Todas Frotas</option>
            <option value="Leve">Frota Leve</option>
            <option value="Pesada">Frota Pesada</option>
          </select>

          {/* Vehicle Category Filter */}
          {filters.fleetType !== 'Todos' && (
            <select
              value={filters.vehicleCategory || 'Todos'}
              onChange={(e) => setFilters({ ...filters, vehicleCategory: e.target.value })}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all cursor-pointer"
            >
              <option value="Todos">Todos {filters.fleetType === 'Leve' ? 'os Leves' : 'os Pesados'}</option>
              {Array.from(new Set(vehicles.filter(v => v.type === filters.fleetType).map(v => v.segment))).filter(Boolean).sort().map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Custo Total" val={formatCurrency(stats.totalCost)} icon={<DollarSign size={20} />} trend={costTrend} color="teal" />
        <StatCard title="Km Rodado" val={`${formatNumber(stats.estimatedKm)} km`} icon={<Gauge size={20} />} trend={kmTrend} color="emerald" />
        <StatCard title="Manutenção" val={formatCurrency(stats.maintenanceCost)} icon={<Wrench size={20} />} trend={`${((stats.maintenanceCost / stats.totalCost || 0) * 100).toFixed(1)}%`} color="rose" />
        <StatCard title="Custo/KM" val={formatCurrency(stats.costPerKm)} icon={<Activity size={20} />} trend="Eficiência" color="teal" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Top 5 Frotas */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <h3 className="text-2xl font-bold text-slate-900 mb-8">Top 5 Frotas</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5FleetData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }} layout="horizontal">
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={false}
                  height={0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                  tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`}
                  width={70}
                />
                <Tooltip
                  cursor={{ fill: '#f8fafc', radius: 8 }}
                  formatter={v => formatCurrency(v)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  labelStyle={{
                    color: '#1e293b',
                    fontWeight: 600,
                    marginBottom: '4px'
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#14b8a6"
                  radius={[12, 12, 0, 0]}
                  maxBarSize={60}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Pizza - Distribuição Financeira */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <h3 className="text-2xl font-bold text-slate-900 mb-8">Distribuição Financeira</h3>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                  animationDuration={800}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={v => formatCurrency(v)}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  labelStyle={{
                    color: '#1e293b',
                    fontWeight: 600,
                    marginBottom: '4px'
                  }}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
