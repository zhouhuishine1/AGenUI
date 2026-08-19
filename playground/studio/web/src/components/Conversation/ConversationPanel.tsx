/** Conversation area: user prompts + assistant cards (stages, thinking, results). */

import { useEffect, useRef } from "react";
import { ErrorCard } from "./ErrorCard";
import { StageStepper } from "./StageStepper";
import { ThinkingProcess } from "./ThinkingProcess";
import { ValidationBanner } from "./ValidationBanner";
import { WaitingIndicator } from "./WaitingIndicator";
import { EyeIcon, SparkleIcon, StopIcon } from "@/components/icons";
import type {
  DoneEvent,
  ErrorEvent,
  GenerationStatus,
  RoundSnapshot,
  StageName,
} from "@/types";

interface RoundView {
  id: string;
  prompt: string;
  model: string | null;
  currentStage: StageName | null;
  reasoning: string;
  thinking: string;
  startedAt: number | null;
  done: DoneEvent | null;
  error: ErrorEvent | null;
  live: boolean;
  status: GenerationStatus;
  images: RoundSnapshot["images"];
}

function AssistantCard({ round, onShow }: { round: RoundView; onShow?: () => void }) {
  const generating = round.live && round.status === "generating";
  const finishedOk = round.done != null;
  // A round that was started (has a prompt) but is neither generating nor
  // finished (no done/error) was stopped by the user. Covers both the live
  // round right after Stop and archived history rounds.
  const stopped =
    !generating && !finishedOk && !round.error && round.prompt !== "";

  // Reasoning models stream their chain-of-thought separately; show it first,
  // followed by any non-JSON preamble parsed from the answer tokens.
  const displayThinking = [round.reasoning, round.thinking]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="flex justify-start">
      <div className="group relative w-full max-w-[92%] space-y-2 rounded-xl rounded-tl-sm border border-slate-200 bg-white p-3 shadow-sm">
        <StageStepper
          currentStage={round.currentStage}
          model={round.model}
          finished={finishedOk}
        />

        <ThinkingProcess
          thinking={displayThinking}
          streaming={generating && !round.done}
          defaultOpen={round.live}
          startedAt={round.startedAt}
        />

        {generating && !displayThinking && (
          <WaitingIndicator startedAt={round.startedAt} />
        )}

        {round.done && <ValidationBanner done={round.done} />}
        {round.error && <ErrorCard error={round.error} />}

        {stopped && (
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-400">
            <StopIcon size={11} />
            Generation stopped by user
          </div>
        )}

        {finishedOk && onShow && (
          <button
            type="button"
            onClick={onShow}
            title="查看该轮生成的内容"
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-[11px] font-medium text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100 hover:bg-brand-50 hover:text-brand-600"
          >
            <EyeIcon size={12} />
            显示
          </button>
        )}
      </div>
    </div>
  );
}

function RoundBlock({ round, onShow }: { round: RoundView; onShow?: () => void }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-tr-sm bg-brand-500 px-3.5 py-2 text-sm leading-6 text-white shadow-sm">
          {round.prompt}
          {round.images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {round.images.map((image, index) => (
                <img key={image.data_url} src={image.data_url} alt={`Attached image ${index + 1}`} className="max-h-48 max-w-full rounded-lg border border-white/30 object-contain" />
              ))}
            </div>
          )}
        </div>
      </div>
      <AssistantCard round={round} onShow={onShow} />
    </div>
  );
}

export interface LiveRound {
  status: GenerationStatus;
  prompt: string;
  model: string | null;
  currentStage: StageName | null;
  reasoning: string;
  thinking: string;
  startedAt: number | null;
  done: DoneEvent | null;
  error: ErrorEvent | null;
  images: RoundSnapshot["images"];
}

interface ConversationPanelProps {
  history: RoundSnapshot[];
  live: LiveRound;
  /** Invoked when the user clicks "显示" on a finished round's card. */
  onShowRound?: (round: RoundSnapshot) => void;
}

export function ConversationPanel({ history, live, onShowRound }: ConversationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // A "done" round is already archived into `history`, so it must not also be
  // rendered as the live block (that duplicated it and leaked another session's
  // last result into the current session's view).
  const showLive =
    live.status === "generating" ||
    live.status === "error" ||
    (live.status === "idle" && live.prompt !== "");

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length, live.status, live.thinking, live.currentStage, live.done, live.error]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
      {!showLive && history.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
            <SparkleIcon size={22} />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-700">
              Describe a UI and generate an A2UI protocol
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              e.g. "Generate a weather card showing city, current temperature and
              condition"
              <br />
              or pick a preset from the left sidebar.
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-5">
          {history.map((snap) => (
            <RoundBlock
              key={snap.id}
              onShow={onShowRound ? () => onShowRound(snap) : undefined}
              round={{
                id: snap.id,
                prompt: snap.prompt,
                model: snap.model,
                currentStage: null,
                reasoning: snap.reasoning,
                thinking: snap.thinking,
                startedAt: null,
                done: snap.done,
                error: snap.error,
                live: false,
                status: snap.error ? "error" : snap.done ? "done" : "idle",
                images: snap.images ?? [],
              }}
            />
          ))}

          {showLive && (
            <RoundBlock
              round={{
                id: "live",
                prompt: live.prompt,
                model: live.model,
                currentStage: live.currentStage,
                reasoning: live.reasoning,
                thinking: live.thinking,
                startedAt: live.startedAt,
                done: live.done,
                error: live.error,
                live: true,
                status: live.status,
                images: live.images,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
