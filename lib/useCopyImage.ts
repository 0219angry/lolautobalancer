import { useRef, useState, useCallback, RefObject } from "react";
import { toPng } from "html-to-image";

export function useCopyImage(): {
  ref: RefObject<HTMLDivElement | null>;
  copy: () => Promise<boolean>;
  copying: boolean;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [copying, setCopying] = useState(false);

  const copy = useCallback(async (): Promise<boolean> => {
    if (!ref.current) return false;
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      console.error("このブラウザは画像のクリップボードコピーに対応していません。");
      return false;
    }
    setCopying(true);
    try {
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        backgroundColor: "#0f1218",
        pixelRatio: 3,
        filter: (node) => !(node instanceof HTMLElement && "noCapture" in node.dataset),
      });
      const blob = await fetch(dataUrl).then((r) => r.blob());
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return true;
    } catch (error) {
      console.error("画像のコピーに失敗しました:", error);
      return false;
    } finally {
      setCopying(false);
    }
  }, []);

  return { ref, copy, copying };
}
