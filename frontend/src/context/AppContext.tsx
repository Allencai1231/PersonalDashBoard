import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserInfo, DashboardData, NavItem } from '@/types';
import { useUserInfo, useDashboardData, useSaveData, useOpenApp as useOpenAppHook } from '@/hooks/useApi';

interface AppContextValue {
  userInfo: UserInfo | null;
  userLoading: boolean;
  userError: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;

  dashboardData: DashboardData | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  refetchDashboard: () => Promise<void>;
  saveData: (data: Partial<DashboardData>) => Promise<boolean>;
  savingData: boolean;
  updateNavItems: (type: 'software' | 'websites', items: NavItem[]) => void;

  openApp: (title: string, url: string) => Promise<void>;
  openingApp: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const {
    userInfo,
    loading: userLoading,
    error: userError,
    login,
    register,
    logout,
    refetch: refetchUser,
  } = useUserInfo();

  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useDashboardData();

  const { saveData: saveDataFn, saving: savingData } = useSaveData();
  const { openApp: openAppFn, opening: openingApp } = useOpenAppHook();

  const [localData, setLocalData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (dashboardData) {
      setLocalData(dashboardData);
    }
  }, [dashboardData]);

  const saveData = useCallback(async (data: Partial<DashboardData>): Promise<boolean> => {
    const success = await saveDataFn(data);
    if (success) {
      setLocalData(prev => prev ? { ...prev, ...data } : null);
      await refetchDashboard();
    }
    return success;
  }, [saveDataFn, refetchDashboard]);

  const updateNavItems = useCallback((type: 'software' | 'websites', items: NavItem[]) => {
    setLocalData(prev => {
      if (!prev) return prev;
      return { ...prev, [type]: items };
    });
  }, []);

  const openApp = useCallback(async (title: string, url: string) => {
    await openAppFn(title, url);
  }, [openAppFn]);

  const value: AppContextValue = {
    userInfo,
    userLoading,
    userError,
    login,
    register,
    logout,
    refetchUser,
    dashboardData: localData,
    dashboardLoading,
    dashboardError,
    refetchDashboard,
    saveData,
    savingData,
    updateNavItems,
    openApp,
    openingApp,
  };

  return React.createElement(AppContext.Provider, { value }, children);
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return ctx;
}
