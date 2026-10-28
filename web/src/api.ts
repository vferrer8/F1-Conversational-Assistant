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

export interface DatasetStats {
  seasons: number;
  first_season: number;
  last_season: number;
  races: number;
  drivers: number;
  constructors: number;
  results: number;
  lap_times: number;
}

export interface Race {
  round: number;
  name: string;
  date: string | null;
}

export interface StandingRow {
  position: number;
  driver: string;
  points: number;
  wins: number;
  constructor: string | null;
}

export interface RaceResult {
  driver_name: string | null;
  driver_number: number | null;
  constructor: string | null;
  grid_position: number | null;
  final_position: number | null;
  final_position_order: number | null;
  points: number | null;
}

export interface PredictorOptions {
  drivers: { number: number; name: string; constructor: string }[];
  constructors: string[];
  circuits: { circuit: string; grand_prix: string }[];
  seasons: number[];
}

export interface PredictionInput {
  year: number;
  circuit: string;
  driver_number: number;
  grid: number;
  constructor_name: string;
}

export interface Prediction {
  predicted_position: number;
  features: Record<string, number>;
  warning: string;
}

const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new Error(message ?? `Error ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  health: () => http<{ status: string; agentService: string }>('/health'),

  listConversations: () => http<ConversationSummary[]>('/conversations'),
  getConversation: (id: string) => http<Conversation>(`/conversations/${id}`),
  createConversation: () => http<ConversationSummary>('/conversations', { method: 'POST', body: '{}' }),
  deleteConversation: (id: string) => http<void>(`/conversations/${id}`, { method: 'DELETE' }),
  sendMessage: (id: string, content: string) =>
    http<{ userMessage: Message; assistantMessage: Message }>(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  stats: () => http<DatasetStats>('/f1/stats'),
  seasons: () => http<number[]>('/f1/seasons'),
  races: (year: number) => http<Race[]>(`/f1/seasons/${year}/races`),
  standings: (year: number, limit = 10) => http<StandingRow[]>(`/f1/seasons/${year}/standings?limit=${limit}`),
  results: (year: number, grandPrix: string) =>
    http<RaceResult[]>(`/f1/races/${year}/results?circuit=${encodeURIComponent(grandPrix)}`),
  predictionOptions: () => http<PredictorOptions>('/f1/predictions/options'),
  predict: (input: PredictionInput) => http<Prediction>('/f1/predictions', { method: 'POST', body: JSON.stringify(input) }),
};
