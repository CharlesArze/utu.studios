import { Newsreader } from "next/font/google";

const newsreader = Newsreader({ subsets: ["latin"], weight: "400" });

const VIDEO_BASE = "/sites/newmixcoffee-com-8d5a8741/shared";

export default function ContactSection() {
  return (
    <section className="bg-black pt-20 pb-10 lg:pt-40 lg:pb-40">
      <div className="px-6 lg:px-20 max-w-[1440px] mx-auto flex items-center justify-between gap-6">
        <div className="flex flex-col gap-4 lg:gap-6">
          <div className="flex flex-col gap-1">
            <h2 className={`${newsreader.className} text-[32px] lg:text-[56px] font-normal text-white tracking-tight`}>
              Contáctanos
            </h2>
            <p className="text-[14px] lg:text-[18px] font-light text-white/70">
              Contáctanos si tienes preguntas o consultas.
            </p>
          </div>
          <a
            href="/contacto"
            className="inline-flex items-center justify-center px-6 py-2 lg:px-8 lg:py-4 border border-white rounded-[4px] text-[14px] lg:text-[18px] font-bold text-white text-center self-start transition-colors hover:bg-white hover:text-black"
          >
            Contáctanos
          </a>
        </div>
        <video
          src={`${VIDEO_BASE}/contact_po.mp4`}
          poster={`${VIDEO_BASE}/contact_po_poster.webp`}
          autoPlay
          loop
          muted
          playsInline
          className="h-[137px] lg:h-[393px] w-auto shrink-0 pointer-events-none hidden sm:block"
        />
      </div>
    </section>
  );
}
