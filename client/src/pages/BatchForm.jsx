import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function BatchForm() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    product_id: '',
    batch_number: '',
    quantity_received: '',
    received_date: new Date().toISOString().split('T')[0],
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
  }, []);

  const validate = () => {
    const errs = {};
    if (!form.product_id) errs.product_id = 'Product is required';
    if (!form.batch_number.trim()) errs.batch_number = 'Batch number is required';
    if (!form.quantity_received || Number(form.quantity_received) < 1)
      errs.quantity_received = 'Quantity must be at least 1';
    if (!form.received_date) errs.received_date = 'Received date is required';
    return errs;
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/batches', {
        ...form,
        quantity_received: Number(form.quantity_received),
      });
      showToast('Batch created successfully');
      setTimeout(() => navigate('/batches'), 500);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create batch', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-800 mb-6">Add New Batch</h2>

      <form onSubmit={handleSubmit} className="max-w-lg bg-white p-6 rounded shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
          <select
            name="product_id"
            value={form.product_id}
            onChange={handleChange}
            className={`w-full border rounded px-3 py-2 ${errors.product_id ? 'border-red-500' : 'border-gray-300'}`}
          >
            <option value="">Select a product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.product_name} ({p.product_code})
              </option>
            ))}
          </select>
          {errors.product_id && <p className="text-red-500 text-sm mt-1">{errors.product_id}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number *</label>
          <input
            type="text"
            name="batch_number"
            value={form.batch_number}
            onChange={handleChange}
            className={`w-full border rounded px-3 py-2 ${errors.batch_number ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.batch_number && <p className="text-red-500 text-sm mt-1">{errors.batch_number}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
          <input
            type="number"
            name="quantity_received"
            value={form.quantity_received}
            onChange={handleChange}
            min="1"
            className={`w-full border rounded px-3 py-2 ${errors.quantity_received ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.quantity_received && <p className="text-red-500 text-sm mt-1">{errors.quantity_received}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Received Date *</label>
          <input
            type="date"
            name="received_date"
            value={form.received_date}
            onChange={handleChange}
            className={`w-full border rounded px-3 py-2 ${errors.received_date ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.received_date && <p className="text-red-500 text-sm mt-1">{errors.received_date}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Create Batch'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/batches')}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
