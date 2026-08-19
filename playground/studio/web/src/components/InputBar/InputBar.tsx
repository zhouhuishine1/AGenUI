/** Bottom input bar: model selector (left), auto-growing textarea, send/stop (right). */

import { useEffect, useRef, useState } from "react";
import { ModelSelector } from "./ModelSelector";
import { SendButton } from "./SendButton";
import { PlusIcon, XIcon } from "@/components/icons";
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
  isGenerating: boolean;
  onSend: (prompt: string, provider: string | null, reasoning: boolean, images: ImageAttachment[]) => void;
  onStop: () => void;
  value: string;
  onValueChange: (value: string) => void;
  sessionProvider?: string | null;
  sessionReasoning?: boolean;
}

export function InputBar({
  providers,
  active,
  isGenerating,
  onSend,
  onStop,
  value,
  onValueChange,
  sessionProvider,
  sessionReasoning,
}: InputBarProps) {
  const [provider, setProvider] = useState<string | null>(readLastSelectedModel);
  const [reasoning, setReasoning] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<ImageAttachment[]>([]);

  useEffect(() => {
    if (sessionProvider !== undefined) setProvider(sessionProvider);
    if (sessionReasoning !== undefined) setReasoning(sessionReasoning);
  }, [sessionProvider, sessionReasoning]);

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

  useEffect(() => {
    if (!addMenuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) setAddMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [addMenuOpen]);

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

        {/* Bottom row: model selector + add menu (left), send/stop (right). */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <div ref={addMenuRef} className="relative">
              <button type="button" onClick={() => setAddMenuOpen((open) => !open)} disabled={isGenerating} title="Add options" aria-expanded={addMenuOpen} className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-600 disabled:opacity-60"><PlusIcon size={15} /></button>
              {addMenuOpen && (
                <div className="absolute bottom-full left-0 z-20 mb-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                  <button type="button" onClick={() => { fileInputRef.current?.click(); setAddMenuOpen(false); }} className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50">Add image</button>
                  <div className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-xs text-slate-700 hover:bg-slate-50">
                    <span>Reasoning</span>
                    <button type="button" role="switch" aria-label="Reasoning" aria-checked={reasoning} onClick={() => setReasoning((enabled) => !enabled)} className={cn("relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full transition-colors", reasoning ? "bg-brand-500" : "bg-slate-300")}>
                      <span className={cn("inline-block h-[14px] w-[14px] rounded-full bg-white shadow transition-transform", reasoning ? "translate-x-[16px]" : "translate-x-[2px]")} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <ModelSelector
              providers={providers}
              active={active}
              value={provider}
              disabled={isGenerating}
              onChange={handleProviderChange}
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <SendButton
              isGenerating={isGenerating}
              canSend={canSend}
              onSend={handleSend}
              onStop={onStop}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
