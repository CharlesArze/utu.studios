import Link from "next/link";
import FooterLogoParticles from "./FooterLogoParticles";
import MetaballsBackground from "./MetaballsBackground";

const FOOTER_LINKS = [
  { label: "Inicio", href: "/" },
  { label: "Servicios", href: "/servicios" },
  { label: "Nosotros", href: "/nosotros" },
  { label: "Contáctanos", href: "/contacto" },
];

function UnderlineLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const props = external ? { target: "_blank", rel: "noopener" } : {};
  return (
    <a href={href} {...props} className="group relative w-fit text-[12px] lg:text-[18px] font-light text-white">
      <span className="relative">
        {children}
        <span className="absolute left-0 bottom-0 w-full h-px bg-white/70 origin-right scale-x-100 group-hover:scale-x-0 transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]" />
        <span className="absolute left-0 bottom-0 w-full h-px bg-white origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]" />
      </span>
    </a>
  );
}

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-black pt-20 lg:!pt-[160px] pb-[70px] lg:pb-[80px]">
      {/* Animated "Metaballs" shader (21st.dev Shader Builder recipe), sitting
          behind the whole footer including the UTU wordmark reveal above —
          its dark low colour reads like the section's black bg, so the
          wordmark's transparent background shows the moving blobs through it. */}
      <MetaballsBackground className="absolute inset-0" />

      <div className="relative z-10">
        <FooterLogoParticles className="w-full aspect-[1009/394] mb-10 lg:mb-16" />

        <div className="px-6 lg:px-20 xl:px-0 flex justify-center">
          <div className="w-full xl:max-w-[1440px]">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
              <div className="flex flex-col gap-1 lg:w-[280px]">
                <UnderlineLink href="/contacto">studiosutu@gmail.com</UnderlineLink>
                <UnderlineLink href="https://www.instagram.com/utu_studios/" external>
                  Instagram
                </UnderlineLink>
              </div>

              <div className="flex justify-between text-[12px] lg:text-[18px] font-light text-white lg:gap-16">
                <nav className="flex flex-col gap-[10px]">
                  {FOOTER_LINKS.map((link) => (
                    <Link key={link.href} href={link.href} className="group relative w-fit">
                      {link.label}
                      <span className="absolute left-0 bottom-0 w-full h-px bg-white/70 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]" />
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="flex items-center justify-between lg:flex-col lg:items-start lg:gap-[7px]">
                <p className="text-[12px] lg:text-[14px] text-white">2026 UTU Studios. Todos los derechos reservados.</p>
                <div className="flex items-center gap-[5px] text-[10px] lg:text-[12px] text-white/70">
                  <Link href="/terms" className="hover:underline transition-colors">
                    Terms of Service
                  </Link>
                  <span className="w-px h-[7px] bg-white/40" />
                  <Link href="/privacy" className="hover:underline transition-colors">
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
