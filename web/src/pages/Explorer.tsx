import { useEffect, useState } from 'react';
import { api, type Race, type RaceResult, type StandingRow } from '../api';
import { StandingsChart } from '../components/StandingsChart';
import { Card, ErrorNote, SectionTitle, Spinner, nf } from '../components/ui';

const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

export function Explorer() {
  const [seasons, setSeasons] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [races, setRaces] = useState<Race[] | null>(null);
  const [race, setRace] = useState<Race | null>(null);
  const [results, setResults] = useState<RaceResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .seasons()
      .then((s) => {
        setSeasons(s);
        setYear(s[0] ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (year === null) return;
    setStandings(null);
    setRaces(null);
    setRace(null);
    Promise.all([api.standings(year), api.races(year)])
      .then(([s, r]) => {
        setStandings(s);
        setRaces(r);
        setRace(r[r.length - 1] ?? null);
      })
      .catch((e: Error) => setError(e.message));
  }, [year]);

  useEffect(() => {
    if (year === null || !race) return;
    setResults(null);
    api
      .results(year, race.name)
      .then(setResults)
      .catch((e: Error) => setError(e.message));
  }, [year, race]);

  const idx = year === null ? -1 : seasons.indexOf(year);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle eyebrow="Explorador de datos" title="75 temporadas de Fórmula 1">
          Los mismos datos que consulta el agente, sin pasar por el LLM.
        </SectionTitle>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-line px-3 py-2 text-zinc-400 hover:text-white disabled:opacity-30"
            disabled={idx >= seasons.length - 1}
            onClick={() => setYear(seasons[idx + 1])}
            aria-label="Temporada anterior"
          >
            ←
          </button>
          <select className="select w-28 font-display text-base font-bold" value={year ?? ''} onChange={(e) => setYear(Number(e.target.value))} aria-label="Temporada">
            {seasons.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            className="rounded-lg border border-line px-3 py-2 text-zinc-400 hover:text-white disabled:opacity-30"
            disabled={idx <= 0}
            onClick={() => setYear(seasons[idx - 1])}
            aria-label="Temporada siguiente"
          >
            →
          </button>
        </div>
      </div>

      {error && <ErrorNote>No se pudieron cargar los datos: {error}</ErrorNote>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          {standings && year !== null ? <StandingsChart rows={standings} year={year} /> : <Spinner label="Cargando clasificación…" />}
        </Card>

        <Card className="flex max-h-[34rem] flex-col p-5">
          <h3 className="font-semibold">Calendario</h3>
          <p className="text-sm text-zinc-500">{races ? `${races.length} Grandes Premios` : ' '}</p>
          <ol className="mt-3 -mr-2 flex-1 space-y-0.5 overflow-y-auto pr-2">
            {races?.map((r) => (
              <li key={r.round}>
                <button
                  onClick={() => setRace(r)}
                  className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm ${
                    race?.round === r.round ? 'bg-panel-2 text-white' : 'text-zinc-300 hover:bg-panel-2/60'
                  }`}
                >
                  <span className="w-6 font-display font-bold text-zinc-500 tabular-nums">{r.round}</span>
                  <span className="flex-1 truncate">{r.name.replace(' Grand Prix', '')}</span>
                  <span className="text-xs text-zinc-500">{r.date ? dateFmt.format(new Date(r.date)) : ''}</span>
                </button>
              </li>
            )) ?? <Spinner label="Cargando calendario…" />}
          </ol>
        </Card>
      </div>

      {race && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <p className="text-xs text-zinc-500">
                Ronda {race.round} · {year}
              </p>
              <h3 className="font-display text-2xl font-bold">{race.name}</h3>
            </div>
            {race.date && (
              <p className="text-sm text-zinc-500">
                {new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(race.date))}
              </p>
            )}
          </div>
          {results ? <ResultsTable rows={results} /> : <div className="p-5"><Spinner label="Cargando resultados…" /></div>}
        </Card>
      )}
    </div>
  );
}

function ResultsTable({ rows }: { rows: RaceResult[] }) {
  if (rows.length === 0) return <p className="p-5 text-sm text-zinc-500">Sin resultados para esta carrera.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr>
            <th className="px-5 py-2 font-medium">Pos.</th>
            <th className="py-2 font-medium">Piloto</th>
            <th className="py-2 font-medium">Equipo</th>
            <th className="py-2 text-right font-medium">Salida</th>
            <th className="py-2 text-right font-medium">+/-</th>
            <th className="px-5 py-2 text-right font-medium">Puntos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pos = r.final_position_order ?? 0;
            const classified = r.final_position !== null;
            const delta = classified && r.grid_position ? r.grid_position - pos : null;
            return (
              <tr key={`${r.driver_name}-${pos}`} className="border-t border-line">
                <td className="px-5 py-2">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded font-display font-bold tabular-nums ${
                      pos <= 3 && classified ? 'bg-f1-red text-white' : 'text-zinc-400'
                    }`}
                  >
                    {classified ? pos : '—'}
                  </span>
                </td>
                <td className="py-2 font-medium">{r.driver_name}</td>
                <td className="py-2 text-zinc-400">{r.constructor}</td>
                <td className="py-2 text-right text-zinc-400 tabular-nums">{r.grid_position || 'Pit'}</td>
                <td className="py-2 text-right text-xs tabular-nums">
                  {delta === null || delta === 0 ? (
                    <span className="text-zinc-600">—</span>
                  ) : delta > 0 ? (
                    <span className="text-emerald-400">▲ {delta}</span>
                  ) : (
                    <span className="text-rose-400">▼ {-delta}</span>
                  )}
                </td>
                <td className="px-5 py-2 text-right tabular-nums">{r.points ? nf.format(r.points) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
