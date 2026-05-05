/**
 * Preview elegante para un módulo cuyo backend aún no está listo.
 *
 * Muestra: ícono grande, título, descripción, lista de funcionalidades
 * previstas, y un badge del plan/addon requerido.
 *
 * Cuando llegue el backend del módulo, esta página se reemplaza por la real.
 */
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";

type PlanBadge =
  | "basico"
  | "profesional"
  | "distribuidora"
  | "empresarial"
  | "addon"
  | "core";

interface Props {
  icon: ComponentType<{ className?: string }>;
  title: string;
  /** Subtítulo: una línea sobre lo que hace el módulo. */
  description: string;
  /** Bullets de funcionalidades previstas (≤ 6 ítems). */
  features?: string[];
  /** Plan o addon requerido — se muestra como badge. */
  plan?: PlanBadge;
  /** Si quieres ocultar el botón "volver al dashboard". */
  hideBackLink?: boolean;
  /** Slot opcional al pie (para CTAs custom). */
  footer?: ReactNode;
}

const PLAN_LABEL: Record<PlanBadge, string> = {
  basico: "Plan Básico",
  profesional: "Plan Profesional",
  distribuidora: "Plan Distribuidora",
  empresarial: "Plan Empresarial",
  addon: "Addon",
  core: "Incluido en todos los planes",
};

const PLAN_COLOR: Record<PlanBadge, string> = {
  basico: "bg-slate-100 text-slate-700 ring-slate-200",
  profesional: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  distribuidora: "bg-amber-50 text-amber-800 ring-amber-100",
  empresarial: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  addon: "bg-violet-50 text-violet-700 ring-violet-100",
  core: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function ModuleComingSoon({
  icon: Icon,
  title,
  description,
  features = [],
  plan,
  hideBackLink = false,
  footer,
}: Props) {
  return (
    <div className="space-y-8">
      {/* Cabecera */}
      <div className="flex flex-col items-start gap-4 border-b pb-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                <Sparkles className="h-3 w-3" />
                Próximamente
              </span>
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        {plan && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1",
              PLAN_COLOR[plan],
            )}
          >
            {PLAN_LABEL[plan]}
          </span>
        )}
      </div>

      {/* Funcionalidades previstas */}
      {features.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Lo que viene en este módulo
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2.5 rounded-lg border bg-card px-3.5 py-3 text-sm"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {footer && <div className="pt-2">{footer}</div>}

      {!hideBackLink && (
        <div className="pt-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Volver al dashboard
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
