import { useState, type FormEvent, type KeyboardEvent } from 'react';

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
}

export function ChatInput({ disabled, onSend }: Props) {
  const [text, setText] = useState('');

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const value = text.trim();
    if (!value || disabled) return;
    onSend(value);
    setText('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) submit(e);
  }

  return (
    <form onSubmit={submit} className="border-t border-zinc-800 p-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={2000}
          placeholder="Pregunta lo que quieras sobre Fórmula 1…"
          className="max-h-40 flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="rounded-xl bg-f1-red px-4 py-3 text-sm font-medium text-white hover:bg-f1-red-dark disabled:opacity-40"
        >
          Enviar
        </button>
      </div>
    </form>
  );
}
