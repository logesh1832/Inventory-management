import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SearchableSelect from '../components/SearchableSelect';
import Pagination from '../components/Pagination';
import { fmtDate } from '../utils/date';
import DateInput from '../components/DateInput';

const today = () => new Date().toISOString().split('T')[0];
const toDateStr = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

export default function StockMovements() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('in'); // 'in' | 'out'

  // Shared
  const [customers, setCustomers] = useState([]);
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Material In
  const [inData, setInData] = useState([]);
  const [inTotal, setInTotal] = useState(0);
  const [filterSupplierId, setFilterSupplierId] = useState('');

  // Material Out
  const [outData, setOutData] = useState([]);
  const [outTotal, setOutTotal] = useState(0);
  const [filterCustomerId, setFilterCustomerId] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    api.get('/customers').then((res) => setCustomers(res.data)).catch(() => {});
  }, []);

  const fetchInData = async (supplierId, fd, td, pg) => {
    try {
      setLoading(true);
      const params = { page: pg, limit: 20 };
      if (supplierId) params.supplier_id = supplierId;
      if (fd) params.from_date = fd;
      if (td) params.to_date = td;
      const res = await api.get('/inventory/movements-by-supplier', { params });
      setInData(res.data.data);
      setInTotal(res.data.total);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load supplier movements', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchOutData = async (customerId, fd, td, pg) => {
    try {
      setLoading(true);
      const params = { page: pg, limit: 20 };
      if (customerId) params.customer_id = customerId;
      if (fd) params.from_date = fd;
      if (td) params.to_date = td;
      const res = await api.get('/inventory/movements-by-customer', { params });
      setOutData(res.data.data);
      setOutTotal(res.data.total);
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to load customer movements', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentTab = (currentTab, pg) => {
    if (currentTab === 'in') {
      fetchInData(filterSupplierId, fromDate, toDate, pg);
    } else {
      fetchOutData(filterCustomerId, fromDate, toDate, pg);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchCurrentTab(tab, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, fromDate, toDate, filterSupplierId, filterCustomerId]);

  const handlePageChange = (pg) => {
    setPage(pg);
    fetchCurrentTab(tab, pg);
  };

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

      <h2 className="text-2xl font-bold text-gray-800 mb-6">Stock Movements</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('in')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            tab === 'in' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Material In
        </button>
        <button
          onClick={() => setTab('out')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            tab === 'out' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Material Out
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        {tab === 'in' && (
          <div className="w-full sm:w-56">
            <label className="block text-xs font-medium text-gray-500 mb-1">Supplier</label>
            <SearchableSelect
              options={customers.map((s) => ({ value: s.id, label: s.customer_name }))}
              value={filterSupplierId}
              onChange={setFilterSupplierId}
              placeholder="All Suppliers"
            />
          </div>
        )}
        {tab === 'out' && (
          <div className="w-full sm:w-56">
            <label className="block text-xs font-medium text-gray-500 mb-1">Customer</label>
            <SearchableSelect
              options={customers.map((c) => ({ value: c.id, label: c.customer_name }))}
              value={filterCustomerId}
              onChange={setFilterCustomerId}
              placeholder="All Customers"
            />
          </div>
        )}
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
          <DateInput
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-40 text-sm"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
          <DateInput
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 w-full sm:w-40 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : tab === 'in' ? (
        /* Material In Tab */
        inData.length === 0 ? (
          <p className="text-gray-500">No material in movements found.</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {inData.map((g) => (
                <div
                  key={`${g.supplier_id}-${g.received_date}`}
                  className="bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer active:bg-gray-50"
                  onClick={() => navigate(`/batches/view?supplier=${g.supplier_id}&date=${toDateStr(g.received_date)}`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{g.supplier_name}</span>
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">
                      +{g.total_quantity}
                    </span>
                  </div>
                  {g.voucher_number && (
                    <div className="text-sm text-gray-500">
                      <span className="text-gray-400">Voucher:</span>{' '}
                      <span className="font-medium text-gray-700">{g.voucher_number}</span>
                    </div>
                  )}
                  <div className="text-sm text-gray-500">
                    <span className="text-gray-400">Date:</span>{' '}
                    {fmtDate(g.received_date)}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="text-gray-400">Items:</span> {g.item_count} products
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto bg-white rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher #</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {inData.map((g) => (
                    <tr
                      key={`${g.supplier_id}-${g.received_date}`}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/batches/view?supplier=${g.supplier_id}&date=${toDateStr(g.received_date)}`)}
                    >
                      <td className="px-5 py-3 text-sm font-medium text-gray-800 whitespace-nowrap">
                        {g.voucher_number || '\u2014'}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {fmtDate(g.received_date)}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-gray-800">{g.supplier_name}</td>
                      <td className="px-5 py-3 text-sm">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                          {g.item_count} products
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-semibold">
                          +{g.total_quantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={page} total={inTotal} limit={20} onPageChange={handlePageChange} />
          </>
        )
      ) : (
        /* Material Out Tab */
        outData.length === 0 ? (
          <p className="text-gray-500">No material out movements found.</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {outData.map((g) => (
                <div
                  key={g.order_id}
                  className="bg-white rounded-lg shadow p-4 space-y-2 cursor-pointer active:bg-gray-50"
                  onClick={() => navigate(`/orders/${g.order_id}`)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{g.customer_name}</span>
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-semibold">
                      -{g.total_quantity}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="text-gray-400">Date:</span>{' '}
                    {fmtDate(g.order_date)}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="text-gray-400">Invoice:</span> {g.invoice_number || '\u2014'}
                  </div>
                  <div className="text-sm text-gray-500">
                    <span className="text-gray-400">Items:</span> {g.item_count} products
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto bg-white rounded-lg shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {outData.map((g) => (
                    <tr
                      key={g.order_id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/orders/${g.order_id}`)}
                    >
                      <td className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {fmtDate(g.order_date)}
                      </td>
                      <td className="px-5 py-3 text-sm font-medium text-gray-800">{g.customer_name}</td>
                      <td className="px-5 py-3 text-sm text-gray-700">{g.invoice_number || '\u2014'}</td>
                      <td className="px-5 py-3 text-sm">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                          {g.item_count} products
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-semibold">
                          -{g.total_quantity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination page={page} total={outTotal} limit={20} onPageChange={handlePageChange} />
          </>
        )
      )}
    </div>
  );
}
