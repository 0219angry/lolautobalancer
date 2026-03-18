import { useState, useRef, useCallback } from "react";

export function useToast() {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToastMsg(msg);
    timerRef.current = setTimeout(() => {
      setToastMsg(null);
      timerRef.current = null;
    }, 3000);
  }, []);

  return { toastMsg, showToast };
}
