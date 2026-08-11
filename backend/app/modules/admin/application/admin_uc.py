"""Casos de uso — módulo admin."""
from __future__ import annotations

from uuid import UUID

import asyncpg

from app.core.exceptions import AppError
from app.modules.admin.infrastructure.admin_repo import AdminRepo


class AdminUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.repo = AdminRepo(conn)

    # ── Roles ─────────────────────────────────────────────────────────────────

    async def listar_roles(self, empresa_id: UUID) -> list[dict]:
        return await self.repo.listar_roles(empresa_id)

    # ── Usuarios ──────────────────────────────────────────────────────────────

    async def listar_usuarios(self, empresa_id: UUID) -> list[dict]:
        return await self.repo.listar_usuarios(empresa_id)

    async def _resolver_roles(self, empresa_id: UUID, rol_codigos: list[str]) -> list[UUID]:
        """Valida la combinación de roles y devuelve sus IDs.

        Reglas: mínimo 1 rol siempre. 'admin' es exclusivo (no se combina con
        otros). Los demás (vendedor, encargado_inventario, cajero) se pueden
        combinar libremente, hasta 3 a la vez.
        """
        if not rol_codigos:
            raise AppError("El usuario debe tener al menos un rol", 422)
        codigos_unicos = set(rol_codigos)
        if len(codigos_unicos) != len(rol_codigos):
            raise AppError("No repitas el mismo rol más de una vez", 422)
        if "admin" in codigos_unicos and len(codigos_unicos) > 1:
            raise AppError("El rol Administrador no se puede combinar con otros roles", 422)
        if "admin" not in codigos_unicos and len(codigos_unicos) > 3:
            raise AppError("Un usuario puede tener máximo 3 roles (sin contar Administrador)", 422)

        rol_ids: list[UUID] = []
        for codigo in rol_codigos:
            rol = await self.repo.get_rol_by_codigo(empresa_id, codigo)
            if not rol:
                raise AppError(f"El rol '{codigo}' no existe para esta empresa", 422)
            rol_ids.append(UUID(str(rol["id"])))
        return rol_ids

    async def crear_usuario(
        self,
        empresa_id: UUID,
        admin_user_id: UUID,
        nombre: str,
        email: str,
        password: str,
        rol_codigos: list[str],
    ) -> dict:
        from app.modules.auth.infrastructure.supabase_auth import SupabaseAuthAdapter
        from app.core.config import settings

        # 1. Validar la combinación de roles
        rol_ids = await self._resolver_roles(empresa_id, rol_codigos)

        # 2. Crear usuario en Supabase Auth
        adapter = SupabaseAuthAdapter(
            supabase_url=settings.supabase_url,
            anon_key=settings.supabase_anon_key,
            service_role_key=settings.supabase_service_role_key,
        )
        try:
            auth_user_id = await adapter.create_user(email=email, password=password, nombre=nombre)
        except ValueError as e:
            raise AppError(str(e), 409)

        # 3. Insertar en usuarios_empresa + usuario_empresa_roles
        usuario = await self.repo.crear_usuario(
            empresa_id=empresa_id,
            user_id=UUID(auth_user_id),
            nombre=nombre,
            email=email,
            rol_ids=rol_ids,
            invitado_por=admin_user_id,
        )
        usuario["rol_codigos"] = rol_codigos
        return usuario

    async def actualizar_usuario(
        self,
        empresa_id: UUID,
        usuario_id: UUID,
        nombre: str | None,
        rol_codigos: list[str] | None,
        activo: bool | None,
    ) -> dict:
        rol_ids = None
        if rol_codigos is not None:
            rol_ids = await self._resolver_roles(empresa_id, rol_codigos)

        updated = await self.repo.actualizar_usuario(
            empresa_id=empresa_id,
            usuario_id=usuario_id,
            nombre=nombre,
            rol_ids=rol_ids,
            activo=activo,
        )
        if not updated:
            raise AppError("Usuario no encontrado", 404)

        return updated

    async def desactivar_usuario(self, empresa_id: UUID, usuario_id: UUID) -> None:
        await self.repo.desactivar_usuario(empresa_id, usuario_id)

    # ── Notificaciones ────────────────────────────────────────────────────────

    async def enviar_alerta_stock(self, empresa_id: UUID) -> dict:
        """
        Consulta productos bajo mínimo y envía email si hay alguno.
        Retorna resumen: cuántos productos, si el email fue enviado.
        """
        from app.core.config import settings
        from app.modules.admin.infrastructure.email_service import enviar_email_stock_bajo

        productos = await self.repo.get_productos_stock_bajo(empresa_id)
        if not productos:
            return {"enviado": False, "motivo": "No hay productos bajo el mínimo", "productos": 0}

        empresa = await self.repo.get_empresa_para_notif(empresa_id)
        if not empresa or not empresa.get("email"):
            return {"enviado": False, "motivo": "La empresa no tiene email configurado", "productos": len(productos)}

        if not settings.resend_api_key:
            return {"enviado": False, "motivo": "RESEND_API_KEY no está configurada", "productos": len(productos)}

        await enviar_email_stock_bajo(
            api_key=settings.resend_api_key,
            email_from=settings.email_from,
            email_to=empresa["email"],
            empresa_nombre=empresa["razon_social"],
            productos=productos,
        )
        return {"enviado": True, "productos": len(productos), "email_destino": empresa["email"]}

    # ── Sistema ───────────────────────────────────────────────────────────────

    async def get_sistema_config(self, empresa_id: UUID) -> dict:
        return await self.repo.get_sistema_config(empresa_id)

    async def actualizar_sistema_config(self, empresa_id: UUID, datos: dict) -> dict:
        cambios = {k: v for k, v in datos.items() if v is not None}
        return await self.repo.actualizar_sistema_config(empresa_id, cambios)

    # ── IP Permitidas ─────────────────────────────────────────────────────────

    async def listar_ips(self, empresa_id: UUID) -> list[dict]:
        return await self.repo.listar_ips(empresa_id)

    async def agregar_ip(self, empresa_id: UUID, ip: str, descripcion: str) -> dict:
        return await self.repo.agregar_ip(empresa_id, ip, descripcion)

    async def eliminar_ip(self, empresa_id: UUID, ip_id: UUID) -> None:
        eliminada = await self.repo.eliminar_ip(empresa_id, ip_id)
        if not eliminada:
            raise AppError("IP no encontrada", 404)

    # ── Empresa ───────────────────────────────────────────────────────────────

    async def get_empresa(self, empresa_id: UUID) -> dict:
        empresa = await self.repo.get_empresa(empresa_id)
        if not empresa:
            raise AppError("Empresa no encontrada", 404)
        return empresa

    async def actualizar_empresa(self, empresa_id: UUID, datos: dict) -> dict:
        # Solo actualizar campos que vienen con valor
        campos = {k: v for k, v in datos.items() if v is not None}
        empresa = await self.repo.actualizar_empresa(empresa_id, campos)
        if not empresa:
            raise AppError("Empresa no encontrada", 404)
        return empresa
