import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  LayoutDashboard, Truck, Upload, FileText,
  PieChart, Search, ChevronRight, ChevronLeft,
  Package, User, BarChart3, FileSearch, Banknote, DollarSign
} from 'lucide-react';

// Firebase Imports
import {
  collection, onSnapshot
} from 'firebase/firestore';
import {
  onAuthStateChanged, signInAnonymously, signInWithCustomToken
} from 'firebase/auth';

// --- CONFIGURAÇÃO FIREBASE ---
import { db, auth } from './firebaseConfig';

import { appId, VIEWS, FLEET_TYPES, VALID_CLASSES } from './constants/appConstants';


import SidebarLink from './components/ui/SidebarLink';
import StatCard from './components/ui/StatCard';
import FilterGroup from './components/ui/FilterGroup';
import FormField from './components/ui/FormField';
import DetailField from './components/ui/DetailField';
import EmDesenvolvimento from './components/ui/EmDesenvolvimento';

const Dashboard = lazy(() => import('./components/Dashboard'));
const VehicleManager = lazy(() => import('./components/VehicleManager'));
const ImportModule = lazy(() => import('./components/ImportModule'));
const TransactionsView = lazy(() => import('./components/TransactionsView'));
const FechamentoView = lazy(() => import('./components/FechamentoView'));
const AlmoxarifadoView = lazy(() => import('./components/AlmoxarifadoView'));
const RateiosView = lazy(() => import('./components/RateiosView'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal-600"></div>
    </div>
  );
}

// --- SUB-COMPONENTES EXTERNOS ---

// Dashboard extracted to ./components/Dashboard.jsx

// VehicleManager extracted to ./components/VehicleManager.jsx

// ImportModule extracted to ./components/ImportModule.jsx

// TransactionsView extracted to ./components/TransactionsView.jsx

// AlmoxarifadoView extracted to ./components/AlmoxarifadoView.jsx

// --- COMPONENTE EM DESENVOLVIMENTO ---

// RateiosView extracted to ./components/RateiosView.jsx


// --- COMPONENTE PRINCIPAL APP ---

export default function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState(VIEWS.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const [vehicles, setVehicles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [almoxarifadoItems, setAlmoxarifadoItems] = useState([]);
  const [rateios, setRateios] = useState([]);

  // --- FILTROS ATUALIZADOS ---
  const [filters, setFilters] = useState({
    year: 2026,
    periodType: 'Mês',
    periodValue: new Date().getMonth() + 1,
    fleetType: 'Todos',
  });

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsubV = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'vehicles'), (snap) => {
      setVehicles(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    const unsubE = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', 'expenses'),
      (snap) => {
        const expensesData = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        console.log('🔄 LISTENER FIREBASE: Expenses atualizados');
        console.log('  Total de documentos no Firebase:', snap.docs.length);
        console.log('  Documentos carregados:', expensesData.length);

        // Contar por tipo
        const entradas = expensesData.filter(e => e.type === 'income').length;
        const saidas = expensesData.filter(e => e.type === 'expense').length;
        console.log(`  Entradas: ${entradas} | Saídas: ${saidas}`);

        setExpenses(expensesData);
      },
      (error) => {
        console.error('❌ ERRO no listener de expenses:', error);
      }
    );

    const unsubA = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'almoxarifado'), (snap) => {
      setAlmoxarifadoItems(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    });

    const unsubR = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'rateios'), (snap) => {
      setRateios(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      setLoading(false);
    });

    return () => { unsubV(); unsubE(); unsubA(); unsubR(); };
  }, [user]);

  // --- LÓGICA DE FILTRAGEM ATUALIZADA ---
  const filteredExpensesMemo = useMemo(() => {
    return expenses.filter(e => {
      let y, m;
      // Fix timezone issue: Parse YYYY-MM-DD string directly
      if (e.date && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
        const parts = e.date.split('-');
        y = parseInt(parts[0]);
        m = parseInt(parts[1]);
      } else {
        const d = new Date(e.date);
        m = d.getMonth() + 1;
        y = d.getFullYear();
      }
      const v = parseInt(filters.periodValue);

      const yearMatch = y === parseInt(filters.year);
      let periodMatch = false;

      if (filters.periodType === 'Mês') periodMatch = m === v;
      else if (filters.periodType === 'Trimestre') periodMatch = Math.ceil(m / 3) === v;
      else if (filters.periodType === 'Semestre') periodMatch = Math.ceil(m / 6) === v;
      else if (filters.periodType === 'Ano') periodMatch = true;

      let fleetMatch = true;
      if (filters.fleetType !== 'Todos') {
        const vRef = vehicles.find(veh => veh.id === e.vehicleId || veh.fleetName === e.fleetName);
        fleetMatch = vRef?.type === filters.fleetType;
      }
      return yearMatch && periodMatch && fleetMatch;
    });
  }, [expenses, filters, vehicles]);

  // Opções dinâmicas baseadas no tipo de período
  const periodValueOptions = useMemo(() => {
    if (filters.periodType === 'Mês') {
      return [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ].map((name, i) => ({ v: i + 1, l: name }));
    }
    if (filters.periodType === 'Trimestre') {
      return [1, 2, 3, 4].map(i => ({ v: i, l: `${i}º Trimestre` }));
    }
    if (filters.periodType === 'Semestre') {
      return [1, 2].map(i => ({ v: i, l: `${i}º Semestre` }));
    }
    return [];
  }, [filters.periodType]);

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden selection:bg-teal-100">

      {/* Sidebar - Verde Água (Teal) */}
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-24'} bg-[#0F172A] text-white transition-all duration-500 flex flex-col z-30 shadow-2xl overflow-hidden`}>
        <div className="h-24 flex items-center gap-4 px-8 mb-4">
          <div className="w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/30">
            <Truck size={24} className="text-white" />
          </div>
          {isSidebarOpen && (
            <div className="animate-in fade-in slide-in-from-left-2 overflow-hidden">
              <h1 className="font-black text-lg tracking-tight uppercase leading-tight">Fechamento <span className="text-teal-400">Frota</span></h1>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-tight">Cálculo de Custos e Análise</p>
            </div>
          )}
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto scrollbar-thin">
          {/* Grupo: Visão Geral */}
          {isSidebarOpen && (
            <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
              Visão Geral
            </div>
          )}
          <SidebarLink active={currentView === VIEWS.DASHBOARD} onClick={() => setCurrentView(VIEWS.DASHBOARD)} icon={<LayoutDashboard size={22} />} label="Dashboard" collapsed={!isSidebarOpen} />
          <SidebarLink active={currentView === VIEWS.CLOSING} onClick={() => setCurrentView(VIEWS.CLOSING)} icon={<FileText size={22} />} label="Fechamento" collapsed={!isSidebarOpen} />
          <SidebarLink active={currentView === VIEWS.RELATORIOS} onClick={() => setCurrentView(VIEWS.RELATORIOS)} icon={<FileSearch size={22} />} label="Relatórios" collapsed={!isSidebarOpen} />
          <SidebarLink active={currentView === VIEWS.TRANSACTIONS} onClick={() => setCurrentView(VIEWS.TRANSACTIONS)} icon={<DollarSign size={22} />} label="Lançamentos" collapsed={!isSidebarOpen} />
          <SidebarLink active={currentView === VIEWS.RESUMO} onClick={() => setCurrentView(VIEWS.RESUMO)} icon={<BarChart3 size={22} />} label="Resumo" collapsed={!isSidebarOpen} />
          <SidebarLink active={currentView === VIEWS.RATEIOS} onClick={() => setCurrentView(VIEWS.RATEIOS)} icon={<PieChart size={22} />} label="Rateios" collapsed={!isSidebarOpen} />

          {/* Grupo: Base de Dados */}
          {isSidebarOpen && (
            <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-6">
              Base de Dados
            </div>
          )}
          <SidebarLink active={currentView === VIEWS.ALMOXARIFADO} onClick={() => setCurrentView(VIEWS.ALMOXARIFADO)} icon={<Package size={22} />} label="Almoxarifado" collapsed={!isSidebarOpen} />
          <SidebarLink active={currentView === VIEWS.VEHICLES} onClick={() => setCurrentView(VIEWS.VEHICLES)} icon={<Truck size={22} />} label="Cadastro de Frotas" collapsed={!isSidebarOpen} />
          <SidebarLink active={currentView === VIEWS.IMPORT} onClick={() => setCurrentView(VIEWS.IMPORT)} icon={<Upload size={22} />} label="Importar Dados" collapsed={!isSidebarOpen} />
        </nav>
        <div className="p-6 border-t border-slate-800">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-full h-12 flex items-center justify-center rounded-xl bg-slate-800/50 hover:bg-slate-800 transition text-slate-400">
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {currentView !== VIEWS.IMPORT && currentView !== VIEWS.VEHICLES && currentView !== VIEWS.ALMOXARIFADO && currentView !== VIEWS.RELATORIOS && currentView !== VIEWS.RESUMO && currentView !== VIEWS.TRANSACTIONS && currentView !== VIEWS.CLOSING && currentView !== VIEWS.DASHBOARD && currentView !== VIEWS.RATEIOS && (
          <header className="h-24 bg-white/80 backdrop-blur-md border-b border-slate-100 px-10 flex items-center justify-between z-20 sticky top-0">
            <div className="flex items-center gap-10">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight capitalize">{currentView}</h2>

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
            </div>
          </header>
        )}

        <section className="flex-1 overflow-y-auto p-10 bg-[#F8FAFC]">
          <div className="max-w-7xl mx-auto">
            {loading ? <div className="text-center font-black text-slate-300 uppercase py-20 tracking-widest animate-pulse">Sincronizando...</div> : (
              <Suspense fallback={<LoadingSpinner />}>
                {currentView === VIEWS.DASHBOARD && <Dashboard filteredExpenses={filteredExpensesMemo} vehicles={vehicles} filters={filters} setFilters={setFilters} />}
                {currentView === VIEWS.VEHICLES && <VehicleManager vehicles={vehicles} db={db} appId={appId} />}
                {currentView === VIEWS.IMPORT && <ImportModule vehicles={vehicles} db={db} appId={appId} setCurrentView={setCurrentView} almoxarifadoItems={almoxarifadoItems} expenses={expenses} />}
                {currentView === VIEWS.TRANSACTIONS && (
                  <Suspense fallback={<LoadingSpinner />}>
                    <TransactionsView
                      expenses={filteredExpensesMemo}
                      filteredExpenses={filteredExpensesMemo} // Passando explicitamente para garantir
                      setExpenses={setExpenses}
                      filters={filters}
                      setFilters={setFilters}
                      db={db}
                      appId={appId}
                      vehicles={vehicles}
                      almoxarifadoItems={almoxarifadoItems}
                      rateios={rateios}
                    />
                  </Suspense>
                )}
                {currentView === VIEWS.CLOSING && <FechamentoView expenses={expenses} filteredExpenses={filteredExpensesMemo} filters={filters} setFilters={setFilters} vehicles={vehicles} />}
                {currentView === VIEWS.ALMOXARIFADO && <AlmoxarifadoView items={almoxarifadoItems} db={db} appId={appId} />}
                {currentView === VIEWS.RELATORIOS && <EmDesenvolvimento titulo="Relatórios" />}
                {currentView === VIEWS.RESUMO && <EmDesenvolvimento titulo="Resumo" />}
                {currentView === VIEWS.RATEIOS && <RateiosView rateios={rateios} db={db} appId={appId} filters={filters} setFilters={setFilters} />}
              </Suspense>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

// --- COMPONENTE ATÔMICOS ---

// Atualizado para ocultar o label quando a sidebar estiver fechada



