import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import { showToast } from "../lib/toast";
import type { Mahalla } from "../types";

// MFY ro'yxati va taqsimot sozlamasi. Kimdir MFY olsa/bo'shatsa — hamma ekranida darhol yangilanadi
export function useMahallas() {
  const [items, setItems] = useState<Mahalla[]>([]);
  const [selfAssign, setSelfAssign] = useState(true);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [list, settings] = await Promise.all([api.get<Mahalla[]>("/api/mahalla"), api.get<{ selfAssign: boolean }>("/api/mahalla/settings")]);
      setItems(list);
      setSelfAssign(settings.selfAssign);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const socket = getSocket();
    let connectedBefore = socket.connected;
    const handleConnect = () => {
      if (connectedBefore) void reload();
      connectedBefore = true;
    };
    const handleChanged = () => void reload();
    socket.on("connect", handleConnect);
    socket.on("mahalla:changed", handleChanged);
    return () => {
      socket.off("connect", handleConnect);
      socket.off("mahalla:changed", handleChanged);
    };
  }, [reload]);

  const claim = useCallback(
    async (ids: string[]) => {
      const result = await api.post<{ claimed: number; taken: number }>("/api/mahalla/claim", { ids });
      await reload();
      return result;
    },
    [reload],
  );

  const release = useCallback(
    async (ids: string[]) => {
      const result = await api.post<{ released: number }>("/api/mahalla/release", { ids });
      await reload();
      return result;
    },
    [reload],
  );

  const changeSelfAssign = useCallback(async (value: boolean) => {
    setSelfAssign(value);
    try {
      const r = await api.patch<{ selfAssign: boolean }>("/api/mahalla/settings", { selfAssign: value });
      setSelfAssign(r.selfAssign);
    } catch (err) {
      setSelfAssign(!value);
      throw err;
    }
  }, []);

  const unassignAll = useCallback(async () => {
    const r = await api.post<{ count: number }>("/api/mahalla/unassign-all");
    await reload();
    return r;
  }, [reload]);

  return { items, selfAssign, loading, reload, claim, release, changeSelfAssign, unassignAll };
}
