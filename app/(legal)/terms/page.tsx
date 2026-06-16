import { LegalShell } from '../legal';

export const metadata = { title: 'Términos de servicio — Contenline' };

export default function TermsPage() {
  return (
    <LegalShell title="Términos de servicio" updated="16 de junio de 2026">
      <section>
        <h2 className="text-lg font-semibold text-white">1. Naturaleza non-custodial</h2>
        <p>
          Contenline es un protocolo <strong>non-custodial</strong>. Los pagos se ejecutan
          directamente entre las wallets del pagador y del creador mediante contratos
          inteligentes en Polygon, sin que la plataforma custodie, retenga ni controle fondos
          en ningún momento. La plataforma cobra una comisión que se transfiere onchain de
          forma automática.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">2. No somos una ITF</h2>
        <p>
          Al no custodiar fondos ni intermediar pagos, Contenline no opera como Institución de
          Tecnología Financiera (ITF) bajo la Ley para Regular las Instituciones de Tecnología
          Financiera (México). Antes de operar en mainnet se recomienda validar este criterio
          con un abogado fintech. Eres responsable del cumplimiento fiscal de los ingresos que
          recibas.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">3. KYC / AML</h2>
        <p>
          La plataforma no realiza, por sí misma, identificación de clientes (KYC) ni custodia
          de fondos. Los usuarios se obligan a no utilizar el servicio para lavado de dinero,
          financiamiento ilícito ni cualquier actividad prohibida por la ley aplicable.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">4. Contenido</h2>
        <p>
          Los creadores son los únicos responsables del contenido que publican. El contenido
          para adultos debe marcarse como tal (age-gate) y los creadores deben cumplir las
          obligaciones de verificación de edad e identidad aplicables en su jurisdicción
          (p. ej. 18 U.S.C. §2257 en EE. UU., DSA en la UE). Queda prohibido publicar
          contenido ilegal.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-white">5. Riesgos</h2>
        <p>
          Las transacciones en blockchain son irreversibles. El uso de wallets y criptoactivos
          conlleva riesgos; aceptas usar el servicio bajo tu propia responsabilidad.
        </p>
      </section>
    </LegalShell>
  );
}
