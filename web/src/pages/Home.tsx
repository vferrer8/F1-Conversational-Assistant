import { useEffect, useState } from 'react';
import { api, type DatasetStats } from '../api';
import type { PageId } from '../App';
import { Card, Chip, Eyebrow, SectionTitle, nf } from '../components/ui';

const PIPELINE = [
  {
    title: 'Filtro de dominio',
    text: 'Antes de gastar un token, un filtro léxico bilingüe descarta lo que no es Fórmula 1. Las preguntas de seguimiento heredan el contexto.',
  },
  {
    title: 'Razonamiento + tools',
    text: 'Gemini decide qué herramienta usar. Nunca escribe SQL ni inventa datos: delega en funciones deterministas.',
  },
  {
    title: 'Validación de tools',
    text: 'Solo se ejecutan herramientas de una lista blanca. Cada llamada queda registrada con sus argumentos y su resultado.',
  },
  {
    title: 'Verificación numérica',
    text: 'Las cifras de la respuesta se contrastan con lo que devolvieron las herramientas. Si algo no cuadra, se avisa.',
  },
];

const TOOLS = [
  { name: 'get_race_results', title: 'Resultados de carrera', source: 'Ergast · SQLite', text: 'Orden de llegada, equipos y puntos de cualquier GP desde 1950.' },
  { name: 'get_season_standings', title: 'Clasificación del Mundial', source: 'Ergast · SQLite', text: 'Campeón y tabla final de pilotos de cada temporada, con puntos y victorias.' },
  { name: 'get_driver_standings', title: 'Ficha de piloto', source: 'Ergast · SQLite', text: 'Nacionalidad, número y datos básicos de cada piloto.' },
  { name: 'get_telemetry', title: 'Telemetría', source: 'OpenF1 API', text: 'Tiempos por vuelta y sectores de sesiones desde 2023.' },
  { name: 'predict_position', title: 'Predicción XGBoost', source: 'Modelo propio', text: 'Posición final estimada a partir de 10 variables pre-carrera.' },
];

const SERVICES = [
  { name: 'web', role: 'Interfaz', stack: ['React', 'TypeScript', 'Vite', 'Tailwind CSS'] },
  { name: 'chat-api', role: 'Conversaciones y datos', stack: ['NestJS', 'Prisma', 'SQLite'] },
  { name: 'agent-service', role: 'Agente de IA', stack: ['FastAPI', 'SQLAlchemy', 'Alembic', 'Pydantic', 'Gemini', 'XGBoost'] },
];

export function Home({ onNavigate }: { onNavigate: (id: PageId) => void }) {
  const [stats, setStats] = useState<DatasetStats | null>(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => setStats(null));
  }, []);

  const tiles = stats
    ? [
        { value: nf.format(stats.seasons), label: `Temporadas (${stats.first_season}–${stats.last_season})` },
        { value: nf.format(stats.races), label: 'Grandes Premios' },
        { value: nf.format(stats.drivers), label: 'Pilotos' },
        { value: nf.format(stats.results), label: 'Resultados de carrera' },
        { value: nf.format(stats.lap_times), label: 'Tiempos por vuelta' },
      ]
    : null;

  return (
    <>
      {/* Hero */}
      <section className="speed-lines border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div className="flex flex-col justify-center gap-6">
            <Eyebrow>TFM · Máster en Inteligencia Artificial</Eyebrow>
            <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-tight sm:text-6xl">
              Un ingeniero de datos de Fórmula 1 <span className="text-f1-red">que responde en lenguaje natural</span>
            </h1>
            <p className="max-w-xl text-lg text-zinc-400">
              F1-GPT combina un LLM con 75 temporadas de datos históricos, telemetría reciente y un modelo XGBoost que
              estima la posición final de carrera. Con guardarraíles para que no invente cifras.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate('asistente')}
                className="rounded-lg bg-f1-red px-5 py-2.5 font-medium text-white transition-colors hover:bg-f1-red-dark"
              >
                Abrir el asistente
              </button>
              <button
                onClick={() => onNavigate('predictor')}
                className="rounded-lg border border-line bg-panel px-5 py-2.5 font-medium text-zinc-200 transition-colors hover:border-zinc-500"
              >
                Probar el predictor
              </button>
            </div>
          </div>
          <ChatPreview />
        </div>
      </section>

      {/* Cifras */}
      <section className="border-b border-line bg-panel/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:grid-cols-3 lg:grid-cols-5">
          {(tiles ?? Array.from({ length: 5 }, () => null)).map((t, i) => (
            <div key={i} className="px-2 py-8">
              <p className="font-display text-3xl font-bold tabular-nums sm:text-4xl">
                {t ? t.value : <span className="inline-block h-9 w-24 animate-pulse rounded bg-panel-2" />}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{t?.label ?? ' '}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto w-full max-w-6xl space-y-10 px-4 py-20">
        <SectionTitle eyebrow="Cómo funciona" title="Cada pregunta pasa por cuatro controles">
          El LLM razona, pero los datos los ponen las herramientas. Tres guardarraíles encadenados vigilan la entrada, la
          ejecución y la salida.
        </SectionTitle>
        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((step, i) => (
            <li key={step.title}>
              <Card className="relative h-full overflow-hidden p-5">
                <span className="absolute -top-3 -right-1 font-display text-7xl font-bold text-white/[0.04]">{i + 1}</span>
                <span className="font-display text-sm font-bold text-f1-red">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Herramientas */}
      <section className="border-y border-line bg-panel/40">
        <div className="mx-auto max-w-6xl space-y-10 px-4 py-20">
          <SectionTitle eyebrow="Herramientas del agente" title="Cinco fuentes de verdad">
            El modelo de lenguaje elige entre estas funciones mediante tool calling. Sus resultados son lo único que puede
            citar.
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => (
              <Card key={t.name} className="flex gap-4 p-5">
                <span className="mt-1 h-10 w-1 shrink-0 rounded-full bg-f1-red" />
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{t.title}</h3>
                    <Chip>{t.source}</Chip>
                  </div>
                  <p className="text-sm text-zinc-400">{t.text}</p>
                  <code className="text-xs text-zinc-500">{t.name}()</code>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Arquitectura */}
      <section className="mx-auto w-full max-w-6xl space-y-10 px-4 py-20">
        <SectionTitle eyebrow="Arquitectura" title="Tres servicios, dos lenguajes">
          El agente en Python, donde vive el ecosistema de IA. Las conversaciones en TypeScript. Preparado para desplegar
          en Google Cloud Run con Cloud Build y Secret Manager.
        </SectionTitle>
        <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {SERVICES.map((s, i) => (
            <div key={s.name} className="contents">
              <Card className="space-y-3 p-5">
                <div>
                  <p className="font-mono text-sm text-f1-red">{s.name}</p>
                  <p className="font-semibold">{s.role}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.stack.map((tech) => (
                    <Chip key={tech}>{tech}</Chip>
                  ))}
                </div>
              </Card>
              {i < SERVICES.length - 1 && (
                <div className="flex items-center justify-center text-zinc-600" aria-hidden>
                  <span className="hidden lg:inline">→</span>
                  <span className="lg:hidden">↓</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/** Conversación real capturada del sistema, como escaparate del hero. */
function ChatPreview() {
  return (
    <Card className="self-center overflow-hidden shadow-2xl shadow-f1-red/5">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
        <span className="ml-2 text-xs text-zinc-500">Ejemplo de conversación</span>
      </div>
      <div className="space-y-4 p-5 text-sm">
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-panel-2 px-4 py-2">
          ¿Quién ganó el GP de Monza en 2019?
        </p>
        <div className="space-y-3">
          <p className="text-zinc-300">
            <strong className="text-white">Charles Leclerc</strong> con Ferrari, una victoria histórica en casa para la
            Scuderia. El podio:
          </p>
          <div className="overflow-hidden rounded-lg border border-line">
            {[
              ['1', 'Charles Leclerc', 'Ferrari'],
              ['2', 'Valtteri Bottas', 'Mercedes'],
              ['3', 'Lewis Hamilton', 'Mercedes'],
            ].map(([pos, name, team]) => (
              <div key={pos} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0">
                <span className="w-4 font-display font-bold text-f1-red">{pos}</span>
                <span className="flex-1">{name}</span>
                <span className="text-zinc-500">{team}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="red">🔧 get_race_results</Chip>
            <Chip>year: 2019</Chip>
            <Chip>✓ cifras verificadas</Chip>
          </div>
        </div>
      </div>
    </Card>
  );
}
