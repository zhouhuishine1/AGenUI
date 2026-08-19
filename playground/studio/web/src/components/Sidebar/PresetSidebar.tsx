/** Left collapsible sidebar: preset samples + the user's generated protocols. */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BoxIcon,
  ChevronDownIcon,
  ClockIcon,
  MoreVerticalIcon,
  PencilIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
  XIcon,
} from "@/components/icons";
import { cn, formatTime } from "@/lib/utils";
import type { PresetSummary, SessionSummary } from "@/types";

export type Selection =
  | { kind: "preset"; id: string }
  | { kind: "session"; id: string }
  | { kind: "generation" }
  | null;

interface PresetSidebarProps {
  presets: PresetSummary[];
  protocols: SessionSummary[];
  loading: boolean;
  selection: Selection;
  /** The in-flight generation (null when idle). Shown at the top of "My
   * Generations" so the user can leave and come back to it at any time. */
  liveGeneration: { prompt: string } | null;
  onSelectPreset: (id: string) => void;
  onSelectProtocol: (id: string) => void;
  onSelectGeneration: () => void;
  onOpenConfiguration: () => void;
  onNewChat?: () => void;
  /** Rename a session (throws on failure so the dialog can surface the error). */
  onRenameSession: (id: string, title: string) => Promise<void>;
  /** Delete a session (throws on failure so the dialog can surface the error). */
  onDeleteSession: (id: string) => Promise<void>;
}

function GroupHeader({
  icon,
  label,
  count,
  open,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-600"
    >
      <ChevronDownIcon
        size={12}
        className={cn("transition-transform", !open && "-rotate-90")}
      />
      {icon}
      {label}
      <span className="ml-auto rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-400">
        {count}
      </span>
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <XIcon size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RenameDialog({
  session,
  onCancel,
  onSave,
}: {
  session: SessionSummary;
  onCancel: () => void;
  onSave: (title: string) => Promise<void>;
}) {
  const [value, setValue] = useState(session.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = async () => {
    const title = value.trim();
    if (!title) {
      setError("名称不能为空");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(title);
      // On success the parent closes the dialog; nothing to reset here.
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setSaving(false);
    }
  };

  return (
    <Modal title="重命名会话" onClose={onCancel}>
      <label className="mb-1 block text-xs font-medium text-slate-500">
        会话名称
      </label>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleSubmit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder="输入新的会话名称"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:bg-white"
      />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-60"
        >
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </Modal>
  );
}

function DeleteDialog({
  session,
  onCancel,
  onConfirm,
}: {
  session: SessionSummary;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
      setDeleting(false);
    }
  };

  return (
    <Modal title="删除会话" onClose={onCancel}>
      <p className="text-sm leading-6 text-slate-600">
        确定要删除会话{" "}
        <span className="font-medium text-slate-800">“{session.title}”</span>{" "}
        吗？此操作无法撤销。
      </p>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={deleting}
          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-red-600 disabled:opacity-60"
        >
          {deleting ? "删除中…" : "删除"}
        </button>
      </div>
    </Modal>
  );
}

export function PresetSidebar({
  presets,
  protocols,
  loading,
  selection,
  liveGeneration,
  onSelectPreset,
  onSelectProtocol,
  onSelectGeneration,
  onOpenConfiguration,
  onNewChat,
  onRenameSession,
  onDeleteSession,
}: PresetSidebarProps) {
  const [query, setQuery] = useState("");
  const [presetsOpen, setPresetsOpen] = useState(true);
  const [protocolsOpen, setProtocolsOpen] = useState(true);
  /** Session whose ⋮ action menu is currently open. */
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  /** Session being renamed (null when the dialog is closed). */
  const [renaming, setRenaming] = useState<SessionSummary | null>(null);
  /** Session awaiting delete confirmation (null when the dialog is closed). */
  const [deleting, setDeleting] = useState<SessionSummary | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the ⋮ menu on any click outside of it.
  useEffect(() => {
    if (!menuSessionId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuSessionId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuSessionId]);

  const q = query.trim().toLowerCase();
  const filteredPresets = useMemo(
    () => (q ? presets.filter((p) => p.name.toLowerCase().includes(q)) : presets),
    [presets, q],
  );
  const filteredProtocols = useMemo(
    () =>
      q
        ? protocols.filter((p) => p.title.toLowerCase().includes(q))
        : protocols,
    [protocols, q],
  );

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* New Chat button */}
      {onNewChat && (
        <div className="shrink-0 border-b border-slate-200 p-2">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New Chat
          </button>
        </div>
      )}

      {/* Search + configuration */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-slate-200 p-2">
        <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 focus-within:border-brand-500 focus-within:bg-white">
          <SearchIcon size={13} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search protocols"
            className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={onOpenConfiguration}
          title="More configuration"
          className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
        >
          <SettingsIcon size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {/* My generations */}
        <GroupHeader
          icon={<ClockIcon size={12} />}
          label="My Sessions"
          count={filteredProtocols.length + (liveGeneration ? 1 : 0)}
          open={protocolsOpen}
          onToggle={() => setProtocolsOpen((o) => !o)}
        />
        {protocolsOpen && (
          <div className="mb-2 space-y-0.5">
            {filteredProtocols.length === 0 && !liveGeneration && (
              <p className="px-2 py-1 text-[11px] text-slate-400">
                Custom sessions will appear here
              </p>
            )}
            {liveGeneration && (
              <button
                type="button"
                onClick={onSelectGeneration}
                title={liveGeneration.prompt}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition",
                  selection?.kind === "generation" ? "bg-brand-50" : "hover:bg-slate-100",
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    selection?.kind === "generation"
                      ? "font-medium text-brand-600"
                      : "text-slate-600",
                  )}
                >
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-brand-500" />
                  <span className="truncate">{liveGeneration.prompt || "(generating)"}</span>
                </span>
                <span className="pl-3 text-[10px] text-brand-500">Generating…</span>
              </button>
            )}
            {filteredProtocols.map((p) => {
              const active = selection?.kind === "session" && selection.id === p.id;
              const menuOpen = menuSessionId === p.id;
              return (
                <div key={p.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelectProtocol(p.id)}
                    title={p.title}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 pr-7 text-left transition",
                      active ? "bg-brand-50" : "hover:bg-slate-100",
                    )}
                  >
                    <span
                      className={cn(
                        "truncate text-xs",
                        active ? "font-medium text-brand-600" : "text-slate-600",
                      )}
                    >
                      {p.title}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatTime(p.updated_at)}
                    </span>
                  </button>

                  {/* Hover actions: ⋮ menu with Rename / Delete */}
                  <div
                    ref={menuOpen ? menuRef : undefined}
                    className={cn("absolute right-1 top-1.5", menuOpen && "z-50")}
                  >
                    <button
                      type="button"
                      title="更多操作"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuSessionId(menuOpen ? null : p.id);
                      }}
                      className={cn(
                        "rounded-md p-1 text-slate-400 transition hover:bg-white hover:text-slate-600",
                        menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                      )}
                    >
                      <MoreVerticalIcon size={14} />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 top-6 z-50 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuSessionId(null);
                            setRenaming(p);
                          }}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-slate-600 transition hover:bg-slate-100"
                        >
                          <PencilIcon size={13} className="text-slate-400" />
                          重命名
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuSessionId(null);
                            setDeleting(p);
                          }}
                          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs text-red-600 transition hover:bg-red-50"
                        >
                          <TrashIcon size={13} />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Preset samples */}
        <GroupHeader
          icon={<BoxIcon size={12} />}
          label="Presets"
          count={filteredPresets.length}
          open={presetsOpen}
          onToggle={() => setPresetsOpen((o) => !o)}
        />
        {presetsOpen && (
          <div className="space-y-0.5">
            {filteredPresets.length === 0 && (
              <p className="px-2 py-1 text-[11px] text-slate-400">No presets found</p>
            )}
            {filteredPresets.map((p) => {
              const active = selection?.kind === "preset" && selection.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPreset(p.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition",
                    active
                      ? "bg-brand-50 font-medium text-brand-600"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  <BoxIcon size={13} className={active ? "text-brand-500" : "text-slate-300"} />
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Rename dialog */}
      {renaming && (
        <RenameDialog
          session={renaming}
          onCancel={() => setRenaming(null)}
          onSave={async (title) => {
            await onRenameSession(renaming.id, title);
            setRenaming(null);
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleting && (
        <DeleteDialog
          session={deleting}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await onDeleteSession(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
