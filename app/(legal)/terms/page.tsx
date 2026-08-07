import { LegalShell } from '../legal';

export const metadata = { title: 'Términos de servicio — adie' };

export default function TermsPage() {
  return (
    <LegalShell title="Términos de servicio" updated="2 de agosto de 2026">
      <section>
        <h2 className="text-lg font-semibold text-ink">1. Modelos de pago</h2>
        <p>
          adie ofrece dos modos de pago con tratamiento distinto:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Pago directo onchain (non-custodial):</strong> la transacción se ejecuta
            directamente entre la wallet del pagador y la del creador mediante contratos
            inteligentes en Polygon. La plataforma no toma posesión de esos fondos; solo cobra
            una comisión que se liquida onchain.
          </li>
          <li>
            <strong>Saldo interno en AUSD (custodiado):</strong> al depositar USDC en la
            tesorería de adie recibes un saldo interno en AUSD (unidad de cuenta pegada 1:1
            al USDC depositado) que se liquida off-chain. Mientras esos fondos permanecen en tu
            saldo, <strong>adie los mantiene en custodia</strong> en su tesorería. Puedes
            retirarlos a USDC en cualquier momento desde tu wallet, sujeto a los controles de la
            sección 3.
          </li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">2. Estado regulatorio</h2>
        <p>
          Al operar un saldo custodiado y liquidar transferencias de valor, adie puede
          quedar sujeta a normativa de dinero electrónico, transmisión de fondos o
          criptoactivos según la jurisdicción (p. ej. MiCA en la UE, marcos de <em>money
          transmitter</em> en EE. UU., o la Ley Fintech en México). La clasificación y las
          licencias aplicables <strong>deben validarse con asesoría legal especializada antes
          de operar en mainnet o de aceptar usuarios de una jurisdicción determinada</strong>.
          Eres responsable del cumplimiento fiscal de los ingresos que recibas.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">3. KYC / AML y sanciones</h2>
        <p>
          Los depósitos y retiros están sujetos a screening de sanciones (listas OFAC y
          equivalentes). El retiro de saldo AUSD a USDC puede requerir verificación de
          identidad (KYC) por encima de determinados umbrales, y el servicio puede no estar
          disponible en jurisdicciones restringidas. Los usuarios se obligan a no utilizar el
          servicio para lavado de dinero, financiamiento ilícito ni cualquier actividad
          prohibida por la ley aplicable.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">4. Contenido</h2>
        <p>
          Los creadores son los únicos responsables del contenido que publican. El contenido
          para adultos debe marcarse como tal (age-gate) y los creadores deben cumplir las
          obligaciones de verificación de edad e identidad aplicables en su jurisdicción
          (p. ej. 18 U.S.C. §2257 en EE. UU., DSA en la UE). Queda prohibido publicar
          contenido ilegal.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-ink">5. Riesgos</h2>
        <p>
          Las transacciones en blockchain son irreversibles. El uso de wallets y criptoactivos
          conlleva riesgos; aceptas usar el servicio bajo tu propia responsabilidad.
        </p>
      </section>
    </LegalShell>
  );
}
