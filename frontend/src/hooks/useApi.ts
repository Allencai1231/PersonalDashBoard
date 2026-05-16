import { useState, useEffect, useCallback } from "react";
import type { UserInfo, DashboardData, Playlist, ApiResponse } from "@/types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options?.headers as Record<string, string>),
    },
    ...options,
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("未登录，请先登录");
    }
    if (res.status === 403) {
      throw new Error("权限不足");
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `请求失败 (${res.status})`);
  }

  return res.json();
}

async function postJson<T>(url: string, data?: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
}

async function postForm<T>(
  url: string,
  data: URLSearchParams | FormData,
): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    body: data,
  });
}

export function useUserInfo() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchJson<ApiResponse<UserInfo>>("/api/get_user_info");
      if (res.success && res.data) {
        setUserInfo(res.data);
      } else {
        setUserInfo(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取用户信息失败");
      setUserInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserInfo();
  }, [fetchUserInfo]);

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      await postForm<ApiResponse<UserInfo>>("/api/login", formData);
      await fetchUserInfo();
    },
    [fetchUserInfo],
  );

  const register = useCallback(
    async (username: string, password: string): Promise<void> => {
      const formData = new URLSearchParams();
      formData.append("username", username);
      formData.append("password", password);
      await postForm<ApiResponse<UserInfo>>("/api/register", formData);
      await fetchUserInfo();
    },
    [fetchUserInfo],
  );

  const logout = useCallback(async (): Promise<void> => {
    await fetchJson<ApiResponse<null>>("/api/logout");
    setUserInfo(null);
  }, []);

  return {
    userInfo,
    loading,
    error,
    login,
    register,
    logout,
    refetch: fetchUserInfo,
  };
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchJson<ApiResponse<DashboardData>>("/api/get_data");
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "获取数据失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useSaveData() {
  const [saving, setSaving] = useState(false);

  const saveData = useCallback(
    async (data: Partial<DashboardData>): Promise<boolean> => {
      try {
        setSaving(true);
        const res = await postJson<ApiResponse<null>>("/api/save_data", data);
        return res.success;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return { saveData, saving };
}

export function useOpenApp() {
  const [opening, setOpening] = useState(false);

  const openApp = useCallback(
    async (title: string, url: string): Promise<void> => {
      try {
        setOpening(true);
        await postJson("/api/open_app", { title, url });
      } catch (err) {
        console.error("打开应用失败:", err);
        window.open(url, "_blank", "noopener,noreferrer");
      } finally {
        setOpening(false);
      }
    },
    [],
  );

  return { openApp, opening };
}

export function useMusicPlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchJson<ApiResponse<Playlist[]>>(
        "/api/get_music_playlists",
      );
      if (res.success && res.data) {
        setPlaylists(res.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取播放列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  return { playlists, loading, error, refetch: fetchPlaylists };
}
