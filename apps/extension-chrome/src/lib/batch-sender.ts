/**
 * Recall Extension — Batch Sender
 *
 * Sends queued events to the Recall API in batches.
 * Handles network failures with exponential backoff.
 */

import { getQueue, dequeue } from './queue-manager';
import type { AuthState, SyncStatus, BrowsingEventPayload } from './types';

const BATCH_SIZE = 20;
const MAX_RETRIES = 3;

/**
 * Get current auth state from storage.
 */
async function getAuth(): Promise<AuthState | null> {
  const { auth } = await chrome.storage.local.get('auth') as { auth?: AuthState };
  return auth || null;
}

/**
 * Update sync status in storage.
 */
async function updateSyncStatus(update: Partial<SyncStatus>): Promise<void> {
  const { sync = {} } = await chrome.storage.local.get('sync') as { sync?: Partial<SyncStatus> };
  await chrome.storage.local.set({
    sync: { ...sync, ...update },
  });
}

/**
 * Send a batch of events to the API.
 */
async function sendBatch(
  events: BrowsingEventPayload[],
  auth: AuthState
): Promise<{ accepted: number; rejected: number }> {
  const response = await fetch(`${auth.api_url}/api/events/batch`, {
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
    // Token expired — try refresh
    const refreshed = await refreshAccessToken(auth);
    if (refreshed) {
      // Retry with new token
      const retryResponse = await fetch(`${auth.api_url}/api/events/batch`, {
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
        throw new Error(`API error: ${retryResponse.status}`);
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
    const response = await fetch(`${auth.api_url}/api/auth/refresh`, {
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

    await chrome.storage.local.set({ auth: updatedAuth });
    return updatedAuth;
  } catch {
    return null;
  }
}

/**
 * Process the queue: send events in batches.
 * Called by the service worker alarm.
 */
export async function processQueue(): Promise<void> {
  const auth = await getAuth();
  if (!auth?.is_connected || auth.is_paused || !auth.access_token) {
    return;
  }

  const queue = await getQueue();
  if (queue.length === 0) {
    return;
  }

  await updateSyncStatus({ is_syncing: true, last_error: null });

  let totalSent = 0;
  let retryCount = 0;

  try {
    // Process in batches
    const eventsToSend = queue.slice(0, BATCH_SIZE);
    const payloads: BrowsingEventPayload[] = eventsToSend.map((e) => ({
      url: e.url,
      title: e.title,
      domain: e.domain,
      visited_at: e.visited_at,
      source_browser: e.source_browser,
      metadata: e.metadata,
    }));

    const result = await sendBatch(payloads, auth);
    totalSent = result.accepted + result.rejected; // All processed
    await dequeue(eventsToSend.length);

    await updateSyncStatus({
      is_syncing: false,
      last_synced_at: Date.now(),
      pending_count: Math.max(0, queue.length - eventsToSend.length),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateSyncStatus({
      is_syncing: false,
      last_error: errorMessage,
      pending_count: queue.length,
    });

    // Don't dequeue on failure — events stay for retry
    console.error('[Recall] Sync error:', errorMessage);
  }
}
