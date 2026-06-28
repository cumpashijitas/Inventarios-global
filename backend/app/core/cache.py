"""Cache en memoria con TTL para datos que raramente cambian.

Uso:
    _cache = TTLCache(ttl=300)  # 5 minutos

    async def listar_almacenes(empresa_id):
        key = f"almacenes:{empresa_id}"
        cached = _cache.get(key)
        if cached is not None:
            return cached
        data = await _fetch_from_db(empresa_id)
        _cache.set(key, data)
        return data

    # Invalidar al crear/actualizar/eliminar:
    _cache.delete(f"almacenes:{empresa_id}")
"""
from __future__ import annotations

import time
from typing import Any


class TTLCache:
    def __init__(self, ttl: float = 300.0) -> None:
        self._ttl = ttl
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, ts = entry
        if time.monotonic() - ts > self._ttl:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (value, time.monotonic())

    def delete(self, key: str) -> None:
        self._store.pop(key, None)

    def delete_prefix(self, prefix: str) -> None:
        keys = [k for k in self._store if k.startswith(prefix)]
        for k in keys:
            del self._store[k]
