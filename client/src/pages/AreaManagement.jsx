import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import { fmtDate } from '../utils/date';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const CHENNAI_CENTER = [13.0827, 80.2707];
const AREA_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const getColor = (i) => AREA_COLORS[i % AREA_COLORS.length];

function CenterPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom || 13, { duration: 1 });
  }, [center, zoom]);
  return null;
}

function LocationSearch({ value, onChange, onSelect }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchLocation = async (text) => {
    if (text.length < 2) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=in&limit=8&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      setSuggestions(data);
      setShowDropdown(true);
    } catch {
      setSuggestions([]);
    }
    setSearching(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => searchLocation(val), 400);
  };

  const handleSelect = (item) => {
    const name = item.display_name.split(',').slice(0, 2).join(', ');
    setQuery(name);
    onChange(name);
    onSelect({
      name,
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    });
    setShowDropdown(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
        placeholder="Search location... e.g., Koyambedu, Chennai"
      />
      {searching && (
        <div className="absolute right-3 top-2.5 text-xs text-gray-400">Searching...</div>
      )}
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-b shadow-lg max-h-60 overflow-auto mt-0.5">
          {suggestions.map((item) => (
            <li
              key={item.place_id}
              onClick={() => handleSelect(item)}
              className="px-3 py-2 hover:bg-yellow-50 cursor-pointer border-b border-gray-100 last:border-0"
            >
              <p className="text-sm font-medium text-gray-800">{item.display_name.split(',').slice(0, 2).join(', ')}</p>
              <p className="text-xs text-gray-400 truncate">{item.display_name}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AreaManagement() {
  const [areas, setAreas] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState('areas');
  const [report, setReport] = useState([]);

  // Area form
  const [showForm, setShowForm] = useState(false);
  const [areaForm, setAreaForm] = useState({ area_name: '', description: '', radius_km: 5 });
  const [centerPosition, setCenterPosition] = useState(null);
  const [editingArea, setEditingArea] = useState(null);
  const [mapKey, setMapKey] = useState(0);
  const [flyTarget, setFlyTarget] = useState(null);

  // Assignment form
  const [assignForm, setAssignForm] = useState({ salesperson_id: '', area_id: '' });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    try {
      const [areasRes, assignRes, usersRes] = await Promise.all([
        api.get('/areas'),
        api.get('/areas/assignments'),
        api.get('/users'),
      ]);
      setAreas(areasRes.data);
      setAssignments(assignRes.data);
      setSalespersons(usersRes.data.filter(u => u.role === 'salesperson' && u.is_active));
    } catch {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchReport = async () => {
    try {
      const res = await api.get('/areas/report');
      setReport(res.data);
    } catch {
      showToast('Failed to load report', 'error');
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (tab === 'report') fetchReport(); }, [tab]);

  const resetForm = () => {
    setShowForm(false);
    setEditingArea(null);
    setAreaForm({ area_name: '', description: '', radius_km: 5 });
    setCenterPosition(null);
    setFlyTarget(null);
  };

  const handleSaveArea = async () => {
    if (!areaForm.area_name.trim()) {
      return showToast('Area name is required', 'error');
    }
    if (!centerPosition) {
      return showToast('Click on the map to set the area center point', 'error');
    }
    if (!areaForm.radius_km || areaForm.radius_km <= 0) {
      return showToast('Radius must be greater than 0', 'error');
    }

    try {
      const payload = {
        area_name: areaForm.area_name,
        description: areaForm.description,
        boundary_type: 'CIRCLE',
        center_latitude: centerPosition[0],
        center_longitude: centerPosition[1],
        radius_km: areaForm.radius_km,
      };

      if (editingArea) {
        await api.put(`/areas/${editingArea.id}`, payload);
        showToast('Area updated');
      } else {
        await api.post('/areas', payload);
        showToast('Area created');
      }

      resetForm();
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save area', 'error');
    }
  };

  const handleDeleteArea = async (id) => {
    if (!confirm('Delete this area? Assignments will also be removed.')) return;
    try {
      await api.delete(`/areas/${id}`);
      showToast('Area deleted');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const handleEditArea = (area) => {
    setEditingArea(area);
    setAreaForm({
      area_name: area.area_name,
      description: area.description || '',
      radius_km: area.radius_km ? parseFloat(area.radius_km) : 5,
    });
    if (area.center_latitude && area.center_longitude) {
      setCenterPosition([parseFloat(area.center_latitude), parseFloat(area.center_longitude)]);
    }
    setShowForm(true);
    setMapKey(k => k + 1);
  };

  const handleAssign = async () => {
    if (!assignForm.salesperson_id || !assignForm.area_id) {
      return showToast('Select both area and salesperson', 'error');
    }
    try {
      await api.post('/areas/assign', assignForm);
      showToast('Salesperson assigned');
      setAssignForm({ salesperson_id: '', area_id: '' });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to assign', 'error');
    }
  };

  const handleRemoveAssignment = async (id) => {
    if (!confirm('Remove this assignment?')) return;
    try {
      await api.delete(`/areas/assign/${id}`);
      showToast('Assignment removed');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to remove', 'error');
    }
  };

  const formatINR = (val) =>
    parseFloat(val || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

  if (loading) return <div className="text-gray-500">Loading...</div>;

  // Determine map center
  const mapCenter = centerPosition || (areas.length > 0 && areas[0].center_latitude
    ? [parseFloat(areas[0].center_latitude), parseFloat(areas[0].center_longitude)]
    : CHENNAI_CENTER);

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-800 mb-4">Area Management</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {['areas', 'assignments', 'report'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-t text-sm font-medium ${
              tab === t ? 'bg-white text-gray-800 border-t-2 border-yellow-500' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {t === 'areas' ? 'Areas' : t === 'assignments' ? 'Assignments' : 'Area Report'}
          </button>
        ))}
      </div>

      {/* AREAS TAB */}
      {tab === 'areas' && (
        <div>
          {/* Map showing all areas */}
          <div className="bg-white rounded-lg shadow mb-4 overflow-hidden" style={{ height: '400px' }}>
            <MapContainer key={mapKey} center={mapCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Fly to selected location */}
              {flyTarget && <FlyTo center={flyTarget} zoom={13} />}

              {/* Click to set center when form is open */}
              {showForm && <CenterPicker onPick={setCenterPosition} />}

              {/* Show center marker when picking */}
              {showForm && centerPosition && (
                <Marker
                  position={centerPosition}
                  draggable
                  eventHandlers={{
                    dragend(e) {
                      const { lat, lng } = e.target.getLatLng();
                      setCenterPosition([lat, lng]);
                    },
                  }}
                />
              )}

              {/* Preview circle for current form */}
              {showForm && centerPosition && areaForm.radius_km > 0 && (
                <Circle
                  center={centerPosition}
                  radius={areaForm.radius_km * 1000}
                  pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.15, weight: 2, dashArray: '5,5' }}
                />
              )}

              {/* Existing areas */}
              {areas.map((area, idx) => {
                if (area.center_latitude && area.center_longitude && area.radius_km) {
                  const color = getColor(idx);
                  return (
                    <Circle
                      key={area.id}
                      center={[parseFloat(area.center_latitude), parseFloat(area.center_longitude)]}
                      radius={parseFloat(area.radius_km) * 1000}
                      pathOptions={{ color, fillColor: color, fillOpacity: 0.12, weight: 2 }}
                    >
                      <Popup>
                        <strong>{area.area_name}</strong>
                        <br />{area.radius_km} km radius
                        <br />{area.salesperson_count} salesperson(s)
                      </Popup>
                    </Circle>
                  );
                }
                return null;
              })}
            </MapContainer>
          </div>

          {/* Add Area Button */}
          {!showForm && (
            <button
              onClick={() => { setShowForm(true); setEditingArea(null); setAreaForm({ area_name: '', description: '', radius_km: 5 }); setCenterPosition(null); }}
              className="mb-4 px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 text-sm font-medium"
            >
              + Add Area
            </button>
          )}

          {/* Area creation form */}
          {showForm && (
            <div className="bg-white rounded-lg shadow p-5 mb-4 max-w-lg">
              <h3 className="font-semibold text-gray-700 mb-3">
                {editingArea ? 'Edit Area' : 'New Area'}
              </h3>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Location <span className="text-red-500">*</span>
                </label>
                <LocationSearch
                  value={areaForm.area_name}
                  onChange={(val) => setAreaForm(f => ({ ...f, area_name: val }))}
                  onSelect={(loc) => {
                    setAreaForm(f => ({ ...f, area_name: loc.name }));
                    setCenterPosition([loc.lat, loc.lng]);
                    setFlyTarget([loc.lat, loc.lng]);
                  }}
                />
                <p className="text-xs text-gray-400 mt-1">Type to search places across India. Select to auto-set map center.</p>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={areaForm.description}
                  onChange={e => setAreaForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="e.g., Covers Koyambedu wholesale market area"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Radius (km) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={areaForm.radius_km}
                  onChange={e => setAreaForm(f => ({ ...f, radius_km: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
              </div>

              {/* Center point info */}
              <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
                {centerPosition ? (
                  <div className="text-gray-700">
                    <span className="font-medium text-green-600">Center set:</span>{' '}
                    {centerPosition[0].toFixed(5)}, {centerPosition[1].toFixed(5)}
                    <span className="text-gray-400 ml-2">(drag marker to adjust)</span>
                  </div>
                ) : (
                  <div className="text-gray-500">
                    Click on the map above to set the center point for this area
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveArea}
                  className="px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 text-sm font-medium"
                >
                  {editingArea ? 'Update Area' : 'Save Area'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Areas table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Radius</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Salespersons</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {areas.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No areas defined yet. Click "+ Add Area" to create one.</td></tr>
                ) : areas.map((area, idx) => (
                  <tr key={area.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getColor(idx) }} />
                        <span className="font-medium text-gray-800">{area.area_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{area.description || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                      {area.radius_km ? `${area.radius_km} km` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        parseInt(area.salesperson_count) > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {area.salesperson_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEditArea(area)} className="text-blue-600 hover:text-blue-800 text-sm mr-3">Edit</button>
                      <button onClick={() => handleDeleteArea(area.id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ASSIGNMENTS TAB */}
      {tab === 'assignments' && (
        <div>
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h3 className="font-semibold text-gray-700 mb-3">Assign Area to Salesperson</h3>
            <div className="flex gap-3 items-end flex-wrap">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Area / Location</label>
                <select
                  value={assignForm.area_id}
                  onChange={e => setAssignForm(f => ({ ...f, area_id: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 min-w-[200px]"
                >
                  <option value="">Select area...</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.area_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salesperson</label>
                <select
                  value={assignForm.salesperson_id}
                  onChange={e => setAssignForm(f => ({ ...f, salesperson_id: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-500 min-w-[200px]"
                >
                  <option value="">Select salesperson...</option>
                  {salespersons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button
                onClick={handleAssign}
                className="px-4 py-2 bg-yellow-500 text-gray-900 rounded hover:bg-yellow-600 text-sm font-medium"
              >
                Assign
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area / Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salesperson</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignments.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No assignments yet.</td></tr>
                ) : assignments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{a.area_name}</td>
                    <td className="px-4 py-3 text-gray-600">{a.salesperson_name}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{a.salesperson_phone || '-'}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">{fmtDate(a.assigned_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleRemoveAssignment(a.id)} className="text-red-600 hover:text-red-800 text-sm">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT TAB */}
      {tab === 'report' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Area / Location</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Salespersons</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Customers</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {report.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No area data available.</td></tr>
              ) : report.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{r.area_name}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{r.salesperson_count}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{r.customer_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-800">{formatINR(r.total_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
