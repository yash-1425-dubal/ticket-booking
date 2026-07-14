const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  idempotencyKey?: string;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('accessToken');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  }

  getToken() {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Request failed');
    }

    return data;
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint);
  }

  post<T>(endpoint: string, body?: unknown, idempotencyKey?: string) {
    return this.request<T>(endpoint, { method: 'POST', body, idempotencyKey });
  }

  patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  put<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Auth helpers
  async login(email: string, password: string) {
    const result = await this.post<{
      success: boolean;
      data: { user: any; accessToken: string; refreshToken: string };
    }>('/auth/login', { email, password });
    this.setToken(result.data.accessToken);
    localStorage.setItem('refreshToken', result.data.refreshToken);
    return result.data;
  }

  async register(name: string, email: string, password: string, role = 'CUSTOMER') {
    const result = await this.post<{
      success: boolean;
      data: { user: any; accessToken: string; refreshToken: string };
    }>('/auth/register', { name, email, password, role });
    this.setToken(result.data.accessToken);
    localStorage.setItem('refreshToken', result.data.refreshToken);
    return result.data;
  }

  async getMe() {
    return this.get<{ success: boolean; data: { user: any } }>('/auth/me');
  }

  logout() {
    this.setToken(null);
    localStorage.removeItem('refreshToken');
  }
}

export const api = new ApiClient();
