import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Dare — Monetización cripto para creadores';
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
          backgroundColor: '#000000',
          color: '#F5F5F7',
          fontSize: 32,
        }}
      >
        {/* Chrome acromático: marca en blanco, sin acento de color. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 44, fontWeight: 600 }}>
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
            <rect x="1.5" y="1.5" width="21" height="21" rx="6" stroke="#F5F5F7" strokeWidth="2" />
            <path d="M8 16V8h3.2a4 4 0 0 1 0 8H8z" stroke="#F5F5F7" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <span>Dare</span>
        </div>
        <div style={{ marginTop: 56, fontSize: 76, fontWeight: 600, letterSpacing: '-0.022em', lineHeight: 1.05, display: 'flex', flexDirection: 'column' }}>
          <span>Monetiza tu contenido</span>
          <span>sin intermediarios</span>
        </div>
        {/* El único color sale del contenido: barra de acento como en las portadas. */}
        <div style={{ marginTop: 32, width: 96, height: 8, borderRadius: 999, backgroundColor: '#2C5FD8' }} />
        <div style={{ marginTop: 32, fontSize: 30, color: 'rgba(245,245,247,0.6)', maxWidth: 900 }}>
          Suscripciones, cursos y servicios con pagos en USDC sobre Polygon · API para developers
        </div>
      </div>
    ),
    size,
  );
}
