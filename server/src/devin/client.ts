import { config } from '../config.js';

export interface DevinSessionCreated {
  session_id: string;
  url: string | null;
}

export interface DevinPullRequestRef {
  url?: string | null;
  number?: number | null;
  title?: string | null;
  state?: string | null;
  merged?: boolean | null;
}

export interface DevinSessionDetail {
  session_id: string;
  status: string | null;
  status_enum: string | null;
  title: string | null;
  url: string | null;
  acus_consumed: number | null;
  pull_requests: DevinPullRequestRef[];
  structured_output: Record<string, unknown> | null;
  updated_at: string | null;
}

export interface DevinMessage {
  id: string;
  type: string;
  message: string;
  created_at: string;
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
    status_enum: typeof raw.status_enum === 'string' ? raw.status_enum : null,
    title: typeof raw.title === 'string' ? raw.title : null,
    url: typeof raw.url === 'string' ? raw.url : null,
    acus_consumed: typeof raw.acus_consumed === 'number' ? raw.acus_consumed : null,
    pull_requests: asPullRequests(raw.pull_requests),
    structured_output:
      typeof raw.structured_output === 'object' && raw.structured_output !== null
        ? (raw.structured_output as Record<string, unknown>)
        : null,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
  };
}

export interface MessagePage {
  messages: DevinMessage[];
  cursor: string | null;
}

export async function listMessages(sessionId: string, cursor: string | null): Promise<MessagePage> {
  const { orgId } = requireCredentials();
  const params = new URLSearchParams({ limit: '50' });
  if (cursor) params.set('after', cursor);

  const raw = await request<Record<string, unknown>>(
    `/v3/organizations/${orgId}/sessions/${sessionId}/messages?${params.toString()}`,
  );

  const items = Array.isArray(raw.messages) ? raw.messages : [];
  const messages = items.flatMap((item): DevinMessage[] => {
    if (typeof item !== 'object' || item === null) return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : null;
    if (!id) return [];
    return [
      {
        id,
        type: typeof record.type === 'string' ? record.type : 'message',
        message: typeof record.message === 'string' ? record.message : '',
        created_at: typeof record.created_at === 'string' ? record.created_at : new Date().toISOString(),
      },
    ];
  });

  return { messages, cursor: messages.at(-1)?.id ?? cursor };
}

export async function sendMessage(sessionId: string, message: string): Promise<void> {
  const { orgId } = requireCredentials();
  await request(`/v3/organizations/${orgId}/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
