import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { AssistantFab } from "./chat/AssistantFab";
import { AssistantDrawer } from "./chat/AssistantDrawer";
import { useAppModules } from "../lib/modules";

export function Layout() {
  const { modules } = useAppModules();
  const { pathname } = useLocation();
  return (
    <div className="min-h-full">
      <Sidebar />
      <MobileNav />
      <main className="flex min-h-[calc(100vh-3rem)] min-w-0 md:min-h-screen flex-1 flex-col bg-app-bg px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 md:ml-64 md:p-6 lg:p-8">
        <Outlet />
      </main>
      {modules.assistant && (
        <>
          {pathname !== "/chat" && <AssistantFab />}
          <AssistantDrawer />
        </>
      )}
    </div>
  );
}
