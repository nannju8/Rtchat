import { useState } from "react";
import type { Group } from "../types";
import { Avatar } from "./Avatar";
import { CreateGroupModal } from "./CreateGroupModal";
import { HashIcon, LogoutIcon, PlusIcon, Spinner } from "./Icons";

interface Props {
  groups: Group[];
  loading: boolean;
  error: string | null;
  activeId: string | null;
  username: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<{ group?: Group; error?: string }>;
  onSignOut: () => void;
  className?: string;
}

export function Sidebar({
  groups,
  loading,
  error,
  activeId,
  username,
  onSelect,
  onCreate,
  onSignOut,
  className = "",
}: Props) {
  const [creating, setCreating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleCreate = async (name: string) => {
    const res = await onCreate(name);
    if (res.group) onSelect(res.group.id);
    return { error: res.error };
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await onSignOut();
  };

  return (
    <aside className={`flex-col border-r border-slate-200 bg-white ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-4">
        <h1 className="text-lg font-bold text-slate-900">Groupes</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-200"
        >
          <PlusIcon width={16} height={16} />
          Nouveau
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2" aria-label="Groupes de discussion">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Spinner className="h-5 w-5 text-indigo-500" />
            Chargement des groupes…
          </div>
        )}
        {error && (
          <p role="alert" className="m-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {!loading && !error && groups.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-slate-500">
            Aucun groupe pour le moment. Créez le premier !
          </p>
        )}
        <ul className="space-y-1">
          {groups.map((g) => {
            const active = g.id === activeId;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => onSelect(g.id)}
                  aria-current={active ? "true" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                    active
                      ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <HashIcon width={18} height={18} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex items-center gap-3 border-t border-slate-200 p-3">
        <Avatar name={username} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{username}</p>
          <p className="text-xs text-emerald-600">Connecté</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
          title="Se déconnecter"
        >
          {signingOut ? <Spinner className="h-4 w-4" /> : <LogoutIcon width={18} height={18} />}
          <span>Déconnexion</span>
        </button>
      </div>

      {creating && <CreateGroupModal onClose={() => setCreating(false)} onCreate={handleCreate} />}
    </aside>
  );
}
