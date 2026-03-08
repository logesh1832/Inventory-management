import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

export default function QuotationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [stockMap, setStockMap] = useState({});

  const [customerId, setCustomerId] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: '' }]);
  const [status, setStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Searchable dropdown state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [productSearches, setProductSearches] = useState({});
  const [productDropdownOpen, setProductDropdownOpen] = useState({});
  const customerRef = useRef(null);
  const productRefs = useRef({});

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (customerRef.current && !customerRef.current.contains(e.target)) {
        setCustomerDropdownOpen(false);
      }
      Object.keys(productRefs.current).forEach((idx) => {
        if (productRefs.current[idx] && !productRefs.current[idx].contains(e.target)) {
          setProductDropdownOpen((prev) => ({ ...prev, [idx]: false }));
        }
      });
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch reference data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const promises = [
          api.get('/customers'),
          api.get('/products'),
        ];
        // Batches endpoint requires admin/inventory role
        if (user?.role !== 'salesperson') {
          promises.push(api.get('/batches'));
        }
        const results = await Promise.all(promises);
        setCustomers(results[0].data);
        setProducts(results[1].data);
        if (results[2]) {
          const map = {};
          for (const b of results[2].data) {
            map[b.product_id] = (map[b.product_id] || 0) + b.quantity_remaining;
          }
          setStockMap(map);
        }
      } catch {
        showToast('Failed to load reference data', 'error');
      }
    };
    fetchData();
  }, []);

  // Fetch existing quotation in edit mode
  useEffect(() => {
    if (!isEdit) {
      setLoading(false);
      return;
    }
    const fetchQuotation = async () => {
      try {
        const res = await api.get(`/quotations/${id}`);
        const q = res.data;
        const allowedStatuses = ['DRAFT', 'SUBMITTED', 'REJECTED'];
        if (!allowedStatuses.includes(q.status)) {
          showToast('This quotation cannot be edited', 'error');
          setTimeout(() => navigate('/my-quotations'), 500);
          return;
        }
        setCustomerId(q.customer_id);
        setQuotationDate(q.quotation_date ? q.quotation_date.split('T')[0] : '');
        setNotes(q.notes || '');
        setStatus(q.status);
        setRejectionReason(q.rejection_reason || '');
        if (q.items && q.items.length > 0) {
          setItems(
            q.items.map((it) => ({
              product_id: it.product_id,
              quantity: it.quantity,
            }))
          );
        }
        // Set the customer search display
        const cust = customers.length > 0
          ? customers.find((c) => c.id === q.customer_id)
          : null;
        if (cust) {
          setCustomerSearch(`${cust.customer_name} - ${cust.phone || ''}`);
        }
      } catch (err) {
        showToast(err.response?.data?.error || 'Failed to load quotation', 'error');
        setTimeout(() => navigate('/my-quotations'), 500);
      } finally {
        setLoading(false);
      }
    };
    fetchQuotation();
  }, [id, isEdit, navigate, customers.length]);

  // Update customer search display when customers load
  useEffect(() => {
    if (customerId && customers.length > 0) {
      const cust = customers.find((c) => String(c.id) === String(customerId));
      if (cust) {
        setCustomerSearch(`${cust.customer_name} - ${cust.phone || ''}`);
      }
    }
  }, [customers, customerId]);

  const getProductById = (pid) => products.find((p) => String(p.id) === String(pid));

  const getUnitPrice = (pid) => {
    const prod = getProductById(pid);
    return prod ? Number(prod.unit_price || prod.price || 0) : 0;
  };

  const getLineTotal = (item) => {
    if (!item.product_id || !item.quantity) return 0;
    return getUnitPrice(item.product_id) * Number(item.quantity);
  };

  const grandTotal = items.reduce((sum, item) => sum + getLineTotal(item), 0);

  const filteredCustomers = customers.filter((c) => {
    const search = customerSearch.toLowerCase();
    return (
      c.customer_name.toLowerCase().includes(search) ||
      (c.phone && c.phone.toLowerCase().includes(search))
    );
  });

  const getFilteredProducts = (index) => {
    const search = (productSearches[index] || '').toLowerCase();
    return products.filter((p) => {
      const matchesSearch =
        p.product_name.toLowerCase().includes(search) ||
        p.product_code.toLowerCase().includes(search);
      return matchesSearch;
    });
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: '' }]);
  };

  const removeItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
    // Cleanup search state
    setProductSearches((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    setProductDropdownOpen((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const updateItem = (index, field, value) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setItems(updated);
    setErrors((prev) => ({ ...prev, [`item_${index}_${field}`]: '' }));
  };

  const selectProduct = (index, product) => {
    updateItem(index, 'product_id', product.id);
    setProductSearches((prev) => ({
      ...prev,
      [index]: `${product.product_name} (${product.product_code})`,
    }));
    setProductDropdownOpen((prev) => ({ ...prev, [index]: false }));
  };

  const getDuplicateProductWarning = (index) => {
    const pid = items[index].product_id;
    if (!pid) return null;
    const dupIndex = items.findIndex(
      (item, i) => i !== index && String(item.product_id) === String(pid)
    );
    if (dupIndex >= 0) return 'This product is already added in another row';
    return null;
  };

  const validate = () => {
    const errs = {};
    if (!customerId) errs.customer_id = 'Customer is required';
    if (!quotationDate) errs.quotation_date = 'Quotation date is required';

    const seenProducts = new Set();
    items.forEach((item, i) => {
      if (!item.product_id) errs[`item_${i}_product_id`] = 'Product is required';
      if (!item.quantity || Number(item.quantity) <= 0)
        errs[`item_${i}_quantity`] = 'Quantity must be > 0';
      if (item.product_id) {
        if (seenProducts.has(String(item.product_id))) {
          errs[`item_${i}_product_id`] = 'Duplicate product';
        }
        seenProducts.add(String(item.product_id));
      }
    });

    if (items.length === 0) errs.items = 'At least one item is required';

    return errs;
  };

  const handleSave = async (andSubmit = false) => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const payload = {
      customer_id: customerId,
      quotation_date: quotationDate,
      notes: notes || null,
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity),
      })),
    };

    try {
      setSubmitting(true);
      let quotationId = id;

      if (isEdit) {
        await api.put(`/quotations/${id}`, payload);
      } else {
        const res = await api.post('/quotations', payload);
        quotationId = res.data.id;
      }

      if (andSubmit && quotationId) {
        await api.patch(`/quotations/${quotationId}/submit`);
      }

      showToast(
        isEdit
          ? `Quotation updated${andSubmit ? ' and submitted' : ''} successfully`
          : `Quotation created${andSubmit ? ' and submitted' : ''} successfully`
      );
      setTimeout(() => navigate('/my-quotations'), 500);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save quotation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Initialize product search display for edit mode
  useEffect(() => {
    if (products.length > 0 && items.length > 0) {
      const searches = {};
      items.forEach((item, idx) => {
        if (item.product_id) {
          const prod = getProductById(item.product_id);
          if (prod && !productSearches[idx]) {
            searches[idx] = `${prod.product_name} (${prod.product_code})`;
          }
        }
      });
      if (Object.keys(searches).length > 0) {
        setProductSearches((prev) => ({ ...prev, ...searches }));
      }
    }
  }, [products, items.length]);

  if (loading) return <p className="text-gray-500">Loading...</p>;

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

      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        {isEdit ? 'Edit Quotation' : 'New Quotation'}
      </h2>

      {/* Rejection banner */}
      {status === 'REJECTED' && rejectionReason && (
        <div className="mb-6 bg-red-50 border border-red-300 rounded p-4">
          <div className="flex items-center gap-2 mb-1">
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold text-red-700">Quotation Rejected</span>
          </div>
          <p className="text-red-600 text-sm">{rejectionReason}</p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave(false);
        }}
        className="max-w-4xl bg-white p-6 rounded shadow space-y-5"
      >
        {/* Customer & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div ref={customerRef} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
            <input
              type="text"
              placeholder="Search customer by name or phone..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setCustomerDropdownOpen(true);
                if (!e.target.value) setCustomerId('');
              }}
              onFocus={() => setCustomerDropdownOpen(true)}
              className={`w-full border rounded px-3 py-2 ${errors.customer_id ? 'border-red-500' : 'border-gray-300'}`}
            />
            {customerDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                {filteredCustomers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-400">No customers found</div>
                ) : (
                  filteredCustomers.map((c) => (
                    <div
                      key={c.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-yellow-50 text-sm ${
                        String(c.id) === String(customerId) ? 'bg-yellow-100 font-medium' : ''
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCustomerId(c.id);
                        setCustomerSearch(`${c.customer_name} - ${c.phone || ''}`);
                        setCustomerDropdownOpen(false);
                        setErrors((prev) => ({ ...prev, customer_id: '' }));
                      }}
                    >
                      {c.customer_name} {c.phone ? `- ${c.phone}` : ''}
                    </div>
                  ))
                )}
              </div>
            )}
            {errors.customer_id && <p className="text-red-500 text-sm mt-1">{errors.customer_id}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quotation Date *</label>
            <input
              type="date"
              value={quotationDate}
              onChange={(e) => {
                setQuotationDate(e.target.value);
                setErrors((prev) => ({ ...prev, quotation_date: '' }));
              }}
              className={`w-full border rounded px-3 py-2 ${errors.quotation_date ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.quotation_date && (
              <p className="text-red-500 text-sm mt-1">{errors.quotation_date}</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Quotation Items *</label>
            <button
              type="button"
              onClick={addItem}
              className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 transition-colors"
            >
              + Add Product
            </button>
          </div>

          {errors.items && <p className="text-red-500 text-sm mb-2">{errors.items}</p>}

          {/* Items header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 pb-1 text-xs font-medium text-gray-500 uppercase">
            <div className={user?.role === 'salesperson' ? 'col-span-5' : 'col-span-4'}>Product</div>
            <div className="col-span-2">Quantity</div>
            <div className="col-span-2">Unit Price</div>
            {user?.role !== 'salesperson' && <div className="col-span-1">Stock</div>}
            <div className="col-span-2">Line Total</div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const dupWarning = getDuplicateProductWarning(index);
              return (
                <div key={index} className="sm:grid sm:grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded">
                  {/* Product searchable dropdown */}
                  <div
                    className="col-span-4 relative"
                    ref={(el) => (productRefs.current[index] = el)}
                  >
                    <input
                      type="text"
                      placeholder="Search product..."
                      value={productSearches[index] || ''}
                      onChange={(e) => {
                        setProductSearches((prev) => ({ ...prev, [index]: e.target.value }));
                        setProductDropdownOpen((prev) => ({ ...prev, [index]: true }));
                        if (!e.target.value) updateItem(index, 'product_id', '');
                      }}
                      onFocus={() =>
                        setProductDropdownOpen((prev) => ({ ...prev, [index]: true }))
                      }
                      className={`w-full border rounded px-3 py-2 text-sm ${
                        errors[`item_${index}_product_id`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {productDropdownOpen[index] && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                        {getFilteredProducts(index).length === 0 ? (
                          <div className="px-3 py-2 text-sm text-gray-400">No products found</div>
                        ) : (
                          getFilteredProducts(index).map((p) => (
                            <div
                              key={p.id}
                              className={`px-3 py-2 cursor-pointer hover:bg-yellow-50 text-sm ${
                                String(p.id) === String(item.product_id) ? 'bg-yellow-100 font-medium' : ''
                              }`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectProduct(index, p)}
                            >
                              <span className="font-medium">{p.product_name}</span>{' '}
                              <span className="text-gray-500">({p.product_code})</span>{' '}
                              {user?.role !== 'salesperson' && (
                                <span className="text-xs text-gray-400">
                                  Stock: {stockMap[p.id] || 0}
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    {errors[`item_${index}_product_id`] && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors[`item_${index}_product_id`]}
                      </p>
                    )}
                    {dupWarning && (
                      <p className="text-orange-500 text-xs mt-1">{dupWarning}</p>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="col-span-2 mt-2 sm:mt-0">
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className={`w-full border rounded px-3 py-2 text-sm ${
                        errors[`item_${index}_quantity`] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors[`item_${index}_quantity`] && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors[`item_${index}_quantity`]}
                      </p>
                    )}
                  </div>

                  {/* Unit Price (read-only) */}
                  <div className="col-span-2 mt-2 sm:mt-0">
                    <input
                      type="text"
                      readOnly
                      value={item.product_id ? formatCurrency(getUnitPrice(item.product_id)) : '-'}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-100 text-gray-600"
                    />
                  </div>

                  {/* Available stock — hidden for salesperson */}
                  {user?.role !== 'salesperson' && (
                    <div className="col-span-1 mt-2 sm:mt-0 flex items-center">
                      <span className="text-sm text-gray-500">
                        {item.product_id ? stockMap[item.product_id] || 0 : '-'}
                      </span>
                    </div>
                  )}

                  {/* Line Total */}
                  <div className="col-span-2 mt-2 sm:mt-0 flex items-center">
                    <span className="text-sm font-medium text-gray-800">
                      {item.product_id && item.quantity
                        ? formatCurrency(getLineTotal(item))
                        : '-'}
                    </span>
                  </div>

                  {/* Remove button */}
                  <div className="col-span-1 mt-2 sm:mt-0 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                      title="Remove item"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grand Total */}
          <div className="flex justify-end mt-4 pr-3">
            <div className="text-right">
              <span className="text-sm text-gray-500 mr-3">Grand Total:</span>
              <span className="text-lg font-bold text-gray-900">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-2 border-t">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={submitting}
            className="bg-yellow-500 text-gray-900 px-5 py-2 rounded hover:bg-yellow-600 transition-colors disabled:opacity-50 font-medium"
          >
            {submitting ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={submitting}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
          >
            {submitting ? 'Saving...' : 'Save & Submit'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/my-quotations')}
            className="bg-gray-100 text-gray-700 px-5 py-2 rounded hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
