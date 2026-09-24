"use client";

import { useState, type FormEvent } from "react";
import { Newsreader } from "next/font/google";

const newsreader = Newsreader({ subsets: ["latin"], weight: "400" });

const SUPPORT_OPTIONS = ["Estrategia", "(Re)branding", "Diseño de Producto", "(Nuevo) Sitio Web", "Contenido", "Otro"];
const TIMING_OPTIONS = ["Ayer", "1 Mes", "1-3 Meses", "Flexible"];
const SCALE_OPTIONS = ["$0 – $10k", "$11k – $30k", "$31k – $100k", "$100k +"];

const inputClasses = "border border-black/40 px-4 py-3 text-[15px] normal-case font-normal bg-white";
const labelClasses = "flex flex-col gap-2 text-[12px] uppercase tracking-wide text-black";

export default function ContactFormSection() {
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [details, setDetails] = useState("");
  const [timing, setTiming] = useState(TIMING_OPTIONS[0]);
  const [scale, setScale] = useState(SCALE_OPTIONS[0]);

  function toggleOption(opt: string) {
    setSelected((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const subject = `Solicitud de proyecto — ${name || "Sin nombre"}`;
    const body = [
      `Necesita ayuda con: ${selected.join(", ") || "-"}`,
      `Nombre: ${name}`,
      `Email: ${email}`,
      `Empresa: ${company || "-"}`,
      `Detalles: ${details}`,
      `Cuándo: ${timing}`,
      `Alcance: ${scale}`,
    ].join("\n");
    window.location.href = `mailto:studiosutu@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <section className="bg-[#FAA2CA] pt-32 lg:pt-40 pb-20 lg:pb-32">
      <div className="px-6 lg:px-20 max-w-[1440px] mx-auto">
        <h1
          className={`${newsreader.className} font-normal text-[28px] lg:text-[40px] leading-[1.2] text-black max-w-[700px] mb-10 lg:mb-14`}
        >
          Nos encantaría saber de ti, envíanos una solicitud.
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-8 max-w-[900px]">
          <div>
            <p className="text-[12px] uppercase tracking-wide text-black mb-3">Necesito ayuda con</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SUPPORT_OPTIONS.map((opt) => {
                const active = selected.includes(opt);
                return (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`h-14 px-3 rounded-md border border-black text-[14px] text-center transition-colors ${
                      active ? "bg-black text-white" : "bg-transparent text-black"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className={labelClasses}>
              Nombre completo
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                className={inputClasses}
              />
            </label>
            <label className={labelClasses}>
              Correo electrónico
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@empresa.com"
                className={inputClasses}
              />
            </label>
            <label className={labelClasses}>
              Empresa (Opcional)
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="(Opcional)"
                className={inputClasses}
              />
            </label>
          </div>

          <label className={labelClasses}>
            ¿En qué podemos ayudarte?
            <textarea
              required
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Que el logo sea más grande"
              rows={4}
              className={`${inputClasses} resize-y`}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className={labelClasses}>
              ¿Cuándo lo necesitas?
              <select value={timing} onChange={(e) => setTiming(e.target.value)} className={inputClasses}>
                {TIMING_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClasses}>
              Alcance del proyecto
              <select value={scale} onChange={(e) => setScale(e.target.value)} className={inputClasses}>
                {SCALE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            className="self-start px-8 py-4 rounded-full border border-black text-[15px] font-normal text-black transition-colors hover:bg-black hover:text-white"
          >
            Enviar solicitud
          </button>
        </form>
      </div>
    </section>
  );
}
