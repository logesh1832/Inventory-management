import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { fmtDate } from '../utils/date';
import DateInput from '../components/DateInput';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CONVERTED_TO_ORDER', label: 'Converted to Order' },
];

const statusBadge = (status) => {
  const map = {
    DRAFT: 'bg-gray-200 text-gray-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    CONVERTED_TO_ORDER: 'bg-purple-100 text-purple-800',
  };
  return map[status] || 'bg-gray-200 text-gray-800';
};

const statusLabel = (status) => {
  const map = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CONVERTED_TO_ORDER: 'Converted',
  };
  return map[status] || status;
};

export default function MyQuotations() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [search, setSearch] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchQuotations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/quotations${query}`);
      setQuotations(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load quotations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [statusFilter, fromDate, toDate]);

  // Client-side search by quotation number
  const filtered = quotations.filter((q) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const qNum = (q.quotation_number || '').toLowerCase();
    const custName = (q.customer_name || '').toLowerCase();
    return qNum.includes(s) || custName.includes(s);
  });

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
        <h2 className="text-2xl font-bold text-gray-800">My Quotations</h2>
        <Link
          to="/quotations/new"
          className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors font-medium"
        >
          + New Quotation
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded shadow p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input
              type="text"
              placeholder="Quotation # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
            <DateInput
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
            <DateInput
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded shadow overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading quotations...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No quotations found.{' '}
            <Link to="/quotations/new" className="text-blue-600 hover:underline">
              Create one
            </Link>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quotation #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Items
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total Amount
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((q) => (
                <tr
                  key={q.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/quotations/${q.id}`)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-700">
                    {q.quotation_number || `#${q.id}`}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                    {q.customer_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {q.quotation_date
                      ? fmtDate(q.quotation_date)
                      : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                    {q.item_count ?? q.items_count ?? '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-800">
                    {formatCurrency(q.total_amount)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge(
                        q.status
                      )}`}
                    >
                      {statusLabel(q.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
