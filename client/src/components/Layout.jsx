import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { getFileUrl } from '../services/api';

const DEFAULT_SIDEBAR_COLOR = '#2057A5';
const DEFAULT_ACCENT_COLOR = '#EAB308';

const orgNavItems = [
  { to: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4', capability: 'dashboard' },
  { to: '/products', label: 'Products', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', capability: 'products' },
  { to: '/categories', label: 'Categories', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z', capability: 'categories' },
  { to: '/customers', label: 'Customers', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', capability: 'customers' },
  { to: '/batches', label: 'Material In', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', capability: 'material_in' },
  { to: '/stock-movements', label: 'Movements', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', capability: 'movements' },
  { to: '/orders', label: 'Material Out', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', capability: 'material_out' },
  { to: '/stock-report', label: 'Reports', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', capability: 'reports' },
  { to: '/users', label: 'User Management', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', capability: 'user_management' },
  { to: '/roles', label: 'Role Management', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', capability: 'role_management' },
  { to: '/units', label: 'Unit Management', icon: 'M3 6h18M3 12h18M3 18h18', capability: 'unit_management' },
  { to: '/customization', label: 'Customization', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', capability: 'customization' },
];

const superAdminNavItems = [
  { to: '/', label: 'Platform Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { to: '/orgs', label: 'Organizations', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const [branding, setBranding] = useState(null);

  const isSuperAdmin = user?.is_super_admin;
  const capabilities = user?.capabilities || [];

  useEffect(() => {
    if (isSuperAdmin || !user) return;
    api.get('/org/customization')
      .then(({ data }) => setBranding(data))
      .catch(() => {});
  }, [isSuperAdmin, user]);

  const sidebarColor = branding?.sidebar_color || DEFAULT_SIDEBAR_COLOR;
  const accentColor = branding?.accent_color || DEFAULT_ACCENT_COLOR;
  const sidebarLogoUrl = branding?.sidebar_logo_url ? getFileUrl(branding.sidebar_logo_url) : null;
  const sidebarIconUrl = branding?.sidebar_icon_url ? getFileUrl(branding.sidebar_icon_url) : null;
  const faviconUrl = branding?.favicon_url ? getFileUrl(branding.favicon_url) : null;
  const sidebarTagline = branding?.sidebar_tagline || 'Inventory System';

  // Apply favicon dynamically
  useEffect(() => {
    if (!faviconUrl) return;
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }, [faviconUrl]);

  let navItems;
  if (isSuperAdmin) {
    navItems = superAdminNavItems;
  } else {
    navItems = orgNavItems.filter(
      (item) => user && capabilities.includes(item.capability)
    );
  }

  const orgName = isSuperAdmin ? 'Platform Admin' : (user?.org_name || 'Inventory System');

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${collapsed ? 'md:w-16' : 'md:w-64'}
          fixed inset-y-0 left-0 z-50 w-64
          transform transition-transform duration-300 md:transition-all md:duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:relative md:flex
          text-white flex flex-col
        `}
        style={{ backgroundColor: sidebarColor }}
      >
        {/* Header */}
        <div className="p-3 border-b border-white/20 flex items-center gap-2">
          {!isSuperAdmin && (
            <img
              src={sidebarLogoUrl || '/gree-logo.png'}
              alt="Logo"
              className="h-9 w-9 object-contain flex-shrink-0"
            />
          )}
          {isSuperAdmin && (
            <div className="h-9 w-9 flex-shrink-0 flex items-center justify-center rounded-full bg-yellow-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          )}
          {!collapsed && (
            <>
              {!isSuperAdmin && <img src={sidebarIconUrl || '/gree-favicon.png'} alt="Icon" className="h-9 w-9 object-contain flex-shrink-0" />}
              <div className="overflow-hidden">
                <div className="text-sm font-bold leading-tight truncate" style={{ color: accentColor }}>{branding?.display_name || orgName}</div>
                <div className="text-[10px] text-blue-200 leading-tight">
                  {isSuperAdmin ? 'Super Admin Panel' : sidebarTagline}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User info */}
        {user && !collapsed && (
          <div className="px-4 py-2 border-b border-white/20">
            <div className="text-sm font-medium text-white truncate">{user.name}</div>
            <div className="text-[10px] text-blue-200 capitalize">
              {isSuperAdmin ? 'Super Admin' : user.role}
            </div>
          </div>
        )}

        {/* Toggle Button (desktop only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:block mx-auto my-2 p-1.5 rounded hover:bg-white/15 text-blue-200 hover:text-white transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>

        {/* Nav */}
        <nav className={`flex-1 ${collapsed ? 'px-2' : 'px-4'} space-y-1 overflow-y-auto scrollbar-hide`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'font-semibold'
                    : 'text-blue-100 hover:bg-white/15 hover:text-white'
                }`
              }
              style={({ isActive }) => isActive ? { backgroundColor: accentColor, color: '#1f2937' } : {}}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Logout Button */}
        <div className={`${collapsed ? 'px-2' : 'px-4'} py-2 border-t border-white/20`}>
          <button
            onClick={logout}
            title={collapsed ? 'Logout' : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded w-full text-blue-100 hover:bg-white/15 hover:text-white transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        {/* Footer */}
        {!collapsed && !isSuperAdmin && (
          <div className="p-4 border-t border-white/20 text-[10px] text-blue-200 leading-tight">
            {user?.org_name || 'Inventory System'}<br />
            {user?.org_code || ''}
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow px-3 py-2 md:px-6 md:py-4 flex items-center justify-between gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Open menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-base md:text-xl font-semibold text-gray-800 truncate">
            {isSuperAdmin ? 'Platform Administration' : 'Inventory & Stock Management'}
          </h1>
          <span className="text-xs text-gray-400 hidden sm:inline">
            {isSuperAdmin ? 'Multi-Tenant Platform' : 'Quality you can trust'}
          </span>
        </header>
        <main className="flex-1 overflow-auto p-3 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
