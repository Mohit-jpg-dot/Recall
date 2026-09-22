/**
 * Recall Extension — Popup Script
 *
 * Handles popup UI interactions.
 * All state reads from chrome.storage, never global vars.
 */

// ── DOM Elements ────────────────────────────────

const loginView = document.getElementById('login-view') as HTMLDivElement;
const connectedView = document.getElementById('connected-view') as HTMLDivElement;
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const loginError = document.getElementById('login-error') as HTMLParagraphElement;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const apiUrlInput = document.getElementById('api-url') as HTMLInputElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;

const connectionStatus = document.getElementById('connection-status') as HTMLSpanElement;
const lastSynced = document.getElementById('last-synced') as HTMLSpanElement;
const pendingCount = document.getElementById('pending-count') as HTMLSpanElement;
const syncError = document.getElementById('sync-error') as HTMLDivElement;
const syncErrorText = document.getElementById('sync-error-text') as HTMLSpanElement;

const syncBtn = document.getElementById('sync-btn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
const openRecall = document.getElementById('open-recall') as HTMLAnchorElement;
const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;

// ── Initialize ──────────────────────────────────

async function init(): Promise<void> {
  const response = await sendMessage({ type: 'GET_STATUS' });
  if (response?.auth?.is_connected) {
    showConnectedView(response.auth, response.sync);
  } else {
    showLoginView();
  }
}

// ── Views ───────────────────────────────────────

function showLoginView(): void {
  loginView.hidden = false;
  connectedView.hidden = true;
}

function showConnectedView(
  auth: { is_paused: boolean },
  sync: { last_synced_at: number | null; pending_count: number; last_error: string | null }
): void {
  loginView.hidden = true;
  connectedView.hidden = false;

  // Update status
  const dot = connectionStatus.querySelector('.status-dot') as HTMLSpanElement;
  if (auth.is_paused) {
    dot.className = 'status-dot paused';
    connectionStatus.childNodes[1].textContent = ' Paused';
    pauseBtn.textContent = 'Resume';
  } else {
    dot.className = 'status-dot connected';
    connectionStatus.childNodes[1].textContent = ' Connected';
    pauseBtn.textContent = 'Pause';
  }

  // Last synced
  if (sync.last_synced_at) {
    const ago = formatTimeAgo(sync.last_synced_at);
    lastSynced.textContent = ago;
  } else {
    lastSynced.textContent = 'Never';
  }

  // Pending count
  pendingCount.textContent = `${sync.pending_count} event${sync.pending_count !== 1 ? 's' : ''}`;

  // Error
  if (sync.last_error) {
    syncError.hidden = false;
    syncErrorText.textContent = sync.last_error;
  } else {
    syncError.hidden = true;
  }

  // Open Recall link
  openRecall.href = 'http://localhost:5173/app';
}

// ── Event Handlers ──────────────────────────────

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  loginBtn.textContent = 'Connecting...';
  loginBtn.disabled = true;

  const apiUrl = apiUrlInput.value.replace(/\/$/, '');
  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    // Step 1: Login to Recall API
    const loginResponse = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(error.detail || 'Login failed');
    }

    const loginData = await loginResponse.json();

    // Step 2: Register this browser connection
    const connectResponse = await fetch(`${apiUrl}/api/browsers/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.access_token}`,
      },
      body: JSON.stringify({
        browser_type: 'chrome',
        connection_name: 'Chrome Browser',
      }),
    });

    if (!connectResponse.ok) {
      throw new Error('Failed to register browser connection');
    }

    const connectionData = await connectResponse.json();

    // Step 3: Save auth to service worker
    await sendMessage({
      type: 'LOGIN',
      payload: {
        access_token: loginData.access_token,
        refresh_token: loginData.refresh_token,
        connection_id: connectionData.id,
        api_url: apiUrl,
      },
    });

    // Step 4: Fetch excluded domains
    const privacyResponse = await fetch(`${apiUrl}/api/privacy`, {
      headers: { Authorization: `Bearer ${loginData.access_token}` },
    });
    if (privacyResponse.ok) {
      const privacy = await privacyResponse.json();
      await sendMessage({
        type: 'UPDATE_EXCLUDED_DOMAINS',
        payload: { domains: privacy.excluded_domains.map((d: { domain_name: string }) => d.domain_name) },
      });
    }

    // Show connected view
    const status = await sendMessage({ type: 'GET_STATUS' });
    showConnectedView(status.auth, status.sync);

  } catch (error) {
    loginError.textContent = error instanceof Error ? error.message : 'Connection failed';
    loginError.hidden = false;
  } finally {
    loginBtn.textContent = 'Connect Browser';
    loginBtn.disabled = false;
  }
});

syncBtn.addEventListener('click', async () => {
  syncBtn.textContent = 'Syncing...';
  syncBtn.disabled = true;

  const response = await sendMessage({ type: 'FORCE_SYNC' });

  // Refresh status
  const status = await sendMessage({ type: 'GET_STATUS' });
  showConnectedView(status.auth, status.sync);

  syncBtn.textContent = 'Sync Now';
  syncBtn.disabled = false;
});

pauseBtn.addEventListener('click', async () => {
  const response = await sendMessage({ type: 'TOGGLE_PAUSE' });
  const status = await sendMessage({ type: 'GET_STATUS' });
  showConnectedView(status.auth, status.sync);
});

disconnectBtn.addEventListener('click', async () => {
  if (confirm('Disconnect this browser from Recall?')) {
    await sendMessage({ type: 'LOGOUT' });
    showLoginView();
  }
});

openRecall.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: openRecall.href });
});

// ── Helpers ─────────────────────────────────────

function sendMessage(message: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response || {});
    });
  });
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ── Init ────────────────────────────────────────
init();
