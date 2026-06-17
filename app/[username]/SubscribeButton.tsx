'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { CONTRACTS, ERC20_ABI, SUBSCRIPTION_WRITE_ABI } from '@/lib/contracts';
import { useToast } from '@/app/components/Toast';

/**
 * Botón de suscripción. Dispara el flujo onchain completo:
 *   1) approve de USDC al contrato de suscripciones,
 *   2) subscribe(creator, planId) — el contrato lee el precio del plan onchain,
 *   3) confirma el txHash en el backend, que espeja la suscripción en DB.
 *
 * `onchainPlanId` es el entero del plan onchain (subscription_plans.onchain_plan_id),
 * NO el UUID de Supabase: el contrato espera uint256.
 */
export default function SubscribeButton({
  onchainPlanId,
  creatorWallet,
  priceUsdc,
}: {
  onchainPlanId: number | string;
  creatorWallet: string;
  priceUsdc: number;
}) {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function subscribe() {
    if (!publicClient) {
      toast.error('No hay conexión con la red.');
      return;
    }
    if (!CONTRACTS.subscription) {
      toast.error('Contrato de suscripciones no configurado.');
      return;
    }
    setBusy(true);
    // Toast persistente que vamos actualizando por cada paso. Sobrevive al popup
    // de la wallet (que roba el foco) y mantiene el contexto del flujo multi-tx.
    const id = toast.loading('Aprueba el gasto de USDC en tu wallet…');
    try {
      const amountRaw = BigInt(Math.round(priceUsdc * 1e6)); // USDC, 6 decimales
      const planId = BigInt(onchainPlanId);

      // 1. Aprobar gasto de USDC al contrato de suscripciones.
      const approveHash = await writeContractAsync({
        address: CONTRACTS.usdc,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACTS.subscription, amountRaw],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // 2. Suscribirse (el contrato cobra el precio del plan y reparte el fee).
      toast.update(id, 'loading', 'Confirma la suscripción en tu wallet…');
      const txHash = await writeContractAsync({
        address: CONTRACTS.subscription,
        abi: SUBSCRIPTION_WRITE_ABI,
        functionName: 'subscribe',
        args: [creatorWallet as `0x${string}`, planId],
      });
      toast.update(id, 'loading', 'Esperando confirmación onchain…');
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      // 3. Confirmar en el backend (verifica el evento y espeja en DB).
      const res = await fetch('/api/transactions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.update(id, 'error', data.error ?? 'La suscripción se hizo onchain pero falló la confirmación.');
        return;
      }
      toast.update(id, 'success', '¡Suscripción activa! 🎉');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error en la transacción';
      toast.update(id, 'error', /user rejected|denied/i.test(msg) ? 'Cancelaste la transacción.' : msg);
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="mt-4">
        <ConnectButton label="Conecta tu wallet" />
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button onClick={subscribe} disabled={busy} className="btn-primary w-full">
        {busy ? 'Procesando…' : 'Suscribirme'}
      </button>
    </div>
  );
}
