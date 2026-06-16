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
