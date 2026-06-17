'use client';

import { useEffect, useState } from 'react';
import ConfirmDialog from '@/app/components/ConfirmDialog';
import EmptyState from '@/app/components/EmptyState';
import { SkeletonRow } from '@/app/components/Skeleton';

interface Service {
  id: string;
  title: string;
  description: string | null;
  price_usdc: number;
  active: boolean;
}

const EMPTY_FORM = { title: '', description: '', price: '' };

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Service | null>(null);

  async function load() {
    const r = await fetch('/api/services');
    if (r.ok) setServices((await r.json()).services ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function submit() {
    setError(null);
    const price = Number(form.price);
    if (form.title.trim().length < 3) return setError('El título debe tener al menos 3 caracteres.');
    if (!Number.isFinite(price) || price <= 0) return setError('El precio debe ser mayor a 0.');
    setBusy(true);
    try {
      const url = editingId ? `/api/services/${editingId}` : '/api/services';
      const r = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description || undefined, price_usdc: price }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setError(d.error || 'No se pudo guardar el servicio.');
      resetForm();
      load();
    } catch {
      setError('Error de red al guardar el servicio.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setForm({ title: s.title, description: s.description ?? '', price: String(s.price_usdc) });
    setError(null);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    setToDelete(null);
    setBusy(true);
    await fetch(`/api/services/${id}`, { method: 'DELETE' });
    await load();
    setBusy(false);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Servicios</h1>
      <p className="text-white/60 text-sm mt-1">Ofrece servicios puntuales (consultorías, sesiones, etc.).</p>

      <div className="card mt-6 space-y-4">
        <h2 className="font-semibold">{editingId ? 'Editar servicio' : 'Nuevo servicio'}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="s-title">Título</label>
            <input id="s-title" className="input" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="s-price">Precio (USDC)</label>
            <input id="s-price" className="input" type="number" min="0" step="0.01" value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="s-desc">Descripción (opcional)</label>
            <textarea id="s-desc" className="input min-h-[80px]" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? 'Procesando…' : editingId ? 'Guardar cambios' : 'Crear servicio'}
          </button>
          {editingId && <button onClick={resetForm} disabled={busy} className="btn-ghost">Cancelar</button>}
        </div>
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          <div className="space-y-2" role="status" aria-label="Cargando servicios">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : services.length === 0 ? (
          <EmptyState
            title="Aún no tienes servicios"
            description="Crea tu primer servicio para ofrecerlo a tu audiencia."
            actionLabel="Crear mi primer servicio"
            onAction={() => document.getElementById('s-title')?.focus()}
          />
        ) : (
          services.map((s) => (
            <div key={s.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {s.title}{' '}
                  <span className="text-xs text-white/60">(${Number(s.price_usdc).toFixed(2)} USDC)</span>
                </p>
                {!s.active && <p className="text-xs mt-1 text-white/40">inactivo</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(s)} disabled={busy} className="btn-ghost">Editar</button>
                <button onClick={() => setToDelete(s)} disabled={busy} className="btn-ghost text-red-400">
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar servicio"
        danger
        confirmText="Eliminar"
        description={<>Se eliminará <strong>{toDelete?.title}</strong>. Esta acción no se puede deshacer.</>}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
