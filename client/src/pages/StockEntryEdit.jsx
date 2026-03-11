import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';

const toDateStr = (v) => {
  if (!v) return '';
  const d = new Date(v);
  return isNaN(d) ? '' : d.toISOString().split('T')[0];
};

const focusProduct = (rowId) => {
  setTimeout(() => {
    const el = document.querySelector(`[data-row-product="${rowId}"] button`);
    if (el) el.focus();
  }, 50);
};

const focusBatchToggle = (rowId) => {
  setTimeout(() => {
    const el = document.querySelector(`[data-batch-toggle="${rowId}"]`);
    if (el) el.focus();
  }, 50);
};

const focusBatchInput = (rowId) => {
  setTimeout(() => {
    const el = document.querySelector(`[data-batch-input="${rowId}"]`);
    if (el) {
      const btn = el.querySelector('button');
      if (btn) { btn.focus(); btn.click(); } else el.focus();
    }
  }, 50);
};

const focusMfd = (rowId) => {
  setTimeout(() => {
    const el = document.querySelector(`[data-mfd="${rowId}"]`);
    if (el) el.focus();
  }, 50);
};

const focusExpiry = (rowId) => {
  setTimeout(() => {
    const el = document.querySelector(`[data-expiry="${rowId}"]`);
    if (el) el.focus();
  }, 50);
};

export default function StockEntryEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});

  // Header fields
  const [supplierId, setSupplierId] = useState('');
  const [receivedDate, setReceivedDate] = useState('');

  // Rows: each is an existing stock entry
  const [rows, setRows] = useState([]);

  const formRef = useRef(null);
  const qtyRefs = useRef({});

  useEffect(() => {
    Promise.all([
      api.get('/customers'),
      api.get('/products'),
    ]).then(([suppRes, prodRes]) => {
      setSuppliers(suppRes.data);
      setProducts(prodRes.data);
    }).catch(() => {});

    loadSiblings();
  }, [id]);

  const loadSiblings = async () => {
    try {
      const res = await api.get(`/batches/stock-entries/${id}/siblings`);
      const entries = res.data;
      if (entries.length === 0) {
        setLoading(false);
        return;
      }

      // Set header from first entry
      setSupplierId(entries[0].supplier_id || '');
      setReceivedDate(toDateStr(entries[0].received_date));

      // Build rows — fetch batches for each entry
      const rowsData = [];
      for (const e of entries) {
        let productBatches = [];
        if (e.batch_tracking && e.product_id) {
          try {
            const { data } = await api.get(`/batches/product/${e.product_id}`);
            productBatches = data.filter((b) => b.batch_number && b.id !== e.batch_id);
          } catch {}
        }

        rowsData.push({
          id: e.id,                    // stock_movement id
          product_id: e.product_id,
          product_name: e.product_name,
          product_code: e.product_code,
          batch_tracking: e.batch_tracking,
          batch_id: e.batch_id,
          quantity: String(e.quantity),
          batchMode: 'current',        // 'current' | 'existing' | 'new'
          existing_batch_id: '',
          batch_number: e.batch_number || '',
          manufacture_date: toDateStr(e.manufacture_date),
          expiry_date: toDateStr(e.expiry_date),
          productBatches,
        });
      }

      setRows(rowsData);
    } catch {
      setToast({ message: 'Failed to load stock entries', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const updateRow = (rowId, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const updated = { ...r, [field]: value };
        if (field === 'batchMode') {
          if (value !== 'existing') updated.existing_batch_id = '';
        }
        return updated;
      })
    );
    if (errors[rowId]) {
      setErrors((prev) => ({ ...prev, [rowId]: undefined }));
    }
  };

  const handleProductChange = async (rowId, productId) => {
    const product = products.find((p) => p.id === productId);
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          product_id: productId,
          product_name: product?.product_name || '',
          product_code: product?.product_code || '',
          batch_tracking: product?.batch_tracking || false,
          batchMode: 'current',
          existing_batch_id: '',
          batch_number: '',
          manufacture_date: '',
          expiry_date: '',
          productBatches: [],
        };
      })
    );

    if (!productId) return;

    if (product?.batch_tracking) {
      try {
        const { data } = await api.get(`/batches/product/${productId}`);
        setRows((prev) =>
          prev.map((r) => {
            if (r.id !== rowId) return r;
            return { ...r, productBatches: data.filter((b) => b.batch_number && b.id !== r.batch_id) };
          })
        );
      } catch {}
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!supplierId) newErrors.supplier = 'Supplier is required';
    if (!receivedDate) newErrors.date = 'Date is required';

    rows.forEach((row) => {
      const rowErrors = [];
      if (!row.product_id) rowErrors.push('Select a product');
      if (!row.quantity || Number(row.quantity) <= 0) rowErrors.push('Enter quantity');
      if (row.batchMode === 'existing' && !row.existing_batch_id) rowErrors.push('Select a batch');
      if (rowErrors.length > 0) newErrors[row.id] = rowErrors.join(', ');
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      // Update each entry individually
      for (const row of rows) {
        const payload = {
          product_id: row.product_id,
          quantity: Number(row.quantity),
          supplier_id: supplierId || null,
          received_date: receivedDate || null,
        };

        if (row.batchMode === 'existing') {
          payload.move_to_batch_id = row.existing_batch_id;
        } else {
          payload.batch_number = row.batch_number || null;
          payload.manufacture_date = row.manufacture_date || null;
          payload.expiry_date = row.expiry_date || null;
        }

        await api.put(`/batches/stock-entries/${row.id}`, payload);
      }

      showToast(`${rows.length} entry(s) updated successfully`);
      setTimeout(() => navigate('/batches'), 600);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Keyboard: Shift+Enter = save from anywhere
  useEffect(() => {
    const handleKey = (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Qty → Enter: if batch_tracking go to batch toggle, else next row's qty
  const handleQtyKeyDown = (e, row) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) { formRef.current?.requestSubmit(); return; }
      if (row.batch_tracking) {
        focusBatchToggle(row.id);
      } else {
        focusNextRowQty(row.id);
      }
    }
  };

  const focusNextRowQty = (rowId) => {
    const idx = rows.findIndex((r) => r.id === rowId);
    if (idx < rows.length - 1) {
      const next = rows[idx + 1];
      setTimeout(() => qtyRefs.current[next.id]?.focus(), 50);
    }
  };

  const handleBatchToggleKeyDown = (e, row) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const modes = ['current'];
      if (row.productBatches.length > 0) modes.push('existing');
      modes.push('new');
      const idx = modes.indexOf(row.batchMode);
      const next = modes[(idx + 1) % modes.length];
      updateRow(row.id, 'batchMode', next);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) { formRef.current?.requestSubmit(); return; }
      if (row.batchMode === 'existing') {
        focusBatchInput(row.id);
      } else {
        const el = document.querySelector(`[data-batch-input="${row.id}"]`);
        if (el) el.focus();
      }
    }
  };

  const handleBatchNumberKeyDown = (e, row) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) { formRef.current?.requestSubmit(); return; }
      focusMfd(row.id);
    }
  };

  const handleMfdKeyDown = (e, row) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) { formRef.current?.requestSubmit(); return; }
      focusExpiry(row.id);
    }
  };

  const handleExpiryKeyDown = (e, row) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) { formRef.current?.requestSubmit(); return; }
      focusNextRowQty(row.id);
    }
  };

  const handleDateKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rows.length > 0) {
        setTimeout(() => qtyRefs.current[rows[0].id]?.focus(), 50);
      }
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (rows.length === 0) return <p className="text-red-500">No stock entries found.</p>;

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Edit Stock Entry</h2>
        <button onClick={() => navigate('/batches')} tabIndex={-1} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to Material In
        </button>
      </div>

      {/* Keyboard shortcut hints */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-400">
        <span className="bg-gray-100 px-2 py-1 rounded"><kbd className="font-mono font-semibold text-gray-500">Enter</kbd> next field</span>
        <span className="bg-gray-100 px-2 py-1 rounded"><kbd className="font-mono font-semibold text-gray-500">Tab</kbd> switch batch mode</span>
        <span className="bg-gray-100 px-2 py-1 rounded"><kbd className="font-mono font-semibold text-gray-500">Shift+Enter</kbd> save all</span>
      </div>

      <form ref={formRef} onSubmit={handleSubmit}>
        {/* Top Section: Supplier + Date */}
        <div className="bg-white rounded-lg shadow p-5 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Received Date</label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => { setReceivedDate(e.target.value); setErrors((p) => ({ ...p, date: undefined })); }}
                onKeyDown={handleDateKeyDown}
                className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 ${errors.date ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Items ({rows.length})</h3>
          </div>

          <div className="divide-y divide-gray-100">
            {rows.map((row, idx) => (
              <div key={row.id} className={`px-5 py-4 ${errors[row.id] ? 'bg-red-50' : ''}`}>
                {/* Row header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-400">ITEM {idx + 1}</span>
                </div>

                {/* Product + Quantity */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3">
                  <div className="sm:col-span-8" data-row-product={row.id}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Product <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      options={products.map((p) => ({ value: p.id, label: `${p.product_name} (${p.product_code})${p.batch_tracking ? ' [BT]' : ''}` }))}
                      value={row.product_id}
                      onChange={(val) => handleProductChange(row.id, val)}
                      placeholder="Select product..."
                      autoFocusNext={{ current: qtyRefs.current[row.id] }}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quantity <span className="text-red-500">*</span></label>
                    <input
                      ref={(el) => (qtyRefs.current[row.id] = el)}
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                      onKeyDown={(e) => handleQtyKeyDown(e, row)}
                      autoFocus={idx === 0}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                    />
                    {(() => {
                      const prod = products.find((p) => p.id === row.product_id);
                      if (prod && prod.unit === 'Boxes' && prod.qty_per_box && row.quantity) {
                        const total = Number(row.quantity) * prod.qty_per_box;
                        return (
                          <p className="text-xs text-blue-600 font-medium mt-1">
                            {row.quantity} x {prod.qty_per_box} = {total} pcs
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* Batch section (only if batch tracked) */}
                {row.batch_tracking && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Batch</label>
                    <div className="space-y-3">
                      {/* Toggle */}
                      <div
                        data-batch-toggle={row.id}
                        tabIndex={0}
                        onKeyDown={(e) => handleBatchToggleKeyDown(e, row)}
                        className="flex bg-gray-100 rounded text-xs overflow-hidden w-fit focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      >
                        <span className={`px-3 py-1.5 transition-colors cursor-default ${row.batchMode === 'current' ? 'bg-yellow-500 text-gray-900 font-semibold' : 'text-gray-500'}`}>
                          Current Batch
                        </span>
                        {row.productBatches.length > 0 && (
                          <span className={`px-3 py-1.5 transition-colors cursor-default ${row.batchMode === 'existing' ? 'bg-yellow-500 text-gray-900 font-semibold' : 'text-gray-500'}`}>
                            Move to Existing
                          </span>
                        )}
                        <span className={`px-3 py-1.5 transition-colors cursor-default ${row.batchMode === 'new' ? 'bg-yellow-500 text-gray-900 font-semibold' : 'text-gray-500'}`}>
                          New Batch
                        </span>
                      </div>

                      {/* Batch input based on mode */}
                      {row.batchMode === 'existing' ? (
                        <div data-batch-input={row.id}>
                          <SearchableSelect
                            options={row.productBatches.map((b) => ({
                              value: b.id,
                              label: `${b.batch_number} (Remaining: ${b.quantity_remaining})`,
                            }))}
                            value={row.existing_batch_id}
                            onChange={(val) => updateRow(row.id, 'existing_batch_id', val)}
                            placeholder="Select existing batch..."
                            onEnterAfterSelect={() => focusNextRowQty(row.id)}
                          />
                        </div>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Batch Number</label>
                            <input
                              data-batch-input={row.id}
                              type="text"
                              value={row.batch_number}
                              onChange={(e) => updateRow(row.id, 'batch_number', e.target.value)}
                              onKeyDown={(e) => handleBatchNumberKeyDown(e, row)}
                              className="w-full sm:w-64 border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded border border-blue-100">
                            <div>
                              <label className="block text-xs font-medium text-blue-700 mb-1">Manufacture Date</label>
                              <input
                                data-mfd={row.id}
                                type="date"
                                value={row.manufacture_date}
                                onChange={(e) => updateRow(row.id, 'manufacture_date', e.target.value)}
                                onKeyDown={(e) => handleMfdKeyDown(e, row)}
                                className="w-full border border-blue-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-blue-700 mb-1">Expiry Date</label>
                              <input
                                data-expiry={row.id}
                                type="date"
                                value={row.expiry_date}
                                onChange={(e) => updateRow(row.id, 'expiry_date', e.target.value)}
                                onKeyDown={(e) => handleExpiryKeyDown(e, row)}
                                className="w-full border border-blue-200 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                              />
                            </div>
                          </div>
                        </>
                      )}
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
        <div className="bg-white rounded-lg shadow p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
              tabIndex={-1}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save All'} <span className="text-xs opacity-60 ml-1">(Shift+Enter)</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
