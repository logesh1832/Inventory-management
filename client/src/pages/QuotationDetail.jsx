import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CONVERTED_TO_ORDER: 'Converted to Order',
  };
  return map[status] || status;
};

export default function QuotationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quotation, setQuotation] = useState(null);
  const [stockMap, setStockMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchQuotation = async () => {
    try {
      const qRes = await api.get(`/quotations/${id}`);
      setQuotation(qRes.data);

      // Only fetch stock for admin/inventory (salesperson doesn't have access)
      if (user?.role !== 'salesperson') {
        try {
          const batchRes = await api.get('/batches');
          const map = {};
          for (const b of batchRes.data) {
            map[b.product_id] = (map[b.product_id] || 0) + b.quantity_remaining;
          }
          setStockMap(map);
        } catch {}
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load quotation', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const handleSubmit = async () => {
    try {
      setActionLoading(true);
      await api.patch(`/quotations/${id}/submit`);
      showToast('Quotation submitted for review');
      fetchQuotation();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecall = async () => {
    try {
      setActionLoading(true);
      await api.patch(`/quotations/${id}/recall`);
      showToast('Quotation recalled to draft');
      fetchQuotation();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to recall', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      setActionLoading(true);
      const res = await api.post(`/quotations/${id}/duplicate`);
      showToast('Quotation duplicated as new draft');
      setTimeout(() => navigate(`/quotations/${res.data.id}`), 500);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to duplicate', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!quotation) return <p className="text-gray-500">Quotation not found.</p>;

  const q = quotation;
  const isOwner = user && String(user.id) === String(q.salesperson_id);
  const grandTotal = (q.items || []).reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unit_price || 0),
    0
  );

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

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Quotation Detail</h2>
        <div className="flex flex-wrap gap-2">
          {/* Action buttons based on status and ownership */}
          {isOwner && q.status === 'DRAFT' && (
            <>
              <Link
                to={`/quotations/${id}/edit`}
                className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors font-medium"
              >
                Edit
              </Link>
              <button
                onClick={handleSubmit}
                disabled={actionLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
              >
                Submit
              </button>
            </>
          )}
          {isOwner && q.status === 'SUBMITTED' && (
            <>
              <Link
                to={`/quotations/${id}/edit`}
                className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors font-medium"
              >
                Edit
              </Link>
              <button
                onClick={handleRecall}
                disabled={actionLoading}
                className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 transition-colors disabled:opacity-50 font-medium"
              >
                Recall
              </button>
            </>
          )}
          {isOwner && q.status === 'REJECTED' && (
            <Link
              to={`/quotations/${id}/edit`}
              className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors font-medium"
            >
              Edit & Resubmit
            </Link>
          )}
          {q.status === 'CONVERTED_TO_ORDER' && q.order_id && (
            <Link
              to={`/orders/${q.order_id}`}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors font-medium"
            >
              View Order
            </Link>
          )}
          <button
            onClick={handleDuplicate}
            disabled={actionLoading}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 transition-colors"
          >
            Duplicate
          </button>
          <Link
            to="/my-quotations"
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 transition-colors"
          >
            Back to List
          </Link>
        </div>
      </div>

      {/* Rejection banner */}
      {q.status === 'REJECTED' && q.rejection_reason && (
        <div className="mb-6 bg-red-50 border border-red-300 rounded p-4">
          <div className="flex items-center gap-2 mb-1">
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-semibold text-red-700">Rejected</span>
          </div>
          <p className="text-red-600 text-sm">{q.rejection_reason}</p>
          {q.reviewed_by_name && (
            <p className="text-red-500 text-xs mt-1">
              By {q.reviewed_by_name}
              {q.reviewed_at && ` on ${new Date(q.reviewed_at).toLocaleDateString()}`}
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded shadow p-6 space-y-6">
        {/* Quotation header info */}
        <div className="flex justify-between items-start border-b pb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">
              {q.quotation_number || `Quotation #${q.id}`}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Date: {q.quotation_date ? new Date(q.quotation_date).toLocaleDateString() : '-'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusBadge(q.status)}`}>
            {statusLabel(q.status)}
          </span>
        </div>

        {/* Customer & Salesperson info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-b pb-4">
          <div>
            <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Customer</h4>
            <p className="font-semibold text-gray-800">{q.customer_name}</p>
            {q.customer_phone && <p className="text-sm text-gray-600">{q.customer_phone}</p>}
            {q.customer_email && <p className="text-sm text-gray-600">{q.customer_email}</p>}
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Salesperson</h4>
            <p className="font-semibold text-gray-800">{q.salesperson_name || '-'}</p>
          </div>
        </div>

        {/* Items table */}
        <div>
          <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Items</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  {user?.role !== 'salesperson' && (
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avail. Stock</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(q.items || []).map((item, index) => {
                  const lineTotal = Number(item.quantity) * Number(item.unit_price || 0);
                  return (
                    <tr key={item.id || index}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">{index + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                        {item.product_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {item.product_code}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        {formatCurrency(item.unit_price)}
                      </td>
                      {user?.role !== 'salesperson' && (
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500">
                          {stockMap[item.product_id] ?? '-'}
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                        {formatCurrency(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={user?.role !== 'salesperson' ? 6 : 5} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Grand Total
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-gray-900">
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Notes */}
        {q.notes && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Notes</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{q.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
