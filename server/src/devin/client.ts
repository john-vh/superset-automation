import { config } from '../config.js';

export interface DevinSessionCreated {
  session_id: string;
  url: string | null;
}

/** `pull_requests[]` is `{ url, state }` on v3 and `{ pr_url, pr_state }` on some responses. */
export interface DevinPullRequestRef {
  url?: string | null;
  pr_url?: string | null;
  state?: string | null;
  pr_state?: string | null;
}

export interface DevinSessionDetail {
  session_id: string;
  /** One of new, claimed, running, exit, error, suspended, resuming. */
  status: string | null;
  /** Qualifies `status`, e.g. working, waiting_for_user, finished, user_request, inactivity. */
  status_detail: string | null;
  title: string | null;
  url: string | null;
  acus_consumed: number | null;
  pull_requests: DevinPullRequestRef[];
  structured_output: Record<string, unknown> | null;
}

export interface DevinMessage {
  id: string;
  source: string;
  message: string;
}

export class DevinError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'DevinError';
  }
}

function requireCredentials(): { orgId: string; apiKey: string } {
  if (!config.DEVIN_API_KEY || !config.DEVIN_ORG_ID) {
    throw new DevinError('DEVIN_API_KEY and DEVIN_ORG_ID must be set to talk to the Devin API', 503);
  }
  return { orgId: config.DEVIN_ORG_ID, apiKey: config.DEVIN_API_KEY };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey } = requireCredentials();
  const response = await fetch(`${config.DEVIN_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new DevinError(`Devin ${init.method ?? 'GET'} ${path} failed: ${response.status} ${detail}`, response.status);
  }
  return (await response.json()) as T;
}

export interface CreateSessionInput {
  prompt: string;
  title?: string;
  playbookId?: string | null;
  tags?: string[];
  maxAcuLimit?: number | null;
}

export async function createSession(input: CreateSessionInput): Promise<DevinSessionCreated> {
  const { orgId } = requireCredentials();
  const body: Record<string, unknown> = { prompt: input.prompt };
  if (input.title) body.title = input.title;
  if (input.playbookId) body.playbook_id = input.playbookId;
  if (input.tags?.length) body.tags = input.tags;
  if (input.maxAcuLimit) body.max_acu_limit = input.maxAcuLimit;

  const created = await request<Record<string, unknown>>(`/v3/organizations/${orgId}/sessions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const sessionId = typeof created.session_id === 'string' ? created.session_id : null;
  if (!sessionId) throw new DevinError('Devin session response did not include a session_id', 502);

  return { session_id: sessionId, url: typeof created.url === 'string' ? created.url : null };
}

function asPullRequests(value: unknown): DevinPullRequestRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is DevinPullRequestRef => typeof item === 'object' && item !== null);
}

export async function getSession(sessionId: string): Promise<DevinSessionDetail> {
  const { orgId } = requireCredentials();
  const raw = await request<Record<string, unknown>>(`/v3/organizations/${orgId}/sessions/${sessionId}`);

  return {
    session_id: sessionId,
    status: typeof raw.status === 'string' ? raw.status : null,
    status_detail: typeof raw.status_detail === 'string' ? raw.status_detail : null,
    title: typeof raw.title === 'string' ? raw.title : null,
    url: typeof raw.url === 'string' ? raw.url : null,
    acus_consumed: typeof raw.acus_consumed === 'number' ? raw.acus_consumed : null,
    pull_requests: asPullRequests(raw.pull_requests),
    structured_output:
      typeof raw.structured_output === 'object' && raw.structured_output !== null
        ? (raw.structured_output as Record<string, unknown>)
        : null,
  };
}

/**
 * The session payload's `acus_consumed` can trail the work by a while, so the consumption API is
 * the more reliable total. It is enterprise-scoped, so callers must tolerate a 401/403/404.
 */
export async function getSessionAcus(sessionId: string): Promise<number | null> {
  const raw = await request<Record<string, unknown>>(`/v3/enterprise/consumption/daily/sessions/${sessionId}`);
  return typeof raw.total_acus === 'number' ? raw.total_acus : null;
}

export function pullRequestUrl(ref: DevinPullRequestRef | undefined): string | null {
  return ref?.url ?? ref?.pr_url ?? null;
}

/** Ends an active session. Devin reports the session as `exit` afterwards. */
export async function terminateSession(sessionId: string): Promise<void> {
  const { orgId } = requireCredentials();
  await request(`/v3/organizations/${orgId}/sessions/${sessionId}`, { method: 'DELETE' });
}

export interface MessagePage {
  messages: DevinMessage[];
  cursor: string | null;
}

export async function listMessages(sessionId: string, cursor: string | null): Promise<MessagePage> {
  const { orgId } = requireCredentials();
  const params = new URLSearchParams({ first: '50' });
  if (cursor) params.set('after', cursor);

  const raw = await request<Record<string, unknown>>(
    `/v3/organizations/${orgId}/sessions/${sessionId}/messages?${params.toString()}`,
  );

  const items = Array.isArray(raw.items) ? raw.items : [];
  const messages = items.flatMap((item): DevinMessage[] => {
    if (typeof item !== 'object' || item === null) return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.event_id === 'string' ? record.event_id : null;
    if (!id) return [];
    return [
      {
        id,
        source: typeof record.source === 'string' ? record.source : 'devin',
        message: typeof record.message === 'string' ? record.message : '',
      },
    ];
  });

  const endCursor = typeof raw.end_cursor === 'string' ? raw.end_cursor : null;
  return { messages, cursor: endCursor ?? cursor };
}

export async function sendMessage(sessionId: string, message: string): Promise<void> {
  const { orgId } = requireCredentials();
  await request(`/v3/organizations/${orgId}/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
