/** @type {import('next').NextConfig} */

// NOTA DE SEGURIDAD (CSP script-src):
//  - 'unsafe-eval' lo exige WalletConnect/RainbowKit en runtime; quitarlo rompe
//    la conexión de wallets.
//  - 'unsafe-inline' es el punto débil (abre la puerta a XSS). El endurecimiento
//    correcto es CSP basada en nonce por request vía middleware de Next 14
//    (genera un nonce, lo inyecta en este header y en los <script>), eliminando
//    'unsafe-inline'. Es un cambio que debe validarse contra el flujo de
//    RainbowKit antes de activarlo en producción; se deja marcado aquí.
const ContentSecurityPolicy = [
  "default-src 'self'",
  // TODO(seguridad): migrar a nonce y eliminar 'unsafe-inline'.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
