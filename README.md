# AdieCoin

**The stablecoin wallet for creators.** Every user gets an internal balance in
**AUSD** — AdieCoin's unit of account, pegged 1:1 to deposited USDC. Fund it once
on-chain and everything after that settles instantly off-chain against that
balance — and withdrawable back to USDC anytime.

Three things a creator can do with it:

- **Recurring subscriptions** — fans subscribe once and renewals are auto-charged
  from their AUSD balance (no signing every month).
- **Content, courses & services** — exclusive content gated by an active
  subscription; one-off sales settled from balance.
- **Fan challenges** — a fan authors a paid challenge/commission and sends it to a
  creator, staking AUSD in escrow; the creator accepts and delivers to release the
  funds (net of fee), or declines to refund the fan.

There's also a **Stripe-style payments API** for developers (Bearer `sk_*`, signed
HMAC webhooks) for embedding checkouts in their own apps.

Passwordless auth via **SIWE** (Sign-In With Ethereum). The product is
**English-first** with `/es` and `/pt` locales (hreflang + localized SEO).

## Payment model — internal AUSD ledger

The core is an off-chain, double-entry-style ledger (Polymarket-style balances):

| Table | Purpose |
|-------|---------|
| `wallets` | one AUSD balance per user (never written directly by clients) |
| `ledger_entries` | append-only, signed movements + `balance_after` snapshot |
| `deposits` | on-chain USDC deposits that funded a balance (idempotent by `tx_hash`) |
| `challenges` | fan-authored challenges with escrowed stake + lifecycle |

On-chain is used **only as the on-ramp**: a USDC transfer to the AdieCoin treasury
(`NEXT_PUBLIC_ADIECOIN_TREASURY`) is verified in `/api/wallet/deposit` and credited
1:1 as AUSD. Every balance mutation goes through `SECURITY DEFINER` Postgres
functions (`ausd_deposit`, `challenge_open`, `challenge_act`) that hold a per-user
advisory lock, so concurrent debits can never race the balance negative. See
`supabase/ledger.sql`.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Ledger | Postgres (advisory-locked SECURITY DEFINER functions) |
| Web3 | Wagmi v2 + Viem + RainbowKit + SIWE |
| Blockchain | Polygon — USDC deposit on-ramp, Solidity contracts w/ Hardhat |
| Email | Resend (opcional, vía REST; notificaciones transaccionales) |

## Estructura

```
app/                     # Next.js App Router (UI + API routes)
  api/auth/              # nonce / verify / logout (SIWE)
  api/{me,metrics,...}   # dashboard
  api/keys/              # CRUD de API keys (hashing SHA-256)
  api/content/[id]/url/  # signed URLs para contenido exclusivo
  api/transactions/      # listado + confirm onchain
  api/v1/                # API pública para developers (Bearer sk_*)
  dashboard/             # panel del creador (sidebar)
  [username]/            # perfil público + suscripción
lib/                     # fees, siwe, jwt, apiKeys, supabase clients, contracts
contracts/               # AdieCoinSubscription.sol, AdieCoinPayment.sol
supabase/
  schema.sql             # tablas + RLS + funciones
  storage.sql            # buckets (public / exclusive / course)
  functions/             # Edge Functions (Deno)
scripts/deploy.ts        # deploy Hardhat
test/                    # tests de contratos
```

## Setup

1. **Variables de entorno** — copia `.env.example` a `.env.local` y rellena.
2. **Base de datos** — en el SQL editor de Supabase ejecuta `supabase/schema.sql`, luego `supabase/ledger.sql` (wallets + ledger + retiros + challenges), `supabase/compliance.sql` (KYC/AML + screening de sanciones) y por último `supabase/storage.sql`.
3. **Dependencias** — `npm install`.
4. **Dev** — `npm run dev`.

### Smart contracts

```bash
npm run hardhat:compile
npm run hardhat:test
npm run hardhat:deploy:amoy     # testnet primero (Amoy; Mumbai fue apagada en 2024)
```

Copia las direcciones desplegadas a `NEXT_PUBLIC_CONTRACT_SUBSCRIPTION` y `NEXT_PUBLIC_CONTRACT_PAYMENT`.

### Edge Functions

Las API Routes de Next son la fuente de verdad de la lógica de negocio (incluida
la confirmación de transacciones en `/api/transactions/confirm`). Las Edge
Functions quedan reservadas para crons y webhooks invocados desde Supabase:

```bash
supabase functions deploy sync-subscriptions   # cron: 0 * * * *
supabase functions deploy sync-plans-onchain    # cron: */5 * * * *  (fallback del webhook PlanSet)
supabase functions deploy process-webhook       # entrega webhooks firmados (HMAC)
supabase functions deploy retry-webhooks        # cron: */5 * * * *  (reintenta entregas fallidas)
```

`process-webhook` requiere el secret `WEBHOOK_SIGNING_SECRET` (firma HMAC-SHA256);
sin él aborta (fallo cerrado). Los reintentos usan backoff exponencial (máx. 5
intentos) y se persisten en la tabla `webhook_deliveries`. La documentación pública
para developers está en `/docs`.

## Seguridad implementada

1. **SIWE** — nonce de un solo uso (5 min) en DB, firma verificada con `viem.verifyMessage`, JWT con claim `wallet`.
2. **RLS** en todas las tablas (ver `schema.sql`).
3. **Validación onchain** — `/api/transactions/confirm` verifica status, whitelist de contratos, evento e idempotencia por `tx_hash`.
4. **API keys hasheadas** (SHA-256), prefix en claro, key completa visible una sola vez, rate limit 100/min + auditoría de uso.
5. **Signed URLs** (15 min) para contenido exclusivo en bucket privado; solo si RLS confirma acceso.
6. **Headers de seguridad** (CSP, X-Frame-Options, etc.) en `next.config.js`.

## Modelo de comisiones

Definido en `lib/fees.ts` y replicado en los contratos:

| Categoría | Fee |
|-----------|-----|
| subscription | 10% |
| course | 10% |
| service | 3% |
| onchain | 3% |
| challenge | 5% |

## API pública (developers)

Documentación en [`/docs`](app/docs/page.tsx): autenticación con API keys, creación
de checkouts (`POST /api/v1/checkout`), consulta de sesiones y **webhooks firmados**
(HMAC-SHA256, eventos `payment.completed`/`failed`/`subscription.created`/`renewed`,
política de reintentos con backoff e idempotencia por `event.id`).

## Production-readiness

Tras la 5ª ronda de remediación (ver `AUDIT.md`), el proyecto está en **~95/100**:
API pública completa (webhooks reales con retry), vista de suscriptores para el
creador, notificaciones por email opt-in y hardening de secrets/whitelist/env vars.
Pendiente principal: internacionalización (i18n con next-intl) y verificación de
identidad de creadores adultos.
