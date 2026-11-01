/// <reference lib="webworker" />
import { readTable } from '@/lib/internalLinks/readFile';
import { runAudit, AuditInputError, type TypeRule, type AuditSettings } from '@/lib/internalLinks/engine';

export interface WorkerFile { name: string; buf: ArrayBuffer }
export interface WorkerRequest {
  internal: WorkerFile; inlinks: WorkerFile; gscPages?: WorkerFile | null; gscQp?: WorkerFile | null;
  rules: TypeRule[]; settings: Partial<AuditSettings>;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
  try {
    post({ kind: 'progress', stage: 'Чтение файлов', pct: 3 });
    const internal = readTable(req.internal.name, req.internal.buf);
    const inlinks = readTable(req.inlinks.name, req.inlinks.buf);
    const gscPages = req.gscPages ? readTable(req.gscPages.name, req.gscPages.buf) : null;
    const gscQp = req.gscQp ? readTable(req.gscQp.name, req.gscQp.buf) : null;
    const result = runAudit({
      internal, inlinks, gscPages, gscQp, rules: req.rules, settings: req.settings,
      onProgress: (stage, pct) => post({ kind: 'progress', stage, pct }),
    });
    post({ kind: 'done', result });
  } catch (err) {
    post({ kind: 'error', message: err instanceof AuditInputError ? err.message : `Ошибка расчёта: ${(err as Error).message}` });
  }
};
