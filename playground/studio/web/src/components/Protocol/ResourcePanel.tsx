import { useRef, useState } from "react";
import { ImageIcon, PlusIcon, XIcon } from "@/components/icons";
import type { ImageResource } from "@/types";

export interface ResourcePanelProps {
  sessionId: string | null;
  resources: ImageResource[];
  disabled: boolean;
  onAdd: (input: { data_url?: string; source_url?: string; name?: string }) => Promise<void>;
  onUpdate: (id: string, changes: Partial<Pick<ImageResource, "name" | "selected">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ResourcePanel({ sessionId, resources, disabled, onAdd, onUpdate, onDelete }: ResourcePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Resource operation failed");
    } finally {
      setBusy(false);
    }
  };

  const addFiles = (files: FileList | File[]) => {
    for (const file of Array.from(files).filter((item) => item.type.startsWith("image/"))) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl === "string") void run(() => onAdd({ data_url: dataUrl, name: file.name }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (!sessionId) return <div className="flex h-full items-center justify-center p-6 text-center text-xs text-slate-400">Select a chat session to manage its images.</div>;

  return <div className="h-full overflow-auto bg-white p-3">
    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
    <div className="flex gap-2">
      <button type="button" disabled={disabled || busy} onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"><PlusIcon size={14} /> Add image</button>
      <form className="flex min-w-0 flex-1 gap-1" onSubmit={(event) => { event.preventDefault(); const sourceUrl = url.trim(); if (sourceUrl) void run(async () => { await onAdd({ source_url: sourceUrl }); setUrl(""); }); }}>
        <input value={url} onChange={(event) => setUrl(event.target.value)} disabled={disabled || busy} placeholder="Download image URL" className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-brand-500 disabled:opacity-50" />
        <button type="submit" disabled={disabled || busy || !url.trim()} className="rounded-md bg-brand-500 px-2 text-xs text-white disabled:opacity-50">Add</button>
      </form>
    </div>
    {error && <p className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-600">{error}</p>}
    <p className="mt-3 text-xs text-slate-400">Selected images are available to generated cards. Unselected images stay here until deleted.</p>
    <div className="mt-3 space-y-2">
      {resources.map((resource) => <div key={resource.id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
        <input type="checkbox" checked={resource.selected} disabled={disabled || busy} onChange={(event) => void run(() => onUpdate(resource.id, { selected: event.target.checked }))} aria-label={`Use ${resource.name}`} />
        <img src={resource.url} alt="" className="h-10 w-10 rounded object-cover" />
        <input defaultValue={resource.name} disabled={disabled || busy} onBlur={(event) => void run(() => onUpdate(resource.id, { name: event.target.value }))} className="min-w-0 flex-1 rounded border border-transparent px-1 text-xs text-slate-700 outline-none focus:border-slate-200" />
        <button type="button" disabled={disabled || busy} onClick={() => void run(() => onDelete(resource.id))} aria-label={`Delete ${resource.name}`} className="text-slate-400 hover:text-red-600 disabled:opacity-50"><XIcon size={15} /></button>
      </div>)}
      {resources.length === 0 && <div className="flex flex-col items-center gap-2 py-10 text-xs text-slate-400"><ImageIcon size={24} />No images yet</div>}
    </div>
  </div>;
}
