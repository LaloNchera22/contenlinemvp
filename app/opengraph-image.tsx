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
          backgroundColor: '#ffffff',
          backgroundImage:
            'radial-gradient(ellipse at top right, rgba(245,38,28,0.14), transparent 60%)',
          color: '#18181B',
          fontSize: 32,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 88, fontWeight: 800, letterSpacing: -2, color: '#F5261C' }}>
          adie<span>.</span>
        </div>
        <div style={{ marginTop: 48, fontSize: 76, fontWeight: 700, lineHeight: 1.1, display: 'flex', flexDirection: 'column' }}>
          <span>Monetiza tu contenido</span>
          <span style={{ color: '#F5261C' }}>sin intermediarios</span>
        </div>
        <div style={{ marginTop: 40, fontSize: 30, color: 'rgba(24,24,27,0.6)', maxWidth: 900 }}>
          Suscripciones, cursos y servicios con pagos en USDC sobre Polygon · API para developers
        </div>
      </div>
    ),
    size,
  );
}
