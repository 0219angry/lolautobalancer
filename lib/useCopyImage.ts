import { useRef, useState, useCallback, RefObject } from "react";
import { toPng } from "html-to-image";

export function useCopyImage(): {
  ref: RefObject<HTMLDivElement | null>;
  copy: () => Promise<void>;
  copying: boolean;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [copying, setCopying] = useState(false);

  const copy = useCallback(async () => {
    if (!ref.current) return;
    setCopying(true);
    try {
      const dataUrl = await toPng(ref.current, { cacheBust: true });
      const blob = await fetch(dataUrl).then((r) => r.blob());
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } finally {
      setCopying(false);
    }
  }, []);

  return { ref, copy, copying };
}
