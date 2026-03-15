import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { fmtDate } from '../utils/date';

export default function MaterialInDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const totalQty = entries.reduce((sum, e) => sum + e.quantity, 0);
  const firstEntryId = entries.length > 0 ? entries[0].id : null;

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

      {/* Invoice-style card */}
      <div className="bg-white rounded-lg shadow p-5 sm:p-8 print-area">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pb-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              {voucherNumber || 'Material In Receipt'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Date: <span className="font-medium text-gray-700">{fmtDate(date)}</span>
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-gray-500">Supplier</p>
            <p className="text-lg font-semibold text-gray-800">{supplierName || '-'}</p>
          </div>
        </div>

        {/* Summary */}
        <div className="flex gap-6 mb-6">
          <div className="bg-blue-50 rounded-lg px-4 py-3">
            <p className="text-xs text-blue-600 font-medium">Total Items</p>
            <p className="text-xl font-bold text-blue-800">{entries.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg px-4 py-3">
            <p className="text-xs text-green-600 font-medium">Total Quantity</p>
            <p className="text-xl font-bold text-green-800">{totalQty}</p>
          </div>
        </div>

        {/* Items table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mfg Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e, idx) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="font-medium text-gray-800">{e.product_name}</span>
                    <span className="text-gray-400 text-xs ml-1">({e.product_code})</span>
                    {e.unit === 'Boxes' && e.qty_per_box && (
                      <span className="text-xs text-blue-500 ml-2">
                        {e.quantity} x {e.qty_per_box} = {e.quantity * e.qty_per_box} pcs
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {e.batch_number ? (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{e.batch_number}</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {e.manufacture_date ? fmtDate(e.manufacture_date) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {e.expiry_date ? (
                      <span className={new Date(e.expiry_date) < new Date() ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {fmtDate(e.expiry_date)}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">
                      +{e.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center no-print">
                    <button
                      onClick={() => handleDeleteEntry(e.id)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">Total</td>
                <td className="px-4 py-3 text-sm text-right">
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-bold">
                    +{totalQty}
                  </span>
                </td>
                <td className="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
