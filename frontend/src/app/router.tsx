import { lazy, Suspense } from "react";
import { Navigate, Outlet, createBrowserRouter, type RouteObject } from "react-router-dom";

import { AppShell } from "@/app/layouts/AppShell";
import { AuthLayout } from "@/app/layouts/AuthLayout";
import { Skeleton } from "@/shared/components/Skeleton";
import { useAuthStore, selectIsAuthenticated } from "@/shared/stores/auth.store";

// ── Auth ─────────────────────────────────────────────────────────────────────
const LoginPage        = lazy(() => import("@/modules/auth/pages/LoginPage"));
const SelectEmpresaPage = lazy(() => import("@/modules/auth/pages/SelectEmpresaPage"));

// ── Dashboard ────────────────────────────────────────────────────────────────
const DashboardPage    = lazy(() => import("@/modules/dashboard/pages/DashboardPage"));

// ── Inventario ───────────────────────────────────────────────────────────────
const ProductosPage    = lazy(() => import("@/modules/inventario/pages/ProductosPage"));
const AlmacenesPage    = lazy(() => import("@/modules/inventario/pages/AlmacenesPage"));
const StockPage        = lazy(() => import("@/modules/inventario/pages/StockPage"));
const MovimientosPage  = lazy(() => import("@/modules/inventario/pages/MovimientosPage"));

// ── Ventas ───────────────────────────────────────────────────────────────────
// TODO: implementar vistas reales cuando el módulo de ventas esté listo en el backend
const ClientesPage     = lazy(() => import("@/modules/ventas/pages/ClientesPage"));
const CotizacionesPage = lazy(() => import("@/modules/ventas/pages/CotizacionesPage"));
const VentasPage       = lazy(() => import("@/modules/ventas/pages/VentasPage"));
const PagosPage        = lazy(() => import("@/modules/ventas/pages/PagosPage"));

// ── Compras ──────────────────────────────────────────────────────────────────
// TODO: implementar vistas reales cuando el módulo de compras esté listo en el backend
const ProveedoresPage  = lazy(() => import("@/modules/compras/pages/ProveedoresPage"));
const ComprasPage      = lazy(() => import("@/modules/compras/pages/ComprasPage"));
const RecepcionesPage  = lazy(() => import("@/modules/compras/pages/RecepcionesPage"));

// ── Reportes ─────────────────────────────────────────────────────────────────
// TODO: implementar con consultas analíticas al backend una vez definidas las vistas SQL
const ReporteInventarioPage  = lazy(() => import("@/modules/reportes/pages/ReporteInventarioPage"));
const ReporteVentasPage      = lazy(() => import("@/modules/reportes/pages/ReporteVentasPage"));
const ReporteMovimientosPage = lazy(() => import("@/modules/reportes/pages/ReporteMovimientosPage"));
const ReporteBajoStockPage   = lazy(() => import("@/modules/reportes/pages/ReporteBajoStockPage"));

// ── Administración ───────────────────────────────────────────────────────────
// TODO: implementar con endpoints de gestión de empresa, usuarios y suscripción
const UsuariosPage     = lazy(() => import("@/modules/administracion/pages/UsuariosPage"));
const EmpresaPage      = lazy(() => import("@/modules/administracion/pages/EmpresaPage"));
const SuscripcionPage  = lazy(() => import("@/modules/administracion/pages/SuscripcionPage"));
const AuditoriaPage    = lazy(() => import("@/modules/administracion/pages/AuditoriaPage"));
const ConfiguracionPage = lazy(() => import("@/modules/administracion/pages/ConfiguracionPage"));

function ProtectedRoute() {
  const isAuth = useAuthStore(selectIsAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const empresaId = useAuthStore((s) => s.empresaId);

  if (accessToken && !empresaId) {
    return <Navigate to="/login/select-empresa" replace />;
  }
  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }
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
          // Dashboard
          { path: "/",                          element: <S><DashboardPage /></S> },

          // Inventario
          { path: "/inventario/productos",      element: <S><ProductosPage /></S> },
          { path: "/inventario/almacenes",      element: <S><AlmacenesPage /></S> },
          { path: "/inventario/stock",          element: <S><StockPage /></S> },
          { path: "/inventario/movimientos",    element: <S><MovimientosPage /></S> },

          // Ventas
          { path: "/ventas/clientes",           element: <S><ClientesPage /></S> },
          { path: "/ventas/cotizaciones",       element: <S><CotizacionesPage /></S> },
          { path: "/ventas",                    element: <S><VentasPage /></S> },
          { path: "/ventas/pagos",              element: <S><PagosPage /></S> },

          // Compras
          { path: "/compras/proveedores",       element: <S><ProveedoresPage /></S> },
          { path: "/compras",                   element: <S><ComprasPage /></S> },
          { path: "/compras/recepciones",       element: <S><RecepcionesPage /></S> },

          // Reportes
          { path: "/reportes/inventario",       element: <S><ReporteInventarioPage /></S> },
          { path: "/reportes/ventas",           element: <S><ReporteVentasPage /></S> },
          { path: "/reportes/movimientos",      element: <S><ReporteMovimientosPage /></S> },
          { path: "/reportes/bajo-stock",       element: <S><ReporteBajoStockPage /></S> },

          // Administración
          { path: "/administracion/usuarios",   element: <S><UsuariosPage /></S> },
          { path: "/administracion/empresa",    element: <S><EmpresaPage /></S> },
          { path: "/administracion/suscripcion",element: <S><SuscripcionPage /></S> },
          { path: "/administracion/auditoria",  element: <S><AuditoriaPage /></S> },
          { path: "/administracion/configuracion", element: <S><ConfiguracionPage /></S> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routes);