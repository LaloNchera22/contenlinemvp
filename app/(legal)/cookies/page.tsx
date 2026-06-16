import { LegalShell } from '../legal';

export const metadata = { title: 'Política de cookies — Contenline' };

export default function CookiesPage() {
  return (
    <LegalShell title="Política de cookies" updated="16 de junio de 2026">
      <section>
        <h2 className="text-lg font-semibold text-white">1. Qué usamos</h2>
        <p>
          Contenline utiliza únicamente almacenamiento <strong>estrictamente necesario</strong>{' '}
          para funcionar:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>
            <code>contenline-session</code>: cookie httpOnly con tu sesión autenticada (SIWE).
          </li>
          <li>
            <code>contenline-auth</code> / <code>contenline-age-confirmed</code>: almacenamiento
            local del navegador para la sesión del cliente y la confirmación de edad.
          </li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">2. Cookies de terceros</h2>
        <p>
          No usamos cookies de publicidad ni de analítica de terceros. Si en el futuro se
          incorpora analítica, se solicitará tu consentimiento previo mediante el banner.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">3. Gestión</h2>
        <p>
          Puedes borrar el almacenamiento desde la configuración de tu navegador. Eliminar la
          cookie de sesión cerrará tu sesión.
        </p>
      </section>
    </LegalShell>
  );
}
