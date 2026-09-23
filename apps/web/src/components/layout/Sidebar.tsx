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
  Activity,
  User as UserIcon,
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
    { id: 'search', label: 'Memory Search', icon: Search, shortcut: '⌘1', badge: null },
    { id: 'chat', label: 'AI Memory Chat', icon: MessageSquareText, shortcut: '⌘2', badge: 'RAG' },
    { id: 'timeline', label: 'Timeline', icon: Clock, shortcut: '⌘3', badge: null },
    { id: 'topics', label: 'Topics', icon: FolderKanban, shortcut: '⌘4', badge: null },
    { id: 'sessions', label: 'Journeys', icon: Compass, shortcut: '⌘5', badge: null },
    { id: 'browsers', label: 'Browsers', icon: Laptop, shortcut: '⌘6', badge: null },
    { id: 'privacy', label: 'Privacy & Rules', icon: ShieldCheck, shortcut: '⌘7', badge: null },
    { id: 'diagrams', label: 'Architecture', icon: Layers, shortcut: '⌘8', badge: null },
  ];

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <aside style={{
      width: '264px',
      height: '100vh',
      backgroundColor: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      userSelect: 'none',
      position: 'relative',
      zIndex: 20,
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '20px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '11px',
          background: 'var(--brand-gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(99, 102, 241, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
          flexShrink: 0,
        }}>
          <BrainCircuit size={20} color="#ffffff" />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{
            fontSize: '18px',
            fontWeight: 800,
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.03em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            Recall
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isMemoryPaused ? 'var(--color-warning)' : 'var(--color-success)',
              display: 'inline-block',
              boxShadow: isMemoryPaused ? '0 0 10px var(--color-warning)' : '0 0 10px var(--color-success)',
            }} title={isMemoryPaused ? 'Memory Collection Paused' : 'Memory Sync Active'} />
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
            Personal Memory Layer
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, padding: '16px 10px', overflowY: 'auto' }}>
        <div style={{
          fontSize: '10.5px',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'var(--text-muted)',
          letterSpacing: '0.09em',
          padding: '4px 12px 8px',
        }}>
          Core Navigation
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
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
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: active ? 'rgba(99, 102, 241, 0.16)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  border: active ? '1px solid rgba(129, 140, 248, 0.35)' : '1px solid transparent',
                  boxShadow: active ? 'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 8px rgba(99, 102, 241, 0.18)' : 'none',
                  transition: 'all var(--transition-fast)',
                  fontWeight: active ? 600 : 500,
                  fontSize: '13.5px',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
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
                  <Icon size={17} color={active ? 'var(--accent-light)' : 'currentColor'} />
                  <span>{item.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {item.badge && (
                    <span style={{
                      fontSize: '9.5px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-xs)',
                      background: 'rgba(99, 102, 241, 0.25)',
                      color: '#c7d2fe',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                    }}>
                      {item.badge}
                    </span>
                  )}
                  <span className="kbd" style={{ fontSize: '10px', padding: '1px 5px', opacity: active ? 0.9 : 0.4 }}>
                    {item.shortcut}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Sync Status Badge */}
      <div style={{
        margin: '0 10px 12px',
        padding: '12px 14px',
        backgroundColor: 'var(--bg-surface-elevated)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={13} color="var(--accent-light)" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Memory Stream
            </span>
          </div>
          <span style={{
            fontSize: '10px',
            fontWeight: 700,
            color: isMemoryPaused ? 'var(--color-warning)' : 'var(--color-success)',
          }}>
            {isMemoryPaused ? 'PAUSED' : 'ONLINE'}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {isMemoryPaused ? 'Collection is temporarily paused' : 'Buffered & indexed in real-time'}
        </div>
      </div>

      {/* User Footer Profile */}
      <div style={{
        padding: '14px 16px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(7, 8, 11, 0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.4) 100%)',
            border: '1px solid rgba(129, 140, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 700,
            color: '#c7d2fe',
            flexShrink: 0,
          }}>
            {getInitials(user?.display_name)}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.display_name || 'Guest User'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.email || 'Demo Workspace'}
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          title="Sign out"
          style={{
            padding: '7px',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all var(--transition-fast)',
            border: '1px solid transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-danger)';
            e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)';
            e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  );
};
