import React, { useState } from 'react';
import {
  BrainCircuit,
  Search,
  Sparkles,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  CheckCircle2,
  Lock,
  Globe,
  Zap,
  Terminal,
  Clock,
  ExternalLink,
  ChevronRight,
  Database,
  EyeOff,
  Flame,
} from 'lucide-react';

interface LandingViewProps {
  onEnterApp: () => void;
  onOpenAuth: () => void;
  onOpenDiagrams: () => void;
}

interface SimulatedMemory {
  id: string;
  title: string;
  url: string;
  domain: string;
  visitedTime: string;
  matchScore: number;
  matchReason: string;
  topic: string;
}

export const LandingView: React.FC<LandingViewProps> = ({ onEnterApp, onOpenAuth, onOpenDiagrams }) => {
  const [activeChip, setActiveChip] = useState<string>('cuda memory github');
  const [simulatedQuery, setSimulatedQuery] = useState<string>('that github repo about cuda memory from last week');

  const simulatedMemories: Record<string, SimulatedMemory[]> = {
    'cuda memory github': [
      {
        id: '1',
        title: 'vllm-project/vllm: High-throughput PagedAttention CUDA Memory Management',
        url: 'https://github.com/vllm-project/vllm',
        domain: 'github.com',
        visitedTime: 'Yesterday at 3:42 PM',
        matchScore: 99,
        matchReason: "Matched temporal hint 'yesterday' + keywords 'cuda', 'memory'",
        topic: 'Machine Learning',
      },
      {
        id: '2',
        title: 'pytorch/pytorch: CUDA Caching Allocator Internals & Fragment Mitigation',
        url: 'https://github.com/pytorch/pytorch/blob/main/c10/cuda/CUDACachingAllocator.cpp',
        domain: 'github.com',
        visitedTime: '4 days ago',
        matchScore: 95,
        matchReason: "Matched domain 'github.com' + semantic concept 'gpu memory'",
        topic: 'Engineering',
      },
    ],
    'transformer paper arxiv': [
      {
        id: '3',
        title: '[2309.12307] FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning',
        url: 'https://arxiv.org/abs/2309.12307',
        domain: 'arxiv.org',
        visitedTime: 'Today at 10:14 AM',
        matchScore: 98,
        matchReason: "Matched domain 'arxiv.org' + semantic vector 'attention mechanisms'",
        topic: 'Research',
      },
      {
        id: '4',
        title: '[1706.03762] Attention Is All You Need — Original Transformer Architecture',
        url: 'https://arxiv.org/abs/1706.03762',
        domain: 'arxiv.org',
        visitedTime: 'Last week',
        matchScore: 94,
        matchReason: "Matched temporal hint 'last week' + topic 'transformer architecture'",
        topic: 'Research',
      },
    ],
    'postgres query planner': [
      {
        id: '5',
        title: 'PostgreSQL: Documentation: 16: Using EXPLAIN (ANALYZE, BUFFERS) for Index Tuning',
        url: 'https://www.postgresql.org/docs/current/using-explain.html',
        domain: 'postgresql.org',
        visitedTime: '2 days ago',
        matchScore: 97,
        matchReason: "Matched keyword 'postgres' + conceptual intent 'query planner'",
        topic: 'Databases',
      },
    ],
    'react fiber architecture': [
      {
        id: '6',
        title: 'acdlite/react-fiber-architecture: A description of React\'s next-generation core algorithm',
        url: 'https://github.com/acdlite/react-fiber-architecture',
        domain: 'github.com',
        visitedTime: '3 days ago',
        matchScore: 96,
        matchReason: "Matched keywords 'react', 'fiber' + semantic query 'architecture'",
        topic: 'Frontend',
      },
    ],
  };

  const handleChipClick = (chipKey: string, queryText: string) => {
    setActiveChip(chipKey);
    setSimulatedQuery(queryText);
  };

  const currentResults = simulatedMemories[activeChip] || simulatedMemories['cuda memory github'];

  return (
    <div style={{ minHeight: '100vh', width: '100%', overflowX: 'hidden', position: 'relative' }}>
      {/* ── Top Navigation Bar ──────────────────────────────── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 48px',
        borderBottom: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(7, 8, 11, 0.75)',
      }}>
        {/* Brand Logo & Live Engine Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '11px',
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(99, 102, 241, 0.45)',
          }}>
            <BrainCircuit size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{
              fontSize: '20px',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.03em',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              Recall
              <span className="badge badge-indigo" style={{ fontSize: '11px', padding: '2px 8px' }}>
                v1.2
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-success)', display: 'inline-block' }} />
              Multi-Browser Engine Active
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onOpenDiagrams}
            className="btn btn-secondary"
            style={{ fontSize: '13px', padding: '8px 14px', gap: '6px' }}
          >
            <Layers size={14} color="var(--accent-light)" />
            Architecture
          </button>
          <button
            onClick={onOpenAuth}
            className="btn btn-secondary"
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            Sign In
          </button>
          <button
            onClick={onEnterApp}
            className="btn btn-primary"
            style={{ fontSize: '13px', padding: '8px 18px', gap: '6px' }}
          >
            Launch Memory
            <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* ── Hero Section ───────────────────────────────────── */}
      <section style={{
        padding: '80px 24px 40px',
        textAlign: 'center',
        maxWidth: '1080px',
        margin: '0 auto',
      }}>
        {/* Glowing Pill Eyebrow */}
        <div style={{ display: 'inline-flex', marginBottom: '22px' }}>
          <div className="badge badge-indigo" style={{
            padding: '6px 16px',
            fontSize: '13px',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.25)',
            border: '1px solid rgba(129, 140, 248, 0.4)',
          }}>
            <Sparkles size={14} color="var(--accent-light)" />
            <span>The Personal Web Memory Layer &bull; Chrome &bull; Firefox &bull; Safari</span>
          </div>
        </div>

        {/* Master Headline */}
        <h1 style={{
          fontSize: '64px',
          fontWeight: 800,
          lineHeight: 1.08,
          marginBottom: '24px',
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.035em',
        }}>
          Your brain forgets.<br />
          <span className="text-gradient-purple">Recall doesn't.</span>
        </h1>

        <p style={{
          fontSize: '20px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '720px',
          margin: '0 auto 48px',
          fontWeight: 400,
        }}>
          A private, lightweight memory layer for your browser. Silently indexes your permitted discoveries and reconstructs imperfect human recollections in milliseconds.
        </p>

        {/* ── Interactive Memory Simulator ───────────────────── */}
        <div style={{
          maxWidth: '820px',
          margin: '0 auto 50px',
          textAlign: 'left',
        }}>
          {/* Simulator Bar Container */}
          <div className="glass-panel" style={{
            padding: '24px',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-highlight)',
            boxShadow: '0 16px 48px -8px rgba(0, 0, 0, 0.8), 0 0 30px -4px rgba(99, 102, 241, 0.25)',
          }}>
            {/* Simulator Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <Terminal size={15} color="var(--accent-light)" />
                <span>Interactive Memory Retrieval Simulator</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="kbd">p50: 3.4ms</span>
                <span className="kbd">pgvector</span>
              </div>
            </div>

            {/* Simulated Search Input */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 18px',
              marginBottom: '16px',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.4)',
            }}>
              <Search size={20} color="var(--accent-light)" style={{ marginRight: '14px', flexShrink: 0 }} />
              <input
                type="text"
                value={simulatedQuery}
                onChange={(e) => setSimulatedQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onEnterApp(); }}
                placeholder="Try asking your memory anything..."
                style={{
                  flex: 1,
                  fontSize: '16px',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                }}
              />
              <button
                onClick={onEnterApp}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
              >
                Search Live
              </button>
            </div>

            {/* Quick Demo Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '4px' }}>Try queries:</span>
              {[
                { label: 'cuda memory on github', key: 'cuda memory github', q: 'that github repo about cuda memory from last week' },
                { label: 'transformer paper arxiv', key: 'transformer paper arxiv', q: 'arxiv paper about fast attention mechanisms' },
                { label: 'postgres query planner', key: 'postgres query planner', q: 'postgres explain analyze buffers tuning' },
                { label: 'react fiber architecture', key: 'react fiber architecture', q: 'acdlite react fiber core algorithm' },
              ].map((chip) => (
                <button
                  key={chip.key}
                  onClick={() => handleChipClick(chip.key, chip.q)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '12px',
                    fontWeight: 500,
                    backgroundColor: activeChip === chip.key ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: activeChip === chip.key ? '1px solid var(--accent-light)' : '1px solid var(--border-subtle)',
                    color: activeChip === chip.key ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Simulated Result Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {currentResults.map((item) => (
                <div
                  key={item.id}
                  onClick={onEnterApp}
                  className="card-interactive"
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge badge-indigo" style={{ fontSize: '11px', padding: '2px 8px' }}>
                        {item.domain}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {item.visitedTime}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--color-success)',
                        backgroundColor: 'var(--color-success-bg)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-xs)',
                      }}>
                        {item.matchScore}% Match
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px', lineHeight: 1.4 }}>
                    {item.title}
                  </div>

                  <div style={{
                    fontSize: '12px',
                    color: 'var(--accent-light)',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-xs)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span>✦ {item.matchReason}</span>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Click to explore <ChevronRight size={13} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Call-to-Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={onEnterApp}
            className="btn btn-primary"
            style={{ padding: '14px 32px', fontSize: '15px', gap: '10px' }}
          >
            Open Live Web Memory
            <ArrowRight size={17} />
          </button>
          <button
            onClick={onOpenDiagrams}
            className="btn btn-secondary"
            style={{ padding: '14px 26px', fontSize: '15px', gap: '8px' }}
          >
            <Layers size={17} color="var(--accent-light)" />
            View Architecture Specs
          </button>
          <button
            onClick={onOpenAuth}
            className="btn btn-ghost"
            style={{ padding: '14px 20px', fontSize: '15px' }}
          >
            Sign In with Email
          </button>
        </div>
      </section>

      {/* ── Live Performance Metrics Strip ──────────────────── */}
      <section style={{
        padding: '36px 40px',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(14, 17, 26, 0.4)',
      }}>
        <div style={{
          maxWidth: '1080px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '24px',
          textAlign: 'center',
        }}>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--color-success)', marginBottom: '4px' }}>
              &lt; 0.4 ms
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Timeline Query Latency</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Index Scan on 100k events</div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-light)', marginBottom: '4px' }}>
              3,290+
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Ingestion Events / Sec</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Atomic batch processing</div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-violet)', marginBottom: '4px' }}>
              1536-dim
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Vector Cosine Engine</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PostgreSQL pgvector HNSW</div>
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#f472b6', marginBottom: '4px' }}>
              0% Token Leak
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Client-Side Scrubbing</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Zero form data indexed</div>
          </div>
        </div>
      </section>

      {/* ── Modern Bento Grid Feature Showcase ──────────────── */}
      <section style={{
        padding: '80px 40px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div className="badge badge-purple" style={{ marginBottom: '12px' }}>
            <Zap size={13} />
            Modern Engineering Architecture
          </div>
          <h2 style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-0.03em' }}>
            Built for how developers and researchers explore.
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', maxWidth: '640px', margin: '12px auto 0' }}>
            No heavy DOM scraping, no slow vector databases in Electron wrappers. Recall is a hardened async pipeline.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '20px',
        }}>
          {/* Bento Card 1: Imperfect Human Search (Span 8) */}
          <div className="glass-panel" style={{
            gridColumn: 'span 8',
            padding: '36px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Search size={18} color="var(--accent-light)" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Intelligent Query Decomposition</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14.5px', lineHeight: 1.6, marginBottom: '24px' }}>
              Recall doesn't expect you to remember exact URLs or keywords. Our hybrid pipeline extracts temporal hints, domain restrictions, and semantic concepts simultaneously.
            </p>

            {/* Visual Token Pipeline Diagram */}
            <div style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
              padding: '18px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12.5px',
            }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
                Query: "github repo about cuda memory from last week"
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ backgroundColor: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', color: '#c7d2fe', padding: '4px 10px', borderRadius: '6px' }}>
                  domain: github.com
                </span>
                <span style={{ backgroundColor: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.35)', color: '#fbcfe8', padding: '4px 10px', borderRadius: '6px' }}>
                  time: visited_at &gt;= NOW() - 7d
                </span>
                <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.35)', color: '#a7f3d0', padding: '4px 10px', borderRadius: '6px' }}>
                  vector: [cuda, memory, gpu]
                </span>
              </div>
            </div>
          </div>

          {/* Bento Card 2: Multi-Browser Sync (Span 4) */}
          <div className="glass-panel" style={{
            gridColumn: 'span 4',
            padding: '36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Globe size={18} color="var(--accent-violet)" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Universal Browser Sync</h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
                Unified browsing memory across all your browsers with offline queueing and exponential backoff retry.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { name: 'Google Chrome', status: 'Manifest V3 Native', color: '#60a5fa' },
                { name: 'Mozilla Firefox', status: 'Gecko Background Script', color: '#f97316' },
                { name: 'Apple Safari', status: 'WebExtensions Compatible', color: '#38bdf8' },
              ].map((b, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{b.name}</span>
                  <span style={{ color: b.color, fontSize: '11px' }}>{b.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bento Card 3: Grounded Conversational AI (Span 6) */}
          <div className="glass-panel" style={{
            gridColumn: 'span 6',
            padding: '36px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Sparkles size={18} color="var(--color-success)" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Grounded Conversational RAG</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
              Chat with your browsing past. Every single claim is backed by exact, clickable footnote citations to the pages you visited. If insufficient evidence exists, Recall explicitly tells you.
            </p>
            <div style={{
              padding: '14px 16px',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: '13px',
              color: 'var(--text-primary)',
            }}>
              <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>Recall AI:</span> "Based on your visits to vLLM's repo [1] and PyTorch docs [2], PagedAttention allocates non-contiguous KV-cache pages in GPU memory..."
            </div>
          </div>

          {/* Bento Card 4: Hardware & Privacy Guarantee (Span 6) */}
          <div className="glass-panel" style={{
            gridColumn: 'span 6',
            padding: '36px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <ShieldCheck size={18} color="var(--color-danger)" />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Zero-Credential Privacy Vault</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
              Form inputs, passwords, authentication headers, cookies, and bearer tokens are never captured. Exclude banking or sensitive internal domains with a single click.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}>
              <div style={{ flex: 1, padding: '10px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '8px' }}>
                <CheckCircle2 size={14} color="var(--color-success)" style={{ marginBottom: '4px' }} />
                <div>Single Memory Purge</div>
              </div>
              <div style={{ flex: 1, padding: '10px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '8px' }}>
                <CheckCircle2 size={14} color="var(--color-success)" style={{ marginBottom: '4px' }} />
                <div>Instant JSON Export</div>
              </div>
              <div style={{ flex: 1, padding: '10px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '8px' }}>
                <CheckCircle2 size={14} color="var(--color-success)" style={{ marginBottom: '4px' }} />
                <div>Nuclear Reset Button</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ready to Experience Section ────────────────────── */}
      <section style={{
        padding: '80px 40px 100px',
        textAlign: 'center',
        background: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
      }}>
        <div className="glass-panel" style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '48px',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-highlight)',
          boxShadow: 'var(--shadow-glow)',
        }}>
          <h2 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '16px' }}>
            Ready to recall everything you've read?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.6, marginBottom: '32px' }}>
            Connect your browser in under 60 seconds and experience natural memory search.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={onEnterApp}
              className="btn btn-primary"
              style={{ padding: '14px 32px', fontSize: '15px', gap: '8px' }}
            >
              Get Started Now
              <ArrowRight size={16} />
            </button>
            <button
              onClick={onOpenAuth}
              className="btn btn-secondary"
              style={{ padding: '14px 24px', fontSize: '15px' }}
            >
              Log In
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer style={{
        padding: '32px 60px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
        color: 'var(--text-muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BrainCircuit size={16} color="var(--accent-light)" />
          <span>Recall &bull; Personal Web Memory Layer</span>
        </div>
        <div>
          Chrome &bull; Firefox &bull; Safari &bull; PostgreSQL &bull; pgvector
        </div>
      </footer>
    </div>
  );
};
