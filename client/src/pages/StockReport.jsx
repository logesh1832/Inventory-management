import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
const stockBadge = (qty, threshold = 50) => {
  if (qty < threshold) return 'bg-red-100 text-red-700';
  if (qty <= threshold * 4) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};

// total_stock is stored in PCS for products with sub_unit; convert to Boxes for primary display
const primaryStock = (p) => {
  if (p.sub_unit && p.qty_per_box) return Math.floor(p.total_stock / p.qty_per_box);
  return p.total_stock;
};

export default function StockReport() {
  const navigate = useNavigate();
  const [stock, setStock] = useState([]);
  const [categories, setCategories] = useState([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchStock = async (lowStock, category) => {
    try {
      setLoading(true);
      const params = {};
      if (lowStock) params.low_stock = true;
      if (category) params.category = category;
      const res = await api.get('/inventory/stock-report', { params });
      setStock(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock(false, '');
    api.get('/categories').then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  const handleLowStockToggle = () => {
    const next = !lowStockOnly;
    setLowStockOnly(next);
    fetchStock(next, selectedCategory);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    fetchStock(lowStockOnly, e.target.value);
  };

  const term = searchTerm.toLowerCase().trim();
  const filtered = term
    ? stock.filter((p) => (p.product_name || '').toLowerCase().includes(term) || (p.product_code || '').toLowerCase().includes(term))
    : stock;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-800">Reports</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={handleLowStockToggle}
            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm font-medium text-gray-700">Low stock only</span>
        </label>
      </div>


      {/* Search & Filters */}
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
        <div className="w-full sm:w-52">
          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="border border-gray-300 rounded px-3 py-2 w-full text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stock Table */}
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
                  <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${stockBadge(primaryStock(p), p.low_stock_threshold)}`}>
                    {primaryStock(p)} {p.unit}
                    {p.sub_unit && p.qty_per_box && p.total_stock % p.qty_per_box > 0 && (
                      <span className="font-normal ml-1">+ {p.total_stock % p.qty_per_box} {p.sub_unit}</span>
                    )}
                  </span>
                </div>
                {p.sub_unit && p.qty_per_box && (
                  <div className="text-xs text-gray-400">{p.total_stock} {p.sub_unit} total</div>
                )}
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Code:</span> {p.product_code}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Unit:</span> {p.unit}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Threshold:</span> {p.low_stock_threshold ?? 50}
                </div>
                <div className="text-xs text-gray-400">Tap to view movements</div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threshold</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((p) => (
                  <tr
                    key={p.product_id}
                    onClick={() => navigate(`/product-report/${p.product_id}`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium text-sm text-gray-800">{p.product_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{p.product_code}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-block px-2 py-1 rounded text-sm font-semibold ${stockBadge(primaryStock(p), p.low_stock_threshold)}`}>
                        {primaryStock(p)} {p.unit}
                        {p.sub_unit && p.qty_per_box && p.total_stock % p.qty_per_box > 0 && (
                          <span className="font-normal ml-1">+ {p.total_stock % p.qty_per_box} {p.sub_unit}</span>
                        )}
                      </span>
                      {p.sub_unit && p.qty_per_box && (
                        <p className="text-xs text-gray-400 mt-0.5">{p.total_stock} {p.sub_unit}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{p.unit}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {p.low_stock_threshold ?? 50}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-500 font-medium">
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
