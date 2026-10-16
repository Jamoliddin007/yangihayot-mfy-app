import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { Campaign, CallStatus, CallTask } from "../types";

export function useCampaign() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Faqat birinchi yuklashda "Yuklanmoqda..." ko'rsatiladi; fondagi yangilashlar ekranni miltillatmaydi
  const refetch = useCallback(async () => {
    try {
      const data = await api.get<Campaign | null>("/api/campaigns/active");
      setCampaign(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyTask = useCallback((task: CallTask) => {
    setCampaign((prev) => {
      if (!prev || prev.id !== task.campaignId) return prev;
      return { ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)) };
    });
  }, []);

  useEffect(() => {
    void refetch();

    const socket = getSocket();

    // Yakunlangan vazifa ekrandan olib tashlanadi: xodimlar uchun "faol vazifa yo'q",
    // boshliq uchun esa darhol "Yangi vazifa yaratish" formasi chiqadi
    const handleCampaignClosed = (closed: { id: string }) => {
      setCampaign((prev) => (prev && prev.id === closed.id ? null : prev));
    };

    // Internet uzilib qayta ulanganda o'tkazib yuborilgan eventlar o'rniga to'liq holatni qayta olamiz.
    // Birinchi ulanishda refetch shart emas — yuqorida allaqachon chaqirilgan.
    let connectedBefore = socket.connected;
    const handleConnect = () => {
      if (connectedBefore) void refetch();
      connectedBefore = true;
    };

    socket.on("connect", handleConnect);
    socket.on("task:update", applyTask);
    socket.on("campaign:created", setCampaign);
    socket.on("campaign:closed", handleCampaignClosed);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("task:update", applyTask);
      socket.off("campaign:created", setCampaign);
      socket.off("campaign:closed", handleCampaignClosed);
    };
  }, [refetch, applyTask]);

  const startTask = useCallback(async (taskId: string) => {
    const task = await api.post<CallTask>(`/api/tasks/${taskId}/start`);
    applyTask(task);
    return task;
  }, [applyTask]);

  const resultTask = useCallback(async (taskId: string, status: Extract<CallStatus, "REACHED" | "NO_ANSWER" | "PHONE_OFF">) => {
    const task = await api.post<CallTask>(`/api/tasks/${taskId}/result`, { status });
    applyTask(task);
    return task;
  }, [applyTask]);

  const resetTask = useCallback(async (taskId: string) => {
    const task = await api.post<CallTask>(`/api/tasks/${taskId}/reset`);
    applyTask(task);
    return task;
  }, [applyTask]);

  const createCampaign = useCallback(async (title: string, description?: string) => {
    const created = await api.post<Campaign>("/api/campaigns", { title, description });
    setCampaign(created);
    return created;
  }, []);

  const closeCampaign = useCallback(async (id: string) => {
    await api.post(`/api/campaigns/${id}/close`);
    setCampaign((prev) => (prev && prev.id === id ? null : prev));
  }, []);

  return { campaign, loading, error, refetch, startTask, resultTask, resetTask, createCampaign, closeCampaign };
}
