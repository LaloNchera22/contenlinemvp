/**
 * Marca gráfica única, en currentColor: hereda el color del texto (ink), así el
 * chrome se mantiene acromático y nunca lleva un acento de marca. Sustituye al
 * rayo verde que estaba duplicado con el hex hardcodeado en Landing y en la
 * imagen Open Graph. Un solo origen para el símbolo.
 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" stroke="currentColor" strokeWidth="2" />
      <path
        d="M8 16V8h3.2a4 4 0 0 1 0 8H8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
