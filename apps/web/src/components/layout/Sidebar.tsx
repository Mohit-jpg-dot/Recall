import React from 'react';
import {
  BrainCircuit,
  Search,
  MessageSquareText,
  Clock,
  FolderKanban,
  Compass,
  Laptop,
  ShieldCheck,
  LogOut,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { User } from '../../lib/types';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  user: User | null;
  onLogout: () => void;
  isMemoryPaused?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  user,
  onLogout,
  isMemoryPaused = false,
}) => {
  const navItems = [
    { id: 'search', label: 'Memory Search', icon: Search, badge: null },
    { id: 'chat', label: 'AI Memory Chat', icon: MessageSquareText, badge: 'RAG' },
    { id: 'timeline', label: 'Timeline', icon: Clock, badge: null },
    { id: 'topics', label: 'Topics', icon: FolderKanban, badge: null },
    { id: 'sessions', label: 'Journeys', icon: Compass, badge: null },
    { id: 'browsers', label: 'Browsers', icon: Laptop, badge: null },
    { id: 'privacy', label: 'Privacy & Rules', icon: ShieldCheck, badge: null },
    { id: 'diagrams', label: 'Architecture', icon: Layers, badge: 'Diagrams' },
  ];

  return (
    <aside style={{
      width: '260px',
      height: '100vh',
      backgroundColor: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '24px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'var(--brand-gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 15px rgba(99, 102, 241, 0.35)',
        }}>
          <BrainCircuit size={22} color="#ffffff" />
        </div>
        <div>
          <div style={{
            fontSize: '18px',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            Recall
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isMemoryPaused ? 'var(--color-warning)' : 'var(--color-success)',
              display: 'inline-block',
              boxShadow: isMemoryPaused ? '0 0 8px var(--color-warning)' : '0 0 8px var(--color-success)',
            }} title={isMemoryPaused ? 'Memory Paused' : 'Memory Active'} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Personal Web Memory
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        <div style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '0.08em',
          padding: '8px 12px 6px',
        }}>
          Memory Core
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: active ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  border: active ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                  transition: 'all var(--transition-fast)',
                  fontWeight: active ? 600 : 500,
                  fontSize: '14px',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={18} color={active ? 'var(--accent-light)' : 'currentColor'} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    background: 'rgba(99, 102, 241, 0.25)',
                    color: '#c7d2fe',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Sync Status Banner */}
      <div style={{
        margin: '0 12px 12px',
        padding: '12px',
        backgroundColor: 'var(--bg-surface-elevated)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Sparkles size={14} color="var(--accent-light)" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Recall Engine
          </span>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {isMemoryPaused ? 'Collection paused' : 'Private memory sync ready'}
        </p>
      </div>

      {/* User Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(10, 10, 15, 0.4)',
      }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {user?.display_name || 'Guest User'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
            {user?.email || 'Not connected'}
          </div>
        </div>
        <button
          onClick={onLogout}
          title="Sign out"
          style={{
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color var(--transition-fast)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
};
