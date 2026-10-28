import { HttpException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Respuesta de POST /v1/agent/query del agent-service (FastAPI). */
export interface AgentReply {
  answer: string;
  status: 'ok' | 'rejected_domain' | 'llm_error';
  model: string;
  tool_calls: { name: string; args: Record<string, unknown>; error: string | null }[];
  consistency_suspects: number[];
  latency_ms: number;
  run_id: number;
}

@Injectable()
export class AgentClient {
  private readonly logger = new Logger(AgentClient.name);
  private readonly baseUrl: string;
  private readonly useIdToken: boolean;
  private idToken?: { value: string; expiresAt: number };

  constructor(config: ConfigService) {
    this.baseUrl = config.get('AGENT_SERVICE_URL', 'http://localhost:8000');
    this.useIdToken = config.get('AGENT_USE_ID_TOKEN') === 'true';
  }

  /**
   * En Cloud Run el agente es privado: se invoca con un ID token de la cuenta
   * de servicio, obtenido del servidor de metadatos (sin SDK de GCP).
   */
  private async authHeaders(): Promise<Record<string, string>> {
    if (!this.useIdToken) return {};
    if (!this.idToken || this.idToken.expiresAt < Date.now()) {
      const url =
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity' +
        `?audience=${encodeURIComponent(this.baseUrl)}`;
      const res = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' } });
      if (!res.ok) throw new Error(`metadata server ${res.status}`);
      // Los ID tokens duran 1 h; se renuevan antes.
      this.idToken = { value: await res.text(), expiresAt: Date.now() + 50 * 60_000 };
    }
    return { Authorization: `Bearer ${this.idToken.value}` };
  }

  query(message: string, history: ChatTurn[], conversationId: string): Promise<AgentReply> {
    return this.request<AgentReply>('POST', '/v1/agent/query', {
      body: { message, history, conversation_id: conversationId },
      // Holgado respecto al timeout por llamada del agente (40 s × modelos de respaldo).
      timeoutMs: 150_000,
    });
  }

  /**
   * Llamada genérica al agent-service. Los 4xx se propagan tal cual (validación,
   * no encontrado); los fallos de red o 5xx se traducen a 503.
   */
  async request<T>(
    method: 'GET' | 'POST',
    path: string,
    opts: { body?: unknown; query?: Record<string, string | undefined>; timeoutMs?: number } = {},
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, v);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(await this.authHeaders()) },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      });
    } catch (err) {
      this.logger.error(`agent-service unreachable: ${err}`);
      throw new ServiceUnavailableException('El servicio de agente no está disponible.');
    }
    if (res.status >= 400 && res.status < 500) {
      const body = (await res.json().catch(() => ({ message: res.statusText }))) as Record<string, unknown>;
      throw new HttpException(body, res.status);
    }
    if (!res.ok) {
      this.logger.error(`agent-service ${res.status}: ${await res.text()}`);
      throw new ServiceUnavailableException('El servicio de agente devolvió un error.');
    }
    return (await res.json()) as T;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        headers: await this.authHeaders(),
        signal: AbortSignal.timeout(3_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
