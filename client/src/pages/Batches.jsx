import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Batches() {
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterProductId, setFilterProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBatches = async (productId) => {
    try {
      setLoading(true);
      const params = productId ? { product_id: productId } : {};
      const res = await api.get('/batches', { params });
      setBatches(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load batches', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/products').then((res) => setProducts(res.data)).catch(() => {});
    fetchBatches('');
  }, []);

  const handleFilterChange = (e) => {
    const val = e.target.value;
    setFilterProductId(val);
    fetchBatches(val);
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

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Batches</h2>
        <Link
          to="/batches/new"
          className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors"
        >
          Add New Batch
        </Link>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Product</label>
        <select
          value={filterProductId}
          onChange={handleFilterChange}
          className="border border-gray-300 rounded px-3 py-2 w-64"
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.product_name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : batches.length === 0 ? (
        <p className="text-gray-500">No batches found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty Received</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty Remaining</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {batches.map((b) => (
                <tr
                  key={b.id}
                  className={b.quantity_remaining === 0 ? 'bg-gray-100 text-gray-400' : ''}
                >
                  <td className="px-6 py-4 whitespace-nowrap">{b.batch_number}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{b.product_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{b.quantity_received}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{b.quantity_remaining}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(b.received_date).toLocaleDateString()}
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
