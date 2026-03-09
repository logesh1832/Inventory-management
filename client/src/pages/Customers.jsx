import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const debounceRef = useRef(null);

  const fetchCustomers = async (query = '') => {
    try {
      const params = query ? { search: query } : {};
      const { data } = await api.get('/customers', { params });
      setCustomers(data);
    } catch {
      showToast('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCustomers(value);
    }, 300);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/customers/${id}`);
      showToast('Customer deleted successfully');
      setDeleteConfirm(null);
      fetchCustomers(search);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to delete customer';
      showToast(msg, 'error');
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading customers...</div>;
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Confirm Delete</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.customer_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
        <Link
          to="/customers/new"
          className="px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 transition-colors text-center"
        >
          + New Customer
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={handleSearchChange}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
        />
      </div>

      {/* Table */}
      {customers.length === 0 ? (
        <p className="text-gray-500">
          {search ? 'No customers match your search.' : 'No customers found. Add your first customer!'}
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {customers.map((customer) => (
              <div key={customer.id} className="bg-white rounded-lg shadow p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{customer.customer_name}</span>
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Phone:</span> {customer.phone || '-'}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Email:</span> {customer.email || '-'}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="text-gray-400">Address:</span> {customer.address || '-'}
                </div>
                <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                  <Link to={`/customers/${customer.id}/edit`} className="text-yellow-600 hover:text-yellow-700 text-sm">Edit</Link>
                  <button onClick={() => setDeleteConfirm(customer)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Name</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{customer.customer_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{customer.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{customer.email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{customer.address || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/customers/${customer.id}/edit`}
                        className="text-yellow-600 hover:text-yellow-700 text-sm mr-4"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setDeleteConfirm(customer)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Delete
                      </button>
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
