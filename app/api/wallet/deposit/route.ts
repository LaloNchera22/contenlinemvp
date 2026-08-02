import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseEventLogs } from 'viem';
import { getSessionFromRequest } from '@/lib/auth';
import { CONTRACTS, ERC20_TRANSFER_EVENT_ABI } from '@/lib/contracts';
import { getChain, getRpcUrl } from '@/lib/chain';
import { checkIpRateLimit, clientIp } from '@/lib/rateLimit';
import { creditDeposit } from '@/lib/ledger';

export const runtime = 'nodejs';

const publicClient = createPublicClient({
  chain: getChain(),
  transport: http(getRpcUrl()),
});

// USDC has 6 decimals; Number(bigint) loses precision above 2^53. Cap the raw
// value before converting (100k USDC in micro-USDC), same guard as confirm.
const MAX_AMOUNT_RAW = 100_000n * 1_000_000n;

/**
 * POST /api/wallet/deposit
 * body: { txHash }
 *
 * Verifies onchain that the AUTHENTICATED user's wallet transferred USDC to the
 * AdieCoin treasury, then credits their internal AUSD balance 1:1. The amount is
 * DERIVED from the onchain Transfer event, never trusted from the caller, and
 * crediting is idempotent by txHash (the ledger function is a no-op on replay).
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const rl = await checkIpRateLimit(clientIp(req), 'deposit', 30, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes; intenta más tarde' }, { status: 429 });
  }

  if (!CONTRACTS.treasury) {
    return NextResponse.json({ error: 'Servicio temporalmente no disponible' }, { status: 503 });
  }

  let body: { txHash?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const txHash = body.txHash as `0x${string}` | undefined;
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return NextResponse.json({ error: 'txHash inválido' }, { status: 400 });
  }

  let receipt;
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  } catch {
    return NextResponse.json({ error: 'Transacción no encontrada en la red' }, { status: 404 });
  }
  if (receipt.status !== 'success') {
    return NextResponse.json({ error: 'La transacción no fue exitosa' }, { status: 400 });
  }

  // Only Transfer logs emitted by the USDC contract count; ignore any other
  // token's Transfer in the same tx.
  const usdcLogs = receipt.logs.filter(
    (log) => log.address.toLowerCase() === CONTRACTS.usdc.toLowerCase(),
  );
  const transfers = parseEventLogs({ abi: ERC20_TRANSFER_EVENT_ABI, logs: usdcLogs });

  // The deposit must come FROM the authenticated user's wallet and go TO the
  // treasury. Binding to session.wallet stops anyone from claiming someone
  // else's on-chain transfer as their own deposit.
  const match = transfers.find((t) => {
    const a = t.args as { from: string; to: string; value: bigint };
    return (
      a.to.toLowerCase() === CONTRACTS.treasury.toLowerCase() &&
      a.from.toLowerCase() === session.wallet.toLowerCase()
    );
  });
  if (!match) {
    return NextResponse.json(
      { error: 'No se encontró un depósito de USDC a la tesorería desde tu wallet' },
      { status: 400 },
    );
  }

  const value = (match.args as { value: bigint }).value;
  if (value <= 0n || value > MAX_AMOUNT_RAW) {
    return NextResponse.json({ error: 'Monto fuera de rango' }, { status: 400 });
  }
  const amountUsdc = Number(value) / 1e6;

  try {
    const balance = await creditDeposit(session.sub, txHash, amountUsdc);
    return NextResponse.json({ ok: true, credited_ausd: amountUsdc, balance_ausd: balance });
  } catch {
    return NextResponse.json({ error: 'No se pudo acreditar el depósito' }, { status: 500 });
  }
}
