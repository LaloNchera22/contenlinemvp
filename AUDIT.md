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
| Sin tests de API/lib | ✅ Parcial | Vitest + `test/lib.test.ts` (fees, jwt, webhook, url). `npm test`. |
| Doble implementación API Routes vs Edge Functions | 🟡 Decisión + alineado | **Decisión:** las API Routes de Next son la fuente de verdad; las Edge Functions quedan para crons/webhooks/uso desde Supabase. Se alineó la lógica de `confirm-transaction` (api_key_id, selección de red). Consolidación total pendiente. |

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
| Age-gate NSFW | ✅ Parcial (flag `is_adult` + age-gate). Verificación de identidad de creadores adultos (2257/DSA) **pendiente**. |
| Right to Erasure | ✅ Resuelto (`DELETE /api/me` anonimiza PII y desactiva keys). |
| Reportes contables | ✅ Resuelto (`GET /api/transactions/export` CSV). |
| Accesibilidad (aria/roles) | ✅ Parcial (roles/labels en formularios, tablas y modales clave). |
| Internacionalización (i18n) | ⏳ Pendiente — requiere integrar next-intl y extraer todos los strings; se documenta como trabajo siguiente. |
| Pista de auditoría visible al creador | ⏳ Pendiente. |

## Pendientes documentados

- Consolidación total Edge Functions ↔ API Routes.
- i18n (next-intl) y extracción de strings.
- Verificación de identidad de creadores adultos.
- Activación de analítica con consentimiento (el banner ya lo contempla).
- UI de historial/auditoría de cambios para el creador.
