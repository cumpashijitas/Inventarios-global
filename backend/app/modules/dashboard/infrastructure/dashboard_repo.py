"""Repositorio del dashboard — todas las stats en una sola query CTE."""
from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import asyncpg


_TITULOS: dict[str, str] = {
    "venta.crear":                "Nueva venta registrada",
    "venta.anular":               "Venta anulada",
    "cotizacion.crear":           "Cotización creada",
    "cotizacion.cambiar_estado":  "Cotización actualizada",
    "sesion.abrir":               "Caja abierta",
    "sesion.cerrar":              "Caja cerrada",
    "movimiento.ingreso":         "Ingreso en caja",
    "movimiento.retiro":          "Retiro de caja",
    "movimiento.venta":           "Venta registrada en caja",
    "cliente.crear":              "Nuevo cliente registrado",
    "cliente.actualizar":         "Cliente actualizado",
    "cliente.eliminar":           "Cliente eliminado",
    "proveedor.crear":            "Nuevo proveedor registrado",
    "proveedor.actualizar":       "Proveedor actualizado",
    "proveedor.eliminar":         "Proveedor eliminado",
    "movimiento_stock.entrada":   "Entrada de stock",
    "movimiento_stock.salida":    "Salida de stock",
    "movimiento_stock.ajuste":    "Ajuste de stock",
    "producto.crear":             "Nuevo producto registrado",
    "producto.actualizar":        "Producto actualizado",
    "producto.eliminar":          "Producto eliminado",
}

_DIAS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]


def _safe_payload(raw: Any) -> dict:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return {}
    return {}


def _build_descripcion(entidad: str, accion: str, payload: dict, extra_nombre: str | None) -> str:
    key = f"{entidad}.{accion}"
    p = payload
    nombre = extra_nombre or ""

    if key == "venta.crear":
        partes = [p.get("numero", "")]
        if nombre:
            partes.append(nombre)
        total = p.get("total")
        if total:
            partes.append(f"Bs {float(total):,.2f}")
        return "  ·  ".join(x for x in partes if x)

    if key == "venta.anular":
        return "  ·  ".join(x for x in [p.get("numero", ""), p.get("motivo", "")] if x)

    if key == "cotizacion.crear":
        total = p.get("total")
        partes = [p.get("numero", "")]
        if nombre:
            partes.append(nombre)
        if total:
            partes.append(f"Bs {float(total):,.2f}")
        return "  ·  ".join(x for x in partes if x)

    if key == "cotizacion.cambiar_estado":
        return f"Estado: {p.get('estado', '')}"

    if key == "sesion.abrir":
        sal = p.get("saldo_inicial")
        cod = p.get("codigo", "")
        partes = [f"Código: {cod}" if cod else ""]
        if sal:
            partes.append(f"Saldo inicial: Bs {float(sal):,.2f}")
        return "  ·  ".join(x for x in partes if x)

    if key == "sesion.cerrar":
        sal = p.get("saldo_final")
        dif = p.get("diferencia")
        partes = []
        if sal:
            partes.append(f"Saldo final: Bs {float(sal):,.2f}")
        if dif is not None:
            diff_val = float(dif)
            partes.append(f"Diferencia: Bs {diff_val:+,.2f}" if diff_val != 0 else "Sin diferencia")
        return "  ·  ".join(x for x in partes if x)

    if key in ("movimiento.ingreso", "movimiento.retiro", "movimiento.venta"):
        concepto = p.get("concepto") or p.get("referencia", "")
        monto = p.get("monto")
        partes = [concepto] if concepto else []
        if monto:
            partes.append(f"Bs {abs(float(monto)):,.2f}")
        return "  ·  ".join(x for x in partes if x)

    if key in ("cliente.crear", "cliente.actualizar"):
        return nombre or p.get("nombre", "")

    if key in ("proveedor.crear", "proveedor.actualizar"):
        return nombre or p.get("razon_social", "")

    if key in ("movimiento_stock.entrada", "movimiento_stock.salida", "movimiento_stock.ajuste"):
        partes = [nombre or ""]
        cant = p.get("cantidad")
        if cant:
            partes.append(f"{float(cant):.0f} uds")
        motivo = p.get("motivo")
        if motivo:
            partes.append(motivo)
        return "  ·  ".join(x for x in partes if x)

    if key in ("producto.crear", "producto.actualizar"):
        sku = p.get("sku", "")
        pnombre = p.get("nombre", nombre)
        return f"{pnombre}  ·  SKU: {sku}" if sku else pnombre

    return ""


class DashboardRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    async def stats(self, empresa_id: UUID) -> dict[str, Any]:
        # Una sola query CTE que reemplaza las 5 queries secuenciales anteriores.
        # Bolivia→Ohio = ~200ms RTT; 5 queries → 1000ms, 1 query → 200ms.
        row = await self.conn.fetchrow(
            """
            WITH
            hoy AS (
              SELECT
                coalesce(sum(total), 0) AS ventas_hoy,
                count(*)               AS ordenes_hoy
              FROM public.ventas
              WHERE empresa_id = $1
                AND fecha = current_date
                AND estado = 'completada'
            ),
            semana AS (
              SELECT
                d.fecha,
                coalesce(sum(v.total), 0) AS total
              FROM (
                SELECT gs::date AS fecha
                FROM generate_series(
                  date_trunc('week', current_date)::date,
                  date_trunc('week', current_date)::date + interval '5 days',
                  interval '1 day'
                ) gs
              ) d
              LEFT JOIN public.ventas v
                ON v.fecha = d.fecha
               AND v.empresa_id = $1
               AND v.estado = 'completada'
              GROUP BY d.fecha
              ORDER BY d.fecha
            ),
            inventario AS (
              SELECT
                count(DISTINCT p.id)                                              AS total_productos,
                count(DISTINCT CASE WHEN sa.cantidad <= p.stock_minimo
                                     AND sa.cantidad >= 0 THEN p.id END)         AS stock_bajo
              FROM public.productos p
              LEFT JOIN public.stock_actual sa
                ON sa.producto_id = p.id AND sa.empresa_id = p.empresa_id
              WHERE p.empresa_id = $1 AND p.deleted_at IS NULL AND p.activo = TRUE
            ),
            categorias AS (
              SELECT
                coalesce(c.nombre, 'Sin categoría') AS categoria,
                count(p.id)                          AS cantidad,
                coalesce(sum(sa.cantidad * p.precio_venta), 0) AS valor
              FROM public.productos p
              LEFT JOIN public.categorias c ON c.id = p.categoria_id
              LEFT JOIN public.stock_actual sa ON sa.producto_id = p.id
              WHERE p.empresa_id = $1 AND p.deleted_at IS NULL
              GROUP BY c.nombre
              ORDER BY valor DESC
              LIMIT 5
            ),
            actividad AS (
              SELECT
                a.id,
                a.modulo,
                a.entidad,
                a.accion,
                a.payload_despues,
                a.created_at,
                coalesce(ue.nombre, 'Sistema') AS usuario_nombre,
                CASE
                  WHEN a.entidad = 'venta'            THEN v.cliente_nombre
                  WHEN a.entidad = 'movimiento_stock' THEN p.nombre
                  WHEN a.entidad = 'cliente'          THEN cli.nombre
                  WHEN a.entidad = 'proveedor'        THEN prov.razon_social
                  ELSE NULL
                END AS extra_nombre
              FROM public.auditoria a
              LEFT JOIN public.usuarios_empresa ue
                ON ue.user_id = a.user_id AND ue.empresa_id = a.empresa_id
              LEFT JOIN public.ventas v
                ON a.entidad = 'venta' AND v.id = a.entidad_id
              LEFT JOIN public.movimientos_stock ms
                ON a.entidad = 'movimiento_stock' AND ms.id = a.entidad_id
              LEFT JOIN public.productos p ON p.id = ms.producto_id
              LEFT JOIN public.clientes cli
                ON a.entidad = 'cliente' AND cli.id = a.entidad_id
              LEFT JOIN public.proveedores prov
                ON a.entidad = 'proveedor' AND prov.id = a.entidad_id
              WHERE a.empresa_id = $1
              ORDER BY a.created_at DESC
              LIMIT 20
            )
            SELECT
              (SELECT row_to_json(h) FROM hoy h)          AS hoy,
              (SELECT json_agg(s ORDER BY s.fecha) FROM semana s) AS semana,
              (SELECT row_to_json(i) FROM inventario i)   AS inventario,
              (SELECT json_agg(c) FROM categorias c)      AS categorias,
              (SELECT json_agg(a) FROM actividad a)       AS actividad
            """,
            empresa_id,
        )

        hoy_data       = json.loads(row["hoy"])       if isinstance(row["hoy"], str)       else (row["hoy"] or {})
        inventario_data= json.loads(row["inventario"])if isinstance(row["inventario"], str) else (row["inventario"] or {})

        def _parse_json_list(val: Any) -> list:
            if val is None:
                return []
            if isinstance(val, str):
                return json.loads(val)
            return val

        semana_raw    = _parse_json_list(row["semana"])
        categorias_raw= _parse_json_list(row["categorias"])
        actividad_raw = _parse_json_list(row["actividad"])

        actividad_result = []
        for r in actividad_raw:
            entidad     = r.get("entidad", "")
            accion      = r.get("accion", "")
            tipo        = f"{entidad}.{accion}"
            payload     = _safe_payload(r.get("payload_despues"))
            extra       = r.get("extra_nombre")
            titulo      = _TITULOS.get(tipo) or f"{entidad.replace('_', ' ').title()} — {accion}"
            descripcion = _build_descripcion(entidad, accion, payload, extra)
            actividad_result.append({
                "id":             str(r["id"]),
                "tipo":           tipo,
                "titulo":         titulo,
                "descripcion":    descripcion or None,
                "usuario_nombre": r.get("usuario_nombre", "Sistema"),
                "created_at":     r.get("created_at"),
            })

        return {
            "ventas_hoy":      float(hoy_data.get("ventas_hoy", 0)),
            "ordenes_hoy":     int(hoy_data.get("ordenes_hoy", 0)),
            "total_productos": int(inventario_data.get("total_productos", 0)),
            "stock_bajo":      int(inventario_data.get("stock_bajo", 0)),
            "ventas_semana": [
                {
                    "dia":   _DIAS_ES[__import__("datetime").date.fromisoformat(r["fecha"]).weekday()],
                    "fecha": r["fecha"],
                    "total": float(r.get("total", 0)),
                }
                for r in semana_raw
            ],
            "categorias": [
                {
                    "nombre":   r.get("categoria") or "Sin categoría",
                    "cantidad": int(r.get("cantidad", 0)),
                    "valor":    float(r.get("valor", 0)),
                }
                for r in categorias_raw
            ],
            "actividad_reciente": actividad_result,
        }
