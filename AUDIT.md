# Auditoría — estado de remediación

Estado de los hallazgos de la auditoría exhaustiva (commit base `96fdf19`).

> **7ª ronda — auditoría UI/UX + SEO internacional.**
> Rediseño del sistema visual (paleta y componentes estilo Supabase: acento
> verde sobre grises neutros, landing de dos columnas con cards de producto) y
> SEO de startup internacional: landing multilenguaje es/en/pt con hreflang,
> sitemap/robots/manifest, Open Graph con imagen generada, JSON-LD y metadata
> por perfil de creador. Ver tabla "7ª ronda" al final.

> **6ª ronda — auditoría pre-lanzamiento (seguridad, arquitectura y operaciones).**
> Ver tabla "6ª ronda" al final: bypass de comisión en confirm, robo de contenido
> exclusivo vía media_url, binding EIP-4361 del mensaje SIWE, migración
> Mumbai→Amoy, build reproducible sin env vars, índice único de suscripciones,
> eliminación de Edge Functions duplicadas, CI y reducción de vulnerabilidades npm.

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

---

## 6ª ronda — auditoría pre-lanzamiento (clientes)

### 🔒 Seguridad

| Hallazgo | Severidad | Estado | Detalle |
|----------|-----------|--------|---------|
| Bypass de comisión en `confirm`: el pagador elige `category` en `pay()` y cada categoría tiene fee distinto (course 10% vs onchain/service 3%); una sesión de curso podía saldarse declarando `onchain` y la plataforma cobraba 3% | Alta | ✅ Resuelto | `confirm` valida que la categoría del evento coincida con `payment_sessions.category` (400 si difiere). |
| Robo de contenido exclusivo: un creador podía registrar en `media_url` la ruta de storage de OTRO creador y obtener signed URLs de su contenido | Alta | ✅ Resuelto | `POST /api/content` exige prefijo `<user_id>/` (el que asigna `/api/upload`) y sin `..`; `/api/content/[id]/url` re-verifica el prefijo contra `content.creator_id` (cubre filas antiguas). |
| Mensaje SIWE sin binding de dominio/address/chain: una web maliciosa podía pedir un nonce para la wallet de la víctima, hacerle firmar el texto genérico en otro contexto y usar la firma para iniciar sesión aquí | Media-alta | ✅ Resuelto | `buildSiweMessage` incluye dominio (de `NEXT_PUBLIC_APP_URL`), address y chain id (espíritu EIP-4361); el backend los fija server-side al reconstruir el mensaje. |
| Edge Function `verify-siwe` duplicada reintroducía el username predecible (vulnerabilidad de squatting ya corregida en la API route) y hardcodeaba mainnet; `validate-api-key` duplicaba `lib/validateApiKey` | Media | ✅ Resuelto | Ambas eliminadas. Consolidación conforme a la decisión de la 4ª ronda: las API Routes son la fuente de verdad; las Edge Functions quedan solo para crons/webhooks. |
| Duplicados en `subscriptions` bajo confirmaciones concurrentes (lookup-then-insert) inflaban métricas y lista de suscriptores | Media | ✅ Resuelto | Índice único `(creator_id, lower(subscriber_wallet))` con dedupe previo idempotente en `schema.sql`; `confirm` maneja el conflicto 23505 como renovación. |
| 27 vulnerabilidades npm en producción (5 high, cadena WalletConnect/@reown + ws + lodash + next) | Media | 🟡 Parcial (27→12) | `npm audit fix` + update de rainbowkit/wagmi/viem dentro de semver + override `ws@^8.21.0`. Restan 2 high sin fix no-breaking: Next 14 (DoS; el fix requiere migrar a Next 15/16) y lodash transitivo. Documentado como deuda: planificar upgrade de Next en sesión dedicada. |

### 🏗 Arquitectura

| Hallazgo | Estado | Detalle |
|----------|--------|---------|
| Testnet Mumbai (80001) apagada por Polygon en abril de 2024 seguía referenciada en `lib/chain.ts`, `lib/wagmi.ts`, `hardhat.config.ts`, `.env.example` y README: todo el flujo de testnet estaba roto | ✅ Resuelto | Migración completa a Amoy (80002): `POLYGON_AMOY_RPC_URL`, red `amoy` en hardhat, script `hardhat:deploy:amoy`. |
| `sync-subscriptions` hardcodeaba Polygon mainnet: en un despliegue de testnet consultaba el contrato en la red equivocada y desactivaba suscripciones válidas | ✅ Resuelto | Red y RPC por `CHAIN_ID`, mismo criterio que `sync-plans-onchain` y `lib/chain.ts`. |
| `sync-plans-onchain` usaba `POLYGON_RPC_URL` para ambas redes | ✅ Resuelto | RPC seleccionado por `CHAIN_ID` (`getRpcUrl`). |
| wagmi exponía Polygon y Mumbai a la vez: el usuario podía transaccionar en una red distinta a la que valida el backend | ✅ Resuelto | Una sola cadena decidida por `NEXT_PUBLIC_CHAIN_ID`. |

### ⚙️ Operaciones

| Hallazgo | Estado | Detalle |
|----------|--------|---------|
| `next build` fallaba sin env vars ("supabaseUrl is required" al prerender `/` y `/dashboard/settings`): builds no reproducibles y CI imposible | ✅ Resuelto | `lib/supabase/client.ts` instancia el cliente browser de forma lazy (`getSupabaseBrowser()`); el prerender ya no ejecuta `createClient`. |
| Sin CI: nada garantizaba que main compilara ni que los tests pasaran antes de mergear | ✅ Resuelto | `.github/workflows/ci.yml` (typecheck + tests + build en cada push/PR). |

### Deuda documentada (6ª ronda)

- Upgrade a Next 15/16 para cerrar los advisories DoS de Next 14 (breaking: APIs async de `cookies()`/`headers()`; sesión dedicada).
- i18n (BLOQUE E), verificación de identidad de creadores adultos y demás pendientes de rondas previas siguen vigentes.

---

## 7ª ronda — auditoría UI/UX + SEO internacional

### 🎨 UI/UX (objetivo: sistema visual tipo Supabase)

| Hallazgo | Estado | Detalle |
|----------|--------|---------|
| Identidad visual genérica (violeta `#7c3aed` sobre `#0b0b12`) sin sistema coherente | ✅ Resuelto | Paleta estilo Supabase en `tailwind.config.ts`: acento verde (`#3ECF8E` / `#24B47E` / `#006239`) sobre grises neutros (`#121212` fondo, `#1C1C1C` cards, `#2E2E2E` bordes). Los tokens (`brand`, `surface`) se conservan, por lo que todo el dashboard hereda el restyle sin tocar cada página. |
| Landing centrada de una columna, sin jerarquía ni prueba de producto | ✅ Resuelto | `app/components/landing/Landing.tsx`: header sticky con navegación, hero de dos columnas (titular con segunda línea en verde + párrafo a la derecha, como Supabase), CTAs primario/secundario, 3 cards de producto con icono y checklist ✓, banda de infraestructura (USDC·Polygon / SIWE / Supabase / Webhooks) y footer con switcher de idioma. |
| `bg-brand text-white` perdía contraste WCAG con el nuevo verde claro (tabs, nav activa, pasos) | ✅ Resuelto | Botón primario ahora usa verde oscuro `#006239` con borde `brand-dim` (blanco AA); nav activa del dashboard usa `bg-brand-dark/30 text-brand`; el círculo de pasos usa texto oscuro sobre verde. |
| Botones/inputs sin estados de foco visibles (accesibilidad teclado) | ✅ Resuelto | `.btn` añade `focus-visible:outline-brand`; `.input` añade `focus:ring-brand/40`. |
| Modal de RainbowKit seguía en violeta, desalineado de la marca | ✅ Resuelto | `accentColor: '#006239'` en `providers.tsx`. |

### 🔍 SEO internacional

| Hallazgo | Estado | Detalle |
|----------|--------|---------|
| Sitio solo en español, sin señal alguna de idioma para buscadores (cerraba la deuda "i18n BLOQUE E" para las páginas públicas) | ✅ Resuelto | Landing multilenguaje es/en/pt (`lib/i18n.ts` con diccionarios tipados; rutas `/`, `/en`, `/pt`) con `alternates.languages` (hreflang recíproco + `x-default`) en metadata y sitemap. El `lang` del `<html>` se fija por ruta (middleware inyecta `x-pathname`). |
| Sin `metadataBase`, canonical, Open Graph ni Twitter Card: los enlaces compartidos se renderizaban sin preview | ✅ Resuelto | `lib/seo.ts` centraliza `siteUrl()` (de `NEXT_PUBLIC_APP_URL`) y `landingMetadata(locale)`; layout raíz define `metadataBase`, `title.template` y robots de Google. `app/opengraph-image.tsx` genera la imagen OG 1200×630 en runtime (sin binarios en el repo). |
| Sin `sitemap.xml` ni `robots.txt` | ✅ Resuelto | `app/sitemap.ts` (landing por idioma con alternates xhtml, páginas públicas y perfiles de creadores desde Supabase con fallo tolerante; excluye perfiles adultos) y `app/robots.ts` (disallow `/dashboard`, `/checkout/`, `/api/` + referencia al sitemap). |
| Rutas privadas/transaccionales indexables | ✅ Resuelto | Middleware añade `X-Robots-Tag: noindex, nofollow` a `/dashboard`, `/checkout` y `/api`. |
| Perfiles públicos `/[username]` sin metadata: todos compartían el título global | ✅ Resuelto | `generateMetadata` por creador (título, bio, canonical, OG `profile` con avatar; `cache()` deduplica la query con el render). Perfiles adultos: `noindex` + `rating: adult`. |
| Sin datos estructurados | ✅ Resuelto | JSON-LD (`Organization` + `WebSite` + `SoftwareApplication`) en la landing, con el nonce CSP del middleware. |

### Verificación

`typecheck`, `build` y arranque en producción OK; verificado con render real:
hreflang/canonical/OG en `/` y `/en`, `robots.txt`, `sitemap.xml`,
`X-Robots-Tag` en rutas privadas y screenshot de la landing en es/en.

### Deuda documentada (7ª ronda)

- El dashboard sigue solo en español (privado, sin impacto SEO); extender los diccionarios si se quiere UI multilenguaje completa.
- Añadir favicon/íconos PWA reales (el manifest declara `icons: []`).
- Al usar dominio definitivo, dar de alta la propiedad en Google Search Console y enviar el sitemap.
