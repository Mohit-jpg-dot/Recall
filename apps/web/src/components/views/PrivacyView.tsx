import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Plus,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle,
  EyeOff,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { PrivacySettings, ExcludedDomain } from '../../lib/types';

export const PrivacyView: React.FC = () => {
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadPrivacy();
  }, []);

  const loadPrivacy = async () => {
    setLoading(true);
    try {
      const data = await api.getPrivacy();
      setPrivacy(data);
    } catch (err) {
      console.error('Failed to load privacy settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMemory = async () => {
    if (!privacy) return;
    try {
      const newActive = !privacy.memory_active;
      await api.toggleMemory(newActive);
      setPrivacy({ ...privacy, memory_active: newActive });
    } catch (err) {
      alert('Failed to update memory state');
    }
  };

  const handleAddDomain = async (domainName?: string) => {
    const dom = (domainName || newDomain).trim().toLowerCase();
    if (!dom) return;
    try {
      await api.addExcludedDomain(dom);
      setNewDomain('');
      loadPrivacy();
    } catch (err) {
      alert('Failed to add excluded domain');
    }
  };

  const handleRemoveDomain = async (id: string) => {
    try {
      await api.removeExcludedDomain(id);
      if (privacy) {
        setPrivacy({
          ...privacy,
          excluded_domains: privacy.excluded_domains.filter((d) => d.id !== id),
        });
      }
    } catch (err) {
      alert('Failed to remove excluded domain');
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recall-memory-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: '36px 48px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
          Privacy, Rules & Control
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          You own your web memories. Recall collects only what you permit, filters sensitive sites by default, and never touches credentials.
        </p>
      </div>

      {/* Master Memory Switch */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '4px' }}>
            Master Memory Collection Switch
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Temporarily pause all browsing synchronization across all connected browser extensions.
          </p>
        </div>
        <button
          onClick={handleToggleMemory}
          className={privacy?.memory_active ? 'btn btn-primary' : 'btn btn-secondary'}
          style={{ minWidth: '130px' }}
        >
          {privacy?.memory_active ? '● Active' : '○ Paused'}
        </button>
      </div>

      {/* Absolute Privacy Guarantee */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px', borderLeft: '4px solid var(--color-success)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={18} color="var(--color-success)" />
          What Recall Never Collects
        </h3>
        <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '20px', lineHeight: 1.7 }}>
          <li><strong>Passwords & Logins:</strong> Never recorded or processed.</li>
          <li><strong>Form inputs & credit cards:</strong> Filtered and discarded before any transmission.</li>
          <li><strong>Session cookies & auth tokens:</strong> Kept strictly inside the browser runtime.</li>
          <li><strong>Private/Incognito Windows:</strong> Skipped completely.</li>
        </ul>
      </div>

      {/* Excluded Domains */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>
          Excluded Domains
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Visits to these domains are immediately filtered out locally in the extension and will never enter your memory.
        </p>

        {/* Add Input */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <input
            type="text"
            placeholder="e.g. bankofamerica.com, mail.google.com..."
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddDomain(); }}
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
            onClick={() => handleAddDomain()}
            disabled={!newDomain.trim()}
            className="btn btn-primary"
          >
            <Plus size={16} />
            Exclude Domain
          </button>
        </div>

        {/* Quick Add Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quick add:</span>
          {['chase.com', 'wellsfargo.com', 'mychart.org', '1password.com', 'mail.google.com'].map((preset) => (
            <button
              key={preset}
              onClick={() => handleAddDomain(preset)}
              style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              + {preset}
            </button>
          ))}
        </div>

        {/* Excluded Domains List */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {privacy?.excluded_domains.map((d) => (
            <span
              key={d.id}
              className="badge badge-gray"
              style={{ padding: '6px 12px', fontSize: '13px', gap: '8px' }}
            >
              <EyeOff size={13} color="var(--text-muted)" />
              {d.domain_name}
              <button
                onClick={() => handleRemoveDomain(d.id)}
                style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <Trash2 size={13} />
              </button>
            </span>
          ))}
          {privacy?.excluded_domains.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              No custom domain exclusions configured.
            </div>
          )}
        </div>
      </div>

      {/* Export & Data Portability */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>
          Data Portability & Export
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Download a complete, uncompressed JSON archive of every page, timestamp, domain, topic, and session stored in your Recall account.
        </p>
        <button
          onClick={handleExportData}
          disabled={exporting}
          className="btn btn-secondary"
          style={{ gap: '8px' }}
        >
          <Download size={16} />
          {exporting ? 'Generating JSON...' : 'Export All Memories (JSON)'}
        </button>
      </div>
    </div>
  );
};
