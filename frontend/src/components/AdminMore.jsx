import React, { useState } from 'react';
import {
  Activity,
  Cpu,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  PlayCircle
} from 'lucide-react';

import HydroTopology from './HydroTopology';
import DemoController from './DemoController';
import AdminUserManagement from './AdminUserManagement';
import DeviceFleet from './DeviceFleet';
import Charts from './Charts';

export default function AdminMore({
  dashboardData,
  consumptionData,
  onSelectScenario,
  onTogglePump,
  onToggleValve,
  onOpenSettings
}) {
  const [activeSection, setActiveSection] = useState('topology');

  const tank = dashboardData?.tank;
  const accountability = dashboardData?.accountability;
  const zones = dashboardData?.zones || [];
  const devices = dashboardData?.devices || [];
  const activeScenario = dashboardData?.active_scenario || 'NORMAL';
  const pumpState = dashboardData?.pump_state || 'ON';

  return (
    <div className="shadcn-container">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 className="accessible-heading-1">
          Advanced System Tools & Settings
        </h1>
        <p className="accessible-subheading">
          Technical diagnostics, hardware fleet status, simulation scenarios, and system configuration.
        </p>
      </div>

      {/* Shadcn Tabs Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '2rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid hsl(var(--border))'
        }}
      >
        <div className="shadcn-tabs-list">
          <button
            onClick={() => setActiveSection('topology')}
            className={`shadcn-tabs-trigger ${activeSection === 'topology' ? 'active' : ''}`}
          >
            <Activity size={14} />
            <span>Hydraulic Diagram</span>
          </button>

          <button
            onClick={() => setActiveSection('simulator')}
            className={`shadcn-tabs-trigger ${activeSection === 'simulator' ? 'active' : ''}`}
          >
            <PlayCircle size={14} />
            <span>Demo Scenarios</span>
          </button>

          <button
            onClick={() => setActiveSection('users')}
            className={`shadcn-tabs-trigger ${activeSection === 'users' ? 'active' : ''}`}
          >
            <Users size={14} />
            <span>User Accounts</span>
          </button>

          <button
            onClick={() => setActiveSection('analytics')}
            className={`shadcn-tabs-trigger ${activeSection === 'analytics' ? 'active' : ''}`}
          >
            <BarChart3 size={14} />
            <span>Analytics & Trends</span>
          </button>

          <button
            onClick={() => setActiveSection('devices')}
            className={`shadcn-tabs-trigger ${activeSection === 'devices' ? 'active' : ''}`}
          >
            <Cpu size={14} />
            <span>ESP32 Hardware</span>
          </button>
        </div>

        <button
          onClick={onOpenSettings}
          className="shadcn-btn btn-outline"
          style={{ height: '2.25rem', fontSize: '0.8125rem' }}
        >
          <SettingsIcon size={14} />
          <span>Threshold Settings</span>
        </button>
      </div>

      {/* Sub-section contents */}
      <div>
        {activeSection === 'topology' && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <h2 className="accessible-heading-2">Interactive Hydraulic Schematic</h2>
              <p className="accessible-subheading">
                Animated 2D view of central reservoir, booster pump, pipeline flows, and zone solenoid valves.
              </p>
            </div>
            <HydroTopology
              tank={tank}
              zones={zones}
              pumpState={pumpState}
              accountability={accountability}
              activeScenario={activeScenario}
              onTogglePump={onTogglePump}
              onToggleValve={onToggleValve}
            />
          </div>
        )}

        {activeSection === 'simulator' && (
          <div className="shadcn-card">
            <h2 className="accessible-heading-2" style={{ marginBottom: '0.25rem' }}>
              Virtual Simulator Evaluation Scenarios
            </h2>
            <p className="accessible-subheading" style={{ marginBottom: '1.5rem' }}>
              Test how the system detects leaks, handles tank overflow, protects against dry run, and enforces allocation shutoffs.
            </p>
            <DemoController
              activeScenario={activeScenario}
              onSelectScenario={onSelectScenario}
            />
          </div>
        )}

        {activeSection === 'users' && (
          <div>
            <AdminUserManagement />
          </div>
        )}

        {activeSection === 'analytics' && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <h2 className="accessible-heading-2">System Analytics & Historical Trends</h2>
              <p className="accessible-subheading">
                Detailed 24-hour flow curves, cumulative consumption, and transmission mass balance records.
              </p>
            </div>
            <Charts consumptionData={consumptionData} />
          </div>
        )}

        {activeSection === 'devices' && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <h2 className="accessible-heading-2">ESP32 Microcontroller Fleet Health</h2>
              <p className="accessible-subheading">
                Heartbeat telemetry, firmware version, IP configuration, and node latency monitoring.
              </p>
            </div>
            <DeviceFleet devices={devices} />
          </div>
        )}
      </div>
    </div>
  );
}
