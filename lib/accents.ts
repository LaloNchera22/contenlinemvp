/**
 * Los ocho acentos de contenido. Todos verificados a ≥4.5:1 con texto blanco
 * encima, así que el texto sobre un acento siempre es blanco. El color lo pone
 * el contenido, nunca el chrome.
 *
 * En producción el acento se guarda junto a cada reto/creador en el registro
 * (columna aditiva `accent`); la extracción del color dominante desde la
 * portada del video queda para v2. Mientras tanto, `accentFor` deriva un acento
 * estable y determinista desde un id, para que un mismo reto se vea igual en
 * cada render sin calcular color en el cliente.
 */
export const ACCENTS = [
  '#C0392B',
  '#A15300',
  '#1D7A4D',
  '#0F6E6E',
  '#2C5FD8',
  '#6B2FBF',
  '#B02E6E',
  '#4A4A4F',
] as const;

export type Accent = (typeof ACCENTS)[number];

/** Acento estable derivado de un identificador (id de reto, username, etc.). */
export function accentFor(key: string): Accent {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[hash % ACCENTS.length];
}
