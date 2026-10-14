"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Full screen for the 3D scenes. Put the ref on the lesson section (or on the scene itself, in the explorer
 * pages) and mark the scene's frame with `data-scene`: in full screen the scene takes the room and the controls
 * under it scroll (globals.css, [data-full]). Browsers without the Fullscreen API (iPhone) get the element laid
 * over the whole page instead. `wholePage` puts the whole document in full screen (the anatomy atlas).
 */
export function useFullscreen({ wholePage = false } = {}) {
  const node = useRef<HTMLElement | null>(null);
  /** A callback ref, so the page can pass it on while it renders. */
  const ref = useCallback((el: HTMLElement | null) => {
    node.current = el;
  }, []);
  const [full, setFull] = useState(false);
  /** The whole page can only go full screen where the browser allows it (not on an iPhone). */
  const [canWholePage, setCanWholePage] = useState(false);

  const leavePage = useCallback(() => {
    const el = node.current;
    if (el?.dataset.full !== "page") return;
    el.removeAttribute("data-full");
    document.documentElement.style.overflow = "";
    setFull(false);
  }, []);

  useEffect(() => {
    const onChange = () => {
      const el = node.current;
      if (wholePage) {
        setFull(!!document.fullscreenElement);
        return;
      }
      if (!el) return;
      if (document.fullscreenElement === el) el.setAttribute("data-full", "screen");
      else if (el.dataset.full === "screen") el.removeAttribute("data-full");
      setFull(!!el.dataset.full);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") leavePage();
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("keydown", onKey);
    queueMicrotask(() => setCanWholePage(!!document.fullscreenEnabled));
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("keydown", onKey);
      leavePage();
    };
  }, [wholePage, leavePage]);

  const toggle = useCallback(() => {
    const el = wholePage ? document.documentElement : node.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    if (el.dataset.full === "page") {
      leavePage();
      return;
    }
    const overPage = () => {
      if (wholePage) return;
      el.setAttribute("data-full", "page");
      document.documentElement.style.overflow = "hidden";
      setFull(true);
    };
    if (document.fullscreenEnabled && typeof el.requestFullscreen === "function") el.requestFullscreen().catch(overPage);
    else overPage();
  }, [wholePage, leavePage]);

  return { ref, full, toggle, canWholePage };
}

export function FullscreenButton({ full, onClick, className, iconClassName = "size-5" }: { full: boolean; onClick: () => void; className?: string; iconClassName?: string }) {
  const label = full ? "სრული ეკრანიდან გამოსვლა" : "სრულ ეკრანზე გაშლა";
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={full} className={cn("flex size-10 items-center justify-center rounded-lg bg-card/92 text-ink shadow-sm", className)}>
      {full ? <Minimize2 className={iconClassName} /> : <Maximize2 className={iconClassName} />}
    </button>
  );
}
