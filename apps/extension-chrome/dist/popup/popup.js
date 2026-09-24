const browserAPI = typeof globalThis.browser !== "undefined" ? globalThis.browser : globalThis.chrome;
function detectBrowserType() {
  const ua = (typeof navigator !== "undefined" ? navigator.userAgent : "").toLowerCase();
  if (ua.includes("firefox")) return "firefox";
  if (ua.includes("edg/")) return "edge";
  if (typeof (navigator == null ? void 0 : navigator.brave) !== "undefined" || ua.includes("chrome") && typeof globalThis.brave !== "undefined") return "brave";
  if (ua.includes("safari") && !ua.includes("chrome")) return "safari";
  return "chrome";
}
const loginView = document.getElementById("login-view");
const connectedView = document.getElementById("connected-view");
const tabTokenBtn = document.getElementById("tab-token-btn");
const tabLoginBtn = document.getElementById("tab-login-btn");
const tokenForm = document.getElementById("token-form");
const tokenApiUrlInput = document.getElementById("token-api-url");
const pairingTokenInput = document.getElementById("pairing-token");
const connectionNameInput = document.getElementById("connection-name");
const tokenBtn = document.getElementById("token-btn");
const tokenError = document.getElementById("token-error");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");
const apiUrlInput = document.getElementById("api-url");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const browserTypeLabel = document.querySelector(".status-card .status-label");
const connectionStatus = document.getElementById("connection-status");
const connectionStatusText = document.getElementById("connection-status-text");
const lastSynced = document.getElementById("last-synced");
const pendingCount = document.getElementById("pending-count");
const syncError = document.getElementById("sync-error");
const syncErrorText = document.getElementById("sync-error-text");
const syncBtn = document.getElementById("sync-btn");
const pauseBtn = document.getElementById("pause-btn");
const openRecall = document.getElementById("open-recall");
const disconnectBtn = document.getElementById("disconnect-btn");
const detectedBrowser = detectBrowserType();
async function init() {
  var _a;
  const browserName = detectedBrowser.charAt(0).toUpperCase() + detectedBrowser.slice(1);
  if (connectionNameInput) {
    connectionNameInput.placeholder = `${browserName} Browser`;
  }
  if (browserTypeLabel) {
    browserTypeLabel.textContent = browserName;
  }
  const response = await sendMessage({ type: "GET_STATUS" });
  if ((_a = response == null ? void 0 : response.auth) == null ? void 0 : _a.is_connected) {
    showConnectedView(response.auth, response.sync);
  } else {
    showLoginView();
  }
}
if (tabTokenBtn && tabLoginBtn) {
  tabTokenBtn.addEventListener("click", () => {
    tabTokenBtn.classList.add("active");
    tabLoginBtn.classList.remove("active");
    tokenForm.hidden = false;
    loginForm.hidden = true;
    tokenError.hidden = true;
    loginError.hidden = true;
  });
  tabLoginBtn.addEventListener("click", () => {
    tabLoginBtn.classList.add("active");
    tabTokenBtn.classList.remove("active");
    loginForm.hidden = false;
    tokenForm.hidden = true;
    tokenError.hidden = true;
    loginError.hidden = true;
  });
}
function showLoginView() {
  loginView.hidden = false;
  connectedView.hidden = true;
}
function showConnectedView(auth, sync) {
  loginView.hidden = true;
  connectedView.hidden = false;
  const browserName = detectedBrowser.charAt(0).toUpperCase() + detectedBrowser.slice(1);
  if (browserTypeLabel) {
    browserTypeLabel.textContent = browserName;
  }
  const dot = connectionStatus.querySelector(".status-dot");
  if (auth.is_paused) {
    if (dot) dot.className = "status-dot paused";
    if (connectionStatusText) connectionStatusText.textContent = "Paused";
    pauseBtn.textContent = "Resume";
  } else {
    if (dot) dot.className = "status-dot connected";
    if (connectionStatusText) connectionStatusText.textContent = "Connected";
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
  const webUrl = auth.api_url && !auth.api_url.includes("localhost:8000") ? auth.api_url.replace(/api\./, "").replace(/\/$/, "") : "http://localhost:5173";
  openRecall.href = `${webUrl}/app`;
}
if (tokenForm) {
  tokenForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    tokenError.hidden = true;
    tokenBtn.textContent = "Pairing...";
    tokenBtn.disabled = true;
    const apiUrl = (tokenApiUrlInput.value.trim() || "http://localhost:8000").replace(/\/$/, "");
    const pairingToken = pairingTokenInput.value.trim();
    const browserName = detectedBrowser.charAt(0).toUpperCase() + detectedBrowser.slice(1);
    const connectionName = connectionNameInput.value.trim() || `${browserName} Browser`;
    try {
      const response = await fetch(`${apiUrl}/api/browsers/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pairing_token: pairingToken,
          browser_type: detectedBrowser,
          connection_name: connectionName
        })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Pairing failed (${response.status})`);
      }
      const pairData = await response.json();
      await sendMessage({
        type: "LOGIN",
        payload: {
          access_token: pairData.access_token,
          refresh_token: pairData.refresh_token,
          connection_id: pairData.connection_id,
          api_url: apiUrl
        }
      });
      try {
        const privacyResponse = await fetch(`${apiUrl}/api/privacy`, {
          headers: { Authorization: `Bearer ${pairData.access_token}` }
        });
        if (privacyResponse.ok) {
          const privacy = await privacyResponse.json();
          await sendMessage({
            type: "UPDATE_EXCLUDED_DOMAINS",
            payload: { domains: privacy.excluded_domains.map((d) => d.domain_name) }
          });
        }
      } catch (e2) {
        console.warn("Could not sync initial privacy settings:", e2);
      }
      const status = await sendMessage({ type: "GET_STATUS" });
      showConnectedView(status.auth, status.sync);
    } catch (error) {
      tokenError.textContent = error instanceof Error ? error.message : "Pairing failed";
      tokenError.hidden = false;
    } finally {
      tokenBtn.textContent = "Pair Extension";
      tokenBtn.disabled = false;
    }
  });
}
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    loginBtn.textContent = "Connecting...";
    loginBtn.disabled = true;
    const apiUrl = (apiUrlInput.value.trim() || "http://localhost:8000").replace(/\/$/, "");
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const browserName = detectedBrowser.charAt(0).toUpperCase() + detectedBrowser.slice(1);
    try {
      const loginResponse = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!loginResponse.ok) {
        const error = await loginResponse.json().catch(() => ({}));
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
          browser_type: detectedBrowser,
          connection_name: `${browserName} Browser`
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
      try {
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
      } catch (e2) {
        console.warn("Could not sync privacy settings:", e2);
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
}
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
  browserAPI.tabs.create({ url: openRecall.href });
});
function sendMessage(message) {
  return new Promise((resolve) => {
    browserAPI.runtime.sendMessage(message, (response) => {
      var _a;
      if ((_a = browserAPI.runtime) == null ? void 0 : _a.lastError) {
        console.warn("[Recall] sendMessage:", browserAPI.runtime.lastError.message);
      }
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
