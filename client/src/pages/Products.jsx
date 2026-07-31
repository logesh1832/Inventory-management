import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { getFileUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import usePersistedSearchParams from '../utils/usePersistedSearchParams';

export default function Products() {
  const { user } = useAuth();
  const [searchParams, setSearchParams, pendingRestore] = usePersistedSearchParams('products_filters');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [total, setTotal] = useState(0);

  const search = searchParams.get('search') || '';
  const categoryFilter = searchParams.get('category') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const isSalesperson = user?.role === 'salesperson';

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const updateParams = (updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v) next.set(k, v);
        else next.delete(k);
      });
      return next;
    });
  };

  const fetchProducts = useCallback(async (pg, lim, srch, cat) => {
    try {
      setLoading(true);
      const params = { page: pg, limit: lim };
      if (srch) params.search = srch;
      if (cat) params.category = cat;
      const { data } = await api.get('/products', { params });
      setProducts(data.data);
      setTotal(data.total);
    } catch {
      showToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.get('/products/categories').then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (pendingRestore) return; // wait for persisted filters to restore, then fetch once
    fetchProducts(page, limit, search, categoryFilter);
  }, [page, limit, search, categoryFilter, pendingRestore]);

  const handleSearch = (val) => {
    updateParams({ search: val, page: null });
  };

  const handleCategory = (val) => {
    updateParams({ category: val, page: null });
  };

  const handlePageChange = (pg) => {
    updateParams({ page: pg });
  };

  const handleLimitChange = (lim) => {
    updateParams({ limit: lim, page: null });
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/products/${id}`);
      showToast('Product deleted successfully');
      setDeleteConfirm(null);
      fetchProducts(page, limit, search, categoryFilter);
    } catch (err) {
      showToast((err.response?.data?.error?.message || err.response?.data?.error) || 'Failed to delete product', 'error');
      setDeleteConfirm(null);
    }
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.product_name}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">{isSalesperson ? 'Product Catalog' : 'Products'}</h2>
        {!isSalesperson && (
          <Link to="/products/new" className="px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 transition-colors text-center">
            + New Product
          </Link>
        )}
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 w-full sm:w-64"
        />
        <div className="w-full sm:w-56">
          <SearchableSelect
            options={categories.map((c) => ({ value: c, label: c }))}
            value={categoryFilter}
            onChange={handleCategory}
            placeholder="All Categories"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading products...</p>
      ) : products.length === 0 ? (
        <p className="text-gray-500">No products found.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {product.image_url ? (
                      <img src={getFileUrl(product.image_url)} alt={product.product_name} className="h-10 w-10 rounded object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-gray-400">{product.product_name.charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <span className="font-medium text-gray-900">{product.product_name}</span>
                  </div>
                  {!isSalesperson && (
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {product.status}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Category:</span>{' '}
                  {product.category ? (
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">{product.category}</span>
                  ) : '-'}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Unit:</span>{' '}
                  {product.sub_unit ? `${product.unit} / ${product.sub_unit}` : product.unit}
                </div>
                {!isSalesperson && (
                  <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                    <Link to={`/products/${product.id}/edit`} className="text-yellow-600 hover:text-yellow-700 text-sm">Edit</Link>
                    <button onClick={() => setDeleteConfirm(product)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  {!isSalesperson && (
                    <>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {product.image_url ? (
                        <img src={getFileUrl(product.image_url)} alt={product.product_name} className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-gray-200 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-400">{product.product_name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{product.product_name}</td>
                    <td className="px-6 py-4 text-sm">
                      {product.category ? (
                        <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">{product.category}</span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {product.sub_unit ? `${product.unit} / ${product.sub_unit}` : product.unit}
                    </td>
                    {!isSalesperson && (
                      <>
                        <td className="px-6 py-4">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {product.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link to={`/products/${product.id}/edit`} className="text-yellow-600 hover:text-yellow-700 text-sm mr-4">Edit</Link>
                          <button onClick={() => setDeleteConfirm(product)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                        </td>
                      </>
                    )}
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
