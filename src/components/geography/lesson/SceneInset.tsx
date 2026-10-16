import { cn } from "@/lib/utils";

/*
 * A small picture over a lesson's 3D scene, put there by the narration when the voice speaks of something the scene
 * itself cannot show (a diagram, a map). Top right, under the scene's own buttons; the scene stays in view.
 */
export function SceneInset({ title, wide = false, children }: { title: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <figure className={cn("pointer-events-none absolute top-14 right-3 z-10 overflow-hidden rounded-xl bg-[#0d1726]/88 p-2 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm", wide ? "w-[min(62%,31rem)]" : "w-[min(46%,23rem)]")}>
      <figcaption className="px-1 pb-1.5 text-[13px] leading-4 font-semibold">{title}</figcaption>
      {children}
    </figure>
  );
}
