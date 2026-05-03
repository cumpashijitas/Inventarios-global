import {
  AlertCircle,
  ArrowLeftRight,
  BarChart2,
  Boxes,
  Building2,
  ChevronDown,
  CreditCard,
  FileText,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Truck,
  UserCog,
  Users,
  Warehouse,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";
import { useAuthStore } from "@/shared/stores/auth.store";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

// Estructura completa del menú lateral agrupada por módulo.
// Para agregar nuevos módulos: añadir un NavGroup al array y su ruta en router.tsx.
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: "Operación",
    items: [
      { to: "/inventario/productos",   label: "Productos",    icon: Package },
      { to: "/inventario/almacenes",   label: "Almacenes",    icon: Warehouse },
      { to: "/inventario/stock",       label: "Stock actual", icon: Layers },
      { to: "/inventario/movimientos", label: "Movimientos",  icon: Boxes },
    ],
  },
  {
    label: "Ventas",
    items: [
      { to: "/ventas/clientes",     label: "Clientes",     icon: Users },
      { to: "/ventas/cotizaciones", label: "Cotizaciones", icon: FileText },
      { to: "/ventas",              label: "Ventas",       icon: ShoppingCart, end: true },
      { to: "/ventas/pagos",        label: "Pagos",        icon: CreditCard },
    ],
  },
  {
    label: "Compras",
    items: [
      { to: "/compras/proveedores",  label: "Proveedores", icon: Truck },
      { to: "/compras",              label: "Compras",     icon: ShoppingCart, end: true },
      { to: "/compras/recepciones",  label: "Recepciones", icon: PackageCheck },
    ],
  },
  {
    label: "Reportes",
    items: [
      { to: "/reportes/inventario",  label: "Inventario",  icon: BarChart2 },
      { to: "/reportes/ventas",      label: "Ventas",      icon: TrendingUp },
      { to: "/reportes/movimientos", label: "Movimientos", icon: ArrowLeftRight },
      { to: "/reportes/bajo-stock",  label: "Bajo stock",  icon: AlertCircle },
    ],
  },
  {
    label: "Administración",
    items: [
      { to: "/administracion/usuarios",     label: "Usuarios y roles",    icon: UserCog },
      { to: "/administracion/empresa",      label: "Empresa",             icon: Building2 },
      { to: "/administracion/suscripcion",  label: "Suscripción",         icon: Sparkles },
      { to: "/administracion/auditoria",    label: "Auditoría",           icon: ShieldCheck },
      { to: "/administracion/configuracion",label: "Configuración",       icon: Settings },
    ],
  },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { email, rol, logout } = useAuthStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden w-56 shrink-0 md:flex md:flex-col bg-slate-950">
        <SidebarContent />
      </aside>

      {/* Sidebar móvil (drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-56 flex-col bg-slate-950">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-slate-500 hover:text-slate-700"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* User menu */}
          <div className="relative ml-auto" ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-slate-100"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="hidden text-left sm:block">
                <div className="text-sm font-medium leading-none text-slate-800">{email}</div>
                <div className="mt-0.5 text-xs text-slate-400 capitalize">{rol ?? "—"}</div>
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-slate-400 transition-transform duration-150",
                  userMenuOpen && "rotate-180",
                )}
              />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg shadow-slate-200/60">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600"
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
          <div className="container max-w-6xl py-8">
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
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center border-b border-slate-800 px-4">
        <Link to="/" className="flex items-center gap-2.5" onClick={onNavigate}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
            IS
          </div>
          <span className="font-semibold tracking-tight text-white">Inventario</span>
        </Link>
      </div>

      {/* Nav con scroll */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-none">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-5" : ""}>
            {group.label && (
              <div className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5 px-2">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end ?? false}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-100",
                    )
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-800 px-4 py-3 text-xs text-slate-600">
        v0.1.0 · {import.meta.env.VITE_APP_ENV}
      </div>
    </>
  );
}
