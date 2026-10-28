import { useCallback, useEffect, useState } from 'react';
import { api, type ConversationSummary, type Message } from '../api';
import { ChatInput } from '../components/ChatInput';
import { DEMO_CONVERSATION } from '../components/demo';
import { MessageList } from '../components/MessageList';
import { Sidebar } from '../components/Sidebar';
import { ErrorNote } from '../components/ui';

export function Assistant() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showDemo, setShowDemo] = useState(false);
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
    setShowDemo(false);
    api
      .getConversation(activeId)
      .then((c) => setMessages(c.messages))
      .catch((e: Error) => setError(e.message));
  }, [activeId]);

  async function send(content: string) {
    setError(null);
    setShowDemo(false);
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
    <div className="flex h-[calc(100vh-3.5rem)]">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        demoActive={showDemo}
        open={sidebarOpen}
        onSelect={(id) => {
          setActiveId(id);
          setSidebarOpen(false);
        }}
        onNew={() => {
          setActiveId(null);
          setShowDemo(false);
          setSidebarOpen(false);
        }}
        onDemo={() => {
          setActiveId(null);
          setShowDemo(true);
          setSidebarOpen(false);
        }}
        onDelete={(id) => remove(id).catch((e: Error) => setError(e.message))}
        onClose={() => setSidebarOpen(false)}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 md:hidden">
          <button className="rounded p-1 text-zinc-400 hover:bg-panel-2" onClick={() => setSidebarOpen(true)} aria-label="Abrir conversaciones">
            ☰
          </button>
          <span className="truncate text-sm text-zinc-400">
            {showDemo ? 'Conversación de ejemplo' : (conversations.find((c) => c.id === activeId)?.title ?? 'Nueva conversación')}
          </span>
        </div>

        <MessageList
          messages={showDemo ? DEMO_CONVERSATION : messages}
          sending={sending}
          demo={showDemo}
          onSuggestion={send}
          onShowDemo={() => setShowDemo(true)}
        />

        {error && (
          <div className="mx-auto mb-2 w-full max-w-3xl px-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        <ChatInput disabled={sending} onSend={send} />
      </section>
    </div>
  );
}
