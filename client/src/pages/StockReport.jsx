import { useState, useEffect, Fragment } from 'react';
import api from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const stockBadge = (qty) => {
  if (qty < 50) return 'bg-red-100 text-red-700';
  if (qty <= 200) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};

const barColor = (qty) => {
  if (qty < 50) return '#ef4444';
  if (qty <= 200) return '#eab308';
  return '#22c55e';
};

export default function StockReport() {
  const [stock, setStock] = useState([]);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [batchData, setBatchData] = useState(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStock = async (lowStock) => {
    try {
      setLoading(true);
      const params = {};
      if (lowStock) params.low_stock_threshold = 50;
      const res = await api.get('/inventory/stock-report', { params });
      setStock(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load stock report', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock(false);
  }, []);

  const handleLowStockToggle = () => {
    const next = !lowStockOnly;
    setLowStockOnly(next);
    setExpandedProduct(null);
    setBatchData(null);
    fetchStock(next);
  };

  const toggleExpand = async (productId) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      setBatchData(null);
      return;
    }
    try {
      const res = await api.get(`/inventory/live-stock/${productId}`);
      setBatchData(res.data);
      setExpandedProduct(productId);
    } catch (err) {
      showToast('Failed to load batch details', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Stock Report</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={handleLowStockToggle}
            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm font-medium text-gray-700">Low stock only (&lt; 50)</span>
        </label>
      </div>

      {/* Bar Chart */}
      {!loading && stock.length > 0 && (
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Stock Levels by Product</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stock} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="product_code" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip
                formatter={(value) => [value, 'Stock']}
                labelFormatter={(label) => {
                  const p = stock.find((s) => s.product_code === label);
                  return p ? p.product_name : label;
                }}
              />
              <Bar dataKey="total_stock" radius={[4, 4, 0, 0]}>
                {stock.map((entry, index) => (
                  <Cell key={index} fill={barColor(entry.total_stock)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stock Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : stock.length === 0 ? (
        <p className="text-gray-500">No products found.</p>
      ) : (
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stock.map((p) => (
                <Fragment key={p.product_id}>
                  <tr
                    onClick={() => toggleExpand(p.product_id)}
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
                      {expandedProduct === p.product_id ? 'Collapse' : 'Expand'}
                    </td>
                  </tr>
                  {expandedProduct === p.product_id && batchData && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 bg-gray-50">
                        {batchData.batches.length === 0 ? (
                          <p className="text-sm text-gray-500">No batches for this product.</p>
                        ) : (
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch #</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty Added</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty Remaining</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Received Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {batchData.batches.map((b) => (
                                <tr
                                  key={b.batch_id}
                                  className={b.quantity_remaining === 0 ? 'text-gray-400' : ''}
                                >
                                  <td className="px-4 py-2 text-sm">{b.batch_number}</td>
                                  <td className="px-4 py-2 text-sm">{b.quantity_added}</td>
                                  <td className="px-4 py-2 text-sm">{b.quantity_remaining}</td>
                                  <td className="px-4 py-2 text-sm">
                                    {new Date(b.received_date).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
