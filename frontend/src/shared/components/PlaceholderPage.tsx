import { Construction } from "lucide-react";

interface Props {
  title: string;
  description?: string;
}

// Pantalla genérica para módulos aún no implementados.
// TODO: reemplazar por la vista real del módulo cuando el backend esté listo.
export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
        <Construction className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-xl font-semibold text-slate-800">{title}</h1>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      <span className="mt-5 inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
        Módulo en construcción
      </span>
    </div>
  );
}