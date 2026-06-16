-- =============================================================
-- Buckets de Storage para Contenline
-- =============================================================

-- public-content: avatares, thumbnails, contenido público
INSERT INTO storage.buckets (id, name, public)
VALUES ('public-content', 'public-content', true)
ON CONFLICT (id) DO NOTHING;

-- exclusive-content: contenido exclusivo (privado, signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('exclusive-content', 'exclusive-content', false)
ON CONFLICT (id) DO NOTHING;

-- course-media: videos y archivos de cursos (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-media', 'course-media', false)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública del bucket público
CREATE POLICY "public_content_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-content');

-- Subida de objetos sólo por usuarios autenticados a sus carpetas (prefijo = wallet/uid)
CREATE POLICY "authenticated_upload_public" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-content');

-- Los buckets privados (exclusive-content, course-media) NO tienen policies de SELECT:
-- el acceso se realiza exclusivamente vía signed URLs generadas server-side con service_role.

-- INSERT a buckets privados: solo service_role (la app sube vía /api/upload con
-- el admin client, nunca directamente desde el browser). Sin estas policies ni
-- siquiera el flujo server-side por la API REST de Storage podría escribir.
CREATE POLICY "service_role_upload_exclusive" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'exclusive-content');

CREATE POLICY "service_role_upload_course" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'course-media');

-- service_role también gestiona (update/delete) los objetos privados.
CREATE POLICY "service_role_manage_private" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id IN ('exclusive-content', 'course-media'))
  WITH CHECK (bucket_id IN ('exclusive-content', 'course-media'));
