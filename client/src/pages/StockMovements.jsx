import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';

const today = () => new Date().toISOString().split('T')[0];

export default function StockMovements() {
  const [movements, setMovements] = useState([]);
  const [total, setTotal] = useState(0);
  const [products, setProducts] = useState([]);
  const [filterProductId, setFilterProductId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMovements = async (productId, movementType, fd, td, pg) => {
    try {
      setLoading(true);
      const params = { page: pg, limit: 20 };
      if (productId) params.product_id = productId;
      if (movementType) params.movement_type = movementType;
      if (fd) params.from_date = fd;
      if (td) params.to_date = td;
      const res = await api.get('/inventory', { params });
      setMovements(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load stock movements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
    fetchMovements('', '', fromDate, toDate, 1);
  }, []);

  const handleProductFilter = (val) => {
    setFilterProductId(val);
    setPage(1);
    fetchMovements(val, filterType, fromDate, toDate, 1);
  };

  const handleTypeFilter = (e) => {
    const val = e.target.value;
    setFilterType(val);
    setPage(1);
    fetchMovements(filterProductId, val, fromDate, toDate, 1);
  };

  const handleFromDate = (e) => {
    const val = e.target.value;
    setFromDate(val);
    setPage(1);
    fetchMovements(filterProductId, filterType, val, toDate, 1);
  };

  const handleToDate = (e) => {
    const val = e.target.value;
    setToDate(val);
    setPage(1);
    fetchMovements(filterProductId, filterType, fromDate, val, 1);
  };

  const handlePageChange = (pg) => {
    setPage(pg);
    fetchMovements(filterProductId, filterType, fromDate, toDate, pg);
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

      <h2 className="text-2xl font-bold text-gray-800 mb-6">Stock Movements</h2>

      <div className="flex gap-4 mb-4 flex-wrap items-end">
        <div className="w-full sm:w-56">
          <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
          <SearchableSelect
            options={products.map((p) => ({ value: p.id, label: p.product_name, sublabel: p.product_code }))}
            value={filterProductId}
            onChange={handleProductFilter}
            placeholder="All Products"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-sm font-medium text-gray-700 mb-1">Movement Type</label>
          <select
            value={filterType}
            onChange={handleTypeFilter}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-40"
          >
            <option value="">All</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={handleFromDate}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-40"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={handleToDate}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-40"
          />
        </div>
        <div className="w-full sm:w-64 sm:ml-auto">
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by product, batch, invoice..."
            className="border border-gray-300 rounded px-3 py-2 w-full"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : movements.length === 0 ? (
        <p className="text-gray-500">No stock movements found.</p>
      ) : (() => {
        const term = searchTerm.toLowerCase().trim();
        const filtered = term
          ? movements.filter((m) => {
              const date = new Date(m.created_at).toLocaleDateString().toLowerCase();
              const product = (m.product_name || '').toLowerCase();
              const batch = (m.batch_number || '').toLowerCase();
              const qty = String(m.quantity);
              const type = (m.movement_type || '').toLowerCase();
              const invoice = (m.invoice_number || m.reference_type || '').toLowerCase();
              return date.includes(term) || product.includes(term) || batch.includes(term) || qty.includes(term) || type.includes(term) || invoice.includes(term);
            })
          : movements;

        return filtered.length === 0 ? (
          <p className="text-gray-500">No matching movements found.</p>
        ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((m) => (
              <div key={m.id} className="bg-white rounded-lg shadow p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{m.product_name}</span>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      m.movement_type === 'IN'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {m.movement_type}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Date:</span> {new Date(m.created_at).toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Batch:</span> {m.batch_number || '\u2014'}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Quantity:</span> {m.quantity}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Reference:</span>{' '}
                  {m.reference_type === 'ORDER' && m.reference_id ? (
                    <button
                      onClick={() => navigate(`/orders/${m.reference_id}`)}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      {m.invoice_number || `Order #${m.reference_id}`}
                    </button>
                  ) : (
                    <span>{m.reference_type || '\u2014'}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white rounded shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{m.product_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{m.batch_number || '\u2014'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{m.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          m.movement_type === 'IN'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {m.reference_type === 'ORDER' && m.reference_id ? (
                        <button
                          onClick={() => navigate(`/orders/${m.reference_id}`)}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          {m.invoice_number || `Order #${m.reference_id}`}
                        </button>
                      ) : (
                        <span>{m.reference_type || '\u2014'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={total} limit={20} onPageChange={handlePageChange} />
        </>
        );
      })()}
    </div>
  );
}
