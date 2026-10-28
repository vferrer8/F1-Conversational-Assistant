import { useCallback, useEffect, useState } from 'react';
import { api, type ConversationSummary, type Message } from './api';
import { ChatInput } from './components/ChatInput';
import { MessageList } from './components/MessageList';
import { Sidebar } from './components/Sidebar';

export default function App() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refreshList = useCallback(async () => {
    setConversations(await api.listConversations());
  }, []);

  useEffect(() => {
    refreshList().catch((e: Error) => setError(e.message));
  }, [refreshList]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    api
      .getConversation(activeId)
      .then((c) => setMessages(c.messages))
      .catch((e: Error) => setError(e.message));
  }, [activeId]);

  async function send(content: string) {
    setError(null);
    setSending(true);
    // Mensaje optimista mientras responde el agente.
    const pending: Message = {
      id: `pending-${Date.now()}`,
      role: 'user',
      content,
      metadata: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, pending]);
    try {
      const id = activeId ?? (await api.createConversation()).id;
      const { userMessage, assistantMessage } = await api.sendMessage(id, content);
      setMessages((m) => [...m.filter((x) => x.id !== pending.id), userMessage, assistantMessage]);
      if (!activeId) setActiveId(id);
      await refreshList();
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== pending.id));
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    await api.deleteConversation(id);
    if (id === activeId) setActiveId(null);
    await refreshList();
  }

  return (
    <div className="flex h-full">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        open={sidebarOpen}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarOpen(false);
        }}
        onNew={() => {
          setActiveId(null);
          setSidebarOpen(false);
        }}
        onDelete={(id) => remove(id).catch((e: Error) => setError(e.message))}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <button
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir conversaciones"
          >
            ☰
          </button>
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-f1-red">F1</span>-GPT
          </h1>
          <span className="hidden text-sm text-zinc-500 sm:inline">
            Histórico 1950–2024 · Telemetría OpenF1 · Predicción XGBoost
          </span>
        </header>

        <MessageList messages={messages} sending={sending} onSuggestion={send} />

        {error && (
          <div className="mx-4 mb-2 rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        <ChatInput disabled={sending} onSend={send} />
      </main>
    </div>
  );
}
