import { Newsreader } from "next/font/google";

const newsreader = Newsreader({ subsets: ["latin"], weight: "400" });

const SERVICES = [
  {
    title: "Diseño de Marca",
    items:
      "Investigación y análisis, Estrategia y posicionamiento de marca, Mensajes, Desarrollo de concepto, Sistema de identidad de marca, Manual de marca, Tono de voz, Piezas de marketing, Diseño de impresos y packaging, Ilustración, Diseño 3D, Motion.",
  },
  {
    title: "Diseño de Experiencia",
    items:
      "Investigación, Mapas de recorrido del usuario, Flujos de usuario, Diseño UX, Prototipado, Diseño de producto digital, Diseño web, Diseño de apps, Soporte de desarrollo, Análisis de producto.",
  },
  {
    title: "Desarrollo Web",
    items:
      "Auditoría de sitios web, Estrategia, Desarrollo, Hosting y soporte, Integraciones API, Animaciones, Testing de sitios, SEO, Analítica y reportes, Animaciones personalizadas.",
  },
  {
    title: "Producción de Contenido",
    items:
      "Diseño para redes sociales, Diseño de información, Livery, Dirección, Guionismo, Diseño de motion, Storytelling visual, Brochures, Pitch decks, White papers, Fotografía, Producción de video, Explicativos.",
  },
];

export default function ServicesSection() {
  return (
    <section className="bg-[#FAA2CA] pt-32 pb-20 lg:pt-40 lg:pb-40">
      <div className="px-6 lg:px-20 max-w-[1440px] mx-auto">
        <h1
          className={`${newsreader.className} font-normal text-[32px] lg:text-[52px] leading-[1.15] tracking-normal text-black max-w-[900px]`}
        >
          UTU Studios es un estudio multidisciplinario de diseño de producto. Ayudamos a marcas de
          todo tipo a construir una identidad que perdure en el tiempo de las personas. ¿Qué podemos
          hacer por ti?
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-10 lg:mt-16">
          {SERVICES.map((service) => (
            <div key={service.title} className="border border-black p-5 pb-[30px]">
              <h2
                className={`${newsreader.className} font-normal text-[22px] lg:text-[26px] leading-[1] text-black`}
              >
                {service.title}
              </h2>
              <p className="font-normal text-[16px] lg:text-[18px] leading-[1.4] text-black mt-2">
                {service.items}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
