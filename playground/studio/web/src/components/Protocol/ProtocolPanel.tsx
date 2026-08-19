/** Right panel: tabbed protocol editors + QR code + save bar. */

import { redo, undo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProtocolEditor } from "./ProtocolEditor";
import { PreviewScanStrip } from "./PreviewScanStrip";
import { SaveBar, type SaveState } from "./SaveBar";
import { BoxIcon, RedoIcon, UndoIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { A2uiPayload } from "@/types";

type Tab = "components" | "datamodel";
type HistoryAvailability = { canUndo: boolean; canRedo: boolean };

const EMPTY_HISTORY: HistoryAvailability = { canUndo: false, canRedo: false };

interface ProtocolPanelProps {
  title: string;
  componentsText: string;
  datamodelText: string;
  onComponentsChange: (value: string) => void;
  onDatamodelChange: (value: string) => void;
  editorScope: string;
  streaming: boolean;
  protocolId: string | null;
  /** Selected preset id (null for non-preset protocols). */
  presetId: string | null;
  /** rendering.png URL for the selected preset, or null. */
  renderingUrl: string | null;
  qrUrl: string | null;
  onSave: (components: A2uiPayload, datamodel: A2uiPayload | null) => Promise<void>;
  editableTitle: boolean;
  onTitleChange: (title: string) => Promise<void>;
  onTitleError: (message: string) => void;
}

export function ProtocolPanel({
  title,
  componentsText,
  datamodelText,
  onComponentsChange,
  onDatamodelChange,
  editorScope,
  streaming,
  protocolId,
  presetId,
  renderingUrl,
  qrUrl,
  onSave,
  editableTitle,
  onTitleChange,
  onTitleError,
}: ProtocolPanelProps) {
  const [tab, setTab] = useState<Tab>("components");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [componentSelection, setComponentSelection] = useState<{ id: string; seq: number } | null>(null);
  const [historyAvailability, setHistoryAvailability] = useState<Record<Tab, HistoryAvailability>>({
    components: EMPTY_HISTORY,
    datamodel: EMPTY_HISTORY,
  });
  const selectionSeqRef = useRef(0);
  const componentsViewRef = useRef<EditorView | null>(null);
  const datamodelViewRef = useRef<EditorView | null>(null);
  const historyStatesRef = useRef<Record<string, Partial<Record<Tab, unknown>>>>({});

  useEffect(() => setTitleValue(title), [title]);
  const saveTitle = async () => {
    try {
      await onTitleChange(titleValue);
      setEditingTitle(false);
    } catch (err) {
      setSaveState("error");
      const message = err instanceof Error ? err.message : "Title save failed";
      setSaveError(message);
      onTitleError(message);
      setTitleValue(title);
    }
  };

  // Reset save feedback whenever the loaded content changes.
  useEffect(() => {
    setSaveState("idle");
    setSaveError(null);
  }, [protocolId, title, componentsText, datamodelText]);

  const handleSave = async () => {
    let components: A2uiPayload;
    let datamodel: A2uiPayload | null = null;
    try {
      components = JSON.parse(componentsText || "{}");
      if (datamodelText.trim()) datamodel = JSON.parse(datamodelText);
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? `Invalid JSON: ${err.message}` : "Invalid JSON");
      return;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      await onSave(components, datamodel);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Save failed");
    }
  };

  // Undo/redo operate on the active tab's CodeMirror history.
  const dispatchHistoryCommand = useCallback((command: (target: { state: EditorView["state"]; dispatch: EditorView["dispatch"] }) => boolean) => {
    const view = tab === "components" ? componentsViewRef.current : datamodelViewRef.current;
    if (!view) return;
    command({ state: view.state, dispatch: view.dispatch });
  }, [tab]);

  const handleUndo = () => dispatchHistoryCommand(undo);
  const handleRedo = () => dispatchHistoryCommand(redo);
  const activeHistory = historyAvailability[tab];
  const handleHistoryChange = useCallback((editorTab: Tab, history: HistoryAvailability) => {
    setHistoryAvailability((current) => current[editorTab].canUndo === history.canUndo && current[editorTab].canRedo === history.canRedo
      ? current
      : { ...current, [editorTab]: history });
  }, []);

  // Preview click -> select the matching JSON object in the components tab.
  const handleSelectComponent = useCallback((id: string) => {
    selectionSeqRef.current += 1;
    setComponentSelection({ id, seq: selectionSeqRef.current });
    setTab("components");
  }, []);

  return (
    <div className="flex h-full min-w-0 flex-col border-l border-slate-200 bg-slate-50/50">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <BoxIcon size={15} className="text-brand-500" />
        {editableTitle && editingTitle ? (
          <input autoFocus value={titleValue} maxLength={1024} onChange={(event) => setTitleValue(event.target.value)} onBlur={() => void saveTitle()} onKeyDown={(event) => { if (event.key === "Enter") void saveTitle(); if (event.key === "Escape") { setTitleValue(title); setEditingTitle(false); } }} aria-label="Session title" className="min-w-0 flex-1 rounded border border-brand-300 px-1 text-xs font-semibold text-slate-700 outline-none" />
        ) : (
          <button type="button" onClick={() => editableTitle && setEditingTitle(true)} className="truncate text-left text-xs font-semibold text-slate-700" title={editableTitle ? "Click to rename session" : title}>{title || "Protocol"}</button>
        )}
        {streaming && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
            Streaming
          </span>
        )}
      </div>

      {/* Preview & Scan strip: rendering (presets) + QR code. */}
      <PreviewScanStrip
        presetId={presetId}
        renderingUrl={renderingUrl}
        qrUrl={qrUrl}
        componentsText={componentsText}
        datamodelText={datamodelText}
        onSelectComponent={handleSelectComponent}
        onParseErrorChange={setParseError}
      />

      <>
        <>
          {/* Tabs */}
          <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-2 pt-1.5">
            {(["components", "datamodel"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-t-md px-3 py-1.5 text-xs font-medium transition",
                  tab === t
                    ? "border border-b-0 border-slate-200 bg-slate-50 text-brand-600"
                    : "text-slate-400 hover:text-slate-600",
                )}
              >
                {t === "components" ? "updateComponents" : "updateDataModel"}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={streaming || !activeHistory.canUndo}
                title="Undo"
                aria-label="Undo"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              >
                <UndoIcon size={14} />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={streaming || !activeHistory.canRedo}
                title="Redo"
                aria-label="Redo"
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              >
                <RedoIcon size={14} />
              </button>
            </div>
          </div>

          {/* Editor */}
          <div className="min-h-0 flex-1 overflow-hidden bg-white">
            <div className={cn("h-full", tab !== "components" && "hidden")}>
              <ProtocolEditor
                key={`${editorScope}-components`}
                value={componentsText}
                onChange={onComponentsChange}
                readOnly={streaming}
                viewRef={componentsViewRef}
                onHistoryChange={(history) => handleHistoryChange("components", history)}
                historyState={historyStatesRef.current[editorScope]?.components}
                onHistoryStateChange={(state) => { historyStatesRef.current[editorScope] = { ...historyStatesRef.current[editorScope], components: state }; }}
                selectComponentId={componentSelection}
              />
            </div>
            <div className={cn("h-full", tab !== "datamodel" && "hidden")}>
              <ProtocolEditor
                key={`${editorScope}-datamodel`}
                value={datamodelText}
                onChange={onDatamodelChange}
                readOnly={streaming}
                viewRef={datamodelViewRef}
                onHistoryChange={(history) => handleHistoryChange("datamodel", history)}
                historyState={historyStatesRef.current[editorScope]?.datamodel}
                onHistoryStateChange={(state) => { historyStatesRef.current[editorScope] = { ...historyStatesRef.current[editorScope], datamodel: state }; }}
              />
            </div>
          </div>

          {/* Footer: save */}
          <div className="shrink-0 border-t border-slate-200 bg-white p-2.5">
            <SaveBar
              canSave={protocolId != null}
              saveState={saveState}
              saveError={saveError}
              parseError={parseError}
              onSave={handleSave}
            />
          </div>
        </>
      </>
    </div>
  );
}
