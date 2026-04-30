import React, { createContext, useContext, useMemo } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import type { UserInfo, DashboardData } from "@/types";
import { useUserInfo, useSaveData, useOpenApp as useOpenAppHook } from "@/hooks/useApi";
import Dashboard from "@/components/Dashboard";
import Login from "@/components/Login";
import Register from "@/components/Register";

interface AppContextType {
  userInfo: UserInfo | null;
  userLoading: boolean;
  userError: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => void;
  dashboardData: DashboardData | null;
  setDashboardData: React.Dispatch<React.SetStateAction<DashboardData | null>>;
  openApp: (title: string, url: string) => Promise<void>;
  openingApp: boolean;
  saveData: (data: Partial<DashboardData>) => Promise<boolean>;
  savingData: boolean;
}

export const AppContext = createContext<AppContextType>({
  userInfo: null,
  userLoading: true,
  userError: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  refetchUser: () => {},
  dashboardData: null,
  setDashboardData: () => {},
  openApp: async () => {},
  openingApp: false,
  saveData: async () => false,
  savingData: false,
});

export const useAppContext = () => useContext(AppContext);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { userInfo, userLoading } = useAppContext();
  const location = useLocation();

  if (userLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--bg-dark, #0f1016)",
          color: "var(--accent-cyan, #00f2ff)",
          fontFamily: "inherit",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: "3px solid rgba(0,242,255,0.2)",
              borderTopColor: "#00f2ff",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p>加载中...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!userInfo) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { userInfo, userLoading } = useAppContext();

  if (userLoading) return null;

  if (userInfo) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const {
    userInfo,
    loading: userLoading,
    error: userError,
    login,
    register,
    logout,
    refetch: refetchUser,
  } = useUserInfo();

  const { saveData: saveDataFn, saving: savingData } = useSaveData();
  const { openApp: openAppFn, opening: openingApp } = useOpenAppHook();

  const [dashboardData, setDashboardData] =
    React.useState<DashboardData | null>(null);

  const saveData = React.useCallback(
    async (data: Partial<DashboardData>): Promise<boolean> => {
      const success = await saveDataFn(data);
      if (success) {
        setDashboardData((prev) => (prev ? { ...prev, ...data } : null));
      }
      return success;
    },
    [saveDataFn],
  );

  const openApp = React.useCallback(
    async (title: string, url: string) => {
      await openAppFn(title, url);
    },
    [openAppFn],
  );

  const contextValue = useMemo<AppContextType>(
    () => ({
      userInfo,
      userLoading,
      userError,
      login,
      register,
      logout,
      refetchUser,
      dashboardData,
      setDashboardData,
      openApp,
      openingApp,
      saveData,
      savingData,
    }),
    [
      userInfo,
      userLoading,
      userError,
      login,
      register,
      logout,
      refetchUser,
      dashboardData,
      openApp,
      openingApp,
      saveData,
      savingData,
    ],
  );

  const location = useLocation();

  return (
    <AppContext.Provider value={contextValue}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </AppContext.Provider>
  );
}
