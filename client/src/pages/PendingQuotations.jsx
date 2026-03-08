import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

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
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CONVERTED_TO_ORDER: 'Converted',
  };
  return map[status] || status;
};

export default function PendingQuotations() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('SUBMITTED');

  const fetchQuotations = async () => {
    try {
      const params = {};
      if (filter) params.status = filter;
      const { data } = await api.get('/quotations', { params });
      setQuotations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchQuotations();
  }, [filter]);

  if (loading) return <p className="text-gray-500">Loading quotations...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Quotation Review</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
        >
          <option value="SUBMITTED">Pending Review</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CONVERTED_TO_ORDER">Converted</option>
          <option value="">All</option>
        </select>
      </div>

      {quotations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No quotations found for the selected filter.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Quotation #</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Salesperson</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {quotations.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{q.quotation_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{q.salesperson_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{q.customer_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(q.quotation_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-500">{q.item_count}</td>
                  <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(q.total_amount)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusBadge(q.status)}`}>
                      {statusLabel(q.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/quotations/${q.id}/review`}
                      className="text-yellow-600 hover:text-yellow-700 text-sm font-medium"
                    >
                      Review
                    </Link>
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
