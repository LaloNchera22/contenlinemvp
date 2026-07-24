import type { Metadata } from 'next';
import { dictionaries, hreflangAlternates, localePath, OG_LOCALES, type Locale } from './i18n';

/**
 * Base absoluta del sitio. Next.js la usa para resolver URLs relativas en
 * metadata (canonical, hreflang, Open Graph) y en el sitemap.
 */
export function siteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
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
      siteName: 'Dare',
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
