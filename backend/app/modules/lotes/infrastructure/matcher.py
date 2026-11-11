"""
Compara cada item extraído del documento con los productos del inventario.

Niveles de matching (en orden de prioridad):
  1. SKU exacto (case-insensitive)
  2. SKU parcial: los primeros N chars del código coinciden
  3. Nombre similar: contiene la misma palabra clave principal
  4. Sin coincidencia → producto nuevo
"""
from __future__ import annotations

import re
from typing import Any
from uuid import UUID

import asyncpg


def _normalize(text: str) -> str:
    return text.strip().upper().replace(" ", "").replace("-", "").replace(".", "")


def _inv_data(prod: dict) -> dict:
    """Snapshot de los campos del producto en inventario para mostrar como referencia."""
    def s(v: object) -> str | None:
        return str(v) if v is not None else None
    return {
        "nombre":          prod.get("nombre"),
        "marca":           prod.get("marca"),
        "precio_compra":   s(prod.get("precio_compra")),
        "precio_venta":    s(prod.get("precio_venta")),
        "precio_mecanico": s(prod.get("precio_mecanico")),
        "precio_mayor":    s(prod.get("precio_mayor")),
        "aplicacion":      prod.get("aplicacion"),
        "medidas":         prod.get("medidas"),
        "modelos":         prod.get("modelos"),
        "anio_desde":      prod.get("anio_desde"),
        "anio_hasta":      prod.get("anio_hasta"),
        "descripcion":     prod.get("descripcion"),
    }


def _palabras_clave(nombre: str) -> list[str]:
    """Extrae palabras de 4+ caracteres del nombre para búsqueda parcial."""
    palabras = re.findall(r"\b[A-Za-záéíóúÁÉÍÓÚñÑ]{4,}\b", nombre)
    return [p.upper() for p in palabras[:3]]


async def match_items(
    conn: asyncpg.Connection,
    empresa_id: UUID,
    items: list[dict[str, str]],
    requerir_completo: bool = True,
) -> list[dict[str, Any]]:
    """
    Para cada item del documento, busca si ya existe en el inventario.
    Devuelve la lista enriquecida con campos de matching.

    requerir_completo: si True (default, usado por parse-archivo), una fila
    sin sku o sin nombre se marca "incompleto" sin importar si matcheó algo —
    tiene sentido ahí porque indica que el parseo del documento trajo una
    fila rota. Si False (usado por /lotes/match, para filas cargadas a
    mano), NO se fuerza "incompleto" solo porque falte un campo: el usuario
    puede estar escribiendo el sku primero y el nombre después, y mientras
    tanto igual queremos mostrarle si ese sku ya existe en el inventario.
    """
    # Cargar todos los productos de la empresa una sola vez (evita N queries)
    productos = await conn.fetch(
        """
        select id, sku, nombre, marca,
               precio_compra, precio_venta, precio_mecanico, precio_mayor,
               stock_minimo, aplicacion, medidas, modelos,
               anio_desde, anio_hasta, descripcion
        from public.productos
        where empresa_id = $1 and deleted_at is null and activo = true
        """,
        empresa_id,
    )

    # Índices para búsqueda rápida
    idx_sku: dict[str, dict] = {}       # sku_normalizado → producto
    idx_nombre: list[dict] = []          # lista para búsqueda fuzzy

    for p in productos:
        sku_norm = _normalize(str(p["sku"]))
        idx_sku[sku_norm] = dict(p)
        idx_nombre.append(dict(p))

    resultado: list[dict[str, Any]] = []

    for item in items:
        enriquecido: dict[str, Any] = {**item}
        sku_doc  = item.get("sku", "")
        nombre_doc = item.get("nombre", "")

        match_status = "nuevo"
        match_id     = None
        match_sku    = None
        match_nombre_inv = None
        confianza    = 0
        prod_match: dict | None = None

        sku_norm = _normalize(sku_doc)

        # ── Nivel 1: SKU exacto ──────────────────────────────────────────────
        if sku_norm and sku_norm in idx_sku:
            prod_match   = idx_sku[sku_norm]
            match_status = "existente"
            match_id     = str(prod_match["id"])
            match_sku    = prod_match["sku"]
            match_nombre_inv = prod_match["nombre"]
            confianza    = 100

            # Mismo código pero nombres sin ninguna palabra en común → el
            # proveedor pudo reusar un código para un producto distinto.
            # No confiar ciegamente: bajar a "conflicto" para que el usuario
            # revise la comparación antes de guardar (ver InvDataBar en el UI).
            if nombre_doc and prod_match["nombre"]:
                palabras_doc = set(_palabras_clave(nombre_doc))
                palabras_inv = set(_palabras_clave(str(prod_match["nombre"])))
                if palabras_doc and palabras_inv and not (palabras_doc & palabras_inv):
                    match_status = "conflicto"
                    confianza    = 50

        # ── Nivel 2: SKU parcial (primeros 6 chars) ──────────────────────────
        elif sku_norm and len(sku_norm) >= 5:
            prefijo = sku_norm[:6]
            candidatos = [p for k, p in idx_sku.items() if k.startswith(prefijo)]
            if candidatos:
                prod_match   = candidatos[0]
                match_status = "probable"
                match_id     = str(prod_match["id"])
                match_sku    = prod_match["sku"]
                match_nombre_inv = prod_match["nombre"]
                confianza    = 75

        # ── Nivel 3: Nombre fuzzy (primera palabra clave) ────────────────────
        if match_status == "nuevo" and nombre_doc:
            palabras = _palabras_clave(nombre_doc)
            for palabra in palabras:
                for prod in idx_nombre:
                    if palabra in prod["nombre"].upper():
                        prod_match       = prod
                        match_status     = "probable"
                        match_id         = str(prod["id"])
                        match_sku        = prod["sku"]
                        match_nombre_inv = prod["nombre"]
                        confianza        = 55
                        break
                if match_status != "nuevo":
                    break

        # ── Marcar incompleto si falta SKU o nombre (solo cuando se pide) ────
        if requerir_completo and (not sku_doc.strip() or not nombre_doc.strip()):
            match_status = "incompleto"
            confianza    = 0

        enriquecido["match_status"]    = match_status
        enriquecido["match_id"]        = match_id
        enriquecido["match_sku"]       = match_sku
        enriquecido["match_nombre"]    = match_nombre_inv
        enriquecido["confianza"]       = confianza
        # Datos actuales del inventario para mostrar como referencia en el UI
        enriquecido["inv_data"]        = _inv_data(prod_match) if prod_match else None
        resultado.append(enriquecido)

    return resultado


_COLUMNAS_PRODUCTO = """
    id, sku, nombre, marca, precio_compra, precio_venta, precio_mecanico,
    precio_mayor, stock_minimo, aplicacion, medidas, modelos, anio_desde,
    anio_hasta, descripcion
"""
# Misma normalización que _normalize(), pero expresada en SQL para filtrar
# en la base en vez de traer la tabla entera.
_SKU_NORMALIZADO_SQL = "upper(replace(replace(replace(sku, ' ', ''), '-', ''), '.', ''))"


async def match_item_single(
    conn: asyncpg.Connection,
    empresa_id: UUID,
    sku_doc: str,
    nombre_doc: str,
) -> dict[str, Any]:
    """
    Igual que match_items, pero para UN solo ítem, con consultas puntuales a
    la base en vez de cargar el catálogo completo en memoria.

    match_items trae los productos de la empresa UNA vez y los compara contra
    N ítems en memoria — perfecto para un documento con cientos de líneas en
    una sola pasada. Pero para verificar una fila escrita a mano (una
    verificación por fila, mientras el usuario escribe) eso significa traer
    TODO el inventario de la empresa por cada tecla — con catálogos grandes
    (10k+ productos) se siente lento aunque la lógica sea la misma. Acá cada
    nivel pide solo el/los 1 candidato(s) puntuales que necesita.
    """
    match_status = "nuevo"
    match_id     = None
    match_sku    = None
    match_nombre_inv = None
    confianza    = 0
    prod_match: dict | None = None

    sku_norm = _normalize(sku_doc)

    if sku_norm:
        # ── Nivel 1: SKU exacto (normalizado) ────────────────────────────────
        row = await conn.fetchrow(
            f"""
            select {_COLUMNAS_PRODUCTO}
              from public.productos
             where empresa_id = $1 and deleted_at is null and activo = true
               and {_SKU_NORMALIZADO_SQL} = $2
             limit 1
            """,
            empresa_id, sku_norm,
        )
        if row:
            prod_match   = dict(row)
            match_status = "existente"
            match_id     = str(prod_match["id"])
            match_sku    = prod_match["sku"]
            match_nombre_inv = prod_match["nombre"]
            confianza    = 100

            if nombre_doc and prod_match["nombre"]:
                palabras_doc = set(_palabras_clave(nombre_doc))
                palabras_inv = set(_palabras_clave(str(prod_match["nombre"])))
                if palabras_doc and palabras_inv and not (palabras_doc & palabras_inv):
                    match_status = "conflicto"
                    confianza    = 50

        # ── Nivel 2: SKU parcial (primeros 6 chars) ──────────────────────────
        elif len(sku_norm) >= 5:
            prefijo = sku_norm[:6]
            row = await conn.fetchrow(
                f"""
                select {_COLUMNAS_PRODUCTO}
                  from public.productos
                 where empresa_id = $1 and deleted_at is null and activo = true
                   and {_SKU_NORMALIZADO_SQL} like $2
                 limit 1
                """,
                empresa_id, prefijo + "%",
            )
            if row:
                prod_match   = dict(row)
                match_status = "probable"
                match_id     = str(prod_match["id"])
                match_sku    = prod_match["sku"]
                match_nombre_inv = prod_match["nombre"]
                confianza    = 75

    # ── Nivel 3: Nombre fuzzy (primera palabra clave que matchee algo) ───────
    if match_status == "nuevo" and nombre_doc:
        for palabra in _palabras_clave(nombre_doc):
            row = await conn.fetchrow(
                f"""
                select {_COLUMNAS_PRODUCTO}
                  from public.productos
                 where empresa_id = $1 and deleted_at is null and activo = true
                   and upper(nombre) like $2
                 limit 1
                """,
                empresa_id, f"%{palabra}%",
            )
            if row:
                prod_match       = dict(row)
                match_status     = "probable"
                match_id         = str(prod_match["id"])
                match_sku        = prod_match["sku"]
                match_nombre_inv = prod_match["nombre"]
                confianza        = 55
                break

    return {
        "sku": sku_doc,
        "nombre": nombre_doc,
        "match_status": match_status,
        "match_id": match_id,
        "match_sku": match_sku,
        "match_nombre": match_nombre_inv,
        "confianza": confianza,
        "inv_data": _inv_data(prod_match) if prod_match else None,
    }
