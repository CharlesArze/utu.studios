/** Gradient band from brand pink to black, with a light grain overlay, bridging a pink section into a black one. */
export default function PinkToBlackFade() {
  return (
    <div className="relative h-24 lg:h-32 bg-gradient-to-b from-[#FAA2CA] to-black overflow-hidden">
      <svg className="absolute inset-0 w-full h-full opacity-[0.15] mix-blend-overlay pointer-events-none" preserveAspectRatio="none">
        <defs>
          <filter id="pink-black-fade-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#pink-black-fade-grain)" />
      </svg>
    </div>
  );
}
