import { LegalShell } from '../legal';

export const metadata = { title: 'Aviso de privacidad — Contenline' };

export default function PrivacyPage() {
  return (
    <LegalShell title="Aviso de privacidad" updated="16 de junio de 2026">
      <section>
        <h2 className="text-lg font-semibold text-white">1. Responsable</h2>
        <p>
          Contenline (“la plataforma”) trata datos personales conforme al RGPD (UE) y a la
          Ley Federal de Protección de Datos Personales en Posesión de los Particulares
          (México).
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">2. Datos que recopilamos</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Dirección de wallet (identificador de cuenta; puede considerarse dato personal).</li>
          <li>Perfil público: username, nombre, biografía y avatar que tú proporcionas.</li>
          <li>Dirección IP y metadatos de uso de las API keys (seguridad y rate limiting).</li>
          <li>Registros de transacciones onchain asociados a tu cuenta.</li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">3. Finalidades</h2>
        <p>
          Autenticación (SIWE), prevención de abuso, prestación del servicio, contabilidad y
          cumplimiento de obligaciones legales.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">4. Tus derechos (ARCO / RGPD)</h2>
        <p>
          Puedes acceder, rectificar, cancelar u oponerte al tratamiento, así como solicitar
          la portabilidad y el borrado de tus datos (derecho al olvido, art. 17 RGPD). El
          borrado de los datos de perfil puede ejercerse desde tu cuenta; las transacciones
          registradas en la blockchain son inmutables y no pueden eliminarse.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">5. Conservación</h2>
        <p>
          Conservamos los datos mientras tu cuenta esté activa y durante los plazos legales
          aplicables (p. ej. obligaciones fiscales). Los nonces de autenticación se eliminan
          automáticamente al expirar.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">6. Contacto</h2>
        <p>Para ejercer tus derechos, escribe a privacidad@contenline.example.</p>
      </section>
    </LegalShell>
  );
}
