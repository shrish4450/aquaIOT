import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  Key,
  Edit2,
  Trash2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  deactivateAdminUser
} from '../services/api';

export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('ZONE_USER');
  const [formZoneId, setFormZoneId] = useState(1);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createAdminUser({
        full_name: formName,
        email: formEmail,
        password: formPassword,
        role: formRole,
        zone_id: formRole === 'ZONE_USER' ? parseInt(formZoneId, 10) : null
      });
      setIsCreateModalOpen(false);
      setFormName('');
      setFormEmail('');
      setFormPassword('');
      loadUsers();
    } catch (err) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateZone = async (userId, targetZoneId) => {
    try {
      await updateAdminUser(userId, { zone_id: targetZoneId ? parseInt(targetZoneId, 10) : 0 });
      loadUsers();
    } catch (err) {
      alert(`Error updating zone: ${err.message}`);
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await updateAdminUser(user.id, { status: newStatus });
      loadUsers();
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Action Bar */}
      <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-logo-icon" style={{ width: '36px', height: '36px' }}>
              <Users size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                User & Zone Assignment Directory
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Manage Facility Administrators, assign residents to zones, and enforce role permissions
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={loadUsers}
            className="scenario-btn"
            style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} />
            <span style={{ fontSize: '0.82rem' }}>Refresh</span>
          </button>
          <button
            onClick={() => {
              setFormError(null);
              setIsCreateModalOpen(true);
            }}
            className="action-btn"
            style={{
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            <UserPlus size={16} />
            Create Zone User
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid rgba(148, 163, 184, 0.15)' }}>
              <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>User</th>
              <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Role</th>
              <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Assigned Zone</th>
              <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>Last Login</th>
              <th style={{ padding: '14px 20px', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                  Loading registered system accounts...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                  No accounts found. Create one using the button above.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.08)' }}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{u.full_name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{u.email}</div>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: u.role === 'ADMIN' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: u.role === 'ADMIN' ? '#38bdf8' : '#10b981',
                        border: `1px solid ${u.role === 'ADMIN' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                      }}
                    >
                      {u.role === 'ADMIN' ? <Shield size={12} /> : <Users size={12} />}
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    {u.role === 'ADMIN' ? (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>All Zones (Facility Wide)</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          value={u.zone_id || 0}
                          onChange={(e) => handleUpdateZone(u.id, e.target.value)}
                          style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(148, 163, 184, 0.25)',
                            borderRadius: '6px',
                            color: '#f8fafc',
                            padding: '4px 8px',
                            fontSize: '0.82rem'
                          }}
                        >
                          <option value="0">Unassigned</option>
                          <option value="1">A Wing</option>
                          <option value="2">B Wing</option>
                          <option value="3">C Wing</option>
                        </select>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '14px 20px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: u.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: u.status === 'ACTIVE' ? '#10b981' : '#ef4444'
                      }}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#94a3b8', fontSize: '0.8rem' }}>
                    {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never logged in'}
                  </td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    {u.role !== 'ADMIN' && (
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className="scenario-btn"
                        style={{
                          padding: '5px 10px',
                          fontSize: '0.75rem',
                          color: u.status === 'ACTIVE' ? '#f87171' : '#34d399',
                          borderColor: u.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(52, 211, 153, 0.3)'
                        }}
                      >
                        {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '440px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', color: '#f8fafc' }}>
              Create New System Account
            </h3>

            {formError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                marginBottom: '12px'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ramesh Kulkarni"
                  required
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="e.g. ramesh@aquanexus.local"
                  required
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Password (min 6 characters)
                </label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: '6px', color: '#fff' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
                  Account Role
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: '6px', color: '#fff' }}
                >
                  <option value="ZONE_USER">Zone Resident (ZONE_USER)</option>
                  <option value="ADMIN">Facility Administrator (ADMIN)</option>
                </select>
              </div>

              {formRole === 'ZONE_USER' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
                    Assigned Zone
                  </label>
                  <select
                    value={formZoneId}
                    onChange={(e) => setFormZoneId(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(148, 163, 184, 0.25)', borderRadius: '6px', color: '#fff' }}
                  >
                    <option value="1">A Wing</option>
                    <option value="2">B Wing</option>
                    <option value="3">C Wing</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="scenario-btn"
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="action-btn"
                  style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #0284c7, #0ea5e9)', color: '#fff', fontWeight: 600 }}
                >
                  {submitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
