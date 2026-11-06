// Network plumbing shared by every request: a timeout, and a simple online/offline signal the
// banner listens to. Failing requests mark us offline; the next success clears it.
type Listener = (offline: boolean) => void;
let offline = false;
const listeners = new Set<Listener>();

const setOffline = (next: boolean) => {
  if (next === offline) return;
  offline = next;
  listeners.forEach((l) => l(offline));
};

export const isOffline = () => offline;
export function onNetworkChange(l: Listener) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export class TimeoutError extends Error {
  constructor() { super("The connection timed out. Check your signal and try again."); this.name = "TimeoutError"; }
}

// fetch with a deadline. HTTP errors are still "online" (the server answered); only thrown
// network errors and timeouts flip the offline signal.
export function fetchWithTimeout(timeoutMs: number): typeof fetch {
  return async (input, init) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    init?.signal?.addEventListener?.("abort", () => ctrl.abort());
    try {
      const res = await fetch(input, { ...init, signal: ctrl.signal });
      setOffline(false);
      return res;
    } catch (err) {
      setOffline(true);
      throw ctrl.signal.aborted && !init?.signal?.aborted ? new TimeoutError() : err;
    } finally {
      clearTimeout(timer);
    }
  };
}
