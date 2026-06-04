"""Endpoints HTTP — módulo devoluciones."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.core.database import acquire_tenant_conn
from app.core.deps import TenantContext, get_tenant_context, require_modulo
from app.modules.devoluciones.application.devoluciones_uc import DevolucionesUseCases
from app.modules.devoluciones.interfaces.schemas import (
    DevolucionIn,
    DevolucionOut,
    PageDevolucionOut,
)

router = APIRouter(
    prefix="/devoluciones",
    tags=["devoluciones"],
    dependencies=[Depends(require_modulo("ventas"))],
)


@router.get("", response_model=PageDevolucionOut)
async def listar_devoluciones(
    page:      int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    ctx: TenantContext = Depends(get_tenant_context),
) -> PageDevolucionOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc     = DevolucionesUseCases(conn)
        result = await uc.listar(UUID(ctx.empresa_id), page, page_size)
    return PageDevolucionOut(**result)


@router.post("", response_model=DevolucionOut, status_code=201)
async def registrar_devolucion(
    body: DevolucionIn,
    ctx:  TenantContext = Depends(get_tenant_context),
) -> DevolucionOut:
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        uc        = DevolucionesUseCases(conn)
        devolucion = await uc.registrar(
            UUID(ctx.empresa_id),
            UUID(ctx.user_id) if ctx.user_id else None,
            body.model_dump(),
        )
    return DevolucionOut(**devolucion)
