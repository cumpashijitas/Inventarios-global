import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { authApi } from "@/modules/auth/services/authApi";
import { extractApiError } from "@/shared/api/client";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useToast } from "@/shared/components/ui/toast";
import { useAuthStore } from "@/shared/stores/auth.store";

export default function SelectEmpresaPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const empresas = useAuthStore((s) => s.empresasDisponibles);
  const setTokens = useAuthStore((s) => s.setTokens);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  if (empresas.length === 0) {
    return <Navigate to="/login" replace />;
  }

  const handleSelect = async (empresaId: string) => {
    setSubmittingId(empresaId);
    try {
      const tokens = await authApi.selectEmpresa(empresaId);
      setTokens(tokens);
      navigate("/", { replace: true });
    } catch (err) {
      const e = extractApiError(err);
      toast({
        variant: "destructive",
        title: "No se pudo seleccionar la empresa",
        description: e.message,
      });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Selecciona empresa</CardTitle>
        <CardDescription>
          Tu usuario tiene acceso a varias empresas. Elige una para continuar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {empresas.map((e) => (
          <Button
            key={e.id}
            variant="outline"
            className="h-auto w-full justify-start gap-3 p-3"
            onClick={() => handleSelect(e.id)}
            disabled={submittingId !== null}
          >
            {submittingId === e.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                {e.razon_social.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1 text-left">
              <div className="text-sm font-medium">{e.razon_social}</div>
              <div className="text-xs text-muted-foreground">Rol: {e.rol}</div>
            </div>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
