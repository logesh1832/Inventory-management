import { useState, useEffect } from 'react';
import api from '../services/api';

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const PERIOD_LABELS = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-Yearly',
  YEARLY: 'Yearly',
};

function periodLabel(target) {
  const label = PERIOD_LABELS[target.period_type] || target.period_type;
  const start = new Date(target.period_start);
  const monthYear = start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return `${label} \u2014 ${monthYear}`;
}

function ProgressBar({ percentage, height = 'h-4' }) {
  const pct = Math.min(100, Math.max(0, percentage));
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className={`w-full bg-gray-200 rounded-full ${height} overflow-hidden`}>
      <div className={`${color} ${height} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function TargetCard({ target }) {
  const [expanded, setExpanded] = useState(false);

  const achieved = Number(target.achieved_amount || 0);
  const total = Number(target.target_amount || 1);
  const remaining = Math.max(0, total - achieved);
  const pct = Math.round((achieved / total) * 100);
  const orders = target.contributing_orders || [];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{periodLabel(target)}</h3>
        <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
          target.days_remaining <= 7 ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
        }`}>
          {target.days_remaining} day{target.days_remaining !== 1 ? 's' : ''} remaining
        </span>
      </div>

      {/* Large progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">Progress</span>
          <span className={`text-lg font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
            {pct}%
          </span>
        </div>
        <ProgressBar percentage={pct} height="h-6" />
      </div>

      <p className="text-sm text-gray-700">
        Target: <span className="font-semibold">{formatINR(total)}</span>
        {' | '}
        Achieved: <span className="font-semibold text-green-700">{formatINR(achieved)}</span>
        {' | '}
        Remaining: <span className="font-semibold text-red-700">{formatINR(remaining)}</span>
      </p>

      {/* Contributing Orders */}
      {orders.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Contributing Orders ({orders.length})
          </button>
          {expanded && (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quotation #</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map((o, i) => (
                    <tr key={o.id || i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-900">{o.quotation_number || o.order_number || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{o.customer_name || '-'}</td>
                      <td className="px-3 py-2 text-gray-900 text-right">{formatINR(o.total_amount || o.amount || 0)}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {o.created_at ? new Date(o.created_at).toLocaleDateString('en-IN') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MyTargets() {
  const [activeTargets, setActiveTargets] = useState([]);
  const [pastTargets, setPastTargets] = useState([]);
  const [loadingActive, setLoadingActive] = useState(true);
  const [loadingPast, setLoadingPast] = useState(true);

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const res = await api.get('/targets/my-progress');
        setActiveTargets(res.data);
      } catch (err) {
        console.error('Failed to fetch active targets', err);
      } finally {
        setLoadingActive(false);
      }
    };

    const fetchPast = async () => {
      try {
        const completed = await api.get('/targets', { params: { status: 'COMPLETED' } });
        const missed = await api.get('/targets', { params: { status: 'MISSED' } });
        setPastTargets([...(completed.data || []), ...(missed.data || [])]);
      } catch (err) {
        console.error('Failed to fetch past targets', err);
      } finally {
        setLoadingPast(false);
      }
    };

    fetchActive();
    fetchPast();
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">My Targets</h2>

      {/* Active Targets */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Active Targets</h3>
        {loadingActive ? (
          <p className="text-gray-500">Loading...</p>
        ) : activeTargets.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">No active targets assigned. Contact your admin.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTargets.map((t) => (
              <TargetCard key={t.id} target={t} />
            ))}
          </div>
        )}
      </div>

      {/* Past Targets */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Past Targets</h3>
        {loadingPast ? (
          <p className="text-gray-500">Loading...</p>
        ) : pastTargets.length === 0 ? (
          <p className="text-gray-500 text-sm">No past targets.</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Achieved</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-36">%</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pastTargets.map((t) => {
                  const achieved = Number(t.achieved_amount || 0);
                  const total = Number(t.target_amount || 1);
                  const pct = Math.round((achieved / total) * 100);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{periodLabel(t)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatINR(total)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatINR(achieved)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar percentage={pct} height="h-2" />
                          <span className="text-xs font-medium text-gray-700 w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          t.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
