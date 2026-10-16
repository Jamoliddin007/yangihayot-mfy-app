import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { showToast } from "../lib/toast";

// Oddiy ro'yxat yuklash: birinchi marta "loading", keyingi reload'lar fonda (ekran miltillamaydi)
export function useList<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setItems(await api.get<T[]>(path));
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { items, loading, reload };
}
