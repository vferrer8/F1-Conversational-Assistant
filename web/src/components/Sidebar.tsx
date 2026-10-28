import type { ConversationSummary } from '../api';

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  demoActive: boolean;
  open: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDemo: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function Sidebar({ conversations, activeId, demoActive, open, onSelect, onNew, onDemo, onDelete, onClose }: Props) {
  const item = (active: boolean) =>
    `group flex items-center rounded-lg ${active ? 'bg-panel-2 text-white' : 'text-zinc-300 hover:bg-panel-2/60'}`;

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-panel transition-transform md:static md:z-auto md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-3">
          <button
            onClick={onNew}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-f1-red px-3 py-2 text-sm font-medium text-white hover:bg-f1-red-dark"
          >
            <span className="text-base leading-none">+</span> Nueva conversación
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-3 text-sm">
          <div>
            <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Ejemplo</p>
            <div className={item(demoActive)}>
              <button onClick={onDemo} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-f1-red" />
                <span className="truncate">Monza 2019 y predicción</span>
              </button>
            </div>
          </div>

          <div>
            <p className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">Tus conversaciones</p>
            {conversations.length === 0 && <p className="px-2 py-1 text-zinc-500">Todavía no hay ninguna.</p>}
            {conversations.map((c) => (
              <div key={c.id} className={item(c.id === activeId)}>
                <button onClick={() => onSelect(c.id)} className="min-w-0 flex-1 truncate px-2 py-2 text-left">
                  {c.title}
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  className="px-2 text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-red-400 focus:opacity-100"
                  aria-label={`Borrar ${c.title}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
}
