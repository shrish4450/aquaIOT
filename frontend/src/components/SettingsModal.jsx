import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Save, Check } from 'lucide-react';
import { fetchSettings, updateSetting } from '../services/api';

export default function SettingsModal({ isOpen, onClose }) {
  const [settingsList, setSettingsList] = useState([]);
  const [formData, setFormData] = useState({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const data = await fetchSettings();
      setSettingsList(data);
      const map = {};
      data.forEach((s) => {
        map[s.key] = s.value;
      });
      setFormData(map);
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  };

  const handleInputChange = (key, val) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSaveAll = async () => {
    setLoading(true);
    try {
      for (const [k, v] of Object.entries(formData)) {
        await updateSetting(k, v);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error('Error updating settings:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 className="font-display" style={{ fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingsIcon size={20} color="var(--cyan-primary)" />
            System Operational Settings
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <p className="kpi-subtext" style={{ marginBottom: '16px' }}>
          Configure safety trip thresholds, leak percentage bounds, and hardware watchdog timeouts.
        </p>

        <div style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '6px' }}>
          {settingsList.map((item) => (
            <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--cyan-primary)' }}>
                {item.key}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={formData[item.key] || ''}
                  onChange={(e) => handleInputChange(item.key, e.target.value)}
                  className="scenario-btn"
                  style={{ flex: 1, background: '#070f1e', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.15)' }}
                />
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{item.description}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button className="scenario-btn" onClick={onClose}>
            Close
          </button>
          <button
            className="scenario-btn active"
            onClick={handleSaveAll}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? 'Saved Successfully!' : loading ? 'Saving...' : 'Save Parameters'}
          </button>
        </div>
      </div>
    </div>
  );
}
