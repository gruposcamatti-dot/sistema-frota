import React, { useState, useRef, useMemo } from 'react';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { Search, Trash2, Upload, Plus, FileSearch, Edit2, Truck, X, Settings } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { FLEET_TYPES } from '../constants/appConstants';

export default function VehicleManager({ vehicles, db, appId }) {
  const fileInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewingVehicle, setViewingVehicle] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [selectedVehicles, setSelectedVehicles] = useState(new Set());

  const initialForm = {
    fleetName: '',
    plate: '',
    assetCode: '',
    model: '',
    brand: '',
    year: '',
    segment: '',
    location: '',
    axles: '',
    tires: '',
    marketValue: '',
    type: FLEET_TYPES.LIGHT,
    status: 'Ativo'
  };
  const [formData, setFormData] = useState(initialForm);

  const formatCurrencyValue = (value) => {
    if (!value) return '—';
    const cleanString = String(value).replace(/\./g, '').replace(',', '.');
    const number = parseFloat(cleanString);
    if (isNaN(number)) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const term = searchTerm.toLowerCase();
      return (
        v.fleetName.toLowerCase().includes(term) ||
        v.plate.toLowerCase().includes(term) ||
        (v.assetCode && v.assetCode.toLowerCase().includes(term)) ||
        (v.model && v.model.toLowerCase().includes(term)) ||
        (v.segment && v.segment.toLowerCase().includes(term))
      );
    });
  }, [vehicles, searchTerm]);

  const handleCreateVehicle = async () => {
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'vehicles');
    await addDoc(colRef, formData);
    setIsCreateModalOpen(false);
    setFormData(initialForm);
  };

  const handleEditVehicle = (vehicle) => {
    setEditingId(vehicle.id);
    setFormData({
      fleetName: vehicle.fleetName || '',
      plate: vehicle.plate || '',
      assetCode: vehicle.assetCode || '',
      model: vehicle.model || '',
      brand: vehicle.brand || '',
      year: vehicle.year || '',
      segment: vehicle.segment || '',
      location: vehicle.location || '',
      axles: vehicle.axles || '',
      tires: vehicle.tires || '',
      marketValue: vehicle.marketValue || '',
      type: vehicle.type,
      status: vehicle.status
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'vehicles');
    await updateDoc(doc(colRef, editingId), formData);
    setIsEditModalOpen(false);
    setEditingId(null);
    setFormData(initialForm);
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (window.confirm('Tem certeza que deseja excluir este veículo?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'vehicles', vehicleId));
    }
  };

  const handleSelectVehicle = (vehicleId) => {
    const newSelected = new Set(selectedVehicles);
    if (newSelected.has(vehicleId)) {
      newSelected.delete(vehicleId);
    } else {
      newSelected.add(vehicleId);
    }
    setSelectedVehicles(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedVehicles.size === filteredVehicles.length && filteredVehicles.length > 0) {
      setSelectedVehicles(new Set());
    } else {
      setSelectedVehicles(new Set(filteredVehicles.map(v => v.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedVehicles.size === 0) {
      alert('Selecione pelo menos um veículo para excluir');
      return;
    }
    if (window.confirm(`Tem certeza que deseja excluir ${selectedVehicles.size} veículo(s)?`)) {
      const batch = writeBatch(db);
      selectedVehicles.forEach(id => {
        batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'vehicles', id));
      });
      await batch.commit();
      setSelectedVehicles(new Set());
    }
  };

  const handleImportCSV = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target.result;
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      const startIndex = lines[0].toUpperCase().includes('FROTA') ? 1 : 0;

      const batch = writeBatch(db);
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'vehicles');

      for (let i = startIndex; i < lines.length; i++) {
        const cols = lines[i].split(';').map(col => col.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) continue;

        const newVehicle = {
          fleetName: cols[0] || '',
          plate: cols[1] || '',
          assetCode: cols[2] || '',
          model: cols[3] || '',
          brand: cols[4] || '',
          year: cols[5] || '',
          segment: cols[6] || '',
          location: cols[7] || '',
          axles: cols[8] || '',
          tires: cols[9] || '',
          marketValue: cols[10] || '',
          type: (cols[11] || '').toUpperCase().includes('PESADA') ? FLEET_TYPES.HEAVY : FLEET_TYPES.LIGHT,
          status: 'Ativo'
        };

        const docRef = doc(colRef);
        batch.set(docRef, newVehicle);
      }

      await batch.commit();
      alert(`${lines.length - startIndex} veículos importados com sucesso.`);
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Action Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Buscar por placa, frota, tipo, modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none text-sm transition-all shadow-sm font-medium"
          />
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          {selectedVehicles.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center justify-center gap-2 bg-red-600 text-white px-5 py-3 rounded-xl hover:bg-red-700 transition-all text-sm font-bold shadow-lg shadow-red-500/20 flex-1 md:flex-initial">
              <Trash2 size={18} />
              <span>Excluir ({selectedVehicles.size})</span>
            </button>
          )}

          <input type="file" ref={fileInputRef} onChange={handleImportCSV} accept=".csv,.txt" className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-3 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-sm font-bold shadow-sm flex-1 md:flex-initial">
            <Upload size={18} />
            <span className="hidden sm:inline">Importar CSV</span>
          </button>

          <button
            onClick={() => { setFormData(initialForm); setIsCreateModalOpen(true); }}
            className="flex items-center justify-center gap-2 bg-teal-600 text-white px-6 py-3 rounded-xl hover:bg-teal-700 transition-all text-sm font-bold shadow-lg shadow-teal-500/20 hover:shadow-xl hover:shadow-teal-500/30 hover:-translate-y-0.5 flex-1 md:flex-initial">
            <Plus size={18} />
            <span>Novo Veículo</span>
          </button>
        </div>
      </div>

      {/* Table Virtualizada */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex flex-col h-[600px]">
        {/* Header Fixo */}
        <div className="flex bg-slate-50/90 border-b border-slate-100 items-center px-4 py-3 min-w-[900px]">
          <div className="w-[50px] flex justify-center">
            <input
              type="checkbox"
              checked={selectedVehicles.size === filteredVehicles.length && filteredVehicles.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-slate-300 cursor-pointer text-teal-600 focus:ring-teal-500"
            />
          </div>
          <div className="w-[15%] min-w-[120px] text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Frota</div>
          <div className="w-[120px] text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Placa</div>
          <div className="w-[120px] text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Tipo</div>
          <div className="w-[15%] min-w-[150px] text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Modelo</div>
          <div className="w-[15%] min-w-[150px] text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Segmento</div>
          <div className="w-[140px] text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Classificação</div>
          <div className="w-[100px] text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">Status</div>
          <div className="w-[100px] text-[11px] font-black text-slate-400 uppercase tracking-widest text-right px-2">Ações</div>
        </div>

        {/* Lista Virtualizada */}
        <div className="min-w-[900px] h-[calc(100vh-220px)]">
          <AutoSizer>
            {({ height, width }) => (
              <List
                height={height}
                width={width}
                itemCount={filteredVehicles.length}
                itemSize={72}
                itemData={{
                  items: filteredVehicles,
                  selectedVehicles,
                  handleSelectVehicle,
                  handleEditVehicle,
                  handleDeleteVehicle,
                  setViewingVehicle,
                  FLEET_TYPES
                }}
              >
                {({ index, style, data }) => {
                  const vehicle = data.items[index];
                  const isSelected = data.selectedVehicles.has(vehicle.id);

                  return (
                    <div style={style} className={`flex items-center px-4 border-b border-slate-50 hover:bg-slate-50/80 transition-all group ${isSelected ? 'bg-teal-50/30' : ''}`}>
                      <div className="w-[50px] flex justify-center flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => data.handleSelectVehicle(vehicle.id)}
                          className="w-4 h-4 rounded border-slate-300 cursor-pointer text-teal-600 focus:ring-teal-500"
                        />
                      </div>
                      <div className="w-[15%] min-w-[120px] px-2 flex-shrink-0">
                        <span className="text-sm font-bold text-slate-800 truncate block" title={vehicle.fleetName}>{vehicle.fleetName}</span>
                      </div>
                      <div className="w-[120px] px-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-slate-900 tracking-wide font-mono bg-slate-100 px-2 py-1 rounded">{vehicle.plate}</span>
                      </div>
                      <div className="w-[120px] px-2 flex-shrink-0">
                        <span className="text-sm text-slate-700 font-medium truncate block" title={vehicle.assetCode}>{vehicle.assetCode || '—'}</span>
                      </div>
                      <div className="w-[15%] min-w-[150px] px-2 flex-shrink-0">
                        <span className="text-sm text-slate-600 truncate block" title={vehicle.model}>{vehicle.model || '—'}</span>
                      </div>
                      <div className="w-[15%] min-w-[150px] px-2 flex-shrink-0">
                        <span className="text-sm text-slate-600 truncate block" title={vehicle.segment}>{vehicle.segment || '—'}</span>
                      </div>
                      <div className="w-[140px] px-2 flex-shrink-0">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${vehicle.type === data.FLEET_TYPES.HEAVY ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                          {vehicle.type}
                        </span>
                      </div>
                      <div className="w-[100px] px-2 flex-shrink-0">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${vehicle.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                          {vehicle.status}
                        </span>
                      </div>
                      <div className="w-[100px] px-2 text-right flex justify-end gap-1 flex-shrink-0">
                        <button
                          onClick={() => data.setViewingVehicle(vehicle)}
                          className="p-2 text-slate-300 hover:text-teal-600 transition-colors"
                          title="Ver Detalhes"
                        >
                          <FileSearch size={18} />
                        </button>
                        <button
                          onClick={() => data.handleEditVehicle(vehicle)}
                          className="p-2 text-slate-300 hover:text-slate-600 transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => data.handleDeleteVehicle(vehicle.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                }}
              </List>
            )}
          </AutoSizer>
        </div>

        {/* Footer com total */}
        <div className="border-t border-slate-100 p-4 bg-white">
          <span className="text-sm text-slate-500 font-medium">
            Total: {filteredVehicles.length} veículo{filteredVehicles.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Modal de Visualização */}
      {viewingVehicle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-100 bg-white z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="text-teal-600" />
                  Detalhes da Frota
                </h2>
                <p className="text-sm text-slate-500 mt-1">Cadastro completo do veículo</p>
              </div>
              <button
                onClick={() => setViewingVehicle(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={24} className="text-slate-500" />
              </button>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Frota</label>
                  <div className="text-lg font-bold text-slate-900">{viewingVehicle.fleetName}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Placa</label>
                  <div className="text-lg font-mono font-bold text-slate-900 bg-slate-50 inline-block px-3 py-1 rounded">{viewingVehicle.plate}</div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
                  <div className="text-slate-700 font-medium">{viewingVehicle.assetCode || '—'}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modelo</label>
                  <div className="text-slate-700 font-medium">{viewingVehicle.model || '—'}</div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Marca</label>
                  <div className="text-slate-700 font-medium">{viewingVehicle.brand || '—'}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ano</label>
                  <div className="text-slate-700 font-medium">{viewingVehicle.year || '—'}</div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Segmento</label>
                  <div className="text-slate-700 font-medium">{viewingVehicle.segment || '—'}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Localização</label>
                  <div className="text-slate-700 font-medium">{viewingVehicle.location || '—'}</div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Classificação</label>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${viewingVehicle.type === FLEET_TYPES.HEAVY ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'}`}>
                      {viewingVehicle.type}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</label>
                  <div className="text-emerald-600 font-bold">{viewingVehicle.status}</div>
                </div>

                <div className="col-span-1 md:col-span-2 border-t border-slate-100 pt-6 mt-2">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Settings size={16} className="text-slate-400" />
                    Informações Técnicas & Valores
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Eixos</label>
                      <div className="text-slate-700 font-medium">{viewingVehicle.axles || '—'}</div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pneus</label>
                      <div className="text-slate-700 font-medium">{viewingVehicle.tires || '—'}</div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Valor de Mercado</label>
                      <div className="text-teal-700 font-bold">{formatCurrencyValue(viewingVehicle.marketValue)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setViewingVehicle(null)}
                className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-bold shadow-sm transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-100 bg-white">
              <h2 className="text-lg font-bold text-slate-900">Novo Veículo</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Frota</label>
                <input
                  type="text"
                  value={formData.fleetName}
                  onChange={(e) => setFormData({ ...formData, fleetName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Ex: 5041"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Placa</label>
                <input
                  type="text"
                  value={formData.plate}
                  onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                  placeholder="ABC-1234"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tipo</label>
                <input
                  type="text"
                  value={formData.assetCode}
                  onChange={(e) => setFormData({ ...formData, assetCode: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Ex: PAVIMENTAÇÃO"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Ano</label>
                <input
                  type="text"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Ex: 2008/2008"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Modelo</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Ex: 24-220 WORKER"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Marca</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Ex: VOLKSWAGEN"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Segmento</label>
                <input
                  type="text"
                  value={formData.segment}
                  onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Ex: CONSTRUTORA"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Localização</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Ex: SÃO PAULO"
                />
              </div>

              <div className="col-span-1 md:col-span-2 border-t border-slate-100 my-2"></div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Qtd. Eixos</label>
                <input
                  type="number"
                  value={formData.axles}
                  onChange={(e) => setFormData({ ...formData, axles: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Ex: 3"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Qtd. Pneus</label>
                <input
                  type="number"
                  value={formData.tires}
                  onChange={(e) => setFormData({ ...formData, tires: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Ex: 11"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Valor de Mercado</label>
                <input
                  type="text"
                  value={formData.marketValue}
                  onChange={(e) => setFormData({ ...formData, marketValue: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Ex: 144988"
                />
                <p className="text-xs text-slate-400 mt-1">Use apenas números ou vírgula.</p>
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Classificação</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value={FLEET_TYPES.LIGHT}>Leve</option>
                  <option value={FLEET_TYPES.HEAVY}>Pesada</option>
                </select>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Vendido">Vendido</option>
                  <option value="Sucata">Sucata</option>
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-3 p-6 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateVehicle}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-bold transition-colors shadow-lg shadow-teal-500/20"
              >
                Criar Veículo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-6 border-b border-slate-100 bg-white">
              <h2 className="text-lg font-bold text-slate-900">Editar Veículo</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Frota</label>
                <input
                  type="text"
                  value={formData.fleetName}
                  onChange={(e) => setFormData({ ...formData, fleetName: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Placa</label>
                <input
                  type="text"
                  value={formData.plate}
                  onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Tipo</label>
                <input
                  type="text"
                  value={formData.assetCode}
                  onChange={(e) => setFormData({ ...formData, assetCode: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Ano</label>
                <input
                  type="text"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Modelo</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Marca</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Segmento</label>
                <input
                  type="text"
                  value={formData.segment}
                  onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Localização</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="col-span-1 md:col-span-2 border-t border-slate-100 my-2"></div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Qtd. Eixos</label>
                <input
                  type="number"
                  value={formData.axles}
                  onChange={(e) => setFormData({ ...formData, axles: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Qtd. Pneus</label>
                <input
                  type="number"
                  value={formData.tires}
                  onChange={(e) => setFormData({ ...formData, tires: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Valor de Mercado</label>
                <input
                  type="text"
                  value={formData.marketValue}
                  onChange={(e) => setFormData({ ...formData, marketValue: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="col-span-1">
                <label className="block text-sm font-bold text-slate-700 mb-2">Classificação</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value={FLEET_TYPES.LIGHT}>Leve</option>
                  <option value={FLEET_TYPES.HEAVY}>Pesada</option>
                </select>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Vendido">Vendido</option>
                  <option value="Sucata">Sucata</option>
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-3 p-6 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-bold transition-colors shadow-lg shadow-teal-500/20"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
