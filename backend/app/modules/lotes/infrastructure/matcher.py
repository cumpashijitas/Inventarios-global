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
) -> list[dict[str, Any]]:
    """
    Para cada item del documento, busca si ya existe en el inventario.
    Devuelve la lista enriquecida con campos de matching.
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

        # ── Marcar incompleto si falta SKU o nombre ──────────────────────────
        if not sku_doc.strip() or not nombre_doc.strip():
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
