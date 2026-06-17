'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { CONTRACTS, ERC20_ABI, PAYMENT_WRITE_ABI } from '@/lib/contracts';
import { useToast } from '@/app/components/Toast';

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
  const toast = useToast();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!publicClient) {
      toast.error('No hay conexión con la red.');
      return;
    }
    if (!CONTRACTS.payment) {
      toast.error('Contrato de pagos no configurado.');
      return;
    }
    const categoryIndex = CATEGORY_INDEX[category];
    if (categoryIndex === undefined) {
      toast.error('Categoría de pago no soportada.');
      return;
    }
    setBusy(true);
    // Toast persistente actualizado por paso; sobrevive al popup de la wallet.
    const id = toast.loading('Aprueba el gasto de USDC en tu wallet…');
    try {
      const amountRaw = BigInt(Math.round(amountUsdc * 1e6));

      // 1. Aprobar USDC al contrato de pagos.
      const approveHash = await writeContractAsync({
        address: CONTRACTS.usdc,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.payment, amountRaw],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // 2. Pagar.
      toast.update(id, 'loading', 'Confirma el pago en tu wallet…');
      const txHash = await writeContractAsync({
        address: CONTRACTS.payment,
        abi: PAYMENT_WRITE_ABI,
        functionName: 'pay',
        args: [creatorWallet as `0x${string}`, sessionId, categoryIndex, amountRaw],
      });
      toast.update(id, 'loading', 'Esperando confirmación onchain…');
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      // 3. Confirmar en el backend.
      const res = await fetch('/api/transactions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.update(id, 'error', data.error ?? 'El pago se hizo onchain pero falló la confirmación.');
        return;
      }
      setDone(true);
      toast.update(id, 'success', '¡Pago completado! 🎉');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error en la transacción';
      toast.update(id, 'error', /user rejected|denied/i.test(msg) ? 'Cancelaste la transacción.' : msg);
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
    </div>
  );
}
