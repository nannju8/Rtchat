import { useEffect, useRef, useState, type FormEvent } from "react";
import { CloseIcon, Spinner } from "./Icons";

interface Props {
  onClose: () => void;
  onCreate: (name: string) => Promise<{ error?: string }>;
}

export function CreateGroupModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) {
      setError("Saisissez un nom de groupe.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await onCreate(name);
    setSubmitting(false);
    if (res.error) setError(res.error);
    else onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="create-group-title" className="text-lg font-bold text-slate-900">
            Nouveau groupe
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fermer"
          >
            <CloseIcon />
          </button>
        </div>

        <label htmlFor="group-name" className="mb-1.5 block text-sm font-medium text-slate-700">
          Nom du groupe
        </label>
        <input
          id="group-name"
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          disabled={submitting}
          placeholder="Ex. : Projet vacances"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting && <Spinner className="h-4 w-4" />}
            Créer
          </button>
        </div>
      </form>
    </div>
  );
}
