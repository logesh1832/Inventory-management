import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api, { getFileUrl } from '../services/api';
import SearchableSelect from '../components/SearchableSelect';

const STATUS_OPTIONS = ['active', 'inactive'];

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    product_name: '',
    product_code: '',
    unit: '',
    sub_unit: '',
    status: 'active',
    category: '',
    batch_tracking: false,
    qty_per_box: '',
    low_stock_threshold: '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [unitOptions, setUnitOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    api.get('/products/categories')
      .then(({ data }) => setCategoryOptions(data))
      .catch(() => {});
    api.get('/units')
      .then(({ data }) => setUnitOptions(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (isEdit) {
      api.get(`/products/${id}`)
        .then(({ data }) => {
          setForm({
            product_name: data.product_name,
            product_code: data.product_code,
            unit: data.unit,
            sub_unit: data.sub_unit || '',
            status: data.status,
            category: data.category || '',
            batch_tracking: data.batch_tracking || false,
            qty_per_box: data.qty_per_box || '',
            low_stock_threshold: data.low_stock_threshold || '',
          });
          if (data.image_url) setImagePreview(getFileUrl(data.image_url));
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
    if (!form.unit) newErrors.unit = 'Unit is required';
    if (form.sub_unit && (!form.qty_per_box || Number(form.qty_per_box) <= 0)) {
      newErrors.qty_per_box = `Qty per ${form.sub_unit} is required when sub unit is set`;
    }
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('product_name', form.product_name);
      formData.append('product_code', form.product_code);
      formData.append('unit', form.unit);
      formData.append('sub_unit', form.sub_unit || '');
      formData.append('category', form.category);
      formData.append('batch_tracking', form.batch_tracking);
      formData.append('qty_per_box', form.sub_unit ? form.qty_per_box || '' : '');
      formData.append('low_stock_threshold', form.low_stock_threshold || '50');
      if (imageFile) formData.append('image', imageFile);

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (isEdit) {
        formData.append('status', form.status);
        await api.put(`/products/${id}`, formData, config);
      } else {
        await api.post('/products', formData, config);
      }
      navigate('/products');
    } catch (err) {
      const msg = (err.response?.data?.error?.message || err.response?.data?.error) || 'Failed to save product';
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
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
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
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 ${errors.product_name ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.product_name && <p className="text-red-500 text-xs mt-1">{errors.product_name}</p>}
        </div>

        {/* Category */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <SearchableSelect
            options={categoryOptions.map((c) => ({ value: c, label: c }))}
            value={form.category}
            onChange={(val) => setForm((prev) => ({ ...prev, category: val }))}
            placeholder="Select Category"
          />
        </div>

        {/* Product Image */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
          {imagePreview ? (
            <div className="relative inline-block">
              <img
                src={imagePreview}
                alt="Product preview"
                className="h-32 w-32 object-cover rounded border border-gray-300"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 shadow"
              >
                &times;
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-yellow-500 hover:bg-gray-50 transition-colors">
              <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-500">Click to upload product image</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
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
            onChange={(e) => {
              handleChange(e);
              // clear sub_unit if same as new unit
              if (e.target.value === form.sub_unit) setForm((p) => ({ ...p, sub_unit: '', qty_per_box: '' }));
            }}
            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 ${errors.unit ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">Select Unit</option>
            {unitOptions.map((u) => (
              <option key={u.id} value={u.name}>{u.name}</option>
            ))}
          </select>
          {errors.unit && <p className="text-red-500 text-xs mt-1">{errors.unit}</p>}
        </div>

        {/* Sub Unit (optional) */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Sub Unit <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
          <select
            name="sub_unit"
            value={form.sub_unit}
            onChange={(e) => {
              handleChange(e);
              if (!e.target.value) setForm((p) => ({ ...p, sub_unit: '', qty_per_box: '' }));
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
          >
            <option value="">None</option>
            {unitOptions.filter((u) => u.name !== form.unit).map((u) => (
              <option key={u.id} value={u.name}>{u.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Set if this unit contains a smaller unit (e.g. Box → Piece)</p>
        </div>

        {/* Qty per unit (only when sub unit is selected) */}
        {form.sub_unit && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              How many <strong>{form.sub_unit}</strong> in 1 <strong>{form.unit || 'unit'}</strong>? <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="qty_per_box"
              value={form.qty_per_box}
              onChange={handleChange}
              min="1"
              placeholder="e.g. 120"
              className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 ${errors.qty_per_box ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.qty_per_box && <p className="text-red-500 text-xs mt-1">{errors.qty_per_box}</p>}
          </div>
        )}

        {/* Low Stock Threshold */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
          <input
            type="number"
            name="low_stock_threshold"
            value={form.low_stock_threshold}
            onChange={handleChange}
            min="0"
            placeholder="50"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <p className="text-xs text-gray-400 mt-1">Alert when stock falls below this number</p>
        </div>

        {/* Batch Tracking Toggle */}
        <div className="mb-4 border-t border-gray-100 pt-4">
          <div
            className="flex items-center gap-4 cursor-pointer"
            onClick={() => setForm((prev) => ({ ...prev, batch_tracking: !prev.batch_tracking }))}
          >
            <div
              className="relative flex-shrink-0"
              style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: form.batch_tracking ? '#EAB308' : '#D1D5DB', transition: 'background-color 0.2s' }}
            >
              <div
                style={{
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  position: 'absolute', top: 2,
                  left: form.batch_tracking ? 22 : 2,
                  transition: 'left 0.2s',
                }}
              />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Batch Tracking</span>
              <p className="text-xs text-gray-400">Enable to track manufacture date, expiry date, and batch numbers</p>
            </div>
          </div>
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
