/** Web preview strip for reference renderings and generated A2UI output.
 *
 * Clicking the preview opens a lightbox overlay (click outside or X to close).
 */

import { useEffect, useState } from "react";
import { ImageOffIcon, XIcon } from "@/components/icons";
import { A2uiPreview } from "./A2uiPreview";
import { VisualEditorToolbar } from "./VisualEditorToolbar";
import type { A2uiPayload } from "@/types";

interface PreviewScanStripProps {
  /** Present only when a preset is selected; null = custom protocol. */
  presetId: string | null;
  /** URL of rendering.png; null means no image available. */
  renderingUrl: string | null;
  componentsText: string;
  datamodelText: string;
  /** Called with the component id when the user clicks a preview element. */
  onSelectComponent?: (id: string | null) => void;
  selectedComponentId?: string;
  onComponentsChange?: (componentsText: string) => void;
  onParseErrorChange?: (error: string | null) => void;
}

export function PreviewScanStrip({ presetId, renderingUrl, componentsText, datamodelText, onSelectComponent, selectedComponentId, onComponentsChange, onParseErrorChange }: PreviewScanStripProps) {
  const [lightbox, setLightbox] = useState(false);
  const [preview, setPreview] = useState<{ components: A2uiPayload; datamodel: A2uiPayload | null } | null>(null);
  const [referenceSize, setReferenceSize] = useState<{ width: number; height: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

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

  if (!presetId && !componentsText.trim() && !datamodelText.trim() && !preview && !parseError) return null;

  return (
    <div className="h-full min-h-0 border-b border-slate-200 bg-white p-2.5">
      <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70">
          {preview && onComponentsChange && <VisualEditorToolbar components={preview.components} datamodel={preview.datamodel} selectedComponentId={selectedComponentId} onChange={(next) => onComponentsChange(JSON.stringify(next, null, 2))} />}
          {preview ? (
            <div className="min-h-0 flex-1"><A2uiPreview components={preview.components} datamodel={preview.datamodel} referenceSize={referenceSize} fit="contain" onAction={() => undefined} onSelectComponent={onSelectComponent} selectedComponentId={selectedComponentId} /></div>
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
      </div>
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
    </div>
  );
}
