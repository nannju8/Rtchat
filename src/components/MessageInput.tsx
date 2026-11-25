import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { SendIcon, Spinner } from "./Icons";

interface Props {
  groupId: string;
  groupName: string;
  onSend: (content: string) => Promise<{ error?: string }>;
}

export function MessageInput({ groupId, groupName, onSend }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false); // protège contre le double envoi (avant re-render)
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Réinitialise la saisie quand on change de groupe
  useEffect(() => {
    setText("");
    setError(null);
  }, [groupId]);

  // Hauteur auto du champ de saisie
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const submit = async () => {
    const content = text.trim();
    if (!content || lockRef.current) return;

    lockRef.current = true;
    setSending(true);
    setError(null);
    const res = await onSend(content);
    lockRef.current = false;
    setSending(false);

    if (res.error) {
      setError(res.error);
    } else {
      setText("");
    }
    textareaRef.current?.focus();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  const canSend = text.trim().length > 0 && !sending;

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
    >
      {error && (
        <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={2000}
          placeholder={`Écrire dans #${groupName}…`}
          aria-label="Votre message"
          className="max-h-36 min-h-[46px] flex-1 resize-none rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="flex h-[46px] items-center gap-2 rounded-2xl bg-indigo-600 px-4 font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-300 sm:px-5"
        >
          {sending ? <Spinner className="h-5 w-5" /> : <SendIcon width={18} height={18} />}
          <span>Envoyer</span>
        </button>
      </div>
    </form>
  );
}
