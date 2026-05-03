import { Boxes, ChevronRight, Package, Warehouse } from "lucide-react";
import { Link } from "react-router-dom";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { useAuthStore } from "@/shared/stores/auth.store";

function getDisplayName(email: string | null | undefined): string {
  if (!email) return "";
  return email.split("@")[0];
}

export default function DashboardPage() {
  const email = useAuthStore((s) => s.email);
  const name = getDisplayName(email);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Hola, {name || "bienvenido"} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Aquí tienes acceso rápido a tu operación diaria.
        </p>
      </div>

      {/* Sección de accesos rápidos */}
      <div>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Accesos rápidos
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <ShortcutCard
            to="/inventario/productos"
            icon={Package}
            title="Productos"
            description="Catálogo, precios y stock mínimo."
            color="blue"
          />
          <ShortcutCard
            to="/inventario/almacenes"
            icon={Warehouse}
            title="Almacenes"
            description="Sucursales, depósitos y vehículos."
            color="violet"
          />
          <ShortcutCard
            to="/inventario/movimientos"
            icon={Boxes}
            title="Movimientos"
            description="Entradas, salidas y ajustes recientes."
            color="emerald"
          />
        </div>
      </div>
    </div>
  );
}

const colorMap = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function ShortcutCard({
  to,
  icon: Icon,
  title,
  description,
  color,
}: {
  to: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: keyof typeof colorMap;
}) {
  return (
    <Link to={to} className="group block focus-visible:outline-none">
      <Card className="h-full transition-all duration-200 group-hover:border-primary/40 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader className="space-y-3 pb-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${colorMap[color]}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-0.5 text-xs leading-relaxed">
              {description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Ir al módulo
            <ChevronRight className="h-3 w-3" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
