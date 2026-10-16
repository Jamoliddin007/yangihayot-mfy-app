import { useCallback, useEffect, useState } from "react";
import { api, setCurrentOrg } from "../lib/api";
import type { MeResponse, SessionUser } from "../types";

const orgKey = (userId: string) => `org:${userId}`;

function readStored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Kim kirgan, qaysi tashkilotlarda va hozir qaysi biri tanlangan.
// Tanlov qurilmada eslab qolinadi; a'zolik bitta bo'lsa — avtomatik.
export function useSession() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.get<MeResponse>("/api/me");
      setMe(data);
      const stored = readStored(orgKey(data.user.id));
      const chosen = data.memberships.find((m) => m.orgId === stored) ?? data.memberships[0] ?? null;
      setCurrentOrg(chosen?.orgId ?? null);
      setOrgId(chosen?.orgId ?? null);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const switchOrg = useCallback(
    (next: string) => {
      if (!me) return;
      try {
        localStorage.setItem(orgKey(me.user.id), next);
      } catch {
        // xotira yopiq bo'lsa ham ishlayveradi — faqat eslab qolinmaydi
      }
      setCurrentOrg(next);
      setOrgId(next);
    },
    [me],
  );

  const rename = useCallback(async (fullName: string) => {
    const updated = await api.patch<{ fullName: string }>("/api/me", { fullName });
    setMe((prev) => (prev ? { ...prev, user: { ...prev.user, fullName: updated.fullName } } : prev));
  }, []);

  const membership = me?.memberships.find((m) => m.orgId === orgId) ?? null;
  const user: SessionUser | null =
    me && membership ? { id: me.user.id, fullName: me.user.fullName, role: membership.role, orgId: membership.orgId, orgName: membership.orgName } : null;

  return { me, user, loading, error, switchOrg, rename, reload: load };
}
