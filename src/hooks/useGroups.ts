import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { translateDbError } from "../lib/errors";
import type { Group } from "../types";

function sortGroups(list: Group[]): Group[] {
  return [...list].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
  );
}

function upsertGroup(list: Group[], group: Group): Group[] {
  if (list.some((g) => g.id === group.id)) return list;
  return sortGroups([...list, group]);
}

export function useGroups(userId: string) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (initial: boolean) => {
      const { data, error: err } = await supabase
        .from("groups")
        .select("id, name, created_by, created_at")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (err) {
        if (initial) setError(translateDbError(err));
      } else {
        setError(null);
        setGroups((prev) => {
          let merged = sortGroups((data ?? []) as Group[]);
          for (const g of prev) merged = upsertGroup(merged, g);
          return merged;
        });
      }
      if (initial) setLoading(false);
    };

    load(true);

    // Les nouveaux groupes apparaissent en direct chez tous les membres
    const channel = supabase
      .channel(`groups:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "groups" },
        (payload) => {
          const g = payload.new as Group;
          setGroups((prev) => upsertGroup(prev, g));
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") load(false);
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const createGroup = useCallback(
    async (name: string): Promise<{ group?: Group; error?: string }> => {
      const clean = name.trim().replace(/\s+/g, " ");
      if (!clean) return { error: "Le nom du groupe ne peut pas être vide." };
      if (clean.length > 40) return { error: "Le nom du groupe est trop long (40 caractères maximum)." };

      const { data, error: err } = await supabase
        .from("groups")
        .insert({ name: clean, created_by: userId })
        .select("id, name, created_by, created_at")
        .single();

      if (err || !data) return { error: translateDbError(err) };
      const group = data as Group;
      setGroups((prev) => upsertGroup(prev, group));
      return { group };
    },
    [userId]
  );

  return { groups, loading, error, createGroup };
}
