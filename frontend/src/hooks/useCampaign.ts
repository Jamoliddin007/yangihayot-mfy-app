import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { Campaign, CallTask, CampaignKind, ResultStatus } from "../types";

export interface NewCampaign {
  kind: CampaignKind;
  title: string;
  description?: string;
  scheduledAt?: string;
  location?: string;
}

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

    // Boshliq MFY mas'ulini o'zgartirsa — kim nimaga qo'ng'iroq qilishi o'zgaradi
    const handleChanged = () => void refetch();

    socket.on("connect", handleConnect);
    socket.on("campaign:changed", handleChanged);
    socket.on("task:update", applyTask);
    socket.on("campaign:created", setCampaign);
    socket.on("campaign:closed", handleCampaignClosed);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("campaign:changed", handleChanged);
      socket.off("task:update", applyTask);
      socket.off("campaign:created", setCampaign);
      socket.off("campaign:closed", handleCampaignClosed);
    };
  }, [refetch, applyTask]);

  // help=true — xodim boshqa xodimning MFY'siga yordam beryapti
  const startTask = useCallback(async (taskId: string, help?: boolean) => {
    const task = await api.post<CallTask>(`/api/tasks/${taskId}/start`, help ? { help } : undefined);
    applyTask(task);
    return task;
  }, [applyTask]);

  const resultTask = useCallback(async (taskId: string, status: ResultStatus, note?: string, help?: boolean) => {
    const task = await api.post<CallTask>(`/api/tasks/${taskId}/result`, { status, note: note || undefined, help });
    applyTask(task);
    return task;
  }, [applyTask]);

  const resetTask = useCallback(async (taskId: string) => {
    const task = await api.post<CallTask>(`/api/tasks/${taskId}/reset`);
    applyTask(task);
    return task;
  }, [applyTask]);

  const saveNote = useCallback(async (taskId: string, note: string) => {
    const task = await api.post<CallTask>(`/api/tasks/${taskId}/note`, { note });
    applyTask(task);
    return task;
  }, [applyTask]);

  const createCampaign = useCallback(async (input: NewCampaign) => {
    const created = await api.post<Campaign>("/api/campaigns", input);
    setCampaign(created);
    return created;
  }, []);

  const closeCampaign = useCallback(async (id: string) => {
    await api.post(`/api/campaigns/${id}/close`);
    setCampaign((prev) => (prev && prev.id === id ? null : prev));
  }, []);

  return { campaign, loading, error, refetch, startTask, resultTask, saveNote, resetTask, createCampaign, closeCampaign };
}
