/**
 * Sanea URLs que provienen del usuario (media_url, avatar_url, etc.).
 *
 * Un atacante puede guardar `javascript:alert(1)` o `data:text/html,...` como
 * URL; si luego se renderiza en <a href>, <video src> o <iframe>, ejecuta
 * código en el contexto de la página (XSS). Exigimos https:// explícito.
 */
export function isSafeHttpsUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Devuelve la URL si es https segura, o null para no renderizarla. */
export function safeHttpsUrl(raw: unknown): string | null {
  return isSafeHttpsUrl(raw) ? raw : null;
}
