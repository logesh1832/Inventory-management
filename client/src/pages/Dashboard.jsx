import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const stockColor = (qty) => {
  if (qty < 50) return 'text-red-600 bg-red-50';
  if (qty <= 200) return 'text-yellow-700 bg-yellow-50';
  return 'text-green-700 bg-green-50';
};

const stockBadge = (qty) => {
  if (qty < 50) return 'bg-red-100 text-red-700';
  if (qty <= 200) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [stock, setStock] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, stockRes] = await Promise.all([
          api.get('/inventory/dashboard-stats'),
          api.get('/inventory/live-stock'),
        ]);
        setStats(statsRes.data);
        setStock(stockRes.data);
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <p className="text-gray-500">Loading...</p>;

  const cards = stats
    ? [
        { label: 'Total Products', value: stats.total_products, color: 'bg-blue-500' },
        { label: 'Total Stock Units', value: stats.total_stock, color: 'bg-green-500' },
        { label: 'Total Customers', value: stats.total_customers, color: 'bg-purple-500' },
        { label: 'Total Orders', value: stats.total_orders, color: 'bg-orange-500' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded shadow p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{card.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-full ${card.color} opacity-20`} />
            </div>
          </div>
        ))}
      </div>

      {/* Product Stock Summary */}
      <div className="bg-white rounded shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-800 flex-shrink-0">Product Stock Summary</h3>
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-yellow-500 focus:border-yellow-500"
            />
            <button
              onClick={() => navigate('/stock-report')}
              className="text-sm text-yellow-600 hover:underline flex-shrink-0"
            >
              View Full Report
            </button>
          </div>
        </div>
        {stock.length === 0 ? (
          <p className="px-6 py-4 text-gray-500">No products found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stock
                  .filter((p) => {
                    if (!searchTerm) return true;
                    const term = searchTerm.toLowerCase();
                    return (
                      p.product_name.toLowerCase().includes(term) ||
                      p.product_code.toLowerCase().includes(term)
                    );
                  })
                  .map((p) => (
                  <tr
                    key={p.product_id}
                    onClick={() => navigate('/stock-report')}
                    className={`cursor-pointer hover:bg-gray-50 ${stockColor(p.total_stock)}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{p.product_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{p.product_code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{p.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${stockBadge(p.total_stock)}`}>
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

      {/* Recent Activity */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Stock Movements */}
          <div className="bg-white rounded shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Recent Stock Movements</h3>
            </div>
            {stats.recent_movements.length === 0 ? (
              <p className="px-6 py-4 text-gray-500">No movements yet.</p>
            ) : (
              <div className="divide-y divide-gray-200">
                {stats.recent_movements.map((m) => (
                  <div key={m.id} className="px-6 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.product_name}</p>
                      <p className="text-xs text-gray-500">
                        {m.batch_number || '—'} &middot; {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{m.quantity}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          m.movement_type === 'IN'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {m.movement_type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Recent Orders</h3>
            </div>
            {stats.recent_orders.length === 0 ? (
              <p className="px-6 py-4 text-gray-500">No orders yet.</p>
            ) : (
              <div className="divide-y divide-gray-200">
                {stats.recent_orders.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => navigate(`/orders/${o.id}`)}
                    className="px-6 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{o.invoice_number}</p>
                      <p className="text-xs text-gray-500">
                        {o.customer_name} &middot; {new Date(o.order_date).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        o.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
