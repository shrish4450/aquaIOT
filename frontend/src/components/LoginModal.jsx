import React, { useState } from 'react';
import { LogIn, Shield, User, X, CheckCircle, AlertCircle, Key } from 'lucide-react';
import { loginUser } from '../services/api';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail, demoPass) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setLoading(true);
    loginUser(demoEmail, demoPass)
      .then((data) => {
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
        onClose();
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '460px', width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-logo-icon" style={{ width: '32px', height: '32px' }}>
              <Shield size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                AQUA-NEXUS Authentication
              </h2>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                Role-based access for Admin & Zone Users
              </p>
            </div>
          </div>
          <button onClick={onClose} className="scenario-btn" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@aquanexus.local"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="action-btn"
            style={{
              width: '100%',
              padding: '11px',
              marginTop: '6px',
              background: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <LogIn size={16} />
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Accounts Preset Buttons */}
        <div style={{ marginTop: '22px', borderTop: '1px solid rgba(148, 163, 184, 0.15)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <Key size={14} color="#38bdf8" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#38bdf8', letterSpacing: '0.05em' }}>
              Quick Demo Accounts
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@aquanexus.local', 'Admin@123')}
              className="scenario-btn"
              style={{ padding: '8px 10px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(56, 189, 248, 0.08)' }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#38bdf8' }}>👑 Facility Admin</span>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Full System Control</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('zone1@aquanexus.local', 'Zone1@123')}
              className="scenario-btn"
              style={{ padding: '8px 10px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px' }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#10b981' }}>💧 A Wing User</span>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>A Wing Resident</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('zone2@aquanexus.local', 'Zone2@123')}
              className="scenario-btn"
              style={{ padding: '8px 10px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(16, 185, 129, 0.08)' }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#38bdf8' }}>💧 B Wing User</span>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>B Wing Resident</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('zone3@aquanexus.local', 'Zone3@123')}
              className="scenario-btn"
              style={{ padding: '8px 10px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '2px' }}
            >
              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#a855f7' }}>💧 C Wing User</span>
              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>C Wing Resident</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
