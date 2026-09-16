import React, { useState, useEffect, useRef } from 'react';
import {
  Droplets,
  User as UserIcon,
  Shield,
  ChevronDown,
  LogOut,
  LogIn,
  Home,
  Layers,
  AlertTriangle,
  Sliders,
  MoreHorizontal
} from 'lucide-react';

export default function Header({
  currentUser,
  activeTab = 'home',
  onTabChange,
  activeAlertsCount = 0,
  onOpenLogin,
  onQuickSwitchUser,
  onLogout
}) {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAdmin = currentUser?.role === 'ADMIN';

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="shadcn-header">
      <div className="simple-header-top">
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'hsl(var(--foreground))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--background))',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
            }}
          >
            <Droplets size={20} strokeWidth={2.5} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'hsl(var(--foreground))', letterSpacing: '-0.025em' }}>
              AQUA-NEXUS
            </span>
            <span className="shadcn-badge badge-outline" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>
              Water System
            </span>
          </div>
        </div>

        {/* User Account / Role Switcher */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          {currentUser ? (
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="shadcn-btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                height: '38px',
                borderRadius: '8px'
              }}
              aria-expanded={userDropdownOpen}
              aria-haspopup="true"
              aria-label="User account menu"
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '9999px',
                  backgroundColor: isAdmin ? 'rgba(56, 189, 248, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                  color: isAdmin ? '#38bdf8' : '#4ade80',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}
              >
                {getInitials(currentUser.full_name || currentUser.email)}
              </div>
              <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'hsl(var(--foreground))', display: 'block' }}>
                  {currentUser.full_name || currentUser.email}
                </span>
                <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))' }}>
                  {isAdmin ? 'Facility Admin' : `Resident (${currentUser.zone_name || (currentUser.zone_id === 1 ? 'A Wing' : currentUser.zone_id === 2 ? 'B Wing' : 'C Wing')})`}
                </span>
              </div>
              <ChevronDown size={14} color="hsl(var(--muted-foreground))" />
            </button>
          ) : (
            <button
              onClick={onOpenLogin}
              className="shadcn-btn btn-default"
              style={{ height: '36px' }}
            >
              <LogIn size={15} />
              <span>Log In</span>
            </button>
          )}

          {/* Switcher Dropdown */}
          {userDropdownOpen && (
            <div className="shadcn-dropdown" style={{ width: '260px' }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid hsl(var(--border))', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', display: 'block' }}>
                  Switch Account
                </span>
              </div>

              {/* Admin */}
              <button
                onClick={() => {
                  onQuickSwitchUser('admin@aquanexus.local', 'Admin@123');
                  setUserDropdownOpen(false);
                }}
                className="shadcn-dropdown-item"
              >
                <Shield size={15} color="#38bdf8" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>Facility Admin</strong>
                    <span className="shadcn-badge badge-outline" style={{ fontSize: '0.625rem', padding: '0 0.35rem' }}>Admin</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>Full facility control</span>
                </div>
              </button>

              {/* A Wing */}
              <button
                onClick={() => {
                  onQuickSwitchUser('zone1@aquanexus.local', 'Zone1@123');
                  setUserDropdownOpen(false);
                }}
                className="shadcn-dropdown-item"
              >
                <UserIcon size={15} color="#4ade80" />
                <div>
                  <strong style={{ display: 'block' }}>A Wing User</strong>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>A Wing</span>
                </div>
              </button>

              {/* B Wing */}
              <button
                onClick={() => {
                  onQuickSwitchUser('zone2@aquanexus.local', 'Zone2@123');
                  setUserDropdownOpen(false);
                }}
                className="shadcn-dropdown-item"
              >
                <UserIcon size={15} color="#4ade80" />
                <div>
                  <strong style={{ display: 'block' }}>B Wing User</strong>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>B Wing</span>
                </div>
              </button>

              {/* C Wing */}
              <button
                onClick={() => {
                  onQuickSwitchUser('zone3@aquanexus.local', 'Zone3@123');
                  setUserDropdownOpen(false);
                }}
                className="shadcn-dropdown-item"
              >
                <UserIcon size={15} color="#4ade80" />
                <div>
                  <strong style={{ display: 'block' }}>C Wing User</strong>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>C Wing</span>
                </div>
              </button>

              <div className="shadcn-separator" />

              <button
                onClick={() => {
                  onLogout();
                  setUserDropdownOpen(false);
                }}
                className="shadcn-dropdown-item"
                style={{ color: '#f87171' }}
              >
                <LogOut size={15} />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. ADMIN NAVIGATION TABS (5 SHADCN TABS) */}
      {isAdmin && onTabChange && (
        <div style={{ maxWidth: '1200px', margin: '12px auto 0 auto', display: 'flex' }}>
          <nav
            className="shadcn-tabs-list"
            aria-label="Admin Primary Navigation"
          >
            <button
              onClick={() => onTabChange('home')}
              className={`shadcn-tabs-trigger ${activeTab === 'home' ? 'active' : ''}`}
            >
              <Home size={15} />
              <span>Home</span>
            </button>

            <button
              onClick={() => onTabChange('zones')}
              className={`shadcn-tabs-trigger ${activeTab === 'zones' || activeTab === 'zone-detail' ? 'active' : ''}`}
            >
              <Layers size={15} />
              <span>Zones</span>
            </button>

            <button
              onClick={() => onTabChange('alerts')}
              className={`shadcn-tabs-trigger ${activeTab === 'alerts' ? 'active' : ''}`}
            >
              <AlertTriangle size={15} />
              <span>Alerts {activeAlertsCount > 0 ? `(${activeAlertsCount})` : ''}</span>
            </button>

            <button
              onClick={() => onTabChange('control')}
              className={`shadcn-tabs-trigger ${activeTab === 'control' ? 'active' : ''}`}
            >
              <Sliders size={15} />
              <span>Control</span>
            </button>

            <button
              onClick={() => onTabChange('more')}
              className={`shadcn-tabs-trigger ${activeTab === 'more' ? 'active' : ''}`}
            >
              <MoreHorizontal size={15} />
              <span>More</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
