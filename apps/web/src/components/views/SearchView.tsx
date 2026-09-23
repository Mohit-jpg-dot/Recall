import React, { useState, useEffect, useRef } from 'react';
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
  AlertCircle,
  X,
  Compass,
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sampleQueries = [
    'that github repo about cuda memory from last week',
    'thriller movie recommendation on reddit',
    'react animation tutorial from yesterday',
    'huggingface paper on agent architectures',
  ];

  const domainFilters = ['All', 'github.com', 'reddit.com', 'stackoverflow.com', 'youtube.com', 'arxiv.org'];

  const executeSearch = async (q: string, domain?: string | null) => {
    if (!q.trim()) {
      setResponse(null);
      return;
    }
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

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (val.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(val, selectedDomain);
      }, 350);
    } else if (!val.trim()) {
      setResponse(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      executeSearch(query, selectedDomain);
    }
  };

  const handleDomainSelect = (dom: string) => {
    const nextDomain = dom === 'All' ? null : dom;
    setSelectedDomain(nextDomain);
    if (query.trim()) {
      executeSearch(query, nextDomain);
    }
  };

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const confirmDeleteMemory = async (id: string) => {
    try {
      await api.deleteMemory(id);
      if (response) {
        setResponse({
          ...response,
          results: response.results.filter((r) => r.id !== id),
          total: Math.max(0, response.total - 1),
        });
      }
      setDeletingId(null);
    } catch (err) {
      alert('Failed to delete memory record');
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
    <div style={{ padding: '36px 44px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Search Personal Memory
          </h1>
          <span className="badge badge-indigo" style={{ fontSize: '11px', fontWeight: 600 }}>
            Hybrid Engine
          </span>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px' }}>
          Search how human memory actually works: recall by approximate timeframe, topics, domains, or key concepts.
        </p>
      </div>

      {/* Main Search Bar */}
      <div style={{ position: 'relative', marginBottom: '18px' }}>
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: isFocused ? '1px solid var(--accent-light)' : '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 20px',
            boxShadow: isFocused
              ? '0 0 0 3px rgba(99, 102, 241, 0.28), 0 12px 32px -4px rgba(99, 102, 241, 0.25)'
              : 'var(--shadow-card)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Search size={21} color={isFocused ? 'var(--accent-light)' : 'var(--text-muted)'} style={{ marginRight: '14px', flexShrink: 0, transition: 'color var(--transition-fast)' }} />
          <input
            type="text"
            placeholder="e.g. that github repo about cuda memory from last week..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{
              flex: 1,
              fontSize: '16px',
              padding: '4px 0',
              color: 'var(--text-primary)',
              fontWeight: 500,
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResponse(null);
              }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="kbd">↵ Enter</span>
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>
          Filter Domain:
        </span>
        {domainFilters.map((dom) => {
          const active = (selectedDomain === null && dom === 'All') || selectedDomain === dom;
          return (
            <button
              key={dom}
              onClick={() => handleDomainSelect(dom)}
              style={{
                fontSize: '12px',
                padding: '4px 11px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: active ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                color: active ? '#ffffff' : 'var(--text-secondary)',
                border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                fontWeight: active ? 600 : 500,
                transition: 'all var(--transition-fast)',
              }}
            >
              {dom}
            </button>
          );
        })}
      </div>

      {/* Empty State / Query Suggestions */}
      {!response && !loading && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{
            padding: '36px 32px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'var(--brand-gradient-subtle)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Compass size={24} color="var(--accent-light)" />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
              Search across your web memory
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', maxWidth: '480px', margin: '0 auto 20px' }}>
              Type natural memory queries to locate forgotten technical docs, articles, research papers, and discussions.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
              {sampleQueries.map((sq, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(sq);
                    executeSearch(sq, selectedDomain);
                  }}
                  className="btn-ghost"
                  style={{
                    fontSize: '12.5px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 12px',
                  }}
                >
                  <Sparkles size={12} color="var(--accent-light)" style={{ marginRight: '6px' }} />
                  {sq}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="glass-panel"
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="skeleton" style={{ width: '90px', height: '20px' }} />
                <div className="skeleton" style={{ width: '45%', height: '20px' }} />
              </div>
              <div className="skeleton" style={{ width: '75%', height: '14px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="skeleton" style={{ width: '120px', height: '22px' }} />
                <div className="skeleton" style={{ width: '100px', height: '22px' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search Results */}
      {response && !loading && (
        <div>
          {/* Results Summary Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            fontSize: '13px',
            color: 'var(--text-muted)',
          }}>
            <span>
              Found <strong style={{ color: 'var(--text-primary)' }}>{response.total}</strong> results in{' '}
              <strong style={{ color: 'var(--accent-light)' }}>{response.took_ms}ms</strong>
            </span>
            <button
              onClick={() => onAskAi(query)}
              className="btn-ghost"
              style={{
                fontSize: '12.5px',
                color: 'var(--accent-light)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <MessageSquareText size={15} />
              Ask AI about this query
            </button>
          </div>

          {response.results.length === 0 ? (
            <div style={{
              padding: '48px 24px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
            }}>
              <AlertCircle size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>No memories found</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', maxWidth: '420px', margin: '0 auto' }}>
                We couldn't find any browsing records matching "{query}". Try checking your connected browser extension or using broader terms.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {response.results.map((item: SearchResultItem) => (
                <div
                  key={item.id}
                  className="glass-panel card-interactive"
                  style={{
                    padding: '20px 22px',
                    position: 'relative',
                  }}
                >
                  {/* Top metadata row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-gray" style={{ fontSize: '11px', fontWeight: 600 }}>
                        <Globe size={11} color="var(--accent-light)" />
                        {item.domain}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {formatVisitedTime(item.visited_at)}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>•</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {item.source_browser}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(99, 102, 241, 0.14)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.28)',
                        }}
                      >
                        {Math.round(item.relevance_score * 100)}% match
                      </span>
                      <button
                        onClick={() => copyUrl(item.url, item.id)}
                        title="Copy URL"
                        style={{
                          padding: '5px',
                          color: copiedId === item.id ? 'var(--color-success)' : 'var(--text-muted)',
                          borderRadius: 'var(--radius-xs)',
                          transition: 'color var(--transition-fast)',
                        }}
                      >
                        {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open page"
                        style={{ padding: '5px', color: 'var(--text-muted)', display: 'inline-flex' }}
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button
                        onClick={() => setDeletingId(item.id)}
                        title="Delete memory"
                        style={{ padding: '5px', color: 'var(--text-muted)', borderRadius: 'var(--radius-xs)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-danger)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Link */}
                  <h3 style={{ fontSize: '16.5px', fontWeight: 700, marginBottom: '6px', lineHeight: 1.35 }}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-light)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    >
                      {item.title}
                    </a>
                  </h3>

                  {/* Clean URL display */}
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: '12px',
                  }}>
                    {item.url}
                  </div>

                  {/* Match Reasons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {item.match_reasons.map((mr, rIdx) => (
                      <span
                        key={rIdx}
                        className="badge"
                        style={{
                          fontSize: '11px',
                          backgroundColor:
                            mr.type === 'temporal'
                              ? 'rgba(245, 158, 11, 0.12)'
                              : mr.type === 'domain'
                              ? 'rgba(16, 185, 129, 0.12)'
                              : mr.type === 'semantic'
                              ? 'rgba(139, 92, 246, 0.12)'
                              : 'rgba(255, 255, 255, 0.05)',
                          color:
                            mr.type === 'temporal'
                              ? '#fcd34d'
                              : mr.type === 'domain'
                              ? '#6ee7b7'
                              : mr.type === 'semantic'
                              ? '#c4b5fd'
                              : 'var(--text-secondary)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <Tag size={10} style={{ marginRight: '3px' }} />
                        {mr.description}
                      </span>
                    ))}

                    {/* Related session pages toggle */}
                    {item.related_pages && item.related_pages.length > 0 && (
                      <button
                        onClick={() => toggleSessionExpand(item.id)}
                        className="btn-ghost"
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <Layers size={11} color="var(--accent-light)" style={{ marginRight: '4px' }} />
                        {item.related_pages.length} related in session
                        {expandedSessions[item.id] ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    )}
                  </div>

                  {/* Expanded Session Pages */}
                  {expandedSessions[item.id] && item.related_pages && (
                    <div style={{
                      marginTop: '14px',
                      padding: '12px 14px',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Pages explored in the same session:
                      </div>
                      {item.related_pages.map((rel, relIdx) => (
                        <div
                          key={relIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '12.5px',
                          }}
                        >
                          <a
                            href={rel.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '80%',
                            }}
                          >
                            {rel.title || rel.url}
                          </a>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{rel.domain}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline Delete Confirmation Popover (Accessible & Non-blocking) */}
                  {deletingId === item.id && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-medium)',
                      boxShadow: 'var(--shadow-lg)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      animation: 'fadeIn 0.15s ease-out',
                    }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 500 }}>
                        Delete this record from memory?
                      </span>
                      <button
                        onClick={() => confirmDeleteMemory(item.id)}
                        style={{
                          backgroundColor: 'var(--color-danger)',
                          color: '#ffffff',
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-xs)',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        style={{
                          color: 'var(--text-muted)',
                          padding: '4px 8px',
                          fontSize: '12px',
                        }}
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
      )}
    </div>
  );
};
