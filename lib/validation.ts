/**
 * Validaciones compartidas de los recursos que el creador gestiona (planes,
 * cursos, servicios, perfil). Se centralizan aquí porque los mismos límites se
 * aplican en dos capas — los CHECK de Postgres (schema.sql) y las API routes —
 * y tener una única fuente para los números evita que ambas capas se desincronicen
 * silenciosamente (un CHECK más estricto que la UI = error 500 opaco para el creador).
 */

/** Límites de longitud de strings, espejo de los CHECK de schema.sql. */
export const LIMITS = {
  display_name: 60,
  bio: 500,
  content_title: 200,
  content_body: 10000,
  plan_name: 100,
  plan_description: 500,
  course_title: 200,
  course_description: 2000,
  service_title: 200,
  service_description: 2000,
} as const;

/** Tope de precio compartido con el contrato/checkout: 10k USDC por ítem. */
export const MAX_PRICE_USDC = 10000;

export type ValidationError = { error: string };

/**
 * Valida un string requerido con longitud mínima/máxima. Devuelve el valor
 * recortado o un objeto de error con mensaje específico (para responder 400).
 */
export function requireString(
  value: unknown,
  field: string,
  min: number,
  max: number,
): string | ValidationError {
  if (typeof value !== 'string') return { error: `${field} requerido` };
  const trimmed = value.trim();
  if (trimmed.length < min) {
    return { error: `${field} debe tener al menos ${min} caracteres` };
  }
  if (trimmed.length > max) {
    return { error: `${field} no puede exceder ${max} caracteres` };
  }
  return trimmed;
}

/** Valida un string opcional acotado por longitud máxima. */
export function optionalString(
  value: unknown,
  field: string,
  max: number,
): string | null | ValidationError {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return { error: `${field} inválido` };
  const trimmed = value.trim();
  if (trimmed.length > max) {
    return { error: `${field} no puede exceder ${max} caracteres` };
  }
  return trimmed;
}

/** Valida un precio en USDC: número finito > 0 y <= MAX_PRICE_USDC. */
export function validatePrice(value: unknown): number | ValidationError {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return { error: 'price_usdc debe ser mayor a 0' };
  }
  if (n > MAX_PRICE_USDC) {
    return { error: `price_usdc no puede exceder ${MAX_PRICE_USDC}` };
  }
  return n;
}

export function isValidationError(v: unknown): v is ValidationError {
  return typeof v === 'object' && v !== null && 'error' in v;
}
