/**
 * Formatea un número como moneda boliviana.
 * fmtBs(123.5)  → "Bs 123.50"
 * fmtBs("45.0") → "Bs 45.00"
 */
export const fmtBs = (value: number | string): string => {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return `Bs ${isNaN(n) ? "0.00" : n.toFixed(2)}`;
};
