'use client';

import { useEffect, useState } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CONTRACTS, SUBSCRIPTION_ADMIN_ABI } from '@/lib/contracts';
import ConfirmDialog from '@/app/components/ConfirmDialog';

interface Plan {
  id: string;
  name: string;
  price_usdc: number;
  interval: 'monthly' | 'yearly';
  description: string | null;
  active: boolean;
  onchain_plan_id: number;
  onchain_synced: boolean;
}

// Duración en días que pasamos a setPlan() según el intervalo. El contrato cobra
// por periodo, así que estos valores definen cuánto dura la suscripción onchain.
const DURATION_DAYS: Record<Plan['interval'], number> = { monthly: 30, yearly: 365 };

const EMPTY_FORM = { name: '', price: '', interval: 'monthly' as Plan['interval'], description: '' };

export default function PlansPage() {
  const { isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<Plan | null>(null);

  async function load() {
    const r = await fetch('/api/plans');
    if (r.ok) {
      const d = await r.json();
      setPlans(d.plans ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Llama setPlan() onchain. El contrato es la fuente de verdad del precio que se
  // cobra al suscriptor; sin esta tx el plan vive en DB pero nadie puede suscribirse.
  async function syncOnchain(p: { onchain_plan_id: number; price_usdc: number; interval: Plan['interval'] }, active: boolean) {
    if (!publicClient) throw new Error('No hay conexión con la red.');
    if (!CONTRACTS.subscription) throw new Error('Contrato de suscripciones no configurado.');
    const priceRaw = BigInt(Math.round(p.price_usdc * 1e6));
    const txHash = await writeContractAsync({
      address: CONTRACTS.subscription,
      abi: SUBSCRIPTION_ADMIN_ABI,
      functionName: 'setPlan',
      args: [BigInt(p.onchain_plan_id), priceRaw, BigInt(DURATION_DAYS[p.interval]), active],
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function submit() {
    setError(null);
    setStatus(null);
    const price = Number(form.price);
    if (form.name.trim().length < 3) return setError('El nombre debe tener al menos 3 caracteres.');
    if (!Number.isFinite(price) || price <= 0) return setError('El precio debe ser mayor a 0.');

    setBusy(true);
    try {
      // 1. Persistir en DB (Postgres asigna onchain_plan_id).
      const url = editingId ? `/api/plans/${editingId}` : '/api/plans';
      const method = editingId ? 'PUT' : 'POST';
      setStatus('Guardando plan…');
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          price_usdc: price,
          interval: form.interval,
          description: form.description || undefined,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || 'No se pudo guardar el plan.');
        return;
      }
      const plan: Plan = d.plan;

      // 2. Registrar/actualizar el plan onchain con el id que asignó la DB.
      setStatus('Confirma el plan en tu wallet…');
      await syncOnchain(plan, true);
      setStatus('Sincronizando… (el plan estará activo en unos minutos)');
      resetForm();
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error en la transacción';
      setError(/user rejected|denied/i.test(msg) ? 'Cancelaste la transacción.' : msg);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: Plan) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      price: String(p.price_usdc),
      interval: p.interval,
      description: p.description ?? '',
    });
    setError(null);
    setStatus(null);
  }

  async function confirmDeactivate() {
    if (!toDeactivate) return;
    const plan = toDeactivate;
    setToDeactivate(null);
    setBusy(true);
    setError(null);
    try {
      setStatus('Desactivando plan…');
      const r = await fetch(`/api/plans/${plan.id}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error || 'No se pudo desactivar el plan.');
        return;
      }
      // Desactivar también onchain para que el contrato deje de aceptar suscripciones.
      setStatus('Confirma la desactivación en tu wallet…');
      await syncOnchain(plan, false);
      setStatus('Plan desactivado.');
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error en la transacción';
      setError(/user rejected|denied/i.test(msg) ? 'Cancelaste la transacción.' : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Planes de suscripción</h1>
      <p className="text-white/60 text-sm mt-1">
        Define precio y periodicidad. El plan vive onchain: tras crearlo confirma la
        transacción en tu wallet para que tus fans puedan suscribirse.
      </p>

      {!isConnected && (
        <div className="card mt-6">
          <p className="text-sm text-white/70 mb-3">
            Conecta tu wallet para registrar planes onchain.
          </p>
          <ConnectButton label="Conecta tu wallet" />
        </div>
      )}

      <div className="card mt-6 space-y-4">
        <h2 className="font-semibold">{editingId ? 'Editar plan' : 'Nuevo plan'}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="p-name">Nombre</label>
            <input id="p-name" className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acceso VIP" />
          </div>
          <div>
            <label className="label" htmlFor="p-price">Precio (USDC)</label>
            <input id="p-price" className="input" type="number" min="0" step="0.01" value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="9.99" />
          </div>
          <div>
            <label className="label" htmlFor="p-interval">Periodicidad</label>
            <select id="p-interval" className="input" value={form.interval}
              onChange={(e) => setForm({ ...form, interval: e.target.value as Plan['interval'] })}>
              <option value="monthly">Mensual</option>
              <option value="yearly">Anual</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-desc">Descripción (opcional)</label>
            <textarea id="p-desc" className="input min-h-[80px]" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={submit} disabled={busy || !isConnected} className="btn-primary">
            {busy ? 'Procesando…' : editingId ? 'Guardar cambios' : 'Crear plan'}
          </button>
          {editingId && (
            <button onClick={resetForm} disabled={busy} className="btn-ghost">Cancelar</button>
          )}
        </div>
        {status && <p className="text-sm text-white/70" role="status" aria-live="polite">{status}</p>}
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="text-sm text-white/60">Cargando planes…</p>
        ) : plans.length === 0 ? (
          <div className="card text-center py-10">
            <p className="font-medium">Aún no tienes planes</p>
            <p className="text-sm text-white/60 mt-1">
              Define tu primer plan para empezar a recibir suscripciones.
            </p>
          </div>
        ) : (
          plans.map((p) => (
            <div key={p.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {p.name}{' '}
                  <span className="text-xs text-white/60">
                    (${Number(p.price_usdc).toFixed(2)} USDC / {p.interval === 'monthly' ? 'mes' : 'año'})
                  </span>
                </p>
                <p className="text-xs mt-1" role="status" aria-live="polite">
                  {!p.active ? (
                    <span className="text-white/40">desactivado</span>
                  ) : p.onchain_synced ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-400"
                      title="Plan registrado onchain. Listo para recibir suscripciones."
                    >
                      ✓ Sincronizado
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-400 animate-pulse"
                      title="Esperando confirmación onchain. Esto puede tardar hasta 5 minutos. Refresca la página para actualizar el estado."
                    >
                      ◔ Sincronizando…
                    </span>
                  )}
                </p>
              </div>
              {p.active && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(p)} disabled={busy} className="btn-ghost">Editar</button>
                  <button onClick={() => setToDeactivate(p)} disabled={busy} className="btn-ghost text-red-400">
                    Desactivar
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={toDeactivate !== null}
        title="Desactivar plan"
        danger
        confirmText="Desactivar"
        description={
          <>
            El plan <strong>{toDeactivate?.name}</strong> dejará de aceptar nuevas
            suscripciones (en DB y onchain). Las suscripciones activas se mantienen
            hasta vencer. Esta acción requiere una transacción en tu wallet.
          </>
        }
        onCancel={() => setToDeactivate(null)}
        onConfirm={confirmDeactivate}
      />
    </div>
  );
}
