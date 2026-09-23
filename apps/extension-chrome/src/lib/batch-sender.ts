/**
 * Recall Extension — Batch Sender
 *
 * Sends queued events to the Recall API in batches.
 * Handles network failures with exponential backoff and timeout protection.
 * Supports Chrome, Firefox, and Safari extensions.
 */

import { browserAPI } from './browser-api';
import { getQueue, dequeue } from './queue-manager';
import type { AuthState, SyncStatus, BrowsingEventPayload } from './types';

const BATCH_SIZE = 25;
const REQUEST_TIMEOUT_MS = 10_000; // 10 seconds timeout

// Exponential backoff state in memory
let consecutiveFailures = 0;
let nextAllowedRetryTimestamp = 0;

/**
 * Get current auth state from storage.
 */
async function getAuth(): Promise<AuthState | null> {
  const { auth } = await browserAPI.storage.local.get('auth') as { auth?: AuthState };
  return auth || null;
}

/**
 * Update sync status in storage.
 */
async function updateSyncStatus(update: Partial<SyncStatus>): Promise<void> {
  const { sync = {} } = await browserAPI.storage.local.get('sync') as { sync?: Partial<SyncStatus> };
  await browserAPI.storage.local.set({
    sync: { ...sync, ...update },
  });
}

/**
 * Fetch with configurable timeout.
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a batch of events to the API.
 */
async function sendBatch(
  events: BrowsingEventPayload[],
  auth: AuthState
): Promise<{ accepted: number; rejected: number }> {
  const response = await fetchWithTimeout(`${auth.api_url}/api/events/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.access_token}`,
    },
    body: JSON.stringify({
      events,
      connection_id: auth.connection_id,
    }),
  });

  if (response.status === 401) {
    // Token expired — attempt refresh
    const refreshed = await refreshAccessToken(auth);
    if (refreshed) {
      const retryResponse = await fetchWithTimeout(`${auth.api_url}/api/events/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshed.access_token}`,
        },
        body: JSON.stringify({
          events,
          connection_id: auth.connection_id,
        }),
      });

      if (!retryResponse.ok) {
        throw new Error(`API error after refresh: ${retryResponse.status}`);
      }
      return retryResponse.json();
    }
    throw new Error('Token refresh failed');
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Refresh the access token using the refresh token.
 */
async function refreshAccessToken(auth: AuthState): Promise<AuthState | null> {
  try {
    const response = await fetchWithTimeout(`${auth.api_url}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refresh_token }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const updatedAuth: AuthState = {
      ...auth,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    };

    await browserAPI.storage.local.set({ auth: updatedAuth });
    return updatedAuth;
  } catch {
    return null;
  }
}

/**
 * Process the queue: send events in batches with backoff.
 */
export async function processQueue(): Promise<void> {
  // Check online status if available
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  const now = Date.now();
  if (now < nextAllowedRetryTimestamp) {
    // Waiting for backoff cooldown
    return;
  }

  const auth = await getAuth();
  if (!auth?.is_connected || auth.is_paused || !auth.access_token) {
    return;
  }

  const queue = await getQueue();
  if (queue.length === 0) {
    return;
  }

  await updateSyncStatus({ is_syncing: true, last_error: null });

  try {
    // Process top batch
    const eventsToSend = queue.slice(0, BATCH_SIZE);
    const payloads: BrowsingEventPayload[] = eventsToSend.map((e) => ({
      url: e.url,
      title: e.title,
      domain: e.domain,
      visited_at: e.visited_at,
      source_browser: e.source_browser,
      metadata: e.metadata,
    }));

    await sendBatch(payloads, auth);
    await dequeue(eventsToSend.length);

    // Reset failure counter on success
    consecutiveFailures = 0;
    nextAllowedRetryTimestamp = 0;

    await updateSyncStatus({
      is_syncing: false,
      last_synced_at: Date.now(),
      pending_count: Math.max(0, queue.length - eventsToSend.length),
    });
  } catch (error) {
    consecutiveFailures += 1;
    // Exponential backoff: 2s, 4s, 8s, 16s, up to 60s max with jitter
    const baseDelay = Math.min(60_000, 2000 * Math.pow(2, Math.min(consecutiveFailures, 5)));
    const jitter = Math.floor(Math.random() * 1000);
    nextAllowedRetryTimestamp = Date.now() + baseDelay + jitter;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateSyncStatus({
      is_syncing: false,
      last_error: errorMessage,
      pending_count: queue.length,
    });

    console.warn(`[Recall] Sync error (attempt ${consecutiveFailures}, backoff ${baseDelay}ms):`, errorMessage);
  }
}
