"""Tests del dominio inventario — sin DB, sin HTTP.

Demuestran que las reglas de negocio se pueden testear en aislamiento total.
Si tienes que importar algo de infrastructure/ o de FastAPI aquí, rompiste
hexagonal.
"""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

import pytest

from app.core.exceptions import DomainError
from app.modules.inventario.domain.entities import Almacen, Producto
from app.modules.inventario.domain.value_objects import SKU, Cantidad, Precio


# ---------------- SKU ----------------
class TestSKU:
    def test_valido(self):
        assert SKU("ABC-123").valor == "ABC-123"

    def test_con_punto(self):
        assert SKU("PROD.001").valor == "PROD.001"

    @pytest.mark.parametrize("malo", ["", "   ", "abc 123", "abc#123", "x" * 51])
    def test_invalido(self, malo):
        with pytest.raises(DomainError):
            SKU(malo)


# ---------------- Cantidad ----------------
class TestCantidad:
    def test_acepta_int(self):
        assert Cantidad(10).valor == Decimal("10")

    def test_acepta_float(self):
        assert Cantidad(2.5).valor == Decimal("2.5")

    def test_positiva_ok(self):
        assert Cantidad.positiva(5).valor == Decimal("5")

    @pytest.mark.parametrize("malo", [0, -1, -0.5])
    def test_positiva_falla(self, malo):
        with pytest.raises(DomainError):
            Cantidad.positiva(malo)


# ---------------- Precio ----------------
class TestPrecio:
    def test_basico(self):
        p = Precio(Decimal("99.99"))
        assert p.monto == Decimal("99.99")
        assert p.moneda == "BOB"

    def test_otra_moneda(self):
        assert Precio(Decimal("10"), "USD").moneda == "USD"

    def test_no_negativo(self):
        with pytest.raises(DomainError):
            Precio(Decimal("-1"))

    @pytest.mark.parametrize("moneda", ["BO", "BOLIV", "B0B", "12X"])
    def test_moneda_invalida(self, moneda):
        with pytest.raises(DomainError):
            Precio(Decimal("1"), moneda)


# ---------------- Producto ----------------
class TestProducto:
    def _producto(self, **overrides) -> Producto:
        defaults = dict(
            id=UUID(int=1),
            empresa_id=UUID(int=2),
            sku=SKU("ABC-001"),
            nombre="Producto demo",
            unidad_id=UUID(int=3),
            precio_compra=Precio(Decimal("100")),
            precio_venta=Precio(Decimal("150")),
            stock_minimo=Cantidad(Decimal("5")),
        )
        defaults.update(overrides)
        return Producto(**defaults)

    def test_creacion_valida(self):
        p = self._producto()
        assert p.nombre == "Producto demo"

    def test_nombre_requerido(self):
        with pytest.raises(DomainError):
            self._producto(nombre="   ")

    def test_renombrar(self):
        p = self._producto()
        p.renombrar("Otro nombre  ")
        assert p.nombre == "Otro nombre"

    def test_renombrar_vacio_falla(self):
        p = self._producto()
        with pytest.raises(DomainError):
            p.renombrar("")

    def test_actualizar_precios_misma_moneda(self):
        p = self._producto()
        p.actualizar_precios(Precio(Decimal("80")), Precio(Decimal("120")))
        assert p.precio_compra.monto == Decimal("80")

    def test_actualizar_precios_distinta_moneda_falla(self):
        p = self._producto()
        with pytest.raises(DomainError):
            p.actualizar_precios(
                Precio(Decimal("80"), "BOB"),
                Precio(Decimal("120"), "USD"),
            )

    def test_margen_bruto(self):
        p = self._producto(
            precio_compra=Precio(Decimal("100")),
            precio_venta=Precio(Decimal("150")),
        )
        assert p.margen_bruto() == Decimal("0.5")

    def test_margen_compra_cero(self):
        p = self._producto(precio_compra=Precio(Decimal("0")))
        assert p.margen_bruto() == Decimal("0")


# ---------------- Almacen ----------------
class TestAlmacen:
    def test_basico(self):
        a = Almacen(id=UUID(int=1), empresa_id=UUID(int=2), codigo="CENTRAL", nombre="Central")
        assert a.tipo == "fisico"

    def test_codigo_requerido(self):
        with pytest.raises(DomainError):
            Almacen(id=UUID(int=1), empresa_id=UUID(int=2), codigo="  ", nombre="x")

    def test_tipo_invalido(self):
        with pytest.raises(DomainError):
            Almacen(id=UUID(int=1), empresa_id=UUID(int=2), codigo="X", nombre="x", tipo="raro")
