import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Pagination from '../components/Pagination';

export default function Categories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ category_name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  const canModify = user && (user.role === 'admin' || user.capabilities?.includes('categories'));

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCategories = useCallback(async (pg, lim, srch) => {
    try {
      setLoading(true);
      const params = { page: pg, limit: lim };
      if (srch) params.search = srch;
      const { data } = await api.get('/categories', { params });
      setCategories(data.data);
      setTotal(data.total);
    } catch {
      showToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories(1, limit, '');
  }, []);

  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
    fetchCategories(1, limit, val);
  };

  const handlePageChange = (pg) => {
    setPage(pg);
    fetchCategories(pg, limit, search);
  };

  const handleLimitChange = (lim) => {
    setLimit(lim);
    setPage(1);
    fetchCategories(1, lim, search);
  };

  const resetForm = () => {
    setForm({ category_name: '', description: '' });
    setEditingId(null);
    setShowForm(false);
    setErrors({});
  };

  const handleEdit = (cat) => {
    setForm({ category_name: cat.category_name, description: cat.description || '' });
    setEditingId(cat.id);
    setShowForm(true);
    setErrors({});
  };

  const validate = () => {
    const newErrors = {};
    if (!form.category_name.trim()) newErrors.category_name = 'Category name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/categories/${editingId}`, {
          category_name: form.category_name,
          description: form.description || null,
        });
        showToast('Category updated successfully');
      } else {
        await api.post('/categories', {
          category_name: form.category_name,
          description: form.description || null,
        });
        showToast('Category created successfully');
      }
      resetForm();
      fetchCategories(page, limit, search);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || 'Failed to save category';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/categories/${id}`);
      showToast('Category deleted successfully');
      setDeleteConfirm(null);
      fetchCategories(page, limit, search);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || 'Failed to delete category';
      showToast(msg, 'error');
      setDeleteConfirm(null);
    }
  };

  const handleToggleActive = async (cat) => {
    try {
      await api.put(`/categories/${cat.id}`, { is_active: !cat.is_active });
      showToast(`Category ${cat.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchCategories(page, limit, search);
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.response?.data?.error || 'Failed to update category';
      showToast(msg, 'error');
    }
  };

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
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.category_name}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Categories</h2>
        {canModify && !showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 bg-yellow-500 text-gray-900 font-semibold rounded hover:bg-yellow-400 transition-colors"
          >
            + Add Category
          </button>
        )}
      </div>

      {/* Inline Form */}
      {showForm && canModify && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 mb-6 max-w-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {editingId ? 'Edit Category' : 'New Category'}
          </h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.category_name}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, category_name: e.target.value }));
                if (errors.category_name) setErrors((prev) => ({ ...prev, category_name: undefined }));
              }}
              className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 ${errors.category_name ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.category_name && <p className="text-red-500 text-xs mt-1">{errors.category_name}</p>}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-yellow-500 text-gray-900 font-semibold rounded hover:bg-yellow-400 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : editingId ? 'Update Category' : 'Create Category'}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search categories..."
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-gray-500 py-8 text-center">Loading categories...</div>
      ) : categories.length === 0 ? (
        <p className="text-gray-500 py-8 text-center">No categories found.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white rounded-lg shadow p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{cat.category_name}</span>
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {cat.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Description:</span> {cat.description || '-'}
                </div>
                {canModify && (
                  <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                    <button onClick={() => handleEdit(cat)} className="text-yellow-600 hover:text-yellow-700 text-sm">Edit</button>
                    <button onClick={() => handleToggleActive(cat)} className="text-blue-500 hover:text-blue-700 text-sm">
                      {cat.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => setDeleteConfirm(cat)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  {canModify && (
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{cat.category_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{cat.description || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canModify && (
                      <td className="px-6 py-4 text-right space-x-4">
                        <button onClick={() => handleEdit(cat)} className="text-yellow-600 hover:text-yellow-700 text-sm">Edit</button>
                        <button onClick={() => handleToggleActive(cat)} className="text-blue-500 hover:text-blue-700 text-sm">
                          {cat.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => setDeleteConfirm(cat)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            total={total}
            limit={limit}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        </>
      )}
    </div>
  );
}
