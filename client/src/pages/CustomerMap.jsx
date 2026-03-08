import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const CHENNAI_CENTER = [13.0827, 80.2707];

export default function CustomerMap() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data } = await api.get('/customers/map');
        setCustomers(data);
      } catch {
        setError('Failed to load customer locations');
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, []);

  // Fit bounds once customers are loaded and map is ready
  useEffect(() => {
    if (mapRef.current && customers.length > 0) {
      const bounds = L.latLngBounds(
        customers.map((c) => [parseFloat(c.latitude), parseFloat(c.longitude)])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [customers]);

  if (loading) {
    return <div className="text-gray-500">Loading map...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Customer Map</h2>
        <span className="text-sm text-gray-500">
          {customers.length} customer{customers.length !== 1 ? 's' : ''} with GPS location
        </span>
      </div>

      <div className="rounded-lg overflow-hidden border border-gray-300 shadow" style={{ height: 'calc(100vh - 200px)', width: '100%' }}>
        <MapContainer
          center={CHENNAI_CENTER}
          zoom={11}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {customers.map((customer) => (
            <Marker
              key={customer.id}
              position={[parseFloat(customer.latitude), parseFloat(customer.longitude)]}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold text-gray-800">{customer.customer_name}</p>
                  {customer.phone && (
                    <p className="text-gray-600">{customer.phone}</p>
                  )}
                  {customer.address && (
                    <p className="text-gray-500 text-xs mt-1">{customer.address}</p>
                  )}
                  <Link
                    to={`/customers/${customer.id}/edit`}
                    className="text-yellow-600 hover:text-yellow-700 text-xs mt-2 inline-block"
                  >
                    Edit Customer
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
