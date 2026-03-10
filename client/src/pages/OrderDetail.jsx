import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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

      <div className="bg-white rounded shadow p-4 sm:p-6 space-y-6 print-area">
        {/* Print Header — only visible when printing */}
        <div className="print-only items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <img src="/gree-logo.png" alt="GREE" className="h-10 w-auto" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">GREE Marketing India LLP</h2>
              <p className="text-xs text-gray-500">1st Floor, Misri Complex, No. 24, Narayana Mudali Street, Sowcarpet, Chennai – 600 001</p>
              <p className="text-xs text-gray-500">Phone: +91 9983 9983 09 | Email: sales@greebond.com</p>
            </div>
          </div>
          <div className="text-right">
            <h3 className="text-xl font-bold text-gray-800">INVOICE</h3>
          </div>
        </div>

        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 border-b pb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{order.invoice_number}</h3>
            <p className="text-sm text-gray-500 mt-1">
              Date: {new Date(order.order_date).toLocaleDateString()}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              order.status === 'completed'
                ? 'bg-green-100 text-green-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {order.status}
          </span>
        </div>

        {/* Customer Info */}
        <div className="border-b pb-4">
          <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Bill To</h4>
          <p className="font-semibold text-gray-800">{order.customer_name}</p>
          {order.phone && <p className="text-sm text-gray-600">{order.phone}</p>}
          {order.email && <p className="text-sm text-gray-600">{order.email}</p>}
          {order.address && <p className="text-sm text-gray-600">{order.address}</p>}
        </div>

        {/* Items Table */}
        <div>
          <h4 className="text-sm font-medium text-gray-500 uppercase mb-2">Items</h4>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {order.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">{index + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{item.product_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{item.product_code}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm">
                        {item.deductions && item.deductions.length > 0 ? (
                          <div className="space-y-1">
                            {item.deductions.map((d, i) => (
                              <div key={i} className="text-xs text-gray-600">
                                {d.batch_number ? `${d.batch_number}: ${d.quantity}` : `Stock: ${d.quantity}`}
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

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-200">
            {order.items.map((item, index) => (
              <div key={item.id} className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">#{index + 1}</span>
                  <span className="text-sm font-semibold">{item.quantity} qty</span>
                </div>
                <p className="text-sm font-medium text-gray-800">{item.product_name}</p>
                <p className="text-xs text-gray-500">{item.product_code}</p>
                {item.deductions && item.deductions.length > 0 && (
                  <div className="pt-1 space-y-0.5">
                    <p className="text-xs font-medium text-gray-500">Batch Breakdown:</p>
                    {item.deductions.map((d, i) => (
                      <p key={i} className="text-xs text-gray-600">
                        {d.batch_number ? `${d.batch_number}: ${d.quantity}` : `Stock: ${d.quantity}`}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Print Footer */}
        <div className="print-only-block border-t pt-4 mt-6 text-center text-xs text-gray-400">
          Thank you for your business! | GREE Marketing India LLP | www.greebond.com
        </div>
      </div>
    </div>
  );
}
