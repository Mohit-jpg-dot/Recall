// ─────────────────────────────────────────────
// Recall — Shared Types: Search
// ─────────────────────────────────────────────

export interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface SearchFilters {
  date_from?: string;
  date_to?: string;
  domains?: string[];
  browsers?: string[];
  topics?: string[];
}

export interface SearchResult {
  id: string;
  url: string;
  title: string;
  domain: string;
  domain_favicon?: string;
  visited_at: string;
  source_browser: string;
  relevance_score: number;
  match_reasons: MatchReason[];
  related_pages?: RelatedPage[];
}

export interface MatchReason {
  type: 'semantic' | 'keyword' | 'temporal' | 'session' | 'domain';
  description: string;
}

export interface RelatedPage {
  title: string;
  domain: string;
  url: string;
  visited_at: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  took_ms: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SearchResult[];
  created_at: string;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface Conversation {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}
