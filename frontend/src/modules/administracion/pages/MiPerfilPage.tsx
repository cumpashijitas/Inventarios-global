import { ImageIcon, UserCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { authApi } from "@/modules/auth/services/authApi";
import { useAuthStore } from "@/shared/stores/auth.store";
import { ROL_LABEL } from "@/shared/config/roles";

export default function MiPerfilPage() {
  const { email, rol } = useAuthStore();
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authApi.me()
      .then((r) => setFotoUrl(r.foto_url ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const subir = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se aceptan imágenes.");
      return;
    }
    setUploading(true);
    try {
      const r = await authApi.subirMiFoto(file);
      setFotoUrl(r.foto_url);
      toast.success("Foto de perfil actualizada.");
    } catch {
      toast.error("No se pudo subir la foto. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Mi Perfil</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tu foto aparece en el ranking de vendedores de Reportes y Dashboard.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 flex flex-col items-center gap-4 shadow-sm">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); }}
        />
        <div
          onDoubleClick={() => inputRef.current?.click()}
          onPaste={(e) => {
            const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
            const file = item?.getAsFile();
            if (file) subir(file);
          }}
          tabIndex={0}
          title="Clic + Ctrl+V para pegar · doble clic para subir archivo"
          className={`relative flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 overflow-hidden cursor-pointer outline-none transition-colors hover:border-indigo-400 focus:border-indigo-500 ${uploading ? "animate-pulse" : ""}`}
        >
          {loading ? null : fotoUrl ? (
            <img src={fotoUrl} alt="Mi foto" className="h-full w-full object-cover" />
          ) : (
            <UserCircle className="h-14 w-14 text-slate-300 dark:text-slate-600" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/70 dark:bg-black/50 flex items-center justify-center text-xs font-medium text-indigo-600">
              Subiendo…
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 text-center flex items-center gap-1">
          <ImageIcon className="h-3.5 w-3.5" /> Clic + Ctrl+V para pegar · doble clic para subir archivo (máx. 5 MB)
        </p>

        <div className="w-full border-t border-slate-100 dark:border-slate-800 pt-4 space-y-1 text-sm">
          <p className="text-slate-800 dark:text-slate-100 font-medium">{email}</p>
          <p className="text-slate-500 dark:text-slate-400 capitalize">{rol ? ROL_LABEL[rol] ?? rol : "—"}</p>
        </div>
      </div>
    </div>
  );
}
