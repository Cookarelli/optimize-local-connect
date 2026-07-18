export function FoundingPartnerLogo({ src, name, size = "card" }: { src: string | null; name: string; size?: "card" | "profile" }) {
  const dimensions = size === "profile" ? "size-20 sm:size-24 rounded-3xl text-xl" : "size-14 rounded-2xl text-sm";
  if (src && /^https?:\/\//i.test(src)) return <span className={`${dimensions} grid shrink-0 place-items-center overflow-hidden border border-slate-200 bg-white`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={`${name} logo`} className="size-full object-contain p-1.5" />
  </span>;
  const initials = name.split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  return <span aria-hidden="true" className={`${dimensions} grid shrink-0 place-items-center bg-slate-950 font-black text-emerald-300`}>{initials}</span>;
}
