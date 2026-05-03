"""Router maestro v1.

Cada módulo expone su propio APIRouter; aquí los componemos bajo /api/v1.
Cuando agregues un módulo nuevo (ventas, compras, distribucion), súmalo aquí.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.modules.auth.interfaces.routes import router as auth_router
from app.modules.inventario.interfaces.routes import router as inventario_router

api_v1 = APIRouter(prefix="/api/v1")

api_v1.include_router(auth_router)
api_v1.include_router(inventario_router)
