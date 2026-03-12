import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { fmtDate } from '../utils/date';

const stockBadge = (qty) => {
  if (qty < 50) return 'bg-red-100 text-red-700';
  if (qty <= 200) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};

const statusBadge = (status) => {
  const map = {
    completed: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};

const formatINR = (val) =>
  parseFloat(val || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.get('/dashboard/inventory')
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!data) return <p className="text-red-500">Failed to load dashboard.</p>;

  const cards = [
    { label: 'Total Products', value: data.total_products, color: 'bg-blue-500', link: '/products' },
    { label: 'Stock Value', value: formatINR(data.total_stock_value), color: 'bg-green-500', isText: true, link: '/stock-report' },
    { label: 'Total Customers', value: data.total_customers, color: 'bg-purple-500', link: '/customers' },
    { label: 'Total Material Out', value: data.total_orders, color: 'bg-indigo-500', link: '/orders' },
    { label: 'Low Stock Alerts', value: data.low_stock_count, color: data.low_stock_count > 0 ? 'bg-red-500' : 'bg-gray-400', link: '/stock-report' },
  ];

  if (user?.role === 'admin') {
    cards.push(
      { label: 'Total Users', value: data.total_users, color: 'bg-teal-500', link: '/users' },
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

      {/* Summary Cards */}
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${user?.role === 'admin' ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-3`}>
        {cards.map((card) => (
          <div
            key={card.label}
            onClick={() => card.link && navigate(card.link)}
            className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
          >
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            <p className={`font-bold text-gray-800 ${card.isText ? 'text-base' : 'text-xl'}`}>{card.value}</p>
            <div className={`w-full h-1 rounded mt-2 ${card.color} opacity-30`} />
          </div>
        ))}
      </div>

      {/* Recent Orders + Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Recent Material Out</h3>
            <Link to="/orders" className="text-sm text-yellow-600 hover:underline">View All</Link>
          </div>
          {!data.recent_orders || data.recent_orders.length === 0 ? (
            <p className="px-5 py-4 text-gray-400 text-sm">No orders yet.</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {data.recent_orders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">{o.invoice_number}</p>
                    <p className="text-xs text-gray-500">{o.customer_name} &middot; {fmtDate(o.order_date)}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge(o.status)}`}>
                    {o.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Movements */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Recent Stock Movements</h3>
            <Link to="/stock-movements" className="text-sm text-yellow-600 hover:underline">View All</Link>
          </div>
          {!data.recent_movements || data.recent_movements.length === 0 ? (
            <p className="px-5 py-4 text-gray-400 text-sm">No movements yet.</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {data.recent_movements.map((m) => (
                <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.product_name}</p>
                    <p className="text-xs text-gray-500">{m.batch_number || '-'} &middot; {fmtDate(m.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{m.quantity}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${m.movement_type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {m.movement_type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Product Stock Summary */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-800 flex-shrink-0">Product Stock Summary</h3>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full sm:w-56 focus:outline-none focus:ring-1 focus:ring-yellow-500"
            />
            <Link to="/stock-report" className="text-sm text-yellow-600 hover:underline flex-shrink-0">Full Report</Link>
          </div>
        </div>
        {!data.stock_summary || data.stock_summary.length === 0 ? (
          <p className="px-5 py-4 text-gray-400">No products found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.stock_summary
                  .filter((p) => {
                    if (!searchTerm) return true;
                    const t = searchTerm.toLowerCase();
                    return p.product_name.toLowerCase().includes(t) || p.product_code.toLowerCase().includes(t);
                  })
                  .map((p) => (
                    <tr key={p.product_id} className={`hover:bg-gray-50 ${p.total_stock < 50 ? 'bg-red-50' : ''}`}>
                      <td className="px-5 py-3 text-sm font-medium text-gray-800">{p.product_name}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{p.product_code}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{p.unit}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-sm font-semibold ${stockBadge(p.total_stock)}`}>
                          {p.total_stock}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
