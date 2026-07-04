import { useEffect } from "preact/hooks";

interface ReaderHotkeysProps {
  onPrev?: () => void;
  onNext?: () => void;
  activePostId: string | null;
}

export function useReaderHotkeys({
  onPrev,
  onNext,
  activePostId,
}: ReaderHotkeysProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in input, select, textarea, or contenteditable elements
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          activeEl.hasAttribute("contenteditable"))
      ) {
        return;
      }

      if (e.key === "ArrowLeft" && onPrev) {
        onPrev();
      } else if (e.key === "ArrowRight" && onNext) {
        onNext();
      } else if (activePostId) {
        const readerPane = document.getElementById("reader-pane");
        if (readerPane) {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            readerPane.scrollBy({ top: -200, behavior: "smooth" });
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            readerPane.scrollBy({ top: 200, behavior: "smooth" });
          } else if (e.key === "PageUp") {
            e.preventDefault();
            readerPane.scrollBy({
              top: -readerPane.clientHeight * 0.8,
              behavior: "smooth",
            });
          } else if (e.key === "PageDown") {
            e.preventDefault();
            readerPane.scrollBy({
              top: readerPane.clientHeight * 0.8,
              behavior: "smooth",
            });
          } else if (e.key === " " && !e.shiftKey) {
            e.preventDefault();
            readerPane.scrollBy({
              top: readerPane.clientHeight * 0.8,
              behavior: "smooth",
            });
          } else if (e.key === " " && e.shiftKey) {
            e.preventDefault();
            readerPane.scrollBy({
              top: -readerPane.clientHeight * 0.8,
              behavior: "smooth",
            });
          } else if (e.key === "Home") {
            e.preventDefault();
            readerPane.scrollTo({ top: 0, behavior: "smooth" });
          } else if (e.key === "End") {
            e.preventDefault();
            readerPane.scrollTo({
              top: readerPane.scrollHeight,
              behavior: "smooth",
            });
          }
        }
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [onPrev, onNext, activePostId]);
}
