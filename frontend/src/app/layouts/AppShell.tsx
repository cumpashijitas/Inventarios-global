/**
 * App shell con sidebar (desktop) + drawer (móvil) + topbar.
 * Layout tipo Linear/Notion: limpio, denso, contenedor central con padding amplio.
 */
import {
  Boxes,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";
import { useAuthStore } from "@/shared/stores/auth.store";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventario/productos", label: "Productos", icon: Package },
  { to: "/inventario/almacenes", label: "Almacenes", icon: Warehouse },
  { to: "/inventario/movimientos", label: "Movimientos", icon: Boxes },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { email, rol, logout } = useAuthStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
        <SidebarContent />
      </aside>

      {/* Sidebar móvil (drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r bg-card">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* User menu */}
          <div className="relative ml-auto">
            <Button
              variant="ghost"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="gap-2"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-medium leading-none">{email}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{rol ?? "—"}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Outlet */}
        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-6xl py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex h-14 items-center border-b px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            IS
          </div>
          Inventario
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-4 text-xs text-muted-foreground">
        v0.1.0 · {import.meta.env.VITE_APP_ENV}
      </div>
    </>
  );
}
