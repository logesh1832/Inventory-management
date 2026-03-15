import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import DateInput from '../components/DateInput';
import { fmtDate } from '../utils/date';

const emptyAllocation = () => ({
  id: Date.now() + Math.random(),
  batch_id: '',
  quantity: '',
});

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  product_id: '',
  quantity: '',
  batches: [],
  allocations: [],
  useManualBatch: false,
});

// Focus helpers
const focusProduct = (itemId) => {
  setTimeout(() => {
    const el = document.querySelector(`[data-item-product="${itemId}"] button`);
    if (el) el.focus();
  }, 50);
};

const focusAllocBatch = (allocId) => {
  setTimeout(() => {
    const el = document.querySelector(`[data-alloc-batch="${allocId}"] button`);
    if (el) { el.focus(); el.click(); }
  }, 50);
};

const focusAllocQty = (allocId) => {
  setTimeout(() => {
    const el = document.querySelector(`[data-alloc-qty="${allocId}"]`);
    if (el) el.focus();
  }, 50);
};

export default function OrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [loadingOrder, setLoadingOrder] = useState(isEdit);

  const [oldDeductions, setOldDeductions] = useState([]);

  const formRef = useRef(null);
  const qtyRefs = useRef({});
  const dateRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    Promise.all([
      api.get('/customers'),
      api.get('/products'),
    ]).then(([custRes, prodRes]) => {
      setCustomers(custRes.data);
      setProducts(prodRes.data);
      if (isEdit) loadOrder(prodRes.data);
    }).catch(() => {});
  }, []);

  const loadOrder = async (productsList) => {
    try {
      const res = await api.get(`/orders/${id}`);
      const order = res.data;

      setCustomerId(order.customer_id);
      setOrderDate(order.order_date ? order.order_date.split('T')[0] : '');
      setInvoiceNumber(order.invoice_number);

      const allOldDeductions = [];
      for (const item of order.items) {
        if (item.deductions) {
          for (const d of item.deductions) {
            allOldDeductions.push({ ...d, product_id: item.product_id });
          }
        }
      }
      setOldDeductions(allOldDeductions);

      const formItems = [];
      for (const item of order.items) {
        const formItem = {
          id: Date.now() + Math.random(),
          product_id: item.product_id,
          quantity: String(item.quantity),
          batches: [],
          allocations: [],
          useManualBatch: false,
        };

        try {
          const { data: batchData } = await api.get(`/batches/product/${item.product_id}`);
          const available = batchData.filter((b) => b.quantity_remaining > 0 || allOldDeductions.some((d) => d.batch_id === b.id));
          const adjusted = available.map((b) => {
            const oldQty = allOldDeductions
              .filter((d) => d.batch_id === b.id)
              .reduce((sum, d) => sum + d.quantity, 0);
            return { ...b, quantity_remaining: b.quantity_remaining + oldQty };
          });

          const namedBatches = adjusted.filter((b) => b.batch_number);
          formItem.batches = adjusted;

          if (namedBatches.length > 0 && item.deductions && item.deductions.length > 0) {
            formItem.useManualBatch = true;
            formItem.allocations = item.deductions
              .filter((d) => d.batch_number)
              .map((d) => ({
                id: Date.now() + Math.random(),
                batch_id: d.batch_id,
                quantity: String(d.quantity),
              }));
            if (formItem.allocations.length === 0 && namedBatches.length > 0) {
              formItem.allocations = [emptyAllocation()];
            }
          } else if (namedBatches.length > 0) {
            formItem.useManualBatch = true;
            formItem.allocations = [emptyAllocation()];
          }
        } catch {}

        formItems.push(formItem);
      }

      setItems(formItems.length > 0 ? formItems : [emptyItem()]);
    } catch (err) {
      showToast('Failed to load order', 'error');
    } finally {
      setLoadingOrder(false);
    }
  };

  const handleProductChange = async (itemId, productId) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, product_id: productId, batches: [], allocations: [], useManualBatch: false };
      })
    );

    if (!productId) return;

    try {
      const { data } = await api.get(`/batches/product/${productId}`);
      let available = data.filter((b) => b.quantity_remaining > 0);

      if (isEdit) {
        available = data.filter((b) => b.quantity_remaining > 0 || oldDeductions.some((d) => d.batch_id === b.id));
        available = available.map((b) => {
          const oldQty = oldDeductions
            .filter((d) => d.batch_id === b.id)
            .reduce((sum, d) => sum + d.quantity, 0);
          return { ...b, quantity_remaining: b.quantity_remaining + oldQty };
        });
      }

      const namedBatches = available.filter((b) => b.batch_number);
      const hasNamedBatches = namedBatches.length > 0;
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          const autoAlloc = hasNamedBatches && namedBatches.length === 1
            ? [{ ...emptyAllocation(), batch_id: namedBatches[0].id }]
            : hasNamedBatches ? [emptyAllocation()] : [];
          return {
            ...item,
            batches: available,
            useManualBatch: hasNamedBatches,
            allocations: autoAlloc,
          };
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

  const addItem = useCallback(() => {
    const newItem = emptyItem();
    setItems((prev) => [...prev, newItem]);
    focusProduct(newItem.id);
  }, []);

  const removeItem = (itemId) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const addAllocation = (itemId) => {
    const newAlloc = emptyAllocation();
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, allocations: [...item.allocations, newAlloc] };
      })
    );
    focusAllocBatch(newAlloc.id);
  };

  const updateAllocation = (itemId, allocId, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          allocations: item.allocations.map((a) =>
            a.id === allocId ? { ...a, [field]: value } : a
          ),
        };
      })
    );
    if (errors[itemId]) {
      setErrors((prev) => ({ ...prev, [itemId]: undefined }));
    }
  };

  const removeAllocation = (itemId, allocId) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, allocations: item.allocations.filter((a) => a.id !== allocId) };
      })
    );
  };

  const getAllocatedForBatch = (batchId, excludeAllocId) => {
    let total = 0;
    for (const item of items) {
      for (const alloc of item.allocations) {
        if (alloc.id !== excludeAllocId && alloc.batch_id === batchId && alloc.quantity) {
          total += Number(alloc.quantity);
        }
      }
    }
    return total;
  };

  const getAdjustedBatches = (item, excludeAllocId) => {
    return item.batches.map((b) => ({
      ...b,
      adjusted_remaining: b.quantity_remaining - getAllocatedForBatch(b.id, excludeAllocId),
    }));
  };

  const getProductStock = (productId) => {
    const item = items.find((i) => i.product_id === productId);
    if (!item) return 0;
    return item.batches.reduce((sum, b) => sum + b.quantity_remaining, 0);
  };

  const getAllocatedTotal = (item) => {
    return item.allocations.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
  };

  // --- Keyboard handlers ---

  // Keyboard: Shift+Enter = save, Ctrl+I = add item
  useEffect(() => {
    const handleKey = (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
      if (e.ctrlKey && e.key === 'i') {
        e.preventDefault();
        addItem();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Date → Enter → first product
  const handleDateKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (items.length > 0) focusProduct(items[0].id);
    }
  };

  // Qty → Enter: if batch allocs, focus first alloc batch; else add new item
  const handleQtyKeyDown = (e, item) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) { formRef.current?.requestSubmit(); return; }
      if (item.useManualBatch && item.allocations.length > 0) {
        focusAllocBatch(item.allocations[0].id);
      } else {
        goToNextItemOrAdd(item.id);
      }
    }
  };

  // Alloc qty → Enter: if total allocated < item qty, add new batch row; else next product
  const handleAllocQtyKeyDown = (e, item, allocIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) { formRef.current?.requestSubmit(); return; }

      // If there are more existing alloc rows after this one, go to next
      if (allocIdx < item.allocations.length - 1) {
        focusAllocBatch(item.allocations[allocIdx + 1].id);
        return;
      }

      // Check if total allocated meets item quantity
      const totalAllocated = item.allocations.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
      const itemQty = Number(item.quantity) || 0;

      if (itemQty > 0 && totalAllocated < itemQty) {
        // Not enough allocated — add another batch allocation row
        addAllocation(item.id);
      } else {
        // Fully allocated — move to next product item
        goToNextItemOrAdd(item.id);
      }
    }
  };

  const goToNextItemOrAdd = useCallback((itemId) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === itemId);
      if (idx === prev.length - 1) {
        const newItem = emptyItem();
        setTimeout(() => focusProduct(newItem.id), 50);
        return [...prev, newItem];
      } else {
        focusProduct(prev[idx + 1].id);
        return prev;
      }
    });
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!customerId) newErrors.customer = 'Customer is required';
    if (!orderDate) newErrors.date = 'Order date is required';

    items.forEach((item) => {
      const rowErrors = [];
      if (!item.product_id) rowErrors.push('Select a product');
      if (!item.quantity || Number(item.quantity) <= 0) rowErrors.push('Enter quantity');

      if (item.useManualBatch && item.allocations.length > 0) {
        const totalQty = Number(item.quantity) || 0;
        const allocTotal = getAllocatedTotal(item);

        item.allocations.forEach((alloc, i) => {
          if (!alloc.batch_id) rowErrors.push(`Batch allocation ${i + 1}: select a batch`);
          if (!alloc.quantity || Number(alloc.quantity) <= 0) rowErrors.push(`Batch allocation ${i + 1}: enter quantity`);
          if (alloc.batch_id && alloc.quantity) {
            const adjusted = getAdjustedBatches(item, alloc.id);
            const batch = adjusted.find((b) => b.id === alloc.batch_id);
            if (batch && Number(alloc.quantity) > batch.adjusted_remaining) {
              rowErrors.push(`Batch ${batch.batch_number}: only ${batch.adjusted_remaining} available`);
            }
          }
        });

        if (allocTotal !== totalQty && item.allocations.every((a) => a.batch_id && a.quantity)) {
          rowErrors.push(`Batch allocations (${allocTotal}) must equal total quantity (${totalQty})`);
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
      const payload = [];
      for (const item of items) {
        if (item.useManualBatch && item.allocations.length > 0) {
          for (const alloc of item.allocations) {
            payload.push({
              product_id: item.product_id,
              quantity: Number(alloc.quantity),
              batch_id: alloc.batch_id,
            });
          }
        } else {
          payload.push({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            batch_id: null,
          });
        }
      }

      const body = {
        customer_id: customerId,
        order_date: orderDate,
        items: payload,
      };

      if (isEdit) {
        await api.put(`/orders/${id}`, body);
        showToast('Order updated successfully');
        setTimeout(() => navigate(`/orders/${id}`), 600);
      } else {
        await api.post('/orders', body);
        showToast('Order created successfully');
        setTimeout(() => navigate('/orders'), 600);
      }
    } catch (err) {
      showToast(err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} order`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingOrder) {
    return <p className="text-gray-500">Loading order...</p>;
  }

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {isEdit ? `Edit${invoiceNumber ? ` — ${invoiceNumber}` : ''}` : 'Create New Material Out'}
        </h2>
        <button onClick={() => navigate(isEdit ? `/orders/${id}` : '/orders')} tabIndex={-1} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; {isEdit ? 'Back to Detail' : 'Back to Material Out'}
        </button>
      </div>

      {/* Keyboard shortcut hints */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-400">
        <span className="bg-gray-100 px-2 py-1 rounded"><kbd className="font-mono font-semibold text-gray-500">Enter</kbd> next field / add item</span>
        <span className="bg-gray-100 px-2 py-1 rounded"><kbd className="font-mono font-semibold text-gray-500">Ctrl+I</kbd> add item</span>
        <span className="bg-gray-100 px-2 py-1 rounded"><kbd className="font-mono font-semibold text-gray-500">Shift+Enter</kbd> save</span>
      </div>

      <form ref={formRef} onSubmit={handleSubmit}>
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
                autoFocus={!isEdit}
                onEnterAfterSelect={() => { if (items.length > 0) focusProduct(items[0].id); }}
              />
              {errors.customer && <p className="text-red-500 text-xs mt-1">{errors.customer}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Date <span className="text-red-500">*</span>
              </label>
              <DateInput
                ref={dateRef}
                value={orderDate}
                onChange={(e) => { setOrderDate(e.target.value); setErrors((p) => ({ ...p, date: undefined })); }}
                onKeyDown={handleDateKeyDown}
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
              tabIndex={-1}
              className="text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded font-medium transition-colors"
            >
              + Add Item
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {items.map((item, idx) => {
              return (
                <div key={item.id} className={`px-5 py-4 ${errors[item.id] ? 'bg-red-50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-400">ITEM {idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        tabIndex={-1}
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
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3">
                    <div className="sm:col-span-8" data-item-product={item.id}>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Product <span className="text-red-500">*</span></label>
                      <SearchableSelect
                        options={products.map((p) => ({ value: p.id, label: `${p.product_name} (${p.product_code})` }))}
                        value={item.product_id}
                        onChange={(val) => handleProductChange(item.id, val)}
                        placeholder="Select product..."
                        autoFocusNext={{ current: qtyRefs.current[item.id] }}
                      />
                      {item.product_id && (
                        <p className="text-xs text-gray-400 mt-1">
                          Total available: <span className="font-medium text-gray-600">{getProductStock(item.product_id)}</span>
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Quantity <span className="text-red-500">*</span></label>
                      <input
                        ref={(el) => (qtyRefs.current[item.id] = el)}
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        onKeyDown={(e) => handleQtyKeyDown(e, item)}
                        placeholder="0"
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                      />
                      {(() => {
                        const prod = products.find((p) => p.id === item.product_id);
                        if (prod && prod.unit === 'Boxes' && prod.qty_per_box && item.quantity) {
                          const total = Number(item.quantity) * prod.qty_per_box;
                          return (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              {item.quantity} x {prod.qty_per_box} = {total} pcs
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  {/* Batch Allocations (Manual Mode) */}
                  {item.useManualBatch && item.allocations.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">Batch Allocations</span>
                        <div className="flex items-center gap-3">
                          {item.quantity && (
                            <span className={`text-xs font-medium ${
                              getAllocatedTotal(item) === Number(item.quantity)
                                ? 'text-green-600'
                                : getAllocatedTotal(item) > Number(item.quantity)
                                ? 'text-red-600'
                                : 'text-yellow-600'
                            }`}>
                              {getAllocatedTotal(item)} / {item.quantity} allocated
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => addAllocation(item.id)}
                            tabIndex={-1}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            + Add Batch
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {item.allocations.map((alloc, allocIdx) => {
                          const adjusted = getAdjustedBatches(item, alloc.id).filter((b) => b.batch_number);
                          const available = adjusted.filter((b) => b.adjusted_remaining > 0 || b.id === alloc.batch_id);
                          const selectedBatch = adjusted.find((b) => b.id === alloc.batch_id);

                          return (
                            <div key={alloc.id} className="flex flex-col sm:flex-row sm:items-start gap-2">
                              <div className="flex-1" data-alloc-batch={alloc.id}>
                                <SearchableSelect
                                  options={available.map((b) => ({
                                    value: b.id,
                                    label: `${b.batch_number} — Available: ${b.adjusted_remaining}`,
                                    sublabel: [
                                      b.manufacture_date ? `Mfg: ${fmtDate(b.manufacture_date)}` : '',
                                      b.expiry_date ? `Exp: ${fmtDate(b.expiry_date)}` : '',
                                    ].filter(Boolean).join(' | ') || undefined,
                                    disabled: b.adjusted_remaining <= 0,
                                  }))}
                                  value={alloc.batch_id}
                                  onChange={(val) => updateAllocation(item.id, alloc.id, 'batch_id', val)}
                                  placeholder="Select batch..."
                                  autoFocusNext={{ current: document.querySelector(`[data-alloc-qty="${alloc.id}"]`) }}
                                  onEnterAfterSelect={() => focusAllocQty(alloc.id)}
                                />
                              </div>
                              <div className="w-24">
                                <input
                                  data-alloc-qty={alloc.id}
                                  type="number"
                                  min="1"
                                  max={selectedBatch ? selectedBatch.adjusted_remaining : undefined}
                                  value={alloc.quantity}
                                  onChange={(e) => updateAllocation(item.id, alloc.id, 'quantity', e.target.value)}
                                  onKeyDown={(e) => handleAllocQtyKeyDown(e, item, allocIdx)}
                                  placeholder="Qty"
                                  className="w-full border border-gray-300 rounded px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-yellow-500"
                                />
                              </div>
                              {item.allocations.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeAllocation(item.id, alloc.id)}
                                  tabIndex={-1}
                                  className="text-red-400 hover:text-red-600 mt-2"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {errors[item.id] && (
                    <p className="text-red-600 text-xs mt-2">{errors[item.id]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">{items.length}</span> item{items.length > 1 ? 's' : ''} &middot;{' '}
            <span className="font-medium text-gray-700">
              {items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)}
            </span> total qty
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(isEdit ? `/orders/${id}` : '/orders')}
              tabIndex={-1}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              {submitting ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update' : 'Create')} <span className="text-xs opacity-60 ml-1">(Shift+Enter)</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
