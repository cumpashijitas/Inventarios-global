type Entry<T> = { data: T; at: number };
const store = new Map<string, Entry<unknown>>();

/** Retorna datos cacheados si existen (sin importar antigüedad). */
export function peek<T>(key: string): T | undefined {
  return (store.get(key) as Entry<T> | undefined)?.data;
}

/** Retorna true si el cache existe y es más fresco que ttlMs. */
export function isFresh(key: string, ttlMs: number): boolean {
  const e = store.get(key);
  return !!e && Date.now() - e.at < ttlMs;
}

/**
 * Devuelve datos cacheados inmediatamente si son frescos.
 * Si están vencidos o no existen, llama al fetcher, guarda y devuelve.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 30_000,
): Promise<T> {
  if (isFresh(key, ttlMs)) return (store.get(key) as Entry<T>).data;
  const data = await fetcher();
  store.set(key, { data, at: Date.now() });
  return data;
}

/**
 * Muestra datos viejos del cache INMEDIATAMENTE (sin await) y revalida en background.
 * Ideal para listas en páginas: el usuario ve datos al instante, la UI se actualiza
 * en silencio cuando llega la respuesta fresca.
 *
 * @param key        clave del cache
 * @param fetcher    función que hace el fetch real
 * @param onData     callback que recibe los datos (fresh o stale)
 * @param staleTtlMs si el cache tiene más de esto, revalida en background (default 60s)
 * @returns          true si había datos en cache (UI puede quitar el spinner ya)
 */
export function swr<T>(
  key: string,
  fetcher: () => Promise<T>,
  onData: (data: T) => void,
  staleTtlMs = 60_000,
): boolean {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit) onData(hit.data); // entrega datos viejos INSTANTÁNEAMENTE

  const needsRefresh = !hit || Date.now() - hit.at > staleTtlMs;
  if (needsRefresh) {
    fetcher()
      .then((data) => {
        store.set(key, { data, at: Date.now() });
        onData(data);
      })
      .catch(() => {});
  }
  return !!hit; // true = había cache, false = primera vez (necesita spinner)
}

/** Invalida todas las claves que empiecen con prefix. */
export function bust(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
