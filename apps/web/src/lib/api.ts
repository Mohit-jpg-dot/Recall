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

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('recall_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('recall_token', token);
    } else {
      localStorage.removeItem('recall_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(errorBody.detail || 'Request failed');
    }

    return response.json();
  }

  async login(credentials: { email: string; password: string }): Promise<{ access_token: string }> {
    const res = await this.request<{ access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (res.access_token) {
      this.setToken(res.access_token);
    }
    return res;
  }

  async register(body: { email: string; password: string; display_name: string }) {
    const res = await this.request<{ access_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.access_token) {
      this.setToken(res.access_token);
    }
    return res;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/me');
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
