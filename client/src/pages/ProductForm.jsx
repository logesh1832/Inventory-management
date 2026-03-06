import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';

const UNIT_OPTIONS = ['Pieces', 'Kg', 'Liters', 'Meters', 'Boxes'];
const STATUS_OPTIONS = ['active', 'inactive'];

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    product_name: '',
    product_code: '',
    unit: 'Pieces',
    status: 'active',
  });
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      api.get(`/products/${id}`)
        .then(({ data }) => {
          setForm({
            product_name: data.product_name,
            product_code: data.product_code,
            unit: data.unit,
            status: data.status,
          });
        })
        .catch(() => showToast('Failed to load product', 'error'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const validate = () => {
    const newErrors = {};
    if (!form.product_name.trim()) newErrors.product_name = 'Product name is required';
    if (!form.product_code.trim()) newErrors.product_code = 'Product code is required';
    if (!form.unit) newErrors.unit = 'Unit is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/products/${id}`, {
          product_name: form.product_name,
          unit: form.unit,
          status: form.status,
        });
      } else {
        await api.post('/products', form);
      }
      navigate('/products');
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save product';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
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

      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        {isEdit ? 'Edit Product' : 'Add Product'}
      </h2>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-lg">
        {/* Product Name */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="product_name"
            value={form.product_name}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
              errors.product_name ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.product_name && (
            <p className="text-red-500 text-xs mt-1">{errors.product_name}</p>
          )}
        </div>

        {/* Product Code */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Code <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="product_code"
            value={form.product_code}
            onChange={handleChange}
            disabled={isEdit}
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
              isEdit ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
            } ${errors.product_code ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.product_code && (
            <p className="text-red-500 text-xs mt-1">{errors.product_code}</p>
          )}
          {isEdit && (
            <p className="text-gray-400 text-xs mt-1">Product code cannot be changed</p>
          )}
        </div>

        {/* Unit */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit <span className="text-red-500">*</span>
          </label>
          <select
            name="unit"
            value={form.unit}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
              errors.unit ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {/* Status (edit only) */}
        {isEdit && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
