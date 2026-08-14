/** AGenUI Studio root: three-column layout + generation orchestration. */

import { useCallback, useEffect, useRef, useState } from "react";
import { ConversationPanel } from "@/components/Conversation/ConversationPanel";
import { Header } from "@/components/Header";
import { InputBar } from "@/components/InputBar/InputBar";
import { ProtocolPanel } from "@/components/Protocol/ProtocolPanel";
import { PresetSidebar, type Selection } from "@/components/Sidebar/PresetSidebar";
import { useGeneration } from "@/hooks/useGeneration";
import { useLibrary } from "@/hooks/useLibrary";
import { useProviders } from "@/hooks/useProviders";
import {
  fetchPreset,
  fetchProtocol,
  fetchSession,
  createSession,
  createPreview,
  updateSession,
  updateProtocol,
} from "@/api/client";
import type { A2uiPayload, ImageAttachment, RoundSnapshot } from "@/types";
import type { ChatMessage } from "@/api/sse";

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
  componentsText: "",
  datamodelText: "",
  protocolId: null,
  presetId: null,
  hasRendering: false,
};

export default function App() {
  const gen = useGeneration();
  const { providers, active, serverInfo, loaded, refresh } = useProviders();
  const library = useLibrary();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selection, setSelection] = useState<Selection>(null);
  const [panel, setPanel] = useState<PanelState>(EMPTY_PANEL);
  const [history, setHistory] = useState<RoundSnapshot[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const liveImagesRef = useRef<ImageAttachment[]>([]);
  const finalizedProtocolRef = useRef<string | null>(null);
  const historyRef = useRef<RoundSnapshot[]>([]);

  // Whether the right panel currently mirrors the live generation stream.
  // It is re-attached whenever a new round starts and detached as soon as the
  // user explicitly selects a preset/protocol, so incoming stream chunks no
  // longer clobber the content the user chose to look at.
  const panelAttachedRef = useRef(false);

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
  useEffect(() => {
    if (gen.status === "done" && gen.done) {
      const d = gen.done;
      if (finalizedProtocolRef.current === d.protocol_id) return;
      finalizedProtocolRef.current = d.protocol_id;
      if (panelAttachedRef.current) {
        setPanel((p) => ({
          title: gen.prompt || p.title,
          componentsText: d.components ? JSON.stringify(d.components, null, 2) : p.componentsText,
          datamodelText: d.datamodel ? JSON.stringify(d.datamodel, null, 2) : p.datamodelText,
          protocolId: d.protocol_id,
          presetId: null,
          hasRendering: false,
        }));
        if (sessionIdRef.current) setSelection({ kind: "session", id: sessionIdRef.current });
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
      const conversation = [...historyRef.current, currentRound];
      historyRef.current = conversation;
      setHistory(conversation);
      if (sessionIdRef.current) {
        void updateSession(sessionIdRef.current, { conversation, protocol_id: d.protocol_id }).catch((error) => setSessionError(error instanceof Error ? error.message : "Could not save chat history"));
      }
      void library.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.status, gen.done, gen.prompt, gen.model, gen.reasoning, gen.thinking, library]);

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

      // Build multi-turn history from the last completed round (single-turn context).
      // The assistant message must mirror the exact two-fenced-block output format
      // the system prompt demands (block 1 = updateComponents, block 2 =
      // updateDataModel). gen.done.components / gen.done.datamodel are already the
      // full {"version", "updateComponents"} / {"version", "updateDataModel"} objects,
      // so each is stringified into its own ```json block. Feeding the model a single
      // combined object here makes it echo that shape back, which the two-block
      // extractor cannot parse (-> "Could not extract A2UI protocol").
      const chatHistory: ChatMessage[] = [];
      if (gen.prompt && gen.done?.components) {
        const blocks = [
          "```json\n" + JSON.stringify(gen.done.components, null, 2) + "\n```",
        ];
        if (gen.done.datamodel) {
          blocks.push("```json\n" + JSON.stringify(gen.done.datamodel, null, 2) + "\n```");
        }
        chatHistory.push(
          { role: "user", content: gen.prompt },
          { role: "assistant", content: blocks.join("\n\n") },
        );
      }

      gen.generate(prompt, "component", provider, reasoning, chatHistory, images);
    },
    [gen, library],
  );

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
      sessionIdRef.current = session.id;
      setSessionId(session.id);
      setSelection({ kind: "session", id: session.id });
    historyRef.current = [];
      setHistory([]);
      gen.reset();
      panelAttachedRef.current = false;
      setPanel({ ...EMPTY_PANEL, title: session.title });
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
      setPreviewUrl(null);
      setSessionId(null);
      sessionIdRef.current = null;
      setDraft("");
      setHistory([]);
      historyRef.current = [];
    } catch {
      // ignore load errors for now
    }
  }, []);

  // --- Load a generated protocol into the panel ---
  const handleSelectProtocol = useCallback(async (id: string) => {
    try {
      const rec = await fetchSession(id);
      // Selecting a protocol detaches the panel from any in-flight stream.
      panelAttachedRef.current = false;
      setSelection({ kind: "session", id });
      const protocol = rec.protocol_id ? await fetchProtocol(rec.protocol_id) : null;
      setPanel({
        title: rec.title,
        componentsText: protocol?.components ? JSON.stringify(protocol.components, null, 2) : "",
        datamodelText: protocol?.datamodel ? JSON.stringify(protocol.datamodel, null, 2) : "",
        protocolId: rec.protocol_id,
        presetId: null,
        hasRendering: false,
      });
      setPreviewUrl(null);
      const recovered: RoundSnapshot[] = rec.conversation.map((round) => ({ ...round, images: round.images ?? [] }));
      historyRef.current = recovered;
      setHistory(recovered);
      setSessionId(rec.id);
      sessionIdRef.current = rec.id;
      setDraft(rec.draft);
      setSessionError(null);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : "Could not load chat history");
    }
  }, []);

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    if (sessionIdRef.current) void updateSession(sessionIdRef.current, { draft: value }).catch((error) => setSessionError(error instanceof Error ? error.message : "Could not save draft"));
  }, []);

  const handleTitleChange = useCallback(async (title: string) => {
    if (!sessionIdRef.current) return;
    const session = await updateSession(sessionIdRef.current, { title });
    setPanel((current) => ({ ...current, title: session.title }));
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
      void library.refresh();
    },
    [panel.protocolId, library],
  );

  const handlePreview = useCallback(async (components: A2uiPayload, datamodel: A2uiPayload | null) => {
    const preview = await createPreview(components, datamodel);
    setPreviewUrl(preview.url);
  }, []);

  // --- QR code URL ---
  const qrUrl = previewUrl ?? (serverInfo && panel.protocolId
      ? `${serverInfo.base_url}/api/protocols/${panel.protocolId}/raw`
      : serverInfo && panel.presetId
        ? `${serverInfo.base_url}/api/presets/${panel.presetId}/raw`
        : null);

  // --- Reference rendering URL (presets only, when rendering.png exists) ---
  const renderingUrl =
    panel.presetId && panel.hasRendering
      ? `/api/presets/${encodeURIComponent(panel.presetId)}/rendering`
      : null;

  // The in-flight generation is surfaced at the top of "My Generations" so it
  // can be re-opened after the user browses other presets/protocols.
  const liveGeneration = gen.isGenerating ? { prompt: gen.prompt } : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        serverInfo={serverInfo}
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
            onRefresh={library.refresh}
            onNewChat={handleNewChat}
          />
        )}

        {/* Conversation column */}
        {selection?.kind !== "preset" && <div className="flex min-w-[320px] flex-1 flex-col">
          {sessionError && <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{sessionError}</div>}
          <ConversationPanel
            history={history}
            live={{
              status: gen.status,
              prompt: gen.prompt,
              model: gen.model,
              currentStage: gen.currentStage,
              reasoning: gen.reasoning,
              thinking: gen.thinking,
              startedAt: gen.startedAt,
              done: gen.done,
              error: gen.error,
              images: liveImagesRef.current,
            }}
          />
          <InputBar
            providers={providers}
            active={active}
            providersLoaded={loaded}
            isGenerating={gen.isGenerating}
            onSend={handleGenerate}
            onStop={gen.stop}
            onConfigSaved={refresh}
            value={draft}
            onValueChange={handleDraftChange}
          />
        </div>}

        {/* Protocol column (shares remaining space with the conversation) */}
        <div className="flex min-w-[360px] flex-1 flex-col">
          <ProtocolPanel
            title={panel.title}
            componentsText={panel.componentsText}
            datamodelText={panel.datamodelText}
            onComponentsChange={(v) => setPanel((p) => ({ ...p, componentsText: v }))}
            onDatamodelChange={(v) => setPanel((p) => ({ ...p, datamodelText: v }))}
            streaming={gen.isGenerating && panelAttachedRef.current}
            protocolId={panel.protocolId}
            presetId={panel.presetId}
            renderingUrl={renderingUrl}
            qrUrl={qrUrl}
            onSave={handleSave}
            onPreview={handlePreview}
            editableTitle={selection?.kind === "session"}
            onTitleChange={handleTitleChange}
            onTitleError={setSessionError}
          />
        </div>
      </div>
    </div>
  );
}
