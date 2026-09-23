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
  Check,
  Compass,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { BrowserConnection } from '../../lib/types';

export const BrowsersView: React.FC = () => {
  const [browsers, setBrowsers] = useState<BrowserConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [newBrowserName, setNewBrowserName] = useState('My Laptop');
  const [browserType, setBrowserType] = useState<'chrome' | 'firefox' | 'safari'>('chrome');
  const [creating, setCreating] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  useEffect(() => {
    loadBrowsers();
  }, []);

  const loadBrowsers = async () => {
    setLoading(true);
    try {
      const list = await api.listBrowsers();
      setBrowsers(list || []);
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
      const res: any = await api.connectBrowser(browserType, newBrowserName);
      setPairingToken(res.connection_token || res.auth_token || 'paired-token');
      setConnectionId(res.id || null);
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

  const confirmDisconnect = async (id: string) => {
    try {
      await api.disconnectBrowser(id);
      setBrowsers((prev) => prev.filter((b) => b.id !== id));
      setDisconnectingId(null);
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
    <div style={{ padding: '36px 44px', maxWidth: '920px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Connected Browsers
          </h1>
          <span className="badge badge-indigo" style={{ fontSize: '11px', fontWeight: 600 }}>
            Multi-Browser
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px' }}>
          Connect Chrome, Firefox, or Safari extensions to seamlessly index permitted web pages across devices.
        </p>
      </div>

      {/* Connect New Browser Panel */}
      <div className="glass-panel" style={{ padding: '24px 26px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
          Register New Browser Extension
        </h3>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
          Select your browser and give it a label to generate a pairing token.
        </p>

        {/* Browser Type Selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {(['chrome', 'firefox', 'safari'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBrowserType(b)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: browserType === b ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: browserType === b ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                color: browserType === b ? '#ffffff' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: browserType === b ? 600 : 500,
                textTransform: 'capitalize',
                transition: 'all var(--transition-fast)',
              }}
            >
              {b} Extension
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={newBrowserName}
            onChange={(e) => setNewBrowserName(e.target.value)}
            placeholder="Browser Label (e.g. MacBook Pro Chrome)..."
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
            className="btn-primary"
          >
            <Plus size={16} />
            Generate Pairing Token
          </button>
        </div>

        {pairingToken && (
          <div
            style={{
              marginTop: '18px',
              padding: '16px',
              backgroundColor: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#c7d2fe' }}>
                One-Time Pairing Token (Connection ID: {connectionId}):
              </span>
              <button
                onClick={() => copyTokenToClipboard(pairingToken)}
                className="btn-ghost"
                style={{ fontSize: '12px', color: copiedToken ? 'var(--color-success)' : 'var(--accent-light)' }}
              >
                {copiedToken ? (
                  <>
                    <Check size={13} style={{ marginRight: '4px' }} /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={13} style={{ marginRight: '4px' }} /> Copy Token
                  </>
                )}
              </button>
            </div>
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                borderRadius: 'var(--radius-xs)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12.5px',
                wordBreak: 'break-all',
                color: 'var(--text-primary)',
              }}
            >
              {pairingToken}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '10px' }}>
              Open the Recall extension popup in your {browserType.toUpperCase()} browser, enter your credentials, and paste this token.
            </p>
          </div>
        )}
      </div>

      {/* Browser Installation Guide */}
      <div style={{
        padding: '18px 22px',
        backgroundColor: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        marginBottom: '32px',
      }}>
        <h4 style={{ fontSize: '14.5px', fontWeight: 700, marginBottom: '10px', color: 'var(--text-primary)' }}>
          Browser Installation Paths
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
          <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)' }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Chrome</strong>
            Open <code>chrome://extensions</code>, enable Developer mode, and click "Load unpacked" targeting <code>apps/extension-chrome/dist/chrome</code>.
          </div>
          <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)' }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Firefox</strong>
            Open <code>about:debugging#/runtime/this-firefox</code>, click "Load Temporary Add-on", and select <code>apps/extension-chrome/dist/firefox/manifest.json</code>.
          </div>
          <div style={{ padding: '10px 12px', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)' }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>Safari</strong>
            Enable Develop menu in Safari Settings, and load the extension bundle in <code>apps/extension-chrome/dist/safari</code>.
          </div>
        </div>
      </div>

      {/* Active Browsers List */}
      <div>
        <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '14px' }}>
          Active Connections ({browsers.length})
        </h3>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2].map((n) => (
              <div key={n} className="skeleton" style={{ height: '70px', borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : browsers.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              No browser extensions connected yet. Register a browser above to start recording memories.
            </p>
          </div>
        ) : (
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
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Laptop size={18} color="var(--accent-light)" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--text-primary)' }}>
                        {b.connection_name}
                      </span>
                      <span
                        className="badge"
                        style={{
                          fontSize: '11px',
                          textTransform: 'capitalize',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {b.browser_type}
                      </span>
                      {b.is_paused ? (
                        <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                          Paused
                        </span>
                      ) : (
                        <span className="badge badge-success" style={{ fontSize: '11px' }}>
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Last synced:{' '}
                      {b.last_synced_at
                        ? new Date(b.last_synced_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never synced'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => handleTogglePause(b)}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '12.5px' }}
                  >
                    {b.is_paused ? (
                      <>
                        <Play size={13} style={{ marginRight: '4px' }} /> Resume
                      </>
                    ) : (
                      <>
                        <Pause size={13} style={{ marginRight: '4px' }} /> Pause
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setDisconnectingId(b.id)}
                    title="Disconnect browser"
                    style={{
                      padding: '7px',
                      color: 'var(--text-muted)',
                      borderRadius: 'var(--radius-xs)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Inline Popover for Disconnect */}
                {disconnectingId === b.id && (
                  <div
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '12px',
                      bottom: '12px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      zIndex: 10,
                      boxShadow: 'var(--shadow-md)',
                    }}
                  >
                    <span style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
                      Disconnect this browser?
                    </span>
                    <button
                      onClick={() => confirmDisconnect(b.id)}
                      style={{
                        backgroundColor: 'var(--color-danger)',
                        color: '#ffffff',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      Disconnect
                    </button>
                    <button
                      onClick={() => setDisconnectingId(null)}
                      style={{ color: 'var(--text-muted)', fontSize: '12px' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
