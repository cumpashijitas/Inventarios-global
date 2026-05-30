import { lazy, Suspense } from "react";
import { Navigate, Outlet, createBrowserRouter, type RouteObject } from "react-router-dom";

import { AppShell } from "@/app/layouts/AppShell";
import { AuthLayout } from "@/app/layouts/AuthLayout";
import { Skeleton } from "@/shared/components/Skeleton";
import { useAuthStore, selectIsAuthenticated } from "@/shared/stores/auth.store";
import { puedeAcceder } from "@/shared/config/roles";

// ── Auth ─────────────────────────────────────────────────────────────────────
const LoginPage         = lazy(() => import("@/modules/auth/pages/LoginPage"));
const SelectEmpresaPage = lazy(() => import("@/modules/auth/pages/SelectEmpresaPage"));

// ── Dashboard ────────────────────────────────────────────────────────────────
const DashboardPage     = lazy(() => import("@/modules/dashboard/pages/DashboardPage"));

// ── Inventario ───────────────────────────────────────────────────────────────
// Página principal con tabs: Productos, Proveedores, Clientes Frecuentes
const InventarioPage    = lazy(() => import("@/modules/inventario/pages/InventarioPage"));
// Rutas individuales conservadas (acceso directo y breadcrumbs futuros)
const ProductosPage     = lazy(() => import("@/modules/inventario/pages/ProductosPage"));
const AlmacenesPage     = lazy(() => import("@/modules/inventario/pages/AlmacenesPage"));
const StockPage         = lazy(() => import("@/modules/inventario/pages/StockPage"));
const MovimientosPage   = lazy(() => import("@/modules/inventario/pages/MovimientosPage"));

// ── Ventas ───────────────────────────────────────────────────────────────────
// TODO: conectar con módulo de ventas del backend
const VentasPage        = lazy(() => import("@/modules/ventas/pages/VentasPage"));
const CajaPage          = lazy(() => import("@/modules/ventas/pages/CajaPage"));
const ClientesPage      = lazy(() => import("@/modules/ventas/pages/ClientesPage"));
const CotizacionesPage  = lazy(() => import("@/modules/ventas/pages/CotizacionesPage"));
const PagosPage         = lazy(() => import("@/modules/ventas/pages/PagosPage"));

// ── Compras / Carga Masiva ───────────────────────────────────────────────────
// TODO: conectar con módulo de compras y lotes del backend
const CargaMasivaPage   = lazy(() => import("@/modules/compras/pages/CargaMasivaPage"));
const ProveedoresPage   = lazy(() => import("@/modules/compras/pages/ProveedoresPage"));
const ComprasPage       = lazy(() => import("@/modules/compras/pages/ComprasPage"));
const RecepcionesPage   = lazy(() => import("@/modules/compras/pages/RecepcionesPage"));

// ── Reportes ─────────────────────────────────────────────────────────────────
// TODO: conectar con endpoints analíticos del backend
const ReportesPage           = lazy(() => import("@/modules/reportes/pages/ReportesPage"));
const ReporteInventarioPage  = lazy(() => import("@/modules/reportes/pages/ReporteInventarioPage"));
const ReporteVentasPage      = lazy(() => import("@/modules/reportes/pages/ReporteVentasPage"));
const ReporteMovimientosPage = lazy(() => import("@/modules/reportes/pages/ReporteMovimientosPage"));
const ReporteBajoStockPage   = lazy(() => import("@/modules/reportes/pages/ReporteBajoStockPage"));

// ── Administración ───────────────────────────────────────────────────────────
// TODO: conectar con endpoints de gestión de empresa y usuarios
const UsuariosPage      = lazy(() => import("@/modules/administracion/pages/UsuariosPage"));
const EmpresaPage       = lazy(() => import("@/modules/administracion/pages/EmpresaPage"));
const SuscripcionPage   = lazy(() => import("@/modules/administracion/pages/SuscripcionPage"));
const AuditoriaPage     = lazy(() => import("@/modules/administracion/pages/AuditoriaPage"));
const ConfiguracionPage = lazy(() => import("@/modules/administracion/pages/ConfiguracionPage"));

function ProtectedRoute() {
  const isAuth      = useAuthStore(selectIsAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const empresaId   = useAuthStore((s) => s.empresaId);

  if (accessToken && !empresaId) return <Navigate to="/login/select-empresa" replace />;
  if (!isAuth)                   return <Navigate to="/login" replace />;
  return <Outlet />;
}

/**
 * Guard de roles: si el usuario no tiene el permiso requerido,
 * lo redirige al dashboard en vez de mostrar la página.
 */
function RoleGuard({ permiso }: { permiso: Parameters<typeof puedeAcceder>[1] }) {
  const rol = useAuthStore((s) => s.rol);
  if (!puedeAcceder(rol, permiso)) return <Navigate to="/" replace />;
  return <Outlet />;
}

function PageSkeleton() {
  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

const routes: RouteObject[] = [
  {
    element: <AuthLayout />,
    children: [
      { path: "/login",                element: <S><LoginPage /></S> },
      { path: "/login/select-empresa", element: <S><SelectEmpresaPage /></S> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          // ── Dashboard ──────────────────────────────────────────────────────
          { path: "/",                               element: <S><DashboardPage /></S> },

          // ── Inventario (vendedor puede ver, no editar) ─────────────────────
          {
            element: <RoleGuard permiso="inventario_ver" />,
            children: [
              { path: "/inventario",               element: <S><InventarioPage /></S> },
              { path: "/inventario/productos",     element: <S><ProductosPage /></S> },
              { path: "/inventario/almacenes",     element: <S><AlmacenesPage /></S> },
              { path: "/inventario/stock",         element: <S><StockPage /></S> },
              { path: "/inventario/movimientos",   element: <S><MovimientosPage /></S> },
            ],
          },

          // ── Carga Masiva (admin + encargado_inventario) ────────────────────
          {
            element: <RoleGuard permiso="carga_masiva" />,
            children: [
              { path: "/carga-masiva",             element: <S><CargaMasivaPage /></S> },
              { path: "/compras/proveedores",      element: <S><ProveedoresPage /></S> },
              { path: "/compras",                  element: <S><ComprasPage /></S> },
              { path: "/compras/recepciones",      element: <S><RecepcionesPage /></S> },
            ],
          },

          // ── Ventas (admin + vendedor + cajero) ────────────────────────────
          {
            element: <RoleGuard permiso="ventas" />,
            children: [
              { path: "/ventas",                   element: <S><VentasPage /></S> },
              { path: "/ventas/clientes",          element: <S><ClientesPage /></S> },
              { path: "/ventas/cotizaciones",      element: <S><CotizacionesPage /></S> },
              { path: "/ventas/pagos",             element: <S><PagosPage /></S> },
            ],
          },

          // ── Caja (admin + cajero) ──────────────────────────────────────────
          {
            element: <RoleGuard permiso="caja" />,
            children: [
              { path: "/caja",                     element: <S><CajaPage /></S> },
            ],
          },

          // ── Reportes (todos los roles) ─────────────────────────────────────
          { path: "/reportes",                       element: <S><ReportesPage /></S> },
          { path: "/reportes/inventario",            element: <S><ReporteInventarioPage /></S> },
          { path: "/reportes/ventas",                element: <S><ReporteVentasPage /></S> },
          { path: "/reportes/movimientos",           element: <S><ReporteMovimientosPage /></S> },
          { path: "/reportes/bajo-stock",            element: <S><ReporteBajoStockPage /></S> },

          // ── Configuración (solo admin) ─────────────────────────────────────
          {
            element: <RoleGuard permiso="configuracion" />,
            children: [
              { path: "/administracion/usuarios",      element: <S><UsuariosPage /></S> },
              { path: "/administracion/empresa",       element: <S><EmpresaPage /></S> },
              { path: "/administracion/suscripcion",   element: <S><SuscripcionPage /></S> },
              { path: "/administracion/auditoria",     element: <S><AuditoriaPage /></S> },
              { path: "/administracion/configuracion", element: <S><ConfiguracionPage /></S> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routes);