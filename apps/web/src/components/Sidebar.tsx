import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Landmark,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PieChart,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "../lib/auth";

type NavItem =
  | { label: string; icon: LucideIcon; to: string; end?: boolean }
  | { label: string; icon: LucideIcon; comingSoon: true };

const navItems: NavItem[] = [
  { label: "Painel", icon: LayoutDashboard, to: "/", end: true },
  { label: "Contas", icon: Landmark, comingSoon: true },
  { label: "Orçamentos", icon: PieChart, comingSoon: true },
  { label: "Relatórios", icon: TrendingUp, comingSoon: true },
  { label: "Configurações", icon: Settings, comingSoon: true },
  { label: "Pessoas", icon: Users, to: "/pessoas" },
  { label: "Assistente", icon: MessageSquare, to: "/chat" },
];

function NavItemLink({ item }: { item: Extract<NavItem, { to: string }> }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `group flex items-center gap-3.5 rounded-xl px-4 py-3 text-left text-sm transition-all duration-200 ${
          isActive
            ? "border-l-[3px] border-emerald-400 bg-slate-800/70 font-medium text-white shadow-sm"
            : "text-slate-400 hover:bg-slate-800/30 hover:text-slate-100"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-105 ${
              isActive ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-300"
            }`}
          />
          <span className="tracking-wide">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function NavItemPlaceholder({ item }: { item: Extract<NavItem, { comingSoon: true }> }) {
  const Icon = item.icon;

  return (
    <span
      title="Em breve"
      className="flex cursor-not-allowed items-center gap-3.5 rounded-xl px-4 py-3 text-sm text-slate-400 opacity-50"
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="tracking-wide">{item.label}</span>
    </span>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const initials = user?.name
    ?.split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar p-6 text-slate-300">
      <div className="flex shrink-0 items-center gap-3 px-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 shadow-lg shadow-emerald-500/5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-emerald-400"
            aria-hidden
          >
            <path
              d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 11.5 22C16.5228 22 21 17.5228 21 12C21 6.47715 16.5228 2 12 2ZM11.5 18C8.46243 18 6 15.5376 6 12.5C6 9.46243 8.46243 7 11.5 7C14.5376 7 17 9.46243 17 12.5C17 15.5376 14.5376 18 11.5 18Z"
              fill="currentColor"
              fillOpacity="0.15"
            />
            <path
              d="M12 3C7.5 3 4.5 7.5 4.5 12C4.5 16.5 7.5 20.5 12 20.5C14.5 20.5 17.5 18 17.5 14.5C17.5 11.5 15.5 10 13.5 10C11.5 10 11.5 8.5 12.5 7.5C13.5 6.5 12.5 3 12 3Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-lg font-bold leading-none tracking-tight text-white">
            vista
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
            FINANÇAS
          </span>
        </div>
      </div>

      <nav className="sidebar-nav-scroll mt-8 min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1.5 pr-1">
          {navItems.map((item) =>
            "comingSoon" in item ? (
              <NavItemPlaceholder key={item.label} item={item} />
            ) : (
              <NavItemLink key={item.to} item={item} />
            ),
          )}
        </div>
      </nav>

      <div className="mt-4 flex shrink-0 flex-col gap-4 border-t border-slate-800/80 pt-6">
        <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/10 p-3.5">
          <div className="mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white">
              Metas de Junho
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Você economizou{" "}
            <strong className="text-emerald-400">R$ 1.250</strong> a mais que no mês anterior.
            Incrível!
          </p>
        </div>

        {user && (
          <div className="flex items-center gap-3 rounded-xl px-2 py-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-700 bg-emerald-500/20 text-sm font-semibold text-emerald-400">
              {initials || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="truncate font-mono text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                Conta Pro
              </p>
              <p className="truncate text-[10px] text-slate-500">{user.email}</p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => logout()}
          className="flex cursor-pointer items-center gap-3.5 rounded-xl px-4 py-3 text-left text-sm text-slate-400 transition-colors duration-200 hover:bg-rose-500/10 hover:text-rose-400"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
