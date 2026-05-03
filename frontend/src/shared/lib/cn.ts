import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina class names con merge de Tailwind (resuelve conflictos como `p-2 p-4`). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
