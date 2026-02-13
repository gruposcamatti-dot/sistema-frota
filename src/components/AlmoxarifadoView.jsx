import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Plus, Trash2, Edit2, X, Download, Filter, Package, AlertTriangle, CheckCircle2, Upload, Save
} from 'lucide-react';
import {
  collection, doc, addDoc, updateDoc,
  deleteDoc, writeBatch
} from 'firebase/firestore';
import { VALID_CLASSES } from '../constants/appConstants';

export default function AlmoxarifadoView({ items, db, appId }) {
  const fileInputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterPending, setFilterPending] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isBulkChangingClass, setIsBulkChangingClass] = useState(false);
  const [bulkClassValue, setBulkClassValue] = useState('');
  const [newItem, setNewItem] = useState({
    codMateria: '',
    descricaoMateria: '',
    classe: ''
  });

  // Get available classes from VALID_CLASSES
  const availableClasses = VALID_CLASSES;

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = !searchTerm ||
      item.codMateria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.descricaoMateria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.classe && item.classe.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesPending = !filterPending || !item.classe || item.classe.trim() === '';

    return matchesSearch && matchesPending;
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(item => item.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSaveEdit = async () => {
    if (editingItem) {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'almoxarifado');

      await updateDoc(doc(colRef, editingItem.id), {
        codMateria: editingItem.codMateria.replace(/^["']+|["']+$/g, '').trim(),
        descricaoMateria: editingItem.descricaoMateria.replace(/^["']+|["']+$/g, '').trim(),
        classe: editingItem.classe
      });

      setEditingItem(null);
    }
  };

  const handleSaveNew = async () => {
    if (newItem.codMateria && newItem.descricaoMateria) {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'almoxarifado');
      await addDoc(colRef, {
        codMateria: newItem.codMateria.replace(/^["']+|["']+$/g, '').trim(),
        descricaoMateria: newItem.descricaoMateria.replace(/^["']+|["']+$/g, '').trim(),
        classe: newItem.classe || ''
      });
      setIsCreating(false);
      setNewItem({ codMateria: '', descricaoMateria: '', classe: '' });
    } else {
      alert('Preencha Código e Descrição da Matéria');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este item?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'almoxarifado', id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      alert('Selecione pelo menos um item para excluir');
      return;
    }
    if (window.confirm(`Deseja excluir ${selectedIds.length} itens selecionados?`)) {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'almoxarifado', id));
      });
      await batch.commit();
      setSelectedIds([]);
    }
  };

  const handleImportCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csv = event.target.result;
      const lines = csv.split('\n').filter(line => line.trim() !== '');
      const headers = lines[0].split(';').map(h => h.trim());

      const batch = writeBatch(db);
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'almoxarifado');

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';').map(c => c.replace(/^["']+|["']+$/g, '').trim());
        if (cols.length >= 2) {
          const docRef = doc(colRef);
          batch.set(docRef, {
            codMateria: cols[0] || '',
            descricaoMateria: cols[1] || '',
            classe: cols[2] || ''
          });
        }
      }

      await batch.commit();
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert(`${lines.length - 1} itens importados com sucesso!`);
    };
    reader.readAsText(file);
  };

  const handleBulkChangeClass = async () => {
    if (!bulkClassValue) {
      alert('Selecione uma classe');
      return;
    }

    const batch = writeBatch(db);
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'almoxarifado');

    selectedIds.forEach(id => {
      batch.update(doc(colRef, id), {
        classe: bulkClassValue
      });
    });

    await batch.commit();

    setIsBulkChangingClass(false);
    setBulkClassValue('');
    setSelectedIds([]);
    alert(`Classe alterada para ${selectedIds.length} itens!`);
  };

  const pendingCount = items.filter(item => !item.classe || item.classe.trim() === '').length;

  return (
    <div className="p-8 max-w-[1920px] mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="text-teal-600" />
            Almoxarifado
          </h2>
          <p className="text-slate-500 mt-1">
            Gestão de matérias e classificações do estoque.
          </p>
        </div>
      </div>

      {/* Alert for pending items */}
      {pendingCount > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl flex items-start gap-3">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={20} />
          <div>
            <h4 className="text-amber-800 font-bold text-sm">
              {pendingCount} {pendingCount === 1 ? 'item pendente' : 'itens pendentes'} de classificação
            </h4>
            <p className="text-amber-700 text-xs mt-1">
              Defina as classes para todos os itens para melhor organização do estoque.
            </p>
          </div>
        </div>
      )}

      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 mb-6">
        <div className="flex flex-col md:flex-row justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-600 transition-colors" size={20} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por código, descrição ou classe..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-teal-100 focus:border-teal-500 outline-none text-sm transition-all shadow-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <>
                <button
                  onClick={() => setIsBulkChangingClass(true)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors"
                >
                  <Edit2 size={18} />
                  Alterar Classe ({selectedIds.length})
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
                >
                  <Trash2 size={18} />
                  Excluir ({selectedIds.length})
                </button>
              </>
            )}

            <button
              onClick={() => setFilterPending(!filterPending)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-colors ${filterPending
                ? 'text-white bg-amber-600 border-amber-700'
                : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                }`}
            >
              <Filter size={18} />
              {filterPending ? 'Mostrando Pendentes' : 'Filtrar Pendentes'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"
            >
              <Upload size={18} />
              Importar CSV
            </button>

            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 rounded-xl transition-colors shadow-lg"
            >
              <Plus size={18} />
              Novo Cadastro
            </button>

            <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors">
              <Download size={18} />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/90 border-b border-slate-100 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                    checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Cód. Matéria</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Descrição Matéria</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Classe</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right w-32">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 transition-all group ${selectedIds.includes(item.id) ? 'bg-teal-50/30' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4 cursor-pointer"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelectOne(item.id)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-900">{item.codMateria?.replace(/^["']+|["']+$/g, '').trim()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700">{item.descricaoMateria?.replace(/^["']+|["']+$/g, '').trim()}</span>
                    </td>
                    <td className="px-6 py-4">
                      {item.classe ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          {item.classe}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingItem(item)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
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
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="bg-slate-50 p-4 rounded-full">
                        <Package size={24} className="text-slate-300" />
                      </div>
                      <p className="font-medium">Nenhum item encontrado.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Editar Item</h3>
              <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Cód. Matéria</label>
                <input
                  type="text"
                  value={editingItem.codMateria}
                  onChange={(e) => setEditingItem({ ...editingItem, codMateria: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Descrição</label>
                <input
                  type="text"
                  value={editingItem.descricaoMateria}
                  onChange={(e) => setEditingItem({ ...editingItem, descricaoMateria: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Classe</label>
                <select
                  value={editingItem.classe}
                  onChange={(e) => setEditingItem({ ...editingItem, classe: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                >
                  <option value="">Selecione uma classe...</option>
                  {availableClasses.map(classe => (
                    <option key={classe} value={classe}>{classe}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setEditingItem(null)}
                className="px-6 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-lg flex items-center gap-2"
              >
                <Save size={18} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Novo Cadastro</h3>
              <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Cód. Matéria *</label>
                <input
                  type="text"
                  value={newItem.codMateria}
                  onChange={(e) => setNewItem({ ...newItem, codMateria: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Descrição *</label>
                <input
                  type="text"
                  value={newItem.descricaoMateria}
                  onChange={(e) => setNewItem({ ...newItem, descricaoMateria: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Classe</label>
                <select
                  value={newItem.classe}
                  onChange={(e) => setNewItem({ ...newItem, classe: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                >
                  <option value="">Selecione uma classe...</option>
                  {availableClasses.map(classe => (
                    <option key={classe} value={classe}>{classe}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setIsCreating(false)}
                className="px-6 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNew}
                className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <Save size={18} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Alteração de Classe em Lote */}
      {isBulkChangingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900">Alterar Classe em Lote</h3>
              <button onClick={() => setIsBulkChangingClass(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Você está alterando a classe de <span className="font-bold text-slate-900">{selectedIds.length}</span> {selectedIds.length === 1 ? 'item' : 'itens'}.
              </p>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nova Classe</label>
                <select
                  value={bulkClassValue}
                  onChange={(e) => setBulkClassValue(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
                >
                  <option value="">Selecione uma classe...</option>
                  {availableClasses.map(classe => (
                    <option key={classe} value={classe}>{classe}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setIsBulkChangingClass(false)}
                className="px-6 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkChangeClass}
                className="px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg flex items-center gap-2"
              >
                <Save size={18} />
                Alterar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}