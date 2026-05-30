"""Repositorio del dashboard (queries de resumen en tiempo real)."""
from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import asyncpg


# ─── Mapeo de labels para actividad ──────────────────────────────────────────
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
    """Extrae dict del payload sea jsonb o str."""
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


def _build_descripcion(
    entidad: str, accion: str, payload: dict, extra_nombre: str | None
) -> str:
    """Construye la línea de descripción para mostrar en el feed."""
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
        # ── Stats del día ────────────────────────────────────────────────────
        hoy = await self.conn.fetchrow(
            """
            select
              coalesce(sum(total), 0) as ventas_hoy,
              count(*)               as ordenes_hoy
            from public.ventas
            where empresa_id = $1
              and fecha = current_date
              and estado = 'completada'
            """,
            empresa_id,
        )

        # ── Ventas semana Lun–Sáb (siempre 6 barras aunque no haya ventas) ──
        semana = await self.conn.fetch(
            """
            with dias as (
              select gs::date as fecha
              from generate_series(
                date_trunc('week', current_date)::date,
                date_trunc('week', current_date)::date + interval '5 days',
                interval '1 day'
              ) gs
            ),
            v as (
              select fecha, coalesce(sum(total), 0) as total
              from public.ventas
              where empresa_id = $1
                and fecha between date_trunc('week', current_date)::date
                              and date_trunc('week', current_date)::date + interval '5 days'
                and estado = 'completada'
              group by fecha
            )
            select d.fecha, coalesce(v.total, 0) as total
            from dias d
            left join v on v.fecha = d.fecha
            order by d.fecha
            """,
            empresa_id,
        )

        # ── Inventario ───────────────────────────────────────────────────────
        inventario = await self.conn.fetchrow(
            """
            select
              count(distinct p.id)                                           as total_productos,
              count(distinct case when sa.cantidad <= p.stock_minimo
                                   and sa.cantidad >= 0 then p.id end)      as stock_bajo
            from public.productos p
            left join public.stock_actual sa
              on sa.producto_id = p.id and sa.empresa_id = p.empresa_id
            where p.empresa_id = $1 and p.deleted_at is null and p.activo = true
            """,
            empresa_id,
        )

        # ── Distribución por categoría (top 5) ───────────────────────────────
        categorias = await self.conn.fetch(
            """
            select c.nombre as categoria,
                   count(p.id) as cantidad,
                   coalesce(sum(sa.cantidad * p.precio_venta), 0) as valor
            from public.productos p
            left join public.categorias c on c.id = p.categoria_id
            left join public.stock_actual sa on sa.producto_id = p.id
            where p.empresa_id = $1 and p.deleted_at is null
            group by c.nombre
            order by valor desc
            limit 5
            """,
            empresa_id,
        )

        # ── Actividad reciente desde tabla auditoria ──────────────────────────
        actividad = await self._actividad_reciente(empresa_id, limit=20)

        return {
            "ventas_hoy":    float(hoy["ventas_hoy"]  if hoy else 0),
            "ordenes_hoy":   int(hoy["ordenes_hoy"]   if hoy else 0),
            "total_productos": int(inventario["total_productos"] if inventario else 0),
            "stock_bajo":    int(inventario["stock_bajo"]       if inventario else 0),
            "ventas_semana": [
                {
                    "dia":   _DIAS_ES[r["fecha"].weekday()],
                    "fecha": str(r["fecha"]),
                    "total": float(r["total"]),
                }
                for r in semana
            ],
            "categorias": [
                {
                    "nombre":   r["categoria"] or "Sin categoría",
                    "cantidad": int(r["cantidad"]),
                    "valor":    float(r["valor"]),
                }
                for r in categorias
            ],
            "actividad_reciente": actividad,
        }

    async def _actividad_reciente(
        self, empresa_id: UUID, limit: int = 20
    ) -> list[dict[str, Any]]:
        rows = await self.conn.fetch(
            """
            select
              a.id,
              a.modulo,
              a.entidad,
              a.accion,
              a.payload_despues,
              a.created_at,
              -- Nombre del usuario desde usuarios_empresa
              coalesce(ue.nombre, 'Sistema') as usuario_nombre,
              -- Nombre extra según la entidad (para descripciones)
              case
                when a.entidad = 'venta'           then v.cliente_nombre
                when a.entidad = 'movimiento_stock' then p.nombre
                when a.entidad = 'cliente'          then cli.nombre
                when a.entidad = 'proveedor'        then prov.razon_social
                else null
              end as extra_nombre
            from public.auditoria a
            -- Nombre del usuario (ambas columnas son uuid)
            left join public.usuarios_empresa ue
              on ue.user_id   = a.user_id
             and ue.empresa_id = a.empresa_id
            -- Datos de venta (entidad_id es uuid en auditoria)
            left join public.ventas v
              on a.entidad = 'venta'
             and v.id = a.entidad_id
            -- Datos de movimiento_stock → producto
            left join public.movimientos_stock ms
              on a.entidad = 'movimiento_stock'
             and ms.id = a.entidad_id
            left join public.productos p
              on p.id = ms.producto_id
            -- Datos de cliente
            left join public.clientes cli
              on a.entidad = 'cliente'
             and cli.id = a.entidad_id
            -- Datos de proveedor
            left join public.proveedores prov
              on a.entidad = 'proveedor'
             and prov.id = a.entidad_id
            where a.empresa_id = $1
            order by a.created_at desc
            limit $2
            """,
            empresa_id,
            limit,
        )

        result = []
        for r in rows:
            entidad    = r["entidad"]
            accion     = r["accion"]
            tipo       = f"{entidad}.{accion}"
            payload    = _safe_payload(r["payload_despues"])
            extra      = r["extra_nombre"]

            titulo      = _TITULOS.get(tipo) or f"{entidad.replace('_', ' ').title()} — {accion}"
            descripcion = _build_descripcion(entidad, accion, payload, extra)

            result.append({
                "id":             str(r["id"]),
                "tipo":           tipo,
                "titulo":         titulo,
                "descripcion":    descripcion or None,
                "usuario_nombre": r["usuario_nombre"],
                "created_at":     r["created_at"].isoformat(),
            })
        return result
