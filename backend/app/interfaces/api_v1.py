"""Router maestro v1.

Cada módulo expone su propio APIRouter; aquí los componemos bajo /api/v1.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.deps import check_ip_access
from app.modules.admin.interfaces.routes import router as admin_router
from app.modules.auth.interfaces.routes import router as auth_router
from app.modules.caja.interfaces.routes import router as caja_router
from app.modules.dashboard.interfaces.routes import router as dashboard_router
from app.modules.inventario.interfaces.routes import router as inventario_router
from app.modules.lotes.interfaces.routes import router as lotes_router
from app.modules.reportes.interfaces.routes import router as reportes_router
from app.modules.devoluciones.interfaces.routes import router as devoluciones_router
from app.modules.ventas.interfaces.routes import router as ventas_router

api_v1 = APIRouter(prefix="/api/v1", dependencies=[Depends(check_ip_access)])

api_v1.include_router(auth_router)
api_v1.include_router(admin_router)
api_v1.include_router(dashboard_router)
api_v1.include_router(inventario_router)
api_v1.include_router(ventas_router)
api_v1.include_router(devoluciones_router)
api_v1.include_router(caja_router)
api_v1.include_router(lotes_router)
api_v1.include_router(reportes_router)
