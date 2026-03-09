import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState({
    customer_id: '',
    status: '',
    from_date: '',
    to_date: '',
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchOrders = async (params) => {
    try {
      setLoading(true);
      const cleanParams = {};
      Object.entries(params).forEach(([k, v]) => {
        if (v) cleanParams[k] = v;
      });
      const res = await api.get('/orders', { params: cleanParams });
      setOrders(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
    fetchOrders(filters);
  }, []);

  const handleFilterChange = (e) => {
    const updated = { ...filters, [e.target.name]: e.target.value };
    setFilters(updated);
    fetchOrders(updated);
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
        <h2 className="text-2xl font-bold text-gray-800">Orders</h2>
        <Link
          to="/orders/new"
          className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors text-center"
        >
          Create New Order
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
          <SearchableSelect
            options={customers.map((c) => ({ value: c.id, label: c.customer_name }))}
            value={filters.customer_id}
            onChange={(val) => handleFilterChange({ target: { name: 'customer_id', value: val } })}
            placeholder="All Customers"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="border border-gray-300 rounded px-3 py-2 w-full"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
          <input
            type="date"
            name="from_date"
            value={filters.from_date}
            onChange={handleFilterChange}
            className="border border-gray-300 rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <input
            type="date"
            name="to_date"
            value={filters.to_date}
            onChange={handleFilterChange}
            className="border border-gray-300 rounded px-3 py-2 w-full"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-500">No orders found.</p>
      ) : (
        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {orders.map((o) => (
            <div
              key={o.id}
              onClick={() => navigate(`/orders/${o.id}`)}
              className="bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer active:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900">{o.invoice_number}</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    o.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {o.status}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                <span className="text-gray-400">Customer:</span> {o.customer_name}
              </div>
              <div className="text-sm text-gray-500">
                <span className="text-gray-400">Date:</span> {new Date(o.order_date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto bg-white rounded shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{o.invoice_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{o.customer_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(o.order_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        o.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
