export type ArchiveStyleToastPayload = { line1: string; line2: string };

const listeners = new Set<(p: ArchiveStyleToastPayload) => void>();

export function subscribeArchiveStyleToast(listener: (p: ArchiveStyleToastPayload) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitArchiveStyleToast(p: ArchiveStyleToastPayload): void {
  listeners.forEach((fn) => {
    fn(p);
  });
}
