-- Función para registrar múltiples movimientos de stock en un solo round-trip.
-- Reemplaza el loop Python que llama registrar_movimiento_stock() N veces.
-- Úsala al crear ventas con múltiples ítems.

CREATE OR REPLACE FUNCTION public.registrar_movimientos_stock_batch(
  p_producto_ids    uuid[],
  p_almacen_ids     uuid[],
  p_tipos           text[],
  p_cantidades      numeric[],
  p_costos          numeric[],
  p_ref_tipos       text[],
  p_ref_ids         uuid[],
  p_motivos         text[]
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_ids  uuid[] := '{}';
  v_id   uuid;
  i      int;
  n      int;
BEGIN
  n := array_length(p_producto_ids, 1);
  IF n IS NULL THEN
    RETURN v_ids;
  END IF;

  FOR i IN 1..n LOOP
    v_id := public.registrar_movimiento_stock(
      p_producto_ids[i],
      p_almacen_ids[i],
      p_tipos[i],
      p_cantidades[i],
      p_costos[i],
      p_ref_tipos[i],
      p_ref_ids[i],
      p_motivos[i]
    );
    v_ids := array_append(v_ids, v_id);
  END LOOP;

  RETURN v_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_movimientos_stock_batch(
  uuid[], uuid[], text[], numeric[], numeric[], text[], uuid[], text[]
) TO app_user;
