/**
 * Recall Extension — Service Worker / Background Script
 *
 * MV3 service worker / background script that:
 * 1. Observes tab navigation events (lightweight metadata only)
 * 2. Filters through privacy rules and excluded domains
 * 3. Queues events locally in browser.storage
 * 4. Periodically batch-sends to the Recall API via alarm
 *
 * Multi-browser support: Chrome, Firefox, and Safari.
 * NO state in global variables — everything in storage.
 * NO heavy DOM scraping — ultra-lightweight.
 */

import { browserAPI, detectBrowserType } from './lib/browser-api';
import { shouldExclude, extractDomain, extractSearchQuery } from './lib/privacy-filter';
import { enqueue, getQueueSize } from './lib/queue-manager';
import { processQueue } from './lib/batch-sender';
import type { AuthState, QueuedEvent } from './lib/types';

// ── Constants ───────────────────────────────────

const SYNC_ALARM_NAME = 'recall-sync';
const SYNC_INTERVAL_MINUTES = 0.5; // 30 seconds
const BATCH_TRIGGER_SIZE = 20;

// ── Installation / Setup ────────────────────────

browserAPI.runtime.onInstalled.addListener(async (details) => {
  // Set up periodic sync alarm
  await browserAPI.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });

  // Initialize storage defaults if missing
  const { auth } = await browserAPI.storage.local.get('auth');
  if (!auth) {
    const defaultAuth: AuthState = {
      access_token: null,
      refresh_token: null,
      connection_id: null,
      api_url: 'http://localhost:8000',
      is_connected: false,
      is_paused: false,
    };
    await browserAPI.storage.local.set({
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

  console.log(`[Recall] Extension installed/updated on ${detectBrowserType()}`);
});

// ── Tab Navigation Observer ─────────────────────

browserAPI.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when page finishes loading (not every partial update)
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !tab.title) return;

  // Read state from storage (not global vars)
  const { auth, excluded_domains = [] } = (await browserAPI.storage.local.get([
    'auth',
    'excluded_domains',
  ])) as { auth?: AuthState; excluded_domains?: string[] };

  // Skip if not connected or paused
  if (!auth?.is_connected || auth.is_paused) return;

  const domain = extractDomain(tab.url);
  if (!domain) return;

  // Privacy filter
  if (shouldExclude(tab.url, domain, excluded_domains)) return;

  // Build lightweight event payload
  const searchResult = extractSearchQuery(tab.url);
  const browserType = detectBrowserType();

  const event: QueuedEvent = {
    url: tab.url,
    title: tab.title,
    domain,
    visited_at: new Date().toISOString(),
    source_browser: browserType,
    queued_at: Date.now(),
    metadata: searchResult
      ? { search_query: searchResult.query, search_engine: searchResult.engine }
      : undefined,
  };

  const wasQueued = await enqueue(event);

  if (wasQueued) {
    // Update badge with pending count if action API is supported
    try {
      const queueSize = await getQueueSize();
      if (browserAPI.action?.setBadgeText) {
        await browserAPI.action.setBadgeText({ text: queueSize > 0 ? String(queueSize) : '' });
        await browserAPI.action.setBadgeBackgroundColor({ color: '#6366F1' });
      }

      // Trigger immediate sync if batch threshold reached
      if (queueSize >= BATCH_TRIGGER_SIZE) {
        await processQueue();
        const newSize = await getQueueSize();
        if (browserAPI.action?.setBadgeText) {
          await browserAPI.action.setBadgeText({ text: newSize > 0 ? String(newSize) : '' });
        }
      }
    } catch {
      // Ignore badge errors on browsers with different badge APIs
    }
  }
});

// ── Periodic Sync Alarm ─────────────────────────

browserAPI.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    await processQueue();
    try {
      const queueSize = await getQueueSize();
      if (browserAPI.action?.setBadgeText) {
        await browserAPI.action.setBadgeText({ text: queueSize > 0 ? String(queueSize) : '' });
      }
    } catch {
      // Ignore badge errors
    }
  }
});

// ── Message Handler (popup communication) ───────

browserAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'GET_STATUS': {
        const { auth, sync, queue = [] } = await browserAPI.storage.local.get([
          'auth',
          'sync',
          'queue',
        ]);
        sendResponse({
          auth,
          sync: { ...sync, pending_count: queue.length },
          browser: detectBrowserType(),
        });
        break;
      }

      case 'FORCE_SYNC': {
        await processQueue();
        const { sync, queue = [] } = await browserAPI.storage.local.get(['sync', 'queue']);
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
        await browserAPI.storage.local.set({ auth });
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
        await browserAPI.storage.local.set({ auth: defaultAuth, queue: [] });
        if (browserAPI.action?.setBadgeText) {
          await browserAPI.action.setBadgeText({ text: '' });
        }
        sendResponse({ success: true });
        break;
      }

      case 'TOGGLE_PAUSE': {
        const { auth: currentAuth } = (await browserAPI.storage.local.get('auth')) as {
          auth?: AuthState;
        };
        if (currentAuth) {
          currentAuth.is_paused = !currentAuth.is_paused;
          await browserAPI.storage.local.set({ auth: currentAuth });
          sendResponse({ is_paused: currentAuth.is_paused });
        }
        break;
      }

      case 'UPDATE_EXCLUDED_DOMAINS': {
        await browserAPI.storage.local.set({ excluded_domains: message.payload.domains });
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true; // Keep message channel open for async response
});
