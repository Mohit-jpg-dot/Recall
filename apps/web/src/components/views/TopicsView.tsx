import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Tag,
  ExternalLink,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { Topic } from '../../lib/types';

export const TopicsView: React.FC = () => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const list = await api.listTopics();
      setTopics(list);
    } catch (err) {
      console.error('Failed to load topics', err);
    } finally {
      setLoading(false);
    }
  };

  const openTopicDetail = async (topic: Topic) => {
    setSelectedTopic(topic);
    try {
      const items = await api.getTopicMemories(topic.slug);
      setMemories(items);
    } catch (err) {
      console.error('Failed to load topic memories', err);
    }
  };

  return (
    <div style={{ padding: '36px 48px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {selectedTopic ? (
        <div>
          <button
            onClick={() => setSelectedTopic(null)}
            className="btn btn-secondary"
            style={{ marginBottom: '24px', gap: '6px', fontSize: '13px' }}
          >
            <ArrowLeft size={15} />
            Back to Topics
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <span
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '4px',
                backgroundColor: selectedTopic.color,
                display: 'inline-block',
              }}
            />
            <h1 style={{ fontSize: '26px', fontWeight: 800 }}>{selectedTopic.name}</h1>
            <span className="badge badge-indigo">{memories.length} pages</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {memories.map((m) => (
              <div key={m.id} className="glass-panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ overflow: 'hidden', marginRight: '16px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {m.title || m.url}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{m.domain}</span>
                    <span>•</span>
                    <span>{new Date(m.visited_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
                <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)', padding: '6px' }}>
                  <ExternalLink size={16} />
                </a>
              </div>
            ))}
            {memories.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No pages recorded for this topic yet.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
              Memory Topics
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
              Auto-categorized areas of interest based on your web exploration patterns.
            </p>
          </div>

          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading memory topics...
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {topics.map((t) => (
              <div
                key={t.id}
                onClick={() => openTopicDetail(t)}
                className="glass-panel"
                style={{
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = t.color;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '3px',
                        backgroundColor: t.color,
                        display: 'inline-block',
                      }}
                    />
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{t.name}</h3>
                  </div>
                  <span className="badge badge-gray">{t.page_count}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={13} />
                  <span>{t.is_auto_generated ? 'Auto-inferred from browsing' : 'Custom topic'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
