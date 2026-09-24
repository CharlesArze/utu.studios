"use client";

import Image from "next/image";
import { useState } from "react";

const ASSET_BASE = "/sites/newmixcoffee-com-8d5a8741/en-7a4ba3ba/images";

type Store = {
  name: string;
  address: string;
  hours: string;
  mapsUrl: string;
  images: string[];
};

const STORES: Store[] = [
  {
    name: "Seongsu",
    address: "3, Yeonmujang 3-gil",
    hours: "MON-SUN 11am - 8pm",
    mapsUrl: "https://maps.app.goo.gl/wbHZMVy3gQsS4jyE6",
    images: [`${ASSET_BASE}/store-seongsu.webp`],
  },
  {
    name: "Anguk",
    address: "40, Changdeokgung 1-gil",
    hours: "MON-SUN 8am - 7pm",
    mapsUrl: "https://maps.app.goo.gl/1S4KVknxPeYGbxTZ9",
    images: [`${ASSET_BASE}/store-anguk.webp`],
  },
  {
    name: "Hannam",
    address: "16-1, Itaewon-ro 54-gil",
    hours: "MON-SUN 11am - 8pm",
    mapsUrl: "https://maps.app.goo.gl/r8AEzEo4bCUSq1Wh6",
    images: [`${ASSET_BASE}/store-hannam.webp`],
  },
];

function StoreCard({ store }: { store: Store }) {
  const [slide, setSlide] = useState(0);
  const hasMultiple = store.images.length > 1;

  return (
    <div className="relative aspect-[342/513] lg:aspect-auto lg:h-[640px] overflow-hidden rounded">
      <div className="relative h-full">
        <div className="h-full overflow-hidden">
          <div className="flex h-full transition-transform duration-300" style={{ transform: `translateX(-${slide * 100}%)` }}>
            {store.images.map((src, i) => (
              <div key={i} className="relative w-full h-full shrink-0 overflow-hidden">
                <Image src={src} alt={store.name} fill className="object-cover" />
              </div>
            ))}
          </div>
        </div>

        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => setSlide((s) => (s - 1 + store.images.length) % store.images.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 size-[32px] lg:size-[40px] opacity-50 hover:!opacity-100 hover:bg-white rounded-full transition-all duration-200 cursor-pointer z-[1]"
            >
              <img src={`${ASSET_BASE}/carousel-left.svg`} alt="" className="size-full" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => setSlide((s) => (s + 1) % store.images.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 size-[32px] lg:size-[40px] opacity-50 hover:!opacity-100 hover:bg-white rounded-full transition-all duration-200 cursor-pointer z-[1]"
            >
              <img src={`${ASSET_BASE}/carousel-right.svg`} alt="" className="size-full" />
            </button>
          </>
        )}

        <div className="absolute bottom-0 left-0 right-0 h-[125px] lg:h-[200px]">
          <div
            className="absolute inset-0 mix-blend-multiply"
            style={{ background: "linear-gradient(to bottom, white, rgba(6,6,6,0.4))" }}
          />
          <div className="relative h-full flex flex-col justify-end px-4 pb-6 lg:px-[66px] lg:pb-6">
            <h3 className="text-[24px] lg:text-[36px] font-bold text-white tracking-tight">{store.name}</h3>
            <p className="text-[12px] lg:text-[16px] font-light text-white/70 mt-1">{store.address}</p>
            <a
              href={store.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] lg:text-[16px] font-light text-white/70 underline w-fit"
            >
              View Location
              <svg className="size-[9px] lg:size-[17.4px]" viewBox="0 0 9 9" fill="none">
                <path d="M0.372559 4.7608H4.24673V8.62753L7.50049 1.5L0.372559 4.7608Z" fill="#D9D9D9" />
              </svg>
            </a>
            <p className="text-[12px] lg:text-[16px] font-light text-white/70 mt-2 lg:mt-3">{store.hours}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OfflineStore() {
  return (
    <section className="bg-black pt-20 pb-10 lg:pt-40">
      <div className="px-6 lg:px-20 max-w-[1440px] mx-auto flex flex-col gap-6 lg:gap-10">
        <div className="flex flex-col gap-1">
          <h2 className="text-[32px] lg:text-[56px] font-bold text-white tracking-tight">Offline Store</h2>
          <p className="text-[14px] lg:text-[18px] font-light text-white/70">
            A must-visit spot in Seoul to taste and experience newmix.
          </p>
        </div>
        <a
          href="/stores"
          className="inline-flex items-center justify-center px-6 py-2 lg:px-8 lg:py-4 border border-white rounded-[4px] text-[14px] lg:text-[18px] font-bold text-white text-center self-start transition-colors hover:bg-white hover:text-black"
        >
          View All
        </a>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {STORES.map((store) => (
            <StoreCard key={store.name} store={store} />
          ))}
        </div>
      </div>
    </section>
  );
}
