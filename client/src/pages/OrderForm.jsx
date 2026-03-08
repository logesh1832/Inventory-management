import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  product_id: '',
  batch_id: '',
  quantity: '',
  batches: [], // available batches for the selected product
});

export default function OrderForm() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([emptyItem()]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
  }, []);

  // Fetch batches when product changes
  const handleProductChange = async (itemId, productId) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, product_id: productId, batch_id: '', batches: [] };
      })
    );

    if (!productId) return;

    try {
      const { data } = await api.get(`/batches/product/${productId}`);
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          return { ...item, batches: data.filter((b) => b.quantity_remaining > 0) };
        })
      );
    } catch {}
  };

  const updateItem = (itemId, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    );
    if (errors[itemId]) {
      setErrors((prev) => ({ ...prev, [itemId]: undefined }));
    }
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const removeItem = (itemId) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const validate = () => {
    const newErrors = {};
    if (!customerId) newErrors.customer = 'Customer is required';
    if (!orderDate) newErrors.date = 'Order date is required';

    items.forEach((item) => {
      const rowErrors = [];
      if (!item.product_id) rowErrors.push('Select a product');
      if (!item.quantity || Number(item.quantity) <= 0) rowErrors.push('Enter quantity');

      // Check if selected batch has enough stock (accounting for other items using same batch)
      if (item.batch_id && item.quantity) {
        const adjusted = getAdjustedBatches(item);
        const batch = adjusted.find((b) => b.id === item.batch_id);
        if (batch && Number(item.quantity) > batch.adjusted_remaining) {
          rowErrors.push(`Only ${batch.adjusted_remaining} available in batch ${batch.batch_number || ''} (${batch.quantity_remaining} total, ${batch.quantity_remaining - batch.adjusted_remaining} allocated to other items)`);
        }
      }

      if (rowErrors.length > 0) newErrors[item.id] = rowErrors.join(', ');
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await api.post('/orders', {
        customer_id: customerId,
        order_date: orderDate,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          batch_id: item.batch_id || null,
        })),
      });

      showToast('Order created successfully');
      setTimeout(() => navigate('/orders'), 600);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Compute how much of a batch is already allocated by OTHER items
  const getAllocatedForBatch = (batchId, excludeItemId) => {
    return items
      .filter((i) => i.id !== excludeItemId && i.batch_id === batchId && i.quantity)
      .reduce((sum, i) => sum + Number(i.quantity), 0);
  };

  // Get adjusted batches for an item (remaining minus what others allocated)
  const getAdjustedBatches = (item) => {
    return item.batches.map((b) => ({
      ...b,
      adjusted_remaining: b.quantity_remaining - getAllocatedForBatch(b.id, item.id),
    }));
  };

  // Compute total stock per product for display
  const getProductStock = (productId) => {
    const item = items.find((i) => i.product_id === productId);
    if (!item) return 0;
    return item.batches.reduce((sum, b) => sum + b.quantity_remaining, 0);
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Create New Order</h2>
        <button onClick={() => navigate('/orders')} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to Orders
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Top Section: Customer + Date */}
        <div className="bg-white rounded-lg shadow p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={customers.map((c) => ({ value: c.id, label: c.customer_name }))}
                value={customerId}
                onChange={(val) => { setCustomerId(val); setErrors((p) => ({ ...p, customer: undefined })); }}
                placeholder="Select customer..."
                error={!!errors.customer}
              />
              {errors.customer && <p className="text-red-500 text-xs mt-1">{errors.customer}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => { setOrderDate(e.target.value); setErrors((p) => ({ ...p, date: undefined })); }}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 ${errors.date ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Order Items</h3>
            <button
              type="button"
              onClick={addItem}
              className="text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded font-medium transition-colors"
            >
              + Add Item
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <div key={item.id} className={`px-5 py-4 ${errors[item.id] ? 'bg-red-50' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400">ITEM {idx + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-400 hover:text-red-600 transition-colors text-xs flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  )}
                </div>

                {/* Product + Quantity */}
                <div className="grid grid-cols-12 gap-3 mb-3">
                  <div className="col-span-8">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Product <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      options={products.map((p) => ({ value: p.id, label: `${p.product_name} (${p.product_code})` }))}
                      value={item.product_id}
                      onChange={(val) => handleProductChange(item.id, val)}
                      placeholder="Select product..."
                    />
                    {item.product_id && (
                      <p className="text-xs text-gray-400 mt-1">
                        Total available: <span className="font-medium text-gray-600">{getProductStock(item.product_id)}</span>
                      </p>
                    )}
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quantity <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    />
                  </div>
                </div>

                {/* Batch Selection (only if product has named batches) */}
                {(() => {
                  const adjusted = getAdjustedBatches(item).filter((b) => b.batch_number);
                  const available = adjusted.filter((b) => b.adjusted_remaining > 0 || b.id === item.batch_id);
                  if (available.length === 0) return null;
                  return (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Batch <span className="text-gray-400">(optional — leave blank for FIFO)</span>
                      </label>
                      <SearchableSelect
                        options={available.map((b) => ({
                          value: b.id,
                          label: `${b.batch_number} — Remaining: ${b.adjusted_remaining}${b.adjusted_remaining < b.quantity_remaining ? ' (adjusted)' : ''}`,
                          sublabel: [
                            b.manufacture_date ? `Mfg: ${new Date(b.manufacture_date).toLocaleDateString()}` : '',
                            b.expiry_date ? `Exp: ${new Date(b.expiry_date).toLocaleDateString()}` : '',
                          ].filter(Boolean).join(' | ') || undefined,
                          disabled: b.adjusted_remaining <= 0,
                        }))}
                        value={item.batch_id}
                        onChange={(val) => updateItem(item.id, 'batch_id', val)}
                        placeholder="Auto (FIFO) — or select a batch..."
                      />
                    </div>
                  );
                })()}

                {/* Selected batch info */}
                {item.batch_id && (() => {
                  const adjusted = getAdjustedBatches(item);
                  const batch = adjusted.find((b) => b.id === item.batch_id);
                  if (!batch) return null;
                  const isExpired = batch.expiry_date && new Date(batch.expiry_date) < new Date();
                  const overAllocated = item.quantity && Number(item.quantity) > batch.adjusted_remaining;
                  return (
                    <div className={`mt-2 text-xs flex items-center gap-3 px-3 py-1.5 rounded ${isExpired || overAllocated ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                      <span>Batch: <strong>{batch.batch_number}</strong></span>
                      <span>Available: <strong>{batch.adjusted_remaining}</strong></span>
                      {batch.manufacture_date && <span>Mfg: {new Date(batch.manufacture_date).toLocaleDateString()}</span>}
                      {batch.expiry_date && (
                        <span className={isExpired ? 'font-semibold' : ''}>
                          Exp: {new Date(batch.expiry_date).toLocaleDateString()}
                          {isExpired && ' (EXPIRED)'}
                        </span>
                      )}
                      {overAllocated && <span className="font-semibold">Exceeds available!</span>}
                    </div>
                  );
                })()}

                {/* Error */}
                {errors[item.id] && (
                  <p className="text-red-600 text-xs mt-2">{errors[item.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-5 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">{items.length}</span> item{items.length > 1 ? 's' : ''} &middot;{' '}
            <span className="font-medium text-gray-700">
              {items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)}
            </span> total qty
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
