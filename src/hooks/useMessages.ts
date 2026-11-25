import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { translateDbError } from "../lib/errors";
import type { Message, RawMessage } from "../types";

const HISTORY_LIMIT = 200;
const SELECT_WITH_AUTHOR = "id, group_id, user_id, content, created_at, profiles(username)";
const UNKNOWN_USER = "Utilisateur";

function normalize(raw: RawMessage): Message {
  const p = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
  return {
    id: raw.id,
    group_id: raw.group_id,
    user_id: raw.user_id,
    content: raw.content,
    created_at: raw.created_at,
    username: p?.username ?? UNKNOWN_USER,
  };
}

function byDate(a: Message, b: Message): number {
  return Date.parse(a.created_at) - Date.parse(b.created_at);
}

/** Ajoute un message sans doublon (clé : id) et garde l'ordre chronologique. */
function addUnique(list: Message[], msg: Message): Message[] {
  if (list.some((m) => m.id === msg.id)) return list;
  return [...list, msg].sort(byDate);
}

/**
 * Fusionne l'historique chargé (source de vérité) avec l'état local :
 * on garde uniquement les messages locaux plus récents que le dernier
 * message chargé (arrivés en temps réel pendant la requête).
 */
function mergeHistory(local: Message[], fetched: Message[]): Message[] {
  const ids = new Set(fetched.map((m) => m.id));
  const newest = fetched.length ? Date.parse(fetched[fetched.length - 1].created_at) : 0;
  const extras = local.filter((m) => !ids.has(m.id) && Date.parse(m.created_at) > newest);
  return [...fetched, ...extras].sort(byDate);
}

export function useMessages(groupId: string | null, me: { id: string; username: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    setMessages([]);
    setError(null);
    setConnected(false);

    if (!groupId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // Cache pseudo par user_id pour les messages reçus en temps réel
    const names = new Map<string, string>([[meRef.current.id, meRef.current.username]]);

    const fetchHistory = async (initial: boolean) => {
      const { data, error: err } = await supabase
        .from("messages")
        .select(SELECT_WITH_AUTHOR)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);

      if (cancelled) return;

      if (err) {
        if (initial) setError(translateDbError(err));
        setLoading(false);
        return;
      }

      const fetched = ((data ?? []) as unknown as RawMessage[]).map(normalize).reverse();
      for (const m of fetched) names.set(m.user_id, m.username);
      setError(null);
      setMessages((prev) => mergeHistory(prev, fetched));
      setLoading(false);
    };

    const resolveUsername = async (userId: string): Promise<string> => {
      const cached = names.get(userId);
      if (cached) return cached;
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();
      const name = (data?.username as string | undefined) ?? UNKNOWN_USER;
      names.set(userId, name);
      return name;
    };

    fetchHistory(true);

    const channel = supabase
      .channel(`messages:${groupId}:${crypto.randomUUID()}`)
      // Nouveaux messages du groupe courant (filtre côté serveur)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
        async (payload) => {
          const row = payload.new as Omit<RawMessage, "profiles">;
          const username = await resolveUsername(row.user_id);
          if (cancelled) return;
          setMessages((prev) => addUnique(prev, { ...row, username }));
        }
      )
      // Supprimations : Supabase ne permet pas de filtrer les DELETE par colonne
      // (seule la clé primaire est fournie). On retire donc simplement l'id
      // s'il est présent dans la liste courante.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          setMessages((prev) => (prev.some((m) => m.id === id) ? prev.filter((m) => m.id !== id) : prev));
        }
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setConnected(true);
          // Rattrape les éventuels messages manqués (connexion initiale ou reconnexion)
          fetchHistory(false);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [groupId, me.id]);

  const send = useCallback(
    async (content: string): Promise<{ error?: string }> => {
      const text = content.trim();
      if (!groupId) return { error: "Aucun groupe sélectionné." };
      if (!text) return { error: "Le message est vide." };

      const current = meRef.current;
      const { data, error: err } = await supabase
        .from("messages")
        .insert({ group_id: groupId, user_id: current.id, content: text })
        .select("id, group_id, user_id, content, created_at")
        .single();

      if (err || !data) return { error: translateDbError(err) };

      // Affichage immédiat ; l'évènement temps réel du même message sera ignoré (même id)
      setMessages((prev) => addUnique(prev, { ...(data as Omit<RawMessage, "profiles">), username: current.username }));
      return {};
    },
    [groupId]
  );

  const remove = useCallback(async (id: string): Promise<{ error?: string }> => {
    const { error: err } = await supabase.from("messages").delete().eq("id", id);
    if (err) return { error: translateDbError(err) };
    setMessages((prev) => prev.filter((m) => m.id !== id));
    return {};
  }, []);

  return { messages, loading, error, connected, send, remove };
}
