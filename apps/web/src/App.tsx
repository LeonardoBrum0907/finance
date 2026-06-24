import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AccountsPage } from "./pages/AccountsPage";
import { PeoplePage } from "./pages/PeoplePage";
import { BudgetsPage } from "./pages/BudgetsPage";
import { GoalsPage } from "./pages/GoalsPage";
import { InvestmentsPage } from "./pages/InvestmentsPage";
import { ChatPage } from "./pages/ChatPage";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
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
        <Route path="/investimentos" element={<InvestmentsPage />} />
        <Route path="/contas" element={<AccountsPage />} />
        <Route path="/pessoas" element={<PeoplePage />} />
        <Route path="/orcamentos" element={<BudgetsPage />} />
        <Route path="/objetivos" element={<GoalsPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
