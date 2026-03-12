import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { fmtDate } from '../utils/date';

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
    DRAFT: 'Draft', SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved', REJECTED: 'Rejected', CONVERTED_TO_ORDER: 'Converted to Order',
  };
  return map[status] || status;
};

export default function QuotationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quotation, setQuotation] = useState(null);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [stockCheck, setStockCheck] = useState([]);
  const [editing, setEditing] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchQuotation = async () => {
    try {
      const [qRes, pRes] = await Promise.all([
        api.get(`/quotations/${id}`),
        api.get('/products'),
      ]);
      setQuotation(qRes.data);
      setItems(qRes.data.items.map((i) => ({ ...i })));
      setProducts(pRes.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load quotation', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuotation(); }, [id]);

  const handleStartReview = async () => {
    try {
      setActionLoading(true);
      await api.patch(`/quotations/${id}/review`);
      showToast('Review started — quotation is now locked for the salesperson');
      fetchQuotation();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to start review', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      await api.patch(`/quotations/${id}/approve`);
      showToast('Quotation approved');
      fetchQuotation();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to approve', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (rejectionReason.trim().length < 10) {
      showToast('Rejection reason must be at least 10 characters', 'error');
      return;
    }
    try {
      setActionLoading(true);
      await api.patch(`/quotations/${id}/reject`, { rejection_reason: rejectionReason });
      showToast('Quotation rejected');
      setShowRejectModal(false);
      fetchQuotation();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to reject', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertCheck = async () => {
    try {
      const { data } = await api.get(`/quotations/${id}/stock-check`);
      setStockCheck(data);
      setShowConvertModal(true);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to check stock', 'error');
    }
  };

  const handleConvert = async () => {
    try {
      setActionLoading(true);
      const { data } = await api.post(`/quotations/${id}/convert`);
      showToast(`Order ${data.invoice_number} created successfully`);
      setShowConvertModal(false);
      setTimeout(() => navigate(`/orders/${data.order_id}`), 1000);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to convert';
      showToast(msg, 'error');
      if (err.response?.data?.insufficient_items) {
        setStockCheck(err.response.data.insufficient_items.map((i) => ({
          product_name: i.product_name,
          required_qty: i.required,
          available_qty: i.available,
          is_sufficient: false,
        })));
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Inline editing functions
  const handleQtyChange = (index, value) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(1, parseInt(value) || 1);
    newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    setItems(newItems);
    setEditing(true);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      showToast('Quotation must have at least one item', 'error');
      return;
    }
    setItems(items.filter((_, i) => i !== index));
    setEditing(true);
  };

  const handleAddProduct = (productId) => {
    if (items.some((i) => i.product_id === productId)) {
      showToast('Product already in quotation', 'error');
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setItems([...items, {
      product_id: product.id,
      product_name: product.product_name,
      product_code: product.product_code,
      unit: product.unit,
      quantity: 1,
      unit_price: parseFloat(product.unit_price),
      total_price: parseFloat(product.unit_price),
      available_stock: product.available_stock,
    }]);
    setEditing(true);
  };

  const handleSaveChanges = async () => {
    try {
      setActionLoading(true);
      await api.put(`/quotations/${id}`, {
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
      });
      showToast('Changes saved');
      setEditing(false);
      fetchQuotation();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!quotation) return <p className="text-gray-500">Quotation not found.</p>;

  const q = quotation;
  const grandTotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const canEdit = q.status === 'UNDER_REVIEW';
  const canApproveReject = q.status === 'UNDER_REVIEW';
  const canConvert = q.status === 'APPROVED';
  const canStartReview = q.status === 'SUBMITTED';
  const allSufficient = stockCheck.every((s) => s.is_sufficient);

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Reject Quotation</h3>
            <p className="text-sm text-gray-600 mb-3">Please provide a reason for rejection (min 10 characters):</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
              placeholder="Reason for rejection..."
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || rejectionReason.trim().length < 10}
                className="px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600 disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Convert to Order — Stock Check</h3>
            <table className="w-full mb-4">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase">Required</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase">Available</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stockCheck.map((s, i) => (
                  <tr key={i} className={s.is_sufficient ? '' : 'bg-red-50'}>
                    <td className="px-3 py-2 text-sm">{s.product_name}</td>
                    <td className="px-3 py-2 text-sm text-right">{s.required_qty}</td>
                    <td className="px-3 py-2 text-sm text-right">{s.available_qty}</td>
                    <td className="px-3 py-2 text-center">
                      {s.is_sufficient ? (
                        <span className="text-green-600 text-sm font-medium">OK</span>
                      ) : (
                        <span className="text-red-600 text-sm font-medium">Insufficient</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!allSufficient && (
              <p className="text-red-600 text-sm mb-4">Cannot convert — insufficient stock for some products. Please edit quantities first.</p>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConvertModal(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={actionLoading || !allSufficient}
                className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {actionLoading ? 'Converting...' : 'Confirm Convert to Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Review Quotation</h2>
        <div className="flex flex-wrap gap-2">
          {canStartReview && (
            <button onClick={handleStartReview} disabled={actionLoading}
              className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-50 font-medium">
              Start Review
            </button>
          )}
          {canEdit && editing && (
            <button onClick={handleSaveChanges} disabled={actionLoading}
              className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 disabled:opacity-50 font-medium">
              Save Changes
            </button>
          )}
          {canApproveReject && (
            <>
              <button onClick={handleApprove} disabled={actionLoading}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 font-medium">
                Approve
              </button>
              <button onClick={() => setShowRejectModal(true)} disabled={actionLoading}
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50 font-medium">
                Reject
              </button>
            </>
          )}
          {canConvert && (
            <button onClick={handleConvertCheck} disabled={actionLoading}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 font-medium">
              Convert to Order
            </button>
          )}
          <Link to="/pending-quotations" className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200">
            Back to List
          </Link>
        </div>
      </div>

      {/* Rejection info */}
      {q.status === 'REJECTED' && q.rejection_reason && (
        <div className="mb-6 bg-red-50 border border-red-300 rounded p-4">
          <span className="font-semibold text-red-700">Rejected: </span>
          <span className="text-red-600 text-sm">{q.rejection_reason}</span>
          {q.reviewed_by_name && (
            <span className="text-red-500 text-xs ml-2">
              — {q.reviewed_by_name} on {fmtDate(q.reviewed_at)}
            </span>
          )}
        </div>
      )}

      <div className="bg-white rounded shadow p-6 space-y-6">
        {/* Quotation header */}
        <div className="flex justify-between items-start border-b pb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{q.quotation_number}</h3>
            <p className="text-sm text-gray-500 mt-1">Date: {fmtDate(q.quotation_date)}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusBadge(q.status)}`}>
            {statusLabel(q.status)}
          </span>
        </div>

        {/* Customer & Salesperson */}
        <div className="grid grid-cols-2 gap-6 border-b pb-4">
          <div>
            <h4 className="text-sm font-medium text-gray-500 uppercase mb-1">Customer</h4>
            <p className="font-semibold text-gray-800">{q.customer_name}</p>
            {q.customer_phone && <p className="text-sm text-gray-600">{q.customer_phone}</p>}
            {q.customer_address && <p className="text-sm text-gray-500">{q.customer_address}</p>}
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 uppercase mb-1">Salesperson</h4>
            <p className="font-semibold text-gray-800">{q.salesperson_name}</p>
            {q.salesperson_phone && <p className="text-sm text-gray-600">{q.salesperson_phone}</p>}
          </div>
        </div>

        {/* Items table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-500 uppercase">Items</h4>
            {canEdit && (
              <select
                onChange={(e) => { if (e.target.value) { handleAddProduct(e.target.value); e.target.value = ''; } }}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="">+ Add Product</option>
                {products.filter((p) => p.status === 'active' && !items.some((i) => i.product_id === p.id)).map((p) => (
                  <option key={p.id} value={p.id}>{p.product_name} ({p.product_code}) — Stock: {p.available_stock}</option>
                ))}
              </select>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  {canEdit && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => {
                  const stock = item.available_stock ?? 0;
                  const sufficient = stock >= item.quantity;
                  return (
                    <tr key={item.id || index} className={!sufficient ? 'bg-red-50' : ''}>
                      <td className="px-4 py-3 text-sm">{index + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium">{item.product_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.product_code}</td>
                      <td className="px-4 py-3 text-right">
                        {canEdit ? (
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleQtyChange(index, e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
                          />
                        ) : (
                          <span className="text-sm">{item.quantity}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${sufficient ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 text-sm">
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={canEdit ? 6 : 6} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Grand Total</td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-gray-900">{formatCurrency(grandTotal)}</td>
                  {canEdit && <td />}
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
