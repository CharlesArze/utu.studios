import { Newsreader } from "next/font/google";

const newsreader = Newsreader({ subsets: ["latin"], weight: "400" });

export default function ContactInviteSection() {
  return (
    <section className="bg-black py-24 lg:py-32">
      <div className="px-6 lg:px-20 max-w-[1440px] mx-auto flex flex-col items-start gap-8 lg:gap-10">
        <h2
          className={`${newsreader.className} font-normal text-[32px] lg:text-[42px] leading-[1.2] text-white`}
        >
          ¿Emocionado? Nosotros también.
          <br />
          Escríbenos.
        </h2>
        <a
          href="/contacto"
          className="inline-flex items-center justify-center px-8 py-4 lg:px-10 lg:py-5 bg-white text-black text-[16px] lg:text-[18px] font-normal transition-opacity hover:opacity-80"
        >
          Contáctanos
        </a>
      </div>
    </section>
  );
}
