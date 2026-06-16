/**
 * Validación de webhook_url para mitigar SSRF.
 *
 * El backend hace `fetch` server-side a esta URL (ver process-webhook). Sin
 * validación, un developer podría apuntarla a `http://localhost`, a rangos IP
 * privados o al endpoint de metadata de la nube (169.254.169.254) y forzar al
 * servidor a hacer peticiones internas / exfiltrar credenciales.
 *
 * Reglas: solo https, host público (no localhost ni IP privada/reservada).
 */
export function isSafeWebhookUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return false;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  // Solo HTTPS hacia un host externo.
  if (url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();

  // Bloquear localhost y dominios internos comunes.
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return false;
  }

  // Si es una IP literal, rechazar rangos privados/reservados.
  if (isPrivateOrReservedIp(host)) return false;

  return true;
}

function isPrivateOrReservedIp(host: string): boolean {
  // IPv6: rechazar loopback (::1), link-local (fe80::), ULA (fc00::/7) y mapeadas.
  if (host.includes(':')) {
    const h = host.replace(/^\[|\]$/g, '');
    if (h === '::1' || h === '::') return true;
    if (/^fe80:/i.test(h) || /^f[cd][0-9a-f]{2}:/i.test(h)) return true;
    return false;
  }

  const octets = host.split('.');
  if (octets.length !== 4) return false; // no es IPv4 → es un hostname
  const nums = octets.map((o) => Number(o));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = nums;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // link-local + metadata cloud
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  return false;
}
