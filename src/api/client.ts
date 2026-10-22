import type {
  ApiErrorBody,
  SearchRequestBody,
  SearchResponse,
  SessionResponse,
} from '@shared/types';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, code: string, status = 0, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('网络请求失败，请确认服务已启动。', 'NETWORK_ERROR');
  }

  if (!response.ok) {
    let payload: ApiErrorBody | null = null;
    try {
      payload = (await response.json()) as ApiErrorBody;
    } catch {
      payload = null;
    }
    throw new ApiError(
      payload?.error?.message || `请求失败（HTTP ${response.status}）`,
      payload?.error?.code || 'HTTP_ERROR',
      response.status,
      payload?.error?.requestId,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function search(body: SearchRequestBody, signal?: AbortSignal): Promise<SearchResponse> {
  return request<SearchResponse>('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
}

export function getSession(): Promise<SessionResponse> {
  return request<SessionResponse>('/api/session');
}

export function login(password: string): Promise<void> {
  return request<void>('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

export function logout(): Promise<void> {
  return request<void>('/api/logout', { method: 'POST' });
}
