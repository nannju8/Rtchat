import { useCallback, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { isSupabaseConfigured } from "./lib/supabase";
import { useGroups } from "./hooks/useGroups";
import { AuthScreen } from "./components/AuthScreen";
import { ChatArea } from "./components/ChatArea";
import { ChatIcon, Spinner } from "./components/Icons";
import { SetupScreen } from "./components/SetupScreen";
import { Sidebar } from "./components/Sidebar";

function ChatLayout({ userId, username, onSignOut }: { userId: string; username: string; onSignOut: () => void }) {
  const { groups, loading, error, createGroup } = useGroups(userId);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Sur mobile : true = liste des groupes, false = conversation
  const [showList, setShowList] = useState(true);

  // Sur ordinateur, ouvre automatiquement « Général » (ou le premier groupe)
  useEffect(() => {
    if (activeId || groups.length === 0) return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      const general = groups.find((g) => g.name.toLowerCase() === "général") ?? groups[0];
      setActiveId(general.id);
      setShowList(false);
    }
  }, [groups, activeId]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    setShowList(false);
  }, []);

  const activeGroup = groups.find((g) => g.id === activeId) ?? null;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-white">
      <Sidebar
        className={`${showList ? "flex" : "hidden"} w-full md:flex md:w-80 md:shrink-0`}
        groups={groups}
        loading={loading}
        error={error}
        activeId={activeId}
        username={username}
        onSelect={handleSelect}
        onCreate={createGroup}
        onSignOut={onSignOut}
      />

      <main className={`${showList ? "hidden" : "flex"} min-w-0 flex-1 md:flex`}>
        {activeGroup ? (
          <ChatArea
            key={activeGroup.id}
            group={activeGroup}
            me={{ id: userId, username }}
            onBack={() => setShowList(true)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 p-6 text-center text-slate-500">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <ChatIcon width={32} height={32} />
            </div>
            <p className="font-semibold text-slate-700">Sélectionnez un groupe</p>
            <p className="text-sm">Choisissez une discussion dans la liste ou créez-en une nouvelle.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function Root() {
  const { session, user, username, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-slate-500">
        <Spinner className="mr-2 h-6 w-6 text-indigo-500" />
        Chargement…
      </div>
    );
  }

  // Aucun visiteur anonyme : seul l'écran de connexion / inscription est visible
  if (!session || !user) return <AuthScreen />;

  return <ChatLayout key={user.id} userId={user.id} username={username} onSignOut={signOut} />;
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupScreen />;
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
