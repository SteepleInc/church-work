import { useEffect, useState } from "react";

export function usePasteDetect() {
  const [pastedContent, setPastedContent] = useState<
    string | Array<File> | Record<string, string> | null
  >(null);
  const [pasteType, setPasteType] = useState<Array<string> | null>(null);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      const types = Array.from(clipboardData.types);
      setPasteType(types);

      if (clipboardData.types.includes("text/plain")) {
        setPastedContent(clipboardData.getData("text/plain"));
      } else if (clipboardData.types.includes("Files")) {
        setPastedContent(Array.from(clipboardData.files));
      } else {
        const content: Record<string, string> = {};
        types.forEach((type) => {
          content[type] = clipboardData.getData(type);
        });
        setPastedContent(content);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const resetPasteContent = () => {
    setPastedContent(null);
    setPasteType(null);
  };

  return { pastedContent, pasteType, resetPasteContent };
}
