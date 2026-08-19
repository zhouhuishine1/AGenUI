/** Right panel: tabbed protocol editors + QR code + save bar. */

import { redo, undo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProtocolEditor } from "./ProtocolEditor";
import { SaveBar, type SaveState } from "./SaveBar";
import { RedoIcon, UndoIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { A2uiPayload } from "@/types";

type Tab = "components" | "datamodel";
type HistoryAvailability = { canUndo: boolean; canRedo: boolean };

const EMPTY_HISTORY: HistoryAvailability = { canUndo: false, canRedo: false };

interface ProtocolPanelProps {
  componentsText: string;
  datamodelText: string;
  onComponentsChange: (value: string) => void;
  onDatamodelChange: (value: string) => void;
  editorScope: string;
  streaming: boolean;
  protocolId: string | null;
  selectComponentId?: { id: string; seq: number } | null;
  onComponentSelection?: (id: string | null) => void;
  onSave: (components: A2uiPayload, datamodel: A2uiPayload | null) => Promise<void>;
}

export function ProtocolPanel({
  componentsText,
  datamodelText,
  onComponentsChange,
  onDatamodelChange,
  editorScope,
  streaming,
  protocolId,
  selectComponentId,
  onComponentSelection,
  onSave,
}: ProtocolPanelProps) {
  const [tab, setTab] = useState<Tab>("components");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [historyAvailability, setHistoryAvailability] = useState<Record<Tab, HistoryAvailability>>({
    components: EMPTY_HISTORY,
    datamodel: EMPTY_HISTORY,
  });
  const componentsViewRef = useRef<EditorView | null>(null);
  const datamodelViewRef = useRef<EditorView | null>(null);
  const historyStatesRef = useRef<Record<string, Partial<Record<Tab, unknown>>>>({});

  // Reset save feedback whenever the loaded content changes.
  useEffect(() => {
    setSaveState("idle");
    setSaveError(null);
  }, [protocolId, componentsText, datamodelText]);

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

  useEffect(() => {
    if (selectComponentId) setTab("components");
  }, [selectComponentId]);

  return (
    <div className="flex h-full min-w-0 flex-col border-l border-slate-200 bg-slate-50/50">
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
                selectComponentId={selectComponentId}
                onComponentSelection={onComponentSelection}
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
    </div>
  );
}
