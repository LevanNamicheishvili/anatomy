/**
 * A tiny external store for values the 3D view updates often (hover label, permanent labels). Keeping
 * them out of the app state means only the overlay that shows them re-renders.
 */
export function createChannel<T>() {
  let value: T | null = null;
  const listeners = new Set<() => void>();
  return {
    set(next: T | null) {
      if (next === value) return;
      value = next;
      for (const l of listeners) l();
    },
    get: () => value,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export type Channel<T> = ReturnType<typeof createChannel<T>>;
