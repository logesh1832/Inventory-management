import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';

const today = () => new Date().toISOString().split('T')[0];

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

  return (
    <div>
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
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">
                    +{e.quantity}
                  </span>
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
