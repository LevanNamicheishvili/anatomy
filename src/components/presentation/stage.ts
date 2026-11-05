/** What every screen of the presentation gets: it tells when its picture is ready, so the curtain can open. */
export interface StageProps {
  onReady: () => void;
}

export const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

/**
 * The graphics memory of a scene that has left the screen is given back at once, not whenever the browser gets round
 * to it: otherwise it piles up from screen to screen, and on an ordinary computer the show starts to stall.
 */
export function releaseCanvases(canvases: HTMLCanvasElement[]) {
  for (const canvas of canvases) {
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/**
 * No more pixels than the hall can see: a projector shows 1080p, while drawing a Retina screen in full is four times
 * the work. The scenes read this when they are made. Leaving the presentation reloads the page, which restores it.
 */
export function capPixelRatio(max = 1.25) {
  if (typeof window !== "undefined" && window.devicePixelRatio > max) Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => max });
}
