/** Rotation duration matches the reference clip's own loop length (contact_po.mp4, 4.467s). */
const SPIN_DURATION = "4.467s";

/** The UTU sphere mark: continuous wobble (movement A) + infinite counter-clockwise spin (movement B). */
export default function UtuSphere({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" aria-hidden="true" className={className}>
      <defs>
        <filter id="utu-sphere-wobble" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="2" seed="3" result="noise" />
          <feOffset in="noise" result="drift">
            <animate attributeName="dx" values="0;37;-21;0" dur={SPIN_DURATION} repeatCount="indefinite" />
            <animate attributeName="dy" values="0;-29;33;0" dur={SPIN_DURATION} repeatCount="indefinite" />
          </feOffset>
          <feDisplacementMap in="SourceGraphic" in2="drift" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      {/* Movimiento A: flameo continuo, fijo en pantalla (como en el vídeo de referencia) */}
      <g filter="url(#utu-sphere-wobble)">
        {/* Movimiento B: rotación antihoraria infinita sobre el centro exacto de la esfera */}
        <g>
          <image href="/images/utu-sphere-outline.png" width="1000" height="1000" />
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 500 500"
            to="-360 500 500"
            dur={SPIN_DURATION}
            repeatCount="indefinite"
            calcMode="linear"
          />
        </g>
      </g>
    </svg>
  );
}
