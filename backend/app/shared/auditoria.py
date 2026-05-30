"""Función reusable para escribir en `public.auditoria`.

Cada use case que muta data llama a `registrar_auditoria` después de la
mutación exitosa. Usa la MISMA conexión/transacción del use case para
garantizar atomicidad: si la auditoría falla, la mutación se rollbackea.
"""

from __future__ import annotations

import json
from decimal import Decimal
from datetime import date, datetime
from typing import Any
from uuid import UUID

import asyncpg


class _AuditEncoder(json.JSONEncoder):
    """Encoder que maneja los tipos Python que vienen de Pydantic / asyncpg."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


def _dumps(obj: Any) -> str:
    return json.dumps(obj, cls=_AuditEncoder)


async def registrar_auditoria(
    conn: asyncpg.Connection,
    *,
    empresa_id: str,
    user_id: str | None,
    modulo: str,
    entidad: str,
    entidad_id: str | None,
    accion: str,
    payload_antes: dict[str, Any] | None = None,
    payload_despues: dict[str, Any] | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
) -> None:
    await conn.execute(
        """
        insert into public.auditoria
            (empresa_id, user_id, modulo, entidad, entidad_id, accion,
             payload_antes, payload_despues, ip, user_agent)
        values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::inet, $10)
        """,
        empresa_id,
        user_id,
        modulo,
        entidad,
        entidad_id,
        accion,
        _dumps(payload_antes) if payload_antes else None,
        _dumps(payload_despues) if payload_despues else None,
        ip,
        user_agent,
    )
