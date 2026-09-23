import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await api.register({
          email,
          password,
          display_name: displayName || email.split('@')[0],
        });
      } else {
        await api.login({ email, password });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.login({ email: 'mohit@recall.dev', password: 'password123' });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate demo user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 6, 9, 0.82)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px',
      animation: 'fadeInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '430px',
        padding: '36px',
        position: 'relative',
        boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.9), 0 0 35px -5px rgba(99, 102, 241, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--surface-glass-modal)',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            color: 'var(--text-muted)',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '6px', letterSpacing: '-0.025em' }}>
            {isRegister ? 'Join Recall' : 'Welcome to Recall'}
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            {isRegister ? 'Start building your private, searchable web memory' : 'Access your private browsing memory across devices'}
          </p>
        </div>

        {/* Quick Demo Login Button */}
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={loading}
          className="btn btn-secondary"
          style={{
            width: '100%',
            marginBottom: '22px',
            gap: '8px',
            padding: '12px',
            backgroundColor: 'rgba(99, 102, 241, 0.14)',
            border: '1px solid rgba(129, 140, 248, 0.35)',
            color: '#c7d2fe',
            fontWeight: 600,
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.2)',
          }}
        >
          <Sparkles size={16} color="var(--accent-light)" />
          One-Click Demo Login (Preloaded Data)
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '18px 0',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
          <span>or continue with email</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
        </div>

        {error && (
          <div style={{
            padding: '10px 14px',
            backgroundColor: 'var(--color-danger-bg)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#fda4af',
            fontSize: '13px',
            marginBottom: '16px',
            lineHeight: 1.4,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isRegister && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                Display Name
              </label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '9px 14px',
                gap: '10px',
                transition: 'border-color var(--transition-fast)',
              }}>
                <UserIcon size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
              Email Address
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '9px 14px',
              gap: '10px',
              transition: 'border-color var(--transition-fast)',
            }}>
              <Mail size={16} color="var(--text-muted)" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>
              Password
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '9px 14px',
              gap: '10px',
              transition: 'border-color var(--transition-fast)',
            }}>
              <Lock size={16} color="var(--text-muted)" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '8px', padding: '12px', fontSize: '14.5px' }}
          >
            {loading ? 'Authenticating...' : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: 'var(--text-muted)' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account yet?"}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(null); }}
            style={{ color: 'var(--accent-light)', fontWeight: 600 }}
          >
            {isRegister ? 'Sign in' : 'Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
};
