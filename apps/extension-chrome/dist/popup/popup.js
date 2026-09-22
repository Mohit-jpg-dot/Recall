const loginView = document.getElementById("login-view");
const connectedView = document.getElementById("connected-view");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");
const apiUrlInput = document.getElementById("api-url");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const connectionStatus = document.getElementById("connection-status");
const lastSynced = document.getElementById("last-synced");
const pendingCount = document.getElementById("pending-count");
const syncError = document.getElementById("sync-error");
const syncErrorText = document.getElementById("sync-error-text");
const syncBtn = document.getElementById("sync-btn");
const pauseBtn = document.getElementById("pause-btn");
const openRecall = document.getElementById("open-recall");
const disconnectBtn = document.getElementById("disconnect-btn");
async function init() {
  var _a;
  const response = await sendMessage({ type: "GET_STATUS" });
  if ((_a = response == null ? void 0 : response.auth) == null ? void 0 : _a.is_connected) {
    showConnectedView(response.auth, response.sync);
  } else {
    showLoginView();
  }
}
function showLoginView() {
  loginView.hidden = false;
  connectedView.hidden = true;
}
function showConnectedView(auth, sync) {
  loginView.hidden = true;
  connectedView.hidden = false;
  const dot = connectionStatus.querySelector(".status-dot");
  if (auth.is_paused) {
    dot.className = "status-dot paused";
    connectionStatus.childNodes[1].textContent = " Paused";
    pauseBtn.textContent = "Resume";
  } else {
    dot.className = "status-dot connected";
    connectionStatus.childNodes[1].textContent = " Connected";
    pauseBtn.textContent = "Pause";
  }
  if (sync.last_synced_at) {
    const ago = formatTimeAgo(sync.last_synced_at);
    lastSynced.textContent = ago;
  } else {
    lastSynced.textContent = "Never";
  }
  pendingCount.textContent = `${sync.pending_count} event${sync.pending_count !== 1 ? "s" : ""}`;
  if (sync.last_error) {
    syncError.hidden = false;
    syncErrorText.textContent = sync.last_error;
  } else {
    syncError.hidden = true;
  }
  openRecall.href = "http://localhost:5173/app";
}
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  loginBtn.textContent = "Connecting...";
  loginBtn.disabled = true;
  const apiUrl = apiUrlInput.value.replace(/\/$/, "");
  const email = emailInput.value;
  const password = passwordInput.value;
  try {
    const loginResponse = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(error.detail || "Login failed");
    }
    const loginData = await loginResponse.json();
    const connectResponse = await fetch(`${apiUrl}/api/browsers/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginData.access_token}`
      },
      body: JSON.stringify({
        browser_type: "chrome",
        connection_name: "Chrome Browser"
      })
    });
    if (!connectResponse.ok) {
      throw new Error("Failed to register browser connection");
    }
    const connectionData = await connectResponse.json();
    await sendMessage({
      type: "LOGIN",
      payload: {
        access_token: loginData.access_token,
        refresh_token: loginData.refresh_token,
        connection_id: connectionData.id,
        api_url: apiUrl
      }
    });
    const privacyResponse = await fetch(`${apiUrl}/api/privacy`, {
      headers: { Authorization: `Bearer ${loginData.access_token}` }
    });
    if (privacyResponse.ok) {
      const privacy = await privacyResponse.json();
      await sendMessage({
        type: "UPDATE_EXCLUDED_DOMAINS",
        payload: { domains: privacy.excluded_domains.map((d) => d.domain_name) }
      });
    }
    const status = await sendMessage({ type: "GET_STATUS" });
    showConnectedView(status.auth, status.sync);
  } catch (error) {
    loginError.textContent = error instanceof Error ? error.message : "Connection failed";
    loginError.hidden = false;
  } finally {
    loginBtn.textContent = "Connect Browser";
    loginBtn.disabled = false;
  }
});
syncBtn.addEventListener("click", async () => {
  syncBtn.textContent = "Syncing...";
  syncBtn.disabled = true;
  await sendMessage({ type: "FORCE_SYNC" });
  const status = await sendMessage({ type: "GET_STATUS" });
  showConnectedView(status.auth, status.sync);
  syncBtn.textContent = "Sync Now";
  syncBtn.disabled = false;
});
pauseBtn.addEventListener("click", async () => {
  await sendMessage({ type: "TOGGLE_PAUSE" });
  const status = await sendMessage({ type: "GET_STATUS" });
  showConnectedView(status.auth, status.sync);
});
disconnectBtn.addEventListener("click", async () => {
  if (confirm("Disconnect this browser from Recall?")) {
    await sendMessage({ type: "LOGOUT" });
    showLoginView();
  }
});
openRecall.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: openRecall.href });
});
function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {});
    });
  });
}
function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1e3);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
init();
