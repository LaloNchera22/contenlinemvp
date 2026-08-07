import type { Metadata } from 'next';
import { dictionaries, hreflangAlternates, localePath, OG_LOCALES, type Locale } from './i18n';

/**
 * Base absoluta del sitio. Next.js la usa para resolver URLs relativas en
 * metadata (canonical, hreflang, Open Graph, Twitter) y en el sitemap.
 *
 * Orden de precedencia: NEXT_PUBLIC_SITE_URL (canónica del despliegue) →
 * NEXT_PUBLIC_APP_URL (compatibilidad con el resto de la app) → URL de
 * producción. NUNCA cae a localhost: así el canonical y las imágenes og/twitter
 * apuntan siempre a un host público real, aunque falte la variable de entorno.
 */
export function siteUrl(): URL {
  return new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'https://adie.app',
  );
}

/**
 * Metadata completa de la landing por idioma: canonical, hreflang, Open Graph
 * y Twitter Card. Cada versión de idioma declara a las demás como alternates
 * para que los buscadores sirvan la correcta según el usuario.
 */
export function landingMetadata(locale: Locale): Metadata {
  const dict = dictionaries[locale];
  const path = localePath(locale);

  return {
    title: { absolute: dict.meta.title },
    description: dict.meta.description,
    keywords: dict.meta.keywords,
    alternates: {
      canonical: path,
      languages: hreflangAlternates(),
    },
    openGraph: {
      type: 'website',
      url: path,
      siteName: 'adie',
      title: dict.meta.title,
      description: dict.meta.description,
      locale: OG_LOCALES[locale],
      alternateLocale: Object.entries(OG_LOCALES)
        .filter(([l]) => l !== locale)
        .map(([, og]) => og),
    },
    twitter: {
      card: 'summary_large_image',
      title: dict.meta.title,
      description: dict.meta.description,
    },
  };
}
