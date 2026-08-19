/** Top strip combining reference rendering (presets) and QR code.
 *
 * Layout variants:
 * - Preset selected: rendering preview (flexible) left + QR card (fixed) right.
 * - Custom protocol: QR card centered, no rendering area.
 *
 * Clicking the preview opens a lightbox overlay (click outside or X to close).
 */

import { useEffect, useState } from "react";
import { ImageOffIcon, XIcon } from "@/components/icons";
import { A2uiPreview } from "./A2uiPreview";
import { QrCodeCard } from "./QrCodeCard";
import type { A2uiPayload } from "@/types";

interface PreviewScanStripProps {
  /** Present only when a preset is selected; null = custom protocol. */
  presetId: string | null;
  /** URL of rendering.png; null means no image available. */
  renderingUrl: string | null;
  /** Protocol raw URL encoded in the QR code. */
  qrUrl: string | null;
  componentsText: string;
  datamodelText: string;
  /** Called with the component id when the user clicks a preview element. */
  onSelectComponent?: (id: string) => void;
  onParseErrorChange?: (error: string | null) => void;
}

export function PreviewScanStrip({ presetId, renderingUrl, qrUrl, componentsText, datamodelText, onSelectComponent, onParseErrorChange }: PreviewScanStripProps) {
  const [lightbox, setLightbox] = useState(false);
  const [expandedPreview, setExpandedPreview] = useState(false);
  const [preview, setPreview] = useState<{ components: A2uiPayload; datamodel: A2uiPayload | null } | null>(null);
  const [referenceSize, setReferenceSize] = useState<{ width: number; height: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);

  // Close lightbox on Escape.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setLightbox(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    if (!componentsText.trim()) {
      setPreview(null);
      setParseError(null);
      onParseErrorChange?.(null);
      return;
    }
    try {
      const components = JSON.parse(componentsText) as A2uiPayload;
      const datamodel = datamodelText.trim() ? JSON.parse(datamodelText) as A2uiPayload : null;
      setPreview(Object.keys(components).length > 0 ? { components, datamodel } : null);
      setParseError(null);
      onParseErrorChange?.(null);
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : "Invalid JSON";
      setParseError(error);
      onParseErrorChange?.(error);
    }
  }, [componentsText, datamodelText, onParseErrorChange]);

  useEffect(() => {
    if (!renderingUrl) {
      setReferenceSize(null);
      return;
    }
    const image = new Image();
    image.onload = () => setReferenceSize({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => setReferenceSize(null);
    image.src = renderingUrl;
    return () => { image.onload = null; image.onerror = null; };
  }, [renderingUrl]);

  if (!qrUrl && !presetId && !componentsText.trim() && !datamodelText.trim() && !preview && !parseError) return null;

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white p-2.5">
      <div className="flex items-stretch gap-2.5">
        <div className="relative h-[224px] min-w-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70">
          {preview ? (
            <A2uiPreview components={preview.components} datamodel={preview.datamodel} referenceSize={referenceSize} fit="width" onAction={(payload) => setAction(JSON.stringify(payload))} onSelectComponent={onSelectComponent} />
          ) : renderingUrl ? (
              <button
                type="button"
                onClick={() => setLightbox(true)}
                title="Click to enlarge"
                className="absolute inset-0 cursor-zoom-in"
              >
                <img
                  src={renderingUrl}
                  alt="Reference rendering"
                  className="h-full w-full object-contain"
                />
              </button>
          ) : (
              <div className="flex h-full min-h-[80px] flex-col items-center justify-center gap-1.5 text-slate-300">
                <ImageOffIcon size={16} />
                <span className="text-[10px]">No preview</span>
              </div>
          )}
          {preview && <button type="button" onClick={() => setExpandedPreview(true)} aria-label="Resize preview" title="Resize preview" className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white/90 text-slate-500 shadow-sm transition hover:bg-white hover:text-brand-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
          </button>}
        </div>
        {qrUrl && <QrCodeCard url={qrUrl} />}
      </div>
      {action && <p className="mt-1 truncate text-[10px] text-brand-600">Action captured (local preview only): {action}</p>}

      {/* Lightbox overlay */}
      {lightbox && renderingUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <div
            className="relative max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 shadow-lg transition hover:bg-slate-100 hover:text-slate-700"
            >
              <XIcon size={14} />
            </button>
            <img
              src={renderingUrl}
              alt="Reference rendering (full size)"
              className="max-h-[80vh] max-w-full rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
      {expandedPreview && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8 backdrop-blur-sm" onClick={() => setExpandedPreview(false)}>
          <div role="dialog" aria-modal="true" aria-label="Resizable preview" className="relative h-[680px] w-[760px] min-h-[280px] min-w-[320px] max-h-[calc(100vh-4rem)] max-w-[calc(100vw-4rem)] resize overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex h-10 shrink-0 items-center border-b border-slate-200 bg-white px-3">
              <p className="text-xs font-medium text-slate-600">Preview</p>
              <button type="button" onClick={() => setExpandedPreview(false)} aria-label="Close preview" className="ml-auto rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><XIcon size={16} /></button>
            </div>
            <div className="h-[calc(100%-2.5rem)]">
              <A2uiPreview components={preview.components} datamodel={preview.datamodel} referenceSize={referenceSize} onAction={(payload) => setAction(JSON.stringify(payload))} onSelectComponent={onSelectComponent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
