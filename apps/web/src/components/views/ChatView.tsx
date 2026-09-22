import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquareText,
  Send,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  Brain,
  Globe,
  Clock,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { ChatMessage, Conversation, SearchResultItem } from '../../lib/types';

interface ChatViewProps {
  initialPrompt?: string | null;
}

export const ChatView: React.FC<ChatViewProps> = ({ initialPrompt }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sampleQuestions = [
    'What was that GitHub repo about CUDA memory pooling?',
    'Summarize that thriller movie thread I found on Reddit',
    'Which React animation libraries did I look at recently?',
    'Show me the papers on AI agents that I opened',
  ];

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (initialPrompt) {
      setInputText(initialPrompt);
      handleSend(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadConversations = async () => {
    try {
      const list = await api.listConversations();
      setConversations(list);
      if (list.length > 0 && !currentConvId) {
        selectConversation(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  const selectConversation = async (id: string) => {
    setCurrentConvId(id);
    setLoading(true);
    try {
      const msgs = await api.getConversation(id);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentConvId(null);
    setMessages([]);
    setInputText('');
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConvId === id) {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const text = overrideText || inputText;
    if (!text.trim() || loading) return;

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: text,
      sources: [],
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await api.sendMessage(text, currentConvId || undefined);
      if (!currentConvId) {
        setCurrentConvId(res.conversation_id);
        loadConversations();
      }
      setMessages((prev) => [...prev, res.message]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: `Sorry, I encountered an issue: ${err.message || 'Failed to retrieve memories'}`,
        sources: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Threads Sidebar */}
      <div style={{
        width: '240px',
        borderRight: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '16px 14px' }}>
          <button
            onClick={startNewChat}
            className="btn btn-primary"
            style={{ width: '100%', gap: '6px', fontSize: '13px' }}
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, padding: '8px 8px 4px', textTransform: 'uppercase' }}>
            Past Inquiries
          </div>
          {conversations.map((c) => {
            const active = currentConvId === c.id;
            return (
              <div
                key={c.id}
                onClick={() => selectConversation(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: active ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: active ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  marginBottom: '2px',
                  border: active ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                }}
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {c.title || 'Search conversation'}
                </div>
                <button
                  onClick={(e) => handleDeleteConversation(c.id, e)}
                  style={{ color: 'var(--text-muted)', padding: '2px', opacity: 0.6 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.opacity = '0.6'; }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-base)' }}>
        {/* Messages Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px', maxWidth: '600px', margin: '0 auto' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'var(--brand-gradient)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                boxShadow: 'var(--shadow-glow)',
              }}>
                <Brain size={28} color="#ffffff" />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '10px' }}>
                Ask Recall Anything
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, marginBottom: '28px' }}>
                Recall synthesizes grounded answers strictly from your private web browsing records with full citation links.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', textAlign: 'left' }}>
                {sampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(q);
                      handleSend(q);
                    }}
                    className="glass-panel"
                    style={{
                      padding: '14px',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                      textAlign: 'left',
                      transition: 'all var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-focus)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isUser ? 'flex-end' : 'flex-start',
                  marginBottom: '24px',
                }}
              >
                {/* Role Header */}
                <div style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  {!isUser && <Sparkles size={12} color="var(--accent-light)" />}
                  {isUser ? 'You' : 'Recall Memory Engine'}
                </div>

                {/* Bubble */}
                <div
                  style={{
                    maxWidth: '75%',
                    padding: '14px 18px',
                    borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    backgroundColor: isUser ? 'var(--accent-primary)' : 'var(--bg-surface-elevated)',
                    color: isUser ? '#ffffff' : 'var(--text-primary)',
                    border: isUser ? 'none' : '1px solid var(--border-subtle)',
                    fontSize: '15px',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {m.content}
                </div>

                {/* Sources / Citations */}
                {!isUser && m.sources && m.sources.length > 0 && (
                  <div style={{ marginTop: '12px', width: '100%', maxWidth: '75%' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Globe size={13} color="var(--accent-light)" />
                      Grounded Sources ({m.sources.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {m.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="glass-panel"
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textDecoration: 'none',
                            transition: 'all var(--transition-fast)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-light)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          }}
                        >
                          <div style={{ overflow: 'hidden', marginRight: '12px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {src.title || src.url}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{src.domain}</span>
                              <span>•</span>
                              <span>{new Date(src.visited_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            </div>
                          </div>
                          <ExternalLink size={14} color="var(--text-muted)" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
              <Sparkles size={16} color="var(--accent-light)" className="pulse-glow" />
              Searching memories and synthesizing answer...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{
          padding: '20px 48px',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '8px 16px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <textarea
              rows={1}
              placeholder="Ask about pages, articles, repositories, or topics you saw online..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              style={{
                flex: 1,
                fontSize: '15px',
                color: 'var(--text-primary)',
                resize: 'none',
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !inputText.trim()}
              className="btn btn-primary"
              style={{ padding: '8px 16px', marginLeft: '12px' }}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
