import { useState } from 'react';
import type { StandingRow } from '../api';
import { nf } from './ui';

/**
 * Barras horizontales de una sola serie (puntos por piloto). Un único color,
 * etiquetas en tinta de texto y tooltip por barra; alternativa en tabla.
 */
export function StandingsChart({ rows, year }: { rows: StandingRow[]; year: number }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...rows.map((r) => r.points), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Mundial de pilotos {year}</h3>
          <p className="text-sm text-zinc-500">Puntos al final de la temporada · top {rows.length}</p>
        </div>
        <div className="flex rounded-lg border border-line p-0.5 text-xs" role="tablist">
          {(['chart', 'table'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 ${view === v ? 'bg-panel-2 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              {v === 'chart' ? 'Gráfico' : 'Tabla'}
            </button>
          ))}
        </div>
      </div>

      {view === 'chart' ? (
        <ul className="space-y-1" onMouseLeave={() => setHover(null)}>
          {rows.map((r, i) => {
            const active = hover === i;
            return (
              <li
                key={r.driver}
                className="group relative grid grid-cols-[1.5rem_8.5rem_1fr] items-center gap-3 rounded-md py-1.5 sm:grid-cols-[1.5rem_11rem_1fr]"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={0}
                aria-label={`${r.position}. ${r.driver}, ${r.constructor ?? ''}: ${nf.format(r.points)} puntos, ${r.wins} victorias`}
              >
                <span className="text-right font-display text-sm font-bold text-zinc-500 tabular-nums">{r.position}</span>
                <span className={`truncate text-sm ${active ? 'text-white' : 'text-zinc-300'}`}>{r.driver}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`h-3.5 rounded-r-[4px] bg-f1-red transition-opacity ${hover !== null && !active ? 'opacity-40' : ''}`}
                    style={{ width: `${Math.max((r.points / max) * 100, 0.5)}%` }}
                  />
                  <span className="shrink-0 text-xs text-zinc-400 tabular-nums">{nf.format(r.points)}</span>
                </span>
                {active && (
                  <div className="pointer-events-none absolute top-full right-0 z-10 mt-1 w-52 rounded-lg border border-line bg-panel-2 p-3 text-xs shadow-xl sm:right-auto sm:left-[13rem]">
                    <p className="font-semibold text-white">{r.driver}</p>
                    <p className="text-zinc-400">{r.constructor ?? '—'}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-y-1 text-zinc-300">
                      <dt className="text-zinc-500">Puntos</dt>
                      <dd className="text-right tabular-nums">{nf.format(r.points)}</dd>
                      <dt className="text-zinc-500">Victorias</dt>
                      <dd className="text-right tabular-nums">{r.wins}</dd>
                    </dl>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr>
              <th className="py-2 font-medium">Pos.</th>
              <th className="py-2 font-medium">Piloto</th>
              <th className="py-2 font-medium">Equipo</th>
              <th className="py-2 text-right font-medium">Victorias</th>
              <th className="py-2 text-right font-medium">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.driver} className="border-t border-line">
                <td className="py-2 tabular-nums">{r.position}</td>
                <td className="py-2">{r.driver}</td>
                <td className="py-2 text-zinc-400">{r.constructor}</td>
                <td className="py-2 text-right tabular-nums">{r.wins}</td>
                <td className="py-2 text-right tabular-nums">{nf.format(r.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
