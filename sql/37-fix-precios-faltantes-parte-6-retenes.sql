-- =============================================================================
-- 37-fix-precios-faltantes-parte-6-retenes.sql  (85 productos)
-- Match por codigo base (mismo numero de parte, marca abreviada distinta en el
-- Excel: ej. DB="AE4054P-NKC" <-> Excel="AE4054P/NOK/COR"). Revisado 1 a 1: cada
-- SKU de esta lista tenia EXACTAMENTE UN candidato posible en el Excel (sin ambiguedad).
-- SOLO rellena precios en 0/NULL, igual que las partes 1-5.
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

WITH v(sku, precio_compra, costo_caja, precio_venta, precio_mayor, precio_mecanico, precio_real) AS (
  VALUES
    ('344410R-NKS', NULL::numeric, NULL::numeric, 32::numeric, 28::numeric, 24::numeric, 22::numeric),
    ('5857-ARCA', 38, 38, 86.14, 72.68, 67.3, 60.57),
    ('9011412CI-NKC', NULL, NULL, 80, 70, 65, 60),
    ('AE1464E-NKC', NULL, NULL, 25.11, 23.25, 20.46, 18.6),
    ('AE4054P-NKC', NULL, NULL, 79.05, 74.4, 65.1, 60.45),
    ('AH0994E-NKC', 8, 8, 22.32, 20.46, 18.6, 16.74),
    ('AH1302G-NKC', 8.5, 8.5, 26.04, 23.25, 21.39, 18.6),
    ('AH2057U-NKC', 8, 8, 34, 30, 24, 20),
    ('AH2342F-NKC', 9, 9, 28, 24, 23, 20),
    ('AH2361E-NKC', NULL, NULL, 31.25, 28.12, 26.04, 20.83),
    ('AH2492E-NKC', 11.5, 11.5, 31.62, 27.9, 26.04, 23.25),
    ('AH3615E-NKC', NULL, NULL, 51.15, 42.78, 40.92, 37.2),
    ('AH8338F-NKC', NULL, NULL, 24.18, 22.32, 20.46, 16.74),
    ('AH8378E-NKC', NULL, NULL, 33, 30, 28, 25),
    ('BA2768-E0-NKC', 20, 20, 80, 75.29, 55, 50.66),
    ('BC4682E-NKC', NULL, NULL, 55.2, 50, 45.83, 41.66),
    ('BD4374E-NKC', NULL, NULL, 34.41, 32.55, 30.69, 27.9),
    ('BH1882E-NKC', 7.5, 7.5, 26.04, 22.32, 21.39, 17.67),
    ('BH2634F-NKC', 19, 19, 54.16, 47.91, 42.97, 39.06),
    ('BH3670F-NKC', 13, 13, 41.66, 36.46, 31.25, 26.04),
    ('BP1503E-NKC', 15, 15, 36.46, 31.25, 29.95, 26.04),
    ('BZ8042-A0-NKC', 9.5, 9.5, 17.67, 16.74, 15.81, 14.88),
    ('F4022-MUSASHI', 19, 14, 44.64, 39.06, 37.2, 32.55),
    ('F4118-MUSASHI', 12, 12, 39.06, 34.37, 27.34, 22.13),
    ('F4146-MUSASHI', 16.5, 16.5, 44, 38, 35, 30),
    ('F4173-MUSASHI', 17, 17, 44.79, 39.58, 36.46, 34.37),
    ('HT090N1-NKC', 31, 31, 78.12, 62.5, 58.59, 52.08),
    ('M4611-MUSASHI', 18, 18, 57.29, 46.87, 41.66, 31.25),
    ('N2061-MUSASHI', 17.5, 17.5, 50.78, 43.75, 41.66, 29.95),
    ('N2063-MUSASHI', 13, 13, 39.99, 36.27, 35.34, 30.69),
    ('N2092-MUSASHI', 25, 25, 91.66, 81.24, 78.12, 72.91),
    ('N2124-MUSASHI', 9, 9, 34.37, 29.16, 20.83, 18.75),
    ('N2154-MUSASHI', 12.5, 30, 37.2, 35.34, 32.55, 30.69),
    ('N2173-MUSASHI', 10.5, 10.5, 36.46, 31.25, 26.04, 20.83),
    ('N2186-MUSASHI', 9, 9, 29.76, 26.04, 23.25, 21.39),
    ('N2215-MUSASHI', 14, 14, 42.97, 67.7, 32.55, 24.74),
    ('N2272-MUSASHI', NULL, NULL, 57.29, 52.08, 46.87, 41.66),
    ('N2276-MUSASHI', 18.5, 18.5, 44.64, 42.78, 40.92, 39.06),
    ('N2277-MUSASHI', 18, 31, 78.12, 62.5, 60.41, 44.79),
    ('N2304-MUSASHI', 26, 26, 65.1, 57.29, 52.08, 46.87),
    ('N2305-MUSASHI', 12, 12, 36.46, 31.25, 29.16, 26.04),
    ('N2311-MUSASHI', 12, 12, 39.58, 35.41, 31.25, 29.16),
    ('N2343-MUSASHI', NULL, NULL, 40.92, 37.2, 35.34, 32.55),
    ('N2347-MUSASHI', 25, 25, 54.68, 48.96, 45.57, 42.97),
    ('N2353-MUSASHI', 18, 18, 48.96, 41.66, 37.76, 31.25),
    ('N2358-MUSASHI', NULL, NULL, 72.91, 67.7, 65.62, 62.5),
    ('S4884-MUSASHI', 26, 26, 54.68, 46.87, 45.57, 42.97),
    ('T1007-MUSASHI', 8, 8, 34.37, 31.25, 23.44, 19.53),
    ('T1017-MUSASHI', 8.5, 8.5, 31.25, 26.04, 23.44, 19.53),
    ('T1018-MUSASHI', 10, NULL, 27.9, 25.11, 24.18, 23.25),
    ('T1062-MUSASHI', 11, 11, 36.46, 31.25, 28.64, 19.53),
    ('T1067-MUSASHI', 12, 9, 36.46, 31.25, 28.64, 26.04),
    ('T1075-MUSASHI', 8, 11, 28, 25, 23, 20),
    ('T1079-MUSASHI', 13, 13, 36.27, 32.55, 30.69, 27.9),
    ('T1086-MUSASHI', 10, 9.5, 44.64, 39.06, 35.34, 32.55),
    ('T1088-MUSASHI', 12, 12, 32.55, 31.62, 30.69, 27.9),
    ('T1102-MUSASHI', 17, 17, 50, 46.87, 39.06, 32.55),
    ('T1133-MUSASHI', 16, 15, 44.27, 38.54, 33.85, 31.25),
    ('T1154-MUSASHI', 11, 16, 33.33, 29.16, 29.16, 23.96),
    ('T1178-MUSASHI', 9.5, 10, 26.97, 25.11, 24.18, 22.32),
    ('T1186-MUSASHI', 11, 11, 35.41, 31.25, 29.16, 27.08),
    ('T1187-MUSASHI', 33.5, 28.5, 91.14, 76.04, 69.01, 59.89),
    ('T1194-MUSASHI', 15, 15, 40, 35, 33, 30),
    ('T1202-NKC', 32, 32, 84.63, 67.7, 65.1, 58.59),
    ('T1232-MUSASHI', 17.5, 17.5, 50.78, 42.71, 41.66, 35.15),
    ('T1237-MUSASHI', NULL, NULL, 32.55, 28.12, 26.04, 16.93),
    ('T1248-MUSASHI', 10.5, 10, 31.25, 29.16, 26.04, 22.92),
    ('T1251-MUSASHI', 10.5, 13, 30, 28, 25, 23),
    ('T1256-MUSASHI', 20.5, 17.5, 60, 55, 48, 45),
    ('T1271-MUSASHI', 14.5, 11, 30, 28, 27, 26),
    ('T1283-MUSASHI', 9.5, 9, 28, 24, 23, 22),
    ('T1284-MUSASHI', 37, 37, 88.35, 85.56, 83.7, 81.84),
    ('T1299-MUSASHI', 12.5, 12.5, 33, 30, 28, 25),
    ('T1318-MUSASHI', 11.5, 11.5, 33.48, 31.62, 28.83, 27.9),
    ('T1326-MUSASHI', 22, 19.5, 58, 50, 48, 45),
    ('T1337-MUSASHI', 24.5, 15.5, 54.68, 46.87, 42.97, 39.06),
    ('T1366-MUSASHI', 21.5, 21.5, 60.8, 55.94, 51.15, 46.5),
    ('T1380-MUSASHI', 44, 44, 88, 78, 70, 65),
    ('Z6122-MUSASHI', NULL, NULL, 46.87, 39.58, 36.46, 31.25),
    ('Z6125-MUSASHI', 9, 12, 36.46, 31.25, 29.16, 26.04),
    ('Z6127-MUSASHI', NULL, NULL, 45.83, 39.58, 35.41, 31.25),
    ('Z6139-MUSASHI', 10, 10, 50, 45, 43, 40),
    ('Z6155-MUSASHI', NULL, NULL, 43.75, 39.58, 36.46, 33.33),
    ('Z6171-MUSASHI', 58, 58, 151.03, 135.41, 133.32, 130.2),
    ('Z6172-MUSASHI', 20, 20, 50.78, 41.66, 39.06, 35.15)
)
UPDATE public.productos p
SET
  precio_compra = CASE WHEN v.precio_compra IS NOT NULL AND (p.precio_compra IS NULL OR p.precio_compra = 0) THEN v.precio_compra ELSE p.precio_compra END,
  costo_caja = CASE WHEN v.costo_caja IS NOT NULL AND (p.costo_caja IS NULL OR p.costo_caja = 0) THEN v.costo_caja ELSE p.costo_caja END,
  precio_venta = CASE WHEN v.precio_venta IS NOT NULL AND (p.precio_venta IS NULL OR p.precio_venta = 0) THEN v.precio_venta ELSE p.precio_venta END,
  precio_mayor = CASE WHEN v.precio_mayor IS NOT NULL AND (p.precio_mayor IS NULL OR p.precio_mayor = 0) THEN v.precio_mayor ELSE p.precio_mayor END,
  precio_mecanico = CASE WHEN v.precio_mecanico IS NOT NULL AND (p.precio_mecanico IS NULL OR p.precio_mecanico = 0) THEN v.precio_mecanico ELSE p.precio_mecanico END,
  precio_real = CASE WHEN v.precio_real IS NOT NULL AND (p.precio_real IS NULL OR p.precio_real = 0) THEN v.precio_real ELSE p.precio_real END
FROM v
WHERE p.sku = v.sku
  AND p.empresa_id = (SELECT id FROM public.empresas LIMIT 1)
  AND (
    (v.precio_compra IS NOT NULL AND (p.precio_compra IS NULL OR p.precio_compra = 0)) OR
    (v.costo_caja IS NOT NULL AND (p.costo_caja IS NULL OR p.costo_caja = 0)) OR
    (v.precio_venta IS NOT NULL AND (p.precio_venta IS NULL OR p.precio_venta = 0)) OR
    (v.precio_mayor IS NOT NULL AND (p.precio_mayor IS NULL OR p.precio_mayor = 0)) OR
    (v.precio_mecanico IS NOT NULL AND (p.precio_mecanico IS NULL OR p.precio_mecanico = 0)) OR
    (v.precio_real IS NOT NULL AND (p.precio_real IS NULL OR p.precio_real = 0))
  );