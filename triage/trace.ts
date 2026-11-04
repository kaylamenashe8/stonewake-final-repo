import { existsSync } from 'node:fs';
import { readZip } from './zip';

export interface TraceAction {
  method: string;
  title?: string;
  params: Record<string, unknown>;
  error?: string;
  startTime: number;
}

export interface NetworkCall {
  method: string;
  url: string;
  status: number;
  resourceType: string;
  time: number;
}

export interface TraceEvidence {
  actions: TraceAction[];
  network: NetworkCall[];
  consoleErrors: string[];
  pageErrors: string[];
  /** Document URLs in navigation order. */
  documentUrls: string[];
}

export const EMPTY_TRACE: TraceEvidence = {
  actions: [],
  network: [],
  consoleErrors: [],
  pageErrors: [],
  documentUrls: [],
};

function lines(buf: Buffer | undefined): Record<string, unknown>[] {
  if (!buf) return [];
  const out: Record<string, unknown>[] = [];
  for (const l of buf.toString('utf8').split('\n')) {
    if (!l.trim()) continue;
    try {
      out.push(JSON.parse(l) as Record<string, unknown>);
    } catch {
      /* partial line */
    }
  }
  return out;
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const asString = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Reads a Playwright trace.zip: browser actions, network log, console and page errors. */
export function readTrace(zipPath: string | undefined): TraceEvidence {
  if (!zipPath || !existsSync(zipPath)) return { ...EMPTY_TRACE };
  let entries: Map<string, Buffer>;
  try {
    entries = readZip(zipPath);
  } catch {
    return { ...EMPTY_TRACE };
  }
  const ev: TraceEvidence = { actions: [], network: [], consoleErrors: [], pageErrors: [], documentUrls: [] };
  const pending = new Map<string, TraceAction>();

  for (const [name, buf] of entries) {
    if (name.endsWith('.trace') && name !== 'test.trace') {
      for (const e of lines(buf)) {
        const type = asString(e.type);
        if (type === 'before') {
          const a: TraceAction = {
            method: asString(e.method),
            title: asString(e.title) || undefined,
            params: asRecord(e.params),
            startTime: typeof e.startTime === 'number' ? e.startTime : 0,
          };
          pending.set(asString(e.callId), a);
          ev.actions.push(a);
        } else if (type === 'after') {
          const a = pending.get(asString(e.callId));
          const err = asRecord(e.error);
          if (a && err.message) a.error = asString(err.message);
        } else if (type === 'console') {
          if (asString(e.messageType) === 'error') ev.consoleErrors.push(asString(e.text));
        } else if (type === 'event' && asString(e.method) === 'pageError') {
          const p = asRecord(e.params);
          const inner = asRecord(asRecord(p.error).error);
          ev.pageErrors.push(asString(inner.message) || asString(asRecord(p.error).message) || 'page error');
        }
      }
    } else if (name.endsWith('.network')) {
      for (const e of lines(buf)) {
        const s = asRecord(e.snapshot);
        const req = asRecord(s.request);
        const res = asRecord(s.response);
        const call: NetworkCall = {
          method: asString(req.method),
          url: asString(req.url),
          status: typeof res.status === 'number' ? res.status : -1,
          resourceType: asString(s._resourceType),
          time: typeof s._monotonicTime === 'number' ? s._monotonicTime : 0,
        };
        ev.network.push(call);
      }
    }
  }
  ev.actions.sort((a, b) => a.startTime - b.startTime);
  ev.network.sort((a, b) => a.time - b.time);
  ev.documentUrls = ev.network.filter((n) => n.resourceType === 'document' && n.status > 0).map((n) => n.url);
  return ev;
}
