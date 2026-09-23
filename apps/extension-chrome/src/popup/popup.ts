/**
 * Recall Extension — Popup Script
 *
 * Handles popup UI interactions:
 * - Pairing Token authentication (Primary SaaS flow)
 * - Direct credential authentication (Fallback)
 * - Multi-browser compatibility (Chrome, Firefox, Safari)
 * - Sync trigger, pause/resume, and disconnect
 *
 * All state reads from extension storage, never global vars.
 */

import { detectBrowserType } from '../lib/browser-api';

// ── DOM Elements ────────────────────────────────

const loginView = document.getElementById('login-view') as HTMLDivElement;
const connectedView = document.getElementById('connected-view') as HTMLDivElement;

// Mode tabs
const tabTokenBtn = document.getElementById('tab-token-btn') as HTMLButtonElement;
const tabLoginBtn = document.getElementById('tab-login-btn') as HTMLButtonElement;

// Token Form
const tokenForm = document.getElementById('token-form') as HTMLFormElement;
const tokenApiUrlInput = document.getElementById('token-api-url') as HTMLInputElement;
const pairingTokenInput = document.getElementById('pairing-token') as HTMLInputElement;
const connectionNameInput = document.getElementById('connection-name') as HTMLInputElement;
const tokenBtn = document.getElementById('token-btn') as HTMLButtonElement;
const tokenError = document.getElementById('token-error') as HTMLParagraphElement;

// Login Form
const loginForm = document.getElementById('login-form') as HTMLFormElement;
const loginError = document.getElementById('login-error') as HTMLParagraphElement;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const apiUrlInput = document.getElementById('api-url') as HTMLInputElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;

// Connected View
const browserTypeLabel = document.querySelector('.status-card .status-label') as HTMLSpanElement;
const connectionStatus = document.getElementById('connection-status') as HTMLSpanElement;
const lastSynced = document.getElementById('last-synced') as HTMLSpanElement;
const pendingCount = document.getElementById('pending-count') as HTMLSpanElement;
const syncError = document.getElementById('sync-error') as HTMLDivElement;
const syncErrorText = document.getElementById('sync-error-text') as HTMLSpanElement;

const syncBtn = document.getElementById('sync-btn') as HTMLButtonElement;
const pauseBtn = document.getElementById('pause-btn') as HTMLButtonElement;
const openRecall = document.getElementById('open-recall') as HTMLAnchorElement;
const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;

const detectedBrowser = detectBrowserType();

// ── Initialize ──────────────────────────────────

async function init(): Promise<void> {
  const browserName = detectedBrowser.charAt(0).toUpperCase() + detectedBrowser.slice(1);
  if (connectionNameInput) {
    connectionNameInput.placeholder = `${browserName} Browser`;
  }
  if (browserTypeLabel) {
    browserTypeLabel.textContent = browserName;
  }

  const response = await sendMessage({ type: 'GET_STATUS' });
  if (response?.auth?.is_connected) {
    showConnectedView(response.auth, response.sync);
  } else {
    showLoginView();
  }
}

// ── Tab Switching ───────────────────────────────

if (tabTokenBtn && tabLoginBtn) {
  tabTokenBtn.addEventListener('click', () => {
    tabTokenBtn.classList.add('active');
    tabLoginBtn.classList.remove('active');
    tokenForm.hidden = false;
    loginForm.hidden = true;
    tokenError.hidden = true;
    loginError.hidden = true;
  });

  tabLoginBtn.addEventListener('click', () => {
    tabLoginBtn.classList.add('active');
    tabTokenBtn.classList.remove('active');
    loginForm.hidden = false;
    tokenForm.hidden = true;
    tokenError.hidden = true;
    loginError.hidden = true;
  });
}

// ── Views ───────────────────────────────────────

function showLoginView(): void {
  loginView.hidden = false;
  connectedView.hidden = true;
}

function showConnectedView(
  auth: { is_paused: boolean; api_url?: string },
  sync: { last_synced_at: number | null; pending_count: number; last_error: string | null }
): void {
  loginView.hidden = true;
  connectedView.hidden = false;

  // Browser label
  const browserName = detectedBrowser.charAt(0).toUpperCase() + detectedBrowser.slice(1);
  if (browserTypeLabel) {
    browserTypeLabel.textContent = browserName;
  }

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
  const webUrl = (auth.api_url && !auth.api_url.includes('localhost:8000'))
    ? auth.api_url.replace(/api\./, '').replace(/\/$/, '')
    : 'http://localhost:5173';
  openRecall.href = `${webUrl}/app`;
}

// ── Token Pairing Handler (Primary) ─────────────

if (tokenForm) {
  tokenForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    tokenError.hidden = true;
    tokenBtn.textContent = 'Pairing...';
    tokenBtn.disabled = true;

    const apiUrl = tokenApiUrlInput.value.replace(/\/$/, '');
    const pairingToken = pairingTokenInput.value.trim();
    const browserName = detectedBrowser.charAt(0).toUpperCase() + detectedBrowser.slice(1);
    const connectionName = connectionNameInput.value.trim() || `${browserName} Browser`;

    try {
      const response = await fetch(`${apiUrl}/api/browsers/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairing_token: pairingToken,
          browser_type: detectedBrowser,
          connection_name: connectionName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Pairing failed (${response.status})`);
      }

      const pairData = await response.json();

      // Save auth in background service worker
      await sendMessage({
        type: 'LOGIN',
        payload: {
          access_token: pairData.access_token,
          refresh_token: pairData.refresh_token,
          connection_id: pairData.connection_id,
          api_url: apiUrl,
        },
      });

      // Fetch excluded domains
      try {
        const privacyResponse = await fetch(`${apiUrl}/api/privacy`, {
          headers: { Authorization: `Bearer ${pairData.access_token}` },
        });
        if (privacyResponse.ok) {
          const privacy = await privacyResponse.json();
          await sendMessage({
            type: 'UPDATE_EXCLUDED_DOMAINS',
            payload: { domains: privacy.excluded_domains.map((d: { domain_name: string }) => d.domain_name) },
          });
        }
      } catch (e) {
        console.warn('Could not sync initial privacy settings:', e);
      }

      // Transition to connected view
      const status = await sendMessage({ type: 'GET_STATUS' });
      showConnectedView(status.auth, status.sync);
    } catch (error) {
      tokenError.textContent = error instanceof Error ? error.message : 'Pairing failed';
      tokenError.hidden = false;
    } finally {
      tokenBtn.textContent = 'Pair Extension';
      tokenBtn.disabled = false;
    }
  });
}

// ── Password Login Handler (Secondary) ──────────

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    loginBtn.textContent = 'Connecting...';
    loginBtn.disabled = true;

    const apiUrl = apiUrlInput.value.replace(/\/$/, '');
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const browserName = detectedBrowser.charAt(0).toUpperCase() + detectedBrowser.slice(1);

    try {
      // Step 1: Login to Recall API
      const loginResponse = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        const error = await loginResponse.json().catch(() => ({}));
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
          browser_type: detectedBrowser,
          connection_name: `${browserName} Browser`,
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
      try {
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
      } catch (e) {
        console.warn('Could not sync privacy settings:', e);
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
}

// ── Control Actions ─────────────────────────────

syncBtn.addEventListener('click', async () => {
  syncBtn.textContent = 'Syncing...';
  syncBtn.disabled = true;

  await sendMessage({ type: 'FORCE_SYNC' });

  // Refresh status
  const status = await sendMessage({ type: 'GET_STATUS' });
  showConnectedView(status.auth, status.sync);

  syncBtn.textContent = 'Sync Now';
  syncBtn.disabled = false;
});

pauseBtn.addEventListener('click', async () => {
  await sendMessage({ type: 'TOGGLE_PAUSE' });
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

function sendMessage(message: Record<string, unknown>): Promise<Record<string, any>> {
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

// ── Run Init ────────────────────────────────────
init();
