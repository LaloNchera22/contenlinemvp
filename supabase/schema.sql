-- =============================================================
-- Contenline — esquema completo con RLS
-- Ejecutar en el SQL editor de Supabase.
-- =============================================================

-- ----------------------------- TABLAS -----------------------------

-- Usuarios (wallet como identificador primario)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet        TEXT UNIQUE NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  bio           TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Nonces para SIWE (expiran en 5 min)
CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce         TEXT PRIMARY KEY,
  wallet        TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  used          BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- API Keys para developers (key hasheada)
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_prefix    TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,
  environment   TEXT NOT NULL CHECK (environment IN ('production','test')),
  active        BOOLEAN DEFAULT true,
  calls_count   INTEGER DEFAULT 0,
  volume_usdc   NUMERIC(18,6) DEFAULT 0,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Planes de suscripción del creador
CREATE TABLE IF NOT EXISTS subscription_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price_usdc    NUMERIC(18,6) NOT NULL,
  interval      TEXT NOT NULL CHECK (interval IN ('monthly','yearly')),
  description   TEXT,
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Suscripciones activas (espejo onchain)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  subscriber_wallet TEXT NOT NULL,
  plan_id           UUID REFERENCES subscription_plans(id),
  active            BOOLEAN DEFAULT true,
  started_at        TIMESTAMPTZ DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  last_tx_hash      TEXT
);

-- Todas las transacciones
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  category      TEXT NOT NULL CHECK (category IN ('subscription','onchain','course','service')),
  amount_usdc   NUMERIC(18,6) NOT NULL,
  fee_percent   NUMERIC(5,2) NOT NULL,
  fee_usdc      NUMERIC(18,6) NOT NULL,
  net_usdc      NUMERIC(18,6) NOT NULL,
  from_wallet   TEXT NOT NULL,
  tx_hash       TEXT UNIQUE,
  description   TEXT,
  api_key_id    UUID REFERENCES api_keys(id),
  verified      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Contenido del creador
CREATE TABLE IF NOT EXISTS content (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT,
  media_url     TEXT,
  media_type    TEXT CHECK (media_type IN ('image','video','document')),
  is_exclusive  BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Cursos
CREATE TABLE IF NOT EXISTS courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  price_usdc    NUMERIC(18,6) NOT NULL,
  cover_url     TEXT,
  published     BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modules (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  order_num INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  content   TEXT,
  video_url TEXT,
  order_num INTEGER NOT NULL
);

-- Servicios
CREATE TABLE IF NOT EXISTS services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  price_usdc    NUMERIC(18,6) NOT NULL,
  active        BOOLEAN DEFAULT true
);

-- Payment sessions (checkout embebible vía API)
CREATE TABLE IF NOT EXISTS payment_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id    UUID REFERENCES api_keys(id),
  creator_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  amount_usdc   NUMERIC(18,6) NOT NULL,
  category      TEXT NOT NULL,
  description   TEXT,
  metadata      JSONB,
  webhook_url   TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','expired')),
  tx_hash       TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Registro de uso de API keys (rate limiting + auditoría)
CREATE TABLE IF NOT EXISTS api_key_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id    UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL,
  ip            TEXT,
  response_code INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_window
  ON api_key_usage (api_key_id, created_at DESC);
-- Acelera la búsqueda de nonces vencidos y su limpieza (evita degradación y enumeración).
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires_at ON auth_nonces (expires_at);
CREATE INDEX IF NOT EXISTS idx_transactions_creator ON transactions (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_lookup
  ON subscriptions (subscriber_wallet, creator_id, active);

-- ----------------------------- RLS -----------------------------

ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_nonces         ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE content             ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons             ENABLE ROW LEVEL SECURITY;
ALTER TABLE services            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage       ENABLE ROW LEVEL SECURITY;

-- Users: solo puede ver/editar su propio perfil; perfiles públicos legibles aparte.
CREATE POLICY "users_own_profile" ON users
  FOR ALL USING (wallet = auth.jwt() ->> 'wallet');
CREATE POLICY "users_public_read" ON users
  FOR SELECT USING (true);

-- Transactions: creador solo ve las suyas
CREATE POLICY "creator_own_transactions" ON transactions
  FOR SELECT USING (creator_id = auth.uid());

-- API Keys: solo el dueño puede ver y gestionar sus keys
CREATE POLICY "owner_api_keys" ON api_keys
  FOR ALL USING (user_id = auth.uid());

-- API Keys: service_role para validar desde Edge Functions
CREATE POLICY "service_role_api_keys" ON api_keys
  FOR SELECT USING (auth.role() = 'service_role');

-- Subscription plans: el creador gestiona los suyos; lectura pública de planes activos
CREATE POLICY "creator_manage_plans" ON subscription_plans
  FOR ALL USING (creator_id = auth.uid());
CREATE POLICY "public_read_plans" ON subscription_plans
  FOR SELECT USING (active = true);

-- Subscriptions: creador ve las suyas; suscriptor ve las propias
CREATE POLICY "creator_view_subscriptions" ON subscriptions
  FOR SELECT USING (creator_id = auth.uid());
CREATE POLICY "subscriber_view_own" ON subscriptions
  FOR SELECT USING (subscriber_wallet = auth.jwt() ->> 'wallet');

-- Content exclusivo: visible solo si tiene suscripción activa
CREATE POLICY "exclusive_content_access" ON content
  FOR SELECT USING (
    is_exclusive = false
    OR creator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM subscriptions s
      WHERE s.subscriber_wallet = auth.jwt() ->> 'wallet'
        AND s.creator_id = content.creator_id
        AND s.active = true
        AND s.expires_at > now()
    )
  );
CREATE POLICY "creator_manage_content" ON content
  FOR ALL USING (creator_id = auth.uid());

-- Courses: creador gestiona; cursos publicados son públicos
CREATE POLICY "creator_manage_courses" ON courses
  FOR ALL USING (creator_id = auth.uid());
CREATE POLICY "public_read_published_courses" ON courses
  FOR SELECT USING (published = true);

-- Modules / lessons: ligados al dueño del curso
CREATE POLICY "creator_manage_modules" ON modules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses c WHERE c.id = modules.course_id AND c.creator_id = auth.uid())
  );
CREATE POLICY "creator_manage_lessons" ON lessons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN courses c ON c.id = m.course_id
      WHERE m.id = lessons.module_id AND c.creator_id = auth.uid()
    )
  );

-- Services: creador gestiona; servicios activos públicos
CREATE POLICY "creator_manage_services" ON services
  FOR ALL USING (creator_id = auth.uid());
CREATE POLICY "public_read_active_services" ON services
  FOR SELECT USING (active = true);

-- Payment sessions: creador dueño ve las suyas
CREATE POLICY "creator_view_payment_sessions" ON payment_sessions
  FOR SELECT USING (creator_id = auth.uid());

-- api_key_usage: dueño de la key ve su uso
CREATE POLICY "owner_view_usage" ON api_key_usage
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM api_keys k WHERE k.id = api_key_usage.api_key_id AND k.user_id = auth.uid())
  );

-- NOTA: auth_nonces se gestiona exclusivamente con service_role (sin policies = sin acceso anon/auth).

-- ----------------------------- FUNCIONES -----------------------------

-- Incremento atómico de contador de llamadas de una API key.
CREATE OR REPLACE FUNCTION increment_api_key_calls(key_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE api_keys SET calls_count = calls_count + 1 WHERE id = key_id;
$$;

-- Limpieza de nonces vencidos. Programar vía cron (p. ej. pg_cron, cada hora):
--   SELECT cron.schedule('cleanup-nonces', '0 * * * *', $$SELECT cleanup_expired_nonces()$$);
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM auth_nonces WHERE expires_at < now();
$$;
