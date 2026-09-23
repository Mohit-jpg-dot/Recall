import type {
  BrowserConnection,
  ChatMessage,
  Conversation,
  PrivacySettings,
  ResearchSession,
  SearchFilters,
  SearchResponse,
  TimelineResponse,
  Topic,
  User,
} from './types';

// Read API URL from environment variable in production, fallback to relative or localhost
const rawApiUrl = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`;

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor() {
    this.accessToken = localStorage.getItem('recall_access_token') || localStorage.getItem('recall_token');
    this.refreshToken = localStorage.getItem('recall_refresh_token');
  }

  setTokens(accessToken: string | null, refreshToken: string | null = null) {
    this.accessToken = accessToken;
    if (accessToken) {
      localStorage.setItem('recall_access_token', accessToken);
      localStorage.setItem('recall_token', accessToken);
    } else {
      localStorage.removeItem('recall_access_token');
      localStorage.removeItem('recall_token');
    }

    if (refreshToken) {
      this.refreshToken = refreshToken;
      localStorage.setItem('recall_refresh_token', refreshToken);
    } else if (refreshToken === null && accessToken === null) {
      this.refreshToken = null;
      localStorage.removeItem('recall_refresh_token');
    }
  }

  setToken(token: string | null) {
    this.setTokens(token, null);
  }

  getToken(): string | null {
    return this.accessToken;
  }

  logout() {
    this.setTokens(null, null);
  }

  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && this.refreshToken && endpoint !== '/auth/refresh' && endpoint !== '/auth/login') {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: this.refreshToken }),
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            this.setTokens(data.access_token, data.refresh_token);
            this.isRefreshing = false;
            this.onTokenRefreshed(data.access_token);

            // Retry original request with new token
            headers['Authorization'] = `Bearer ${data.access_token}`;
            const retryRes = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
            if (!retryRes.ok) {
              const err = await retryRes.json().catch(() => ({ detail: retryRes.statusText }));
              throw new Error(err.detail || 'Request failed');
            }
            return retryRes.json();
          } else {
            this.isRefreshing = false;
            this.logout();
            throw new Error('Session expired. Please log in again.');
          }
        } catch (e) {
          this.isRefreshing = false;
          this.logout();
          throw e;
        }
      } else {
        // Wait for token refresh to complete
        return new Promise<T>((resolve, reject) => {
          this.addRefreshSubscriber(async (newToken) => {
            try {
              headers['Authorization'] = `Bearer ${newToken}`;
              const retryRes = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
              if (!retryRes.ok) {
                const err = await retryRes.json().catch(() => ({ detail: retryRes.statusText }));
                reject(new Error(err.detail || 'Request failed'));
              } else {
                resolve(await retryRes.json());
              }
            } catch (err) {
              reject(err);
            }
          });
        });
      }
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorBody.detail || 'Request failed');
    }

    return response.json();
  }

  async login(credentials: { email: string; password: string }): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const res = await this.request<{ access_token: string; refresh_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (res.access_token) {
      this.setTokens(res.access_token, res.refresh_token);
    }
    return res;
  }

  async register(body: { email: string; password: string; display_name: string }): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const res = await this.request<{ access_token: string; refresh_token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.access_token) {
      this.setTokens(res.access_token, res.refresh_token);
    }
    return res;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/me');
  }

  async deleteAccount(): Promise<{ message: string }> {
    const res = await this.request<{ message: string }>('/me', { method: 'DELETE' });
    this.logout();
    return res;
  }

  // Search
  async search(query: string, filters?: SearchFilters, limit = 10): Promise<SearchResponse> {
    return this.request<SearchResponse>('/search', {
      method: 'POST',
      body: JSON.stringify({ query, filters, limit }),
    });
  }

  // Chat
  async sendMessage(message: string, conversationId?: string): Promise<{ conversation_id: string; message: ChatMessage }> {
    return this.request('/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversation_id: conversationId }),
    });
  }

  async listConversations(): Promise<Conversation[]> {
    return this.request<Conversation[]>('/conversations');
  }

  async getConversation(conversationId: string): Promise<ChatMessage[]> {
    return this.request<ChatMessage[]>(`/conversations/${conversationId}`);
  }

  async deleteConversation(conversationId: string): Promise<{ message: string }> {
    return this.request(`/conversations/${conversationId}`, { method: 'DELETE' });
  }

  // Timeline & Memories
  async getTimeline(dateFrom?: string, dateTo?: string, cursor?: string): Promise<TimelineResponse> {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (cursor) params.append('cursor', cursor);
    return this.request<TimelineResponse>(`/timeline?${params.toString()}`);
  }

  async deleteMemory(id: string): Promise<{ message: string }> {
    return this.request(`/memory/${id}`, { method: 'DELETE' });
  }

  // Topics
  async listTopics(): Promise<Topic[]> {
    return this.request<Topic[]>('/topics');
  }

  async getTopicMemories(slug: string): Promise<any[]> {
    return this.request(`/topics/${slug}/memories`);
  }

  // Sessions
  async listSessions(): Promise<ResearchSession[]> {
    return this.request<ResearchSession[]>('/sessions');
  }

  // Browsers
  async listBrowsers(): Promise<BrowserConnection[]> {
    return this.request<BrowserConnection[]>('/browsers');
  }

  async connectBrowser(browserType: string, connectionName: string) {
    return this.request('/browsers/connect', {
      method: 'POST',
      body: JSON.stringify({ browser_type: browserType, connection_name: connectionName }),
    });
  }

  async pauseBrowser(id: string, isPaused: boolean) {
    return this.request(`/browsers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_paused: isPaused }),
    });
  }

  async disconnectBrowser(id: string) {
    return this.request(`/browsers/${id}`, { method: 'DELETE' });
  }

  // Privacy
  async getPrivacy(): Promise<PrivacySettings> {
    return this.request<PrivacySettings>('/privacy');
  }

  async toggleMemory(active: boolean) {
    return this.request('/privacy', {
      method: 'PATCH',
      body: JSON.stringify({ memory_active: active }),
    });
  }

  async addExcludedDomain(domainName: string) {
    return this.request('/privacy/excluded-domains', {
      method: 'POST',
      body: JSON.stringify({ domain_name: domainName }),
    });
  }

  async removeExcludedDomain(id: string) {
    return this.request(`/privacy/excluded-domains/${id}`, { method: 'DELETE' });
  }

  async exportData(): Promise<any> {
    return this.request('/privacy/export', { method: 'GET' });
  }
}

export const api = new ApiClient();
