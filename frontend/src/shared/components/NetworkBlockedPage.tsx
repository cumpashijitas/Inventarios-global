import { WifiOff } from "lucide-react";
import { useAuthStore } from "@/shared/stores/auth.store";

export function NetworkBlockedPage() {
  const setNetworkBlocked = useAuthStore((s) => s.setNetworkBlocked);
  const logout = useAuthStore((s) => s.logout);

  const handleReintentar = () => {
    setNetworkBlocked(false);
    window.location.reload();
  };

  const handleSalir = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 mb-6">
        <WifiOff className="h-8 w-8 text-red-400" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">
        Acceso restringido
      </h1>

      <p className="text-slate-400 max-w-sm mb-2">
        Tu dispositivo no está conectado a la red autorizada de la tienda.
      </p>

      <p className="text-slate-500 text-sm max-w-sm mb-8">
        Conectate al WiFi de la tienda e intentá de nuevo. Si el problema persiste, contactá al administrador.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={handleReintentar}
          className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Ya me conecté — Reintentar
        </button>
        <button
          onClick={handleSalir}
          className="w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
