import type { ReactNode } from 'react';

export const nf = new Intl.NumberFormat('es-ES');

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 font-display text-xl font-bold whitespace-nowrap italic tracking-tight ${className}`}>
      <span className="flex h-7 w-7 -skew-x-12 items-center justify-center rounded-sm bg-f1-red text-sm not-italic text-white">
        <span className="skew-x-12">F1</span>
      </span>
      <span className="hidden sm:inline">
        F1<span className="text-f1-red">-</span>GPT
      </span>
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-panel ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-f1-red uppercase">
      <span className="h-px w-6 bg-f1-red" />
      {children}
    </p>
  );
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="max-w-2xl space-y-3">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {children && <p className="text-zinc-400">{children}</p>}
    </div>
  );
}

export function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'red' | 'amber' }) {
  const tones = {
    default: 'border-line bg-panel-2 text-zinc-300',
    red: 'border-f1-red/40 bg-f1-red/10 text-red-200',
    amber: 'border-amber-700/60 bg-amber-950/40 text-amber-200',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}

export function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400" role="status">
      <span className="h-2 w-2 animate-pulse rounded-full bg-f1-red" />
      {label}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
      {children}
    </div>
  );
}
