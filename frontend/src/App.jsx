import React, { useState, useEffect, useCallback } from 'react';

import Header from './components/Header';
import AdminHome from './components/AdminHome';
import AdminZonesList from './components/AdminZonesList';
import AdminZoneDetailView from './components/AdminZoneDetailView';
import AdminControl from './components/AdminControl';
import AdminAlertsSimple from './components/AdminAlertsSimple';
import AdminMore from './components/AdminMore';
import ZoneUserDashboard from './components/ZoneUserDashboard';
import SettingsModal from './components/SettingsModal';
import LoginModal from './components/LoginModal';

import {
  fetchDashboard,
  fetchAlerts,
  fetchConsumption,
  ackAlert,
  resolveAlert,
  controlPump,
  controlValve,
  triggerScenario,
  connectTelemetryWebSocket,
  loginUser,
  fetchCurrentUser,
  clearAuthToken,
  getAuthToken,
} from './services/api';

export default function App() {
  // Navigation: 'home' | 'zones' | 'alerts' | 'control' | 'more'
  const [activeTab, setActiveTab] = useState('home');
  const [selectedZoneId, setSelectedZoneId] = useState(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);

  // Telemetry state
  const [dashboardData, setDashboardData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [consumptionData, setConsumptionData] = useState(null);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize Auth Session & URL Routing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user');

    if (userParam === 'zone2') {
      loginUser('zone2@aquanexus.local', 'Zone2@123').then((res) => setCurrentUser(res.user));
    } else if (userParam === 'zone1') {
      loginUser('zone1@aquanexus.local', 'Zone1@123').then((res) => setCurrentUser(res.user));
    } else if (userParam === 'zone3') {
      loginUser('zone3@aquanexus.local', 'Zone3@123').then((res) => setCurrentUser(res.user));
    } else if (userParam === 'admin') {
      loginUser('admin@aquanexus.local', 'Admin@123').then((res) => setCurrentUser(res.user));
    } else {
      const existingToken = getAuthToken();
      if (existingToken) {
        fetchCurrentUser()
          .then((user) => setCurrentUser(user))
          .catch(() => {
            loginUser('admin@aquanexus.local', 'Admin@123')
              .then((res) => setCurrentUser(res.user))
              .catch((e) => console.warn('Demo login notice:', e.message));
          });
      } else {
        loginUser('admin@aquanexus.local', 'Admin@123')
          .then((res) => setCurrentUser(res.user))
          .catch((e) => console.warn('Demo login notice:', e.message));
      }
    }

    const handleHash = () => {
      const h = window.location.hash.replace('#', '');
      if (h.startsWith('zone-')) {
        const id = parseInt(h.replace('zone-', ''), 10);
        if (id) {
          setActiveTab('zones');
          setSelectedZoneId(id);
        }
      } else if (['home', 'zones', 'alerts', 'control', 'more'].includes(h)) {
        setActiveTab(h);
        if (h !== 'zones') setSelectedZoneId(null);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Load baseline admin data
  const loadData = useCallback(async () => {
    try {
      const [dash, alts, cons] = await Promise.all([
        fetchDashboard(),
        fetchAlerts(false),
        fetchConsumption(),
      ]);
      setDashboardData(dash);
      setAlerts(alts);
      setConsumptionData(cons);
      setMqttConnected(dash.mqtt_connected);
    } catch (e) {
      console.warn('Initial data load notice:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Setup WebSocket with fallback polling
    const cleanupWs = connectTelemetryWebSocket(
      (snapshot) => {
        setDashboardData(snapshot);
        setMqttConnected(snapshot.mqtt_connected);
      },
      (connected) => {
        setMqttConnected(connected);
      }
    );

    // Polling every 2s for alerts & background updates
    const pollTimer = setInterval(() => {
      loadData();
    }, 2000);

    return () => {
      cleanupWs();
      clearInterval(pollTimer);
    };
  }, [loadData]);

  // Actions
  const handleQuickSwitchUser = async (email, password) => {
    try {
      const res = await loginUser(email, password);
      setCurrentUser(res.user);
      setSelectedZoneId(null);
      setActiveTab('home');
      if (res.user.role === 'ADMIN') {
        loadData();
      }
    } catch (e) {
      alert(`Account switch failed: ${e.message}`);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setCurrentUser(null);
    setIsLoginModalOpen(true);
  };

  const handleSelectScenario = async (scenario) => {
    try {
      await triggerScenario(scenario);
      await loadData();
    } catch (e) {
      alert(`Failed to trigger scenario: ${e.message}`);
    }
  };

  const handleTogglePump = async (targetState) => {
    try {
      await controlPump(targetState);
      await loadData();
    } catch (e) {
      alert(`Failed to switch pump: ${e.message}`);
    }
  };

  const handleToggleValve = async (zoneId, targetState) => {
    try {
      await controlValve(zoneId, targetState);
      await loadData();
    } catch (e) {
      alert(`Failed to switch valve: ${e.message}`);
    }
  };

  const handleAcknowledgeAlert = async (id) => {
    try {
      await ackAlert(id);
      const updated = await fetchAlerts(false);
      setAlerts(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResolveAlert = async (id) => {
    try {
      await resolveAlert(id);
      const updated = await fetchAlerts(false);
      setAlerts(updated);
    } catch (e) {
      console.error(e);
    }
  };

  // If user is a ZONE_USER, render the simplified Zone User experience!
  if (currentUser && currentUser.role === 'ZONE_USER') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
        <Header
          currentUser={currentUser}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onQuickSwitchUser={handleQuickSwitchUser}
          onLogout={handleLogout}
        />

        <main style={{ flex: 1 }}>
          <ZoneUserDashboard
            user={currentUser}
            onLogout={handleLogout}
            onSwitchUser={() => setIsLoginModalOpen(true)}
          />
        </main>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={(u) => {
            setCurrentUser(u);
            if (u.role === 'ADMIN') loadData();
          }}
        />
      </div>
    );
  }

  // Otherwise, render simplified Admin experience!
  const zones = dashboardData?.zones || [];
  const pumpState = dashboardData?.pump_state || 'ON';
  const activeAlertsCount = alerts.filter((a) => !a.is_resolved).length;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* Clean Simplified Header with 5 Primary Tabs */}
      <Header
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'zones') setSelectedZoneId(null);
        }}
        activeAlertsCount={activeAlertsCount}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onQuickSwitchUser={handleQuickSwitchUser}
        onLogout={handleLogout}
      />

      {/* Main Content Area: One Primary Purpose Per Screen */}
      <main style={{ flex: 1, paddingBottom: '60px' }}>
        {/* 1. HOME SCREEN */}
        {activeTab === 'home' && (
          <AdminHome
            dashboardData={dashboardData}
            alerts={alerts}
            onSelectZone={(zId) => {
              setSelectedZoneId(zId);
              setActiveTab('zones');
            }}
            onViewAlerts={() => setActiveTab('alerts')}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {/* 2. ZONES LIST OR ZONE DETAIL */}
        {activeTab === 'zones' && (
          selectedZoneId ? (
            <AdminZoneDetailView
              zoneId={selectedZoneId}
              onBack={() => setSelectedZoneId(null)}
              onAllocationUpdated={loadData}
            />
          ) : (
            <AdminZonesList
              zones={zones}
              onSelectZone={(zId) => setSelectedZoneId(zId)}
            />
          )
        )}

        {/* 3. ALERTS SCREEN */}
        {activeTab === 'alerts' && (
          <AdminAlertsSimple
            alerts={alerts}
            onAcknowledge={handleAcknowledgeAlert}
            onResolve={handleResolveAlert}
          />
        )}

        {/* 4. DEDICATED CONTROL SCREEN */}
        {activeTab === 'control' && (
          <AdminControl
            pumpState={pumpState}
            zones={zones}
            onTogglePump={handleTogglePump}
            onToggleValve={handleToggleValve}
          />
        )}

        {/* 5. MORE (ADVANCED ENGINEERING TOOLS) */}
        {activeTab === 'more' && (
          <AdminMore
            dashboardData={dashboardData}
            consumptionData={consumptionData}
            onSelectScenario={handleSelectScenario}
            onTogglePump={handleTogglePump}
            onToggleValve={handleToggleValve}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}
      </main>

      {/* Settings Modal (available when clicked in MORE) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'ADMIN') loadData();
        }}
      />
    </div>
  );
}
