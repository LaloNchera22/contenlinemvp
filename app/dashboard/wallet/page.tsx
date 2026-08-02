'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CONTRACTS, ERC20_ABI } from '@/lib/contracts';

interface LedgerEntry {
  id: string;
  entry_type: string;
  amount_ausd: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

const ENTRY_LABEL: Record<string, string> = {
  deposit: 'Depósito',
  withdrawal: 'Retiro',
  subscription_charge: 'Cobro suscripción',
  subscription_payout: 'Ingreso suscripción',
  challenge_stake: 'Reto — stake',
  challenge_payout: 'Reto — pago',
  challenge_refund: 'Reto — reembolso',
  fee: 'Comisión',
};

const fmt = (n: number) =>
  `${n >= 0 ? '+' : ''}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;

export default function WalletPage() {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [balance, setBalance] = useState<number | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const r = await fetch('/api/wallet');
    if (r.ok) {
      const d = await r.json();
      setBalance(Number(d.balance_ausd ?? 0));
      setLedger(d.ledger ?? []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function deposit() {
    setError(null);
    setStatus(null);
    const usdc = Number(amount);
    if (!Number.isFinite(usdc) || usdc <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    if (!publicClient) {
      setError('No hay conexión con la red.');
      return;
    }
    if (!CONTRACTS.treasury) {
      setError('Tesorería no configurada (NEXT_PUBLIC_ADIECOIN_TREASURY).');
      return;
    }
    setBusy(true);
    try {
      const amountRaw = BigInt(Math.round(usdc * 1e6)); // USDC, 6 decimales
      setStatus('Confirma la transferencia de USDC en tu wallet…');
      const txHash = await writeContractAsync({
        address: CONTRACTS.usdc,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [CONTRACTS.treasury, amountRaw],
      });
      setStatus('Esperando confirmación onchain…');
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setStatus('Acreditando tu saldo AUSD…');
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'El depósito onchain se hizo pero falló la acreditación.');
        return;
      }
      setStatus(`¡Depósito acreditado! +${usdc.toFixed(2)} AUSD 🎉`);
      setAmount('');
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error en la transacción';
      setError(/user rejected|denied/i.test(msg) ? 'Cancelaste la transacción.' : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Wallet</h1>
      <p className="mt-1 text-sm text-white/60">
        Tu saldo interno en AUSD. Recarga con USDC en Polygon (1:1) y úsalo para suscripciones y retos.
      </p>

      <section className="card mt-6 flex items-end justify-between p-6">
        <div>
          <p className="label">Saldo disponible</p>
          <p className="mt-1 text-4xl font-bold tracking-tight">
            {balance === null ? '—' : balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
            <span className="ml-2 text-lg font-medium text-brand">AUSD</span>
          </p>
        </div>
      </section>

      <section className="card mt-4 p-6">
        <h2 className="font-semibold">Depositar USDC → AUSD</h2>
        {!isConnected ? (
          <div className="mt-4">
            <ConnectButton label="Conecta tu wallet" />
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="dep-amount">Monto (USDC)</label>
              <input
                id="dep-amount"
                className="input w-40"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={busy}
              />
            </div>
            <button onClick={deposit} disabled={busy} className="btn-primary">
              {busy ? 'Procesando…' : 'Depositar'}
            </button>
          </div>
        )}
        {status && <p className="mt-3 text-xs text-white/70" role="status" aria-live="polite">{status}</p>}
        {error && <p className="mt-3 text-xs text-red-400" role="alert">{error}</p>}
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Movimientos</h2>
        {ledger.length === 0 ? (
          <p className="mt-3 text-sm text-white/50">Aún no hay movimientos.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-white/40">
                <tr>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Detalle</th>
                  <th className="py-2 pr-4 text-right">Monto</th>
                  <th className="py-2 pr-4 text-right">Saldo</th>
                  <th className="py-2 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((e) => (
                  <tr key={e.id} className="border-t border-surface-border">
                    <td className="py-2 pr-4">{ENTRY_LABEL[e.entry_type] ?? e.entry_type}</td>
                    <td className="py-2 pr-4 text-white/60">{e.description ?? '—'}</td>
                    <td className={`py-2 pr-4 text-right font-mono ${Number(e.amount_ausd) >= 0 ? 'text-brand' : 'text-red-400'}`}>
                      {fmt(Number(e.amount_ausd))}
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-white/70">
                      {Number(e.balance_after).toFixed(2)}
                    </td>
                    <td className="py-2 text-right text-white/50">
                      {new Date(e.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
