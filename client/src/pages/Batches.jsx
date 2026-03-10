import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';

const today = () => new Date().toISOString().split('T')[0];

function EditStockEntryModal({ entryId, suppliers, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entry, setEntry] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [productBatches, setProductBatches] = useState([]);
  const [batchMode, setBatchMode] = useState('current'); // 'current' | 'existing' | 'new'

  useEffect(() => {
    api.get(`/batches/stock-entries/${entryId}`)
      .then(async (res) => {
        const e = res.data;
        setEntry(e);
        const toDateStr = (v) => {
          if (!v) return '';
          const d = new Date(v);
          return isNaN(d) ? '' : d.toISOString().split('T')[0];
        };
        setForm({
          quantity: String(e.quantity),
          supplier_id: e.supplier_id || '',
          received_date: toDateStr(e.received_date),
          batch_id: e.batch_id || '',
          existing_batch_id: '',
          batch_number: e.batch_number || '',
          manufacture_date: toDateStr(e.manufacture_date),
          expiry_date: toDateStr(e.expiry_date),
        });

        // Fetch other batches for this product if batch tracked
        if (e.batch_tracking && e.product_id) {
          try {
            const { data } = await api.get(`/batches/product/${e.product_id}`);
            setProductBatches(data.filter((b) => b.batch_number && b.id !== e.batch_id));
          } catch {}
        }
      })
      .catch(() => setError('Failed to load stock entry'))
      .finally(() => setLoading(false));
  }, [entryId]);

  const handleSave = async () => {
    if (!form.quantity || Number(form.quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    if (batchMode === 'existing' && !form.existing_batch_id) {
      setError('Please select a batch');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        quantity: Number(form.quantity),
        supplier_id: form.supplier_id || null,
        received_date: form.received_date || null,
      };

      if (batchMode === 'existing') {
        payload.move_to_batch_id = form.existing_batch_id;
      } else if (batchMode === 'new') {
        payload.batch_number = form.batch_number || null;
        payload.manufacture_date = form.manufacture_date || null;
        payload.expiry_date = form.expiry_date || null;
      } else {
        // current - keep same batch, allow editing batch details
        payload.batch_number = form.batch_number || null;
        payload.manufacture_date = form.manufacture_date || null;
        payload.expiry_date = form.expiry_date || null;
      }

      await api.put(`/batches/stock-entries/${entryId}`, payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Edit Stock Entry</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <>
              {/* Product (read-only) */}
              {entry && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                  <p className="text-sm text-gray-800 bg-gray-50 rounded px-3 py-2">
                    {entry.product_name} ({entry.product_code})
                  </p>
                </div>
              )}

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                <SearchableSelect
                  options={suppliers.map((s) => ({ value: s.id, label: s.customer_name }))}
                  value={form.supplier_id}
                  onChange={(val) => setForm({ ...form, supplier_id: val })}
                  placeholder="Select supplier..."
                />
              </div>

              {/* Received Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Received Date</label>
                <input
                  type="date"
                  value={form.received_date}
                  onChange={(e) => setForm({ ...form, received_date: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              {/* Batch details (only if batch tracked) */}
              {entry?.batch_tracking && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Batch</label>
                    <div className="flex bg-gray-100 rounded text-xs overflow-hidden w-fit mb-3">
                      <button
                        type="button"
                        onClick={() => setBatchMode('current')}
                        className={`px-3 py-1.5 transition-colors ${batchMode === 'current' ? 'bg-yellow-500 text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        Current Batch
                      </button>
                      {productBatches.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setBatchMode('existing')}
                          className={`px-3 py-1.5 transition-colors ${batchMode === 'existing' ? 'bg-yellow-500 text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          Move to Existing
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setBatchMode('new')}
                        className={`px-3 py-1.5 transition-colors ${batchMode === 'new' ? 'bg-yellow-500 text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        New Batch
                      </button>
                    </div>

                    {batchMode === 'existing' ? (
                      <SearchableSelect
                        options={productBatches.map((b) => ({
                          value: b.id,
                          label: `${b.batch_number} (Remaining: ${b.quantity_remaining})`,
                        }))}
                        value={form.existing_batch_id}
                        onChange={(val) => setForm({ ...form, existing_batch_id: val })}
                        placeholder="Select existing batch..."
                      />
                    ) : (
                      <>
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Batch Number</label>
                          <input
                            type="text"
                            value={form.batch_number}
                            onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Manufacture Date</label>
                            <input
                              type="date"
                              value={form.manufacture_date}
                              onChange={(e) => setForm({ ...form, manufacture_date: e.target.value })}
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Expiry Date</label>
                            <input
                              type="date"
                              value={form.expiry_date}
                              onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {error && <p className="text-red-600 text-sm">{error}</p>}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 font-semibold text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Batches() {
  const [tab, setTab] = useState('entries'); // 'entries' | 'batches'
  const [entries, setEntries] = useState([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [batches, setBatches] = useState([]);
  const [batchesTotal, setBatchesTotal] = useState(0);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filterProductId, setFilterProductId] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editEntryId, setEditEntryId] = useState(null);

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
    api.get('/customers').then((res) => setSuppliers(res.data)).catch(() => {});
  }, []);

  const fetchData = (currentTab, productId, supplierId, fd, td, pg) => {
    setLoading(true);
    if (currentTab === 'entries') {
      const params = { page: pg, limit: 20 };
      if (productId) params.product_id = productId;
      if (supplierId) params.supplier_id = supplierId;
      if (fd) params.from_date = fd;
      if (td) params.to_date = td;
      api.get('/batches/stock-entries', { params })
        .then((res) => { setEntries(res.data.data); setEntriesTotal(res.data.total); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      const params = { page: pg, limit: 20 };
      if (productId) params.product_id = productId;
      if (fd) params.from_date = fd;
      if (td) params.to_date = td;
      api.get('/batches', { params })
        .then((res) => { setBatches(res.data.data); setBatchesTotal(res.data.total); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    setPage(1);
    fetchData(tab, filterProductId, filterSupplierId, fromDate, toDate, 1);
  }, [tab, filterProductId, filterSupplierId, fromDate, toDate]);

  const handlePageChange = (pg) => {
    setPage(pg);
    fetchData(tab, filterProductId, filterSupplierId, fromDate, toDate, pg);
  };

  const handleEditSaved = () => {
    setEditEntryId(null);
    fetchData(tab, filterProductId, filterSupplierId, fromDate, toDate, page);
  };

  return (
    <div>
      {editEntryId && (
        <EditStockEntryModal
          entryId={editEntryId}
          suppliers={suppliers}
          onClose={() => setEditEntryId(null)}
          onSaved={handleEditSaved}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Batches & Stock</h2>
        <Link
          to="/batches/new"
          className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors font-semibold text-sm text-center"
        >
          + Stock Entry
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('entries')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            tab === 'entries' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Stock Entries
        </button>
        <button
          onClick={() => setTab('batches')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            tab === 'batches' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Batch Summary
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="w-full sm:w-56">
          <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
          <SearchableSelect
            options={products.map((p) => ({ value: p.id, label: p.product_name, sublabel: p.product_code }))}
            value={filterProductId}
            onChange={setFilterProductId}
            placeholder="All Products"
          />
        </div>
        {tab === 'entries' && (
          <div className="w-full sm:w-56">
            <label className="block text-xs font-medium text-gray-500 mb-1">Supplier</label>
            <SearchableSelect
              options={suppliers.map((s) => ({ value: s.id, label: s.customer_name }))}
              value={filterSupplierId}
              onChange={setFilterSupplierId}
              placeholder="All Suppliers"
            />
          </div>
        )}
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-40 text-sm"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-40 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : tab === 'entries' ? (
        /* Stock Entries Tab */
        entries.length === 0 ? (
          <p className="text-gray-500">No stock entries found.</p>
        ) : (
          <>
          {/* Mobile cards - entries */}
          <div className="md:hidden space-y-3">
            {entries.map((e) => (
              <div key={e.id} className="bg-white rounded-lg shadow p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{e.product_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">
                      +{e.quantity}
                    </span>
                    <button
                      onClick={() => setEditEntryId(e.id)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                    >
                      Edit
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Date:</span>{' '}
                  {e.received_date
                    ? new Date(e.received_date).toLocaleDateString()
                    : new Date(e.created_at).toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Supplier:</span> {e.supplier_name || '-'}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Batch:</span>{' '}
                  {e.batch_number ? (
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{e.batch_number}</span>
                  ) : (
                    <span className="text-gray-400">No Batch</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table - entries */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mfg / Expiry</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty Received</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {e.received_date
                        ? new Date(e.received_date).toLocaleDateString()
                        : new Date(e.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">{e.supplier_name || '-'}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">
                      <span>{e.product_name}</span>
                      <span className="text-gray-400 text-xs ml-1">({e.product_code})</span>
                    </td>
                    <td className="px-5 py-3 text-sm">
                      {e.batch_number ? (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                          {e.batch_number}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No Batch</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {e.manufacture_date || e.expiry_date ? (
                        <span className="text-xs">
                          {e.manufacture_date ? new Date(e.manufacture_date).toLocaleDateString() : '-'}
                          {' / '}
                          {e.expiry_date ? (
                            <span className={new Date(e.expiry_date) < new Date() ? 'text-red-600 font-medium' : ''}>
                              {new Date(e.expiry_date).toLocaleDateString()}
                            </span>
                          ) : '-'}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">
                        +{e.quantity}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <button
                        onClick={() => setEditEntryId(e.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={entriesTotal} limit={20} onPageChange={handlePageChange} />
          </>
        )
      ) : (
        /* Batch Summary Tab */
        batches.length === 0 ? (
          <p className="text-gray-500">No batches found.</p>
        ) : (
          <>
          {/* Mobile cards - batch summary */}
          <div className="md:hidden space-y-3">
            {batches.map((b) => (
              <div key={b.id} className={`bg-white rounded-lg shadow p-4 space-y-2 ${b.quantity_remaining === 0 ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">
                    {b.batch_number || <span className="text-gray-400">No Batch</span>}
                  </span>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                    b.quantity_remaining === 0 ? 'bg-gray-100 text-gray-400' :
                    b.quantity_remaining < 50 ? 'bg-red-100 text-red-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {b.quantity_remaining} remaining
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Product:</span> {b.product_name}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Received:</span> {b.quantity_received}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">First Received:</span> {new Date(b.received_date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table - batch summary */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch Number</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Received</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remaining</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {batches.map((b) => (
                  <tr key={b.id} className={`hover:bg-gray-50 ${b.quantity_remaining === 0 ? 'bg-gray-50 text-gray-400' : ''}`}>
                    <td className="px-5 py-3 text-sm font-medium">{b.batch_number || <span className="text-gray-400">No Batch</span>}</td>
                    <td className="px-5 py-3 text-sm">{b.product_name}</td>
                    <td className="px-5 py-3 text-sm">{b.quantity_received}</td>
                    <td className="px-5 py-3 text-sm">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                        b.quantity_remaining === 0 ? 'bg-gray-100 text-gray-400' :
                        b.quantity_remaining < 50 ? 'bg-red-100 text-red-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {b.quantity_remaining}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm">
                      {new Date(b.received_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={batchesTotal} limit={20} onPageChange={handlePageChange} />
          </>
        )
      )}
    </div>
  );
}
