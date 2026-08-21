/** Modal for viewing/editing all provider configurations in config.json. */

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAllConfig, saveConfig } from "@/api/client";
import { EyeIcon, EyeOffIcon, PlusIcon, TrashIcon } from "@/components/icons";
import type { ConfigProvider } from "@/types";

type ProviderDraft = ConfigProvider & { id: number; isNew: boolean; originalName?: string };

interface ConfigModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ConfigModal({ open, onClose, onSaved }: ConfigModalProps) {
  const [providers, setProviders] = useState<ProviderDraft[]>([]);
  const [originalNames, setOriginalNames] = useState<string[]>([]);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [editingNames, setEditingNames] = useState<Set<number>>(new Set());
  const [showKeys, setShowKeys] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const nextProviderId = useRef(0);

  // Load config when modal opens.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setShowKeys(new Set());
    setEditingNames(new Set());
    fetchAllConfig()
      .then((data) => {
        setProviders(data.providers.map((provider) => ({ ...provider, id: ++nextProviderId.current, isNew: false, originalName: provider.name })));
        setOriginalNames(data.providers.map((p) => p.name));
        setActiveProvider(data.active);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  const updateField = useCallback(
    (id: number, field: keyof ConfigProvider, value: string | number) => {
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
      );
    },
    [],
  );

  const toggleKey = (id: number) => {
    setShowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addProvider = () => {
    setProviders((prev) => [
      ...prev,
      { id: ++nextProviderId.current, isNew: true, name: "", base_url: "", api_key: "", model: "", max_tokens: 8192 },
    ]);
    setShowKeys((prev) => new Set(prev).add(nextProviderId.current));
  };

  const removeProvider = (id: number) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
    setShowKeys((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setEditingNames((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Providers present in the loaded config but no longer in the list were
      // deleted by the user; tell the backend to remove them from config.json.
      const currentNames = new Set(providers.map((p) => p.name));
      const removed = originalNames.filter((n) => !currentNames.has(n));
      const renamedActive = providers.find((p) => p.originalName === activeProvider && p.name !== activeProvider);
      await saveConfig(providers.map(({ id: _id, isNew: _isNew, originalName: _originalName, ...provider }) => provider), removed, renamedActive?.name);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-800">Model Configuration</h2>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="py-8 text-center text-xs text-slate-400">Loading...</p>
          )}

          {!loading &&
            providers.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5"
              >
                {/* Provider name + delete */}
                <div className="mb-2.5 flex items-center justify-between">
                  {p.isNew || editingNames.has(p.id) ? (
                    <input
                      value={p.name}
                      onChange={(e) => updateField(p.id, "name", e.target.value)}
                      placeholder="provider name"
                      className="w-40 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-brand-500"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingNames((prev) => new Set(prev).add(p.id))}
                      title="Edit provider name"
                      className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-brand-600"
                    >
                      {p.name}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeProvider(p.id)}
                    title="Remove provider"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Base URL
                    </span>
                    <input
                      value={p.base_url}
                      onChange={(e) => updateField(p.id, "base_url", e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Model
                    </span>
                    <input
                      value={p.model}
                      onChange={(e) => updateField(p.id, "model", e.target.value)}
                      placeholder="model-name"
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      API Key
                    </span>
                    <div className="relative">
                      <input
                        type={showKeys.has(p.id) ? "text" : "password"}
                        value={p.api_key}
                        onChange={(e) => updateField(p.id, "api_key", e.target.value)}
                        placeholder="sk-..."
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 pr-9 text-xs text-slate-700 outline-none transition focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => toggleKey(p.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                      >
                        {showKeys.has(p.id) ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                      </button>
                    </div>
                  </label>
                </div>
              </div>
            ))}

          {/* Add provider */}
          {!loading && (
            <button
              type="button"
              onClick={addProvider}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-xs font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-600"
            >
              <PlusIcon size={13} />
              Add Provider
            </button>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-slate-200 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
