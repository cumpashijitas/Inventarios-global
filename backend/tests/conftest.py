"""pytest configuration global.

Tests unitarios (tests/unit/) NO necesitan DB ni FastAPI: prueban dominio puro.
Tests de integración (tests/integration/) usarán testcontainers — los agregamos
en una próxima sesión cuando montemos CI.
"""

import pytest

pytest_plugins: list[str] = []


@pytest.fixture
def empresa_id() -> str:
    return "00000000-0000-0000-0000-000000000001"


@pytest.fixture
def user_id() -> str:
    return "00000000-0000-0000-0000-000000000aaa"
