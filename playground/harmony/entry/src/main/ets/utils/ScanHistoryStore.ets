import { fileIo as fs } from '@kit.CoreFileKit';
import { common } from '@kit.AbilityKit';
import util from '@ohos.util';

const FILE_NAME = 'scan_history.json';
const TAG = 'ScanHistoryStore';
const DOMAIN = 0x0000;

/**
 * A single scanned session persisted on the home screen.
 */
export interface ScanHistoryItem {
  /** Unique key = the A2UI surfaceId carried by createSurface. */
  sessionId: string;
  /** Display name (Session title) shown as the row's main title. */
  name: string;
  /** Last saved time in epoch milliseconds. */
  createdAt: number;
  createSurfaceJson: string;
  updateComponentsJson: string;
  updateDataModelJson: string;
}

function filePath(context: common.Context): string {
  return `${context.filesDir}/${FILE_NAME}`;
}

/** Load items sorted newest-first. */
export function loadScanHistory(context: common.Context): ScanHistoryItem[] {
  try {
    if (!fs.accessSync(filePath(context))) {
      return [];
    }
    const fd = fs.openSync(filePath(context), fs.OpenMode.READ_ONLY).fd;
    const stat = fs.statSync(filePath(context));
    const buf = new ArrayBuffer(stat.size);
    fs.readSync(fd, buf);
    fs.closeSync(fd);
    const decoder = util.TextDecoder.create('utf-8');
    const text = decoder.decodeWithStream(new Uint8Array(buf));
    const items = JSON.parse(text) as ScanHistoryItem[];
    items.sort((a: ScanHistoryItem, b: ScanHistoryItem): number => b.createdAt - a.createdAt);
    return items;
  } catch (e) {
    return [];
  }
}

/** Insert a new record or overwrite the one with the same sessionId. */
export function upsertScanHistory(context: common.Context, item: ScanHistoryItem): ScanHistoryItem[] {
  const items = loadScanHistory(context);
  let idx = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i].sessionId === item.sessionId) {
      idx = i;
      break;
    }
  }
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.push(item);
  }
  items.sort((a: ScanHistoryItem, b: ScanHistoryItem): number => b.createdAt - a.createdAt);
  persist(context, items);
  return items;
}

/** Delete the records whose sessionId is in {@code sessionIds}. */
export function deleteScanHistory(context: common.Context, sessionIds: string[]): ScanHistoryItem[] {
  const items = loadScanHistory(context).filter((it: ScanHistoryItem): boolean => sessionIds.indexOf(it.sessionId) < 0);
  persist(context, items);
  return items;
}

function persist(context: common.Context, items: ScanHistoryItem[]): void {
  try {
    const fd = fs.openSync(filePath(context),
      fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC).fd;
    try {
      fs.writeSync(fd, JSON.stringify(items));
    } finally {
      fs.closeSync(fd);
    }
  } catch (e) {
    // Best-effort persistence; ignore write failures.
  }
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Format an epoch-millis timestamp as "MM/dd HH:mm". */
export function formatScanTime(millis: number): string {
  const d = new Date(millis);
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
