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
} from 'lucide-react';

interface LandingViewProps {
  onEnterApp: () => void;
  onOpenAuth: () => void;
  onOpenDiagrams: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onEnterApp, onOpenAuth, onOpenDiagrams }) => {
  const [demoQuery, setDemoQuery] = useState('');

  const features = [
    {
      icon: Search,
      title: 'Imperfect Human Search',
      desc: 'Never worry about exact URLs or precise keywords. Search by approximate time, domain hints, or conceptual memories.',
    },
    {
      icon: Cpu,
      title: 'Zero-Overhead Extension',
      desc: 'Consumes virtually 0% CPU and minimal RAM. Batches requests, ignores duplicates, and never runs expensive models in your browser.',
    },
    {
      icon: Sparkles,
      title: 'Conversational Memory AI',
      desc: 'Chat with your browsing history. Recall answers with grounded facts and strict clickable citations to the exact pages.',
    },
    {
      icon: ShieldCheck,
      title: 'Uncompromising Privacy',
      desc: 'Passwords, form inputs, cookies, and tokens are never read or stored. Exclude sensitive domains with one click.',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', width: '100%', overflowX: 'hidden' }}>
      {/* Top Navbar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 60px',
        borderBottom: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(10, 10, 15, 0.75)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
          }}>
            <BrainCircuit size={20} color="#ffffff" />
          </div>
          <span style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            Recall
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onOpenDiagrams}
            className="btn btn-secondary"
            style={{ fontSize: '13px', gap: '6px' }}
          >
            <Layers size={14} />
            Architecture Diagrams
          </button>
          <button
            onClick={onOpenAuth}
            className="btn btn-secondary"
            style={{ fontSize: '13px' }}
          >
            Sign In
          </button>
          <button
            onClick={onEnterApp}
            className="btn btn-primary"
            style={{ fontSize: '13px', gap: '6px' }}
          >
            Explore Live App
            <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        padding: '90px 24px 60px',
        textAlign: 'center',
        maxWidth: '960px',
        margin: '0 auto',
      }}>
        <div className="badge badge-indigo" style={{ marginBottom: '20px', padding: '6px 14px', fontSize: '13px' }}>
          <Sparkles size={13} />
          Recall 1.0 — Personal Web Memory Layer
        </div>

        <h1 style={{
          fontSize: '56px',
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: '24px',
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.03em',
        }}>
          Your brain forgets.<br />
          <span className="text-gradient">Recall doesn't.</span>
        </h1>

        <p style={{
          fontSize: '20px',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          maxWidth: '680px',
          margin: '0 auto 40px',
        }}>
          A private, lightweight memory layer for your web browser. Silently indexes your permitted discoveries and answers imperfect human recollections in milliseconds.
        </p>

        {/* Hero Interactive Preview Search Box */}
        <div className="glass-panel" style={{
          padding: '12px 18px',
          maxWidth: '680px',
          margin: '0 auto 48px',
          display: 'flex',
          alignItems: 'center',
          boxShadow: 'var(--shadow-glow)',
          border: '1px solid var(--border-highlight)',
        }}>
          <Search size={22} color="var(--accent-light)" style={{ marginRight: '14px' }} />
          <input
            type="text"
            placeholder="Try: 'that github repo about cuda memory from last week'..."
            value={demoQuery}
            onChange={(e) => setDemoQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onEnterApp(); }}
            style={{
              flex: 1,
              fontSize: '16px',
              color: 'var(--text-primary)',
            }}
          />
          <button
            onClick={onEnterApp}
            className="btn btn-primary"
            style={{ padding: '8px 18px', fontSize: '14px' }}
          >
            Search
          </button>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={onEnterApp}
            className="btn btn-primary"
            style={{ padding: '14px 28px', fontSize: '15px', borderRadius: 'var(--radius-md)' }}
          >
            Open Web Memory
            <ArrowRight size={17} />
          </button>
          <button
            onClick={onOpenDiagrams}
            className="btn btn-secondary"
            style={{ padding: '14px 24px', fontSize: '15px', borderRadius: 'var(--radius-md)', gap: '8px' }}
          >
            <Layers size={17} />
            View Architecture Diagrams
          </button>
          <button
            onClick={onOpenAuth}
            className="btn btn-ghost"
            style={{ padding: '14px 20px', fontSize: '15px', borderRadius: 'var(--radius-md)' }}
          >
            Sign In / Register
          </button>
        </div>
      </section>

      {/* Feature Grid */}
      <section style={{
        padding: '60px 40px 100px',
        maxWidth: '1100px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
        }}>
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="glass-panel"
                style={{
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icon size={22} color="var(--accent-light)" />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{f.title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Extension Architecture Showcase */}
      <section style={{
        padding: '60px 40px 100px',
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(18, 18, 26, 0.4)',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div className="badge badge-purple" style={{ marginBottom: '16px' }}>
            <Globe size={13} />
            Performance & Lightweight Guarantee
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '16px' }}>
            Engineered to Never Slow Down Your Browser
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.6, maxWidth: '640px', margin: '0 auto 40px' }}>
            Unlike other tools that inject heavy scrapers into every tab, Recall uses lightweight metadata observation and local buffering.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px', textAlign: 'left' }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginBottom: '4px' }}>&lt; 0.1%</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>CPU Utilization</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Debounced tab change observation only. No continuous DOM parsing.</div>
            </div>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent-light)', marginBottom: '4px' }}>500-Item</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Resilient Offline Buffer</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Local storage persistence with automatic exponential backoff retry.</div>
            </div>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#f472b6', marginBottom: '4px' }}>0 Credentials</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Zero Token Ingestion</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sensitive forms, cookies, and passwords are rejected before queuing.</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '36px 60px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '13px',
        color: 'var(--text-muted)',
      }}>
        <div>Recall — Personal Memory Layer for the Web</div>
        <div>Private • Fast • Intelligent</div>
      </footer>
    </div>
  );
};
