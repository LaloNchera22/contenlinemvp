'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

/**
 * Botón de suscripción. En producción dispara la transacción onchain
 * (ContenlineSubscription.subscribe) y luego confirma el txHash en el backend.
 * Aquí dejamos el flujo cableado al endpoint de confirmación.
 */
export default function SubscribeButton({
  planId,
  creatorWallet,
  priceUsdc,
}: {
  planId: string;
  creatorWallet: string;
  priceUsdc: number;
}) {
  const { isConnected } = useAccount();
  const [status, setStatus] = useState<string | null>(null);

  async function subscribe() {
    setStatus('Abre tu wallet para aprobar USDC y confirmar la suscripción…');
    // TODO: ejecutar writeContract(subscribe) con wagmi, obtener txHash y:
    // await fetch('/api/transactions/confirm', { method:'POST', body: JSON.stringify({ txHash }) })
    setStatus(
      `Flujo de pago para el plan ${planId.slice(0, 8)} (${priceUsdc} USDC → ${creatorWallet.slice(0, 6)}…). Integra writeContract aquí.`,
    );
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
      <button onClick={subscribe} className="btn-primary w-full">
        Suscribirme
      </button>
      {status && <p className="mt-2 text-xs text-white/50">{status}</p>}
    </div>
  );
}
