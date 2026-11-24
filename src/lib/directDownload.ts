import {BookItem} from '../types/library';
import {extractDriveFileId, isValidDriveFileId} from './googleDrive';
import {recordRecentDownload} from './recentDownloads';

export interface DownloadToastState {
  id: number;
  phase: 'starting' | 'downloading' | 'done' | 'error';
  bookTitle: string;
  message: string;
  loadedBytes?: number;
  totalBytes?: number | null;
  percent?: number | null;
}

type DownloadToastListener = (state: DownloadToastState | null) => void;

const listeners = new Set<DownloadToastListener>();
let currentToast: DownloadToastState | null = null;
let dismissTimer: number | null = null;
let sequence = 0;

function emitToast(next: DownloadToastState | null): void {
  currentToast = next;
  listeners.forEach((listener) => listener(currentToast));
}

export function clearDownloadToast(): void {
  if (dismissTimer !== null) {
    window.clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  emitToast(null);
}

export function notifyDownloadStarting(
  bookTitle: string,
  autoDismissMs?: number,
): number {
  if (dismissTimer !== null) {
    window.clearTimeout(dismissTimer);
    dismissTimer = null;
  }
  sequence += 1;
  const id = sequence;
  emitToast({
    id,
    phase: 'starting',
    bookTitle: bookTitle || 'PDF Book',
    message: 'Starting download...',
  });
  if (autoDismissMs && autoDismissMs > 0) {
    scheduleAutoDismiss(id, autoDismissMs);
  }
  return id;
}

function scheduleAutoDismiss(id: number, delayMs: number): void {
  if (dismissTimer !== null) {
    window.clearTimeout(dismissTimer);
  }
  dismissTimer = window.setTimeout(() => {
    if (currentToast?.id === id) {
      emitToast(null);
    }
    dismissTimer = null;
  }, delayMs);
}

export function subscribeDownloadToast(
  listener: DownloadToastListener,
): () => void {
  listeners.add(listener);
  listener(currentToast);
  return () => {
    listeners.delete(listener);
  };
}

export function resolveBookDriveFileId(book: BookItem): string {
  const raw =
    book.driveFileId?.trim() ||
    extractDriveFileId(book.driveDownloadUrl || book.driveViewUrl || '');
  return isValidDriveFileId(raw) ? raw : '';
}

export function sanitizeDownloadFilename(title: string): string {
  const cleaned = (title || 'Myanmar_Muslim_Library_Book')
    .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  if (!cleaned) return 'Myanmar_Muslim_Library_Book.pdf';
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

export function formatDownloadBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function containsPdfMagicHeader(chunk: Uint8Array): boolean {
  const slice = chunk.subarray(0, Math.min(1024, chunk.byteLength));
  // Check ASCII "%PDF-" = [0x25, 0x50, 0x44, 0x46, 0x2d]
  for (let i = 0; i <= slice.length - 5; i += 1) {
    if (
      slice[i] === 0x25 &&
      slice[i + 1] === 0x50 &&
      slice[i + 2] === 0x44 &&
      slice[i + 3] === 0x46 &&
      slice[i + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
}

async function fetchVerifiedPdfBlob(
  url: string,
  credentials: RequestCredentials,
  onProgress: (loadedBytes: number, totalBytes: number | null) => void,
): Promise<Blob> {
  const res = await fetch(url, {
    method: 'GET',
    credentials,
  });

  if (!res.ok) {
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const errPayload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (errPayload?.error) {
        throw new Error(errPayload.error);
      }
    }
    throw new Error(`HTTP ${res.status}`);
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    await res.body?.cancel().catch(() => {});
    throw new Error('NOT_PDF_HTML');
  }

  const rawLength = res.headers.get('content-length');
  const totalBytes =
    rawLength && /^\d+$/.test(rawLength) ? Number(rawLength) : null;

  const reader = res.body?.getReader();
  if (!reader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || !containsPdfMagicHeader(buf)) {
      throw new Error('NOT_PDF_MAGIC');
    }
    onProgress(buf.byteLength, totalBytes ?? buf.byteLength);
    return new Blob([buf], {type: 'application/pdf'});
  }

  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let loadedBytes = 0;
  let verifiedHeader = false;
  let headerProbe = new Uint8Array(0);

  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    if (!value || value.byteLength === 0) continue;

    if (!verifiedHeader) {
      const combined = new Uint8Array(
        Math.min(1024, headerProbe.byteLength + value.byteLength),
      );
      combined.set(headerProbe, 0);
      const remaining = combined.byteLength - headerProbe.byteLength;
      combined.set(value.subarray(0, remaining), headerProbe.byteLength);
      headerProbe = combined;

      if (containsPdfMagicHeader(headerProbe)) {
        verifiedHeader = true;
      } else if (headerProbe.byteLength >= 1024) {
        await reader.cancel().catch(() => {});
        throw new Error('NOT_PDF_MAGIC');
      }
    }

    const copied = new Uint8Array(value.byteLength);
    copied.set(value);
    chunks.push(copied);
    loadedBytes += value.byteLength;
    onProgress(loadedBytes, totalBytes);
  }

  if (!verifiedHeader && !containsPdfMagicHeader(headerProbe)) {
    throw new Error('NOT_PDF_MAGIC');
  }

  return new Blob(chunks, {type: 'application/pdf'});
}

function triggerBlobSave(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(blobUrl);
  }, 60_000);
}

export async function downloadBookDirectly(book: BookItem): Promise<void> {
  const toastId = notifyDownloadStarting(book.title);

  try {
    const fileId = resolveBookDriveFileId(book);
    if (!fileId) {
      throw new Error('ဒေါင်းလုဒ်ရယူရန် PDF ဖိုင်လင့်ခ် မတွေ့ရှိပါ။');
    }

    const filename = sanitizeDownloadFilename(book.title);
    const query = new URLSearchParams({
      fileId,
      title: book.title || filename,
    });

    const handleProgress = (loadedBytes: number, totalBytes: number | null) => {
      const percent =
        totalBytes && totalBytes > 0
          ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100))
          : null;
      emitToast({
        id: toastId,
        phase: 'downloading',
        bookTitle: book.title || 'PDF Book',
        message:
          percent !== null
            ? `Downloading PDF... ${percent}%`
            : 'Downloading PDF...',
        loadedBytes,
        totalBytes,
        percent,
      });
    };

    let pdfBlob: Blob | null = null;
    let lastError: unknown = null;

    // 1. Primary: stream genuine %PDF- bytes via same-origin server endpoint (sends session cookies inside fetch)
    try {
      pdfBlob = await fetchVerifiedPdfBlob(
        `/api/books/download?${query.toString()}`,
        'same-origin',
        handleProgress,
      );
    } catch (primaryErr) {
      lastError = primaryErr;
    }

    // 2. Fallback: direct Google UserContent CORS download (works even on static hosts when file has direct export)
    if (!pdfBlob) {
      try {
        pdfBlob = await fetchVerifiedPdfBlob(
          `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
          'omit',
          handleProgress,
        );
      } catch (fallbackErr) {
        if (!lastError) lastError = fallbackErr;
      }
    }

    if (!pdfBlob) {
      const rawMsg =
        lastError instanceof Error ? lastError.message : '';
      if (rawMsg === 'NOT_PDF_HTML' || rawMsg === 'NOT_PDF_MAGIC') {
        throw new Error(
          'PDF ဖိုင်အစစ်ကို Google Drive မှ ရယူ၍ မရနိုင်ပါ (ဖိုင်အများမြင် Permission ဖွင့်ထားကြောင်း စစ်ဆေးပါ)။',
        );
      }
      throw new Error(
        rawMsg && !rawMsg.startsWith('HTTP ')
          ? rawMsg
          : 'PDF ဖိုင်ကို တိုက်ရိုက်ဒေါင်းလုဒ်ရယူ၍ မရနိုင်ပါ။',
      );
    }

    // Save verified genuine PDF blob directly to device without navigating or hitting proxy HTML gates
    triggerBlobSave(pdfBlob, filename);

    // Persist to local recent downloads history
    recordRecentDownload(book);

    emitToast({
      id: toastId,
      phase: 'done',
      bookTitle: book.title || 'PDF Book',
      message: 'Download complete',
      loadedBytes: pdfBlob.size,
      totalBytes: pdfBlob.size,
      percent: 100,
    });
    scheduleAutoDismiss(toastId, 3500);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'PDF ဖိုင်ကို တိုက်ရိုက်ဒေါင်းလုဒ်ရယူ၍ မရနိုင်ပါ။';
    emitToast({
      id: toastId,
      phase: 'error',
      bookTitle: book.title || 'PDF Book',
      message,
    });
    scheduleAutoDismiss(toastId, 6000);
    throw err;
  }
}
