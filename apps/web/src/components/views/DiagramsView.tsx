import React, { useState } from 'react';
import {
  Layers,
  Database,
  Puzzle,
  Cpu,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

export const DiagramsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'system' | 'schema' | 'extension' | 'rag' | 'privacy'>('system');

  return (
    <div style={{ padding: '36px 48px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>
            System Architecture & Diagrams
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
            Interactive technical specifications, entity-relationship schemas, and data pipelines.
          </p>
        </div>
        <a
          href="/docs/architecture-diagrams.html"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary"
          style={{ gap: '6px', fontSize: '13px' }}
        >
          Open Standalone HTML Viewer
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Live Interactive Diagram Viewer Frame */}
      <div style={{
        width: '100%',
        height: '840px',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4)',
        background: '#0a0a0f',
      }}>
        <iframe
          src="/docs/architecture-diagrams.html"
          title="Recall Interactive Architecture & Diagrams"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
};

