import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import DateInput from '../components/DateInput';

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const PERIOD_LABELS = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  HALF_YEARLY: 'Half-Yearly',
  YEARLY: 'Yearly',
};

const STATUS_COLORS = {
  ACTIVE: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  MISSED: 'bg-red-100 text-red-800',
};

function ProgressBar({ percentage }) {
  const pct = Math.min(100, Math.max(0, percentage));
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatPeriod(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d) => { const dd = String(d.getDate()).padStart(2, '0'); const mm = d.toLocaleString('en-GB', { month: 'short' }); return `${dd} ${mm} ${d.getFullYear()}`; };
  return `${fmt(s)} - ${fmt(e)}`;
}

export default function TargetManagement() {
  const [targets, setTargets] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Filters
  const [filterSalesperson, setFilterSalesperson] = useState('');
  const [filterPeriodType, setFilterPeriodType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form state
  const [form, setForm] = useState({
    salesperson_id: '',
    period_type: 'MONTHLY',
    period_start: '',
    target_amount: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchTargets = useCallback(async () => {
    try {
      const params = {};
      if (filterSalesperson) params.salesperson_id = filterSalesperson;
      if (filterPeriodType) params.period_type = filterPeriodType;
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/targets', { params });
      setTargets(res.data);
    } catch (err) {
      console.error('Failed to fetch targets', err);
    } finally {
      setLoading(false);
    }
  }, [filterSalesperson, filterPeriodType, filterStatus]);

  const fetchSalespersons = useCallback(async () => {
    try {
      const res = await api.get('/users');
      const sp = (res.data || []).filter((u) => u.role === 'salesperson' && u.is_active);
      setSalespersons(sp);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  }, []);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  useEffect(() => {
    fetchSalespersons();
  }, [fetchSalespersons]);

  const openCreateModal = () => {
    setForm({ salesperson_id: '', period_type: 'MONTHLY', period_start: '', target_amount: '' });
    setEditTarget(null);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (target) => {
    setEditTarget(target);
    setForm({
      salesperson_id: target.salesperson_id,
      period_type: target.period_type,
      period_start: target.period_start?.slice(0, 10) || '',
      target_amount: target.target_amount,
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editTarget) {
        await api.put(`/targets/${editTarget.id}`, { target_amount: Number(form.target_amount) });
      } else {
        await api.post('/targets', {
          salesperson_id: Number(form.salesperson_id),
          period_type: form.period_type,
          period_start: form.period_start,
          target_amount: Number(form.target_amount),
        });
      }
      setShowModal(false);
      fetchTargets();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save target');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/targets/${id}`);
      setDeleteConfirm(null);
      fetchTargets();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete target');
      setDeleteConfirm(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sales Targets</h2>
        <button
          onClick={openCreateModal}
          className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold px-4 py-2 rounded shadow transition-colors"
        >
          Assign Target
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Salesperson</label>
          <select
            value={filterSalesperson}
            onChange={(e) => setFilterSalesperson(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-48"
          >
            <option value="">All</option>
            {salespersons.map((sp) => (
              <option key={sp.id} value={sp.id}>{sp.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
          <select
            value={filterPeriodType}
            onChange={(e) => setFilterPeriodType(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-40"
          >
            <option value="">All</option>
            {Object.entries(PERIOD_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-36"
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="MISSED">Missed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salesperson</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Target (Rs.)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Achieved (Rs.)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-36">%</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-500">Loading...</td></tr>
            ) : targets.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-500">No targets found.</td></tr>
            ) : (
              targets.map((t) => {
                const achieved = Number(t.achieved_amount || 0);
                const target = Number(t.target_amount || 1);
                const pct = Math.round((achieved / target) * 100);
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{t.salesperson_name || `User #${t.salesperson_id}`}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{PERIOD_LABELS[t.period_type] || t.period_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatPeriod(t.period_start, t.period_end)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{formatINR(t.target_amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{formatINR(achieved)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar percentage={pct} />
                        <span className="text-xs font-medium text-gray-700 w-10 text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(t)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          title="Edit target amount"
                        >
                          Edit
                        </button>
                        {Number(achieved) === 0 && (
                          <>
                            {deleteConfirm === t.id ? (
                              <span className="flex items-center gap-1">
                                <button onClick={() => handleDelete(t.id)} className="text-red-600 hover:text-red-800 text-xs font-semibold">Confirm</button>
                                <button onClick={() => setDeleteConfirm(null)} className="text-gray-500 hover:text-gray-700 text-xs">Cancel</button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(t.id)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium"
                                title="Delete target"
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editTarget ? 'Edit Target Amount' : 'Assign Target'}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
            )}

            <div className="space-y-4">
              {/* Salesperson */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salesperson</label>
                <select
                  value={form.salesperson_id}
                  onChange={(e) => setForm({ ...form, salesperson_id: e.target.value })}
                  disabled={!!editTarget}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100"
                >
                  <option value="">Select Salesperson</option>
                  {salespersons.map((sp) => (
                    <option key={sp.id} value={sp.id}>{sp.name}</option>
                  ))}
                </select>
              </div>

              {/* Period Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period Type</label>
                <select
                  value={form.period_type}
                  onChange={(e) => setForm({ ...form, period_type: e.target.value })}
                  disabled={!!editTarget}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100"
                >
                  {Object.entries(PERIOD_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Period Start */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
                <DateInput
                  value={form.period_start}
                  onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                  disabled={!!editTarget}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">Pick the first day of the period</p>
              </div>

              {/* Target Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Amount (Rs.)</label>
                <input
                  type="number"
                  value={form.target_amount}
                  onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
                  placeholder="e.g. 500000"
                  min="1"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (!editTarget && (!form.salesperson_id || !form.period_start || !form.target_amount)) || (editTarget && !form.target_amount)}
                className="px-4 py-2 text-sm font-semibold bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded shadow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
