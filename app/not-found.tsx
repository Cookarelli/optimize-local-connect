import Link from "next/link";
import { MissionSignature } from "@/src/components/brand/mission-signature";

export default function NotFound() {
  return <main className="grid min-h-dvh place-items-center bg-stone-50 p-6 text-center"><div><p className="text-sm font-bold text-emerald-700">404</p><h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">That page isn’t here.</h1><p className="mt-3 text-slate-500">The resource may have moved or may not be available to your role.</p><Link href="/" className="mt-7 inline-flex min-h-11 items-center rounded-full bg-slate-950 px-6 text-sm font-semibold text-white">Return home</Link><MissionSignature className="mt-7" /></div></main>;
}
