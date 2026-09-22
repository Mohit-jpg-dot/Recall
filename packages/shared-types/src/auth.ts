// ─────────────────────────────────────────────
// Recall — Shared Types: Auth
// ─────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'bearer';
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  memory_count: number;
  connected_browsers: number;
}

export interface BrowserConnection {
  id: string;
  browser_type: string;
  connection_name: string;
  is_active: boolean;
  is_paused: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface PrivacySettings {
  memory_active: boolean;
  excluded_domains: ExcludedDomain[];
}

export interface ExcludedDomain {
  id: string;
  domain_name: string;
  created_at: string;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  color: string;
  page_count: number;
  is_auto_generated: boolean;
}

export interface ResearchSession {
  id: string;
  inferred_topic: string;
  page_count: number;
  started_at: string;
  ended_at: string;
  pages: SessionPage[];
}

export interface SessionPage {
  title: string;
  domain: string;
  url: string;
  visited_at: string;
}
