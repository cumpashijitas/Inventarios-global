"""Acceso a datos — módulo admin."""
from __future__ import annotations

import json
from uuid import UUID

import asyncpg

# Roles del sistema que toda empresa debe tener
_ROLES_SISTEMA = [
    {
        "codigo": "admin",
        "nombre": "Administrador",
        "descripcion": "Control total del sistema",
        "permisos": [],
        "es_sistema": True,
    },
    {
        "codigo": "vendedor",
        "nombre": "Vendedor",
        "descripcion": "Acceso a ventas, cotizaciones e inventario (lectura)",
        "permisos": ["ventas.ver", "ventas.crear", "inventario.ver", "reportes.ver"],
        "es_sistema": True,
    },
    {
        "codigo": "encargado_inventario",
        "nombre": "Enc. Inventario",
        "descripcion": "Gestión completa de inventario y carga masiva",
        "permisos": ["inventario.ver", "inventario.editar", "carga_masiva.ver", "reportes.ver"],
        "es_sistema": True,
    },
    {
        "codigo": "cajero",
        "nombre": "Cajero",
        "descripcion": "Gestión de caja, ventas y pagos",
        "permisos": ["caja.ver", "ventas.ver", "reportes.ver"],
        "es_sistema": True,
    },
]


class AdminRepo:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn

    # ── Roles ─────────────────────────────────────────────────────────────────

    async def listar_roles(self, empresa_id: UUID) -> list[dict]:
        await self._seed_roles_si_faltan(empresa_id)
        rows = await self.conn.fetch(
            """
            SELECT id, codigo, nombre, descripcion, es_sistema
              FROM public.roles_empresa
             WHERE empresa_id = $1
             ORDER BY
               CASE codigo
                 WHEN 'admin'                THEN 1
                 WHEN 'vendedor'             THEN 2
                 WHEN 'encargado_inventario' THEN 3
                 WHEN 'cajero'               THEN 4
                 ELSE 5
               END
            """,
            empresa_id,
        )
        return [dict(r) for r in rows]

    async def get_rol_by_codigo(self, empresa_id: UUID, codigo: str) -> dict | None:
        row = await self.conn.fetchrow(
            "SELECT id, codigo, nombre FROM public.roles_empresa WHERE empresa_id=$1 AND codigo=$2",
            empresa_id, codigo,
        )
        return dict(row) if row else None

    async def _seed_roles_si_faltan(self, empresa_id: UUID) -> None:
        """Crea los roles del sistema si la empresa aún no los tiene."""
        count = await self.conn.fetchval(
            "SELECT count(*) FROM public.roles_empresa WHERE empresa_id=$1 AND es_sistema=true",
            empresa_id,
        )
        if count and count >= len(_ROLES_SISTEMA):
            return
        for r in _ROLES_SISTEMA:
            await self.conn.execute(
                """
                INSERT INTO public.roles_empresa
                  (empresa_id, codigo, nombre, descripcion, permisos, es_sistema)
                VALUES ($1,$2,$3,$4,$5::jsonb,$6)
                ON CONFLICT (empresa_id, codigo) DO NOTHING
                """,
                empresa_id, r["codigo"], r["nombre"], r["descripcion"],
                str(r["permisos"]).replace("'", '"'), r["es_sistema"],
            )

    # ── Usuarios ──────────────────────────────────────────────────────────────

    async def listar_usuarios(self, empresa_id: UUID) -> list[dict]:
        rows = await self.conn.fetch(
            """
            SELECT ue.id, ue.user_id, ue.nombre, ue.email, ue.activo, ue.created_at,
                   COALESCE(array_agg(r.codigo ORDER BY r.codigo)
                            FILTER (WHERE r.codigo IS NOT NULL), '{}') AS rol_codigos
              FROM public.usuarios_empresa ue
              LEFT JOIN public.usuario_empresa_roles uer ON uer.usuario_empresa_id = ue.id
              LEFT JOIN public.roles_empresa r ON r.id = uer.rol_id
             WHERE ue.empresa_id = $1
               AND ue.deleted_at IS NULL
             GROUP BY ue.id
             ORDER BY ue.created_at
            """,
            empresa_id,
        )
        return [dict(r) for r in rows]

    async def get_usuario(self, empresa_id: UUID, usuario_id: UUID) -> dict | None:
        row = await self.conn.fetchrow(
            """
            SELECT ue.id, ue.user_id, ue.nombre, ue.email, ue.activo, ue.created_at,
                   COALESCE(array_agg(r.codigo ORDER BY r.codigo)
                            FILTER (WHERE r.codigo IS NOT NULL), '{}') AS rol_codigos
              FROM public.usuarios_empresa ue
              LEFT JOIN public.usuario_empresa_roles uer ON uer.usuario_empresa_id = ue.id
              LEFT JOIN public.roles_empresa r ON r.id = uer.rol_id
             WHERE ue.empresa_id = $1 AND ue.id = $2 AND ue.deleted_at IS NULL
             GROUP BY ue.id
            """,
            empresa_id, usuario_id,
        )
        return dict(row) if row else None

    async def crear_usuario(
        self,
        empresa_id: UUID,
        user_id: UUID,      # UUID del auth user de Supabase
        nombre: str,
        email: str,
        rol_ids: list[UUID],
        invitado_por: UUID,
    ) -> dict:
        row = await self.conn.fetchrow(
            """
            INSERT INTO public.usuarios_empresa
              (empresa_id, user_id, nombre, email, invitado_por)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, user_id, nombre, email, activo, created_at
            """,
            empresa_id, user_id, nombre, email, invitado_por,
        )
        usuario = dict(row)
        await self._set_roles(empresa_id, usuario["id"], rol_ids)
        return usuario

    async def actualizar_usuario(
        self,
        empresa_id: UUID,
        usuario_id: UUID,
        nombre: str | None,
        rol_ids: list[UUID] | None,
        activo: bool | None,
    ) -> dict | None:
        # Construir SET dinámico solo con campos que vienen
        sets, vals = [], [empresa_id, usuario_id]
        if nombre is not None:
            vals.append(nombre);  sets.append(f"nombre=${len(vals)}")
        if activo is not None:
            vals.append(activo);  sets.append(f"activo=${len(vals)}")
        if sets:
            sets.append("updated_at=now()")
            sql = f"""
                UPDATE public.usuarios_empresa
                   SET {', '.join(sets)}
                 WHERE empresa_id=$1 AND id=$2 AND deleted_at IS NULL
            """
            await self.conn.execute(sql, *vals)

        if rol_ids is not None:
            await self._set_roles(empresa_id, usuario_id, rol_ids)

        return await self.get_usuario(empresa_id, usuario_id)

    async def _set_roles(self, empresa_id: UUID, usuario_empresa_id: UUID, rol_ids: list[UUID]) -> None:
        """Reemplaza por completo el conjunto de roles de un usuario."""
        async with self.conn.transaction():
            await self.conn.execute(
                "DELETE FROM public.usuario_empresa_roles WHERE usuario_empresa_id=$1 AND empresa_id=$2",
                usuario_empresa_id, empresa_id,
            )
            if rol_ids:
                await self.conn.executemany(
                    """
                    INSERT INTO public.usuario_empresa_roles (empresa_id, usuario_empresa_id, rol_id)
                    VALUES ($1, $2, $3)
                    """,
                    [(empresa_id, usuario_empresa_id, rid) for rid in rol_ids],
                )

    async def desactivar_usuario(self, empresa_id: UUID, usuario_id: UUID) -> None:
        await self.conn.execute(
            """
            UPDATE public.usuarios_empresa
               SET activo=false, updated_at=now()
             WHERE empresa_id=$1 AND id=$2 AND deleted_at IS NULL
            """,
            empresa_id, usuario_id,
        )

    # ── Empresa ───────────────────────────────────────────────────────────────

    async def get_empresa(self, empresa_id: UUID) -> dict | None:
        row = await self.conn.fetchrow(
            """
            SELECT id, razon_social, nombre_comercial, nit,
                   direccion, ciudad, pais, telefono, email,
                   logo_url, moneda_principal
              FROM public.empresas
             WHERE id=$1 AND deleted_at IS NULL
            """,
            empresa_id,
        )
        return dict(row) if row else None

    # ── Notificaciones ────────────────────────────────────────────────────────

    async def get_productos_stock_bajo(self, empresa_id: UUID) -> list[dict]:
        """Devuelve productos cuyo stock total está por debajo del mínimo."""
        rows = await self.conn.fetch(
            """
            SELECT p.sku, p.nombre,
                   coalesce(sum(sa.cantidad), 0) AS stock_actual,
                   p.stock_minimo
              FROM public.productos p
              LEFT JOIN public.stock_actual sa ON sa.producto_id = p.id
             WHERE p.empresa_id = $1
               AND p.deleted_at IS NULL
               AND p.activo = true
               AND p.controla_stock = true
             GROUP BY p.id, p.sku, p.nombre, p.stock_minimo
            HAVING coalesce(sum(sa.cantidad), 0) < p.stock_minimo
             ORDER BY coalesce(sum(sa.cantidad), 0) ASC
            """,
            empresa_id,
        )
        return [dict(r) for r in rows]

    async def get_empresa_para_notif(self, empresa_id: UUID) -> dict | None:
        """Devuelve nombre y email de la empresa para notificaciones."""
        row = await self.conn.fetchrow(
            "SELECT razon_social, email FROM public.empresas WHERE id=$1",
            empresa_id,
        )
        return dict(row) if row else None

    async def get_sistema_config(self, empresa_id: UUID) -> dict:
        row = await self.conn.fetchrow(
            """
            SELECT coalesce(configuracion_app, '{}'::jsonb) AS cfg
              FROM public.empresas
             WHERE id=$1 AND deleted_at IS NULL
            """,
            empresa_id,
        )
        if not row:
            return {}
        # asyncpg retorna jsonb como str — hay que parsearlo
        raw = row["cfg"]
        cfg: dict = json.loads(raw) if isinstance(raw, str) else (raw or {})
        defaults = {"notificaciones_email": True, "alertas_stock_bajo": True}
        return {**defaults, **cfg}

    async def actualizar_sistema_config(self, empresa_id: UUID, cambios: dict) -> dict:
        # || en jsonb hace merge: preserva claves existentes y sobreescribe las que vienen
        await self.conn.execute(
            """
            UPDATE public.empresas
               SET configuracion_app = coalesce(configuracion_app, '{}'::jsonb) || $2::jsonb,
                   updated_at        = now()
             WHERE id=$1 AND deleted_at IS NULL
            """,
            empresa_id,
            json.dumps(cambios),
        )
        return await self.get_sistema_config(empresa_id)

    # ── IP Permitidas ─────────────────────────────────────────────────────────

    async def listar_ips(self, empresa_id: UUID) -> list[dict]:
        rows = await self.conn.fetch(
            """
            SELECT id, ip, descripcion, created_at
              FROM public.ip_permitidas
             WHERE empresa_id = $1
             ORDER BY created_at
            """,
            empresa_id,
        )
        return [dict(r) for r in rows]

    async def agregar_ip(self, empresa_id: UUID, ip: str, descripcion: str) -> dict:
        row = await self.conn.fetchrow(
            """
            INSERT INTO public.ip_permitidas (empresa_id, ip, descripcion)
            VALUES ($1, $2, $3)
            ON CONFLICT (empresa_id, ip) DO UPDATE SET descripcion = EXCLUDED.descripcion
            RETURNING id, ip, descripcion, created_at
            """,
            empresa_id, ip, descripcion,
        )
        return dict(row)

    async def eliminar_ip(self, empresa_id: UUID, ip_id: UUID) -> bool:
        result = await self.conn.execute(
            "DELETE FROM public.ip_permitidas WHERE empresa_id=$1 AND id=$2",
            empresa_id, ip_id,
        )
        return result != "DELETE 0"

    async def get_ips_empresa(self, empresa_id: str) -> list[str]:
        """Usado por el middleware de verificación (sin RLS, contexto de sistema)."""
        rows = await self.conn.fetch(
            "SELECT ip FROM public.ip_permitidas WHERE empresa_id=$1",
            UUID(empresa_id),
        )
        return [r["ip"] for r in rows]

    async def actualizar_empresa(self, empresa_id: UUID, campos: dict) -> dict | None:
        if not campos:
            return await self.get_empresa(empresa_id)
        sets, vals = [], [empresa_id]
        for k, v in campos.items():
            vals.append(v)
            sets.append(f"{k}=${len(vals)}")
        sets.append("updated_at=now()")
        await self.conn.execute(
            f"UPDATE public.empresas SET {', '.join(sets)} WHERE id=$1 AND deleted_at IS NULL",
            *vals,
        )
        return await self.get_empresa(empresa_id)
