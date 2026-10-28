import { useEffect, useState } from 'react';
import { api } from './api';
import { Logo } from './components/ui';
import { Assistant } from './pages/Assistant';
import { Explorer } from './pages/Explorer';
import { Home } from './pages/Home';
import { Predictor } from './pages/Predictor';

const PAGES = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'asistente', label: 'Asistente' },
  { id: 'datos', label: 'Datos' },
  { id: 'predictor', label: 'Predictor' },
] as const;
export type PageId = (typeof PAGES)[number]['id'];

function readHash(): PageId {
  const id = window.location.hash.replace('#/', '');
  return PAGES.some((p) => p.id === id) ? (id as PageId) : 'inicio';
}

export default function App() {
  const [page, setPage] = useState<PageId>(readHash);
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const onHash = () => {
      setPage(readHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    api
      .health()
      .then((h) => setOnline(h.agentService === 'ok'))
      .catch(() => setOnline(false));
  }, []);

  const go = (id: PageId) => {
    window.location.hash = `/${id}`;
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6">
          <a href="#/inicio" aria-label="Inicio">
            <Logo />
          </a>
          <nav className="flex gap-0.5 overflow-x-auto text-sm sm:gap-1">
            {PAGES.map((p) => (
              <a
                key={p.id}
                href={`#/${p.id}`}
                className={`relative rounded-md px-2 py-1.5 whitespace-nowrap transition-colors sm:px-3 ${
                  page === p.id ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {p.label}
                {page === p.id && <span className="absolute inset-x-2 -bottom-[13px] h-0.5 bg-f1-red sm:inset-x-3" />}
              </a>
            ))}
          </nav>
          <StatusPill online={online} />
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {page === 'inicio' && <Home onNavigate={go} />}
        {page === 'asistente' && <Assistant />}
        {page === 'datos' && <Explorer />}
        {page === 'predictor' && <Predictor />}
      </main>

      {page !== 'asistente' && (
        <footer className="border-t border-line">
          <div className="checkered h-1.5 opacity-[0.07]" />
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-zinc-500 sm:flex-row sm:justify-between">
            <p>Trabajo de Fin de Máster · Máster Universitario en Inteligencia Artificial · UTAMED</p>
            <p>Víctor Ferrer Teixidor · Datos: Ergast (1950–2024) y OpenF1</p>
          </div>
        </footer>
      )}
    </div>
  );
}

function StatusPill({ online }: { online: boolean | null }) {
  if (online === null) return <span className="ml-auto" />;
  return (
    <span
      className={`ml-auto hidden items-center gap-2 rounded-full border px-3 py-1 text-xs sm:inline-flex ${
        online ? 'border-emerald-800/60 text-emerald-300' : 'border-amber-800/60 text-amber-300'
      }`}
      title={online ? 'Chat API y agent-service responden' : 'El agent-service no responde'}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {online ? 'Servicios operativos' : 'Agente no disponible'}
    </span>
  );
}
