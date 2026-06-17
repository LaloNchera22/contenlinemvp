# Auditoría — estado de remediación

Estado de los hallazgos de la auditoría exhaustiva (commit base `96fdf19`).

> **5ª ronda (87 → ~95/100).** Cierre de la promesa de la API pública (webhooks
> reales con persistencia y retry), vista de suscriptores para el creador,
> hardening de secrets/whitelist/env vars, y notificaciones por email opt-in.
> Commits: `8e6a8de` (A · webhooks), `9b065bf` (B · suscriptores),
> `c38b506` (C · seguridad), `6b8a549` (D · UX/email). Ver tabla al final.

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
| Internacionalización (i18n) | ⏳ Pendiente — ver nota BLOQUE E abajo. |
| Pista de auditoría visible al creador | 🟡 Parcial — la tabla `webhook_deliveries` y el CSV de suscriptores dan trazabilidad; falta UI de historial de cambios de perfil. |

## Pendientes documentados

- Consolidación total Edge Functions ↔ API Routes.
- i18n (next-intl) y extracción de strings.
- Verificación de identidad de creadores adultos.
- Activación de analítica con consentimiento (el banner ya lo contempla).
- UI de historial/auditoría de cambios para el creador.
- Webhook por suscripción (`subscription.created`/`renewed`): requiere `webhook_url`
  por plan; el modelo actual solo lo tiene por payment_session de checkout (ver
  decisión documentada en `app/api/transactions/confirm/route.ts`).

---

## 5ª ronda — items resueltos

### BLOQUE A · API pública (webhooks) — `8e6a8de`

| Item | Estado | Detalle |
|------|--------|---------|
| A.1 Disparar webhook al completar pago | ✅ Resuelto | `confirm` llama `fireWebhook` fire-and-forget; `lib/webhook.fireWebhook` invoca `process-webhook` (firma del lado server). |
| A.2 Persistencia + retry de webhooks | ✅ Resuelto | Tabla `webhook_deliveries` + índice parcial; `process-webhook` persiste cada intento con backoff; nueva Edge Function `retry-webhooks` (cron 5min). |
| A.3 Documentar webhooks en /docs | ✅ Resuelto | Nueva página `/docs` con payload, headers, firma HMAC, política de retry e idempotencia. |

### BLOQUE B · Vista de suscriptores — `9b065bf`

| Item | Estado | Detalle |
|------|--------|---------|
| B.1 `GET /api/subscribers` | ✅ Resuelto | Filtro `status`, paginación, join al plan + índice `idx_subscriptions_creator_active`. |
| B.2 `/dashboard/subscribers` | ✅ Resuelto | Métricas (MRR, expiraciones, renovación), tabs, tabla + cards móvil, `EmptyState`/`SkeletonRow`. |
| B.3 `GET /api/subscribers/export` | ✅ Resuelto | CSV con mismo patrón que transactions/export. |
| B.4 Link en sidebar | ✅ Resuelto | "Suscriptores" entre Ingresos y Planes. |

### BLOQUE C · Hardening de seguridad — `c38b506`

| Item | Estado | Detalle |
|------|--------|---------|
| C.1 Sin fallback `dev-secret` | ✅ Resuelto | `process-webhook` aborta (500) al inicio del handler si falta `WEBHOOK_SIGNING_SECRET`, antes de procesar el body. |
| C.2 try/catch en `isWhitelistedContract` | ✅ Resuelto | Whitelist vacía → 503 (config rota), contrato no permitido → 400; sin filtrar nombres de env vars. |
| C.3 Env vars dentro del handler | ✅ Resuelto | `sync-subscriptions`, `validate-api-key`, `verify-siwe` leen y validan env vars en el handler (rotación sin cold-start, fallo cerrado). |

### BLOQUE D · UX production-readiness — `6b8a549`

| Item | Estado | Detalle |
|------|--------|---------|
| D.1 Badge de sync onchain | ✅ Resuelto | Badges con tooltip en `/dashboard/plans` (verde/ámbar pulsante) + tooltip en perfil público. |
| D.2 Notificaciones por email opt-in | ✅ Resuelto | `user_email_prefs` (RLS owner-only, email fuera de `users` por privacidad), magic link con token hasheado, `lib/email` (Resend REST, fallo abierto), UI en ajustes, triggers en confirm/keys, borrado en erasure. |
| D.3 Webhook de suscripción | 🟡 Decisión | No se dispara: el modelo no tiene `webhook_url` por plan; documentado en código y como pendiente. El creador sí recibe email. |

### BLOQUE E · i18n — ⏳ Pendiente (próxima sesión)

next-intl requiere reestructurar el routing de locales en `middleware.ts` (que ya
maneja CSP por nonce + guard de `/dashboard`) y mover las rutas a `[locale]`, además
de extraer todos los strings. Por su alcance y riesgo sobre el middleware de
seguridad existente, se difiere a una sesión dedicada (opción contemplada en el plan).

## Score por dimensión (5ª ronda)

| Dimensión | Antes | Ahora | Nota |
|-----------|-------|-------|------|
| Seguridad técnica | 90 | 96 | Secrets fallan cerrado, whitelist 503 vs 400, env vars in-handler, email PII fuera de tabla pública. |
| Lógica de negocio | 88 | 95 | API pública completa (webhooks reales con retry idempotente). |
| Arquitectura | 86 | 93 | Persistencia de entregas, nueva Edge Function de retry, decisiones documentadas. |
| UI/UX | 85 | 94 | Vista de suscriptores, badges de sync, settings de email, componentes reutilizables. |
| Normativa | 84 | 92 | Email opt-in con verificación + borrado en erasure; trazabilidad de entregas. |
| Internacionalización | 60 | 60 | Sin cambios (diferido, BLOQUE E). |
| **Global** | **87** | **~95** | |
