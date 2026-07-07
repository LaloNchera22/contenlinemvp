/**
 * i18n mínimo para las páginas públicas (landing multilenguaje con hreflang).
 *
 * El dashboard es privado (noindex) y se mantiene en español; las rutas
 * públicas indexables (`/`, `/en`, `/pt`) sirven el mismo contenido traducido
 * y se declaran mutuamente como alternates para que los buscadores sirvan la
 * versión correcta según el idioma del usuario.
 */

export const locales = ['es', 'en', 'pt'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'es';

/** Ruta pública de cada locale: el default vive en `/`, el resto en `/<locale>`. */
export function localePath(locale: Locale): string {
  return locale === defaultLocale ? '/' : `/${locale}`;
}

/** Deriva el locale desde el pathname (ej. para el atributo lang del <html>). */
export function localeFromPathname(pathname: string): Locale {
  const seg = pathname.split('/')[1];
  return (locales as readonly string[]).includes(seg) ? (seg as Locale) : defaultLocale;
}

/** Mapa hreflang → ruta, usado en metadata.alternates.languages y el sitemap. */
export function hreflangAlternates(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of locales) map[l] = localePath(l);
  map['x-default'] = localePath(defaultLocale);
  return map;
}

export const OG_LOCALES: Record<Locale, string> = {
  es: 'es_ES',
  en: 'en_US',
  pt: 'pt_BR',
};

type Feature = {
  title: string;
  body: string;
  bullets: string[];
};

export type LandingDict = {
  meta: {
    title: string;
    description: string;
    keywords: string[];
  };
  nav: { docs: string; dashboard: string };
  hero: {
    line1: string;
    line2: string;
    body: string;
    signIn: string;
    signing: string;
    connect: string;
    secondaryCta: string;
  };
  features: Feature[];
  stack: { title: string; items: { name: string; detail: string }[] };
  footer: {
    tagline: string;
    dashboard: string;
    docs: string;
    privacy: string;
    terms: string;
    cookies: string;
    language: string;
  };
};

export const dictionaries: Record<Locale, LandingDict> = {
  es: {
    meta: {
      title: 'Contenline — Monetización cripto para creadores',
      description:
        'Suscripciones, cursos y servicios con pagos en USDC sobre Polygon. Panel de creador + API de pagos cripto estilo Stripe para developers.',
      keywords: [
        'pagos cripto',
        'USDC',
        'Polygon',
        'monetización para creadores',
        'suscripciones onchain',
        'API de pagos web3',
      ],
    },
    nav: { docs: 'Documentación', dashboard: 'Dashboard' },
    hero: {
      line1: 'Monetiza tu contenido',
      line2: 'sin intermediarios',
      body: 'Gestiona suscripciones, cursos y servicios con pagos en USDC sobre Polygon. Y ofrece a developers una API de pagos cripto — todo en un solo dashboard, non-custodial.',
      signIn: 'Iniciar sesión con Ethereum',
      signing: 'Firmando…',
      connect: 'Conecta tu wallet para empezar',
      secondaryCta: 'Ver la API',
    },
    features: [
      {
        title: 'Panel de creador',
        body: 'Contenido exclusivo, cursos y servicios con acceso controlado por suscripción onchain.',
        bullets: ['Suscripciones en USDC', 'Contenido con signed URLs', 'Métricas de ingresos'],
      },
      {
        title: 'Infra de pagos',
        body: 'API keys estilo Stripe para integrar checkouts de USDC en tu propia app.',
        bullets: ['Checkout embebible', 'Webhooks firmados (HMAC)', 'Sesiones idempotentes'],
      },
      {
        title: 'Seguridad Web3',
        body: 'Autenticación con tu wallet y verificación onchain de cada pago.',
        bullets: ['Sign-In with Ethereum', 'RLS en Supabase', 'Non-custodial por diseño'],
      },
    ],
    stack: {
      title: 'Construido sobre infraestructura probada',
      items: [
        { name: 'USDC · Polygon', detail: 'Pagos estables con fees de centavos' },
        { name: 'SIWE', detail: 'Tu wallet es tu identidad' },
        { name: 'Supabase', detail: 'Postgres con Row Level Security' },
        { name: 'Webhooks', detail: 'Eventos firmados con HMAC-SHA256' },
      ],
    },
    footer: {
      tagline: 'Contenline · Protocolo non-custodial de pagos en USDC sobre Polygon',
      dashboard: 'Dashboard',
      docs: 'API · Docs',
      privacy: 'Privacidad',
      terms: 'Términos',
      cookies: 'Cookies',
      language: 'Idioma',
    },
  },
  en: {
    meta: {
      title: 'Contenline — Crypto monetization for creators',
      description:
        'Subscriptions, courses and services paid in USDC on Polygon. Creator dashboard + a Stripe-style crypto payments API for developers.',
      keywords: [
        'crypto payments',
        'USDC',
        'Polygon',
        'creator monetization',
        'onchain subscriptions',
        'web3 payments API',
      ],
    },
    nav: { docs: 'Docs', dashboard: 'Dashboard' },
    hero: {
      line1: 'Monetize your content',
      line2: 'without middlemen',
      body: 'Manage subscriptions, courses and services with USDC payments on Polygon. Plus a crypto payments API for developers — all in one non-custodial dashboard.',
      signIn: 'Sign in with Ethereum',
      signing: 'Signing…',
      connect: 'Connect your wallet to start',
      secondaryCta: 'Explore the API',
    },
    features: [
      {
        title: 'Creator dashboard',
        body: 'Exclusive content, courses and services gated by onchain subscriptions.',
        bullets: ['USDC subscriptions', 'Signed URLs for content', 'Earnings analytics'],
      },
      {
        title: 'Payments infra',
        body: 'Stripe-style API keys to embed USDC checkouts in your own app.',
        bullets: ['Embeddable checkout', 'Signed webhooks (HMAC)', 'Idempotent sessions'],
      },
      {
        title: 'Web3 security',
        body: 'Authenticate with your wallet and verify every payment onchain.',
        bullets: ['Sign-In with Ethereum', 'Supabase RLS', 'Non-custodial by design'],
      },
    ],
    stack: {
      title: 'Built on proven infrastructure',
      items: [
        { name: 'USDC · Polygon', detail: 'Stable payments with cent-level fees' },
        { name: 'SIWE', detail: 'Your wallet is your identity' },
        { name: 'Supabase', detail: 'Postgres with Row Level Security' },
        { name: 'Webhooks', detail: 'HMAC-SHA256 signed events' },
      ],
    },
    footer: {
      tagline: 'Contenline · Non-custodial USDC payments protocol on Polygon',
      dashboard: 'Dashboard',
      docs: 'API · Docs',
      privacy: 'Privacy',
      terms: 'Terms',
      cookies: 'Cookies',
      language: 'Language',
    },
  },
  pt: {
    meta: {
      title: 'Contenline — Monetização cripto para criadores',
      description:
        'Assinaturas, cursos e serviços pagos em USDC na Polygon. Painel do criador + API de pagamentos cripto estilo Stripe para developers.',
      keywords: [
        'pagamentos cripto',
        'USDC',
        'Polygon',
        'monetização para criadores',
        'assinaturas onchain',
        'API de pagamentos web3',
      ],
    },
    nav: { docs: 'Documentação', dashboard: 'Dashboard' },
    hero: {
      line1: 'Monetize seu conteúdo',
      line2: 'sem intermediários',
      body: 'Gerencie assinaturas, cursos e serviços com pagamentos em USDC na Polygon. E ofereça aos developers uma API de pagamentos cripto — tudo em um só dashboard, non-custodial.',
      signIn: 'Entrar com Ethereum',
      signing: 'Assinando…',
      connect: 'Conecte sua wallet para começar',
      secondaryCta: 'Ver a API',
    },
    features: [
      {
        title: 'Painel do criador',
        body: 'Conteúdo exclusivo, cursos e serviços com acesso controlado por assinatura onchain.',
        bullets: ['Assinaturas em USDC', 'Conteúdo com signed URLs', 'Métricas de receita'],
      },
      {
        title: 'Infra de pagamentos',
        body: 'API keys estilo Stripe para integrar checkouts de USDC no seu próprio app.',
        bullets: ['Checkout embutível', 'Webhooks assinados (HMAC)', 'Sessões idempotentes'],
      },
      {
        title: 'Segurança Web3',
        body: 'Autentique com sua wallet e verifique cada pagamento onchain.',
        bullets: ['Sign-In with Ethereum', 'RLS no Supabase', 'Non-custodial por design'],
      },
    ],
    stack: {
      title: 'Construído sobre infraestrutura comprovada',
      items: [
        { name: 'USDC · Polygon', detail: 'Pagamentos estáveis com taxas de centavos' },
        { name: 'SIWE', detail: 'Sua wallet é sua identidade' },
        { name: 'Supabase', detail: 'Postgres com Row Level Security' },
        { name: 'Webhooks', detail: 'Eventos assinados com HMAC-SHA256' },
      ],
    },
    footer: {
      tagline: 'Contenline · Protocolo non-custodial de pagamentos em USDC na Polygon',
      dashboard: 'Dashboard',
      docs: 'API · Docs',
      privacy: 'Privacidade',
      terms: 'Termos',
      cookies: 'Cookies',
      language: 'Idioma',
    },
  },
};
