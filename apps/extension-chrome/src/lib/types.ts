/**
 * Recall Extension — Types
 *
 * Shared types for the browser extension.
 */

export interface BrowsingEventPayload {
  url: string;
  title: string;
  domain: string;
  visited_at: string;
  source_browser: 'chrome' | 'firefox' | 'safari' | 'brave' | 'edge';
  metadata?: PageMetadata;
}

export interface PageMetadata {
  search_query?: string;
  search_engine?: string;
  favicon_url?: string;
}

export interface QueuedEvent extends BrowsingEventPayload {
  queued_at: number;
}

export interface AuthState {
  access_token: string | null;
  refresh_token: string | null;
  connection_id: string | null;
  api_url: string;
  is_connected: boolean;
  is_paused: boolean;
}

export interface SyncStatus {
  last_synced_at: number | null;
  pending_count: number;
  is_syncing: boolean;
  last_error: string | null;
}

export interface StorageData {
  auth: AuthState;
  sync: SyncStatus;
  queue: QueuedEvent[];
  excluded_domains: string[];
}
