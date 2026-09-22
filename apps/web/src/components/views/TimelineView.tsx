import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Trash2,
  ExternalLink,
  Globe,
  Layers,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { TimelineGroup, TimelinePage, TimelineResponse } from '../../lib/types';

export const TimelineView: React.FC = () => {
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, []);

  const loadTimeline = async () => {
    setLoading(true);
    try {
      const data = await api.getTimeline();
      setTimeline(data);
    } catch (err) {
      console.error('Failed to load timeline', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!confirm('Remove this page from your timeline?')) return;
    try {
      await api.deleteMemory(id);
      loadTimeline();
    } catch (err) {
      alert('Failed to delete memory');
    }
  };

  return (
    <div style={{ padding: '36px 48px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
          Memory Timeline
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          A chronological stream of your web exploration, clustered into focused research sessions.
        </p>
      </div>

      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading timeline records...
        </div>
      )}

      {!loading && timeline?.groups.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
        }}>
          <Clock size={36} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>Timeline is empty</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Browse the web with your connected extension to start recording your timeline.
          </p>
        </div>
      )}

      {/* Timeline Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {timeline?.groups.map((group: TimelineGroup, gIdx) => (
          <div key={gIdx}>
            {/* Date Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '16px',
            }}>
              <Calendar size={18} color="var(--accent-light)" />
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {group.date}
              </h2>
            </div>

            {/* Sessions in this day */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '14px', borderLeft: '2px solid var(--border-subtle)' }}>
              {group.sessions.map((sess, sIdx) => (
                <div key={sIdx} className="glass-panel" style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <Layers size={13} color="var(--accent-light)" />
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Session at {sess.time}</span>
                    <span>•</span>
                    <span>{sess.pages.length} pages explored</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {sess.pages.map((p: TimelinePage) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', marginRight: '12px' }}>
                          <span className="badge badge-gray" style={{ fontSize: '11px' }}>
                            {p.domain}
                          </span>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '14px',
                              fontWeight: 500,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {p.title || p.url}
                          </a>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--text-muted)', padding: '4px' }}
                          >
                            <ExternalLink size={13} />
                          </a>
                          <button
                            onClick={() => handleDeleteMemory(p.id)}
                            style={{ color: 'var(--text-muted)', padding: '4px' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
