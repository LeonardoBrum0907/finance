import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import type { AppModuleId } from "@finance/shared";
import { useAuth } from "./lib/auth";
import { useAppModules } from "./lib/modules";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { InvestmentsPage } from "./pages/InvestmentsPage";
import { ChatPage } from "./pages/ChatPage";
import { CommitmentsPage } from "./pages/CommitmentsPage";
import { SettingsPage } from "./pages/SettingsPage";

/** Página de módulo opcional: com o módulo desligado, volta para o Início. */
function ModuleRoute({ module, children }: { module: AppModuleId; children: ReactNode }) {
  const { modules, ready } = useAppModules();
  if (!ready) return null;
  return modules[module] ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground-dark">
        Carregando...
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/compromissos" element={<CommitmentsPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route
          path="/investimentos"
          element={
            <ModuleRoute module="investments">
              <InvestmentsPage />
            </ModuleRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ModuleRoute module="assistant">
              <ChatPage />
            </ModuleRoute>
          }
        />
        {/* Endereços antigos. */}
        <Route path="/simulador" element={<Navigate to="/compromissos" replace />} />
        <Route path="/pessoas" element={<Navigate to="/configuracoes" replace />} />
        <Route path="/contas" element={<Navigate to="/configuracoes" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
