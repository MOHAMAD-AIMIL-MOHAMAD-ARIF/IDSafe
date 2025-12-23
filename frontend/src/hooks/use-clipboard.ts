import { useCallback, useState } from "react";

type ClipboardState = {
  copiedText: string | null;
  copy: (value: string) => Promise<boolean>;
};

export function useClipboard(): ClipboardState {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedText(value);
      return true;
    } catch (error) {
      console.error("Clipboard copy failed", error);
      setCopiedText(null);
      return false;
    }
  }, []);

  return { copiedText, copy };
}
