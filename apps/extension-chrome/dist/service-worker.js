import { b as browserAPI, d as detectBrowserType } from "./chunks/browser-api.js";
function shouldExclude(url, domain, excludedDomains) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return true;
  }
  if (url === "about:blank" || url === "chrome://newtab/") {
    return true;
  }
  for (const excluded of excludedDomains) {
    if (domain === excluded || domain.endsWith("." + excluded)) {
      return true;
    }
  }
  return false;
}
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
function extractSearchQuery(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    const searchEngines = {
      google: { pattern: "google.com", param: "q" },
      bing: { pattern: "bing.com", param: "q" },
      duckduckgo: { pattern: "duckduckgo.com", param: "q" },
      yahoo: { pattern: "search.yahoo.com", param: "p" },
      youtube: { pattern: "youtube.com", param: "search_query" }
    };
    for (const [engine, config] of Object.entries(searchEngines)) {
      if (hostname.includes(config.pattern)) {
        const query = parsed.searchParams.get(config.param);
        if (query) {
          return { query, engine };
        }
      }
    }
  } catch {
  }
  return null;
}
const STORAGE_KEY = "queue";
const MAX_QUEUE_SIZE = 500;
const DEDUP_WINDOW_MS = 3e4;
async function enqueue(event) {
  const { queue = [] } = await browserAPI.storage.local.get(STORAGE_KEY);
  const isDuplicate = queue.some(
    (existing) => existing.url === event.url && Math.abs(existing.queued_at - event.queued_at) < DEDUP_WINDOW_MS
  );
  if (isDuplicate) {
    return false;
  }
  queue.push(event);
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }
  await browserAPI.storage.local.set({ [STORAGE_KEY]: queue });
  return true;
}
async function getQueue() {
  const { queue = [] } = await browserAPI.storage.local.get(STORAGE_KEY);
  return queue;
}
async function dequeue(count) {
  const { queue = [] } = await browserAPI.storage.local.get(STORAGE_KEY);
  const remaining = queue.slice(count);
  await browserAPI.storage.local.set({ [STORAGE_KEY]: remaining });
}
async function getQueueSize() {
  const { queue = [] } = await browserAPI.storage.local.get(STORAGE_KEY);
  return queue.length;
}
const BATCH_SIZE = 25;
const REQUEST_TIMEOUT_MS = 1e4;
let consecutiveFailures = 0;
let nextAllowedRetryTimestamp = 0;
async function getAuth() {
  const { auth } = await browserAPI.storage.local.get("auth");
  return auth || null;
}
async function updateSyncStatus(update) {
  const { sync = {} } = await browserAPI.storage.local.get("sync");
  await browserAPI.storage.local.set({
    sync: { ...sync, ...update }
  });
}
async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}
async function sendBatch(events, auth) {
  const response = await fetchWithTimeout(`${auth.api_url}/api/events/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.access_token}`
    },
    body: JSON.stringify({
      events,
      connection_id: auth.connection_id
    })
  });
  if (response.status === 401) {
    const refreshed = await refreshAccessToken(auth);
    if (refreshed) {
      const retryResponse = await fetchWithTimeout(`${auth.api_url}/api/events/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshed.access_token}`
        },
        body: JSON.stringify({
          events,
          connection_id: auth.connection_id
        })
      });
      if (!retryResponse.ok) {
        throw new Error(`API error after refresh: ${retryResponse.status}`);
      }
      return retryResponse.json();
    }
    throw new Error("Token refresh failed");
  }
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}
async function refreshAccessToken(auth) {
  try {
    const response = await fetchWithTimeout(`${auth.api_url}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: auth.refresh_token })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const updatedAuth = {
      ...auth,
      access_token: data.access_token,
      refresh_token: data.refresh_token
    };
    await browserAPI.storage.local.set({ auth: updatedAuth });
    return updatedAuth;
  } catch {
    return null;
  }
}
async function processQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }
  const now = Date.now();
  if (now < nextAllowedRetryTimestamp) {
    return;
  }
  const auth = await getAuth();
  if (!(auth == null ? void 0 : auth.is_connected) || auth.is_paused || !auth.access_token) {
    return;
  }
  const queue = await getQueue();
  if (queue.length === 0) {
    return;
  }
  await updateSyncStatus({ is_syncing: true, last_error: null });
  try {
    const eventsToSend = queue.slice(0, BATCH_SIZE);
    const payloads = eventsToSend.map((e) => ({
      url: e.url,
      title: e.title,
      domain: e.domain,
      visited_at: e.visited_at,
      source_browser: e.source_browser,
      metadata: e.metadata
    }));
    await sendBatch(payloads, auth);
    await dequeue(eventsToSend.length);
    consecutiveFailures = 0;
    nextAllowedRetryTimestamp = 0;
    await updateSyncStatus({
      is_syncing: false,
      last_synced_at: Date.now(),
      pending_count: Math.max(0, queue.length - eventsToSend.length)
    });
  } catch (error) {
    consecutiveFailures += 1;
    const baseDelay = Math.min(6e4, 2e3 * Math.pow(2, Math.min(consecutiveFailures, 5)));
    const jitter = Math.floor(Math.random() * 1e3);
    nextAllowedRetryTimestamp = Date.now() + baseDelay + jitter;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateSyncStatus({
      is_syncing: false,
      last_error: errorMessage,
      pending_count: queue.length
    });
    console.warn(`[Recall] Sync error (attempt ${consecutiveFailures}, backoff ${baseDelay}ms):`, errorMessage);
  }
}
const SYNC_ALARM_NAME = "recall-sync";
const SYNC_INTERVAL_MINUTES = 0.5;
const BATCH_TRIGGER_SIZE = 20;
browserAPI.runtime.onInstalled.addListener(async (details) => {
  await browserAPI.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES
  });
  if (details.reason === "install") {
    const { auth } = await browserAPI.storage.local.get("auth");
    if (!auth) {
      const defaultAuth = {
        access_token: null,
        refresh_token: null,
        connection_id: null,
        api_url: "http://localhost:8000",
        is_connected: false,
        is_paused: false
      };
      await browserAPI.storage.local.set({
        auth: defaultAuth,
        queue: [],
        sync: {
          last_synced_at: null,
          pending_count: 0,
          is_syncing: false,
          last_error: null
        },
        excluded_domains: []
      });
    }
  }
  console.log(`[Recall] Extension installed/updated on ${detectBrowserType()}`);
});
browserAPI.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  var _a, _b;
  if (changeInfo.status !== "complete") return;
  if (!tab.url || !tab.title) return;
  const { auth, excluded_domains = [] } = await browserAPI.storage.local.get([
    "auth",
    "excluded_domains"
  ]);
  if (!(auth == null ? void 0 : auth.is_connected) || auth.is_paused) return;
  const domain = extractDomain(tab.url);
  if (!domain) return;
  if (shouldExclude(tab.url, domain, excluded_domains)) return;
  const searchResult = extractSearchQuery(tab.url);
  const browserType = detectBrowserType();
  const event = {
    url: tab.url,
    title: tab.title,
    domain,
    visited_at: (/* @__PURE__ */ new Date()).toISOString(),
    source_browser: browserType,
    queued_at: Date.now(),
    metadata: searchResult ? { search_query: searchResult.query, search_engine: searchResult.engine } : void 0
  };
  const wasQueued = await enqueue(event);
  if (wasQueued) {
    try {
      const queueSize = await getQueueSize();
      if ((_a = browserAPI.action) == null ? void 0 : _a.setBadgeText) {
        await browserAPI.action.setBadgeText({ text: queueSize > 0 ? String(queueSize) : "" });
        await browserAPI.action.setBadgeBackgroundColor({ color: "#6366F1" });
      }
      if (queueSize >= BATCH_TRIGGER_SIZE) {
        await processQueue();
        const newSize = await getQueueSize();
        if ((_b = browserAPI.action) == null ? void 0 : _b.setBadgeText) {
          await browserAPI.action.setBadgeText({ text: newSize > 0 ? String(newSize) : "" });
        }
      }
    } catch {
    }
  }
});
browserAPI.alarms.onAlarm.addListener(async (alarm) => {
  var _a;
  if (alarm.name === SYNC_ALARM_NAME) {
    await processQueue();
    try {
      const queueSize = await getQueueSize();
      if ((_a = browserAPI.action) == null ? void 0 : _a.setBadgeText) {
        await browserAPI.action.setBadgeText({ text: queueSize > 0 ? String(queueSize) : "" });
      }
    } catch {
    }
  }
});
browserAPI.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    var _a;
    switch (message.type) {
      case "GET_STATUS": {
        const { auth, sync, queue = [] } = await browserAPI.storage.local.get([
          "auth",
          "sync",
          "queue"
        ]);
        sendResponse({
          auth,
          sync: { ...sync, pending_count: queue.length },
          browser: detectBrowserType()
        });
        break;
      }
      case "FORCE_SYNC": {
        await processQueue();
        const { sync, queue = [] } = await browserAPI.storage.local.get(["sync", "queue"]);
        sendResponse({ sync: { ...sync, pending_count: queue.length } });
        break;
      }
      case "LOGIN": {
        const { access_token, refresh_token, connection_id, api_url } = message.payload;
        const auth = {
          access_token,
          refresh_token,
          connection_id,
          api_url: api_url || "http://localhost:8000",
          is_connected: true,
          is_paused: false
        };
        await browserAPI.storage.local.set({ auth });
        sendResponse({ success: true });
        break;
      }
      case "LOGOUT": {
        const defaultAuth = {
          access_token: null,
          refresh_token: null,
          connection_id: null,
          api_url: "http://localhost:8000",
          is_connected: false,
          is_paused: false
        };
        await browserAPI.storage.local.set({ auth: defaultAuth, queue: [] });
        if ((_a = browserAPI.action) == null ? void 0 : _a.setBadgeText) {
          await browserAPI.action.setBadgeText({ text: "" });
        }
        sendResponse({ success: true });
        break;
      }
      case "TOGGLE_PAUSE": {
        const { auth: currentAuth } = await browserAPI.storage.local.get("auth");
        if (currentAuth) {
          currentAuth.is_paused = !currentAuth.is_paused;
          await browserAPI.storage.local.set({ auth: currentAuth });
          sendResponse({ is_paused: currentAuth.is_paused });
        }
        break;
      }
      case "UPDATE_EXCLUDED_DOMAINS": {
        await browserAPI.storage.local.set({ excluded_domains: message.payload.domains });
        sendResponse({ success: true });
        break;
      }
      default:
        sendResponse({ error: "Unknown message type" });
    }
  })();
  return true;
});
