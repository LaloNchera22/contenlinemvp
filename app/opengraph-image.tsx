import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'AdieCoin — Monetización cripto para creadores';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Imagen Open Graph generada en runtime (sin assets binarios en el repo).
 * La usan Google, X, WhatsApp, Telegram, etc. al compartir cualquier URL.
 */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 96,
          backgroundColor: '#121212',
          backgroundImage:
            'radial-gradient(ellipse at top right, rgba(62,207,142,0.18), transparent 60%)',
          color: '#EDEDED',
          fontSize: 32,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 44, fontWeight: 700 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path d="M13 2 3 14h7l-1 8 12-14h-8l0-6z" fill="#3ECF8E" />
          </svg>
          <span>
            Conten<span style={{ color: '#3ECF8E' }}>line</span>
          </span>
        </div>
        <div style={{ marginTop: 56, fontSize: 76, fontWeight: 700, lineHeight: 1.1, display: 'flex', flexDirection: 'column' }}>
          <span>Monetiza tu contenido</span>
          <span style={{ color: '#3ECF8E' }}>sin intermediarios</span>
        </div>
        <div style={{ marginTop: 40, fontSize: 30, color: 'rgba(237,237,237,0.6)', maxWidth: 900 }}>
          Suscripciones, cursos y servicios con pagos en USDC sobre Polygon · API para developers
        </div>
      </div>
    ),
    size,
  );
}
