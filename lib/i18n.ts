/**
 * i18n for AdieCoin's public pages (multi-language landing with hreflang).
 *
 * The product ships English-first: the default locale lives at `/`, and the
 * other locales at `/<locale>`. The private dashboard stays noindex. Every
 * public locale declares the others as alternates so search engines serve the
 * right version per user.
 */

export const locales = ['en', 'es', 'pt'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Public path for each locale: the default lives at `/`, the rest at `/<locale>`. */
export function localePath(locale: Locale): string {
  return locale === defaultLocale ? '/' : `/${locale}`;
}

/** Derives the locale from the pathname (e.g. for the <html lang> attribute). */
export function localeFromPathname(pathname: string): Locale {
  const seg = pathname.split('/')[1];
  return (locales as readonly string[]).includes(seg) ? (seg as Locale) : defaultLocale;
}

/** hreflang → path map, used in metadata.alternates.languages and the sitemap. */
export function hreflangAlternates(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of locales) map[l] = localePath(l);
  map['x-default'] = localePath(defaultLocale);
  return map;
}

export const OG_LOCALES: Record<Locale, string> = {
  en: 'en_US',
  es: 'es_ES',
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
  en: {
    meta: {
      title: 'adie — The stablecoin wallet for creators',
      description:
        'adie gives every creator a stablecoin balance (AUSD). Fund it once with USDC, then run recurring subscriptions, sell content, and accept fan challenges — all settled instantly from your internal balance, and withdrawable back to USDC anytime.',
      keywords: [
        'creator stablecoin',
        'AUSD',
        'recurring crypto subscriptions',
        'creator monetization',
        'fan challenges',
        'USDC deposit',
        'non-custodial payments',
      ],
    },
    nav: { docs: 'Docs', dashboard: 'Dashboard' },
    hero: {
      line1: 'A stablecoin balance',
      line2: 'for every creator',
      body: 'Top up once with USDC and it becomes AUSD in your adie wallet. Subscriptions renew automatically from your balance, and fans can send you paid challenges — no gas per payment, no middlemen, and you can withdraw back to USDC anytime.',
      signIn: 'Sign in with Ethereum',
      signing: 'Signing…',
      connect: 'Connect your wallet to start',
      secondaryCta: 'Explore the API',
    },
    features: [
      {
        title: 'Internal AUSD wallet',
        body: 'Deposit USDC on Polygon and it credits your balance 1:1 as AUSD. Every payment settles instantly against your balance — no per-transaction gas.',
        bullets: ['USDC → AUSD, 1:1', 'Instant off-chain settlement', 'Append-only ledger'],
      },
      {
        title: 'Recurring subscriptions',
        body: 'Fans subscribe once and renewals are auto-charged from their AUSD balance. Predictable revenue without asking them to sign every month.',
        bullets: ['Auto-renew from balance', 'Monthly & yearly plans', 'Gated exclusive content'],
      },
      {
        title: 'Fan challenges',
        body: 'Fans author a paid challenge or commission and send it to you with AUSD staked in escrow. Accept and deliver to release the funds.',
        bullets: ['Fan-authored & staked', 'Escrowed until delivered', 'Auto-refund if declined'],
      },
    ],
    stack: {
      title: 'Built on proven infrastructure',
      items: [
        { name: 'AUSD', detail: 'Internal stablecoin, pegged 1:1 to USDC' },
        { name: 'USDC · Polygon', detail: 'On-ramp deposits with cent-level fees' },
        { name: 'SIWE', detail: 'Your wallet is your identity' },
        { name: 'Supabase', detail: 'Postgres ledger with Row Level Security' },
      ],
    },
    footer: {
      tagline: 'adie · Stablecoin balances and fan challenges for creators',
      dashboard: 'Dashboard',
      docs: 'API · Docs',
      privacy: 'Privacy',
      terms: 'Terms',
      cookies: 'Cookies',
      language: 'Language',
    },
  },
  es: {
    meta: {
      title: 'adie — La wallet stablecoin para creadores',
      description:
        'adie le da a cada creador un saldo en stablecoin (AUSD). Recárgalo una vez con USDC y gestiona suscripciones recurrentes, vende contenido y recibe retos de fans — todo se liquida al instante desde tu saldo interno, y puedes retirarlo a USDC cuando quieras.',
      keywords: [
        'stablecoin para creadores',
        'AUSD',
        'suscripciones cripto recurrentes',
        'monetización para creadores',
        'retos de fans',
        'depósito USDC',
        'pagos non-custodial',
      ],
    },
    nav: { docs: 'Documentación', dashboard: 'Dashboard' },
    hero: {
      line1: 'Un saldo en stablecoin',
      line2: 'para cada creador',
      body: 'Recarga una vez con USDC y se convierte en AUSD en tu wallet de adie. Las suscripciones se renuevan solas desde tu saldo y los fans pueden enviarte retos pagados — sin gas por pago, sin intermediarios y con retiro a USDC cuando quieras.',
      signIn: 'Iniciar sesión con Ethereum',
      signing: 'Firmando…',
      connect: 'Conecta tu wallet para empezar',
      secondaryCta: 'Ver la API',
    },
    features: [
      {
        title: 'Wallet interna AUSD',
        body: 'Deposita USDC en Polygon y acredita tu saldo 1:1 como AUSD. Cada pago se liquida al instante contra tu saldo — sin gas por transacción.',
        bullets: ['USDC → AUSD, 1:1', 'Liquidación instantánea', 'Ledger append-only'],
      },
      {
        title: 'Suscripciones recurrentes',
        body: 'Los fans se suscriben una vez y las renovaciones se cobran solas desde su saldo AUSD. Ingresos predecibles sin pedir firma cada mes.',
        bullets: ['Auto-renovación desde saldo', 'Planes mensuales y anuales', 'Contenido exclusivo'],
      },
      {
        title: 'Retos de fans',
        body: 'Un fan crea un reto o encargo pagado y te lo envía con AUSD en garantía. Acepta y entrega para liberar los fondos.',
        bullets: ['Creados y financiados por el fan', 'En garantía hasta entregar', 'Reembolso si rechazas'],
      },
    ],
    stack: {
      title: 'Construido sobre infraestructura probada',
      items: [
        { name: 'AUSD', detail: 'Stablecoin interno, pegado 1:1 a USDC' },
        { name: 'USDC · Polygon', detail: 'Depósitos de entrada con fees de centavos' },
        { name: 'SIWE', detail: 'Tu wallet es tu identidad' },
        { name: 'Supabase', detail: 'Ledger en Postgres con Row Level Security' },
      ],
    },
    footer: {
      tagline: 'adie · Saldos en stablecoin y retos de fans para creadores',
      dashboard: 'Dashboard',
      docs: 'API · Docs',
      privacy: 'Privacidad',
      terms: 'Términos',
      cookies: 'Cookies',
      language: 'Idioma',
    },
  },
  pt: {
    meta: {
      title: 'adie — A carteira stablecoin para criadores',
      description:
        'A adie dá a cada criador um saldo em stablecoin (AUSD). Recarregue uma vez com USDC e gerencie assinaturas recorrentes, venda conteúdo e receba desafios de fãs — tudo liquidado na hora a partir do seu saldo interno, e sacável de volta para USDC quando quiser.',
      keywords: [
        'stablecoin para criadores',
        'AUSD',
        'assinaturas cripto recorrentes',
        'monetização para criadores',
        'desafios de fãs',
        'depósito USDC',
        'pagamentos non-custodial',
      ],
    },
    nav: { docs: 'Documentação', dashboard: 'Dashboard' },
    hero: {
      line1: 'Um saldo em stablecoin',
      line2: 'para cada criador',
      body: 'Recarregue uma vez com USDC e ele vira AUSD na sua carteira adie. As assinaturas renovam sozinhas a partir do saldo e os fãs podem enviar desafios pagos — sem gas por pagamento, sem intermediários e com saque para USDC quando quiser.',
      signIn: 'Entrar com Ethereum',
      signing: 'Assinando…',
      connect: 'Conecte sua wallet para começar',
      secondaryCta: 'Ver a API',
    },
    features: [
      {
        title: 'Carteira interna AUSD',
        body: 'Deposite USDC na Polygon e credite seu saldo 1:1 como AUSD. Cada pagamento é liquidado na hora contra o saldo — sem gas por transação.',
        bullets: ['USDC → AUSD, 1:1', 'Liquidação instantânea', 'Ledger append-only'],
      },
      {
        title: 'Assinaturas recorrentes',
        body: 'Os fãs assinam uma vez e as renovações são cobradas do saldo AUSD deles. Receita previsível sem pedir assinatura todo mês.',
        bullets: ['Auto-renovação pelo saldo', 'Planos mensais e anuais', 'Conteúdo exclusivo'],
      },
      {
        title: 'Desafios de fãs',
        body: 'Um fã cria um desafio ou encomenda paga e envia para você com AUSD em garantia. Aceite e entregue para liberar os fundos.',
        bullets: ['Criados e financiados pelo fã', 'Em garantia até entregar', 'Reembolso se recusar'],
      },
    ],
    stack: {
      title: 'Construído sobre infraestrutura comprovada',
      items: [
        { name: 'AUSD', detail: 'Stablecoin interno, atrelado 1:1 ao USDC' },
        { name: 'USDC · Polygon', detail: 'Depósitos de entrada com taxas de centavos' },
        { name: 'SIWE', detail: 'Sua wallet é sua identidade' },
        { name: 'Supabase', detail: 'Ledger em Postgres com Row Level Security' },
      ],
    },
    footer: {
      tagline: 'adie · Saldos em stablecoin e desafios de fãs para criadores',
      dashboard: 'Dashboard',
      docs: 'API · Docs',
      privacy: 'Privacidade',
      terms: 'Termos',
      cookies: 'Cookies',
      language: 'Idioma',
    },
  },
};
