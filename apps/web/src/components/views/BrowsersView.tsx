import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Plus,
  Trash2,
  Pause,
  Play,
  CheckCircle,
  Copy,
  AlertCircle,
  Globe,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { BrowserConnection } from '../../lib/types';

export const BrowsersView: React.FC = () => {
  const [browsers, setBrowsers] = useState<BrowserConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [newBrowserName, setNewBrowserName] = useState('My Work Chrome');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadBrowsers();
  }, []);

  const loadBrowsers = async () => {
    setLoading(true);
    try {
      const list = await api.listBrowsers();
      setBrowsers(list);
    } catch (err) {
      console.error('Failed to load browsers', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBrowser = async () => {
    if (!newBrowserName.trim()) return;
    setCreating(true);
    try {
      const res: any = await api.connectBrowser('chrome', newBrowserName);
      setPairingToken(res.auth_token || 'demo-token');
      loadBrowsers();
    } catch (err) {
      alert('Failed to register browser connection');
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePause = async (b: BrowserConnection) => {
    try {
      await api.pauseBrowser(b.id, !b.is_paused);
      setBrowsers((prev) =>
        prev.map((item) => (item.id === b.id ? { ...item, is_paused: !item.is_paused } : item))
      );
    } catch (err) {
      alert('Failed to update browser connection');
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this browser from Recall?')) return;
    try {
      await api.disconnectBrowser(id);
      setBrowsers((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert('Failed to disconnect browser');
    }
  };

  const copyTokenToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div style={{ padding: '36px 48px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
          Connected Browsers
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Connect Chrome, Firefox, or Safari to silently and privately sync your permitted web discoveries.
        </p>
      </div>

      {/* Connect New Browser Panel */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>
          Register New Browser Extension
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Provide a label for this browser (e.g. "MacBook Pro Chrome" or "Home Desktop").
        </p>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={newBrowserName}
            onChange={(e) => setNewBrowserName(e.target.value)}
            placeholder="Browser Name..."
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontSize: '14px',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={handleCreateBrowser}
            disabled={creating}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Generate Pairing Token
          </button>
        </div>

        {pairingToken && (
          <div style={{
            marginTop: '16px',
            padding: '14px',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#c7d2fe', marginBottom: '6px' }}>
              One-Time Extension Pairing Token:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <code style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {pairingToken}
              </code>
              <button
                onClick={() => copyTokenToClipboard(pairingToken)}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                {copiedToken ? 'Copied!' : 'Copy Token'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Extension Installation Instructions */}
      <div className="glass-panel" style={{ padding: '20px 24px', marginBottom: '32px' }}>
        <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Globe size={18} color="var(--accent-light)" />
          How to load the Chrome Extension:
        </h4>
        <ol style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: 1.6 }}>
          <li>Open <code>chrome://extensions</code> in your Google Chrome or Brave browser.</li>
          <li>Enable <strong>"Developer mode"</strong> in the top-right corner.</li>
          <li>Click <strong>"Load unpacked"</strong> and select the directory: <code>Recall/apps/extension-chrome/dist</code> (or root).</li>
          <li>Click the Recall puzzle icon in your toolbar, log in or paste the pairing token!</li>
        </ol>
      </div>

      {/* Browsers List */}
      <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px' }}>
        Active Browser Connections ({browsers.length})
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {browsers.map((b) => (
          <div
            key={b.id}
            className="glass-panel"
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Laptop size={20} color="var(--accent-light)" />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {b.connection_name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {b.browser_type.toUpperCase()} • Added {new Date(b.created_at).toLocaleDateString()}
                  {b.last_synced_at && ` • Synced ${new Date(b.last_synced_at).toLocaleTimeString()}`}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => handleTogglePause(b)}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '13px', gap: '6px' }}
              >
                {b.is_paused ? <Play size={14} color="var(--color-success)" /> : <Pause size={14} color="var(--color-warning)" />}
                {b.is_paused ? 'Resume Sync' : 'Pause Sync'}
              </button>
              <button
                onClick={() => handleDisconnect(b.id)}
                className="btn btn-ghost"
                style={{ padding: '6px' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
