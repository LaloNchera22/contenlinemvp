import type { MetadataRoute } from 'next';
import { locales, localePath } from '@/lib/i18n';
import { siteUrl } from '@/lib/seo';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Sitemap dinámico: landing en cada idioma (con alternates hreflang), páginas
 * públicas estáticas y perfiles públicos de creadores. Los perfiles se leen de
 * Supabase con tolerancia a fallos: si la DB no responde, el sitemap sale con
 * las rutas estáticas en lugar de romper el crawl.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const abs = (path: string) => new URL(path, base).toString();

  const languages = Object.fromEntries(locales.map((l) => [l, abs(localePath(l))]));

  const entries: MetadataRoute.Sitemap = [
    ...locales.map((l) => ({
      url: abs(localePath(l)),
      changeFrequency: 'weekly' as const,
      priority: l === 'en' ? 1 : 0.9,
      alternates: { languages },
    })),
    { url: abs('/docs'), changeFrequency: 'weekly', priority: 0.8 },
    { url: abs('/privacy'), changeFrequency: 'yearly', priority: 0.2 },
    { url: abs('/terms'), changeFrequency: 'yearly', priority: 0.2 },
    { url: abs('/cookies'), changeFrequency: 'yearly', priority: 0.2 },
  ];

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('users')
      .select('username, is_adult')
      .not('username', 'is', null)
      .limit(5000);
    for (const u of data ?? []) {
      // Perfiles adultos fuera del sitemap (siguen accesibles, pero no los promovemos).
      if (!u.username || u.is_adult) continue;
      entries.push({
        url: abs(`/${encodeURIComponent(u.username)}`),
        changeFrequency: 'daily',
        priority: 0.6,
      });
    }
  } catch {
    // Sin credenciales o DB caída: sitemap solo con rutas estáticas.
  }

  return entries;
}
