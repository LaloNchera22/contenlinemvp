import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkIpRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// Buckets a los que la app permite subir, según visibilidad del contenido.
const BUCKETS = {
  exclusive: 'exclusive-content',
  public: 'public-content',
  course: 'course-media',
} as const;
type BucketKey = keyof typeof BUCKETS;

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_MIME = /^(image|video|audio|application\/pdf)/;

/**
 * POST /api/upload  (multipart/form-data: file, bucket?)
 * Sube un archivo a un bucket de Storage usando el admin client. El objeto se
 * guarda bajo un prefijo = id del creador, de modo que cada quien sube a su
 * propia carpeta. Devuelve la ruta (no una URL pública) — el contenido
 * exclusivo se sirve luego vía signed URL en /api/content/[id]/url.
 */
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  // Cuota por usuario (no por IP): cada upload consume storage y ancho de banda.
  // 20/día es generoso para un creador legítimo y frena la subida masiva abusiva
  // desde una cuenta comprometida. Usamos el user_id como identificador del bucket.
  const rl = await checkIpRateLimit(session.sub, 'upload', 20, 24 * 60 * 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Límite diario de subidas alcanzado (20/día)' },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Se esperaba multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Archivo vacío o mayor a 50 MB' }, { status: 400 });
  }
  if (!ALLOWED_MIME.test(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });
  }

  const bucketKey = (form.get('bucket') as string | null) ?? 'exclusive';
  if (!(bucketKey in BUCKETS)) {
    return NextResponse.json({ error: 'bucket inválido' }, { status: 400 });
  }
  const bucket = BUCKETS[bucketKey as BucketKey];

  // Nombre de objeto: <creatorId>/<timestamp>-<nombre saneado>.
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const objectPath = `${session.sub}/${Date.now()}-${safeName}`;

  const admin = createAdminClient();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage.from(bucket).upload(objectPath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    return NextResponse.json({ error: 'No se pudo subir el archivo' }, { status: 500 });
  }

  // Para buckets privados devolvemos la ruta; para el público, la URL.
  if (bucketKey === 'public') {
    const { data } = admin.storage.from(bucket).getPublicUrl(objectPath);
    return NextResponse.json({ bucket, path: objectPath, url: data.publicUrl }, { status: 201 });
  }
  return NextResponse.json({ bucket, path: objectPath }, { status: 201 });
}
