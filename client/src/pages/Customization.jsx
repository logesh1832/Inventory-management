import { useState, useEffect, useRef } from 'react';
import api, { getFileUrl } from '../services/api';

const DEFAULT_SIDEBAR = '#2057A5';
const DEFAULT_ACCENT = '#EAB308';

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-gray-300 cursor-pointer p-0.5"
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v);
          }}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-32 font-mono focus:outline-none focus:ring-1 focus:ring-yellow-500"
          placeholder="#000000"
        />
        <button
          type="button"
          onClick={() => onChange(label.toLowerCase().includes('sidebar') ? DEFAULT_SIDEBAR : DEFAULT_ACCENT)}
          className="text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function ImageUploadField({ label, currentUrl, uploadUrl, field, accept, hint, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append(field, file);
      const res = await api.post(uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded(res.data);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const previewUrl = currentUrl ? getFileUrl(currentUrl) : null;

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
          {previewUrl ? (
            <img src={previewUrl} alt={label} className="h-full w-full object-contain" />
          ) : (
            <svg className="h-6 w-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">{hint}</p>
        </div>
      </div>
      <div>
        <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
        <button
          type="button"
          onClick={() => inputRef.current.click()}
          disabled={uploading}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : currentUrl ? 'Change' : 'Upload'}
        </button>
      </div>
    </div>
  );
}

export default function Customization() {
  const [branding, setBranding] = useState(null);
  const [sidebarColor, setSidebarColor] = useState(DEFAULT_SIDEBAR);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [displayName, setDisplayName] = useState('');
  const [tagline, setTagline] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    api.get('/org/customization').then(({ data }) => {
      setBranding(data);
      setSidebarColor(data.sidebar_color || DEFAULT_SIDEBAR);
      setAccentColor(data.accent_color || DEFAULT_ACCENT);
      setDisplayName(data.display_name || '');
      setTagline(data.sidebar_tagline || '');
    }).catch(() => showToast('Failed to load customization', 'error'));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/org/customization', {
        sidebar_color: sidebarColor,
        accent_color: accentColor,
        display_name: displayName || null,
        sidebar_tagline: tagline || null,
      });
      setBranding((prev) => ({ ...prev, ...res.data }));
      showToast('Saved! Refresh the page to see the updated sidebar.');
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUploaded = (data) => {
    setBranding((prev) => ({ ...prev, ...data }));
    showToast('Image uploaded successfully. Refresh to see changes.');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white text-sm ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-800">Customization</h2>

      {/* Branding Assets */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-800">Branding Assets</h3>
          <p className="text-xs text-gray-400 mt-0.5">Upload your logo and favicon to personalize the sidebar.</p>
        </div>
        <div className="px-5 py-2">
          <ImageUploadField
            label="Sidebar Logo"
            currentUrl={branding?.sidebar_logo_url}
            uploadUrl="/org/customization/logo"
            field="logo"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            hint="PNG, JPG, SVG or WebP · Max 2MB · Left icon in sidebar header"
            onUploaded={handleUploaded}
          />
          <ImageUploadField
            label="Sidebar Icon"
            currentUrl={branding?.sidebar_icon_url}
            uploadUrl="/org/customization/icon"
            field="icon"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            hint="PNG, JPG, SVG or WebP · Max 1MB · Right icon next to org name"
            onUploaded={handleUploaded}
          />
          <ImageUploadField
            label="Favicon"
            currentUrl={branding?.favicon_url}
            uploadUrl="/org/customization/favicon"
            field="favicon"
            accept="image/png,image/jpeg,image/x-icon,image/svg+xml"
            hint="PNG, ICO or SVG · Max 512KB · Shown in browser tab"
            onUploaded={handleUploaded}
          />
        </div>
      </div>

      {/* Colors & Name */}
      <form onSubmit={handleSave} className="bg-white rounded-lg shadow">
        <div className="px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-800">Colors & Display Name</h3>
          <p className="text-xs text-gray-400 mt-0.5">Use hex color codes (#RRGGBB).</p>
        </div>
        <div className="px-5 py-4 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={branding?.org_name || 'Your org name'}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-1 focus:ring-yellow-500"
            />
            <p className="text-xs text-gray-400 mt-1">Short name shown in the sidebar header. Defaults to org name if blank.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sidebar Tagline</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Inventory System"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-1 focus:ring-yellow-500"
            />
            <p className="text-xs text-gray-400 mt-1">Subtitle shown below the display name. Defaults to "Inventory System" if blank.</p>
          </div>
          <ColorField label="Sidebar Color" value={sidebarColor} onChange={setSidebarColor} />
          <ColorField label="Accent Color" value={accentColor} onChange={setAccentColor} />

          {/* Live Preview */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Live Preview</p>
            <div className="rounded-lg overflow-hidden shadow-md w-48" style={{ backgroundColor: sidebarColor }}>
              <div className="p-3 border-b border-white/20 flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-white/20 flex-shrink-0" />
                <div>
                  <div className="text-xs font-bold leading-tight truncate" style={{ color: accentColor }}>
                    {displayName || branding?.org_name || 'Org Name'}
                  </div>
                  <div className="text-[10px] text-white/60 leading-tight">{tagline || 'Inventory System'}</div>
                </div>
              </div>
              <div className="p-2 space-y-1">
                {['Dashboard', 'Products', 'Material In'].map((item, i) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium"
                    style={i === 0 ? { backgroundColor: accentColor, color: '#1f2937' } : { color: 'rgba(255,255,255,0.7)' }}
                  >
                    <div className="h-3 w-3 rounded-sm bg-current opacity-60" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving}
            className="bg-yellow-500 text-gray-900 font-semibold px-5 py-2 rounded hover:bg-yellow-400 disabled:opacity-50 text-sm transition-colors"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
