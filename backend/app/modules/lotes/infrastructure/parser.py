"""
Extrae productos de archivos PDF y Excel de proveedores.

Estrategia:
1. Detectar tipo de archivo (PDF / Excel / CSV)
2. Extraer tabla de datos con pdfplumber u openpyxl
3. Mapear columnas del doc → campos del inventario usando diccionario de aliases
4. Devolver lista normalizada de items
"""
from __future__ import annotations

import io
import re
from typing import Any

# ─── Diccionario de aliases ───────────────────────────────────────────────────
# Clave = campo del inventario, Valor = variaciones que usan los proveedores

ALIASES: dict[str, list[str]] = {
    "sku": [
        "codigo", "cod", "cod.", "codigo_producto", "cod_prod",
        "cod universal", "cod_universal", "codigo universal",
        "part number", "part no", "part#", "referencia", "ref.",
        "item no", "item#", "no.", "n°",
        "clave", "clave interna", "clave producto", "sku", "codigo interno",
        "codigo de barras", "cod barra", "ean", "id producto", "id",
    ],
    "nombre": [
        "detalle", "descripcion", "descripcion del producto",
        "nombre", "nombre del producto", "producto", "articulo",
        "artículo", "item description", "description", "desc",
        "concepto", "detalle del producto", "denominacion", "denominación",
        "glosa", "producto/servicio", "nombre articulo",
    ],
    "cantidad": [
        "q", "cant", "cant.", "cantidad", "qty", "quantity", "unidades", "uds",
        "cant. pedida", "cantidad pedida",
    ],
    "precio_compra": [
        "precio", "pre-u", "precio_unitario", "precio unitario",
        "p.u.", "pu", "p/u", "unit price", "price", "valor",
        "precio real", "precio_real",
        "importe unitario", "importe unit", "costo unitario", "costo",
        "precio compra", "precio de compra", "vlr unitario", "valor unitario",
    ],
    "marca": ["marca", "brand", "fabricante"],
    "modelos": [
        "tt", "modelo", "modelos", "aplicacion", "aplicación",
        "compatible", "vehiculo", "vehículo", "vehiculos compatibles",
    ],
    "total": ["total", "imp-br.", "importe", "imp-neto", "importe bruto", "subtotal", "imp. bruto"],
    "unidad": ["u-m.", "u.m.", "unidad", "um", "unit", "u"],
    "descripcion": ["observaciones", "notas", "obs", "nota", "remarks"],
}

# Campos que importan para el inventario (los demás se descartan)
CAMPOS_OBJETIVO = {"sku", "nombre", "cantidad", "precio_compra", "marca", "modelos", "descripcion"}


def _normalizar_header(h: Any) -> str:
    """Pasa el header a minúsculas colapsando espacios y saltos de línea."""
    if h is None:
        return ""
    # pdfplumber a veces incluye \n dentro de una celda multilinea
    texto = re.sub(r"[\n\r\t]+", " ", str(h))
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip().lower()


def _mapear_columnas(headers: list[Any]) -> dict[int, str]:
    """
    Dado un listado de cabeceras, retorna {indice_col: campo_inventario}.
    Reglas:
    1. Match exacto (todos los alias)
    2. Match substring solo para aliases > 3 chars (evita falsos positivos como "n" en "descripcion")
    3. Cada campo solo se asigna UNA vez (primer match gana)
    """
    resultado: dict[int, str] = {}
    campos_ya_asignados: set[str] = set()

    for i, h in enumerate(headers):
        norm = _normalizar_header(h)
        if not norm:
            continue
        for campo, aliases in ALIASES.items():
            if campo in campos_ya_asignados:
                continue
            # Prioridad 1: match exacto
            if norm in aliases:
                resultado[i] = campo
                campos_ya_asignados.add(campo)
                break
            # Prioridad 2: substring (solo aliases > 3 chars para evitar "n", "#", etc.)
            if any(alias in norm for alias in aliases if len(alias) > 3):
                resultado[i] = campo
                campos_ya_asignados.add(campo)
                break
    return resultado


def _limpiar_valor(v: Any) -> str:
    """Convierte un valor de celda a string limpio."""
    if v is None:
        return ""
    s = str(v).strip()
    # Reemplazar saltos de línea (pdfplumber los incluye en celdas multilinea)
    s = re.sub(r"[\n\r]+", " ", s).strip()
    # Eliminar trailing .0 de floats (ej: "2.0" → "2")
    if re.match(r"^\d+\.0$", s):
        s = s[:-2]
    return s


def _normalizar_codigo(codigo: str) -> str:
    """
    Normaliza el código del documento para matching:
    - Elimina prefijo * (La Casa del Retén usa *AA8093E-NKC)
    - Strip espacios, uppercase
    """
    c = codigo.strip().lstrip("*").upper()
    return c


def _extraer_marca_de_codigo(codigo: str) -> str | None:
    """
    Detecta si el código tiene el formato CODIGO-MARCA (ej: AA8093E-NKC).
    Retorna la marca si el sufijo parece un código de fabricante (2-6 letras mayúsculas).
    """
    parts = codigo.rsplit("-", 1)
    if len(parts) == 2:
        sufijo = parts[1].strip()
        if re.match(r"^[A-Z]{2,8}$", sufijo):
            return sufijo
    return None


def _tabla_a_items(
    headers: list[Any],
    filas: list[list[Any]],
) -> list[dict[str, str]]:
    """
    Convierte una tabla (headers + filas) a lista de items normalizados.
    """
    mapa = _mapear_columnas(headers)
    if not mapa:
        return []

    items: list[dict[str, str]] = []
    for fila in filas:
        item: dict[str, str] = {}
        for col_idx, campo in mapa.items():
            if col_idx < len(fila):
                item[campo] = _limpiar_valor(fila[col_idx])

        # Saltar filas vacías o que son subtotales
        if not item.get("sku") and not item.get("nombre"):
            continue
        nombre = item.get("nombre", "")
        if nombre.upper() in {"TOTAL", "SUBTOTAL", "TOTAL NETO", ""}:
            continue

        # Normalizar código
        if item.get("sku"):
            codigo_original = item["sku"]
            item["sku"] = _normalizar_codigo(codigo_original)
            # Si no tiene marca pero el código tiene sufijo de marca, extraerla
            if not item.get("marca"):
                marca_detectada = _extraer_marca_de_codigo(item["sku"])
                if marca_detectada:
                    item["marca"] = marca_detectada

        # Limpiar nombre: quitar la marca del proveedor que pdfplumber
        # a veces pega al final por celdas multilinea (ej. "AMORTIGUADOR... \nSHIELD")
        if item.get("nombre") and item.get("marca"):
            marca = item["marca"].strip().upper()
            nombre = item["nombre"].strip()
            if nombre.upper().endswith(" " + marca):
                item["nombre"] = nombre[: -(len(marca) + 1)].strip()

        # Limpiar precio de símbolos
        for campo_precio in ("precio_compra",):
            if campo_precio in item:
                raw = re.sub(r"[^\d.,]", "", item[campo_precio])
                # "117,8" → decimal con coma → convertir a "117.8"
                # "1,234.56" → miles con coma → eliminar coma → "1234.56"
                if re.match(r"^\d+,\d{1,3}$", raw) and "." not in raw:
                    raw = raw.replace(",", ".")   # coma decimal
                else:
                    raw = raw.replace(",", "")    # separador de miles
                item[campo_precio] = raw

        items.append(item)

    return items


# ─── Parsers por tipo de archivo ─────────────────────────────────────────────

def _buscar_mejor_tabla(
    all_tables: list[list[list[Any]]],
) -> tuple[list[list[Any]] | None, int, int]:
    """
    Devuelve (tabla, header_idx, score).
    Busca la tabla que tenga la fila con mayor coincidencia de campos,
    explorando hasta la fila 15 de cada tabla (cubre documentos con encabezado).
    """
    mejor: list[list[Any]] | None = None
    mejor_score = 0
    mejor_header_idx = 0

    for tabla in all_tables:
        if len(tabla) < 2:
            continue
        for i, fila in enumerate(tabla[:15]):   # hasta fila 15
            score = len(_mapear_columnas(fila))
            if score > mejor_score:
                mejor_score = score
                mejor = tabla
                mejor_header_idx = i

    return mejor, mejor_header_idx, mejor_score


def _limpiar_numero(raw: str) -> str:
    """
    Normaliza un valor numérico extraído: quita símbolos, convierte coma decimal.
    Retorna string numérico limpio o "" si no había nada.
    """
    raw = re.sub(r"[^\d.,]", "", raw)
    if not raw:
        return ""
    # "117,8" → decimal con coma → "117.8"
    if re.match(r"^\d+,\d{1,3}$", raw) and "." not in raw:
        return raw.replace(",", ".")
    # "1,234.56" → separador de miles → "1234.56"
    return raw.replace(",", "")


def _extract_word_zones(pdf: Any) -> list[dict[str, str]]:
    """
    Extracción zone-based para PDFs sin bordes de tabla (ej. cotizaciones de retenes).
    Detecta 3 zonas por fila usando la posición de las cabeceras:
      ZONA CODE   → x < code_end     → campo "sku"
      ZONA DESC   → code_end ≤ x < desc_end → campo "nombre"
      ZONA NUMS   → x ≥ desc_end     → campos cantidad / unidad / precio_compra / total
    """
    all_items: list[dict[str, str]] = []

    for page in pdf.pages:
        words = page.extract_words(keep_blank_chars=False)
        if not words:
            continue

        # Agrupar por y (tolerancia 6px — suficiente para unir números que el PDF
        # coloca ligeramente por encima del texto de la misma fila)
        filas_pos: dict[int, list[dict]] = {}
        for w in words:
            y_key = round(w["top"] / 6) * 6
            filas_pos.setdefault(y_key, []).append(w)
        sorted_rows = sorted(filas_pos.items())

        # ── Detectar fila de cabecera y zonas ────────────────────────────────
        header_y   = None
        code_end   = None   # borde derecho de la columna SKU
        desc_end   = None   # borde izquierdo de la primera columna numérica
        num_cols: list[tuple[float, str]] = []   # (x_inicio, campo)

        for y, row_words in sorted_rows:
            hits: dict[str, dict] = {}
            for w in sorted(row_words, key=lambda x: x["x0"]):
                norm = _normalizar_header(w["text"])
                for campo, aliases in ALIASES.items():
                    if norm in aliases and campo not in hits:
                        hits[campo] = w
                        break
            if len(hits) < 2:
                continue
            header_y = y
            if "sku" in hits:
                code_end = hits["sku"]["x1"] + 5
            if "cantidad" in hits:
                desc_end = hits["cantidad"]["x0"] - 5
            elif "precio_compra" in hits:
                desc_end = hits["precio_compra"]["x0"] - 5
            for campo in ("cantidad", "unidad", "precio_compra", "total"):
                if campo in hits:
                    num_cols.append((hits[campo]["x0"], campo))
            num_cols.sort()
            break

        if header_y is None or code_end is None or desc_end is None:
            continue

        # Midpoints para separar columnas numéricas entre sí
        num_mids = [
            (num_cols[i][0] + num_cols[i + 1][0]) / 2
            for i in range(len(num_cols) - 1)
        ]

        def campo_numerico(x: float) -> str | None:
            for j, mid in enumerate(num_mids):
                if x < mid:
                    return num_cols[j][1] if j < len(num_cols) else None
            return num_cols[-1][1] if num_cols else None

        # ── Extraer filas de datos ────────────────────────────────────────────
        # Algunos PDFs ponen los números (cantidad, precio) en una fila Y
        # ligeramente diferente a la del SKU. Guardamos esos datos "huérfanos"
        # y los aplicamos a la siguiente fila con código.
        pending_nums: dict[str, str] = {}

        for y, row_words in sorted_rows:
            if y <= header_y:
                continue
            code_parts: list[str] = []
            desc_parts: list[str] = []
            num_vals: dict[str, str] = {}

            for w in sorted(row_words, key=lambda x: x["x0"]):
                x = w["x0"]
                txt = w["text"]
                if x < code_end:
                    code_parts.append(txt)
                elif x < desc_end:
                    desc_parts.append(txt)
                else:
                    c = campo_numerico(x)
                    if c:
                        num_vals[c] = (num_vals.get(c, "") + " " + txt).strip()

            code  = _normalizar_codigo(" ".join(code_parts))
            nombre = " ".join(desc_parts)

            # Fila con solo datos numéricos (sin código ni descripción):
            # guardar para la próxima fila con SKU
            if not code and not nombre and (num_vals.get("cantidad") or num_vals.get("precio_compra")):
                pending_nums = num_vals
                continue

            # Descartar filas de continuación sin datos útiles
            if not code and not num_vals.get("cantidad") and not num_vals.get("precio_compra"):
                continue
            if not code and not nombre:
                pending_nums = {}
                continue

            # Filtrar filas de pie de página: un SKU válido contiene al menos
            # un dígito o un guion (ej. "AA8093E-NKC", "M4570-MUSASHI").
            # Palabras como "ALVARO", "SON:", "EQUIVALENTE" no califican.
            if code and not re.search(r"[0-9\-]", code):
                pending_nums = {}
                continue

            # Si la fila tiene SKU pero le faltan los datos numéricos,
            # aplicar los que quedaron pendientes de la fila anterior
            if pending_nums and not num_vals.get("cantidad") and not num_vals.get("precio_compra"):
                for k, v in pending_nums.items():
                    if k not in num_vals:
                        num_vals[k] = v
            pending_nums = {}

            item: dict[str, str] = {"sku": code, "nombre": nombre}
            item.update(num_vals)

            # Limpiar campos numéricos (precio, cantidad)
            for campo_num in ("precio_compra", "cantidad"):
                if campo_num in item:
                    limpio = _limpiar_numero(item[campo_num])
                    # Si limpió a vacío (texto no numérico), dejar "" para que
                    # el schema lo convierta a 0; no recuperar el valor original
                    item[campo_num] = limpio

            # Extraer marca embebida en el código (ej. AA8093E-NKC → NKC)
            if item.get("sku") and not item.get("marca"):
                marca = _extraer_marca_de_codigo(item["sku"])
                if marca:
                    item["marca"] = marca

            all_items.append(item)

    return all_items


# Un "código" de producto: alfanumérico con separadores típicos (-, /, .),
# 3-25 caracteres, y al menos un dígito (para no confundir con palabras sueltas).
_CODE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-/.]{2,24}$")
# Un "precio" al final de línea: número con separador de miles/decimales opcional.
_PRICE_RE = re.compile(r"^\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?$")


def _extract_generic_lines(pdf: Any) -> list[dict[str, str]]:
    """
    Última estrategia — no depende de reconocer ningún encabezado.
    Para cada línea de texto busca: primer token con forma de código de
    producto (tiene un dígito) ... último token con forma de precio, y toma
    todo lo de en medio como nombre. Sirve para PDFs sin tabla real, sin
    encabezados, o con encabezados que el diccionario de alias no reconoce
    (listas de precios simples, cotizaciones en texto plano, etc.).
    """
    items: list[dict[str, str]] = []

    for page in pdf.pages:
        texto = page.extract_text() or ""
        for linea in texto.split("\n"):
            linea = linea.strip()
            if len(linea) < 8:
                continue
            tokens = linea.split()
            if len(tokens) < 3:
                continue

            primero = tokens[0]
            if not re.search(r"\d", primero) or not _CODE_RE.match(primero):
                continue

            # Buscar de derecha a izquierda el último token con forma de precio
            precio_idx = None
            for i in range(len(tokens) - 1, 0, -1):
                candidato = re.sub(r"[^\d.,]", "", tokens[i])
                if candidato and _PRICE_RE.match(candidato):
                    precio_idx = i
                    break
            if precio_idx is None or precio_idx <= 1:
                continue

            nombre = " ".join(tokens[1:precio_idx]).strip()
            # Descartar nombres demasiado cortos (probable falso positivo:
            # totales, fechas, pies de página)
            if len(nombre) < 3 or not re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}", nombre):
                continue

            codigo = _normalizar_codigo(primero)
            precio = _limpiar_numero(tokens[precio_idx])
            item: dict[str, str] = {"sku": codigo, "nombre": nombre}
            if precio:
                item["precio_compra"] = precio

            marca = _extraer_marca_de_codigo(codigo)
            if marca:
                item["marca"] = marca

            items.append(item)

    return items


def parse_pdf(content: bytes) -> tuple[list[dict[str, str]], list[str]]:
    """
    Extrae items de un PDF digital.
    Intenta primero con extract_tables() (PDFs con bordes visibles).
    Si falla, usa extracción word-based (PDFs sin bordes, layout de texto).
    """
    try:
        import pdfplumber  # noqa: PLC0415
    except ImportError:
        return [], ["pdfplumber no está instalado. Ejecuta: uv add pdfplumber"]

    advertencias: list[str] = []

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        # ── Estrategia 1: tablas con bordes ──────────────────────────────────
        all_tables: list[list[list[Any]]] = []
        for page in pdf.pages:
            tbls = page.extract_tables()
            if tbls:
                all_tables.extend(tbls)

        mejor_tabla, mejor_header_idx, mejor_score = _buscar_mejor_tabla(all_tables)

        if mejor_tabla is not None and mejor_score >= 2:
            headers    = mejor_tabla[mejor_header_idx]
            filas_datos: list[list[Any]] = list(mejor_tabla[mejor_header_idx + 1:])

            # Agregar filas de tablas de continuación (páginas siguientes, sin headers)
            for tabla in all_tables:
                if tabla is mejor_tabla:
                    continue
                if len(_mapear_columnas(tabla[0] if tabla else [])) < 1:
                    filas_datos.extend(tabla)

            items = _tabla_a_items(headers, filas_datos)
            if items:
                return items, advertencias

        # ── Estrategia 2: zone-based sin bordes ──────────────────────────────
        items_word = _extract_word_zones(pdf)
        if items_word:
            return items_word, advertencias

        # ── Estrategia 3: líneas de texto sin encabezados reconocibles ───────
        items_generic = _extract_generic_lines(pdf)
        if items_generic:
            advertencias.append(
                "No se detectó una tabla ni encabezados de columna reconocidos: "
                "los productos se extrajeron por patrón de texto (código … precio). "
                "Revisa con cuidado los datos de cada fila antes de guardar."
            )
            return items_generic, advertencias

    # ── Sin resultado ─────────────────────────────────────────────────────────
    advertencias.append(
        "No se pudieron extraer productos del PDF. "
        "Verifica que el documento tenga una tabla con columnas de Código, Nombre/Descripción y Precio. "
        "También puedes ingresar los productos manualmente."
    )
    return [], advertencias


def parse_excel(content: bytes, filename: str = "") -> tuple[list[dict[str, str]], list[str]]:
    """
    Extrae items de un archivo Excel (.xlsx, .xls).
    Retorna (items, advertencias).
    """
    try:
        import openpyxl  # noqa: PLC0415
    except ImportError:
        return [], ["openpyxl no está instalado. Ejecuta: uv add openpyxl"]

    advertencias: list[str] = []

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    if ws is None:
        return [], ["El archivo Excel no tiene hojas activas."]

    rows = [list(row) for row in ws.iter_rows(values_only=True)]
    wb.close()

    if len(rows) < 2:
        return [], ["El archivo Excel tiene menos de 2 filas."]

    # Buscar la fila de headers (primera que tenga coincidencias con aliases)
    header_idx = 0
    for i, fila in enumerate(rows[:10]):
        mapa = _mapear_columnas(fila)
        if len(mapa) >= 2:
            header_idx = i
            break

    headers = rows[header_idx]
    filas = rows[header_idx + 1:]
    items = _tabla_a_items(headers, filas)

    if not items:
        advertencias.append("No se pudieron mapear las columnas del Excel al formato del inventario.")

    return items, advertencias


def parse_csv(content: bytes) -> tuple[list[dict[str, str]], list[str]]:
    """Extrae items de un CSV (separador automático: coma o punto y coma)."""
    import csv  # noqa: PLC0415

    text = content.decode("utf-8-sig", errors="replace")
    # Detectar separador
    sep = ";" if text.count(";") > text.count(",") else ","
    reader = csv.reader(io.StringIO(text), delimiter=sep)
    rows = list(reader)

    if len(rows) < 2:
        return [], ["El CSV tiene menos de 2 filas."]

    headers = rows[0]
    filas = [list(r) for r in rows[1:]]
    items = _tabla_a_items(headers, filas)
    return items, []
