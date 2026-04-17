import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Pagination from '../components/Pagination';

const stockBadge = (qty, threshold = 50) => {
  if (qty < threshold) return 'bg-red-100 text-red-700';
  if (qty <= threshold * 4) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
};

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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);

  const fetchStock = useCallback(async (pg, lim, lowStock, category, search) => {
    try {
      setLoading(true);
      const params = { page: pg, limit: lim };
      if (lowStock) params.low_stock = true;
      if (category) params.category = category;
      if (search) params.search = search;
      const res = await api.get('/inventory/stock-report', { params });
      setStock(res.data.data);
      setTotal(res.data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStock(1, limit, false, '', '');
    api.get('/products/categories').then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  const handleLowStockToggle = () => {
    const next = !lowStockOnly;
    setLowStockOnly(next);
    setPage(1);
    fetchStock(1, limit, next, selectedCategory, searchTerm);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setPage(1);
    fetchStock(1, limit, lowStockOnly, e.target.value, searchTerm);
  };

  const handleSearch = (val) => {
    setSearchTerm(val);
    setPage(1);
    fetchStock(1, limit, lowStockOnly, selectedCategory, val);
  };

  const handlePageChange = (pg) => {
    setPage(pg);
    fetchStock(pg, limit, lowStockOnly, selectedCategory, searchTerm);
  };

  const handleLimitChange = (lim) => {
    setLimit(lim);
    setPage(1);
    fetchStock(1, lim, lowStockOnly, selectedCategory, searchTerm);
  };

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

      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-full sm:w-72">
          <label className="block text-xs font-medium text-gray-500 mb-1">Search Product</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name..."
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
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : stock.length === 0 ? (
        <p className="text-gray-500">No products found.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {stock.map((p) => (
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
                <div className="text-sm text-gray-500"><span className="text-gray-400">Unit:</span> {p.unit}</div>
                <div className="text-sm text-gray-500"><span className="text-gray-400">Threshold:</span> {p.low_stock_threshold ?? 50}</div>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threshold</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stock.map((p) => (
                  <tr key={p.product_id} onClick={() => navigate(`/product-report/${p.product_id}`)} className="cursor-pointer hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-sm text-gray-800">{p.product_name}</td>
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
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{p.low_stock_threshold ?? 50}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-blue-500 font-medium">View Details</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} total={total} limit={limit} onPageChange={handlePageChange} onLimitChange={handleLimitChange} />
        </>
      )}
    </div>
  );
}
