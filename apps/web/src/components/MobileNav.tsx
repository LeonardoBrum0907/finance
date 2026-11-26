import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../lib/auth";
import { useAppModules } from "../lib/modules";
import { navItems } from "./Sidebar";

/** Navegação do celular: barra fina no topo (marca + sair) e abas fixas embaixo. */
export function MobileNav() {
  const { logout } = useAuth();
  const { modules } = useAppModules();
  const items = navItems.flatMap((item) =>
    "to" in item && (!item.module || modules[item.module]) ? [item] : [],
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 md:hidden">
        <span className="font-display text-base font-bold tracking-tight text-white">
          vista <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">finanças</span>
        </span>
        <button
          type="button"
          onClick={() => logout()}
          aria-label="Sair"
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-negative"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="flex">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-[3.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] min-[480px]:text-[11px] ${
                    isActive ? "font-medium text-accent" : "text-slate-400"
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
