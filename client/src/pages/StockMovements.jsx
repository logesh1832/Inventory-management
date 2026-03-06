import { useState, useEffect } from 'react';
import api from '../services/api';

export default function StockMovements() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterProductId, setFilterProductId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMovements = async (productId, movementType) => {
    try {
      setLoading(true);
      const params = {};
      if (productId) params.product_id = productId;
      if (movementType) params.movement_type = movementType;
      const res = await api.get('/inventory', { params });
      setMovements(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load stock movements', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
    fetchMovements('', '');
  }, []);

  const handleProductFilter = (e) => {
    const val = e.target.value;
    setFilterProductId(val);
    fetchMovements(val, filterType);
  };

  const handleTypeFilter = (e) => {
    const val = e.target.value;
    setFilterType(val);
    fetchMovements(filterProductId, val);
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

      <div className="flex gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
          <select
            value={filterProductId}
            onChange={handleProductFilter}
            className="border border-gray-300 rounded px-3 py-2 w-56"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.product_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Movement Type</label>
          <select
            value={filterType}
            onChange={handleTypeFilter}
            className="border border-gray-300 rounded px-3 py-2 w-40"
          >
            <option value="">All</option>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : movements.length === 0 ? (
        <p className="text-gray-500">No stock movements found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{m.product_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{m.batch_number || '—'}</td>
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
                  <td className="px-6 py-4 whitespace-nowrap">{m.reference_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
