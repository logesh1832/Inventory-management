import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function OrderForm() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockMap, setStockMap] = useState({});
  const [customerId, setCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([{ product_id: '', quantity: '' }]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
    api.get('/batches').then((res) => {
      const map = {};
      for (const b of res.data) {
        map[b.product_id] = (map[b.product_id] || 0) + b.quantity_remaining;
      }
      setStockMap(map);
    }).catch(() => {});
  }, []);

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: '' }]);
  };

  const removeItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setItems(updated);
    setErrors({ ...errors, [`item_${index}_${field}`]: '' });
  };

  const validate = () => {
    const errs = {};
    if (!customerId) errs.customer_id = 'Customer is required';
    if (!orderDate) errs.order_date = 'Order date is required';

    // Aggregate quantities per product for stock check
    const aggregated = {};
    items.forEach((item, i) => {
      if (!item.product_id) errs[`item_${i}_product_id`] = 'Product is required';
      if (!item.quantity || Number(item.quantity) <= 0) errs[`item_${i}_quantity`] = 'Quantity must be > 0';

      if (item.product_id && item.quantity) {
        aggregated[item.product_id] = (aggregated[item.product_id] || 0) + Number(item.quantity);
      }
    });

    // Check stock sufficiency
    for (const [productId, totalQty] of Object.entries(aggregated)) {
      const available = stockMap[productId] || 0;
      if (totalQty > available) {
        const product = products.find((p) => p.id === productId);
        errs.stock = `Insufficient stock for ${product?.product_name || productId}. Available: ${available}, Requested: ${totalQty}`;
        break;
      }
    }

    return errs;
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
      await api.post('/orders', {
        customer_id: customerId,
        order_date: orderDate,
        items: items.map((item) => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
        })),
      });
      showToast('Order created successfully');
      setTimeout(() => navigate('/orders'), 500);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create order', 'error');
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

      <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Order</h2>

      <form onSubmit={handleSubmit} className="max-w-3xl bg-white p-6 rounded shadow space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
            <select
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setErrors({ ...errors, customer_id: '' });
              }}
              className={`w-full border rounded px-3 py-2 ${errors.customer_id ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select a customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_name}
                </option>
              ))}
            </select>
            {errors.customer_id && <p className="text-red-500 text-sm mt-1">{errors.customer_id}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Date *</label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => {
                setOrderDate(e.target.value);
                setErrors({ ...errors, order_date: '' });
              }}
              className={`w-full border rounded px-3 py-2 ${errors.order_date ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.order_date && <p className="text-red-500 text-sm mt-1">{errors.order_date}</p>}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Order Items *</label>
            <button
              type="button"
              onClick={addItem}
              className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
            >
              + Add Item
            </button>
          </div>

          {errors.stock && (
            <p className="text-red-500 text-sm mb-2">{errors.stock}</p>
          )}

          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <select
                    value={item.product_id}
                    onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                    className={`w-full border rounded px-3 py-2 ${
                      errors[`item_${index}_product_id`] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.product_name} ({p.product_code})
                      </option>
                    ))}
                  </select>
                  {errors[`item_${index}_product_id`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_product_id`]}</p>
                  )}
                  {item.product_id && (
                    <p className="text-xs text-gray-500 mt-1">
                      Available: {stockMap[item.product_id] || 0}
                    </p>
                  )}
                </div>
                <div className="w-32">
                  <input
                    type="number"
                    placeholder="Qty"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                    className={`w-full border rounded px-3 py-2 ${
                      errors[`item_${index}_quantity`] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors[`item_${index}_quantity`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`item_${index}_quantity`]}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="mt-1 text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Order'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
