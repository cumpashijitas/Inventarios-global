"""
Genera un SQL que SOLO rellena precios faltantes (0 o vacío) usando
INVENTARIO_UNIFICADO.xlsx como fuente — nunca toca un campo que ya tenga
un valor real distinto de 0, sin importar qué valor traiga el Excel para
ese campo. Es un "fill de huecos", no un update masivo.

Por cada uno de los 6 campos de precio, la condición es:
  - El Excel trae un valor > 0 para ese campo, Y
  - La base de datos hoy tiene ese campo en 0 o NULL
  -> entonces (y solo entonces) se actualiza ESE campo puntual.

Implementación: UPDATE ... FROM (VALUES ...) — UNA sola sentencia SQL por
parte (bulk, set-based), no miles de UPDATE secuenciales dentro de un
DO $$ ... $$. Un DO block con miles de statements PL/pgSQL es lento de
compilar/ejecutar y genera archivos enormes (CASE WHEN repetido por fila);
esto es ~5-8x más chico y se ejecuta como una sola operación.
"""
import openpyxl
import math
import os

def to_num(v):
    """Devuelve float o None (si está vacío/no numérico)."""
    if v is None or str(v).strip() == "":
        return None
    try:
        return round(float(str(v)), 4)
    except Exception:
        return None

def fmt(n):
    s = str(n).rstrip("0").rstrip(".")
    return s if s else "0"

def esc(v):
    return "'" + str(v).strip().replace("'", "''") + "'"

wb = openpyxl.load_workbook("backend/example_tables/INVENTARIO_UNIFICADO.xlsx", data_only=True)
ws = wb.active

CAMPOS = [
    # (columna_excel, nombre_columna_db)
    (6,  "precio_compra"),
    (7,  "costo_caja"),
    (8,  "precio_venta"),
    (9,  "precio_mayor"),
    (10, "precio_mecanico"),
    (11, "precio_real"),
]
NOMBRES_CAMPOS = [c[1] for c in CAMPOS]

filas = []  # cada elemento: (sku, {campo: valor o None})

for r in range(2, ws.max_row + 1):
    sku = ws.cell(r, 1).value
    if not sku:
        continue

    valores = {}
    tiene_candidato = False
    for col_excel, campo_db in CAMPOS:
        val = to_num(ws.cell(r, col_excel).value)
        if val is not None and val > 0:
            valores[campo_db] = val
            tiene_candidato = True
        else:
            valores[campo_db] = None

    if not tiene_candidato:
        continue

    filas.append((str(sku).strip(), valores))

print(f"Productos con al menos un hueco que se puede rellenar desde el Excel: {len(filas)}")

os.makedirs("sql", exist_ok=True)

# Partimos por tamaño objetivo (no por cantidad fija) para mantener cada
# parte liviana y rápida de pegar/ejecutar en el SQL Editor de Supabase.
BATCH = 4000
PARTS = max(1, math.ceil(len(filas) / BATCH))

def values_tuple(sku, valores, primera_fila):
    partes = [esc(sku)]
    for campo in NOMBRES_CAMPOS:
        val = valores[campo]
        if val is None:
            partes.append("NULL::numeric" if primera_fila else "NULL")
        else:
            lit = fmt(val)
            partes.append(f"{lit}::numeric" if primera_fila else lit)
    return "    (" + ", ".join(partes) + ")"

for part in range(PARTS):
    chunk = filas[part * BATCH:(part + 1) * BATCH]
    if not chunk:
        continue
    suffix = f"-parte-{part + 1}" if PARTS > 1 else ""
    filename = f"sql/37-fix-precios-faltantes{suffix}.sql"

    values_lines = [
        values_tuple(sku, valores, i == 0) for i, (sku, valores) in enumerate(chunk)
    ]

    set_lines = []
    for campo in NOMBRES_CAMPOS:
        set_lines.append(
            f"  {campo} = CASE WHEN v.{campo} IS NOT NULL AND (p.{campo} IS NULL OR p.{campo} = 0) "
            f"THEN v.{campo} ELSE p.{campo} END"
        )

    hueco_conditions = " OR\n    ".join(
        f"(v.{campo} IS NOT NULL AND (p.{campo} IS NULL OR p.{campo} = 0))"
        for campo in NOMBRES_CAMPOS
    )

    lines = [
        "-- =============================================================================",
        f"-- 37-fix-precios-faltantes{suffix}.sql  ({len(chunk)} productos con huecos)",
        "-- SOLO rellena precios en 0/NULL usando INVENTARIO_UNIFICADO.xlsx como fuente.",
        "-- NO toca ningun campo que ya tenga un valor real (>0) en la base.",
        "-- Sentencia SQL unica (bulk UPDATE ... FROM VALUES), no PL/pgSQL.",
        "-- Ejecutar en Supabase SQL Editor.",
        "-- =============================================================================",
        "",
        f"WITH v(sku, {', '.join(NOMBRES_CAMPOS)}) AS (",
        "  VALUES",
        ",\n".join(values_lines),
        ")",
        "UPDATE public.productos p",
        "SET",
        ",\n".join(set_lines),
        "FROM v",
        "WHERE p.sku = v.sku",
        "  AND p.empresa_id = (SELECT id FROM public.empresas LIMIT 1)",
        "  AND (",
        f"    {hueco_conditions}",
        "  );",
    ]

    with open(filename, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  -> {filename} ({os.path.getsize(filename)//1024} KB, {len(chunk)} filas)")
