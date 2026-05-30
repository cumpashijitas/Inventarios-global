"""Endpoints HTTP — dashboard."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.database import acquire_tenant_conn
from app.core.deps import TenantContext, get_tenant_context

from app.modules.dashboard.infrastructure.dashboard_repo import DashboardRepository

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
async def stats_dashboard(
    ctx: TenantContext = Depends(get_tenant_context),
) -> dict:
    """Estadísticas en tiempo real para el dashboard principal."""
    async with acquire_tenant_conn(ctx.empresa_id, ctx.user_id) as conn:
        repo = DashboardRepository(conn)
        return await repo.stats(UUID(ctx.empresa_id))
