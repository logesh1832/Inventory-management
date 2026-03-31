import { useState, useEffect } from 'react';
import api from '../services/api';

const emptyForm = { name: '', has_sub_unit: false, sub_unit_name: '' };

export default function UnitManagement() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form, setForm] = useState(emptyForm);
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

  useEffect(() => {
    fetchUnits();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openCreate = () => {
    setEditingUnit(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (unit) => {
    setEditingUnit(unit);
    setForm({
      name: unit.name,
      has_sub_unit: unit.has_sub_unit || false,
      sub_unit_name: unit.sub_unit_name || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUnit(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Unit name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        has_sub_unit: form.has_sub_unit,
        sub_unit_name: form.has_sub_unit ? form.sub_unit_name.trim() : '',
      };
      if (editingUnit) {
        await api.put(`/units/${editingUnit.id}`, payload);
        showToast('Unit updated successfully');
      } else {
        await api.post('/units', payload);
        showToast('Unit created successfully');
      }
      closeModal();
      fetchUnits();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save unit';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/units/${id}`);
      showToast('Unit deleted successfully');
      setDeleteConfirm(null);
      fetchUnits();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to delete unit';
      showToast(msg, 'error');
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading units...</div>;
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete the unit <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {editingUnit ? 'Edit Unit' : 'Add Unit'}
            </h3>

            {/* Unit Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Boxes, Kg, Pieces"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            {/* Has Sub Unit Toggle */}
            <div className="mb-4">
              <div
                className="flex items-center gap-4 cursor-pointer"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    has_sub_unit: !prev.has_sub_unit,
                    sub_unit_name: !prev.has_sub_unit ? prev.sub_unit_name : '',
                  }))
                }
              >
                <div
                  className="relative flex-shrink-0"
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: form.has_sub_unit ? '#EAB308' : '#D1D5DB',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: '#fff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      position: 'absolute',
                      top: 2,
                      left: form.has_sub_unit ? 22 : 2,
                      transition: 'left 0.2s',
                    }}
                  />
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700">Has Sub Unit</span>
                  <p className="text-xs text-gray-400">
                    Enable if this unit contains a smaller unit (e.g. Box contains Pieces)
                  </p>
                </div>
              </div>
            </div>

            {/* Sub Unit Name */}
            {form.has_sub_unit && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub Unit Name</label>
                <input
                  type="text"
                  value={form.sub_unit_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, sub_unit_name: e.target.value }))}
                  placeholder="e.g. Pieces"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingUnit ? 'Update Unit' : 'Create Unit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Unit Management</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 transition-colors text-center"
        >
          + Add Unit
        </button>
      </div>

      {/* Content */}
      {units.length === 0 ? (
        <p className="text-gray-500">No units found. Create your first unit!</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {units.map((unit) => (
              <div key={unit.id} className="bg-white rounded-lg shadow p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{unit.name}</span>
                  {unit.has_sub_unit && (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Has Sub Unit
                    </span>
                  )}
                </div>
                {unit.has_sub_unit && unit.sub_unit_name && (
                  <div className="text-sm text-gray-600">
                    Sub Unit: <span className="font-medium">{unit.sub_unit_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                  <button onClick={() => openEdit(unit)} className="text-yellow-600 hover:text-yellow-700 text-sm">
                    Edit
                  </button>
                  <button onClick={() => setDeleteConfirm(unit)} className="text-red-500 hover:text-red-700 text-sm">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Has Sub Unit</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Sub Unit Name</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {units.map((unit) => (
                  <tr key={unit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{unit.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {unit.has_sub_unit ? (
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Yes</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{unit.sub_unit_name || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEdit(unit)}
                        className="text-yellow-600 hover:text-yellow-700 text-sm mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(unit)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
