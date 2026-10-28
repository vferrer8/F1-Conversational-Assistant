import { useEffect, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentMetadata, Message } from '../api';
import { Chip, Spinner } from './ui';

const SUGGESTIONS = [
  { title: 'Histórico', text: '¿Quién ganó el GP de Monza en 2019?' },
  { title: 'In English', text: 'Who won the 2021 Abu Dhabi Grand Prix?' },
  { title: 'Predicción', text: '¿En qué posición acabaría Leclerc en Monza 2024 saliendo desde la pole con Ferrari?' },
  { title: 'Mundial', text: '¿Quién fue campeón del mundo en 2021 y con cuántos puntos?' },
];

const TOOL_LABELS: Record<string, string> = {
  get_driver_standings: 'Ficha de piloto',
  get_race_results: 'Resultados',
  get_season_standings: 'Clasificación del Mundial',
  get_telemetry: 'Telemetría',
  predict_position: 'Predicción XGBoost',
};

interface Props {
  messages: Message[];
  sending: boolean;
  demo: boolean;
  onSuggestion: (text: string) => void;
  onShowDemo: () => void;
}

export function MessageList({ messages, sending, demo, onSuggestion, onShowDemo }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!demo) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sending, demo]);

  if (messages.length === 0 && !sending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-4 py-10 text-center">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            ¿Qué quieres saber de la <span className="text-f1-red">F1</span>?
          </h1>
          <p className="text-zinc-400">Resultados históricos, pilotos, telemetría reciente o una predicción de carrera.</p>
        </div>
        <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              onClick={() => onSuggestion(s.text)}
              className="group rounded-xl border border-line bg-panel p-4 text-left transition-colors hover:border-zinc-600"
            >
              <p className="text-xs font-semibold text-f1-red">{s.title}</p>
              <p className="mt-1 text-sm text-zinc-300 group-hover:text-white">{s.text}</p>
            </button>
          ))}
        </div>
        <button onClick={onShowDemo} className="text-sm text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline">
          Ver una conversación de ejemplo →
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {demo && (
          <div className="rounded-lg border border-line bg-panel px-4 py-3 text-sm text-zinc-400">
            <span className="font-medium text-zinc-200">Conversación de ejemplo.</span> Respuestas reales del sistema guardadas
            para la demo; escribe abajo para empezar una nueva.
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="max-w-[85%] self-end rounded-2xl rounded-br-sm bg-panel-2 px-4 py-2.5 whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="flex gap-3">
              <span className="mt-1 flex h-7 w-7 shrink-0 -skew-x-12 items-center justify-center rounded-sm bg-f1-red font-display text-xs font-bold text-white">
                <span className="skew-x-12">F1</span>
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="prose-chat">
                  <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                </div>
                {m.metadata && <AgentTrace meta={m.metadata} />}
              </div>
            </div>
          ),
        )}
        {sending && (
          <div className="pl-10">
            <Spinner label="Consultando datos…" />
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
    <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
      {meta.status === 'rejected_domain' && <Chip tone="amber">Fuera de dominio</Chip>}
      {meta.status === 'llm_error' && <Chip tone="amber">LLM no disponible</Chip>}
      {meta.toolCalls.map((t, i) => (
        <span key={i} title={JSON.stringify(t.args)}>
          <Chip tone={t.error ? 'amber' : 'red'}>🔧 {TOOL_LABELS[t.name] ?? t.name}</Chip>
        </span>
      ))}
      {meta.status === 'ok' && meta.toolCalls.length > 0 && meta.consistencySuspects.length === 0 && <Chip>✓ Cifras verificadas</Chip>}
      {meta.consistencySuspects.length > 0 && <Chip tone="amber">⚠️ Revisar: {meta.consistencySuspects.join(', ')}</Chip>}
      <span className="ml-auto text-xs text-zinc-500">
        {meta.model.replace('models/', '')} · {(meta.latencyMs / 1000).toFixed(1)} s
      </span>
    </div>
  );
}
