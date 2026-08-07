-- =============================================================
-- AdieCoin — tabla `commissions` (capa de confianza por comisión)
-- Ejecutar en el SQL editor de Supabase DESPUÉS de schema.sql.
--
-- Respalda la página pública /comision/[id]: un artista genera un link único
-- por comisión y se lo pasa a su cliente. La página SOLO comunica confianza y
-- registra la INTENCIÓN de aceptar; NO procesa pagos (ver app/comision/[id]).
-- =============================================================

CREATE TABLE IF NOT EXISTS commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Artista dueño de la comisión. Reutiliza users(id) como el resto de la app.
  artist_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Nombre del cliente TAL COMO lo verá en pantalla. Ver su propio nombre y su
  -- trato es lo que dispara la confianza, así que se guarda literal (texto libre
  -- acotado; se escapa en el render de React, no se interpola en HTML/SQL).
  client_name       TEXT NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 120),
  work_description  TEXT NOT NULL CHECK (char_length(work_description) BETWEEN 1 AND 2000),
  amount            NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  -- Moneda del trato mostrada al cliente (MXN, USD…). Es una etiqueta de UI:
  -- el pago se coordina MANUALMENTE fuera de la app (transferencia/SPEI).
  currency          TEXT NOT NULL DEFAULT 'MXN' CHECK (currency ~ '^[A-Z]{3}$'),
  -- Ciclo de vida de la CONFIANZA, no del dinero:
  --   pending   → link creado, el cliente aún no acepta.
  --   accepted  → el cliente pulsó «Aceptar y coordinar pago» (solo intención).
  --   cancelled → el artista/cliente cancelaron el trato.
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','accepted','cancelled')),
  -- Marca de tiempo de la intención de aceptar (se fija al pulsar el CTA).
  accepted_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Comisiones de un artista, más recientes primero (listado en su panel a futuro).
CREATE INDEX IF NOT EXISTS idx_commissions_artist
  ON commissions (artist_id, created_at DESC);

-- ----------------------------- RLS -----------------------------
-- La página pública se sirve con el cliente admin (service_role) desde el
-- servidor, igual que /checkout; por eso NO hace falta una policy de lectura
-- anónima que expondría el nombre del cliente de TODAS las comisiones. RLS queda
-- en modo restrictivo: solo el artista dueño ve/gestiona las suyas vía sesión.
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artist_manage_commissions" ON commissions
  FOR ALL USING (artist_id = auth.uid());
