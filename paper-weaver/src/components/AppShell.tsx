import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, FilePlus2, BarChart3, Bell, GraduationCap, ChevronRight, LogOut, Database } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { authService } from "@/lib/authService";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/create", label: "Paper Creation", icon: FilePlus2 },
  { to: "/question-bank", label: "Question Bank", icon: Database },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

function Crumbs() {
  const { pathname } = useLocation();
  const current = navItems.find((n) => n.to === pathname)?.label ?? "Dashboard";
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>ExamForge</span>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className="text-foreground font-medium">{current}</span>
    </div>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = authService.getStoredUser();
  const displayName = user?.name ?? "Dr. A. Sharma";
  const role = user?.role ?? "Professor";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join("");

  const handleLogout = async () => {
    await authService.logout();
    window.location.replace("/auth");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Side rail */}
      <aside className="group/rail fixed inset-y-0 left-0 z-40 w-[72px] hover:w-60 transition-[width] duration-300 ease-out bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center text-primary glow-indigo">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-bold text-base tracking-tight whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200">
            ExamForge
          </span>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "relative flex items-center gap-4 px-3 h-11 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-foreground"
                    : "text-sidebar-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />}
                <Icon className={cn("h-5 w-5 shrink-0", active && "text-primary")} />
                <span className="whitespace-nowrap opacity-0 group-hover/rail:opacity-100 transition-opacity duration-200">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border text-[11px] text-muted-foreground opacity-0 group-hover/rail:opacity-100 transition-opacity">
          v1.0 · Deep Academic
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 pl-[72px] flex flex-col min-h-screen">
        <header className="h-16 sticky top-0 z-30 flex items-center justify-between px-8 bg-background/70 backdrop-blur-xl border-b border-border">
          <Crumbs />
          <div className="flex items-center gap-4">
            <button className="relative h-9 w-9 rounded-full bg-surface hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-3 pl-3 border-l border-border focus:outline-none"
              >
                <div className="text-right leading-tight hidden sm:block">
                  <div className="text-sm font-medium">{displayName}</div>
                  <div className="text-[11px] text-muted-foreground">{role}</div>
                </div>
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-violet text-primary-foreground font-semibold text-sm flex items-center justify-center hover:brightness-110 transition">
                  {initials}
                </div>
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <>
                  {/* Click-away backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-xl bg-surface border border-border shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold truncate">{displayName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user?.email ?? ""}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-rose hover:bg-rose/10 transition"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 px-8 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
