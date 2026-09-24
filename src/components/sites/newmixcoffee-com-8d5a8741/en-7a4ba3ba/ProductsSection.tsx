const ASSET_BASE = "/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/images";
const MIX_IMAGES = Array.from({ length: 16 }, (_, i) => `${ASSET_BASE}/mix_${i + 1}.png`);
// Doubled for a seamless -50% looping marquee track.
const TRACK_IMAGES = [...MIX_IMAGES, ...MIX_IMAGES];

export default function ProductsSection() {
  return (
    <section className="bg-black mb-[-1px]">
      <div className="relative z-[1] px-6 pt-[45px] pb-0 lg:px-20 lg:pt-0 max-w-[1440px] mx-auto">
        <div className="flex flex-col gap-5 lg:gap-10">
          <div className="flex flex-col gap-1">
            <h2 className="text-[32px] lg:text-[56px] font-bold tracking-tight text-white">Products</h2>
            <p className="text-[14px] lg:text-[18px] font-light text-white/70">
              Explore all newmix products—from mix coffee to snacks.
            </p>
          </div>
          <a
            href="/products"
            className="inline-flex items-center justify-center px-6 py-2 lg:px-8 lg:py-4 border border-white rounded-[4px] text-[14px] lg:text-[18px] font-bold text-white text-center self-start transition-colors hover:bg-white hover:text-black"
          >
            View All
          </a>
        </div>
      </div>

      <div className="marquee-wrap relative w-full overflow-hidden h-[600px] lg:h-[920px] -mt-[40px] lg:-mt-[60px]">
        <div
          className="absolute top-[40px] lg:top-[60px] bottom-0 left-0 w-[120px] z-[2] pointer-events-none"
          style={{ background: "linear-gradient(to right, #000 0%, transparent 100%)" }}
        />
        <div
          className="absolute top-[40px] lg:top-[60px] bottom-0 right-0 w-[120px] z-[2] pointer-events-none"
          style={{ background: "linear-gradient(to left, #000 0%, transparent 100%)" }}
        />
        <div className="marquee-track animate-marquee flex items-end w-max h-full pb-[70px] lg:pb-[60px]">
          {TRACK_IMAGES.map((src, i) => (
            <div
              key={i}
              className="marquee-item shrink-0 flex items-center justify-center relative h-[322px] lg:h-[480px] px-4 lg:px-8"
            >
              <img src={src} alt="newmix product" className="h-full w-auto object-contain" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
