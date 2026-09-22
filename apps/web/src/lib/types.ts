export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

export interface MatchReason {
  type: string;
  description: string;
}

export interface RelatedPage {
  title?: string;
  domain: string;
  url: string;
  visited_at: string;
}

export interface SearchResultItem {
  id: string;
  url: string;
  title?: string;
  domain: string;
  domain_favicon?: string;
  visited_at: string;
  source_browser: string;
  relevance_score: number;
  match_reasons: MatchReason[];
  related_pages: RelatedPage[];
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
  took_ms: number;
}

export interface SearchFilters {
  date_from?: string;
  date_to?: string;
  domains?: string[];
  browsers?: string[];
  topics?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: SearchResultItem[];
  created_at: string;
}

export interface Conversation {
  id: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface TimelinePage {
  id: string;
  title?: string;
  domain: string;
  url: string;
  visited_at: string;
}

export interface TimelineSession {
  time: string;
  topic?: string;
  pages: TimelinePage[];
}

export interface TimelineGroup {
  date: string;
  sessions: TimelineSession[];
}

export interface TimelineResponse {
  groups: TimelineGroup[];
  has_more: boolean;
  cursor?: string;
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
  inferred_topic?: string;
  page_count: number;
  started_at: string;
  ended_at: string;
  pages: {
    title?: string;
    domain: string;
    url: string;
    visited_at: string;
  }[];
}

export interface BrowserConnection {
  id: string;
  browser_type: string;
  connection_name: string;
  is_active: boolean;
  is_paused: boolean;
  last_synced_at?: string;
  created_at: string;
}

export interface ExcludedDomain {
  id: string;
  domain_name: string;
  created_at: string;
}

export interface PrivacySettings {
  memory_active: boolean;
  excluded_domains: ExcludedDomain[];
}
