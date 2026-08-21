import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigModal } from "./ConfigModal";

const { fetchAllConfig, saveConfig } = vi.hoisted(() => ({
  fetchAllConfig: vi.fn(),
  saveConfig: vi.fn(),
}));

vi.mock("@/api/client", () => ({ fetchAllConfig, saveConfig }));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe("ConfigModal", () => {
  it("keeps a new provider name editable until Save is clicked", async () => {
    fetchAllConfig.mockResolvedValue({ providers: [] });
    const onClose = vi.fn();
    render(<ConfigModal open onClose={onClose} onSaved={vi.fn()} />);

    await screen.findByRole("button", { name: "Add Provider" });
    fireEvent.click(screen.getByRole("button", { name: "Add Provider" }));
    const name = screen.getByPlaceholderText("provider name");
    (name as HTMLInputElement).focus();
    fireEvent.change(name, { target: { value: "custom" } });

    expect((name as HTMLInputElement).value).toBe("custom");
    expect(document.activeElement).toBe(name);
    expect(saveConfig).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close when the backdrop is clicked", async () => {
    fetchAllConfig.mockResolvedValue({ providers: [] });
    const onClose = vi.fn();
    const { container } = render(<ConfigModal open onClose={onClose} onSaved={vi.fn()} />);

    await screen.findByRole("button", { name: "Add Provider" });
    fireEvent.click(container.firstElementChild!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renames an active provider and keeps it active after saving", async () => {
    fetchAllConfig.mockResolvedValue({
      active: "first",
      providers: [{ name: "first", base_url: "https://example.test", api_key: "key", model: "model", max_tokens: 8192 }],
    });
    saveConfig.mockResolvedValue(undefined);
    render(<ConfigModal open onClose={vi.fn()} onSaved={vi.fn()} />);

    await screen.findByRole("button", { name: "first" });
    fireEvent.click(screen.getByRole("button", { name: "first" }));
    const name = screen.getByPlaceholderText("provider name");
    fireEvent.change(name, { target: { value: "renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveConfig).toHaveBeenCalledWith(
      [expect.objectContaining({ name: "renamed" })],
      ["first"],
      "renamed",
    ));
  });

  it("persists and closes only through Save", async () => {
    fetchAllConfig.mockResolvedValue({ providers: [] });
    saveConfig.mockResolvedValue(undefined);
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<ConfigModal open onClose={onClose} onSaved={onSaved} />);

    await screen.findByRole("button", { name: "Add Provider" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveConfig).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
