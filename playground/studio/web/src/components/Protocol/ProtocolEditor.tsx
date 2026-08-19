/** CodeMirror 6 JSON editor for one A2UI payload (components or datamodel). */

import { json } from "@codemirror/lang-json";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";
import { historyField, redoDepth, undoDepth } from "@codemirror/commands";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useEffect, useMemo, useState, type MutableRefObject } from "react";

interface ProtocolEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** While streaming, the editor is driven by the token stream (read-only). */
  readOnly: boolean;
  /** Receives the underlying EditorView so the parent can dispatch undo/redo. */
  viewRef?: MutableRefObject<EditorView | null>;
  /** Receives current undo/redo availability for the editor history. */
  onHistoryChange?: (history: { canUndo: boolean; canRedo: boolean }) => void;
  historyState?: unknown;
  onHistoryStateChange?: (state: unknown) => void;
  /** When set, the JSON object whose top-level "id" matches is selected and
   * scrolled into view (used by preview click-to-select). */
  selectComponentId?: { id: string; seq: number } | null;
}

/** Find the string value of the first JSON property named "id" matching targetId. */
function findObjectWithId(node: SyntaxNode, doc: string, targetId: string): SyntaxNode | null {
  if (node.type.name === "Object") {
    let child = node.firstChild;
    while (child) {
      if (child.type.name === "Property") {
        const key = child.firstChild;
        const colon = key?.nextSibling ?? null;
        const value = colon?.nextSibling ?? null;
        if (
          key && value &&
          doc.slice(key.from, key.to) === '"id"' &&
          value.type.name === "String" &&
          doc.slice(value.from, value.to) === JSON.stringify(targetId)
        ) {
          return value;
        }
      }
      child = child.nextSibling;
    }
  }
  let child = node.firstChild;
  while (child) {
    const found = findObjectWithId(child, doc, targetId);
    if (found) return found;
    child = child.nextSibling;
  }
  return null;
}

const HISTORY_FIELDS = { history: historyField };

export function ProtocolEditor({ value, onChange, readOnly, viewRef, onHistoryChange, historyState, onHistoryStateChange, selectComponentId }: ProtocolEditorProps) {
  const extensions = useMemo(() => [
    json(),
    EditorView.updateListener.of((update) => {
      if (update.docChanged || update.transactions.some((transaction) => transaction.isUserEvent("undo") || transaction.isUserEvent("redo"))) {
        onHistoryChange?.({ canUndo: undoDepth(update.state) > 0, canRedo: redoDepth(update.state) > 0 });
        onHistoryStateChange?.(update.state.toJSON(HISTORY_FIELDS));
      }
    }),
  ], [onHistoryChange]);
  const [view, setView] = useState<EditorView | null>(null);

  useEffect(() => {
    if (viewRef) viewRef.current = view;
    if (view) onHistoryChange?.({ canUndo: undoDepth(view.state) > 0, canRedo: redoDepth(view.state) > 0 });
  }, [view, viewRef, onHistoryChange]);

  // Select (and scroll to) the id value matching the requested preview component.
  useEffect(() => {
    if (!selectComponentId || !view) return;
    const doc = view.state.doc.toString();
    const node = findObjectWithId(syntaxTree(view.state).topNode, doc, selectComponentId.id);
    if (!node) return;
    view.dispatch({
      selection: { anchor: node.from, head: node.to },
      effects: EditorView.scrollIntoView(node.from, { y: "center" }),
      scrollIntoView: true,
    });
    view.focus();
  }, [selectComponentId, view]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      initialState={historyState ? { json: historyState, fields: HISTORY_FIELDS } : undefined}
      editable={!readOnly}
      onCreateEditor={setView}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: !readOnly,
        bracketMatching: true,
      }}
      height="100%"
      style={{ height: "100%", fontSize: 12 }}
      placeholder={readOnly ? "Waiting for protocol output..." : "{ }"}
    />
  );
}
