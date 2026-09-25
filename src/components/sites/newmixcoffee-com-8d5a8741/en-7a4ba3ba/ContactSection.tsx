import { Newsreader } from "next/font/google";

const newsreader = Newsreader({ subsets: ["latin"], weight: "400" });

export default function ContactSection() {
  return (
    <div className="px-6 lg:px-20 max-w-[1440px] mx-auto flex flex-col items-center gap-4 lg:gap-6 text-center">
      <div className="flex flex-col items-center gap-1">
        <h2 className={`${newsreader.className} text-[32px] lg:text-[56px] font-normal text-white tracking-tight`}>
          Contáctanos
        </h2>
        <p className="text-[14px] lg:text-[18px] font-light text-white/70">
          Contáctanos si tienes preguntas o consultas.
        </p>
      </div>
      <a
        href="/contacto"
        className="inline-flex items-center justify-center px-6 py-2 lg:px-8 lg:py-4 border border-white rounded-[4px] text-[14px] lg:text-[18px] font-bold text-white text-center transition-colors hover:bg-white hover:text-black"
      >
        Contáctanos
      </a>
    </div>
  );
}
