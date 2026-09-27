"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "./session";

/**
 * Sessione lato client.
 *
 * L'interfaccia deve sapere chi sta lavorando (per mostrare nome e progetti
 * giusti); i permessi veri restano nelle pagine server. Una sola chiamata,
 * riusata da tutte le schermate che si aprono.
 */

export type SessionState = {
  user: AuthUser | null;
  /** true quando la firma usa la chiave di ripiego: sessione valida solo in locale. */
  localSecret: boolean;
  loading: boolean;
};

let cached: { user: AuthUser | null; localSecret: boolean } | null = null;

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    user: cached?.user ?? null,
    localSecret: cached?.localSecret ?? false,
    loading: cached === null,
  });

  useEffect(() => {
    let cancelled = false;
    if (cached) return;
    void (async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const payload = (await response.json()) as { user: AuthUser | null; localSecret?: boolean };
        cached = { user: payload.user ?? null, localSecret: payload.localSecret ?? false };
        if (!cancelled) setState({ user: cached.user, localSecret: cached.localSecret, loading: false });
      } catch {
        cached = { user: null, localSecret: false };
        if (!cancelled) setState({ user: null, localSecret: false, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Identificativo con cui separare i progetti locali: coincide con quello del server. */
export function ownerOf(user: AuthUser | null): string {
  return user ? `${user.provider}:${user.id}` : "local:ospite";
}

export function useSignOut(): () => Promise<void> {
  return useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    cached = null;
    window.location.href = "/";
  }, []);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (parts.length === 0 || !parts[0]) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
