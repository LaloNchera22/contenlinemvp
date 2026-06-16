'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { CONTRACTS, ERC20_ABI, PAYMENT_WRITE_ABI } from '@/lib/contracts';

// Misma convención que ContenlinePayment.sol: 0=course, 1=service, 2=onchain.
const CATEGORY_INDEX: Record<string, number> = { course: 0, service: 1, onchain: 2 };

export default function CheckoutClient({
  sessionId,
  creatorWallet,
  amountUsdc,
  category,
}: {
  sessionId: string;
  creatorWallet: string;
  amountUsdc: number;
  category: string;
}) {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [status, setStatus] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!publicClient) {
      setStatus('No hay conexión con la red.');
      return;
    }
    if (!CONTRACTS.payment) {
      setStatus('Contrato de pagos no configurado.');
      return;
    }
    const categoryIndex = CATEGORY_INDEX[category];
    if (categoryIndex === undefined) {
      setStatus('Categoría de pago no soportada.');
      return;
    }
    setBusy(true);
    try {
      const amountRaw = BigInt(Math.round(amountUsdc * 1e6));

      // 1. Aprobar USDC al contrato de pagos.
      setStatus('Aprueba el gasto de USDC en tu wallet…');
      const approveHash = await writeContractAsync({
        address: CONTRACTS.usdc,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.payment, amountRaw],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // 2. Pagar.
      setStatus('Confirma el pago en tu wallet…');
      const txHash = await writeContractAsync({
        address: CONTRACTS.payment,
        abi: PAYMENT_WRITE_ABI,
        functionName: 'pay',
        args: [creatorWallet as `0x${string}`, sessionId, categoryIndex, amountRaw],
      });
      setStatus('Esperando confirmación onchain…');
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      // 3. Confirmar en el backend.
      const res = await fetch('/api/transactions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.error ?? 'El pago se hizo onchain pero falló la confirmación.');
        return;
      }
      setDone(true);
      setStatus('¡Pago completado! 🎉');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error en la transacción';
      setStatus(/user rejected|denied/i.test(msg) ? 'Cancelaste la transacción.' : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      {!isConnected ? (
        <ConnectButton label="Conecta tu wallet para pagar" />
      ) : (
        <button onClick={pay} disabled={busy || done} className="btn-primary w-full">
          {done ? 'Pagado ✓' : busy ? 'Procesando…' : `Pagar $${amountUsdc.toFixed(2)} USDC`}
        </button>
      )}
      {status && (
        <p className="mt-3 text-xs text-white/70" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}
