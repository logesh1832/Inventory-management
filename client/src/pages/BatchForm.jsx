import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';

const emptyRow = () => ({
  id: Date.now() + Math.random(),
  product_id: '',
  mode: 'new', // 'new' or 'existing'
  existing_batch_id: '',
  new_batch_number: '',
  quantity: '',
  manufacture_date: '',
  expiry_date: '',
  productBatches: [],
  batch_tracking: false,
});

export default function BatchForm() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
    api.get('/customers').then((res) => setSuppliers(res.data)).catch(() => {});
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleProductChange = async (rowId, productId) => {
    const product = products.find((p) => p.id === productId);
    const hasBatchTracking = product?.batch_tracking || false;

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          product_id: productId,
          existing_batch_id: '',
          productBatches: [],
          batch_tracking: hasBatchTracking,
          manufacture_date: '',
          expiry_date: '',
        };
      })
    );

    if (!productId) return;

    try {
      const { data } = await api.get(`/batches/product/${productId}`);
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          return { ...r, productBatches: data };
        })
      );
    } catch {}
  };

  const updateRow = (rowId, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, [field]: value };
        if (field === 'mode') {
          if (value === 'new') updated.existing_batch_id = '';
          else updated.new_batch_number = '';
        }
        return updated;
      })
    );
    if (errors[rowId]) {
      setErrors((prev) => ({ ...prev, [rowId]: undefined }));
    }
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (rowId) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const validate = () => {
    const newErrors = {};
    if (!supplierId) newErrors.supplier = 'Supplier is required';
    if (!receivedDate) newErrors.date = 'Date is required';

    rows.forEach((row) => {
      const rowErrors = [];
      if (!row.product_id) rowErrors.push('Select a product');
      if (!row.quantity || Number(row.quantity) <= 0) rowErrors.push('Enter quantity');
      if (row.mode === 'existing' && !row.existing_batch_id) rowErrors.push('Select a batch');
      // batch number is optional for new — will be auto-generated
      if (rowErrors.length > 0) newErrors[row.id] = rowErrors.join(', ');
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const items = rows.map((r) => ({
        product_id: r.product_id,
        quantity: Number(r.quantity),
        existing_batch_id: r.mode === 'existing' ? r.existing_batch_id : null,
        new_batch_number: r.mode === 'new' && r.new_batch_number.trim() ? r.new_batch_number.trim() : null,
        manufacture_date: r.batch_tracking && r.manufacture_date ? r.manufacture_date : null,
        expiry_date: r.batch_tracking && r.expiry_date ? r.expiry_date : null,
      }));

      await api.post('/batches/bulk', {
        supplier_id: supplierId,
        received_date: receivedDate,
        items,
      });

      showToast(`${items.length} batch(es) saved successfully`);
      setTimeout(() => navigate('/batches'), 600);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save batches', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Stock Entry</h2>
        <button onClick={() => navigate('/batches')} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to Batches
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Top Section: Supplier + Date */}
        <div className="bg-white rounded-lg shadow p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={suppliers.map((s) => ({ value: s.id, label: s.customer_name }))}
                value={supplierId}
                onChange={(val) => { setSupplierId(val); setErrors((p) => ({ ...p, supplier: undefined })); }}
                placeholder="Select supplier..."
                error={!!errors.supplier}
              />
              {errors.supplier && <p className="text-red-500 text-xs mt-1">{errors.supplier}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Received Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => { setReceivedDate(e.target.value); setErrors((p) => ({ ...p, date: undefined })); }}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 ${errors.date ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Items</h3>
            <button
              type="button"
              onClick={addRow}
              className="text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded font-medium transition-colors"
            >
              + Add Row
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {rows.map((row, idx) => (
              <div key={row.id} className={`px-5 py-4 ${errors[row.id] ? 'bg-red-50' : ''}`}>
                {/* Row header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400">ITEM {idx + 1}</span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="text-red-400 hover:text-red-600 transition-colors text-xs flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  )}
                </div>

                {/* Row 1: Product + Quantity */}
                <div className="grid grid-cols-12 gap-3 mb-3">
                  <div className="col-span-8">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Product <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      options={products.map((p) => ({ value: p.id, label: `${p.product_name} (${p.product_code})${p.batch_tracking ? ' [BT]' : ''}` }))}
                      value={row.product_id}
                      onChange={(val) => handleProductChange(row.id, val)}
                      placeholder="Select product..."
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quantity <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    />
                  </div>
                </div>

                {/* Row 2: Batch selection (only for batch-tracked products) */}
                {row.batch_tracking && (
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Batch</label>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 rounded text-xs overflow-hidden flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => updateRow(row.id, 'mode', 'existing')}
                        className={`px-2.5 py-1 transition-colors ${row.mode === 'existing' ? 'bg-yellow-500 text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        Existing
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRow(row.id, 'mode', 'new')}
                        className={`px-2.5 py-1 transition-colors ${row.mode === 'new' ? 'bg-yellow-500 text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        New
                      </button>
                    </div>

                    {row.mode === 'existing' ? (
                      <div className="flex-1">
                        <SearchableSelect
                          options={row.productBatches.filter((b) => b.batch_number).map((b) => ({
                            value: b.id,
                            label: `${b.batch_number} (Remaining: ${b.quantity_remaining})`,
                          }))}
                          value={row.existing_batch_id}
                          onChange={(val) => updateRow(row.id, 'existing_batch_id', val)}
                          placeholder={!row.product_id ? 'Select product first' : row.productBatches.length === 0 ? 'No existing batches' : 'Select batch...'}
                          disabled={!row.product_id || row.productBatches.filter((b) => b.batch_number).length === 0}
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Enter batch number"
                        value={row.new_batch_number}
                        onChange={(e) => updateRow(row.id, 'new_batch_number', e.target.value)}
                        className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      />
                    )}
                  </div>
                </div>
                )}

                {/* Row 3: Mfg Date + Expiry Date (only when batch_tracking is ON for this product) */}
                {row.batch_tracking && row.mode === 'new' && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded border border-blue-100">
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Manufacture Date</label>
                      <input
                        type="date"
                        value={row.manufacture_date}
                        onChange={(e) => updateRow(row.id, 'manufacture_date', e.target.value)}
                        className="w-full border border-blue-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Expiry Date</label>
                      <input
                        type="date"
                        value={row.expiry_date}
                        onChange={(e) => updateRow(row.id, 'expiry_date', e.target.value)}
                        className="w-full border border-blue-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Error */}
                {errors[row.id] && (
                  <p className="text-red-600 text-xs mt-2">{errors[row.id]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Summary + Actions */}
        <div className="bg-white rounded-lg shadow p-5 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">{rows.length}</span> item{rows.length > 1 ? 's' : ''} &middot;{' '}
            <span className="font-medium text-gray-700">
              {rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)}
            </span> total qty
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/batches')}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save All Batches'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
