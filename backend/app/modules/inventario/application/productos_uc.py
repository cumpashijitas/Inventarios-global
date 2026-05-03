"""Use cases de productos.

Cada use case orquesta:
    1. Validación de input (Pydantic ya filtró tipos; aquí validamos negocio).
    2. Construcción de entidad de dominio (lanza DomainError si inválida).
    3. Persistencia vía repository.
    4. Auditoría.
    5. Devolución del DTO de salida.

NO conocen FastAPI. Reciben dicts validados y devuelven dicts/entidades.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

import asyncpg

from app.modules.inventario.domain.entities import Producto
from app.modules.inventario.domain.value_objects import SKU, Cantidad, Precio
from app.modules.inventario.infrastructure.productos_repo import ProductosRepository
from app.shared.auditoria import registrar_auditoria


class ProductosUseCases:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self.conn = conn
        self.repo = ProductosRepository(conn)

    async def listar(
        self,
        empresa_id: UUID,
        page: int,
        page_size: int,
        search: str | None,
        only_active: bool = False,
    ) -> dict[str, Any]:
        items, total = await self.repo.list_paginated(
            empresa_id, page, page_size, search, only_active
        )
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size else 0,
        }

    async def obtener(self, producto_id: UUID) -> dict[str, Any]:
        return await self.repo.get(producto_id)

    async def crear(
        self,
        empresa_id: UUID,
        user_id: UUID | None,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        # Validar invariantes de dominio antes de tocar DB
        moneda = data.pop("moneda", "BOB")
        Producto(
            id=UUID(int=0),  # placeholder; el id real lo asigna la DB
            empresa_id=empresa_id,
            sku=SKU(data["sku"]),
            nombre=data["nombre"],
            unidad_id=data["unidad_id"],
            precio_compra=Precio(Decimal(str(data["precio_compra"])), moneda),
            precio_venta=Precio(Decimal(str(data["precio_venta"])), moneda),
            stock_minimo=Cantidad(Decimal(str(data["stock_minimo"]))),
            controla_stock=data["controla_stock"],
        )

        created = await self.repo.create(empresa_id, user_id, data)

        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="inventario",
            entidad="producto",
            entidad_id=str(created["id"]),
            accion="crear",
            payload_despues={k: str(v) for k, v in created.items()},
        )
        return created

    async def actualizar(
        self,
        empresa_id: UUID,
        user_id: UUID | None,
        producto_id: UUID,
        patch: dict[str, Any],
    ) -> dict[str, Any]:
        antes = await self.repo.get(producto_id)
        actualizado = await self.repo.update(
            producto_id, {k: v for k, v in patch.items() if v is not None or k in {"descripcion", "stock_maximo", "imagen_url", "categoria_id"}}, user_id
        )
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="inventario",
            entidad="producto",
            entidad_id=str(producto_id),
            accion="actualizar",
            payload_antes={k: str(v) for k, v in antes.items()},
            payload_despues={k: str(v) for k, v in actualizado.items()},
        )
        return actualizado

    async def eliminar(
        self, empresa_id: UUID, user_id: UUID | None, producto_id: UUID
    ) -> None:
        antes = await self.repo.get(producto_id)
        await self.repo.soft_delete(producto_id, user_id)
        await registrar_auditoria(
            self.conn,
            empresa_id=str(empresa_id),
            user_id=str(user_id) if user_id else None,
            modulo="inventario",
            entidad="producto",
            entidad_id=str(producto_id),
            accion="eliminar",
            payload_antes={k: str(v) for k, v in antes.items()},
        )
