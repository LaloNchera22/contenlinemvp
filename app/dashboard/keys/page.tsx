'use client';

import { useEffect, useState } from 'react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  environment: string;
  active: boolean;
  calls_count: number;
  volume_usdc?: number;
  last_used_at: string | null;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<'test' | 'production'>('test');
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    const r = await fetch('/api/keys');
    if (r.ok) {
      const d = await r.json();
      setKeys(d.keys ?? []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    setNewSecret(null);
    try {
      const r = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, environment }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || 'No se pudo crear la key.');
        return;
      }
      setNewSecret(d.secret);
      setCopied(false);
      setName('');
      load();
    } catch {
      setError('Error de red al crear la key.');
    } finally {
      setLoading(false);
    }
  }

  async function copySecret() {
    if (!newSecret) return;
    try {
      await navigator.clipboard.writeText(newSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('No se pudo copiar; selecciona la key manualmente.');
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">API Keys</h1>
      <p className="text-white/60 text-sm mt-1">
        Integra pagos cripto en tu app. La key completa se muestra una sola vez.
      </p>

      <div className="card mt-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="label" htmlFor="key-name">Nombre</label>
            <input
              id="key-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi integración"
            />
          </div>
          <div>
            <label className="label" htmlFor="key-env">Entorno</label>
            <select
              id="key-env"
              className="input"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as 'test' | 'production')}
            >
              <option value="test">test</option>
              <option value="production">production</option>
            </select>
          </div>
          <button onClick={create} disabled={loading} className="btn-primary">
            {loading ? 'Creando…' : 'Crear key'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        {newSecret && (
          <div className="mt-4 rounded-lg border border-brand bg-brand/10 p-3" role="alert">
            <p className="text-xs text-brand-light mb-2">
              Copia esta key ahora — no volverá a mostrarse:
            </p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-sm break-all flex-1">{newSecret}</code>
              <button onClick={copySecret} className="btn-ghost shrink-0">
                {copied ? 'Copiada ✓' : 'Copiar'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium">
                {k.name}{' '}
                <span className="text-xs text-white/60">({k.environment})</span>
              </p>
              <p className="font-mono text-xs text-white/60">
                {k.key_prefix}••••••• · {k.calls_count} llamadas
                {k.volume_usdc != null && ` · $${Number(k.volume_usdc).toFixed(2)} USDC`}
              </p>
            </div>
            {k.active ? (
              <button onClick={() => revoke(k.id)} className="btn-ghost text-red-400">
                Revocar
              </button>
            ) : (
              <span className="text-xs text-white/40">revocada</span>
            )}
          </div>
        ))}
        {keys.length === 0 && (
          <p className="text-sm text-white/60">No tienes keys todavía.</p>
        )}
      </div>
    </div>
  );
}
