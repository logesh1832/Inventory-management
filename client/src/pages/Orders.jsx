import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import { fmtDate } from '../utils/date';
import DateInput from '../components/DateInput';

const today = () => new Date().toISOString().split('T')[0];

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [customers, setCustomers] = useState([]);
  const [filters, setFilters] = useState({
    customer_id: '',
    status: '',
    from_date: today(),
    to_date: today(),
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchOrders = async (params, pg) => {
    try {
      setLoading(true);
      const cleanParams = { page: pg, limit: 20 };
      Object.entries(params).forEach(([k, v]) => {
        if (v) cleanParams[k] = v;
      });
      const res = await api.get('/orders', { params: cleanParams });
      setOrders(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
    fetchOrders(filters, 1);
  }, []);

  const handleFilterChange = (e) => {
    const updated = { ...filters, [e.target.name]: e.target.value };
    setFilters(updated);
    setPage(1);
    fetchOrders(updated, 1);
  };

  const handlePageChange = (pg) => {
    setPage(pg);
    fetchOrders(filters, pg);
  };

  const handleDeleteOrder = async (orderId, invoiceNumber) => {
    if (!window.confirm(`Are you sure you want to delete order ${invoiceNumber}? This will reverse all stock movements.`)) return;
    try {
      await api.delete(`/orders/${orderId}`);
      showToast('Order deleted successfully');
      fetchOrders(filters, page);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete order', 'error');
    }
  };

  // Reset selectedIndex when orders data changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [orders]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e) => {
    if (loading || orders.length === 0) return;
    // Don't intercept when user is typing in an input/select
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, orders.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter': {
        e.preventDefault();
        const order = orders[selectedIndex];
        if (order) navigate(`/orders/${order.id}`);
        break;
      }
      case 'e':
      case 'E': {
        e.preventDefault();
        const order = orders[selectedIndex];
        if (order) navigate(`/orders/${order.id}/edit`);
        break;
      }
      case 'd':
      case 'D': {
        e.preventDefault();
        const order = orders[selectedIndex];
        if (order) handleDeleteOrder(order.id, order.invoice_number);
        break;
      }
      default:
        break;
    }
  }, [loading, orders, selectedIndex, navigate, handleDeleteOrder]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
        <h2 className="text-2xl font-bold text-gray-800">Material Out</h2>
        <Link
          to="/orders/new"
          className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors text-center"
        >
          Create New
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
          <DateInput
            name="from_date"
            value={filters.from_date}
            onChange={handleFilterChange}
            className="border border-gray-300 rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <DateInput
            name="to_date"
            value={filters.to_date}
            onChange={handleFilterChange}
            className="border border-gray-300 rounded px-3 py-2 w-full"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
        <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono text-gray-700">↑↓</kbd> Navigate</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono text-gray-700">Enter</kbd> View</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono text-gray-700">E</kbd> Edit</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono text-gray-700">D</kbd> Delete</span>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-500">No orders found.</p>
      ) : (
        <>
        {/* Mobile cards */}
        <div className="md:hidden space-y-3">
          {orders.map((o, idx) => (
            <div
              key={o.id}
              onClick={() => { setSelectedIndex(idx); navigate(`/orders/${o.id}`); }}
              className={`rounded-lg shadow p-4 space-y-2 cursor-pointer active:bg-gray-50 ${
                idx === selectedIndex ? 'bg-yellow-50 ring-2 ring-yellow-400' : 'bg-white'
              }`}
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
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Date:</span> {fmtDate(o.order_date)}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/orders/${o.id}/edit`); }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o.id, o.invoice_number); }}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((o, idx) => (
                <tr
                  key={o.id}
                  onClick={() => { setSelectedIndex(idx); navigate(`/orders/${o.id}`); }}
                  className={`cursor-pointer ${
                    idx === selectedIndex
                      ? 'bg-yellow-50 ring-2 ring-inset ring-yellow-400'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{o.invoice_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{o.customer_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {fmtDate(o.order_date)}
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/orders/${o.id}/edit`); }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteOrder(o.id, o.invoice_number); }}
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

        <Pagination page={page} total={total} limit={20} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
}
