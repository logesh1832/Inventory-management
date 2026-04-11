import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import { fmtDate } from '../utils/date';
import DateInput from '../components/DateInput';

const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const toDateStr = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

export default function Batches() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('entries'); // 'entries' | 'batches'
  const [entries, setEntries] = useState([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [batches, setBatches] = useState([]);
  const [batchesTotal, setBatchesTotal] = useState(0);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filterProductId, setFilterProductId] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
    api.get('/customers').then((res) => setSuppliers(res.data)).catch(() => {});
  }, []);

  const fetchData = (currentTab, productId, supplierId, fd, td, pg, lim) => {
    setLoading(true);
    if (currentTab === 'entries') {
      const params = { page: pg, limit: lim };
      if (productId) params.product_id = productId;
      if (supplierId) params.supplier_id = supplierId;
      if (fd) params.from_date = fd;
      if (td) params.to_date = td;
      api.get('/batches/stock-entry-groups', { params })
        .then((res) => { setEntries(res.data.data); setEntriesTotal(res.data.total); })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      const params = { page: pg, limit: lim };
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
    fetchData(tab, filterProductId, filterSupplierId, fromDate, toDate, 1, limit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filterProductId, filterSupplierId, fromDate, toDate]);

  const handlePageChange = (pg) => {
    setPage(pg);
    fetchData(tab, filterProductId, filterSupplierId, fromDate, toDate, pg, limit);
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setPage(1);
    fetchData(tab, filterProductId, filterSupplierId, fromDate, toDate, 1, newLimit);
  };

  // Reset selectedIndex when entries data changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [entries]);

  const handleKeyDown = useCallback((e) => {
    if (tab !== 'entries' || entries.length === 0) return;
    // Don't intercept if user is typing in an input/select/textarea
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

    const g = entries[selectedIndex];
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, entries.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (g) navigate(`/batches/view?voucher=${g.voucher_number}`);
        break;
      case 'e':
      case 'E':
        e.preventDefault();
        if (g) navigate(`/batches/stock-entries/${g.first_entry_id}/edit`);
        break;
      case 'd':
      case 'D':
        e.preventDefault();
        if (g) handleDeleteGroup(g.voucher_number, g.supplier_name);
        break;
      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, entries, selectedIndex, navigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleDeleteGroup = async (voucherNumber, supplierName) => {
    if (!window.confirm(`Are you sure you want to delete ALL stock entries for voucher ${voucherNumber} from ${supplierName}? This will reverse batch quantities.`)) return;
    try {
      await api.delete('/batches/stock-entry-group', { params: { voucher_number: voucherNumber } });
      showToast('Stock entries deleted successfully');
      fetchData(tab, filterProductId, filterSupplierId, fromDate, toDate, page);
    } catch (err) {
      showToast((err.response?.data?.error?.message || err.response?.data?.error) || 'Failed to delete stock entries', 'error');
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Material In</h2>
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
            options={products.map((p) => ({ value: p.id, label: p.product_name }))}
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
          <DateInput
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-40 text-sm"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
          <DateInput
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-40 text-sm"
          />
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      {tab === 'entries' && entries.length > 0 && !loading && (
        <div className="hidden md:flex gap-4 mb-3 px-3 py-1.5 bg-gray-50 rounded text-xs text-gray-500 border border-gray-200 w-fit">
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono">&uarr;&darr;</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono">Enter</kbd> View</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono">E</kbd> Edit</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono">D</kbd> Delete</span>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : tab === 'entries' ? (
        /* Stock Entries Tab */
        entries.length === 0 ? (
          <p className="text-gray-500">No stock entries found.</p>
        ) : (
          <>
          {/* Mobile cards - supplier groups */}
          <div className="md:hidden space-y-3">
            {entries.map((g, idx) => (
              <div
                key={g.voucher_number}
                className={`bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer active:bg-gray-50 ${selectedIndex === idx ? 'ring-2 ring-yellow-400 bg-yellow-50' : ''}`}
                onClick={() => { setSelectedIndex(idx); navigate(`/batches/view?voucher=${g.voucher_number}`); }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-900">{g.supplier_name}</span>
                    {g.party_name && <span className="text-xs text-gray-400 ml-1">({g.party_name})</span>}
                  </div>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">
                    +{g.total_quantity}
                  </span>
                </div>
                {g.voucher_number && (
                  <div className="text-sm text-gray-500">
                    <span className="text-gray-400">Voucher:</span>{' '}
                    <span className="font-medium text-gray-700">{g.voucher_number}</span>
                    {g.reference_number && <span className="text-xs text-gray-400 ml-1">({g.reference_number})</span>}
                  </div>
                )}
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Date:</span>{' '}
                  {fmtDate(g.received_date)}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Items:</span> {g.item_count} products
                </div>
                <div className="flex gap-3 mt-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/batches/stock-entries/${g.first_entry_id}/edit`); }}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.voucher_number, g.supplier_name); }}
                    className="text-red-600 hover:text-red-800 text-xs font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table - supplier groups */}
          <div className="hidden md:block overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher #</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((g, idx) => (
                  <tr
                    key={g.voucher_number}
                    className={`cursor-pointer ${selectedIndex === idx ? 'bg-yellow-50 ring-2 ring-inset ring-yellow-400' : 'hover:bg-gray-50'}`}
                    onClick={() => { setSelectedIndex(idx); navigate(`/batches/view?voucher=${g.voucher_number}`); }}
                  >
                    <td className="px-5 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">
                      <div>{g.voucher_number || '\u2014'}</div>
                      {g.reference_number && <div className="text-xs text-gray-400">{g.reference_number}</div>}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {fmtDate(g.received_date)}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <div className="font-medium text-gray-800">{g.supplier_name}</div>
                      {g.party_name && <div className="text-xs text-gray-400">{g.party_name}</div>}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                        {g.item_count} products
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">
                        +{g.total_quantity}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <div className="flex gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/batches/stock-entries/${g.first_entry_id}/edit`); }}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g.voucher_number, g.supplier_name); }}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={entriesTotal} limit={limit} onPageChange={handlePageChange} onLimitChange={handleLimitChange} />
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
                  <span className="text-gray-400">First Received:</span> {fmtDate(b.received_date)}
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
                      {fmtDate(b.received_date)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={batchesTotal} limit={limit} onPageChange={handlePageChange} onLimitChange={handleLimitChange} />
          </>
        )
      )}
    </div>
  );
}
