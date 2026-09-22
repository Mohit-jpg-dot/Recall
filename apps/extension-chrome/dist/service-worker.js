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
  const { queue = [] } = await chrome.storage.local.get(STORAGE_KEY);
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
  await chrome.storage.local.set({ [STORAGE_KEY]: queue });
  return true;
}
async function getQueue() {
  const { queue = [] } = await chrome.storage.local.get(STORAGE_KEY);
  return queue;
}
async function dequeue(count) {
  const { queue = [] } = await chrome.storage.local.get(STORAGE_KEY);
  const remaining = queue.slice(count);
  await chrome.storage.local.set({ [STORAGE_KEY]: remaining });
}
async function getQueueSize() {
  const { queue = [] } = await chrome.storage.local.get(STORAGE_KEY);
  return queue.length;
}
const BATCH_SIZE = 20;
async function getAuth() {
  const { auth } = await chrome.storage.local.get("auth");
  return auth || null;
}
async function updateSyncStatus(update) {
  const { sync = {} } = await chrome.storage.local.get("sync");
  await chrome.storage.local.set({
    sync: { ...sync, ...update }
  });
}
async function sendBatch(events, auth) {
  const response = await fetch(`${auth.api_url}/api/events/batch`, {
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
      const retryResponse = await fetch(`${auth.api_url}/api/events/batch`, {
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
        throw new Error(`API error: ${retryResponse.status}`);
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
    const response = await fetch(`${auth.api_url}/api/auth/refresh`, {
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
    await chrome.storage.local.set({ auth: updatedAuth });
    return updatedAuth;
  } catch {
    return null;
  }
}
async function processQueue() {
  const auth = await getAuth();
  if (!(auth == null ? void 0 : auth.is_connected) || auth.is_paused || !auth.access_token) {
    return;
  }
  const queue = await getQueue();
  if (queue.length === 0) {
    return;
  }
  await updateSyncStatus({ is_syncing: true, last_error: null });
  let totalSent = 0;
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
    const result = await sendBatch(payloads, auth);
    totalSent = result.accepted + result.rejected;
    await dequeue(eventsToSend.length);
    await updateSyncStatus({
      is_syncing: false,
      last_synced_at: Date.now(),
      pending_count: Math.max(0, queue.length - eventsToSend.length)
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateSyncStatus({
      is_syncing: false,
      last_error: errorMessage,
      pending_count: queue.length
    });
    console.error("[Recall] Sync error:", errorMessage);
  }
}
const SYNC_ALARM_NAME = "recall-sync";
const SYNC_INTERVAL_MINUTES = 0.5;
const BATCH_TRIGGER_SIZE = 20;
chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: SYNC_INTERVAL_MINUTES
  });
  if (details.reason === "install") {
    const { auth } = await chrome.storage.local.get("auth");
    if (!auth) {
      const defaultAuth = {
        access_token: null,
        refresh_token: null,
        connection_id: null,
        api_url: "http://localhost:8000",
        is_connected: false,
        is_paused: false
      };
      await chrome.storage.local.set({
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
  console.log("[Recall] Extension installed/updated");
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  if (!tab.url || !tab.title) return;
  const { auth, excluded_domains = [] } = await chrome.storage.local.get([
    "auth",
    "excluded_domains"
  ]);
  if (!(auth == null ? void 0 : auth.is_connected) || auth.is_paused) return;
  const domain = extractDomain(tab.url);
  if (!domain) return;
  if (shouldExclude(tab.url, domain, excluded_domains)) return;
  const searchResult = extractSearchQuery(tab.url);
  const event = {
    url: tab.url,
    title: tab.title,
    domain,
    visited_at: (/* @__PURE__ */ new Date()).toISOString(),
    source_browser: "chrome",
    queued_at: Date.now(),
    metadata: searchResult ? { search_query: searchResult.query, search_engine: searchResult.engine } : void 0
  };
  const wasQueued = await enqueue(event);
  if (wasQueued) {
    const queueSize = await getQueueSize();
    await chrome.action.setBadgeText({ text: queueSize > 0 ? String(queueSize) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#6366F1" });
    if (queueSize >= BATCH_TRIGGER_SIZE) {
      await processQueue();
      const newSize = await getQueueSize();
      await chrome.action.setBadgeText({ text: newSize > 0 ? String(newSize) : "" });
    }
  }
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    await processQueue();
    const queueSize = await getQueueSize();
    await chrome.action.setBadgeText({ text: queueSize > 0 ? String(queueSize) : "" });
  }
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "GET_STATUS": {
        const { auth, sync, queue = [] } = await chrome.storage.local.get([
          "auth",
          "sync",
          "queue"
        ]);
        sendResponse({
          auth,
          sync: { ...sync, pending_count: queue.length }
        });
        break;
      }
      case "FORCE_SYNC": {
        await processQueue();
        const { sync, queue = [] } = await chrome.storage.local.get(["sync", "queue"]);
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
        await chrome.storage.local.set({ auth });
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
        await chrome.storage.local.set({ auth: defaultAuth, queue: [] });
        await chrome.action.setBadgeText({ text: "" });
        sendResponse({ success: true });
        break;
      }
      case "TOGGLE_PAUSE": {
        const { auth: currentAuth } = await chrome.storage.local.get("auth");
        if (currentAuth) {
          currentAuth.is_paused = !currentAuth.is_paused;
          await chrome.storage.local.set({ auth: currentAuth });
          sendResponse({ is_paused: currentAuth.is_paused });
        }
        break;
      }
      case "UPDATE_EXCLUDED_DOMAINS": {
        await chrome.storage.local.set({ excluded_domains: message.payload.domains });
        sendResponse({ success: true });
        break;
      }
      default:
        sendResponse({ error: "Unknown message type" });
    }
  })();
  return true;
});
