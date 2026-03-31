import { useState, useEffect } from 'react';
import api from '../services/api';

export default function UnitManagement() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUnits = async () => {
    try {
      const { data } = await api.get('/units');
      setUnits(data);
    } catch {
      showToast('Failed to load units', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUnits(); }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openCreate = () => {
    setEditingUnit(null);
    setName('');
    setModalOpen(true);
  };

  const openEdit = (unit) => {
    setEditingUnit(unit);
    setName(unit.name);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUnit(null);
    setName('');
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast('Unit name is required', 'error'); return; }
    setSaving(true);
    try {
      if (editingUnit) {
        await api.put(`/units/${editingUnit.id}`, { name: name.trim() });
        showToast('Unit updated');
      } else {
        await api.post('/units', { name: name.trim() });
        showToast('Unit created');
      }
      closeModal();
      fetchUnits();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save unit', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/units/${id}`);
      showToast('Unit deleted');
      setDeleteConfirm(null);
      fetchUnits();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete unit', 'error');
      setDeleteConfirm(null);
    }
  };

  if (loading) return <div className="text-gray-500">Loading units...</div>;

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">Delete unit <strong>{deleteConfirm.name}</strong>? This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{editingUnit ? 'Edit Unit' : 'Add Unit'}</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="e.g. Box, Kg, Piece, Litre"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 disabled:opacity-50">
                {saving ? 'Saving...' : editingUnit ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Unit Management</h2>
        <button onClick={openCreate} className="px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 transition-colors">
          + Add Unit
        </button>
      </div>

      {units.length === 0 ? (
        <p className="text-gray-500">No units yet. Add your first unit!</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Unit Name</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {units.map((unit, idx) => (
                <tr key={unit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-400">{idx + 1}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{unit.name}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => openEdit(unit)} className="text-yellow-600 hover:text-yellow-700 text-sm mr-4">Edit</button>
                    <button onClick={() => setDeleteConfirm(unit)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
