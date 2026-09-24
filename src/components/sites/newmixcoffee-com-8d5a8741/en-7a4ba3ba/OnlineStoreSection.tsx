export default function OnlineStoreSection() {
  return (
    <section className="bg-black pt-20 pb-10 lg:py-60">
      <div className="px-6 lg:px-20 max-w-[1440px] mx-auto">
        <div className="flex flex-col gap-6 lg:gap-10">
          <div className="lg:flex lg:flex-col lg:gap-1">
            <h2 className="text-[32px] lg:text-[56px] font-bold text-white tracking-[-0.096px] lg:tracking-[-0.224px]">
              Online Store
            </h2>
            <p className="text-[14px] lg:text-[18px] font-light text-white/70 mt-1 lg:mt-0">
              Shop newmix online. (Available in Korea and the U.S.)
            </p>
          </div>
          <div className="flex flex-col lg:flex-row gap-6">
            <a
              href="https://brand.naver.com/newmixcoffee"
              target="_blank"
              rel="noopener noreferrer"
              className="group/store flex items-center justify-center gap-1.5 py-2 border border-white rounded-[4px] lg:py-2 transition-colors duration-200 hover:bg-white lg:h-20 lg:flex-1"
            >
              <span className="text-[18px] lg:text-[20px] font-bold text-white tracking-[-0.072px] lg:tracking-[-0.08px] group-hover/store:text-black transition-colors duration-200">
                Store
              </span>
            </a>
            <a
              href="https://www.amazon.com/stores/newmix/page/F7D71978-B570-4641-9E13-4FC38BE2E53E?lp_asin=B0H4KK57WJ&store_ref=bl_ast_dp_brandlogo_sto"
              target="_blank"
              rel="noopener noreferrer"
              className="group/store flex items-center justify-center gap-1.5 py-2 border border-white rounded-[4px] lg:py-2 transition-colors duration-200 hover:bg-white lg:h-20 lg:flex-1"
            >
              <span className="text-[18px] lg:text-[20px] font-bold text-white tracking-[-0.072px] lg:tracking-[-0.08px] group-hover/store:text-black transition-colors duration-200">
                Amazon US
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
