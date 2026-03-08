import { useState, useEffect } from 'react';
import api from '../services/api';

const purposeLabel = {
  PITCHING: 'Pitching',
  FOLLOW_UP: 'Follow Up',
  ORDER_COLLECTION: 'Order Collection',
  COMPLAINT: 'Complaint',
  OTHER: 'Other',
};

const outcomeLabel = {
  INTERESTED: 'Interested',
  NOT_INTERESTED: 'Not Interested',
  ORDER_PLACED: 'Order Placed',
  FOLLOW_UP_NEEDED: 'Follow-up Needed',
};

const outcomeBadge = {
  INTERESTED: 'bg-green-100 text-green-700',
  NOT_INTERESTED: 'bg-red-100 text-red-700',
  ORDER_PLACED: 'bg-purple-100 text-purple-700',
  FOLLOW_UP_NEEDED: 'bg-yellow-100 text-yellow-700',
};

export default function MyVisits() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');

  useEffect(() => {
    api.get('/customers').then(({ data }) => setCustomers(data)).catch(() => {});
  }, []);

  const fetchVisits = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);
      if (selectedCustomer) params.append('customer_id', selectedCustomer);
      const { data } = await api.get(`/visits/my-visits?${params}`);
      setVisits(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchVisits(); }, [fromDate, toDate, selectedCustomer]);

  // Summary stats for today
  const today = new Date().toISOString().split('T')[0];
  const todayVisits = visits.filter(v => v.check_in_at?.startsWith(today));
  const avgDuration = todayVisits.length > 0
    ? Math.round(todayVisits.reduce((s, v) => s + (v.duration_minutes || 0), 0) / todayVisits.length)
    : 0;
  const verifiedPct = todayVisits.length > 0
    ? Math.round((todayVisits.filter(v => v.location_verified).length / todayVisits.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">My Visits</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Visits Today</p>
          <p className="text-2xl font-bold text-gray-800">{todayVisits.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Avg Duration</p>
          <p className="text-2xl font-bold text-gray-800">{avgDuration} min</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-xs text-gray-500">Verified %</p>
          <p className="text-2xl font-bold text-gray-800">{verifiedPct}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow px-4 py-3 flex flex-wrap items-center gap-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Customer</label>
          <select value={selectedCustomer} onChange={(e) => setSelectedCustomer(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm min-w-[180px]">
            <option value="">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        {loading ? (
          <p className="p-4 text-gray-400 text-sm">Loading...</p>
        ) : visits.length === 0 ? (
          <p className="p-4 text-gray-400 text-sm">No visits found.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Verified</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visits.map((v) => (
                <tr key={v.id} className={`hover:bg-gray-50 ${!v.location_verified ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                    {new Date(v.check_in_at).toLocaleDateString()}<br />
                    <span className="text-xs text-gray-500">
                      {new Date(v.check_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {v.check_out_at && ` — ${new Date(v.check_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{v.customer_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                      {purposeLabel[v.visit_purpose] || v.visit_purpose}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {v.duration_minutes ? `${Math.round(v.duration_minutes)} min` : (
                      <span className="text-blue-600 text-xs">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {v.location_verified ? (
                      <span className="text-green-600" title="Location verified">&#10003;</span>
                    ) : (
                      <span className="text-red-500" title={`${Math.round(v.distance_from_customer_m)}m away`}>&#10007;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {v.outcome ? (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${outcomeBadge[v.outcome] || 'bg-gray-100 text-gray-700'}`}>
                        {outcomeLabel[v.outcome] || v.outcome}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={v.notes}>
                    {v.notes || '-'}
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
