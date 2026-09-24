import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Pause,
  Play,
  Copy,
  Check,
  Download,
  X,
  ExternalLink,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { BrowserConnection } from '../../lib/types';
import { RecallIcon, BrowserType } from '../common/RecallIcon';

interface BrowserCardInfo {
  type: BrowserType;
  name: string;
  subtitle: string;
  tag: string;
  installActionLabel: string;
  installPath: string;
  installSteps: string[];
}

const BROWSER_CARDS: BrowserCardInfo[] = [
  {
    type: 'chrome',
    name: 'Chrome',
    subtitle: 'Chromium extension',
    tag: 'Manifest V3 Native',
    installActionLabel: 'Install for Chrome',
    installPath: 'apps/extension-chrome/dist/chrome',
    installSteps: [
      'Open chrome://extensions in your Chrome address bar',
      'Toggle "Developer mode" in the top right corner',
      'Click "Load unpacked" and select apps/extension-chrome/dist/chrome',
      'Pin the Recall extension to your toolbar, click it, and paste your pairing token',
    ],
  },
  {
    type: 'brave',
    name: 'Brave',
    subtitle: 'Chromium extension',
    tag: 'Chromium • Brave Shield',
    installActionLabel: 'Install for Brave',
    installPath: 'apps/extension-chrome/dist/chrome',
    installSteps: [
      'Open brave://extensions in your Brave address bar',
      'Enable "Developer mode" toggle in the top right header',
      'Click "Load unpacked" and point to apps/extension-chrome/dist/chrome',
      'Open the Recall popup from your extensions menu and connect with your token',
    ],
  },
  {
    type: 'firefox',
    name: 'Firefox',
    subtitle: 'Gecko extension',
    tag: 'Gecko Add-on',
    installActionLabel: 'Install for Firefox',
    installPath: 'apps/extension-chrome/dist/firefox/manifest.json',
    installSteps: [
      'Open about:debugging#/runtime/this-firefox in Firefox',
      'Click the "Load Temporary Add-on…" button',
      'Select apps/extension-chrome/dist/firefox/manifest.json',
      'Click the Recall icon in your browser toolbar and enter your credentials/token',
    ],
  },
  {
    type: 'safari',
    name: 'Safari',
    subtitle: 'macOS WebExtensions',
    tag: 'WebKit Native',
    installActionLabel: 'Install for Safari',
    installPath: 'apps/extension-chrome/dist/safari',
    installSteps: [
      'Open Safari > Settings > Advanced and check "Show Develop menu in menu bar"',
      'From the Develop menu, allow unsigned extensions or select "Allow Unsigned Extensions"',
      'Load the extension bundle located at apps/extension-chrome/dist/safari',
      'Enable Recall under Safari Settings > Extensions',
    ],
  },
];

export const BrowsersView: React.FC = () => {
  const [browsers, setBrowsers] = useState<BrowserConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingToken, setPairingToken] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [newBrowserName, setNewBrowserName] = useState('My Laptop');
  const [browserType, setBrowserType] = useState<BrowserType>('chrome');
  const [creating, setCreating] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [activeInstallModal, setActiveInstallModal] = useState<BrowserCardInfo | null>(null);

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

  const handleCreateBrowser = async (customType?: BrowserType, customName?: string) => {
    const targetType = customType || browserType;
    const targetName = customName || newBrowserName;
    if (!targetName.trim()) return;

    setCreating(true);
    try {
      const res: any = await api.connectBrowser(targetType, targetName);
      const token = res.connection_token || res.auth_token || 'paired-token';
      setPairingToken(token);
      setConnectionId(res.id || null);
      loadBrowsers();
      return token;
    } catch (err) {
      alert('Failed to register browser connection');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenInstallModal = (card: BrowserCardInfo) => {
    setBrowserType(card.type);
    setNewBrowserName(`${card.name} Laptop`);
    setActiveInstallModal(card);
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
    <div style={{ padding: '36px 44px', maxWidth: '980px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Connected Browsers
          </h1>
          <span className="badge badge-indigo" style={{ fontSize: '11px', fontWeight: 600 }}>
            Universal Extension
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px' }}>
          Equip Chrome, Brave, Firefox, or Safari with Recall's obsidian extension to turn your daily browsing into an indexed, private memory bank.
        </p>
      </div>

      {/* ── Browser Extension Installation Cards ────────── */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Browser Extension Suite
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Each card features the official Recall brand icon with subtle browser engine indicators.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
        }}>
          {BROWSER_CARDS.map((b) => (
            <div
              key={b.type}
              className="glass-panel"
              style={{
                padding: '28px 20px 22px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--surface-glass-card)',
                transition: 'all var(--transition-normal)',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-highlight)';
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(99, 102, 241, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* [ Recall Icon ] with subtle browser indicator */}
              <div style={{ marginBottom: '18px' }}>
                <RecallIcon size={64} browser={b.type} glow showIndicator={true} />
              </div>

              {/* Browser Name */}
              <h3 style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: '4px',
              }}>
                {b.name}
              </h3>

              {/* Subtitle */}
              <div style={{
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
                marginBottom: '10px',
              }}>
                {b.subtitle}
              </div>

              {/* Subtle Engine Indicator Tag */}
              <span
                className="badge"
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-muted)',
                  marginBottom: '20px',
                }}
              >
                {b.tag}
              </span>

              {/* [ Install for Browser ] Action */}
              <button
                onClick={() => handleOpenInstallModal(b)}
                className="btn-primary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '9px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-md)',
                  marginTop: 'auto',
                }}
              >
                <Download size={14} style={{ marginRight: '6px' }} />
                {b.installActionLabel}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Connect / Pair Browser Panel ─────────────────── */}
      <div className="glass-panel" style={{ padding: '24px 26px', marginBottom: '32px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
          Register New Browser Extension
        </h3>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
          Select your browser and give it a label to generate a pairing token.
        </p>

        {/* Browser Type Selector with Recall brand icons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {(['chrome', 'brave', 'firefox', 'safari'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBrowserType(b)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
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
              <RecallIcon size={18} browser={b} showIndicator={true} />
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
            onClick={() => handleCreateBrowser()}
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

      {/* ── Active Browsers List ─────────────────────────── */}
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
              No browser extensions connected yet. Click an install card above to pair your first browser.
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
                  {/* Recall Brand Icon with browser-specific indicator */}
                  <RecallIcon
                    size={40}
                    browser={(b.browser_type?.toLowerCase() as BrowserType) || null}
                    showIndicator={true}
                  />
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

      {/* ── Interactive Installation Guide & Pairing Modal ─── */}
      {activeInstallModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(7, 8, 11, 0.85)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
          onClick={() => setActiveInstallModal(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '540px',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-highlight)',
              backgroundColor: 'var(--bg-surface-elevated)',
              boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.9)',
              padding: '28px 32px',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <RecallIcon size={46} browser={activeInstallModal.type} glow showIndicator={true} />
                <div>
                  <h3 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Install Recall for {activeInstallModal.name}
                  </h3>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    {activeInstallModal.subtitle} • {activeInstallModal.tag}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveInstallModal(null)}
                className="btn-ghost"
                style={{ padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Step-by-Step Guide */}
            <div style={{ marginBottom: '22px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>
                Installation Steps
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeInstallModal.installSteps.map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      fontSize: '13.5px',
                      lineHeight: 1.5,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(99, 102, 241, 0.18)',
                        color: 'var(--accent-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: '1px',
                      }}
                    >
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Path Box */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Bundle Target Path:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <code style={{ fontSize: '12.5px', color: '#c7d2fe', fontFamily: 'var(--font-mono)' }}>
                  {activeInstallModal.installPath}
                </code>
                <button
                  onClick={() => copyTokenToClipboard(activeInstallModal.installPath)}
                  className="btn-ghost"
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  <Copy size={12} style={{ marginRight: '4px' }} /> Copy Path
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  handleCreateBrowser(activeInstallModal.type, `${activeInstallModal.name} Device`);
                  setActiveInstallModal(null);
                }}
                className="btn-primary"
                style={{ padding: '9px 18px', fontSize: '13.5px' }}
              >
                <Sparkles size={15} style={{ marginRight: '6px' }} />
                Generate Pairing Token
              </button>
              <button
                onClick={() => setActiveInstallModal(null)}
                className="btn-secondary"
                style={{ padding: '9px 16px', fontSize: '13.5px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
