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
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px',
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '420px',
        padding: '32px',
        position: 'relative',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-medium)',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            color: 'var(--text-muted)',
            padding: '4px',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '6px' }}>
            {isRegister ? 'Join Recall' : 'Welcome Back'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {isRegister ? 'Start building your personal web memory' : 'Access your private browsing memory'}
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
            marginBottom: '20px',
            gap: '8px',
            padding: '12px',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: '#c7d2fe',
            fontWeight: 600,
          }}
        >
          <Sparkles size={16} color="var(--accent-light)" />
          One-Click Demo Login (Preloaded Data)
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          margin: '16px 0',
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
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#f87171',
            fontSize: '13px',
            marginBottom: '16px',
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
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                gap: '8px',
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
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              gap: '8px',
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
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              gap: '8px',
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
            style={{ width: '100%', marginTop: '8px', padding: '12px' }}
          >
            {loading ? 'Please wait...' : (isRegister ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '18px', fontSize: '13px', color: 'var(--text-muted)' }}>
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
