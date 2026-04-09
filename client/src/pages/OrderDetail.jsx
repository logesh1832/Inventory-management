import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api, { getFileUrl } from '../services/api';
import { fmtDate } from '../utils/date';
import { useAuth } from '../context/AuthContext';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
      if (e.key === 'e' || e.key === 'E') { navigate(`/orders/${id}/edit`); }
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); window.print(); }
      if (e.key === 'Escape') { navigate('/orders'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [id, navigate]);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await api.get(`/orders/${id}`);
        setOrder(res.data);
      } catch (err) {
        showToast(err.response?.data?.error || 'Failed to load order', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!order) return <p className="text-gray-500">Order not found.</p>;

  // qty is stored in PCS (sub-unit) for products with sub_unit
  const formatQty = (qty, unit, subUnit, qtyPerBox) => {
    if (subUnit && qtyPerBox) {
      if (qty < qtyPerBox) return <span>{qty} {subUnit}</span>;
      const boxes = Math.floor(qty / qtyPerBox);
      const remaining = qty % qtyPerBox;
      if (remaining === 0) return <span>{boxes} {unit}</span>;
      return <span>{boxes} {unit} + {remaining} {subUnit}</span>;
    }
    return <span>{qty} {unit || ''}</span>;
  };

  return (
    <div>
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white no-print ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-400 no-print">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600 font-mono">E</kbd> Edit</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600 font-mono">P</kbd> Print</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-600 font-mono">Esc</kbd> Back</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 no-print">
        <h2 className="text-2xl font-bold text-gray-800">Material Out Detail</h2>
        <div className="flex gap-3">
          <Link
            to={`/orders/${id}/edit`}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            Edit
          </Link>
          <button
            onClick={() => window.print()}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors text-sm"
          >
            Print Invoice
          </button>
          <Link
            to="/orders"
            className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors text-sm"
          >
            Back to Material Out
          </Link>
        </div>
      </div>

      {/* === PRINT TEMPLATE (A5) — visible on screen too === */}
      <div className="bg-white rounded shadow print-area" id="print-invoice">
        <div className="p-4 sm:p-6">

          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Material Out</p>
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">GREE Marketing India LLP</h2>
            <div className="text-right">
              <h3 className="text-base font-bold text-gray-800">ORDER #{order.invoice_number}</h3>
              {order.reference_number && <p className="text-xs text-gray-500">Ref: {order.reference_number}</p>}
            </div>
          </div>

          {/* Order Info */}
          <div className="flex justify-between mb-3">
            <div>
              <p className="text-[10px] text-gray-500 italic">Dispatch To</p>
              <p className="text-xs font-semibold text-gray-800">{order.customer_name}</p>
              {order.party_name && <p className="text-xs text-gray-500">{order.party_name}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-700">Dispatch Date : <span className="font-semibold">{fmtDate(order.order_date)}</span></p>
              {user && <p className="text-xs text-gray-500">Created By : {user.name}</p>}
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-1 px-2 text-left text-[10px] font-bold text-gray-700 w-8 border border-gray-300">#</th>
                <th className="py-1 px-2 text-left text-[10px] font-bold text-gray-700 border border-gray-300">Item</th>
                <th className="py-1 px-2 text-left text-[10px] font-bold text-gray-700 border border-gray-300">Batch</th>
                <th className="py-1 px-2 text-right text-[10px] font-bold text-gray-700 w-28 border border-gray-300">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => {
                const batchList = item.deductions?.map((d) => d.batch_number).filter(Boolean).join(', ') || '—';
                return (
                  <tr key={item.id}>
                    <td className="py-1 px-2 text-xs text-gray-600 align-top border border-gray-300">{index + 1}</td>
                    <td className="py-1 px-2 text-[11px] text-gray-800 align-top border border-gray-300">
                      {item.product_name}
                    </td>
                    <td className="py-1 px-2 text-[10px] text-gray-600 align-top border border-gray-300">{batchList}</td>
                    <td className="py-1 px-2 text-xs text-right align-top border border-gray-300">
                      {formatQty(item.quantity, item.unit, item.sub_unit, item.qty_per_box)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Print Footer */}
        <div className="print-only-block pt-2 px-6 pb-0 text-center text-[10px] text-gray-400">
          GREE Marketing India LLP | www.greebond.com
        </div>
      </div>

      {/* Screen-only: Batch Breakdown section */}
      <div className="no-print bg-white rounded shadow p-5 sm:p-8 mt-4">
        <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">Batch Breakdown</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batches</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-800">{item.product_name}</td>
                  <td className="px-4 py-2 text-sm">{formatQty(item.quantity, item.unit, item.sub_unit, item.qty_per_box)}</td>
                  <td className="px-4 py-2 text-sm">
                    {item.deductions && item.deductions.length > 0 ? (
                      <div className="space-y-0.5">
                        {item.deductions.map((d, i) => (
                          <div key={i} className="text-xs text-gray-600">
                            {d.batch_number ? `${d.batch_number}: ` : 'Stock: '}
                            {formatQty(d.quantity, item.unit, item.sub_unit, item.qty_per_box)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
