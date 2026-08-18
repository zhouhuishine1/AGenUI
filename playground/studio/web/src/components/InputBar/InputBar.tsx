/** Bottom input bar: model selector (left), auto-growing textarea, send/stop (right). */

import { useEffect, useRef, useState } from "react";
import { ConfigModal } from "./ConfigModal";
import { ModelSelector } from "./ModelSelector";
import { SendButton } from "./SendButton";
import { SettingsIcon, XIcon } from "@/components/icons";
import { ImageIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Provider } from "@/types";
import type { ImageAttachment } from "@/api/sse";

const LAST_SELECTED_MODEL_KEY = "agenui.studio.last-selected-model";

function readLastSelectedModel(): string | null {
  try {
    return window.localStorage.getItem(LAST_SELECTED_MODEL_KEY);
  } catch {
    return null;
  }
}

interface InputBarProps {
  providers: Provider[];
  active: string | null;
  /** Whether the provider list has finished its initial load (avoids flashing
   * the setup tip before we know if any api_key is configured). */
  providersLoaded: boolean;
  isGenerating: boolean;
  onSend: (prompt: string, provider: string | null, reasoning: boolean, images: ImageAttachment[]) => void;
  onStop: () => void;
  onConfigSaved: () => void;
  value: string;
  onValueChange: (value: string) => void;
}

export function InputBar({
  providers,
  active,
  providersLoaded,
  isGenerating,
  onSend,
  onStop,
  onConfigSaved,
  value,
  onValueChange,
}: InputBarProps) {
  const [provider, setProvider] = useState<string | null>(readLastSelectedModel);
  const [reasoning, setReasoning] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [setupTipDismissed, setSetupTipDismissed] = useState(false);
const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageAttachment[]>([]);

  // Keep the persisted choice only while it remains configured. If a provider
  // was removed, ModelSelector falls back to the server's active provider.
  useEffect(() => {
    if (provider && providers.length > 0 && !providers.some((item) => item.name === provider)) {
      setProvider(null);
    }
  }, [provider, providers]);

  const handleProviderChange = (name: string) => {
    setProvider(name);
    try {
      window.localStorage.setItem(LAST_SELECTED_MODEL_KEY, name);
    } catch {
      // Storage may be unavailable in private browsing or embedded previews.
    }
  };

  // Nudge the user to configure a model when no provider has an api_key yet.
  const showSetupTip = providersLoaded && providers.length === 0 && !setupTipDismissed;

  // Auto-dismiss the setup tip after 10 seconds.
  useEffect(() => {
    if (!showSetupTip) return;
    const timer = window.setTimeout(() => setSetupTipDismissed(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [showSetupTip]);

  const canSend = (value.trim().length > 0 || images.length > 0) && !isGenerating;

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleSend = () => {
    const prompt = value.trim();
    if ((!prompt && images.length === 0) || isGenerating) return;
    onSend(prompt || "Describe the attached image and create the requested A2UI interface.", provider, reasoning, images);
    onValueChange("");
    setImages([]);
    requestAnimationFrame(autoResize);
  };

  const addFiles = (files: FileList | File[]) => {
    const selected = Array.from(files).filter((file) => file.type.startsWith("image/"));
    selected.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl === "string") {
          setImages((current) => [...current, { data_url: dataUrl }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
      <div className="mx-auto max-w-3xl space-y-2">
        {/* Input row: full-width auto-growing textarea. */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition focus-within:border-brand-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500/15">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={isGenerating}
            placeholder={
              isGenerating
                ? "Generating, please wait..."
                : "Describe the UI you want, e.g. generate a weather card showing city, temperature and condition"
            }
            onChange={(e) => {
              onValueChange(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files).filter((file) => file.type.startsWith("image/"));
              if (files.length > 0) {
                e.preventDefault();
                addFiles(files);
              }
            }}
            className="block w-full resize-none bg-transparent text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
          />
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {images.map((image, index) => (
                <div key={image.data_url} className="relative h-12 w-12 overflow-hidden rounded-md border border-slate-200 bg-white">
                  <img src={image.data_url} alt={`Attachment ${index + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove image" className="absolute right-0 top-0 rounded-bl bg-slate-800/70 p-0.5 text-white"><XIcon size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom row: model selector + settings + reasoning (left), hint + send/stop (right). */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isGenerating} title="Add image" className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-600 disabled:opacity-60"><ImageIcon size={14} /></button>
            <ModelSelector
              providers={providers}
              active={active}
              value={provider}
              disabled={isGenerating}
              onChange={handleProviderChange}
            />
            {/* Settings + reasoning form a tight control cluster. */}
            <div className="flex items-start gap-1.5">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setConfigOpen(true);
                    setSetupTipDismissed(true);
                  }}
                  title="Configure model API keys"
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
                >
                  <SettingsIcon size={14} />
                </button>

                {showSetupTip && (
                  <div className="absolute bottom-full left-0 z-20 mb-2.5 w-60 rounded-lg bg-slate-900 px-3 py-2.5 shadow-xl">
                    {/* Arrow pointing down at the settings button. */}
                    <span className="absolute -bottom-1 left-3 h-2 w-2 rotate-45 bg-slate-900" />
                    <div className="flex items-start gap-2">
                      <p className="flex-1 text-xs leading-relaxed text-slate-100">
                        No model configured yet — click here to add your API key.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSetupTipDismissed(true)}
                        aria-label="Dismiss"
                        className="-mr-1 -mt-0.5 rounded p-0.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                      >
                        <XIcon size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Reasoning switch with hover tooltip. */}
              <div className="group relative flex h-[30px] items-center gap-1.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={reasoning}
                  onClick={() => setReasoning((r) => !r)}
                  disabled={isGenerating}
                  className={cn(
                    "relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
                    reasoning ? "bg-brand-500" : "bg-slate-300",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow transition-transform duration-200",
                      reasoning ? "translate-x-[16px]" : "translate-x-[2px]",
                    )}
                  />
                </button>
                <span
                  className={cn(
                    "text-xs font-medium transition-colors",
                    reasoning ? "text-brand-600" : "text-slate-400",
                  )}
                >
                  Reasoning
                </span>

                {/* Hover tooltip: warn that reasoning slows generation down. */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[230px] -translate-x-1/2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-center text-[11px] leading-snug text-slate-100 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
                  <span className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-slate-900" />
                  Enabling model reasoning may increase generation time
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="hidden text-[11px] text-slate-400 md:block">
              Enter to send, Shift+Enter for a new line
            </span>
            <SendButton
              isGenerating={isGenerating}
              canSend={canSend}
              onSend={handleSend}
              onStop={onStop}
            />
          </div>
        </div>
      </div>

      {/* Config modal */}
      <ConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={onConfigSaved}
      />
    </div>
  );
}
