import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const stockBadge = (qty) => {
  if (qty < 50) return 'bg-red-100 text-red-700';
  if (qty <= 200) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};

export default function ProductReport() {
  const navigate = useNavigate();
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    api.get('/inventory/stock-report')
      .then((res) => setStock(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const term = searchTerm.toLowerCase().trim();
  const filtered = term
    ? stock.filter((p) => {
        const name = (p.product_name || '').toLowerCase();
        const code = (p.product_code || '').toLowerCase();
        return name.includes(term) || code.includes(term);
      })
    : stock;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Product Report</h2>
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-72">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search Product</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or code..."
            className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500">No products found.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((p) => (
              <div
                key={p.product_id}
                onClick={() => navigate(`/product-report/${p.product_id}`)}
                className="bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer active:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{p.product_name}</span>
                  <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${stockBadge(p.total_stock)}`}>
                    {p.total_stock}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Code:</span> {p.product_code}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Unit:</span> {p.unit}
                </div>
                <div className="text-xs text-gray-400">Tap to view movements</div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((p) => (
                  <tr
                    key={p.product_id}
                    onClick={() => navigate(`/product-report/${p.product_id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{p.product_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.product_code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.unit}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${stockBadge(p.total_stock)}`}>
                        {p.total_stock}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      View Details
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
