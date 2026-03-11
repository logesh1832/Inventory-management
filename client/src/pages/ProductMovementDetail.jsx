import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import Pagination from '../components/Pagination';

export default function ProductMovementDetail() {
  const { id: productId } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [movements, setMovements] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [movLoading, setMovLoading] = useState(false);

  useEffect(() => {
    api.get(`/inventory/live-stock/${productId}`)
      .then((res) => setProduct(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId]);

  const fetchMovements = async (fd, td, type, pg) => {
    setMovLoading(true);
    try {
      const params = { page: pg, limit: 20 };
      if (fd) params.from_date = fd;
      if (td) params.to_date = td;
      if (type) params.movement_type = type;
      const res = await api.get(`/inventory/product-movements/${productId}`, { params });
      setMovements(res.data.data);
      setTotal(res.data.total);
      setTotalIn(res.data.total_in);
      setTotalOut(res.data.total_out);
    } catch {
      // ignore
    } finally {
      setMovLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements('', '', '', 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleFilter = (fd, td, type) => {
    setPage(1);
    fetchMovements(fd, td, type, 1);
  };

  const handlePageChange = (pg) => {
    setPage(pg);
    fetchMovements(fromDate, toDate, filterType, pg);
  };

  if (loading) return <p className="text-gray-500 p-6">Loading...</p>;
  if (!product) return <p className="text-gray-500 p-6">Product not found.</p>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Product Movement Detail</h2>
        <Link
          to="/stock-report"
          className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors text-sm font-semibold text-center"
        >
          Back to Reports
        </Link>
      </div>

      {/* Product Info Card */}
      <div className="bg-white rounded-lg shadow p-5 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{product.product.product_name}</h3>
            <p className="text-sm text-gray-500 mt-1">
              Code: <span className="font-medium text-gray-700">{product.product.product_code}</span>
              <span className="mx-2">|</span>
              Unit: <span className="font-medium text-gray-700">{product.product.unit}</span>
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-gray-500">Current Stock</p>
            <p className="text-2xl font-bold text-gray-800">{product.total_stock}</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="flex flex-wrap gap-4">
          <div className="bg-green-50 rounded-lg px-4 py-3 min-w-[120px]">
            <p className="text-xs text-green-600 font-medium">Total In</p>
            <p className="text-xl font-bold text-green-800">+{totalIn}</p>
          </div>
          <div className="bg-red-50 rounded-lg px-4 py-3 min-w-[120px]">
            <p className="text-xs text-red-600 font-medium">Total Out</p>
            <p className="text-xl font-bold text-red-800">-{totalOut}</p>
          </div>
          <div className="bg-blue-50 rounded-lg px-4 py-3 min-w-[120px]">
            <p className="text-xs text-blue-600 font-medium">Total Movements</p>
            <p className="text-xl font-bold text-blue-800">{total}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); handleFilter(e.target.value, toDate, filterType); }}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-40 text-sm"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); handleFilter(fromDate, e.target.value, filterType); }}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-40 text-sm"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); handleFilter(fromDate, toDate, e.target.value); }}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-32 text-sm"
          >
            <option value="">All</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
        </div>
      </div>

      {/* Movements Table */}
      {movLoading ? (
        <p className="text-gray-500">Loading movements...</p>
      ) : movements.length === 0 ? (
        <p className="text-gray-500">No movements found for this product.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {movements.map((m) => (
              <div key={m.id} className="bg-white rounded-lg shadow p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">{new Date(m.created_at).toLocaleDateString()}</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      m.movement_type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {m.movement_type === 'IN' ? '+' : '-'}{m.quantity}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Batch:</span> {m.batch_number || '\u2014'}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">
                    {m.movement_type === 'IN' ? 'Supplier' : 'Customer'}:
                  </span>{' '}
                  {m.supplier_name || m.customer_name || '\u2014'}
                </div>
                {m.reference_type === 'ORDER' && m.reference_id && (
                  <div>
                    <button
                      onClick={() => navigate(`/orders/${m.reference_id}`)}
                      className="text-blue-600 hover:text-blue-800 hover:underline text-xs font-medium"
                    >
                      {m.invoice_number || `Order #${m.reference_id}`}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch #</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier / Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {movements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-sm">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          m.movement_type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {m.movement_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm font-medium">
                      {m.movement_type === 'IN' ? '+' : '-'}{m.quantity}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{m.batch_number || '\u2014'}</td>
                    <td className="px-5 py-3 text-sm text-gray-600">{m.supplier_name || m.customer_name || '\u2014'}</td>
                    <td className="px-5 py-3 text-sm">
                      {m.reference_type === 'ORDER' && m.reference_id ? (
                        <button
                          onClick={() => navigate(`/orders/${m.reference_id}`)}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          {m.invoice_number || `Order #${m.reference_id}`}
                        </button>
                      ) : (
                        <span className="text-gray-400">{m.reference_type || '\u2014'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={total} limit={20} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
}
