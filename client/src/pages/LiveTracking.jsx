import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fmtDate } from '../utils/date';
import DateInput from '../components/DateInput';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import api from '../services/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

function makeIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const startIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#22C55E;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const endIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#EF4444;border:3px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.4)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function formatTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(startStr, endStr) {
  if (!startStr) return '-';
  const start = new Date(startStr);
  const end = endStr ? new Date(endStr) : new Date();
  const mins = Math.round((end - start) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function LiveTracking() {
  const [tab, setTab] = useState('live');
  const [liveData, setLiveData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  // History state
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [salespersons, setSalespersons] = useState([]);
  const [selectedSP, setSelectedSP] = useState('');
  const [sessions, setSessions] = useState([]);
  const [dailySummary, setDailySummary] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Visit reports state
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [visitSP, setVisitSP] = useState('');
  const [visitSummary, setVisitSummary] = useState([]);
  const [visitList, setVisitList] = useState([]);
  const [visitLoading, setVisitLoading] = useState(false);

  const fetchLive = useCallback(async () => {
    try {
      const { data } = await api.get('/tracking/live');
      setLiveData(data);
      setLastRefresh(new Date());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 'live') {
      fetchLive();
      const interval = setInterval(fetchLive, 60000);
      return () => clearInterval(interval);
    }
  }, [tab, fetchLive]);

  useEffect(() => {
    // Fetch salesperson list from daily summary (works for admin + inventory)
    api.get('/tracking/daily-summary')
      .then(({ data }) => setSalespersons(data.map(d => ({ id: d.salesperson_id, name: d.salesperson_name }))))
      .catch(() => {
        // Fallback: try users endpoint (admin only)
        api.get('/users')
          .then(({ data }) => setSalespersons(data.filter(u => u.role === 'salesperson')))
          .catch(() => {});
      });
  }, []);

  const fetchHistory = async () => {
    if (!selectedSP) return;
    setHistoryLoading(true);
    try {
      const [sessRes, summRes] = await Promise.all([
        api.get(`/tracking/history/${selectedSP}?date=${historyDate}`),
        api.get(`/tracking/daily-summary?date=${historyDate}`),
      ]);
      setSessions(sessRes.data);
      setDailySummary(summRes.data);
    } catch {}
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (tab === 'history' && selectedSP) fetchHistory();
  }, [tab, selectedSP, historyDate]);

  const fetchSummaryOnly = async () => {
    try {
      const { data } = await api.get(`/tracking/daily-summary?date=${historyDate}`);
      setDailySummary(data);
    } catch {}
  };

  useEffect(() => {
    if (tab === 'history') fetchSummaryOnly();
  }, [tab, historyDate]);

  // Visit reports
  const fetchVisitData = async () => {
    setVisitLoading(true);
    try {
      const params = new URLSearchParams({ date: visitDate });
      if (visitSP) params.append('salesperson_id', visitSP);
      const [summRes, listRes] = await Promise.all([
        api.get(`/visits/summary?${params}`),
        api.get(`/visits?from_date=${visitDate}&to_date=${visitDate}${visitSP ? `&salesperson_id=${visitSP}` : ''}`),
      ]);
      setVisitSummary(summRes.data);
      setVisitList(listRes.data);
    } catch {}
    setVisitLoading(false);
  };

  useEffect(() => {
    if (tab === 'visits') fetchVisitData();
  }, [tab, visitDate, visitSP]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Live Tracking</h2>
        <div className="flex gap-1 bg-gray-100 rounded p-1">
          <button
            onClick={() => setTab('live')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === 'live' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Live Map
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === 'history' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Tracking History
          </button>
          <button
            onClick={() => setTab('visits')}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === 'visits' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Visit Reports
          </button>
        </div>
      </div>

      {tab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sidebar */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">Active Salespersons</h3>
              <button onClick={fetchLive} className="text-xs text-blue-600 hover:underline">Refresh</button>
            </div>
            {loading ? (
              <p className="p-4 text-gray-400 text-sm">Loading...</p>
            ) : liveData.length === 0 ? (
              <p className="p-4 text-gray-400 text-sm">No salespersons currently being tracked</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {liveData.map((sp, i) => (
                  <div key={sp.salesperson_id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm font-medium text-gray-800">{sp.salesperson_name}</span>
                    </div>
                    {sp.phone && <p className="text-xs text-gray-500 ml-5">{sp.phone}</p>}
                    <p className="text-xs text-gray-400 ml-5">
                      Last: {formatTime(sp.last_updated)} | Since: {formatTime(sp.session_started_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {lastRefresh && (
              <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
                Updated: {lastRefresh.toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow overflow-hidden" style={{ minHeight: '500px' }}>
            <MapContainer center={[13.0827, 80.2707]} zoom={12} style={{ height: '100%', width: '100%', minHeight: '500px' }}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {liveData.map((sp, i) => (
                <Marker
                  key={sp.salesperson_id}
                  position={[parseFloat(sp.latest_latitude), parseFloat(sp.latest_longitude)]}
                  icon={makeIcon(COLORS[i % COLORS.length])}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{sp.salesperson_name}</p>
                      {sp.phone && <p className="text-gray-500">{sp.phone}</p>}
                      <p className="text-gray-500">Last update: {formatTime(sp.last_updated)}</p>
                      <p className="text-gray-500">Tracking since: {formatTime(sp.session_started_at)}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow px-4 py-3 flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date</label>
              <DateInput
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Salesperson</label>
              <select
                value={selectedSP}
                onChange={(e) => setSelectedSP(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm min-w-[200px]"
              >
                <option value="">Select salesperson...</option>
                {salespersons.map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Daily Summary */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Daily Summary — {fmtDate(historyDate + 'T00:00')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salesperson</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sessions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Distance (km)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">End</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dailySummary.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-4 text-gray-400 text-sm text-center">No data</td></tr>
                  ) : dailySummary.map((row) => (
                    <tr key={row.salesperson_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.salesperson_name}</td>
                      <td className="px-4 py-3 text-sm text-right">{row.total_sessions}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{parseFloat(row.total_distance_km).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatTime(row.first_start)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatTime(row.last_stop)}</td>
                      <td className="px-4 py-3 text-sm text-right">{row.total_points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Route Map */}
          {selectedSP && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800">Route Map</h3>
              </div>
              {historyLoading ? (
                <p className="p-4 text-gray-400 text-sm">Loading route...</p>
              ) : sessions.length === 0 ? (
                <p className="p-4 text-gray-400 text-sm">No sessions found for this date</p>
              ) : (
                <div style={{ height: '450px' }}>
                  <RouteMap sessions={sessions} />
                </div>
              )}

              {/* Sessions detail */}
              {sessions.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Sessions</h4>
                  <div className="space-y-2">
                    {sessions.map((s, i) => (
                      <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-700">Session {i + 1}</span>
                          <span className="text-gray-500">{formatTime(s.started_at)} — {formatTime(s.ended_at)}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-600">{formatDuration(s.started_at, s.ended_at)}</span>
                          <span className="font-medium text-gray-800">{parseFloat(s.total_distance_km).toFixed(2)} km</span>
                          <span className="text-gray-500">{s.point_count} pts</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {s.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'visits' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow px-4 py-3 flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date</label>
              <DateInput value={visitDate} onChange={(e) => setVisitDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Salesperson</label>
              <select value={visitSP} onChange={(e) => setVisitSP(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm min-w-[200px]">
                <option value="">All Salespersons</option>
                {salespersons.map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Visit Summary Cards */}
          {visitSummary.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500">Total Visits</p>
                <p className="text-2xl font-bold text-gray-800">
                  {visitSummary.reduce((s, r) => s + r.total_visits, 0)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500">Avg Duration</p>
                <p className="text-2xl font-bold text-gray-800">
                  {(() => {
                    const vals = visitSummary.filter(r => r.avg_duration_minutes);
                    return vals.length > 0 ? Math.round(vals.reduce((s, r) => s + r.avg_duration_minutes, 0) / vals.length) : 0;
                  })()} min
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500">Verified %</p>
                <p className="text-2xl font-bold text-gray-800">
                  {(() => {
                    const total = visitSummary.reduce((s, r) => s + r.total_visits, 0);
                    const verified = visitSummary.reduce((s, r) => s + r.verified_visits, 0);
                    return total > 0 ? Math.round((verified / total) * 100) : 0;
                  })()}%
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-500">Unique Customers</p>
                <p className="text-2xl font-bold text-gray-800">
                  {visitSummary.reduce((s, r) => s + r.unique_customers, 0)}
                </p>
              </div>
            </div>
          )}

          {/* Per-Salesperson Summary */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Visit Summary by Salesperson</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salesperson</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Visits</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Verified</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Avg Duration</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Duration</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Customers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visitLoading ? (
                    <tr><td colSpan={6} className="px-4 py-4 text-gray-400 text-sm text-center">Loading...</td></tr>
                  ) : visitSummary.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-4 text-gray-400 text-sm text-center">No data</td></tr>
                  ) : visitSummary.map((r) => (
                    <tr key={r.salesperson_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.salesperson_name}</td>
                      <td className="px-4 py-3 text-sm text-right">{r.total_visits}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={r.verified_visits < r.total_visits ? 'text-yellow-600' : 'text-green-600'}>
                          {r.verified_visits}/{r.total_visits}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{r.avg_duration_minutes || 0} min</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{r.total_duration_minutes} min</td>
                      <td className="px-4 py-3 text-sm text-right">{r.unique_customers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Visit Detail Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Visit Details</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salesperson</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Duration</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Verified</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visitLoading ? (
                    <tr><td colSpan={7} className="px-4 py-4 text-gray-400 text-sm text-center">Loading...</td></tr>
                  ) : visitList.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-4 text-gray-400 text-sm text-center">No visits</td></tr>
                  ) : visitList.map((v) => (
                    <tr key={v.id} className={`hover:bg-gray-50 ${!v.location_verified ? 'bg-yellow-50' : ''}`}>
                      <td className="px-4 py-3 text-sm text-gray-800 whitespace-nowrap">
                        {formatTime(v.check_in_at)}
                        {v.check_out_at && ` — ${formatTime(v.check_out_at)}`}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{v.salesperson_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{v.customer_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                          {(v.visit_purpose || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {v.duration_minutes ? `${Math.round(v.duration_minutes)} min` : (
                          <span className="text-blue-600 text-xs">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {v.location_verified ? (
                          <span className="text-green-600 font-bold">&#10003;</span>
                        ) : (
                          <span className="text-red-500" title={`${Math.round(v.distance_from_customer_m)}m away`}>&#10007;</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {v.outcome ? (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            v.outcome === 'INTERESTED' ? 'bg-green-100 text-green-700' :
                            v.outcome === 'ORDER_PLACED' ? 'bg-purple-100 text-purple-700' :
                            v.outcome === 'NOT_INTERESTED' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {v.outcome.replace(/_/g, ' ')}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RouteMap({ sessions }) {
  const allPoints = sessions.flatMap(s => s.points || []);
  const center = allPoints.length > 0
    ? [parseFloat(allPoints[0].latitude), parseFloat(allPoints[0].longitude)]
    : [13.0827, 80.2707];

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {sessions.map((sess, si) => {
        const pts = (sess.points || []).map(p => [parseFloat(p.latitude), parseFloat(p.longitude)]);
        if (pts.length === 0) return null;
        const color = COLORS[si % COLORS.length];
        return (
          <span key={sess.id}>
            <Polyline positions={pts} pathOptions={{ color, weight: 3, opacity: 0.8 }} />
            <Marker position={pts[0]} icon={startIcon}>
              <Popup>Start: {formatTime(sess.started_at)}</Popup>
            </Marker>
            <Marker position={pts[pts.length - 1]} icon={endIcon}>
              <Popup>End: {formatTime(sess.ended_at || 'In progress')}</Popup>
            </Marker>
          </span>
        );
      })}
    </MapContainer>
  );
}
