import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { AssistantFab } from "./chat/AssistantFab";
import { AssistantDrawer } from "./chat/AssistantDrawer";
import { useAppModules } from "../lib/modules";

export function Layout() {
  const { modules } = useAppModules();
  return (
    <div className="min-h-full">
      <Sidebar />
      <main className="ml-64 flex min-h-screen flex-1 flex-col bg-app-bg p-6 lg:p-8">
        <Outlet />
      </main>
      {modules.assistant && (
        <>
          <AssistantFab />
          <AssistantDrawer />
        </>
      )}
    </div>
  );
}
