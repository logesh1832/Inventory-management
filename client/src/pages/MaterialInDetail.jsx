import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { fmtDate } from '../utils/date';
import { useAuth } from '../context/AuthContext';

export default function MaterialInDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const supplierId = searchParams.get('supplier');
  const date = searchParams.get('date');

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!supplierId || !date) return;
    api.get('/batches/stock-entries-by-group', { params: { supplier_id: supplierId, date } })
      .then((res) => setEntries(res.data))
      .catch(() => setToast({ message: 'Failed to load entries', type: 'error' }))
      .finally(() => setLoading(false));
  }, [supplierId, date]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchEntries = () => {
    if (!supplierId || !date) return;
    api.get('/batches/stock-entries-by-group', { params: { supplier_id: supplierId, date } })
      .then((res) => setEntries(res.data))
      .catch(() => showToast('Failed to load entries', 'error'));
  };

  const handleDeleteEntry = async (entryId) => {
    if (!window.confirm('Are you sure you want to delete this stock entry? This will reverse the batch quantity.')) return;
    try {
      await api.delete(`/batches/stock-entries/${entryId}`);
      showToast('Stock entry deleted successfully');
      fetchEntries();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete stock entry', 'error');
    }
  };

  const supplierName = entries.length > 0 ? entries[0].supplier_name : '';
  const voucherNumber = entries.length > 0 ? entries[0].voucher_number : '';
  const referenceNumber = entries.length > 0 ? entries[0].reference_number : '';
  const partyName = entries.length > 0 ? entries[0].party_name : '';
  const totalQty = entries.reduce((sum, e) => sum + e.quantity, 0);
  const firstEntryId = entries.length > 0 ? entries[0].id : null;

  const formatQty = (e) => {
    const qty = e.quantity;
    const unit = e.unit || '';
    const subUnit = e.sub_unit;
    const qtyPerBox = e.qty_per_box;
    if (subUnit && qtyPerBox) {
      const boxes = qty / qtyPerBox;
      return <span>{boxes} {unit} ({qty} {subUnit})</span>;
    }
    return <span>{qty} {unit}</span>;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return;
      switch (e.key.toLowerCase()) {
        case 'e':
          if (firstEntryId) navigate(`/batches/stock-entries/${firstEntryId}/edit`);
          break;
        case 'p':
          e.preventDefault();
          window.print();
          break;
        case 'escape':
          navigate('/batches');
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [firstEntryId, navigate]);

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-400 no-print">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono">E</kbd> Edit</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono">P</kbd> Print</span>
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono">Esc</kbd> Back</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 no-print">
        <h2 className="text-2xl font-bold text-gray-800">Material In Detail</h2>
        <div className="flex gap-3">
          {firstEntryId && (
            <Link
              to={`/batches/stock-entries/${firstEntryId}/edit`}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              Edit
            </Link>
          )}
          <button
            onClick={() => window.print()}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition-colors text-sm"
          >
            Print
          </button>
          <Link
            to="/batches"
            className="bg-yellow-500 text-gray-900 px-4 py-2 rounded hover:bg-yellow-600 transition-colors text-sm"
          >
            Back to Material In
          </Link>
        </div>
      </div>

      {/* === PRINT TEMPLATE (A5) — visible on screen too === */}
      <div className="bg-white rounded shadow print-area" id="print-invoice">
        <div className="p-4 sm:p-6">

          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Material In</p>
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">GREE Marketing India LLP</h2>
            <div className="text-right">
              <h3 className="text-base font-bold text-gray-800">#{voucherNumber || '—'}</h3>
              {referenceNumber && <p className="text-xs text-gray-500">Ref: {referenceNumber}</p>}
            </div>
          </div>

          {/* Info */}
          <div className="flex justify-between mb-3">
            <div>
              <p className="text-[10px] text-gray-500 italic">Received From</p>
              <p className="text-xs font-semibold text-gray-800">{supplierName || '—'}</p>
              {partyName && <p className="text-xs text-gray-500">{partyName}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-700">Received Date : <span className="font-semibold">{fmtDate(date)}</span></p>
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
              {entries.map((e, idx) => (
                <tr key={e.id}>
                  <td className="py-1 px-2 text-xs text-gray-600 align-top border border-gray-300">{idx + 1}</td>
                  <td className="py-1 px-2 text-[11px] text-gray-800 align-top border border-gray-300">
                    {e.product_code} - {e.product_name}
                  </td>
                  <td className="py-1 px-2 text-[10px] text-gray-600 align-top border border-gray-300">{e.batch_number || '—'}</td>
                  <td className="py-1 px-2 text-xs text-right align-top border border-gray-300">
                    {formatQty(e)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Print Footer */}
        <div className="print-only-block pt-2 px-6 pb-0 text-center text-[10px] text-gray-400">
          GREE Marketing India LLP | www.greebond.com
        </div>
      </div>

      {/* Screen-only: Detailed breakdown */}
      <div className="no-print bg-white rounded shadow p-5 sm:p-8 mt-4">
        <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">Item Details</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mfg Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">
                    <span className="font-medium text-gray-800">{e.product_name}</span>
                    <span className="text-gray-400 text-xs ml-1">({e.product_code})</span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {e.batch_number ? (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{e.batch_number}</span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-500">{e.manufacture_date ? fmtDate(e.manufacture_date) : '-'}</td>
                  <td className="px-4 py-2 text-sm">
                    {e.expiry_date ? (
                      <span className={new Date(e.expiry_date) < new Date() ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {fmtDate(e.expiry_date)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-2 text-sm text-right">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">+{e.quantity}</span>
                  </td>
                  <td className="px-4 py-2 text-sm text-center">
                    <button onClick={() => handleDeleteEntry(e.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={4} className="px-4 py-2 text-sm font-semibold text-gray-700 text-right">Total</td>
                <td className="px-4 py-2 text-sm text-right">
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">+{totalQty}</span>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
