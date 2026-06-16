import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'contenline-session';

/**
 * Middleware que cumple dos funciones:
 *
 *  1. CSP basada en nonce por request: genera un nonce aleatorio, lo inyecta en
 *     el header Content-Security-Policy y Next.js lo propaga a sus <script>.
 *     Esto elimina 'unsafe-inline' de script-src (vector XSS) manteniendo
 *     'unsafe-eval', que WalletConnect/RainbowKit exigen en runtime.
 *
 *  2. Protección server-side de /dashboard/*: si no hay un JWT de sesión válido
 *     en la cookie httpOnly, redirige a la home — el usuario no autenticado no
 *     ve siquiera el layout del panel.
 */
export async function middleware(req: NextRequest) {
  // --- 2. Guard de /dashboard ---
  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const valid = token ? await verifyJwt(token, process.env.SUPABASE_JWT_SECRET) : false;
    if (!valid) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('auth', 'required');
      return NextResponse.redirect(url);
    }
  }

  // --- 1. CSP con nonce ---
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  // Next.js lee el nonce desde el header CSP de la REQUEST y lo aplica a sus
  // scripts; debe ir tanto en la request como en la response.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

/** Verificación HS256 compatible con Edge runtime (Web Crypto). */
async function verifyJwt(token: string, secret?: string): Promise<boolean> {
  if (!secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, sigB64] = parts;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlToBytes(sigB64) as unknown as BufferSource,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    );
    if (!valid) return false;

    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export const config = {
  // Aplica a todo salvo estáticos de Next y el favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
