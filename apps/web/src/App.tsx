import React, { useState, useEffect } from 'react';
import { api } from './lib/api';
import type { User } from './lib/types';
import { Sidebar } from './components/layout/Sidebar';
import { SearchView } from './components/views/SearchView';
import { ChatView } from './components/views/ChatView';
import { TimelineView } from './components/views/TimelineView';
import { TopicsView } from './components/views/TopicsView';
import { SessionsView } from './components/views/SessionsView';
import { BrowsersView } from './components/views/BrowsersView';
import { PrivacyView } from './components/views/PrivacyView';
import { LandingView } from './components/views/LandingView';
import { AuthModal } from './components/views/AuthModal';
import { DiagramsView } from './components/views/DiagramsView';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('search');
  const [isLanding, setIsLanding] = useState<boolean>(true);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [chatPrompt, setChatPrompt] = useState<string | null>(null);
  const [isMemoryPaused, setIsMemoryPaused] = useState<boolean>(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = api.getToken();
    if (token) {
      try {
        const u = await api.getMe();
        setUser(u);
        setIsLanding(false);
        // Check privacy state
        const priv = await api.getPrivacy().catch(() => null);
        if (priv) {
          setIsMemoryPaused(!priv.memory_active);
        }
      } catch (err) {
        api.setToken(null);
        setUser(null);
      }
    }
  };

  const handleLogout = () => {
    api.setToken(null);
    setUser(null);
    setIsLanding(true);
  };

  const handleEnterApp = async () => {
    if (user) {
      setIsLanding(false);
      return;
    }
    // Automatically log in as demo user if available, or open auth
    try {
      await api.login({ email: 'mohit@recall.dev', password: 'password123' });
      await checkAuth();
      setIsLanding(false);
    } catch (e) {
      setAuthModalOpen(true);
    }
  };

  const handleAskAi = (prompt: string) => {
    setChatPrompt(prompt);
    setCurrentTab('chat');
  };

  if (isLanding && !user) {
    return (
      <>
        <LandingView
          onEnterApp={handleEnterApp}
          onOpenAuth={() => setAuthModalOpen(true)}
          onOpenDiagrams={() => {
            setIsLanding(false);
            setCurrentTab('diagrams');
          }}
        />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => {
            checkAuth();
            setIsLanding(false);
          }}
        />
      </>
    );
  }

  return (
    <div className="app-container">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'chat') setChatPrompt(null);
        }}
        user={user}
        onLogout={handleLogout}
        isMemoryPaused={isMemoryPaused}
      />

      <main className="main-content">
        {currentTab === 'search' && <SearchView onAskAi={handleAskAi} />}
        {currentTab === 'chat' && <ChatView initialPrompt={chatPrompt} />}
        {currentTab === 'timeline' && <TimelineView />}
        {currentTab === 'topics' && <TopicsView />}
        {currentTab === 'sessions' && <SessionsView />}
        {currentTab === 'browsers' && <BrowsersView />}
        {currentTab === 'privacy' && <PrivacyView />}
        {currentTab === 'diagrams' && <DiagramsView />}
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={checkAuth}
      />
    </div>
  );
};
