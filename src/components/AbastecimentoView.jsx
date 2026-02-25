import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../utils/supabaseCliente';
import { Fuel, RefreshCw, Calendar, Truck, User, Droplet, Gauge, DollarSign, Search, ListFilter, Activity, AlertTriangle } from 'lucide-react';
import FilterGroup from './ui/FilterGroup';

export default function AbastecimentoView({ filters, setFilters, vehicles, abastecimentos, fetchAbastecimentos, loadingAbastecimentos }) {
    const [searchTerm, setSearchTerm] = useState('');

    // Novas states    // Active Tab State
    const [activeTab, setActiveTab] = useState('historico'); // 'historico' | 'resumo'

    // Resumo Filters
    const [resumoSearchTerm, setResumoSearchTerm] = useState('');
    const [showErrorsOnly, setShowErrorsOnly] = useState(false);

    const periodValueOptions = useMemo(() => {
        if (!filters) return [];
        if (filters.periodType === 'Mês') {
            return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => ({ v: i + 1, l: m }));
        }
        if (filters.periodType === 'Trimestre') {
            return [1, 2, 3, 4].map(t => ({ v: t, l: `${t}º Tri` }));
        }
        if (filters.periodType === 'Semestre') {
            return [1, 2].map(s => ({ v: s, l: `${s}º Sem` }));
        }
        return [];
    }, [filters?.periodType]);



    const formatarMoeda = (valor) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor || 0);
    };

    const formatarNumeroVolume = (valor) => {
        return new Intl.NumberFormat('pt-BR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
        }).format(valor || 0);
    };

    const formattedData = useMemo(() => {
        if (!abastecimentos || !filters || !vehicles) return abastecimentos;

        let filtered = abastecimentos.filter(item => {
            // Verificar se a frota/placa existe no array de 'vehicles' (Cadastro de Frotas)
            const itemPlaca = String(item.placa || '').replace(/\W/g, '').toUpperCase();
            const itemFrota = String(item.frota || '').trim().toUpperCase();

            let isComboio = false;
            const hasVehicleMatch = vehicles.some(v => {
                const vPlate = String(v.plate || '').replace(/\W/g, '').toUpperCase();
                const vFleet = String(v.fleetName || '').trim().toUpperCase();

                const isMatch = (vFleet && itemFrota && vFleet === itemFrota) ||
                    (vPlate && itemPlaca && vPlate === itemPlaca);

                if (isMatch) {
                    const vType = String(v.type || '').toUpperCase();
                    const vAsset = String(v.assetCode || '').toUpperCase();
                    const vName = String(v.fleetName || '').toUpperCase();
                    if (vType.includes('COMBOIO') || vAsset.includes('COMBOIO') || vName.includes('COMBOIO')) {
                        isComboio = true;
                    }
                }
                return isMatch;
            });

            if (!hasVehicleMatch) return false;

            // Regra Comboio: Ignorar se for tipo 'Comboio' E litragem tiver 4 dígitos (transferência de Diesel)
            const rawLitersStrForFilter = String(item.litro_abastecido || '').replace(/\D/g, '');
            if (isComboio && rawLitersStrForFilter.length === 4) {
                return false;
            }

            const dataReg = new Date(item.data_registro);
            const m = dataReg.getMonth() + 1;
            const y = dataReg.getFullYear();
            const v = parseInt(filters.periodValue);

            const yearMatch = y === parseInt(filters.year);
            let periodMatch = false;

            if (filters.periodType === 'Mês') periodMatch = m === v;
            else if (filters.periodType === 'Trimestre') periodMatch = Math.ceil(m / 3) === v;
            else if (filters.periodType === 'Semestre') periodMatch = Math.ceil(m / 6) === v;
            else if (filters.periodType === 'Ano') periodMatch = true;

            return yearMatch && periodMatch;
        });

        // Aplicar o tratamento dos dados após o filtro
        return filtered.map(item => {
            // 0. Substituir nomes de combustíveis específicos
            let fuelType = item.tipo_combustivel || '';
            if (fuelType.toUpperCase().includes('F1 MASTER PERFORMANCE 15W40')) {
                fuelType = 'Oleo';
            }

            // Se não houver tipo de combustível identificado, define como 'Oleo'
            if (!fuelType.trim()) {
                fuelType = 'Oleo';
            }

            // 1. Tratar Litragem
            let rawLitersStr = String(item.litro_abastecido || '0').replace(/\D/g, '');
            let litrosReal = 0;

            // Regra do usuário: se for 5 dígitos, a vírgula é na segunda casa (ex: 40570 -> 40.570)
            if (rawLitersStr.length >= 5) {
                // Para 5 dígitos ou mais, assumiremos sempre os primeiros 2 dígitos como inteiros e o restante como decimal
                litrosReal = parseFloat(rawLitersStr.substring(0, 2) + '.' + rawLitersStr.substring(2));
            } else if (rawLitersStr.length === 4) {
                // Caso existam 4 dígitos
                litrosReal = parseFloat(rawLitersStr.substring(0, 2) + '.' + rawLitersStr.substring(2));
            } else if (rawLitersStr.length === 3 || rawLitersStr.length === 2) {
                litrosReal = parseFloat(rawLitersStr);
            } else {
                litrosReal = parseFloat(String(item.litro_abastecido).replace(',', '.'));
            }
            // Quando for 2 ou 3 dígitos, manteve o valor bruto (já numérico e correto).

            // 2. Tratar Preço
            let precoRealL = 0;
            let rawPrecoStr = String(item.preco_combustivel || '0').replace(',', '.').replace(/[^\d.]/g, '');
            let rawPreco = parseFloat(rawPrecoStr || '0');

            if (rawPreco > 0 && litrosReal > 0) {
                // Extração Heurística do preço unitário com base em valores normais de mercado (R$ 2.0 a R$ 9.0)
                let targetAlcool = 4.00;
                let targetDiesel = 5.50;
                let targetGasolina = 6.00;

                let tipo = (item.tipo_combustivel || '').toUpperCase();
                let precoAlvo = tipo.includes('ALCOOL') || tipo.includes('ETANOL') ? targetAlcool :
                    tipo.includes('GASOLINA') ? targetGasolina : targetDiesel;

                // Opção 1: O valor digitado foi diretamente o preço/L sem a vírgula correta.
                let p1 = rawPreco;
                while (p1 > 10) p1 /= 10;

                // Opção 2: O valor digitado foi o preço TOTAL do abastecimento sem vírgula ou em centavos.
                let p2 = rawPreco / litrosReal;
                while (p2 > 10) p2 /= 10;

                // Ver quem é mais realista ao preço padrão
                let diff1 = Math.abs(p1 - precoAlvo);
                let diff2 = Math.abs(p2 - precoAlvo);

                precoRealL = (diff1 < diff2) ? p1 : p2;
            }

            let desc = '';
            let tipoVeiculo = '';
            let objPlaca = item.placa; // Fallback for plate

            if (vehicles && vehicles.length > 0) {
                const itemPlaca = String(item.placa || '').replace(/\W/g, '').toUpperCase();
                const itemFrota = String(item.frota || '').trim().toUpperCase();
                const match = vehicles.find(v => {
                    const vPlate = String(v.plate || '').replace(/\W/g, '').toUpperCase();
                    const vFleet = String(v.fleetName || '').trim().toUpperCase();
                    return (vFleet && itemFrota && vFleet === itemFrota) ||
                        (vPlate && itemPlaca && vPlate === itemPlaca);
                });
                if (match) {
                    const parts = [];
                    if (match.brand) parts.push(match.brand);
                    if (match.model) parts.push(match.model);
                    // if (parts.length === 0 && match.assetCode) parts.push(match.assetCode);
                    desc = parts.join(' ').trim();

                    if (match.assetCode) tipoVeiculo = match.assetCode;
                    if (match.plate) objPlaca = match.plate; // Override with registry plate
                }
            }

            return {
                ...item,
                placa: objPlaca,
                tipo_combustivel: fuelType,
                litros_corrigido: litrosReal,
                preco_l_corrigido: precoRealL,
                valor_total: litrosReal * precoRealL,
                descricao_veiculo: desc,
                tipo_veiculo: tipoVeiculo
            };
        });

    }, [abastecimentos, filters, vehicles]);

    const historicoData = useMemo(() => {
        if (!searchTerm) return formattedData;
        const searchLower = searchTerm.toLowerCase();
        return formattedData.filter(item => (
            (item.motorista && item.motorista.toLowerCase().includes(searchLower)) ||
            (item.placa && item.placa.toLowerCase().includes(searchLower)) ||
            (item.frota && item.frota.toLowerCase().includes(searchLower)) ||
            (item.tipo_combustivel && item.tipo_combustivel.toLowerCase().includes(searchLower))
        ));
    }, [formattedData, searchTerm]);

    const uniqueMotoristas = useMemo(() => {
        const list = formattedData.map(i => i.motorista).filter(Boolean);
        return [...new Set(list)].sort();
    }, [formattedData]);

    const uniqueFrotas = useMemo(() => {
        const list = formattedData.map(i => i.frota).filter(Boolean);
        return [...new Set(list)].sort();
    }, [formattedData]);

    const uniqueCombustiveis = useMemo(() => {
        const list = formattedData.map(i => i.tipo_combustivel).filter(Boolean);
        return [...new Set(list)].sort();
    }, [formattedData]);

    const resumoData = useMemo(() => {
        let filtered = formattedData;

        const groups = {};

        filtered.forEach(item => {
            const key = item.placa || item.frota || 'Desconhecido';
            if (!groups[key]) {
                groups[key] = {
                    placa: item.placa,
                    frota: item.frota,
                    descricao_veiculo: item.descricao_veiculo,
                    tipo_veiculo: item.tipo_veiculo,
                    litros_total: 0,
                    valor_total: 0,
                    horimetros: [],
                };
            }
            groups[key].litros_total += (item.litros_corrigido || 0);
            groups[key].valor_total += (item.valor_total || 0);

            let h = 0;
            if (typeof item.horimetro === 'number') {
                h = item.horimetro;
            } else if (typeof item.horimetro === 'string') {
                const cleanStr = item.horimetro.replace(/[^\d.,]/g, '');
                if (cleanStr.includes(',') && cleanStr.includes('.')) {
                    h = parseFloat(cleanStr.replace(/\./g, '').replace(',', '.'));
                } else if (cleanStr.includes(',')) {
                    h = parseFloat(cleanStr.replace(',', '.'));
                } else {
                    h = parseFloat(cleanStr);
                }
            }

            if (!isNaN(h) && h > 0) {
                groups[key].horimetros.push(h);
            }
        });

        let resumoArray = Object.values(groups).map(g => {
            const preco_medio = g.litros_total > 0 ? g.valor_total / g.litros_total : 0;
            let km_rodado = 0;
            if (g.horimetros.length > 1) {
                const minH = Math.min(...g.horimetros);
                const maxH = Math.max(...g.horimetros);
                km_rodado = maxH - minH;
            }

            const media_km = g.litros_total > 0 && km_rodado > 0 ? km_rodado / g.litros_total : 0;

            return {
                ...g,
                preco_medio,
                km_rodado,
                media_km
            };
        });

        if (resumoSearchTerm) {
            const searchLower = resumoSearchTerm.toLowerCase();
            resumoArray = resumoArray.filter(item => (
                (item.placa && item.placa.toLowerCase().includes(searchLower)) ||
                (item.frota && item.frota.toLowerCase().includes(searchLower)) ||
                (item.descricao_veiculo && item.descricao_veiculo.toLowerCase().includes(searchLower))
            ));
        }

        if (showErrorsOnly) {
            resumoArray = resumoArray.filter(item =>
                item.litros_total > 6000 || item.km_rodado > 11000 || item.km_rodado < 0
            );
        }

        return resumoArray.sort((a, b) => b.valor_total - a.valor_total);
    }, [formattedData, resumoSearchTerm, showErrorsOnly]);

    const formatarData = (dataString) => {
        if (!dataString) return '-';
        return new Date(dataString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header & Controls */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div className="shrink-0">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <Fuel size={24} />
                        </div>
                        Histórico de Abastecimentos
                    </h2>
                    <p className="text-slate-500 mt-1 text-sm font-medium">
                        Controle e acompanhamento de consumo de combustível.
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3 flex-1">
                    {/* Period Filters */}
                    {filters && (
                        <div className="flex items-center bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                            <FilterGroup
                                val={filters.periodType}
                                setVal={v => setFilters({ ...filters, periodType: v, periodValue: 1 })}
                                options={['Mês', 'Trimestre', 'Semestre', 'Ano'].map(o => ({ v: o, l: o }))}
                            />

                            {filters.periodType !== 'Ano' && (
                                <>
                                    <div className="w-px h-6 bg-slate-300 mx-1"></div>
                                    <FilterGroup
                                        val={filters.periodValue}
                                        setVal={v => setFilters({ ...filters, periodValue: v })}
                                        options={periodValueOptions}
                                    />
                                </>
                            )}

                            <div className="w-px h-6 bg-slate-300 mx-1"></div>

                            <FilterGroup
                                val={filters.year}
                                setVal={v => setFilters({ ...filters, year: v })}
                                options={[2024, 2025, 2026].map(y => ({ v: y, l: y }))}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('historico')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'historico' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                >
                    Histórico
                </button>
                <button
                    onClick={() => setActiveTab('resumo')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'resumo' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
                >
                    Resumo
                </button>
            </div>

            {/* Sub Controls: Search and Refresh OR Filters */}
            {activeTab === 'historico' ? (
                <div className="flex justify-end items-center gap-3">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar placa, frota ou motorista..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium shadow-sm transition-all"
                        />
                    </div>
                    <button
                        onClick={fetchAbastecimentos}
                        className="flex text-white items-center justify-center w-10 h-10 bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-md active:scale-95 shrink-0"
                        title="Atualizar Dados"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            ) : (
                <div className="flex flex-col md:flex-row justify-between items-center gap-3 w-full">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar placa, frota ou veículo..."
                            value={resumoSearchTerm}
                            onChange={(e) => setResumoSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium shadow-sm transition-all"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full justify-end flex-1">
                        <button
                            onClick={() => setShowErrorsOnly(!showErrorsOnly)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all whitespace-nowrap ${showErrorsOnly ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 shadow-amber-100' : 'bg-white text-slate-600 border border-slate-200 hover:border-amber-300 hover:text-amber-700'}`}
                            title="Filtrar Km > 11.000, Km Negativo ou Litragem > 6.000"
                        >
                            <AlertTriangle size={16} className={showErrorsOnly ? 'text-amber-600' : 'text-slate-400'} />
                            <span className="hidden sm:inline">Verificar Erros</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Table Container */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="overflow-x-auto w-full">
                    {activeTab === 'historico' ? (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/80 border-b border-slate-100">
                                <tr>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest w-px whitespace-nowrap">
                                        <div className="flex items-center gap-1.5"><Calendar size={14} />Data</div>
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                        <div className="flex items-center gap-1.5"><User size={14} />Motorista</div>
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest w-px whitespace-nowrap">
                                        <div className="flex items-center gap-1.5"><Truck size={14} />Frota</div>
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest w-px whitespace-nowrap">
                                        <div className="flex items-center gap-1.5"><Droplet size={14} />Combustível</div>
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-px whitespace-nowrap">
                                        Volume
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-px whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5"><DollarSign size={14} />Preço/L</div>
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-px whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5"><DollarSign size={14} />Valor Total</div>
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-px whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5"><Gauge size={14} />Horímetro</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {historicoData.length > 0 ? (
                                    historicoData.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                <span className="text-sm font-semibold text-slate-700 font-mono">
                                                    {formatarData(item.data_registro)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className="text-sm font-bold text-slate-900 uppercase line-clamp-2">
                                                    {item.motorista}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-sm whitespace-nowrap">
                                                <div className="flex flex-col gap-1 items-start">
                                                    <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded text-xs shadow-sm">{item.frota || '-'}</span>
                                                    <span className="font-mono text-xs font-bold text-slate-700 tracking-wider">
                                                        {item.placa || '-'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap">
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-tight">
                                                    {item.tipo_combustivel}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-right">
                                                <span className="text-sm font-black text-slate-900">
                                                    {formatarNumeroVolume(item.litros_corrigido)} L
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-right">
                                                <span className="text-sm font-bold text-slate-600">
                                                    {formatarMoeda(item.preco_l_corrigido)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-right">
                                                <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                                                    {formatarMoeda(item.valor_total)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-right">
                                                <span className="text-sm font-bold font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                                                    {item.horimetro}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="8" className="px-3 py-16 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-60">
                                                <Fuel size={48} className="text-slate-300" />
                                                <p className="text-sm font-bold uppercase tracking-widest">Nenhum registro de abastecimento encontrado</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left border-collapse animate-in fade-in">
                            <thead className="bg-slate-50/80 border-b border-slate-100">
                                <tr>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                        <div className="flex items-center gap-1.5"><Truck size={14} />Frota</div>
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-px whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5"><Droplet size={14} />Total Litros</div>
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-px whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5"><DollarSign size={14} />Preço Médio/L</div>
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-px whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5"><DollarSign size={14} />Valor Total</div>
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-px whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5"><Activity size={14} />KM/HR Rodado</div>
                                    </th>
                                    <th className="px-3 py-3 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-px whitespace-nowrap">
                                        <div className="flex items-center justify-end gap-1.5"><Gauge size={14} />Média p/ km</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {resumoData.length > 0 ? (
                                    resumoData.map((item, index) => (
                                        <tr key={index} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-3 py-3 text-sm whitespace-nowrap">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded text-xs shadow-sm">{item.frota || '-'}</span>
                                                    {item.descricao_veiculo && (
                                                        <span className="font-bold text-slate-500 text-[11px] uppercase" title={item.descricao_veiculo}>{item.descricao_veiculo}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="font-mono text-xs font-bold text-slate-700 tracking-wider">
                                                        {item.placa || '-'}
                                                    </span>
                                                    {item.tipo_veiculo && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.tipo_veiculo}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-right">
                                                <span className={`text-sm font-black text-slate-900 ${item.litros_total > 6000 ? 'text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200' : ''}`}>
                                                    {formatarNumeroVolume(item.litros_total)} L
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-right">
                                                <span className="text-sm font-bold text-slate-600">
                                                    {formatarMoeda(item.preco_medio)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-right">
                                                <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                                                    {formatarMoeda(item.valor_total)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-right">
                                                <span className={`text-sm font-bold font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded-md ${item.km_rodado > 11000 || item.km_rodado < 0 ? 'text-rose-700 bg-rose-100 border border-rose-200' : ''}`}>
                                                    {item.km_rodado !== 0 ? formatarNumeroVolume(item.km_rodado) : '-'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 whitespace-nowrap text-right">
                                                <span className="text-sm font-bold font-mono text-teal-700 bg-teal-50 px-2 py-1 rounded-md border border-teal-100">
                                                    {item.media_km > 0 ? `${formatarNumeroVolume(item.media_km)} km/L` : '-'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="px-3 py-16 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-60">
                                                <Activity size={48} className="text-slate-300" />
                                                <p className="text-sm font-bold uppercase tracking-widest">Nenhum resumo encontrado</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}