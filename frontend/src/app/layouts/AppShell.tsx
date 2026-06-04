import {
  Archive,
  BarChart2,
  ChevronDown,
  ChevronLeft,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PackagePlus,
  Settings,
  ShoppingCart,
  Sun,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { api } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";
import { NetworkBlockedPage } from "@/shared/components/NetworkBlockedPage";
import { useAuthStore } from "@/shared/stores/auth.store";
import { useTheme } from "@/shared/hooks/useTheme";
import { puedeAcceder, ROL_LABEL } from "@/shared/config/roles";
import { BRAND } from "@/shared/config/branding";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
  permiso?: string;   // clave de PERMISOS — si está, se filtra por rol
}

const NAV_ITEMS: NavItem[] = [
  { to: "/",            label: "Dashboard",    icon: LayoutDashboard, end: true },
  { to: "/inventario",  label: "Inventario",   icon: Archive,         end: true, permiso: "inventario_ver" },
  { to: "/carga-masiva",label: "Carga Masiva", icon: PackagePlus,     end: true, permiso: "carga_masiva" },
  { to: "/ventas",      label: "Ventas",       icon: ShoppingCart,    end: true, permiso: "ventas" },
  { to: "/caja",        label: "Caja",         icon: DollarSign,      end: true, permiso: "caja" },
  { to: "/reportes",    label: "Reportes",     icon: BarChart2,       end: true, permiso: "reportes" },
  { to: "/administracion/configuracion", label: "Configuración", icon: Settings, end: true, permiso: "configuracion" },
];

// Cierra sesión automáticamente tras 45 minutos de inactividad
const SESSION_TIMEOUT_MS = 45 * 60 * 1000;

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { email, rol, logout, networkBlocked, setNetworkBlocked, lastActivity, updateActivity } = useAuthStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [networkChecked, setNetworkChecked] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // ── Auto-logout por inactividad ───────────────────────────────────────────
  const checkSession = useCallback(() => {
    if (!lastActivity) return;
    if (Date.now() - lastActivity > SESSION_TIMEOUT_MS) {
      logout();
      navigate("/login", { replace: true });
    }
  }, [lastActivity, logout, navigate]);

  useEffect(() => {
    // Verificar al montar (volver a la pestaña después de tiempo)
    checkSession();

    // Verificar cuando el usuario vuelve a la pestaña
    const onVisible = () => { if (document.visibilityState === "visible") checkSession(); };
    document.addEventListener("visibilitychange", onVisible);

    // Chequeo periódico cada minuto
    const interval = setInterval(checkSession, 60_000);

    // Actualizar lastActivity en cualquier interacción del usuario
    const EVENTS = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    const onActivity = () => updateActivity();
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [checkSession, updateActivity]);

  useEffect(() => {
    if (rol === "admin") { setNetworkChecked(true); return; }
    api.get("/admin/mi-ip")
      .then(() => setNetworkChecked(true))
      .catch((err) => {
        if (err.response?.status === 403) setNetworkBlocked(true);
        setNetworkChecked(true);
      });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  if (!networkChecked) return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
    </div>
  );

  if (networkBlocked) return <NetworkBlockedPage />;

  const navItems = NAV_ITEMS.filter((item) =>
    !item.permiso || puedeAcceder(rol, item.permiso as Parameters<typeof puedeAcceder>[1])
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col bg-slate-950 transition-all duration-300 md:flex dark:border-r dark:border-slate-800",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onCollapse={() => setCollapsed((v) => !v)}
          navItems={navItems}
          rol={rol}
        />
      </aside>

      {/* Sidebar móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-56 flex-col bg-slate-950">
            <SidebarContent
              collapsed={false}
              onCollapse={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
              navItems={navItems}
              rol={rol}
            />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="ml-auto flex items-center gap-1">
            {/* ── Botón Dark / Light mode ── */}
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* ── User menu ── */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                  {email?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="hidden text-left sm:block">
                  <div className="text-sm font-medium leading-none text-slate-800 dark:text-slate-100">
                    {email}
                  </div>
                  <div className="mt-0.5 text-xs capitalize text-slate-400 dark:text-slate-500">
                    {rol ?? "—"}
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-slate-400 transition-transform duration-150 dark:text-slate-500",
                    userMenuOpen && "rotate-180",
                  )}
                />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-200/60 dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-900/60">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full py-4 px-3 sm:py-6 sm:px-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  collapsed,
  onCollapse,
  onNavigate,
  navItems,
  rol,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  onNavigate?: () => void;
  navItems: NavItem[];
  rol: string | null;
}) {
  return (
    <>
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-slate-800",
          collapsed ? "justify-center px-3" : "px-4",
        )}
      >
        {collapsed ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
            {BRAND.initials}
          </div>
        ) : (
          <Link to="/" className="flex items-center gap-2.5" onClick={onNavigate}>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
              {BRAND.initials}
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-bold tracking-tight text-white text-sm">{BRAND.name}</span>
              <span className="text-[10px] text-slate-500 tracking-wide">by {BRAND.company}</span>
            </div>
          </Link>
        )}
      </div>

      {/* Rol badge */}
      {!collapsed && rol && (
        <div className="mx-3 mt-2 mb-1 rounded-lg bg-slate-800 px-3 py-1.5 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {ROL_LABEL[rol] ?? rol}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end ?? false}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors mb-0.5",
                collapsed && "justify-center",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 pb-2 pt-1 text-center">
          <p className="text-[10px] text-slate-600">
            © {BRAND.year} {BRAND.company} · {BRAND.version}
          </p>
        </div>
      )}

      {/* Contraer */}
      <button
        onClick={onCollapse}
        className={cn(
          "flex shrink-0 items-center gap-2 border-t border-slate-800 py-3 text-xs text-slate-500 transition-colors hover:text-slate-300",
          collapsed ? "justify-center px-3" : "px-4",
        )}
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform duration-300",
            collapsed && "rotate-180",
          )}
        />
        {!collapsed && <span>Contraer</span>}
      </button>
    </>
  );
}
