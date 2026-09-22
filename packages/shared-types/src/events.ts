// ─────────────────────────────────────────────
// Recall — Shared Types: Browsing Events
// ─────────────────────────────────────────────

/** A single browsing event sent from the extension to the API */
export interface BrowsingEventPayload {
  url: string;
  title: string;
  domain: string;
  visited_at: string; // ISO 8601
  source_browser: 'chrome' | 'firefox' | 'safari';
  metadata?: PageMetadata;
}

/** Batch of events sent to POST /api/events/batch */
export interface BatchEventsRequest {
  events: BrowsingEventPayload[];
  connection_id: string;
}

export interface BatchEventsResponse {
  accepted: number;
  rejected: number;
  errors?: string[];
}

/** Metadata extracted from page */
export interface PageMetadata {
  description?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  favicon_url?: string;
  search_query?: string;
  search_engine?: string;
}

/** A memory (page + visit info) returned from the API */
export interface Memory {
  id: string;
  url: string;
  title: string;
  domain: string;
  domain_favicon?: string;
  visited_at: string;
  source_browser: string;
  visit_count: number;
  topics?: string[];
  session_id?: string;
}

/** Timeline entry grouped by time */
export interface TimelineGroup {
  date: string;
  sessions: TimelineSession[];
}

export interface TimelineSession {
  time: string;
  topic?: string;
  pages: TimelinePage[];
}

export interface TimelinePage {
  id: string;
  title: string;
  domain: string;
  url: string;
  visited_at: string;
}
