import { Newsreader } from "next/font/google";

const newsreader = Newsreader({ subsets: ["latin"], weight: "400" });

const SERVICES = ["Diseño de Marca", "Diseño de Experiencia", "Desarrollo Web", "Producción de Contenido"];

const INFO_PARAGRAPHS = [
  "UTU Studios es un estudio multidisciplinario de diseño de producto, dedicado a construir marcas con una identidad honesta y memorable — tanto para negocios que recién empiezan como para marcas ya establecidas.",
  "Colaboramos con marcas que quieren diferenciarse y dejar huella, ofreciendo servicios creativos de principio a fin: identidad de marca, diseño de experiencia, desarrollo web y producción de contenido.",
  "UTU Studios existe para diseñar con propósito: marcas, productos y experiencias para personas que quieren construir algo que perdure en el tiempo.",
];

export default function AboutSection() {
  return (
    <section className="bg-[#FAA2CA] py-20 lg:py-[100px] pb-24 lg:pb-[140px]">
      <div className="px-6 lg:px-20 max-w-[1440px] mx-auto">
        <h1 className={`${newsreader.className} font-normal text-[56px] lg:text-[100px] leading-[0.95] text-black mb-2`}>
          Sobre UTU Studios
        </h1>

        <div className="flex flex-col lg:flex-row gap-5 mt-6">
          <div className="lg:w-[77%] text-[16px] lg:text-[18.9px] leading-[1.15] text-black">
            <p className="mb-3">INFORMACIÓN</p>
            {INFO_PARAGRAPHS.map((p, i) => (
              <p key={i} className="mb-4 last:mb-0">
                {p}
              </p>
            ))}
          </div>
          <div className="lg:w-[23%] text-[16px] lg:text-[18.9px] leading-[1.15] text-black">
            <p className="mb-3">SERVICIOS</p>
            <ul>
              {SERVICES.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-8 sm:gap-5 mt-16 lg:mt-20">
          <div>
            <p className="text-[16px] lg:text-[18.9px] text-black mb-1">EMAIL</p>
            <a
              href="mailto:studiosutu@gmail.com"
              className={`${newsreader.className} font-normal text-[28px] lg:text-[42px] leading-[0.95] text-black`}
            >
              studiosutu@gmail.com
            </a>
          </div>
          <div>
            <p className="text-[16px] lg:text-[18.9px] text-black mb-1">SOCIAL</p>
            <a
              href="https://www.instagram.com/utu_studios/"
              target="_blank"
              rel="noopener"
              className={`${newsreader.className} font-normal text-[28px] lg:text-[42px] leading-[0.95] text-black`}
            >
              Instagram
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
