import { useState, useEffect } from 'react';
import api from '../services/api';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '-';

export default function Organizations() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    org_name: '', org_code: '', org_email: '', org_phone: '', address: '',
    admin_name: '', admin_password: '',
  });
  const [editForm, setEditForm] = useState({ org_name: '', org_email: '', org_phone: '', address: '' });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchOrgs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/orgs');
      setOrgs(res.data);
    } catch {
      showToast('Failed to load organizations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/orgs', form);
      showToast('Organization created successfully');
      setShowForm(false);
      setForm({ org_name: '', org_code: '', org_email: '', org_phone: '', address: '', admin_name: '', admin_password: '' });
      fetchOrgs();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to create organization', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleOrgStatus = async (org) => {
    try {
      await api.put(`/orgs/${org.id}`, { is_active: !org.is_active });
      showToast(`Organization ${org.is_active ? 'deactivated' : 'activated'}`);
      fetchOrgs();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const openEdit = (org) => {
    setEditOrg(org);
    setEditForm({ org_name: org.org_name, org_email: org.org_email, org_phone: org.org_phone || '', address: org.address || '' });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.put(`/orgs/${editOrg.id}`, editForm);
      showToast('Organization updated successfully');
      setEditOrg(null);
      fetchOrgs();
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to update organization', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg text-white ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Organizations</h2>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          + Create Organization
        </button>
      </div>

      {/* Create Org Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Create New Organization</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Org Name *</label>
                    <input name="org_name" value={form.org_name} onChange={handleChange} required
                      className="border border-gray-300 rounded px-3 py-2 w-full text-sm" placeholder="ACME Corp" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Org Code *</label>
                    <input name="org_code" value={form.org_code} onChange={handleChange} required
                      className="border border-gray-300 rounded px-3 py-2 w-full text-sm" placeholder="ACME-001" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Org Email *</label>
                  <input name="org_email" type="email" value={form.org_email} onChange={handleChange} required
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" placeholder="admin@acme.com" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                  <input name="org_phone" value={form.org_phone} onChange={handleChange}
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" placeholder="Phone number" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                  <textarea name="address" value={form.address} onChange={handleChange} rows={2}
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" placeholder="Business address" />
                </div>

                <hr className="border-gray-200" />
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">First Admin User</p>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Admin Name *</label>
                  <input name="admin_name" value={form.admin_name} onChange={handleChange} required
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" placeholder="Admin full name" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Admin Password *</label>
                  <input name="admin_password" type="password" value={form.admin_password} onChange={handleChange} required
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" placeholder="Min 6 characters" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)}
                    className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {submitting ? 'Creating...' : 'Create Organization'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Org Modal */}
      {editOrg && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Edit Organization</h3>
                <button onClick={() => setEditOrg(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Org Name *</label>
                  <input value={editForm.org_name} onChange={e => setEditForm({ ...editForm, org_name: e.target.value })} required
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Org Email *</label>
                  <input type="email" value={editForm.org_email} onChange={e => setEditForm({ ...editForm, org_email: e.target.value })} required
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                  <input value={editForm.org_phone} onChange={e => setEditForm({ ...editForm, org_phone: e.target.value })}
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                  <textarea value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} rows={2}
                    className="border border-gray-300 rounded px-3 py-2 w-full text-sm" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setEditOrg(null)}
                    className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Orgs Table */}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : orgs.length === 0 ? (
        <p className="text-gray-500">No organizations yet. Create the first one.</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {orgs.map((org) => (
              <div key={org.id} className="bg-white rounded-lg shadow p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{org.org_name}</p>
                    <p className="text-xs text-gray-500">{org.org_code}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded font-medium ${org.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {org.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{org.org_email}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{org.user_count} users</span>
                  <span>Created {fmtDate(org.created_at)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(org)}
                    className="text-xs px-3 py-1 rounded font-medium bg-blue-50 text-blue-600 hover:bg-blue-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleOrgStatus(org)}
                    className={`text-xs px-3 py-1 rounded font-medium ${org.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                  >
                    {org.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Org</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orgs.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{org.org_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{org.org_code}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{org.org_email}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{org.user_count}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded font-medium ${org.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {org.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{fmtDate(org.created_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(org)}
                          className="text-xs px-3 py-1.5 rounded font-medium bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleOrgStatus(org)}
                          className={`text-xs px-3 py-1.5 rounded font-medium ${org.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                        >
                          {org.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
