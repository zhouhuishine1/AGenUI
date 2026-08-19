/** Top bar: sidebar toggle, brand, LAN address hint. */

import { useEffect, useRef, useState } from "react";
import { DownloadIcon, MenuIcon, QrIcon } from "@/components/icons";
import mainpageIcon from "@/assets/mainpage_icon.png";
import { QrCodeCard } from "@/components/Protocol/QrCodeCard";
import type { ServerInfo } from "@/types";

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  serverInfo: ServerInfo | null;
  qrUrl: string | null;
}

export function Header({ sidebarOpen, onToggleSidebar, serverInfo, qrUrl }: HeaderProps) {
  const [scanOpen, setScanOpen] = useState(false);
  const scanMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scanOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!scanMenuRef.current?.contains(event.target as Node)) setScanOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [scanOpen]);

  const lanAddress = serverInfo?.base_url.replace(/^https?:\/\//, "");

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3">
      <button
        type="button"
        onClick={onToggleSidebar}
        title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      >
        <MenuIcon size={18} />
      </button>

      <a
        href="https://genui.amap.com/"
        target="_blank"
        rel="noopener noreferrer"
        title="Visit genui.amap.com"
        className="flex items-center gap-2 rounded-md transition hover:opacity-80"
      >
        <img
          src={mainpageIcon}
          alt="AGenUI Studio"
          className="h-6 w-6 rounded-md object-cover"
        />
        <h1 className="text-sm font-semibold tracking-wide text-slate-800">
          AGenUI Studio
        </h1>
      </a>

      <div className="ml-auto flex items-center gap-3">
        <a
          href="https://genui.amap.com/playground"
          target="_blank"
          rel="noopener noreferrer"
          title="Download AGenUI Playground to preview on your device"
          className="flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
        >
          <DownloadIcon size={13} />
          Download Playground
        </a>
        {serverInfo && (
          <div ref={scanMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setScanOpen((open) => !open)}
              aria-expanded={scanOpen}
              aria-haspopup="dialog"
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white"
              title="Scan protocol with AGenUI Playground"
            >
              <QrIcon size={13} className="text-brand-500" />
              Scan and Preview
            </button>
            {scanOpen && (
              <div role="dialog" aria-label="Scan and Preview" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <QrCodeCard url={qrUrl ?? serverInfo.base_url} lanAddress={lanAddress} />
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
