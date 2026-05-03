import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">IS</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Inventario SaaS</h1>
          <p className="text-sm text-muted-foreground">Plataforma de operaciones</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
