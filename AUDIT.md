# Auditoría — estado de remediación

Estado de los hallazgos de la auditoría exhaustiva (commit base `96fdf19`).

## 🔒 Seguridad técnica

| Hallazgo | Estado | Detalle |
|----------|--------|---------|
| setSession usa el JWT como refresh_token | ✅ Resuelto | `autoRefreshToken: false` en el cliente, `refresh_token: ''` en setSession y nuevo endpoint `POST /api/auth/refresh` + `refresh()` en `useSiweAuth`. |
| CSP `unsafe-inline` en script-src | ✅ Resuelto | `middleware.ts` genera un nonce por request; CSP movida desde `next.config.js`. Se eliminó `unsafe-inline` (se mantiene `unsafe-eval` para WalletConnect). |
| `media_url` / `avatar_url` sin validar protocolo | ✅ Resuelto | `lib/url.ts` (`isSafeHttpsUrl`); validación al insertar en `/api/content` y al renderizar el avatar. |
| `username` predecible/secuestrable | ✅ Resuelto | Username inicial con entropía aleatoria (no derivado de la wallet) + reintento ante colisión; constraint `CHECK (username ~ '^[a-z0-9_]{3,32}$')`. |

## ⚙️ Lógica de negocio

| Hallazgo | Estado | Detalle |
|----------|--------|---------|
| `planId` UUID vs uint256 | ✅ Resuelto | Columna `subscription_plans.onchain_plan_id BIGINT IDENTITY UNIQUE`; el frontend pasa el entero y `confirm` mapea de vuelta. |
| `SubscribeButton` no ejecuta writeContract | ✅ Resuelto | Flujo approve → subscribe → confirm con wagmi. |
| Falta la página `/checkout/[id]` | ✅ Resuelto | `app/checkout/[id]` (server + `CheckoutClient`) ejecuta `pay()` y confirma. |
| `confirm` no valida el plan de suscripción | ✅ Resuelto | Lookup por `(creator_id, onchain_plan_id)`, validación de precio y upsert en `subscriptions`. |
| `api_key_id` null en transacciones onchain | ✅ Resuelto | Se propaga desde la `payment_session` en la API route y la Edge Function. |

## 🏗 Arquitectura

| Hallazgo | Estado | Detalle |
|----------|--------|---------|
| Hardcoded mainnet en publicClient | ✅ Resuelto | `lib/chain.ts` (`getChain`/`getRpcUrl`) según `NEXT_PUBLIC_CHAIN_ID`; Edge Function lee `CHAIN_ID`. |
| Faltan INSERT policies de Storage + upload | ✅ Resuelto | Policies `service_role` para buckets privados + endpoint `POST /api/upload`. |
| Falta middleware de protección de `/dashboard` | ✅ Resuelto | `middleware.ts` verifica el JWT (Web Crypto) y redirige si no hay sesión. |
| Sin tests de API/lib | ✅ Resuelto (`b49850b`) | Cobertura con thresholds (lib 60% / app/api 50%): `validateApiKey`, `whitelist`, `confirm-flow`, `checkout`, `crud`, `lib-extra` + helper de mock. Resultado: lib ~88%, 65 tests vitest + 7 hardhat. `npm run test:coverage`. |
| Doble implementación API Routes vs Edge Functions | ✅ Resuelto (`ba4f5e9`) | Se eliminó la Edge Function `confirm-transaction`; las API Routes quedan como única fuente de verdad. README actualizado (solo validate-api-key, sync-subscriptions, sync-plans-onchain, process-webhook). |

## 🎨 UI/UX

| Hallazgo | Estado |
|----------|--------|
| Feedback de error en forms (keys/content) | ✅ Resuelto (parse de `error`, `role="alert"`). |
| Contraste WCAG (`text-white/40`) | ✅ Resuelto (subido a `/60` en texto informativo). |
| Tabla de ingresos no responsive | ✅ Resuelto (cards en móvil, tabla en desktop, `scope="col"`). |
| Botón de copiar `newSecret` | ✅ Resuelto (`navigator.clipboard` + estado "Copiada"). |
| Onboarding / empty state del dashboard | ✅ Resuelto (tarjetas de primeros pasos). |

## 📋 Normativa

| Hallazgo | Estado |
|----------|--------|
| Aviso de privacidad / términos / cookies | ✅ Resuelto (`/privacy`, `/terms`, `/cookies` + banner + footer). |
| Disclaimer KYC/AML y non-custodial | ✅ Resuelto (en términos y checkout). |
| Age-gate NSFW | 🔒 Decisión (BLOQUE 3.3): se **prohíbe** el contenido sexualmente explícito hasta integrar KYC de creadores adultos. Términos §4 actualizado; `AgeGate` deshabilitado (no se renderiza, código conservado); el flag `is_adult` se mantiene en schema (sin UI que lo active) para uso futuro. |
| Right to Erasure | ✅ Resuelto (`DELETE /api/me` anonimiza PII y desactiva keys). |
| Reportes contables | ✅ Resuelto (`GET /api/transactions/export` CSV). |
| Accesibilidad (aria/roles) | ✅ Parcial → reforzado (`dacc38a`): toasts con `role="alert"`/`role="status"`, `ConfirmDialog` con `role="dialog"`/`aria-modal`/Escape, skeletons con `role="status"`. |
| Internacionalización (i18n) | ⏳ Pendiente — requiere integrar next-intl y extraer todos los strings; se documenta como trabajo siguiente. |
| Pista de auditoría visible al creador | ⏳ Pendiente. |

## Pendientes documentados

- Consolidación total Edge Functions ↔ API Routes.
- i18n (next-intl) y extracción de strings.
- **Contenido adulto — plan futuro:** integrar un proveedor de verificación de
  identidad/edad (Persona / Veriff / Sumsub) para creadores adultos ANTES de
  rehabilitar el contenido explícito. Al habilitarlo: re-renderizar `AgeGate`,
  exponer el toggle `is_adult` solo para creadores verificados por KYC y cumplir
  2257 (EE. UU.) / DSA (UE). Hasta entonces, prohibido por Términos §4.
- Activación de analítica con consentimiento (el banner ya lo contempla).
- UI de historial/auditoría de cambios para el creador.

---

# Remediación testnet → mainnet (BLOQUES 1–4)

Segunda ronda de remediación para llevar el MVP de "apto para testnet" a "listo
para mainnet". Commits: BLOQUE 1 `ba4f5e9`, BLOQUE 2 `dacc38a`, BLOQUE 3 `b49850b`.

## BLOQUE 1 — Bloqueadores de soft-launch (`ba4f5e9`)

| Item | Estado | Detalle |
|------|--------|---------|
| 1.1 CRUD del creador | ✅ Resuelto | Endpoints `plans`/`courses`(+`publish`)/`services` con validación; UI de dashboard; `SUBSCRIPTION_ADMIN_ABI` (`setPlan`); columna `onchain_synced` + Edge Function `sync-plans-onchain` (evento `PlanSet`). |
| 1.2 Confirmación de acciones destructivas | ✅ Resuelto | `ConfirmDialog` reusable (type-to-confirm) en revoke key, eliminar cuenta, delete plan/curso/servicio y logout. |
| 1.3 Rate limiting endpoints públicos | ✅ Resuelto | `lib/rateLimit.ts` + tabla `ip_rate_limit` + `check_ip_rate_limit` (advisory lock). confirm 30/min, nonce 10/min, upload 20/día. |
| 1.4 Límites de longitud | ✅ Resuelto | CHECK idempotentes en schema (users/content/plans/courses/services) + validación en API (`lib/validation.ts`). |
| 1.5 Cleanup payment_sessions | ✅ Resuelto | `cleanup_expired_payment_sessions()` + cron diario. |
| 1.6 Feed del fan | ✅ Resuelto | `/[username]` con contenido reciente; exclusivo bloqueado con blur+candado; `ContentItem` (signed URL + 403). |
| 1.7 Dedup confirm-transaction | ✅ Resuelto | Edge Function eliminada; README actualizado. |

## BLOQUE 2 — UX/usabilidad (`dacc38a`)

| Item | Estado | Detalle |
|------|--------|---------|
| 2.1 Loading skeletons | ✅ Resuelto | `Skeleton`/`Text`/`Card`/`Row` en dashboard, earnings, keys, plans/courses/services y `loading.tsx` del perfil. |
| 2.2 Páginas de error custom | ✅ Resuelto | `error.tsx` (sin stack en prod), `global-error.tsx`, `not-found.tsx`. |
| 2.3 Empty states con CTA | ✅ Resuelto | `EmptyState` (SVG + CTA) en keys, plans, courses, services. |
| 2.4 Sync wallet ↔ sesión | ✅ Resuelto | `useAuthSync` cierra sesión si la wallet deja de coincidir (tolera reconexión de wagmi). |
| 2.5 Toasts persistentes | ✅ Resuelto | `ToastProvider`/`useToast`; reemplazan el status inline de SubscribeButton y CheckoutClient (sobreviven al popup de wallet). |

## BLOQUE 3 — Hardening pre-mainnet (`b49850b`)

| Item | Estado | Detalle |
|------|--------|---------|
| 3.1 Multisig + timelock | ✅ Resuelto | `OwnableWithTimelock` (delay 48h, propuesta→ejecución atada al valor) en ambos contratos; eventos `FeeUpdateProposed`/`FeeUpdateExecuted`; `scripts/deploy-with-multisig.ts` con verificación; README "Mainnet deployment". |
| 3.2 Cobertura de tests ≥60% | ✅ Resuelto | lib ~88%, app/api ≥50%; 65 tests vitest + 7 hardhat; `test:coverage` con thresholds por glob. |
| 3.3 Decisión contenido adulto | ✅ Resuelto | Prohibido contenido explícito hasta KYC (Términos §4); `AgeGate` deshabilitado; `is_adult` conservado sin UI. |

## BLOQUE 4 — Documentación y operaciones

| Item | Estado | Detalle |
|------|--------|---------|
| 4.1 Actualizar AUDIT.md | ✅ Resuelto | Este documento. |
| 4.2 Production checklist | ✅ Resuelto | Sección "Production checklist" en README. |
| 4.3 Docs del developer | ✅ Resuelto | `app/docs/page.tsx`: obtener key, ejemplos curl/Node/Python, payload del webhook, verificación HMAC, event types y códigos de respuesta. |

## Pendientes que siguen abiertos (no en alcance de estos bloques)

- i18n (next-intl) y extracción de strings.
- Integración de KYC para rehabilitar contenido adulto.
- UI de historial/auditoría de cambios para el creador.
- Activación de analítica con consentimiento.
- **Operacional (requiere terceros, ver Production checklist):** auditoría externa
  de contratos, bug bounty, despliegue del Gnosis Safe 3/5, monitoreo (Sentry/Logflare),
  backups y plan de respuesta a incidentes.

## Score de production-readiness (estimado)

| Dimensión | Antes (testnet) | Después (estos bloques) |
|-----------|:---:|:---:|
| Funcionalidad core (creador puede operar) | 5/10 | 9/10 |
| Seguridad técnica | 7/10 | 8.5/10 |
| Contratos / gobernanza onchain | 6/10 | 8/10 *(falta auditoría externa + multisig real)* |
| UX / accesibilidad | 6/10 | 8.5/10 |
| Calidad / tests | 4/10 | 8/10 |
| Cumplimiento normativo | 6/10 | 7.5/10 |
| Operaciones / observabilidad | 3/10 | 5/10 *(checklist definido, falta ejecutarlo)* |
| **Global** | **≈5.4/10 (apto testnet)** | **≈7.8/10 (apto soft-launch; mainnet tras checklist)** |

**Veredicto:** listo para **soft-launch / mainnet limitada**. El salto a mainnet
plena queda condicionado a ejecutar el *Production checklist* (auditoría externa de
contratos, bug bounty, Gnosis Safe 3/5 como owner, monitoreo y backups) — items que
dependen de terceros y de infraestructura productiva, no de código.
