'use client';

import { useEffect, useState } from 'react';
import ConfirmDialog from '@/app/components/ConfirmDialog';

interface Course {
  id: string;
  title: string;
  description: string | null;
  price_usdc: number;
  published: boolean;
}

const EMPTY_FORM = { title: '', description: '', price: '' };

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Course | null>(null);

  async function load() {
    const r = await fetch('/api/courses');
    if (r.ok) setCourses((await r.json()).courses ?? []);
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
      const url = editingId ? `/api/courses/${editingId}` : '/api/courses';
      const r = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, description: form.description || undefined, price_usdc: price }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setError(d.error || 'No se pudo guardar el curso.');
      resetForm();
      load();
    } catch {
      setError('Error de red al guardar el curso.');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(c: Course) {
    setEditingId(c.id);
    setForm({ title: c.title, description: c.description ?? '', price: String(c.price_usdc) });
    setError(null);
  }

  async function togglePublish(c: Course) {
    setBusy(true);
    await fetch(`/api/courses/${c.id}/publish`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: !c.published }),
    });
    await load();
    setBusy(false);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    setToDelete(null);
    setBusy(true);
    await fetch(`/api/courses/${id}`, { method: 'DELETE' });
    await load();
    setBusy(false);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Cursos</h1>
      <p className="text-white/60 text-sm mt-1">
        Crea cursos y publícalos cuando estén listos para venderse.
      </p>

      <div className="card mt-6 space-y-4">
        <h2 className="font-semibold">{editingId ? 'Editar curso' : 'Nuevo curso'}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="c-title">Título</label>
            <input id="c-title" className="input" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="c-price">Precio (USDC)</label>
            <input id="c-price" className="input" type="number" min="0" step="0.01" value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="c-desc">Descripción (opcional)</label>
            <textarea id="c-desc" className="input min-h-[80px]" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={submit} disabled={busy} className="btn-primary">
            {busy ? 'Procesando…' : editingId ? 'Guardar cambios' : 'Crear curso'}
          </button>
          {editingId && <button onClick={resetForm} disabled={busy} className="btn-ghost">Cancelar</button>}
        </div>
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
      </div>

      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="text-sm text-white/60">Cargando cursos…</p>
        ) : courses.length === 0 ? (
          <div className="card text-center py-10">
            <p className="font-medium">Aún no tienes cursos</p>
            <p className="text-sm text-white/60 mt-1">Crea tu primer curso y publícalo cuando esté listo.</p>
          </div>
        ) : (
          courses.map((c) => (
            <div key={c.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {c.title}{' '}
                  <span className="text-xs text-white/60">(${Number(c.price_usdc).toFixed(2)} USDC)</span>
                </p>
                <p className="text-xs mt-1">
                  {c.published
                    ? <span className="text-emerald-400">● Publicado</span>
                    : <span className="text-white/40">borrador</span>}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => togglePublish(c)} disabled={busy} className="btn-ghost">
                  {c.published ? 'Despublicar' : 'Publicar'}
                </button>
                <button onClick={() => startEdit(c)} disabled={busy} className="btn-ghost">Editar</button>
                <button onClick={() => setToDelete(c)} disabled={busy} className="btn-ghost text-red-400">
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar curso"
        danger
        confirmText="Eliminar"
        description={<>Se eliminará <strong>{toDelete?.title}</strong> junto con sus módulos y lecciones. Esta acción no se puede deshacer.</>}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
