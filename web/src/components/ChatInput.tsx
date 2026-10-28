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
    <form onSubmit={submit} className="px-4 pt-2 pb-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-line bg-panel p-2 focus-within:border-zinc-500">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={2000}
          placeholder="Pregunta sobre Fórmula 1…"
          aria-label="Mensaje"
          className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-zinc-500"
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="rounded-xl bg-f1-red px-4 py-2 text-sm font-medium text-white hover:bg-f1-red-dark disabled:opacity-30"
        >
          Enviar
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-zinc-600">
        Las respuestas se basan en datos de Ergast (1950–2024) y OpenF1. Las predicciones son estimaciones del modelo.
      </p>
    </form>
  );
}
