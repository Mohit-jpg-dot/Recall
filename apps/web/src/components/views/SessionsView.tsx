import React, { useState, useEffect } from 'react';
import {
  Compass,
  ArrowRight,
  ExternalLink,
  Clock,
  Globe,
  Layers,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { ResearchSession } from '../../lib/types';

export const SessionsView: React.FC = () => {
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.listSessions();
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '36px 48px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
          Research Journeys
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Recall reconstructs full multi-page investigations so you can retrace how you reached a solution or discovered a tool.
        </p>
      </div>

      {loading && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading research journeys...
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
        }}>
          <Compass size={36} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>No research journeys yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            When you explore related web pages during continuous research, Recall automatically synthesizes a journey.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {sessions.map((sess) => (
          <div key={sess.id} className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Compass size={18} color="var(--accent-light)" />
                  {sess.inferred_topic || 'Research Journey'}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{new Date(sess.started_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span>•</span>
                  <span>{sess.page_count} destinations explored</span>
                </div>
              </div>
              <span className="badge badge-indigo">
                {new Date(sess.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(sess.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Stepped Journey Path */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
              {sess.pages.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                    <span style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      color: 'var(--accent-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {idx + 1}
                    </span>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {p.title || p.url}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{p.domain}</span>
                        <span>•</span>
                        <span>{new Date(p.visited_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-light)', padding: '6px' }}
                  >
                    <ExternalLink size={15} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
