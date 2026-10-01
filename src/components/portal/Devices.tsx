import Image from "next/image";

/** A laptop drawn in CSS around a real screenshot. */
export function Laptop({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="relative">
      <div className="rounded-t-[14px] border border-[#2a3330] bg-[#151b19] p-[9px] pb-[11px] shadow-[0_40px_80px_-30px_rgba(17,26,24,0.55)]">
        <div className="mx-auto mb-[6px] size-[5px] rounded-full bg-[#2f3a37]" />
        <div className="relative aspect-[16/10] overflow-hidden rounded-[3px] bg-[#f4f6f5]">
          <Image src={src} alt={alt} fill priority={priority} sizes="(min-width: 1024px) 640px, 90vw" className="object-cover object-top" />
        </div>
      </div>
      {/* Base with the opening notch. */}
      <div className="relative -mx-[7%] h-[14px] rounded-b-[14px] bg-gradient-to-b from-[#d9dedc] to-[#b9c1be] shadow-[0_18px_30px_-12px_rgba(17,26,24,0.45)]">
        <div className="absolute top-0 left-1/2 h-[6px] w-[14%] -translate-x-1/2 rounded-b-md bg-[#aab3b0]" />
      </div>
    </div>
  );
}

/** A phone drawn in CSS around a real screenshot. */
export function Phone({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-[34px] border border-[#2a3330] bg-[#151b19] p-[7px] shadow-[0_30px_60px_-20px_rgba(17,26,24,0.6)]">
      <div className="relative aspect-[390/844] overflow-hidden rounded-[27px] bg-[#f4f6f5]">
        <Image src={src} alt={alt} fill sizes="200px" className="object-cover object-top" />
        <div className="absolute top-[7px] left-1/2 h-[18px] w-[34%] -translate-x-1/2 rounded-full bg-[#151b19]" />
      </div>
    </div>
  );
}
