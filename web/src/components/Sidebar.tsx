import type { ConversationSummary } from '../api';

interface Props {
  conversations: ConversationSummary[];
  activeId: string | null;
  open: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function Sidebar({ conversations, activeId, open, onSelect, onNew, onDelete, onClose }: Props) {
  return (
    <>
      {open && <div className="fixed inset-0 z-10 bg-black/60 md:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex w-72 flex-col border-r border-zinc-800 bg-zinc-900 transition-transform md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-3">
          <button
            onClick={onNew}
            className="w-full rounded-md bg-f1-red px-3 py-2 text-sm font-medium text-white hover:bg-f1-red-dark"
          >
            + Nueva conversación
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {conversations.length === 0 && <p className="px-2 text-sm text-zinc-500">Sin conversaciones todavía.</p>}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center rounded-md ${c.id === activeId ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'}`}
            >
              <button onClick={() => onSelect(c.id)} className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm">
                {c.title}
              </button>
              <button
                onClick={() => onDelete(c.id)}
                className="px-2 text-zinc-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
                aria-label={`Borrar ${c.title}`}
              >
                ✕
              </button>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
