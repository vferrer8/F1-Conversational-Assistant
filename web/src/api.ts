/** Cliente de la Chat API (NestJS). Tipos alineados con sus respuestas. */

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  error: string | null;
}

export interface AgentMetadata {
  status: 'ok' | 'rejected_domain' | 'llm_error';
  model: string;
  toolCalls: ToolCall[];
  consistencySuspects: number[];
  latencyMs: number;
  runId: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: AgentMetadata | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Error ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  listConversations: () => http<ConversationSummary[]>('/conversations'),
  getConversation: (id: string) => http<Conversation>(`/conversations/${id}`),
  createConversation: () => http<ConversationSummary>('/conversations', { method: 'POST', body: '{}' }),
  deleteConversation: (id: string) => http<void>(`/conversations/${id}`, { method: 'DELETE' }),
  sendMessage: (id: string, content: string) =>
    http<{ userMessage: Message; assistantMessage: Message }>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};
