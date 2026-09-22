import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  ExternalLink,
  Clock,
  Globe,
  Tag,
  Copy,
  Check,
  Trash2,
  MessageSquareText,
  Filter,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { SearchResponse, SearchResultItem } from '../../lib/types';

interface SearchViewProps {
  onAskAi: (prompt: string) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ onAskAi }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  const sampleQueries = [
    'that github repo about cuda memory from last week',
    'thriller movie recommendation on reddit',
    'react animation tutorial from yesterday',
    'huggingface paper on agent architectures',
  ];

  const domainFilters = ['All', 'github.com', 'reddit.com', 'stackoverflow.com', 'youtube.com', 'docs.rs'];

  const executeSearch = async (q: string, domain?: string | null) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const filters = domain && domain !== 'All' ? { domains: [domain] } : undefined;
      const res = await api.search(q, filters, 15);
      setResponse(res);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeSearch(query, selectedDomain);
    }
  };

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this page from your personal memory?')) return;
    try {
      await api.deleteMemory(id);
      if (response) {
        setResponse({
          ...response,
          results: response.results.filter((r) => r.id !== id),
          total: response.total - 1,
        });
      }
    } catch (err) {
      alert('Failed to delete memory');
    }
  };

  const toggleSessionExpand = (id: string) => {
    setExpandedSessions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatVisitedTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 0) {
      return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  return (
    <div style={{ padding: '36px 48px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Search Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
          Search Personal Memory
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
          Recall finds pages using human context: approximate dates, topics, domains, or conceptual memories.
        </p>
      </div>

      {/* Main Search Bar */}
      <div style={{
        position: 'relative',
        marginBottom: '20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: '8px 16px',
          boxShadow: 'var(--shadow-md)',
          transition: 'all var(--transition-fast)',
        }}>
          <Search size={22} color="var(--accent-light)" style={{ marginRight: '12px' }} />
          <input
            type="text"
            placeholder="e.g. that github repo about cuda memory from last week..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              fontSize: '17px',
              padding: '8px 0',
              color: 'var(--text-primary)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                padding: '4px 8px',
                borderRadius: 'var(--radius-xs)',
                marginRight: '8px',
              }}
            >
              Clear
            </button>
          )}
          <button
            onClick={() => executeSearch(query, selectedDomain)}
            disabled={loading || !query.trim()}
            className="btn btn-primary"
            style={{ padding: '10px 20px' }}
          >
            {loading ? 'Searching...' : 'Recall'}
          </button>
        </div>
      </div>

      {/* Query Suggestions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Try asking:</span>
        {sampleQueries.map((sample) => (
          <button
            key={sample}
            onClick={() => {
              setQuery(sample);
              executeSearch(sample, selectedDomain);
            }}
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.12)';
              e.currentTarget.style.color = '#c7d2fe';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            "{sample}"
          </button>
        ))}
      </div>

      {/* Filter Chips */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '24px',
        overflowX: 'auto',
      }}>
        <Filter size={14} color="var(--text-muted)" style={{ marginRight: '4px' }} />
        {domainFilters.map((dom) => {
          const isSelected = (!selectedDomain && dom === 'All') || selectedDomain === dom;
          return (
            <button
              key={dom}
              onClick={() => {
                const newDom = dom === 'All' ? null : dom;
                setSelectedDomain(newDom);
                if (query.trim()) {
                  executeSearch(query, newDom);
                }
              }}
              style={{
                fontSize: '12px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-md)',
                fontWeight: isSelected ? 600 : 500,
                backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                transition: 'all var(--transition-fast)',
              }}
            >
              {dom}
            </button>
          );
        })}
      </div>

      {/* Results Header / Stats */}
      {response && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          fontSize: '13px',
          color: 'var(--text-muted)',
        }}>
          <div>
            Found <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{response.results.length}</span> results in <span style={{ color: 'var(--accent-light)' }}>{response.took_ms} ms</span>
          </div>
          <button
            onClick={() => onAskAi(`Summarize what I learned about: ${response.query}`)}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', gap: '6px' }}
          >
            <Sparkles size={14} color="var(--accent-light)" />
            Synthesize with AI
          </button>
        </div>
      )}

      {/* Results List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {response?.results.map((item: SearchResultItem) => {
          const isExpanded = !!expandedSessions[item.id];
          return (
            <div
              key={item.id}
              className="glass-panel"
              style={{
                padding: '18px 22px',
                transition: 'border-color var(--transition-fast), transform var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-medium)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  {/* Domain and Time Meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '12px' }}>
                    <span className="badge badge-gray" style={{ gap: '6px' }}>
                      <Globe size={11} />
                      {item.domain}
                    </span>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} />
                      {formatVisitedTime(item.visited_at)}
                    </span>
                    <span className="badge badge-indigo" style={{ marginLeft: 'auto' }}>
                      {Math.round(item.relevance_score * 100)}% match
                    </span>
                  </div>

                  {/* Title & Link */}
                  <h3 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px' }}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      {item.title || item.url}
                      <ExternalLink size={13} color="var(--text-muted)" />
                    </a>
                  </h3>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '650px',
                    marginBottom: '10px',
                  }}>
                    {item.url}
                  </div>

                  {/* Match Reasons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {item.match_reasons.map((mr, i) => (
                      <span
                        key={i}
                        className={
                          mr.type === 'temporal' ? 'badge badge-purple' :
                          mr.type === 'domain' ? 'badge badge-green' : 'badge badge-indigo'
                        }
                      >
                        <Tag size={10} />
                        {mr.description}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    onClick={() => onAskAi(`What can you tell me about what I looked at on "${item.title || item.url}"?`)}
                    title="Ask AI about this page"
                    className="btn btn-ghost"
                    style={{ padding: '6px' }}
                  >
                    <MessageSquareText size={16} />
                  </button>
                  <button
                    onClick={() => copyUrl(item.url, item.id)}
                    title="Copy URL"
                    className="btn btn-ghost"
                    style={{ padding: '6px' }}
                  >
                    {copiedId === item.id ? <Check size={16} color="var(--color-success)" /> : <Copy size={16} />}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Remove memory"
                    className="btn btn-ghost"
                    style={{ padding: '6px' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Related Pages in Journey */}
              {item.related_pages && item.related_pages.length > 0 && (
                <div style={{
                  marginTop: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                }}>
                  <button
                    onClick={() => toggleSessionExpand(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      fontWeight: 500,
                    }}
                  >
                    <Layers size={13} color="var(--accent-light)" />
                    {item.related_pages.length} other pages explored in this research journey
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {isExpanded && (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '16px' }}>
                      {item.related_pages.map((rp, idx) => (
                        <div key={idx} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>•</span>
                          <a href={rp.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>
                            {rp.title || rp.url}
                          </a>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({rp.domain})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty Search State */}
        {response && response.results.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
          }}>
            <Search size={36} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>No memories found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '400px', margin: '0 auto' }}>
              Try loosening your search or using broader keywords. Make sure the Recall extension is installed to record your browsing.
            </p>
          </div>
        )}

        {/* Initial Prompt State */}
        {!response && (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            color: 'var(--text-muted)',
          }}>
            <Sparkles size={36} color="var(--accent-light)" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '19px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Your web memory is ready
            </h3>
            <p style={{ maxWidth: '460px', margin: '0 auto', fontSize: '14px', lineHeight: 1.6 }}>
              Type anything you remember about an article, video, GitHub repo, documentation, or discussion.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
