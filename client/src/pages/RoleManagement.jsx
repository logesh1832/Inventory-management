import { useState, useEffect } from 'react';
import api from '../services/api';

const ALL_CAPABILITIES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'products', label: 'Products' },
  { key: 'categories', label: 'Categories' },
  { key: 'customers', label: 'Customers' },
  { key: 'material_in', label: 'Material In' },
  { key: 'movements', label: 'Movements' },
  { key: 'material_out', label: 'Material Out' },
  { key: 'reports', label: 'Reports' },
  { key: 'user_management', label: 'User Management' },
  { key: 'role_management', label: 'Role Management' },
];

const emptyForm = { name: '', capabilities: [] };

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchRoles = async () => {
    try {
      const { data } = await api.get('/roles');
      setRoles(data);
    } catch {
      showToast('Failed to load roles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openCreate = () => {
    setEditingRole(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      capabilities: [...(role.capabilities || [])],
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRole(null);
    setForm({ ...emptyForm });
  };

  const toggleCapability = (key) => {
    setForm((prev) => {
      const caps = prev.capabilities.includes(key)
        ? prev.capabilities.filter((c) => c !== key)
        : [...prev.capabilities, key];
      return { ...prev, capabilities: caps };
    });
  };

  const allSelected = form.capabilities.length === ALL_CAPABILITIES.length;

  const toggleAll = () => {
    if (allSelected) {
      setForm((prev) => ({ ...prev, capabilities: [] }));
    } else {
      setForm((prev) => ({ ...prev, capabilities: ALL_CAPABILITIES.map((c) => c.key) }));
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Role name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, {
          name: form.name.trim(),
          capabilities: form.capabilities,
        });
        showToast('Role updated successfully');
      } else {
        await api.post('/roles', {
          name: form.name.trim(),
          capabilities: form.capabilities,
        });
        showToast('Role created successfully');
      }
      closeModal();
      fetchRoles();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save role';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/roles/${id}`);
      showToast('Role deleted successfully');
      setDeleteConfirm(null);
      fetchRoles();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to delete role';
      showToast(msg, 'error');
      setDeleteConfirm(null);
    }
  };

  const capLabel = (key) => ALL_CAPABILITIES.find((c) => c.key === key)?.label || key;

  if (loading) {
    return <div className="text-gray-500">Loading roles...</div>;
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
              Are you sure you want to delete the role <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
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
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {editingRole ? 'Edit Role' : 'Add Role'}
            </h3>

            {/* Role Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Role Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={editingRole?.is_system}
                placeholder="Enter role name"
                className={`w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                  editingRole?.is_system ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              {editingRole?.is_system && (
                <p className="text-xs text-gray-400 mt-1">System role names cannot be changed.</p>
              )}
            </div>

            {/* Capabilities */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Capabilities</label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-yellow-600 hover:text-yellow-700 font-medium"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ALL_CAPABILITIES.map((cap) => {
                  const checked = form.capabilities.includes(cap.key);
                  return (
                    <label
                      key={cap.key}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        checked
                          ? 'bg-yellow-50 border-yellow-400'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCapability(cap.key)}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                            checked
                              ? 'bg-yellow-500 border-yellow-500'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {checked && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-gray-700">{cap.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

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
                {saving ? 'Saving...' : editingRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Role Management</h2>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 transition-colors text-center"
        >
          + Add Role
        </button>
      </div>

      {/* Content */}
      {roles.length === 0 ? (
        <p className="text-gray-500">No roles found. Create your first role!</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {roles.map((role) => (
              <div key={role.id} className="bg-white rounded-lg shadow p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{role.name}</span>
                  {role.is_system && (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700">
                      System
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {(role.capabilities || []).map((cap) => (
                    <span
                      key={cap}
                      className="inline-block px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800"
                    >
                      {capLabel(cap)}
                    </span>
                  ))}
                  {(!role.capabilities || role.capabilities.length === 0) && (
                    <span className="text-xs text-gray-400">No capabilities</span>
                  )}
                </div>
                <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                  <button onClick={() => openEdit(role)} className="text-yellow-600 hover:text-yellow-700 text-sm">
                    Edit
                  </button>
                  {role.is_system ? (
                    <span className="text-gray-300 text-sm cursor-not-allowed">Delete</span>
                  ) : (
                    <button onClick={() => setDeleteConfirm(role)} className="text-red-500 hover:text-red-700 text-sm">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Role Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Capabilities</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className="font-medium">{role.name}</span>
                      {role.is_system && (
                        <span className="ml-2 inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-700">
                          System
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(role.capabilities || []).map((cap) => (
                          <span
                            key={cap}
                            className="inline-block px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800"
                          >
                            {capLabel(cap)}
                          </span>
                        ))}
                        {(!role.capabilities || role.capabilities.length === 0) && (
                          <span className="text-xs text-gray-400">No capabilities</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEdit(role)}
                        className="text-yellow-600 hover:text-yellow-700 text-sm mr-4"
                      >
                        Edit
                      </button>
                      {role.is_system ? (
                        <span className="text-gray-300 text-sm cursor-not-allowed">Delete</span>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(role)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      )}
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
