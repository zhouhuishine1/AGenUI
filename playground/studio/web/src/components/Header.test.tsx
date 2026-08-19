import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Header } from "./Header";

const serverInfo = { base_url: "http://10.235.102.14:8765", lan_ip: "10.235.102.14", port: 8765 };

afterEach(cleanup);

describe("Header", () => {
  it("opens the scan menu and closes it when clicking elsewhere", () => {
    render(<><Header sidebarOpen onToggleSidebar={() => {}} serverInfo={serverInfo} qrUrl="http://example.test/protocol" /><button type="button">Outside</button></>);

    fireEvent.click(screen.getByRole("button", { name: "Scan and Preview" }));
    expect(screen.getByRole("dialog", { name: "Scan and Preview" })).toBeTruthy();
    expect(screen.getByText("LAN 10.235.102.14:8765")).toBeTruthy();
    expect(screen.getByText("Copy URL")).toBeTruthy();

    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("dialog", { name: "Scan and Preview" })).toBeNull();
  });

  it("shows Scan and Preview before a protocol is selected", () => {
    render(<Header sidebarOpen onToggleSidebar={() => {}} serverInfo={serverInfo} qrUrl={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Scan and Preview" }));
    expect(screen.getByRole("dialog", { name: "Scan and Preview" })).toBeTruthy();
  });
});
