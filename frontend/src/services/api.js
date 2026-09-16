/**
 * AQUA-NEXUS API & WebSocket Client Service
 * Supports Bearer token authentication, role authorization, and real-time streams.
 */

const API_BASE = '/api';

// Token Storage
export function getAuthToken() {
  return localStorage.getItem('aqua_nexus_token') || null;
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('aqua_nexus_token', token);
  } else {
    localStorage.removeItem('aqua_nexus_token');
  }
}

export function clearAuthToken() {
  localStorage.removeItem('aqua_nexus_token');
}

/**
 * Enhanced fetch helper that injects Authorization Bearer token if present.
 */
async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  return res;
}

// --- Authentication APIs ---

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Login failed (${res.status})`);
  }
  const data = await res.json();
  if (data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
}

export async function fetchCurrentUser() {
  const res = await authFetch(`${API_BASE}/auth/me`);
  if (!res.ok) {
    clearAuthToken();
    throw new Error('Session expired or invalid token');
  }
  return res.json();
}

// --- Zone User Portal APIs ---

export async function fetchZoneUserDashboard() {
  const res = await authFetch(`${API_BASE}/user/zone/dashboard`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch zone dashboard: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchZoneUserHistory(range = 'TODAY') {
  const res = await authFetch(`${API_BASE}/user/zone/history?range=${range}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch zone history: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchZoneUserAlerts() {
  const res = await authFetch(`${API_BASE}/user/zone/alerts`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch zone alerts: ${res.statusText}`);
  }
  return res.json();
}

// --- Admin Management APIs ---

export async function fetchAdminUsers() {
  const res = await authFetch(`${API_BASE}/admin/users`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch users: ${res.statusText}`);
  }
  return res.json();
}

export async function createAdminUser(userData) {
  const res = await authFetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to create user: ${res.statusText}`);
  }
  return res.json();
}

export async function updateAdminUser(userId, userData) {
  const res = await authFetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update user: ${res.statusText}`);
  }
  return res.json();
}

export async function deactivateAdminUser(userId) {
  const res = await authFetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to deactivate user: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAdminZoneDetail(zoneId) {
  const res = await authFetch(`${API_BASE}/admin/zones/${zoneId}/detail`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch zone details: ${res.statusText}`);
  }
  return res.json();
}

// --- System & Telemetry APIs ---

export async function fetchDashboard() {
  const res = await authFetch(`${API_BASE}/dashboard`);
  if (!res.ok) throw new Error(`Failed to fetch dashboard: ${res.statusText}`);
  return res.json();
}

export async function fetchTank() {
  const res = await authFetch(`${API_BASE}/tank`);
  if (!res.ok) throw new Error(`Failed to fetch tank: ${res.statusText}`);
  return res.json();
}

export async function fetchZones() {
  const res = await authFetch(`${API_BASE}/zones`);
  if (!res.ok) throw new Error(`Failed to fetch zones: ${res.statusText}`);
  return res.json();
}

export async function fetchConsumption() {
  const res = await authFetch(`${API_BASE}/consumption`);
  if (!res.ok) throw new Error(`Failed to fetch consumption: ${res.statusText}`);
  return res.json();
}

export async function fetchAlerts(activeOnly = false) {
  const res = await authFetch(`${API_BASE}/alerts?active_only=${activeOnly}`);
  if (!res.ok) throw new Error(`Failed to fetch alerts: ${res.statusText}`);
  return res.json();
}

export async function ackAlert(alertId) {
  const res = await authFetch(`${API_BASE}/alerts/${alertId}/ack`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to ack alert: ${res.statusText}`);
  return res.json();
}

export async function resolveAlert(alertId) {
  const res = await authFetch(`${API_BASE}/alerts/${alertId}/resolve`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to resolve alert: ${res.statusText}`);
  return res.json();
}

export async function controlPump(state, reason = 'Operator action') {
  const res = await authFetch(`${API_BASE}/control/pump`, {
    method: 'POST',
    body: JSON.stringify({ state, reason }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to control pump: ${res.statusText}`);
  }
  return res.json();
}

export async function controlValve(zoneId, state, reason = 'Operator action') {
  const res = await authFetch(`${API_BASE}/control/valve/${zoneId}`, {
    method: 'POST',
    body: JSON.stringify({ state, reason }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to control valve: ${res.statusText}`);
  }
  return res.json();
}

export async function updateAllocation(zoneId, allocatedLiters) {
  const res = await authFetch(`${API_BASE}/allocations/${zoneId}`, {
    method: 'PUT',
    body: JSON.stringify({ allocated_liters: parseFloat(allocatedLiters) }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update allocation: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSettings() {
  const res = await authFetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error(`Failed to fetch settings: ${res.statusText}`);
  return res.json();
}

export async function updateSetting(key, value) {
  const res = await authFetch(`${API_BASE}/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value: String(value) }),
  });
  if (!res.ok) throw new Error(`Failed to update setting: ${res.statusText}`);
  return res.json();
}

export async function triggerScenario(scenario, zoneId = 2) {
  const res = await authFetch(`${API_BASE}/simulator/scenario`, {
    method: 'POST',
    body: JSON.stringify({ scenario, zone_id: zoneId }),
  });
  if (!res.ok) throw new Error(`Failed to trigger scenario: ${res.statusText}`);
  return res.json();
}

/**
 * WebSocket Telemetry Connection with Auto-Reconnect
 */
export function connectTelemetryWebSocket(onTelemetrySnapshot, onStatusChange) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/api/ws/telemetry`;

  let ws = null;
  let shouldReconnect = true;
  let reconnectTimer = null;

  function connect() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (onStatusChange) onStatusChange(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'TELEMETRY_SNAPSHOT' && onTelemetrySnapshot) {
            onTelemetrySnapshot(msg.payload);
          }
        } catch (e) {
          // ignore ping responses
        }
      };

      ws.onclose = () => {
        if (onStatusChange) onStatusChange(false);
        if (shouldReconnect) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      if (shouldReconnect) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    }
  }

  connect();

  return () => {
    shouldReconnect = false;
    clearTimeout(reconnectTimer);
    if (ws) ws.close();
  };
}
