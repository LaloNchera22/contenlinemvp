-- =============================================================
-- Contenline — esquema completo con RLS
-- Ejecutar en el SQL editor de Supabase.
-- =============================================================

-- ----------------------------- TABLAS -----------------------------

-- Usuarios (wallet como identificador primario)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet        TEXT UNIQUE NOT NULL,
  -- username: minúsculas, dígitos y guion bajo, 3–32 chars. Evita inyección de
  -- caracteres raros y XSS reflejado en rutas /[username].
  username      TEXT UNIQUE NOT NULL CHECK (username ~ '^[a-z0-9_]{3,32}$'),
  display_name  TEXT NOT NULL,
  bio           TEXT,
  avatar_url    TEXT,
  -- Contenido para adultos: activa el age-gate del perfil público.
  is_adult      BOOLEAN DEFAULT false,
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
  -- Identificador entero estable para el contrato onchain. El contrato
  -- subscribe(creator, uint256 planId) NO acepta UUIDs; este entero es el que
  -- se pasa a setPlan()/subscribe() y el que confirm-transaction usa para
  -- mapear el evento Subscribed.planId de vuelta a este plan.
  onchain_plan_id BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
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
  is_adult      BOOLEAN DEFAULT false,
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

-- Users: lectura pública INTENCIONAL de perfiles (username, display_name, wallet,
-- avatar son datos públicos del creador). La escritura queda restringida al dueño.
-- Antes existían dos políticas FOR SELECT (una con USING wallet, otra con true)
-- que se combinaban con OR; eso hacía inútil la primera. Ahora la lectura pública
-- es una única política explícita y la escritura se separa con WITH CHECK para
-- impedir que alguien cree/edite/borre un perfil ajeno.
CREATE POLICY "users_public_read" ON users
  FOR SELECT USING (true);
CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (wallet = auth.jwt() ->> 'wallet');
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (wallet = auth.jwt() ->> 'wallet')
  WITH CHECK (wallet = auth.jwt() ->> 'wallet');
CREATE POLICY "users_delete_own" ON users
  FOR DELETE USING (wallet = auth.jwt() ->> 'wallet');

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

-- Rate limiting ATÓMICO por API key.
-- Antes el chequeo (SELECT count) y el registro (INSERT) eran dos pasos
-- separados: bajo concurrencia, N requests podían leer el mismo count y pasar
-- todos el límite. Aquí un advisory lock por key serializa el conteo + inserción
-- dentro de la misma transacción, cerrando la race condition.
CREATE OR REPLACE FUNCTION check_and_log_api_usage(
  p_key_id   UUID,
  p_endpoint TEXT,
  p_ip       TEXT,
  p_limit    INT,
  p_window_seconds INT
)
RETURNS TABLE(allowed BOOLEAN, request_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  c INT;
BEGIN
  -- Serializa las requests concurrentes de la misma key durante esta tx.
  PERFORM pg_advisory_xact_lock(hashtext(p_key_id::text));

  SELECT count(*) INTO c
  FROM api_key_usage
  WHERE api_key_id = p_key_id
    AND created_at >= now() - make_interval(secs => p_window_seconds);

  IF c >= p_limit THEN
    INSERT INTO api_key_usage(api_key_id, endpoint, ip, response_code)
      VALUES (p_key_id, p_endpoint, p_ip, 429);
    RETURN QUERY SELECT false, c;
  ELSE
    INSERT INTO api_key_usage(api_key_id, endpoint, ip, response_code)
      VALUES (p_key_id, p_endpoint, p_ip, 200);
    RETURN QUERY SELECT true, c + 1;
  END IF;
END;
$$;

-- Creación de nonce con límite por wallet (anti-spam / anti-enumeración).
-- /api/auth/nonce no requiere autenticación previa, así que sin un tope cualquiera
-- podría inundar auth_nonces con millones de filas. Un advisory lock por wallet
-- serializa el conteo + inserción, y rechazamos si ya hay demasiados nonces
-- activos (no usados y no vencidos) para esa wallet.
CREATE OR REPLACE FUNCTION create_auth_nonce(
  p_nonce      TEXT,
  p_wallet     TEXT,
  p_expires_at TIMESTAMPTZ,
  p_max_active INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  c INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_wallet));

  SELECT count(*) INTO c
  FROM auth_nonces
  WHERE wallet = p_wallet
    AND used = false
    AND expires_at > now();

  IF c >= p_max_active THEN
    RETURN false;
  END IF;

  INSERT INTO auth_nonces(nonce, wallet, expires_at, used)
    VALUES (p_nonce, p_wallet, p_expires_at, false);
  RETURN true;
END;
$$;

-- Limpieza de nonces vencidos.
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM auth_nonces WHERE expires_at < now();
$$;

-- Programación automática de la limpieza de nonces (evita el crecimiento
-- indefinido de auth_nonces). Requiere la extensión pg_cron, disponible en
-- Supabase. El bloque es idempotente: re-crea el schedule si ya existía.
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-nonces') THEN
    PERFORM cron.unschedule('cleanup-nonces');
  END IF;
  PERFORM cron.schedule('cleanup-nonces', '0 * * * *', 'SELECT cleanup_expired_nonces()');
END;
$$;

-- ----------------------- MIGRACIONES IDEMPOTENTES -----------------------
-- Para bases de datos creadas antes de estas columnas/constraints. CREATE TABLE
-- IF NOT EXISTS no altera tablas ya existentes, así que las aplicamos aquí.
DO $$
BEGIN
  -- subscription_plans.onchain_plan_id (mapeo UUID ↔ uint256 del contrato)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'onchain_plan_id'
  ) THEN
    ALTER TABLE subscription_plans
      ADD COLUMN onchain_plan_id BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE;
  END IF;

  -- users.is_adult / content.is_adult (age-gate de contenido adulto)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_adult'
  ) THEN
    ALTER TABLE users ADD COLUMN is_adult BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'content' AND column_name = 'is_adult'
  ) THEN
    ALTER TABLE content ADD COLUMN is_adult BOOLEAN DEFAULT false;
  END IF;

  -- Constraint de formato de username (no falla si ya existe).
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_format'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_]{3,32}$');
  END IF;
END;
$$;
