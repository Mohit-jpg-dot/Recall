import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Trash2,
  ExternalLink,
  Layers,
  ArrowDown,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { TimelineGroup, TimelinePage, TimelineResponse } from '../../lib/types';

export const TimelineView: React.FC = () => {
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadInitialTimeline();
  }, []);

  const loadInitialTimeline = async () => {
    setLoading(true);
    try {
      const data = await api.getTimeline();
      setGroups(data.groups || []);
      setCursor(data.cursor || null);
      setHasMore(data.has_more || false);
    } catch (err) {
      console.error('Failed to load timeline', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTimeline = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getTimeline(undefined, undefined, cursor);
      setGroups((prev) => [...prev, ...(data.groups || [])]);
      setCursor(data.cursor || null);
      setHasMore(data.has_more || false);
    } catch (err) {
      console.error('Failed to load more timeline', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const confirmDeleteMemory = async (id: string) => {
    try {
      await api.deleteMemory(id);
      // Remove page from state locally without reloading entire stream
      setGroups((prev) =>
        prev
          .map((g) => ({
            ...g,
            sessions: g.sessions
              .map((s) => ({
                ...s,
                pages: s.pages.filter((p) => p.id !== id),
              }))
              .filter((s) => s.pages.length > 0),
          }))
          .filter((g) => g.sessions.length > 0)
      );
      setDeletingId(null);
    } catch (err) {
      alert('Failed to delete memory record');
    }
  };

  return (
    <div style={{ padding: '36px 44px', maxWidth: '920px', margin: '0 auto', width: '100%' }}>
      {/* View Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Memory Timeline
          </h1>
          <span className="badge badge-indigo" style={{ fontSize: '11px', fontWeight: 600 }}>
            Chronological Stream
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px' }}>
          A continuous, session-clustered journey of every page, article, and research thread you visited.
        </p>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {[1, 2].map((g) => (
            <div key={g} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="skeleton" style={{ width: '180px', height: '22px' }} />
              <div
                className="glass-panel"
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div className="skeleton" style={{ width: '35%', height: '16px' }} />
                <div className="skeleton" style={{ width: '85%', height: '16px' }} />
                <div className="skeleton" style={{ width: '65%', height: '16px' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && groups.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '64px 24px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Clock size={36} color="var(--accent-light)" style={{ marginBottom: '12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Your timeline is empty</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '420px', margin: '0 auto' }}>
            As you browse permitted websites with your connected browser extension, Recall organizes your visits into clear research sessions.
          </p>
        </div>
      )}

      {/* Timeline Day Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {groups.map((group, gIdx) => (
          <div key={gIdx}>
            {/* Date Header Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(99, 102, 241, 0.14)',
                  border: '1px solid rgba(99, 102, 241, 0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Calendar size={15} color="var(--accent-light)" />
              </div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {group.date}
              </h2>
            </div>

            {/* Sessions Column with Vertical Guide Rail */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                paddingLeft: '14px',
                borderLeft: '2px solid rgba(255, 255, 255, 0.08)',
                marginLeft: '14px',
              }}
            >
              {group.sessions.map((sess, sIdx) => (
                <div
                  key={sIdx}
                  className="glass-panel"
                  style={{
                    padding: '16px 20px',
                    position: 'relative',
                  }}
                >
                  {/* Session Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '12px',
                      fontSize: '12px',
                    }}
                  >
                    <Layers size={13} color="var(--accent-light)" />
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Session at {sess.time}</span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{sess.pages.length} pages explored</span>
                  </div>

                  {/* Visited Pages in Session */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {sess.pages.map((p: TimelinePage) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          position: 'relative',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)')}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            overflow: 'hidden',
                            marginRight: '12px',
                            flex: 1,
                          }}
                        >
                          <span
                            className="badge badge-gray"
                            style={{ fontSize: '11px', flexShrink: 0, fontWeight: 500 }}
                          >
                            {p.domain}
                          </span>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '13.5px',
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

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--text-muted)', padding: '4px' }}
                            title="Open link"
                          >
                            <ExternalLink size={13} />
                          </a>
                          <button
                            onClick={() => setDeletingId(p.id)}
                            style={{ color: 'var(--text-muted)', padding: '4px' }}
                            title="Delete memory"
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {/* Inline Popover for Confirmation */}
                        {deletingId === p.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: '0',
                              top: '0',
                              bottom: '0',
                              backgroundColor: 'var(--bg-surface-elevated)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-medium)',
                              padding: '0 12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              zIndex: 5,
                            }}
                          >
                            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                              Delete?
                            </span>
                            <button
                              onClick={() => confirmDeleteMemory(p.id)}
                              style={{
                                color: 'var(--color-danger)',
                                fontSize: '11.5px',
                                fontWeight: 700,
                              }}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination: Load More Button */}
      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: '36px' }}>
          <button
            onClick={loadMoreTimeline}
            disabled={loadingMore}
            className="btn-secondary"
            style={{
              padding: '10px 22px',
              fontSize: '13.5px',
            }}
          >
            {loadingMore ? (
              <>
                <Loader2 size={15} className="spinner" />
                Loading older memories...
              </>
            ) : (
              <>
                <ArrowDown size={15} />
                Load earlier browsing events
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
