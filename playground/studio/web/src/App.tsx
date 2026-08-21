/** AGenUI Studio root: three-column layout + generation orchestration. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ConversationPanel } from "@/components/Conversation/ConversationPanel";
import { Header } from "@/components/Header";
import { InputBar } from "@/components/InputBar/InputBar";
import { ConfigModal } from "@/components/InputBar/ConfigModal";
import { ProtocolPanel } from "@/components/Protocol/ProtocolPanel";
import { PreviewScanStrip } from "@/components/Protocol/PreviewScanStrip";
import { PresetSidebar, type Selection } from "@/components/Sidebar/PresetSidebar";
import { ChevronRightIcon } from "@/components/icons";
import { useGeneration } from "@/hooks/useGeneration";
import { useLibrary } from "@/hooks/useLibrary";
import { useProviders } from "@/hooks/useProviders";
import {
  fetchPreset,
  fetchProtocol,
  fetchSession,
  createSession,
  updateSession,
  generateSessionTitle,
  deleteSession,
  updateProtocol,
} from "@/api/client";
import type { A2uiPayload, ImageAttachment, RoundSnapshot } from "@/types";
import type { ChatMessage } from "@/api/sse";

type SplitRatios = [number, number, number];
type ComponentSelection = { id: string; seq: number; source: "preview" | "editor" };

const DEFAULT_SPLIT_RATIOS: SplitRatios = [1 / 3, 1 / 2, 1 / 2];
const MIN_SPLIT_RATIO = 0.15;
const GLOBAL_LAYOUT_STORAGE_KEY = "agenui-studio-workspace-layout";

function normalizedSplitRatios(ratios: readonly number[] | undefined): SplitRatios {
  if (!ratios || ratios.length !== 3 || ratios.some((ratio) => !Number.isFinite(ratio) || ratio <= 0)) return DEFAULT_SPLIT_RATIOS;
  const verticalTotal = ratios[1] + ratios[2];
  return [ratios[0], ratios[1] / verticalTotal, ratios[2] / verticalTotal];
}

function loadGlobalLayout(): { splitRatios: SplitRatios; rightPanelsOpen: boolean } {
  try {
    const stored = JSON.parse(window.localStorage.getItem(GLOBAL_LAYOUT_STORAGE_KEY) ?? "{}") as { splitRatios?: number[]; rightPanelsOpen?: boolean };
    return { splitRatios: normalizedSplitRatios(stored.splitRatios), rightPanelsOpen: stored.rightPanelsOpen ?? true };
  } catch {
    return { splitRatios: DEFAULT_SPLIT_RATIOS, rightPanelsOpen: true };
  }
}

interface PanelState {
  title: string;
  componentsText: string;
  datamodelText: string;
  protocolId: string | null;
  presetId: string | null;
  /** Whether the selected preset ships a reference rendering.png. */
  hasRendering: boolean;
}

const EMPTY_PANEL: PanelState = {
  title: "",
  componentsText: "{}",
  datamodelText: "",
  protocolId: null,
  presetId: null,
  hasRendering: false,
};

/** Serialize a protocol's two payloads into the two ```json blocks the system
 * prompt expects for an assistant turn (block 1 = updateComponents, block 2 =
 * updateDataModel). */
function protocolBlocks(components: A2uiPayload, datamodel: A2uiPayload | null): string {
  const blocks = ["```json\n" + JSON.stringify(components, null, 2) + "\n```"];
  if (datamodel) blocks.push("```json\n" + JSON.stringify(datamodel, null, 2) + "\n```");
  return blocks.join("\n\n");
}

export default function App() {
  const gen = useGeneration();
  const { providers, active, serverInfo, loaded, refresh } = useProviders();
  const library = useLibrary();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selection, setSelection] = useState<Selection>(null);
  const [panel, setPanel] = useState<PanelState>(EMPTY_PANEL);
  const [history, setHistory] = useState<RoundSnapshot[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [sessionProvider, setSessionProvider] = useState<string | null | undefined>(undefined);
  const [sessionReasoning, setSessionReasoning] = useState<boolean | undefined>(undefined);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [globalLayout] = useState(loadGlobalLayout);
  const [splitRatios, setSplitRatios] = useState<SplitRatios>(globalLayout.splitRatios);
  const [rightPanelsOpen, setRightPanelsOpen] = useState(globalLayout.rightPanelsOpen);
  const [isNarrowLayout, setIsNarrowLayout] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const [componentSelection, setComponentSelection] = useState<ComponentSelection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const liveImagesRef = useRef<ImageAttachment[]>([]);
  const finalizedProtocolRef = useRef<string | null>(null);
  const historyRef = useRef<RoundSnapshot[]>([]);
  const editorDraftsRef = useRef<Record<string, { componentsText: string; datamodelText: string }>>({});
  /** The session's saved (canonical) protocol — the refinement baseline carried
   * into the next round. Updated on save / load / generation completion. */
  const baselineProtocolRef = useRef<{ components: A2uiPayload; datamodel: A2uiPayload | null } | null>(null);
  /** Owning session + conversation snapshot captured when a round starts, so a
   * round finishing after the user switches sessions is attributed to the
   * correct session instead of polluting the one currently on screen. */
  const generationContextRef = useRef<{ sessionId: string; conversation: RoundSnapshot[] } | null>(null);
  const archivedGenerationRef = useRef<string | null>(null);
  const initialSessionSelectedRef = useRef(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const rightPanelsRef = useRef<HTMLDivElement>(null);
  const splitRatiosRef = useRef<SplitRatios>(DEFAULT_SPLIT_RATIOS);
  const resizeRef = useRef<{ divider: 0 | 1; startPosition: number; ratios: SplitRatios } | null>(null);

  // Whether the right panel currently mirrors the live generation stream.
  // It is re-attached whenever a new round starts and detached as soon as the
  // user explicitly selects a preset/protocol, so incoming stream chunks no
  // longer clobber the content the user chose to look at.
  const panelAttachedRef = useRef(false);

  useEffect(() => {
    splitRatiosRef.current = splitRatios;
  }, [splitRatios]);

  useEffect(() => {
    window.localStorage.setItem(GLOBAL_LAYOUT_STORAGE_KEY, JSON.stringify({ splitRatios, rightPanelsOpen }));
  }, [splitRatios, rightPanelsOpen]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const collapseOnNarrow = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsNarrowLayout(event.matches);
      setRightPanelsOpen(!event.matches);
    };
    collapseOnNarrow(media);
    media.addEventListener("change", collapseOnNarrow);
    return () => media.removeEventListener("change", collapseOnNarrow);
  }, []);

  // --- Sync editor panel while streaming ---
  // Only mirrors the stream while the panel is attached. Selection is managed
  // by the generate/select handlers, so incoming chunks never clear it.
  useEffect(() => {
    if (gen.isGenerating && panelAttachedRef.current) {
      setPanel((p) => ({
        ...p,
        title: gen.prompt || "Generating...",
        componentsText: gen.componentsText,
        datamodelText: gen.datamodelText,
        protocolId: null,
        presetId: null,
        hasRendering: false,
      }));
    }
  }, [gen.isGenerating, gen.componentsText, gen.datamodelText, gen.prompt]);

  // --- Finalize panel when generation completes ---
  // Only takes over the panel if it is still attached to the stream. If the
  // user navigated to a preset/protocol mid-generation, respect that choice
  // and merely refresh the library so the finished protocol shows up in the
  // sidebar for the user to open explicitly.
  useLayoutEffect(() => {
    if (gen.status === "done" && gen.done) {
      const d = gen.done;
      if (finalizedProtocolRef.current === d.protocol_id) return;
      finalizedProtocolRef.current = d.protocol_id;

      // Attribute the finished round to the session that started it, even if
      // the user navigated to another session while it was streaming.
      const owner = generationContextRef.current;
      const ownerSessionId = owner?.sessionId ?? sessionIdRef.current;
      const ownerIsCurrent = ownerSessionId != null && ownerSessionId === sessionIdRef.current;

      if (panelAttachedRef.current) {
        setPanel((p) => ({
          title: gen.prompt || p.title,
          componentsText: d.components ? JSON.stringify(d.components, null, 2) : p.componentsText,
          datamodelText: d.datamodel ? JSON.stringify(d.datamodel, null, 2) : p.datamodelText,
          protocolId: d.protocol_id,
          presetId: null,
          hasRendering: false,
        }));
        if (ownerSessionId) setSelection({ kind: "session", id: ownerSessionId });
      }

      const currentRound: RoundSnapshot = {
        id: d.protocol_id,
        prompt: gen.prompt,
        model: gen.model,
        reasoning: gen.reasoning,
        thinking: gen.thinking,
        done: d,
        error: null,
        images: liveImagesRef.current,
      };

      // Append to the owning session's conversation. When the owner is still the
      // on-screen session, update the live history/state too; otherwise persist
      // to the owner without touching the session the user is now viewing.
      const baseConversation = ownerIsCurrent ? historyRef.current : (owner?.conversation ?? []);
      const conversation = [...baseConversation, currentRound];
      if (ownerIsCurrent) {
        historyRef.current = conversation;
        setHistory(conversation);
        baselineProtocolRef.current = { components: d.components, datamodel: d.datamodel };
      }
      if (ownerSessionId) {
        void updateSession(ownerSessionId, { conversation, protocol_id: d.protocol_id, status: "idle" }).catch((error) => setSessionError(error instanceof Error ? error.message : "Could not save chat history"));
      }
      void library.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.status, gen.done, gen.prompt, gen.model, gen.reasoning, gen.thinking, library]);

  useEffect(() => {
    const owner = generationContextRef.current;
    if (!owner || gen.status === "generating" || !gen.prompt || gen.done) return;
    const key = `${owner.sessionId}:${gen.startedAt}`;
    if (archivedGenerationRef.current === key) return;
    archivedGenerationRef.current = key;
    const round: RoundSnapshot = { id: key, prompt: gen.prompt, model: gen.model, reasoning: gen.reasoning, thinking: gen.thinking, done: null, error: gen.error, images: liveImagesRef.current };
    const conversation = [...owner.conversation, round];
    if (owner.sessionId === sessionIdRef.current) { historyRef.current = conversation; setHistory(conversation); }
    void updateSession(owner.sessionId, { conversation, status: "idle" }).catch((error) => setSessionError(error instanceof Error ? error.message : "Could not save chat history"));
  }, [gen.status, gen.prompt, gen.done, gen.error, gen.model, gen.reasoning, gen.thinking, gen.startedAt]);

  // --- Archive the just-finished round into history when a new one starts ---
  const handleGenerate = useCallback(
    async (prompt: string, provider: string | null, reasoning: boolean, images: ImageAttachment[]) => {
      let activeSessionId = sessionIdRef.current;
      if (!activeSessionId) {
        try {
          const session = await createSession(prompt.slice(0, 1024) || "New Session");
          activeSessionId = session.id;
          sessionIdRef.current = session.id;
          setSessionId(session.id);
          setPanel((current) => ({ ...current, title: session.title }));
          void library.refresh();
        } catch (error) {
          setSessionError(error instanceof Error ? error.message : "Could not create session");
          return;
        }
      }
      setSessionError(null);
      // A new round re-attaches the right panel to the live stream and
      // immediately surfaces the task in "My Generations" (as the highlighted
      // in-flight entry) so the user can switch away and come back at any time.
      panelAttachedRef.current = true;
      liveImagesRef.current = images;
      setSelection({ kind: "generation" });

      // Capture the owning session + its conversation so the finished round is
      // attributed correctly even if the user switches sessions mid-stream.
      generationContextRef.current = { sessionId: activeSessionId, conversation: historyRef.current };
      archivedGenerationRef.current = null;
      void updateSession(activeSessionId, { status: "generating" });
      void updateSession(activeSessionId, { provider, reasoning });
      void generateSessionTitle(activeSessionId, prompt).then((session) => {
        if (sessionIdRef.current === session.id) setPanel((current) => ({ ...current, title: session.title }));
        void library.refresh();
      }).catch(() => undefined);

      // Build the multi-turn context from THIS session's conversation — never the
      // global generation state, which leaks across sessions and pollutes other
      // sessions. Prior rounds supply the chat history; the trailing assistant
      // message carries the session's saved (canonical) protocol as the baseline.
      //
      // The assistant message must mirror the exact two-fenced-block output format
      // the system prompt demands (block 1 = updateComponents, block 2 =
      // updateDataModel). components/datamodel are already the full
      // {"version", "updateComponents"} / {"version", "updateDataModel"} objects,
      // so each is stringified into its own ```json block.
      const chatHistory: ChatMessage[] = [];
      for (const round of historyRef.current) {
        if (!round.done?.components) continue;
        chatHistory.push(
          { role: "user", content: round.prompt },
          { role: "assistant", content: protocolBlocks(round.done.components, round.done.datamodel) },
        );
      }
      const baseline = baselineProtocolRef.current;
      if (baseline?.components && chatHistory.length > 0) {
        const baselineContent = protocolBlocks(baseline.components, baseline.datamodel);
        const tail = chatHistory[chatHistory.length - 1];
        if (tail.role === "assistant" && tail.content !== baselineContent) {
          chatHistory[chatHistory.length - 1] = { role: "assistant", content: baselineContent };
        }
      }

      gen.generate(prompt, "component", provider, reasoning, chatHistory, images);
    },
    [gen, library],
  );

  // --- Show a finished round's protocol in the right panel ---
  // Replaces the editor/preview with that round's generated payloads without
  // changing the session's saved (canonical) protocol, so "Save" still commits
  // to the session rather than to the displayed round.
  const handleShowRound = useCallback((round: RoundSnapshot) => {
    if (!round.done) return;
    panelAttachedRef.current = false;
    setPanel((p) => ({
      ...p,
      componentsText: round.done?.components ? JSON.stringify(round.done.components, null, 2) : "",
      datamodelText: round.done?.datamodel ? JSON.stringify(round.done.datamodel, null, 2) : "",
    }));
  }, []);

  // --- New chat: start a brand-new conversation ---
  // Clears the archived history and the live round (aborting any in-flight
  // stream), detaches the panel from the stream, and resets the right panel
  // so the user lands on a pristine, empty conversation page.
  const handleNewChat = useCallback(async () => {
    try {
      const existingTitles = new Set(library.protocols.map((item) => item.title));
      let number = 1;
      let title = "New Session";
      while (existingTitles.has(title)) title = `New Session ${number++}`;
      const session = await createSession(title);
      editorDraftsRef.current[session.id] = { componentsText: "{}", datamodelText: "" };
      sessionIdRef.current = session.id;
      setSessionId(session.id);
      setSelection({ kind: "session", id: session.id });
      historyRef.current = [];
      setHistory([]);
      baselineProtocolRef.current = null;
      generationContextRef.current = null;
      gen.reset();
      panelAttachedRef.current = false;
      setPanel({ ...EMPTY_PANEL, title: session.title, componentsText: "{}" });
    setDraft("");
    setSessionError(null);
    liveImagesRef.current = [];
      void library.refresh();
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not create session");
    }
  }, [gen.reset, library]);

  // --- Load a preset sample into the panel ---
  const handleSelectPreset = useCallback(async (id: string) => {
    try {
      const rec = await fetchPreset(id);
      // Selecting a preset detaches the panel from any in-flight stream so the
      // preset content is not overwritten by incoming chunks.
      panelAttachedRef.current = false;
      setSelection({ kind: "preset", id });
      setPanel({
        title: rec.name,
        componentsText: rec.components ? JSON.stringify(rec.components, null, 2) : "",
        datamodelText: rec.datamodel ? JSON.stringify(rec.datamodel, null, 2) : "",
        protocolId: null,
        presetId: rec.id,
        hasRendering: rec.has_rendering ?? false,
      });
      setSessionId(null);
      sessionIdRef.current = null;
      setDraft("");
      setHistory([]);
      historyRef.current = [];
      baselineProtocolRef.current = null;
    } catch {
      // ignore load errors for now
    }
  }, []);
  // --- Load a generated protocol into the panel ---
  const handleSelectProtocol = useCallback(async (id: string) => {
    try {
      const rec = await fetchSession(id);
      const isRunningSession = gen.isGenerating && generationContextRef.current?.sessionId === rec.id;
      // Selecting an historical session detaches the panel from any in-flight
      // stream. Selecting the stream's owner re-attaches it so both columns
      // recover the live response after switching back.
      panelAttachedRef.current = isRunningSession;
      setSelection({ kind: "session", id });
      const protocol = rec.protocol_id ? await fetchProtocol(rec.protocol_id) : null;
      const draft = editorDraftsRef.current[rec.id];
      baselineProtocolRef.current = protocol ? { components: protocol.components, datamodel: protocol.datamodel } : null;
      setPanel({
        title: rec.title,
        componentsText: draft?.componentsText ?? (protocol?.components ? JSON.stringify(protocol.components, null, 2) : "{}"),
        datamodelText: draft?.datamodelText ?? (protocol?.datamodel ? JSON.stringify(protocol.datamodel, null, 2) : ""),
        protocolId: rec.protocol_id,
        presetId: null,
        hasRendering: false,
      });
      const recovered: RoundSnapshot[] = rec.conversation.map((round) => ({ ...round, images: round.images ?? [] }));
      historyRef.current = recovered;
      setHistory(recovered);
      setSessionId(rec.id);
      sessionIdRef.current = rec.id;
      setDraft(rec.draft);
      setSessionProvider(rec.provider);
      setSessionReasoning(rec.reasoning);
      setSessionError(null);
      if (isRunningSession) {
        setPanel({
          title: gen.prompt || rec.title,
          componentsText: gen.componentsText,
          datamodelText: gen.datamodelText,
          protocolId: null,
          presetId: null,
          hasRendering: false,
        });
      }
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not load chat history");
    }
  }, [gen.isGenerating, gen.prompt, gen.componentsText, gen.datamodelText]);

  useEffect(() => {
    if (initialSessionSelectedRef.current || library.loading) return;
    initialSessionSelectedRef.current = true;
    const firstSession = library.protocols[0];
    if (firstSession) void handleSelectProtocol(firstSession.id);
  }, [handleSelectProtocol, library.loading, library.protocols]);

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    if (sessionIdRef.current) void updateSession(sessionIdRef.current, { draft: value }).catch((error) => setSessionError(error instanceof Error ? error.message : "Could not save draft"));
  }, []);

  // --- Rename a session from the sidebar ⋮ menu ---
  const handleRenameSession = useCallback(async (id: string, title: string) => {
    const session = await updateSession(id, { title });
    if (sessionIdRef.current === id) {
      setPanel((current) => ({ ...current, title: session.title }));
    }
    await library.refresh();
  }, [library]);

  // --- Delete a session from the sidebar ⋮ menu ---
  const handleDeleteSession = useCallback(async (id: string) => {
    await deleteSession(id);
    if (sessionIdRef.current === id) {
      // The session being viewed is gone: reset back to a pristine state.
      sessionIdRef.current = null;
      setSessionId(null);
      setSelection(null);
      historyRef.current = [];
      setHistory([]);
      baselineProtocolRef.current = null;
      delete editorDraftsRef.current[id];
      generationContextRef.current = null;
      setDraft("");
      setPanel(EMPTY_PANEL);
      liveImagesRef.current = [];
    }
    await library.refresh();
  }, [library]);

  // --- Re-attach the panel to the in-flight generation stream ---
  // Lets the user browse a preset/protocol and then return to the still-running
  // generation: the panel immediately mirrors the current partial output and
  // keeps following incoming chunks until the round finishes.
  const handleSelectLiveGeneration = useCallback(() => {
    panelAttachedRef.current = true;
    setSelection({ kind: "generation" });
    setPanel((p) => ({
      ...p,
      title: gen.prompt || "Generating...",
      componentsText: gen.componentsText,
      datamodelText: gen.datamodelText,
      protocolId: null,
      presetId: null,
      hasRendering: false,
    }));
  }, [gen.prompt, gen.componentsText, gen.datamodelText]);

  // --- Save manual edits (PUT) ---
  const handleSave = useCallback(
    async (components: A2uiPayload, datamodel: A2uiPayload | null) => {
      if (!panel.protocolId) throw new Error("No protocol to save");
      await updateProtocol(panel.protocolId, components, datamodel);
      baselineProtocolRef.current = { components, datamodel };
      void library.refresh();
    },
    [panel.protocolId, library],
  );

  // --- QR code URL ---
  const qrUrl = serverInfo && panel.protocolId
      ? `${serverInfo.base_url}/api/protocols/${panel.protocolId}/raw`
      : serverInfo && panel.presetId
        ? `${serverInfo.base_url}/api/presets/${panel.presetId}/raw`
        : null;

  // --- Reference rendering URL (presets only, when rendering.png exists) ---
  const renderingUrl =
    panel.presetId && panel.hasRendering
      ? `/api/presets/${encodeURIComponent(panel.presetId)}/rendering`
      : null;

  // The in-flight generation is surfaced at the top of "My Generations" so it
  // can be re-opened after the user browses other presets/protocols.
  const liveGeneration = gen.isGenerating ? { prompt: gen.prompt } : null;
  const selectedSessionGenerating = gen.isGenerating && generationContextRef.current?.sessionId === sessionId;

  const setSplitRatiosAndRemember = useCallback((ratios: SplitRatios) => {
    splitRatiosRef.current = ratios;
    setSplitRatios(ratios);
  }, []);

  const handleDividerPointerDown = useCallback((divider: 0 | 1, event: React.PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { divider, startPosition: divider === 0 ? event.clientX : event.clientY, ratios: splitRatiosRef.current };
  }, []);

  const handleDividerPointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const resize = resizeRef.current;
    const dimension = resize?.divider === 0
      ? workspaceRef.current?.getBoundingClientRect().width
      : rightPanelsRef.current?.getBoundingClientRect().height;
    if (!resize || !dimension) return;
    const position = resize.divider === 0 ? event.clientX : event.clientY;
    const delta = (position - resize.startPosition) / dimension;
    const next = [...resize.ratios] as SplitRatios;
    if (resize.divider === 0) {
      next[0] = Math.min(1 - MIN_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, resize.ratios[0] + delta));
    } else {
      const pairTotal = 1;
      next[1] = Math.min(pairTotal - MIN_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, resize.ratios[1] + delta));
      next[2] = pairTotal - next[1];
    }
    setSplitRatiosAndRemember(next);
  }, [setSplitRatiosAndRemember]);

  const handleDividerPointerUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  const handleSelectComponent = useCallback((id: string) => {
    setComponentSelection((current) => ({ id, seq: (current?.seq ?? 0) + 1, source: "preview" }));
  }, []);

  const handleEditorComponentSelection = useCallback((id: string | null) => {
    setComponentSelection((current) => {
      if (!id) return null;
      return current?.id === id && current.source === "editor" ? current : { id, seq: (current?.seq ?? 0) + 1, source: "editor" };
    });
  }, []);

  const clearComponentSelection = useCallback(() => setComponentSelection(null), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearComponentSelection();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearComponentSelection]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        serverInfo={serverInfo}
        qrUrl={qrUrl}
      />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <PresetSidebar
            presets={library.presets}
            protocols={library.protocols}
            loading={library.loading}
            selection={selection}
            liveGeneration={liveGeneration}
            onSelectPreset={handleSelectPreset}
            onSelectProtocol={handleSelectProtocol}
            onSelectGeneration={handleSelectLiveGeneration}
            onOpenConfiguration={() => setConfigOpen(true)}
            onNewChat={handleNewChat}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
          />
        )}

        <div
          ref={workspaceRef}
          className={`studio-workspace min-h-0 min-w-0 flex-1${selection?.kind === "preset" ? " studio-workspace--no-chat" : ""}${!rightPanelsOpen ? " studio-workspace--collapsed" : ""}${isNarrowLayout ? " studio-workspace--narrow" : ""}`}
          style={{
            gridTemplateColumns: isNarrowLayout || !rightPanelsOpen || selection?.kind === "preset" ? "minmax(0, 1fr)" : `minmax(0, ${splitRatios[0]}fr) 8px minmax(0, ${1 - splitRatios[0]}fr)`,
          }}
        >
        {/* Conversation column */}
        {selection?.kind !== "preset" && <div className="studio-panel flex min-w-0 flex-col">
          {sessionError && <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{sessionError}</div>}
          <ConversationPanel
            history={history}
            onShowRound={handleShowRound}
            live={{
              status: selectedSessionGenerating ? gen.status : "idle",
              prompt: selectedSessionGenerating ? gen.prompt : "",
              model: selectedSessionGenerating ? gen.model : null,
              currentStage: selectedSessionGenerating ? gen.currentStage : null,
              reasoning: selectedSessionGenerating ? gen.reasoning : "",
              thinking: selectedSessionGenerating ? gen.thinking : "",
              startedAt: selectedSessionGenerating ? gen.startedAt : null,
              done: selectedSessionGenerating ? gen.done : null,
              error: selectedSessionGenerating ? gen.error : null,
              images: selectedSessionGenerating ? liveImagesRef.current : [],
            }}
          />
          <InputBar
            providers={providers}
            active={active}
            isGenerating={selectedSessionGenerating}
            onSend={handleGenerate}
            onStop={gen.stop}
            value={draft}
            onValueChange={handleDraftChange}
            sessionProvider={sessionProvider}
            sessionReasoning={sessionReasoning}
          />
        </div>}

        {rightPanelsOpen && !isNarrowLayout && selection?.kind !== "preset" && <div role="separator" aria-orientation="vertical" className="studio-divider studio-divider--vertical" onPointerDown={(event) => handleDividerPointerDown(0, event)} onPointerMove={handleDividerPointerMove} onPointerUp={handleDividerPointerUp} onPointerCancel={handleDividerPointerUp}>
          <button type="button" aria-label="Hide preview and JSON panels" title="Hide preview and JSON panels" className="studio-collapse-control" onPointerDown={(event) => event.stopPropagation()} onClick={() => setRightPanelsOpen(false)}><ChevronRightIcon size={14} /></button>
        </div>}

        {rightPanelsOpen && <div ref={rightPanelsRef} className={`studio-right-panels min-h-0 min-w-0${isNarrowLayout ? " studio-right-panels--overlay" : ""}`} style={{ gridTemplateRows: `minmax(0, ${splitRatios[1]}fr) 8px minmax(0, ${splitRatios[2]}fr)` }}>
          <div className="studio-panel min-w-0">
          <PreviewScanStrip presetId={panel.presetId} renderingUrl={renderingUrl} componentsText={panel.componentsText} datamodelText={panel.datamodelText} selectedComponentId={componentSelection?.id} onSelectComponent={(id) => id ? handleSelectComponent(id) : clearComponentSelection()} onComponentsChange={(componentsText) => setPanel((current) => ({ ...current, componentsText }))} />
          </div>
          <button type="button" aria-label="Resize preview and JSON panels" className="studio-divider studio-divider--horizontal" onPointerDown={(event) => handleDividerPointerDown(1, event)} onPointerMove={handleDividerPointerMove} onPointerUp={handleDividerPointerUp} onPointerCancel={handleDividerPointerUp} />

          {/* Protocol column */}
          <div className="studio-panel flex min-w-0 flex-col">
          <ProtocolPanel
            componentsText={panel.componentsText}
            datamodelText={panel.datamodelText}
            onComponentsChange={(v) => setPanel((p) => { if (sessionIdRef.current) editorDraftsRef.current[sessionIdRef.current] = { componentsText: v, datamodelText: p.datamodelText }; return { ...p, componentsText: v }; })}
            onDatamodelChange={(v) => setPanel((p) => { if (sessionIdRef.current) editorDraftsRef.current[sessionIdRef.current] = { componentsText: p.componentsText, datamodelText: v }; return { ...p, datamodelText: v }; })}
            editorScope={sessionId ? `session:${sessionId}` : selection?.kind ?? "empty"}
            streaming={selectedSessionGenerating && panelAttachedRef.current}
            protocolId={panel.protocolId}
            selectComponentId={componentSelection?.source === "preview" ? componentSelection : null}
            onComponentSelection={handleEditorComponentSelection}
            onSave={handleSave}
          />
          </div>
        </div>}
        {!rightPanelsOpen && <button type="button" aria-label="Show preview and JSON panels" title="Show preview and JSON panels" className="studio-collapse-control studio-collapse-control--collapsed" onClick={() => setRightPanelsOpen(true)}><ChevronRightIcon size={14} /></button>}
      </div>
      </div>
      <ConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
}
