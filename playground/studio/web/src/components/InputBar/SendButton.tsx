/** Send button: idle -> "Send" (primary), generating -> "Stop" (danger).
 *
 * Hovering the idle Send button for 1 second reveals a hint about the
 * keyboard shortcuts (Enter to send, Shift+Enter for a new line).
 */

import { useEffect, useRef, useState } from "react";
import { SendIcon, StopIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface SendButtonProps {
  isGenerating: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
}

export function SendButton({ isGenerating, canSend, onSend, onStop }: SendButtonProps) {
  const [showHint, setShowHint] = useState(false);
  const hintTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
  }, []);

  if (isGenerating) {
    return (
      <button
        type="button"
        onClick={onStop}
        title="Stop generation"
        className="flex h-9 items-center gap-1.5 rounded-lg bg-red-500 px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-600 active:scale-95"
      >
        <StopIcon size={14} />
        Stop
      </button>
    );
  }

  const startHintTimer = () => {
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setShowHint(true), 1000);
  };

  const clearHintTimer = () => {
    if (hintTimerRef.current !== null) {
      window.clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
    setShowHint(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={startHintTimer}
      onMouseLeave={clearHintTimer}
      onFocus={startHintTimer}
      onBlur={clearHintTimer}
    >
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        className={cn(
          "flex h-[30px] items-center gap-1 rounded-lg px-2.5 text-xs font-medium shadow-sm transition active:scale-95",
          canSend
            ? "bg-brand-500 text-white hover:bg-brand-600"
            : "cursor-not-allowed bg-slate-200 text-slate-400",
        )}
      >
        <SendIcon size={14} />
        Send
      </button>

      {/* Delayed hover tooltip: keyboard shortcut hint. */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-max max-w-[240px] rounded-lg bg-slate-900 px-2.5 py-1.5 text-center text-[11px] leading-snug text-slate-100 shadow-xl transition-opacity duration-150",
          showHint ? "opacity-100" : "opacity-0",
        )}
        role="tooltip"
      >
        <span className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 bg-slate-900" />
        Enter to send, Shift+Enter for a new line
      </div>
    </div>
  );
}
