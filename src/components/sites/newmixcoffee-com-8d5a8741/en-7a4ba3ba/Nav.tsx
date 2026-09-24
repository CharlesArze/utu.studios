"use client";

import Link from "next/link";
import { useState } from "react";
import UtuLogo from "./UtuLogo";

const NAV_LINKS = [
  { label: "Servicios", href: "/servicios" },
  { label: "Nosotros", href: "/nosotros" },
  { label: "Contáctanos", href: "/contacto" },
];

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* z-40, deliberately BELOW the hero particle canvas (z-50 in
          HeroCanvas.tsx) so dragged particles pass in front of the header
          bar. The open mobile menu below is a sibling at z-[70], not a
          child of header, specifically so it can sit ABOVE that same
          canvas — nesting it inside header would cap it at header's own
          (lower) stacking level regardless of its own z-index. */}
      <header data-nav-chrome className="fixed inset-x-0 top-0 z-40 h-[72px] lg:h-20 flex items-center justify-between px-6 lg:px-20 bg-black">
      <Link href="/" className="relative z-40 flex-shrink-0 flex items-center gap-3 lg:gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- static vector asset, no optimization needed */}
        {/* Sphere mark + wordmark both sized at 85% of their original header
            size (15% smaller), gap/alignment left untouched. */}
        <img src="/images/brand-mark.svg" alt="" className="w-[27px] h-[27px] lg:w-[37px] lg:h-[37px]" />
        {/* The shared viewBox (0 0 1904 742) pads the glyph's bottom-right —
            fine for the particle-morph target in StatementSection/heroEngine,
            which is tuned against it, but it throws off centering next to the
            circular mark here. Crop tight to the glyph's own bounds instead. */}
        <UtuLogo
          className="w-[56px] h-[22px] lg:w-[77px] lg:h-[30px] text-white"
          viewBox="11 5 1009 394"
        />
      </Link>

      <nav className="hidden lg:flex items-center gap-9">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-white text-lg font-medium tracking-[-0.072px] transition-opacity duration-200 ease-[cubic-bezier(0.33,1,0.68,1)] opacity-70 hover:opacity-100"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      </header>

      {/* Sibling of header, not a child — the open mobile menu below is a
          z-[70] sibling too (see its own comment), which caps header's own
          z-40 button below it. Without its own escape hatch here the X
          never showed once the menu opened. Positioned to land exactly
          where the button sat inside header (same height/padding, centered
          the same way), just outside header's now-lower stacking level.
          `data-nav-chrome` (also on header and the menu panel below) is
          what heroEngine.ts's touch handler checks to exempt taps here from
          the hero's scroll-lock preventDefault — moving this out of
          `<header>` silently broke that exemption (it only matched
          `.closest("header")`) until this attribute was added. */}
      <div data-nav-chrome className="lg:hidden fixed top-0 right-0 z-[80] h-[72px] flex items-center px-6">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Menu"
          className="flex flex-col gap-1.5 shrink-0 p-3 -m-3"
        >
          {/* w-5 (20px) matches newmix's own menu icon (measured: 20x15px svg,
              each of its 3 rects 20px wide, full icon width — not tapered). */}
          <span className={`h-px w-5 bg-white transition-transform ${mobileOpen ? "translate-y-1.5 rotate-45" : ""}`} />
          <span className={`h-px w-5 bg-white transition-opacity ${mobileOpen ? "opacity-0" : ""}`} />
          <span className={`h-px w-5 bg-white transition-transform ${mobileOpen ? "-translate-y-1.5 -rotate-45" : ""}`} />
        </button>
      </div>

      <div
        data-nav-chrome
        className={`lg:hidden fixed inset-0 z-[70] bg-black px-6 pt-[104px] pb-6 flex flex-col items-start gap-6 transition-[clip-path] duration-1000 ease-[cubic-bezier(0.65,0,0.35,1)] ${
          mobileOpen ? "[clip-path:inset(0_0_0%_0)]" : "[clip-path:inset(0_0_100%_0)] pointer-events-none"
        }`}
      >
        {NAV_LINKS.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            // Staggered per-link reveal (newmix's menu brings its links in
            // one after another, not all at once with the panel). Delay only
            // applies while opening — on close every link resets instantly
            // so it doesn't lag behind the panel's own clip-path collapse.
            style={{ transitionDelay: mobileOpen ? `${300 + i * 90}ms` : "0ms" }}
            className={`text-[#FAA2CA] text-5xl font-medium hover:opacity-100 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.33,1,0.68,1)] ${
              mobileOpen ? "opacity-70 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </>
  );
}
