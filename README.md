# Contenline

Plataforma de **monetización cripto unificada para creadores**. Un solo producto con dos caras:

- **Panel de creador** (tipo OnlyFans): contenido exclusivo, suscripciones, cursos y servicios.
- **Infraestructura de pagos cripto** (tipo Stripe): API keys para que developers integren pagos USDC en sus apps.

Pagos en **USDC sobre Polygon**. Autenticación sin contraseñas vía **SIWE** (Sign-In With Ethereum).

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Web3 | Wagmi v2 + Viem + RainbowKit + SIWE |
| Blockchain | Polygon — contratos Solidity con Hardhat |
| Pagos | USDC en Polygon |

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
contracts/               # ContenlineSubscription.sol, ContenlinePayment.sol
supabase/
  schema.sql             # tablas + RLS + funciones
  storage.sql            # buckets (public / exclusive / course)
  functions/             # Edge Functions (Deno)
scripts/deploy.ts        # deploy Hardhat
test/                    # tests de contratos
```

## Setup

1. **Variables de entorno** — copia `.env.example` a `.env.local` y rellena.
2. **Base de datos** — en el SQL editor de Supabase ejecuta `supabase/schema.sql` y luego `supabase/storage.sql`.
3. **Dependencias** — `npm install`.
4. **Dev** — `npm run dev`.

### Smart contracts

```bash
npm run hardhat:compile
npm run hardhat:test
npm run hardhat:deploy:mumbai   # testnet primero
```

Copia las direcciones desplegadas a `NEXT_PUBLIC_CONTRACT_SUBSCRIPTION` y `NEXT_PUBLIC_CONTRACT_PAYMENT`.

### Edge Functions

```bash
supabase functions deploy verify-siwe
supabase functions deploy validate-api-key
supabase functions deploy confirm-transaction
supabase functions deploy sync-subscriptions   # cron: 0 * * * *
supabase functions deploy process-webhook
```

## Seguridad implementada

1. **SIWE** — nonce de un solo uso (5 min) en DB, firma verificada con `viem.verifyMessage`, JWT con claim `wallet`.
2. **RLS** en todas las tablas (ver `schema.sql`).
3. **Validación onchain** — `confirm-transaction` verifica status, whitelist de contratos, evento e idempotencia por `tx_hash`.
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
