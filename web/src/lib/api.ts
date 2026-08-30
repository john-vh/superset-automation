import type { BoardDto, RunDetailDto } from '@shared/types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `Request failed with ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  board: () => request<BoardDto>('/api/board'),
  runDetail: (runId: string) => request<RunDetailDto>(`/api/runs/${runId}`),
  dispatch: (issueNumber: number) => request<void>(`/api/issues/${issueNumber}/dispatch`, { method: 'POST' }),
  stop: (issueNumber: number) => request<void>(`/api/issues/${issueNumber}/stop`, { method: 'POST' }),
  reset: (issueNumber: number) => request<void>(`/api/issues/${issueNumber}/reset`, { method: 'POST' }),
  sync: (full = false) => request<{ synced: number }>(`/api/sync?full=${full}`, { method: 'POST' }),
  clearNotifications: () => request<void>('/api/notifications', { method: 'DELETE' }),
};
