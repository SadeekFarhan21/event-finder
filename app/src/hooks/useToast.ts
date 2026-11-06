import { useCallback, useEffect, useRef, useState } from "react";

// A short status line under the header. Sticky messages stay until replaced (e.g. "Searching…").
export function useToast() {
  const [toast, setToast] = useState<{ text: string; visible: boolean }>({ text: "", visible: false });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((text: string, sticky = false) => {
    clearTimeout(timer.current);
    setToast({ text, visible: true });
    if (!sticky) timer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2400);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, show };
}
