/**
 * Recall Extension — Queue Manager
 *
 * Manages the local event queue in chrome.storage.local.
 * - Persists events for offline resilience
 * - Caps queue size to prevent memory bloat
 * - Provides deduplication within the queue
 */

import { browserAPI } from './browser-api';
import type { QueuedEvent } from './types';

const STORAGE_KEY = 'queue';
const MAX_QUEUE_SIZE = 500;
const DEDUP_WINDOW_MS = 30_000; // 30 seconds

/**
 * Add an event to the queue.
 * Returns false if the event was deduplicated.
 */
export async function enqueue(event: QueuedEvent): Promise<boolean> {
  const { queue = [] } = await browserAPI.storage.local.get(STORAGE_KEY) as { queue?: QueuedEvent[] };

  // Deduplication: skip if same URL visited within 30s
  const isDuplicate = queue.some(
    (existing) =>
      existing.url === event.url &&
      Math.abs(existing.queued_at - event.queued_at) < DEDUP_WINDOW_MS
  );

  if (isDuplicate) {
    return false;
  }

  // Add to queue
  queue.push(event);

  // Cap queue size — drop oldest if exceeded
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }

  await browserAPI.storage.local.set({ [STORAGE_KEY]: queue });
  return true;
}

/**
 * Get all queued events.
 */
export async function getQueue(): Promise<QueuedEvent[]> {
  const { queue = [] } = await browserAPI.storage.local.get(STORAGE_KEY) as { queue?: QueuedEvent[] };
  return queue;
}

/**
 * Remove sent events from the queue.
 * Only removes events that were queued before the cutoff time.
 */
export async function dequeue(count: number): Promise<void> {
  const { queue = [] } = await browserAPI.storage.local.get(STORAGE_KEY) as { queue?: QueuedEvent[] };
  const remaining = queue.slice(count);
  await browserAPI.storage.local.set({ [STORAGE_KEY]: remaining });
}

/**
 * Get the current queue size.
 */
export async function getQueueSize(): Promise<number> {
  const { queue = [] } = await browserAPI.storage.local.get(STORAGE_KEY) as { queue?: QueuedEvent[] };
  return queue.length;
}

/**
 * Clear the entire queue.
 */
export async function clearQueue(): Promise<void> {
  await browserAPI.storage.local.set({ [STORAGE_KEY]: [] });
}
