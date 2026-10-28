import { useEffect, useState, type FormEvent } from 'react';
import { api, type Prediction, type PredictionInput, type PredictorOptions } from '../api';
import { Card, ErrorNote, SectionTitle, Spinner } from '../components/ui';

const FEATURE_LABELS: Record<string, { label: string; format?: (v: number) => string }> = {
  grid: { label: 'Posición de salida', format: (v) => `P${v}` },
  driver_pos_before: { label: 'Posición en el Mundial antes de la carrera', format: (v) => `P${Math.round(v)}` },
  driver_wins_before: { label: 'Victorias en la temporada' },
  constructor_pos_before: { label: 'Posición del equipo en el Mundial', format: (v) => `P${Math.round(v)}` },
  avg_finish_last3: { label: 'Media de las 3 últimas carreras', format: (v) => v.toFixed(1) },
  driver_experience: { label: 'Grandes Premios disputados' },
  driver_age: { label: 'Edad del piloto', format: (v) => `${Math.round(v)} años` },
  season_progress: { label: 'Progreso de la temporada', format: (v) => `${Math.round(v * 100)} %` },
  circuit_alt: { label: 'Altitud del circuito', format: (v) => `${Math.round(v)} m` },
  year: { label: 'Temporada' },
};

const LAST_SEASON_WITH_DATA = 2024;

export function Predictor() {
  const [options, setOptions] = useState<PredictorOptions | null>(null);
  const [form, setForm] = useState<PredictionInput>({
    year: 2024,
    circuit: 'Autodromo Nazionale Monza',
    driver_number: 16,
    grid: 1,
    constructor_name: 'Ferrari',
  });
  const [result, setResult] = useState<{ input: PredictionInput; prediction: Prediction } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.predictionOptions().then(setOptions).catch((e: Error) => setError(e.message));
  }, []);

  const years = options
    ? [LAST_SEASON_WITH_DATA + 2, LAST_SEASON_WITH_DATA + 1, ...options.seasons.filter((y) => y >= 2000)]
    : [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setResult({ input: form, prediction: await api.predict(form) });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const set = <K extends keyof PredictionInput>(key: K, value: PredictionInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-12">
      <SectionTitle eyebrow="Modelo predictivo" title="¿Dónde acabará la carrera?">
        Un modelo XGBoost entrenado con unas 25.000 participaciones (1950–2024). Calcula 10 variables pre-carrera a partir
        de la base de datos y estima la posición final. Es la misma herramienta que usa el asistente.
      </SectionTitle>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Card className="p-5">
          {!options ? (
            error ? <ErrorNote>{error}</ErrorNote> : <Spinner label="Cargando opciones…" />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field label="Temporada">
                <select className="select" value={form.year} onChange={(e) => set('year', Number(e.target.value))}>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                      {y > LAST_SEASON_WITH_DATA ? ' · sin datos, usa medianas' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Gran Premio">
                <select className="select" value={form.circuit} onChange={(e) => set('circuit', e.target.value)}>
                  {options.circuits.map((c) => (
                    <option key={c.circuit} value={c.circuit}>
                      {c.grand_prix} · {c.circuit}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Piloto">
                <select
                  className="select"
                  value={form.driver_number}
                  onChange={(e) => {
                    const d = options.drivers.find((x) => x.number === Number(e.target.value))!;
                    setForm((f) => ({ ...f, driver_number: d.number, constructor_name: d.constructor }));
                  }}
                >
                  {options.drivers.map((d) => (
                    <option key={d.number} value={d.number}>
                      #{d.number} · {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Equipo">
                <select className="select" value={form.constructor_name} onChange={(e) => set('constructor_name', e.target.value)}>
                  {options.constructors.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label={`Posición de salida: P${form.grid}`}>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={form.grid}
                  onChange={(e) => set('grid', Number(e.target.value))}
                  className="w-full accent-f1-red"
                />
                <div className="flex justify-between text-xs text-zinc-600">
                  <span>Pole</span>
                  <span>P20</span>
                </div>
              </Field>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-f1-red px-4 py-2.5 font-medium text-white hover:bg-f1-red-dark disabled:opacity-50"
              >
                {loading ? 'Calculando…' : 'Predecir posición final'}
              </button>
              {error && <ErrorNote>{error}</ErrorNote>}
            </form>
          )}
        </Card>

        {result ? (
          <PredictionResult {...result} driverName={options?.drivers.find((d) => d.number === result.input.driver_number)?.name} />
        ) : (
          <Card className="flex min-h-80 flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="font-display text-6xl font-bold text-zinc-700">P?</p>
            <p className="max-w-xs text-sm text-zinc-500">Elige carrera, piloto y posición de salida para ver la estimación del modelo.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function PredictionResult({ input, prediction, driverName }: { input: PredictionInput; prediction: Prediction; driverName?: string }) {
  const predicted = Math.round(prediction.predicted_position);
  const delta = input.grid - predicted;

  return (
    <Card className="overflow-hidden">
      <div className="speed-lines border-b border-line p-6">
        <p className="text-sm text-zinc-400">
          {driverName} · {input.constructor_name} · {input.year}
        </p>
        <div className="mt-2 flex items-end gap-4">
          <p className="font-display text-7xl leading-none font-bold">P{predicted}</p>
          <div className="pb-1 text-sm text-zinc-400">
            <p>
              Valor del modelo: <span className="text-zinc-200 tabular-nums">{prediction.predicted_position.toFixed(1)}</span>
            </p>
            <p>
              {delta > 0 ? `Gana ${delta} posiciones` : delta < 0 ? `Pierde ${-delta} posiciones` : 'Mantiene la posición'} respecto a la
              salida (P{input.grid})
            </p>
          </div>
        </div>
        <PositionTrack grid={input.grid} predicted={predicted} />
      </div>

      <div className="p-6">
        <h3 className="text-sm font-semibold">Variables que ha usado el modelo</h3>
        <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
          {Object.entries(FEATURE_LABELS).map(([key, meta]) => {
            const v = prediction.features[key];
            if (v === undefined) return null;
            return (
              <div key={key} className="flex justify-between gap-3 border-b border-line py-2 text-sm">
                <dt className="text-zinc-400">{meta.label}</dt>
                <dd className="text-right tabular-nums">{meta.format ? meta.format(v) : Math.round(v)}</dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-4 text-xs text-zinc-500">⚠️ {prediction.warning}</p>
      </div>
    </Card>
  );
}

/** Parrilla de P1 a P20 con la posición de salida y la estimada. */
function PositionTrack({ grid, predicted }: { grid: number; predicted: number }) {
  return (
    <div className="mt-6">
      <div className="flex gap-0.5" role="img" aria-label={`Sale P${grid}, estimación P${predicted}`}>
        {Array.from({ length: 20 }, (_, i) => i + 1).map((p) => (
          <div
            key={p}
            className={`flex h-7 flex-1 items-center justify-center rounded-sm text-[10px] tabular-nums ${
              p === predicted ? 'bg-f1-red font-bold text-white' : p === grid ? 'border border-zinc-400 text-zinc-200' : 'bg-white/5 text-zinc-600'
            }`}
          >
            {p}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-f1-red" /> Estimación
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-zinc-400" /> Salida
        </span>
      </div>
    </div>
  );
}
