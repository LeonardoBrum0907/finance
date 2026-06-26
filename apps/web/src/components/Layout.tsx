import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { AssistantFab } from "./chat/AssistantFab";
import { AssistantDrawer } from "./chat/AssistantDrawer";

export function Layout() {
  return (
    <div className="min-h-full">
      <Sidebar />
      <main className="ml-64 flex min-h-screen flex-1 flex-col bg-slate-50 p-6 lg:p-8">
        <Outlet />
      </main>
      <AssistantFab />
      <AssistantDrawer />
    </div>
  );
}
