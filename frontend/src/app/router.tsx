import { lazy, Suspense } from "react";
import { Navigate, Outlet, createBrowserRouter, type RouteObject } from "react-router-dom";

import { AppShell } from "@/app/layouts/AppShell";
import { AuthLayout } from "@/app/layouts/AuthLayout";
import { Skeleton } from "@/shared/components/Skeleton";
import { useAuthStore, selectIsAuthenticated } from "@/shared/stores/auth.store";

// Lazy: cada módulo en su propio chunk
const LoginPage = lazy(() => import("@/modules/auth/pages/LoginPage"));
const SelectEmpresaPage = lazy(() => import("@/modules/auth/pages/SelectEmpresaPage"));
const DashboardPage = lazy(() => import("@/modules/dashboard/pages/DashboardPage"));
const ProductosPage = lazy(() => import("@/modules/inventario/pages/ProductosPage"));
const AlmacenesPage = lazy(() => import("@/modules/inventario/pages/AlmacenesPage"));
const MovimientosPage = lazy(() => import("@/modules/inventario/pages/MovimientosPage"));

function ProtectedRoute() {
  const isAuth = useAuthStore(selectIsAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const empresaId = useAuthStore((s) => s.empresaId);

  // Tiene token pero no eligió empresa → al selector
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

const routes: RouteObject[] = [
  {
    element: <AuthLayout />,
    children: [
      {
        path: "/login",
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: "/login/select-empresa",
        element: (
          <Suspense fallback={<PageSkeleton />}>
            <SelectEmpresaPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: "/",
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <DashboardPage />
              </Suspense>
            ),
          },
          {
            path: "/inventario/productos",
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <ProductosPage />
              </Suspense>
            ),
          },
          {
            path: "/inventario/almacenes",
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <AlmacenesPage />
              </Suspense>
            ),
          },
          {
            path: "/inventario/movimientos",
            element: (
              <Suspense fallback={<PageSkeleton />}>
                <MovimientosPage />
              </Suspense>
            ),
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter(routes);
