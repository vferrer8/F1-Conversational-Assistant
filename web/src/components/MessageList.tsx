import { useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentMetadata, Message } from '../api';

const SUGGESTIONS = [
  '¿Quién ganó el GP de Monza en 2019?',
  'Who won the 2021 Abu Dhabi Grand Prix?',
  '¿En qué posición acabaría Leclerc en Monza 2024 saliendo desde la pole?',
  '¿De qué nacionalidad es Fernando Alonso?',
];

const TOOL_LABELS: Record<string, string> = {
  get_driver_standings: 'Ficha de piloto',
  get_race_results: 'Resultados',
  get_telemetry: 'Telemetría',
  predict_position: 'Predicción XGBoost',
};

interface Props {
  messages: Message[];
  sending: boolean;
  onSuggestion: (text: string) => void;
}

export function MessageList({ messages, sending, onSuggestion }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending]);

  if (messages.length === 0 && !sending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <div>
          <p className="text-3xl font-semibold">🏎️</p>
          <p className="mt-2 text-zinc-400">Pregunta por resultados históricos, telemetría o predicciones.</p>
        </div>
        <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion(s)}
              className="rounded-lg border border-zinc-800 px-3 py-2 text-left text-sm text-zinc-300 hover:border-zinc-600 hover:bg-zinc-900"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="self-end rounded-2xl bg-zinc-800 px-4 py-2 whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="flex flex-col gap-2">
              <div className="prose-chat">
                <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
              </div>
              {m.metadata && <AgentTrace meta={m.metadata} />}
            </div>
          ),
        )}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-f1-red" />
            Consultando datos…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

/** Muestra qué hizo el agente: tools invocadas, guardarraíles y latencia. */
function AgentTrace({ meta }: { meta: AgentMetadata }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400">
      {meta.status === 'rejected_domain' && (
        <span className="rounded-full border border-amber-800 bg-amber-950/50 px-2 py-0.5 text-amber-300">
          Fuera de dominio
        </span>
      )}
      {meta.status === 'llm_error' && (
        <span className="rounded-full border border-red-900 bg-red-950/50 px-2 py-0.5 text-red-300">Error del LLM</span>
      )}
      {meta.toolCalls.map((t, i) => (
        <span
          key={i}
          title={JSON.stringify(t.args)}
          className={`rounded-full border px-2 py-0.5 ${t.error ? 'border-red-900 text-red-300' : 'border-zinc-700'}`}
        >
          🔧 {TOOL_LABELS[t.name] ?? t.name}
        </span>
      ))}
      {meta.consistencySuspects.length > 0 && (
        <span className="rounded-full border border-amber-800 px-2 py-0.5 text-amber-300">
          ⚠️ Cifras no verificadas: {meta.consistencySuspects.join(', ')}
        </span>
      )}
      <span className="ml-auto text-zinc-600">{(meta.latencyMs / 1000).toFixed(1)} s</span>
    </div>
  );
}
