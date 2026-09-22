/**
 * Recall Extension — Service Worker
 *
 * MV3 service worker that:
 * 1. Observes tab navigation events (lightweight)
 * 2. Filters through privacy rules
 * 3. Queues events locally in chrome.storage
 * 4. Periodically batch-sends to the Recall API via alarm
 *
 * NO state in global variables — everything in chrome.storage.
 * NO AI processing — that happens on the backend.
 */

import { shouldExclude, extractDomain, extractSearchQuery } from './lib/privacy-filter';
import { enqueue, getQueueSize } from './lib/queue-manager';
import { processQueue } from './lib/batch-sender';
import type { AuthState, QueuedEvent } from './lib/types';

// ── Constants ───────────────────────────────────

const SYNC_ALARM_NAME = 'recall-sync';
const SYNC_INTERVAL_MINUTES = 0.5; // 30 seconds
const BATCH_TRIGGER_SIZE = 20;

// ── Installation / Setup ────────────────────────

chrome.runtime.onInstalled.addListener(async (details) => {
  // Set up periodic sync alarm
  await chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });

  // Initialize storage defaults if fresh install
  if (details.reason === 'install') {
    const { auth } = await chrome.storage.local.get('auth');
    if (!auth) {
      const defaultAuth: AuthState = {
        access_token: null,
        refresh_token: null,
        connection_id: null,
        api_url: 'http://localhost:8000',
        is_connected: false,
        is_paused: false,
      };
      await chrome.storage.local.set({
        auth: defaultAuth,
        queue: [],
        sync: {
          last_synced_at: null,
          pending_count: 0,
          is_syncing: false,
          last_error: null,
        },
        excluded_domains: [],
      });
    }
  }

  console.log('[Recall] Extension installed/updated');
});

// ── Tab Navigation Observer ─────────────────────
// This is the core event collection — lightweight metadata only

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when page finishes loading (not every partial update)
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !tab.title) return;

  // Read state from storage (not global vars)
  const { auth, excluded_domains = [] } = await chrome.storage.local.get([
    'auth',
    'excluded_domains',
  ]) as { auth?: AuthState; excluded_domains?: string[] };

  // Skip if not connected or paused
  if (!auth?.is_connected || auth.is_paused) return;

  const domain = extractDomain(tab.url);
  if (!domain) return;

  // Privacy filter
  if (shouldExclude(tab.url, domain, excluded_domains)) return;

  // Build lightweight event payload
  const searchResult = extractSearchQuery(tab.url);
  const event: QueuedEvent = {
    url: tab.url,
    title: tab.title,
    domain,
    visited_at: new Date().toISOString(),
    source_browser: 'chrome',
    queued_at: Date.now(),
    metadata: searchResult
      ? { search_query: searchResult.query, search_engine: searchResult.engine }
      : undefined,
  };

  const wasQueued = await enqueue(event);

  if (wasQueued) {
    // Update badge with pending count
    const queueSize = await getQueueSize();
    await chrome.action.setBadgeText({ text: queueSize > 0 ? String(queueSize) : '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#6366F1' });

    // Trigger immediate sync if batch threshold reached
    if (queueSize >= BATCH_TRIGGER_SIZE) {
      await processQueue();
      const newSize = await getQueueSize();
      await chrome.action.setBadgeText({ text: newSize > 0 ? String(newSize) : '' });
    }
  }
});

// ── Periodic Sync Alarm ─────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    await processQueue();
    const queueSize = await getQueueSize();
    await chrome.action.setBadgeText({ text: queueSize > 0 ? String(queueSize) : '' });
  }
});

// ── Message Handler (popup communication) ───────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'GET_STATUS': {
        const { auth, sync, queue = [] } = await chrome.storage.local.get([
          'auth', 'sync', 'queue',
        ]);
        sendResponse({
          auth,
          sync: { ...sync, pending_count: queue.length },
        });
        break;
      }

      case 'FORCE_SYNC': {
        await processQueue();
        const { sync, queue = [] } = await chrome.storage.local.get(['sync', 'queue']);
        sendResponse({ sync: { ...sync, pending_count: queue.length } });
        break;
      }

      case 'LOGIN': {
        const { access_token, refresh_token, connection_id, api_url } = message.payload;
        const auth: AuthState = {
          access_token,
          refresh_token,
          connection_id,
          api_url: api_url || 'http://localhost:8000',
          is_connected: true,
          is_paused: false,
        };
        await chrome.storage.local.set({ auth });
        sendResponse({ success: true });
        break;
      }

      case 'LOGOUT': {
        const defaultAuth: AuthState = {
          access_token: null,
          refresh_token: null,
          connection_id: null,
          api_url: 'http://localhost:8000',
          is_connected: false,
          is_paused: false,
        };
        await chrome.storage.local.set({ auth: defaultAuth, queue: [] });
        await chrome.action.setBadgeText({ text: '' });
        sendResponse({ success: true });
        break;
      }

      case 'TOGGLE_PAUSE': {
        const { auth: currentAuth } = await chrome.storage.local.get('auth') as { auth?: AuthState };
        if (currentAuth) {
          currentAuth.is_paused = !currentAuth.is_paused;
          await chrome.storage.local.set({ auth: currentAuth });
          sendResponse({ is_paused: currentAuth.is_paused });
        }
        break;
      }

      case 'UPDATE_EXCLUDED_DOMAINS': {
        await chrome.storage.local.set({ excluded_domains: message.payload.domains });
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true; // Keep channel open for async response
});
