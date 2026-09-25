import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import type { Campaign, CallStatus, CallTask } from "../types";

export function useCampaign() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
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

  useEffect(() => {
    refetch();

    const socket = getSocket();

    const handleTaskUpdate = (task: CallTask) => {
      setCampaign((prev) => {
        if (!prev || prev.id !== task.campaignId) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === task.id ? task : t)),
        };
      });
    };

    const handleCampaignCreated = (created: Campaign) => {
      setCampaign(created);
    };

    const handleCampaignClosed = (closed: Campaign) => {
      setCampaign((prev) => (prev && prev.id === closed.id ? { ...prev, status: "CLOSED" } : prev));
    };

    socket.on("task:update", handleTaskUpdate);
    socket.on("campaign:created", handleCampaignCreated);
    socket.on("campaign:closed", handleCampaignClosed);

    return () => {
      socket.off("task:update", handleTaskUpdate);
      socket.off("campaign:created", handleCampaignCreated);
      socket.off("campaign:closed", handleCampaignClosed);
    };
  }, [refetch]);

  const startTask = useCallback(async (taskId: string) => {
    return api.post<CallTask>(`/api/tasks/${taskId}/start`);
  }, []);

  const resultTask = useCallback(async (taskId: string, status: Extract<CallStatus, "REACHED" | "NO_ANSWER" | "PHONE_OFF">) => {
    return api.post<CallTask>(`/api/tasks/${taskId}/result`, { status });
  }, []);

  const resetTask = useCallback(async (taskId: string) => {
    return api.post<CallTask>(`/api/tasks/${taskId}/reset`);
  }, []);

  const createCampaign = useCallback(async (title: string, description?: string) => {
    const created = await api.post<Campaign>("/api/campaigns", { title, description });
    setCampaign(created);
    return created;
  }, []);

  const closeCampaign = useCallback(async (id: string) => {
    await api.post(`/api/campaigns/${id}/close`);
    setCampaign((prev) => (prev && prev.id === id ? { ...prev, status: "CLOSED" } : prev));
  }, []);

  return { campaign, loading, error, refetch, startTask, resultTask, resetTask, createCampaign, closeCampaign };
}
