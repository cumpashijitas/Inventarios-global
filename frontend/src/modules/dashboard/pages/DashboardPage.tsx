import { Boxes, Package, Warehouse } from "lucide-react";
import { Link } from "react-router-dom";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useAuthStore } from "@/shared/stores/auth.store";

export default function DashboardPage() {
  const email = useAuthStore((s) => s.email);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenido</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {email ? `Hola, ${email}.` : ""} Atajos rápidos a tu operación diaria.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ShortcutCard
          to="/inventario/productos"
          icon={Package}
          title="Productos"
          description="Catálogo, precios y stock mínimo."
        />
        <ShortcutCard
          to="/inventario/almacenes"
          icon={Warehouse}
          title="Almacenes"
          description="Sucursales, depósitos y vehículos."
        />
        <ShortcutCard
          to="/inventario/movimientos"
          icon={Boxes}
          title="Movimientos"
          description="Entradas, salidas y ajustes recientes."
        />
      </div>
    </div>
  );
}

function ShortcutCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className="block">
      <Card className="transition-colors hover:bg-accent/30">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">Abrir →</CardContent>
      </Card>
    </Link>
  );
}
