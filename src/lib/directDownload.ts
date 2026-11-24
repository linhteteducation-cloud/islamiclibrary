import {BookItem} from '../types/library';
import {
  extractDriveFileId,
  isValidDriveFileId,
  isValidSafeHttpsUrl,
} from './googleDrive';
import {recordRecentDownload} from './recentDownloads';

// 3 MB chunks fit safely below both Vercel (4.5 MB) and Cloud Run (32 MB) limits
const CHUNK_DOWNLOAD_BYTES = 3 * 1024 * 1024;

export interface DownloadToastState {
  id: number;
  phase: 'starting' | 'downloading' | 'done' | 'error';
  bookTitle: string;
  message: string;
  loadedBytes?: number;
  totalBytes?: number | null;
  percent?: number | null;
}

export interface PdfSourceVerification {
  verified: boolean;
  mimeType: string;
  upstreamMimeType?: string;
  contentLength: number | null;
  supportsRange?: boolean;
  sourceType?: string;
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

export function resolveBookPdfSource(book: BookItem): {
  fileId: string;
  sourceUrl: string;
} {
  const fileId = resolveBookDriveFileId(book);
  const candidateUrl = book.driveDownloadUrl?.trim() || '';
  const sourceUrl = isValidSafeHttpsUrl(candidateUrl) ? candidateUrl : '';
  return {fileId, sourceUrl};
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

class BackendApiUnavailableError extends Error {
  constructor() {
    super('API_UNAVAILABLE');
    this.name = 'BackendApiUnavailableError';
  }
}

export async function verifyBookPdfSource(
  book: BookItem,
): Promise<PdfSourceVerification | null> {
  const {fileId, sourceUrl} = resolveBookPdfSource(book);
  if (!fileId && !sourceUrl) {
    throw new Error('ဒေါင်းလုဒ်ရယူရန် မှန်ကန်သော PDF လင့်ခ် မတွေ့ရှိပါ။');
  }

  const query = new URLSearchParams();
  if (fileId) query.set('fileId', fileId);
  if (sourceUrl) query.set('url', sourceUrl);

  const verifyRes = await fetch(`/api/books/verify?${query.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  });

  if (verifyRes.status === 404) {
    return null;
  }

  const contentType = (
    verifyRes.headers.get('content-type') || ''
  ).toLowerCase();
  if (contentType.includes('text/html')) {
    return null;
  }

  const payload = (await verifyRes.json().catch(() => null)) as
    | (PdfSourceVerification & {error?: string})
    | null;

  if (!verifyRes.ok || !payload?.verified) {
    throw new Error(
      payload?.error ||
        'PDF URL ရင်းမြစ်ကို စစ်ဆေး၍ မရနိုင်ပါ (HTML error page သို့မဟုတ် broken redirect ဖြစ်နေပါသည်)။',
    );
  }

  if (payload.mimeType !== 'application/pdf') {
    throw new Error(
      `PDF ဖိုင်အမျိုးအစား မဟုတ်ပါ (${payload.mimeType || 'unknown'})။`,
    );
  }

  return payload;
}

async function fetchVerifiedPdfChunks(
  url: string,
  credentials: RequestCredentials,
  options: {
    requirePdfMagicHeader: boolean;
    onProgress: (deltaBytes: number, totalBytes: number | null) => void;
  },
): Promise<Uint8Array<ArrayBuffer>[]> {
  const res = await fetch(url, {
    method: 'GET',
    credentials,
  });

  if (res.status === 404) {
    throw new BackendApiUnavailableError();
  }

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
  if (
    contentType.includes('text/html') ||
    contentType.includes('application/xhtml+xml') ||
    contentType.includes('application/xml') ||
    contentType.includes('text/xml')
  ) {
    await res.body?.cancel().catch(() => {});
    throw new BackendApiUnavailableError();
  }

  const rawLength = res.headers.get('content-length');
  const totalBytes =
    rawLength && /^\d+$/.test(rawLength) ? Number(rawLength) : null;

  const reader = res.body?.getReader();
  if (!reader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (
      buf.byteLength === 0 ||
      (options.requirePdfMagicHeader && !containsPdfMagicHeader(buf))
    ) {
      throw new Error('NOT_PDF_MAGIC');
    }
    options.onProgress(buf.byteLength, totalBytes ?? buf.byteLength);
    return [buf];
  }

  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let verifiedHeader = !options.requirePdfMagicHeader;
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
    options.onProgress(value.byteLength, totalBytes);
  }

  if (!verifiedHeader && !containsPdfMagicHeader(headerProbe)) {
    throw new Error('NOT_PDF_MAGIC');
  }

  return chunks;
}

async function fetchChunkedPdfBlob(
  baseQuery: URLSearchParams,
  totalLength: number,
  onProgress: (loadedBytes: number, totalBytes: number) => void,
): Promise<Blob> {
  const allParts: Uint8Array<ArrayBuffer>[] = [];
  let totalLoaded = 0;

  for (let start = 0; start < totalLength; start += CHUNK_DOWNLOAD_BYTES) {
    const end = Math.min(totalLength - 1, start + CHUNK_DOWNLOAD_BYTES - 1);
    const chunkQuery = new URLSearchParams(baseQuery);
    chunkQuery.set('start', String(start));
    chunkQuery.set('end', String(end));

    let chunkParts: Uint8Array<ArrayBuffer>[] | null = null;
    let lastChunkErr: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let attemptLoaded = 0;
      try {
        chunkParts = await fetchVerifiedPdfChunks(
          `/api/books/download?${chunkQuery.toString()}`,
          'same-origin',
          {
            requirePdfMagicHeader: start === 0,
            onProgress: (deltaBytes) => {
              attemptLoaded += deltaBytes;
              onProgress(
                Math.min(totalLength, totalLoaded + attemptLoaded),
                totalLength,
              );
            },
          },
        );
        totalLoaded += attemptLoaded;
        break;
      } catch (err) {
        if (err instanceof BackendApiUnavailableError) {
          throw err;
        }
        lastChunkErr = err;
      }
    }

    if (!chunkParts) {
      throw lastChunkErr instanceof Error
        ? lastChunkErr
        : new Error('PDF chunk transfer failed.');
    }

    allParts.push(...chunkParts);
  }

  return new Blob(allParts, {type: 'application/pdf'});
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

function triggerDirectAttachmentFallback(
  fileId: string,
  sourceUrl: string,
  filename: string,
): boolean {
  const targetUrl = fileId
    ? `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`
    : sourceUrl;
  if (!targetUrl || !isValidSafeHttpsUrl(targetUrl)) {
    return false;
  }

  // Trigger native navigation download (Sec-Fetch-Mode: navigate) so Drive sends Content-Disposition: attachment without opening Drive UI
  const anchor = document.createElement('a');
  anchor.href = targetUrl;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
  }, 1500);
  return true;
}

export async function downloadBookDirectly(book: BookItem): Promise<void> {
  const toastId = notifyDownloadStarting(book.title);

  try {
    const {fileId, sourceUrl} = resolveBookPdfSource(book);
    if (!fileId && !sourceUrl) {
      throw new Error('ဒေါင်းလုဒ်ရယူရန် PDF ဖိုင်လင့်ခ် မတွေ့ရှိပါ။');
    }

    const filename = sanitizeDownloadFilename(book.title);

    // 1. Pre-verify the PDF URL source and MIME type on the server before initiating download
    const verification = await verifyBookPdfSource(book);

    // If /api/books/verify returned 404 or HTML (static-only hosting), fall back cleanly to direct attachment download
    if (!verification) {
      if (triggerDirectAttachmentFallback(fileId, sourceUrl, filename)) {
        recordRecentDownload(book);
        emitToast({
          id: toastId,
          phase: 'done',
          bookTitle: book.title || 'PDF Book',
          message: 'Download started',
        });
        scheduleAutoDismiss(toastId, 3500);
        return;
      }
      throw new Error('PDF ဖိုင်ကို တိုက်ရိုက်ဒေါင်းလုဒ်ရယူ၍ မရနိုင်ပါ။');
    }

    const query = new URLSearchParams({
      title: book.title || filename,
    });
    if (fileId) query.set('fileId', fileId);
    if (sourceUrl) query.set('url', sourceUrl);

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

    try {
      // 2. For files > 3 MB, stream in 3 MB verified byte-range chunks (safe on both Vercel and Cloud Run)
      if (
        verification.contentLength &&
        verification.contentLength > CHUNK_DOWNLOAD_BYTES &&
        verification.supportsRange !== false
      ) {
        pdfBlob = await fetchChunkedPdfBlob(
          query,
          verification.contentLength,
          (loaded, total) => handleProgress(loaded, total),
        );
      } else {
        // 3. Single-stream verified download for files <= 3 MB
        let singleLoaded = 0;
        const parts = await fetchVerifiedPdfChunks(
          `/api/books/download?${query.toString()}`,
          'same-origin',
          {
            requirePdfMagicHeader: true,
            onProgress: (delta, totalFromHeader) => {
              singleLoaded += delta;
              handleProgress(
                singleLoaded,
                verification.contentLength ?? totalFromHeader,
              );
            },
          },
        );
        pdfBlob = new Blob(parts, {type: 'application/pdf'});
      }
    } catch (primaryErr) {
      if (primaryErr instanceof BackendApiUnavailableError) {
        if (triggerDirectAttachmentFallback(fileId, sourceUrl, filename)) {
          recordRecentDownload(book);
          emitToast({
            id: toastId,
            phase: 'done',
            bookTitle: book.title || 'PDF Book',
            message: 'Download started',
          });
          scheduleAutoDismiss(toastId, 3500);
          return;
        }
      }
      lastError = primaryErr;
    }

    if (!pdfBlob) {
      const rawMsg = lastError instanceof Error ? lastError.message : '';
      if (rawMsg === 'NOT_PDF_HTML' || rawMsg === 'NOT_PDF_MAGIC') {
        throw new Error(
          'PDF ဖိုင်အစစ်ကို ရယူ၍ မရနိုင်ပါ (HTML error page သို့မဟုတ် ဖိုင် Permission ကန့်သတ်ထားပါသည်)။',
        );
      }
      throw new Error(
        rawMsg
          ? `PDF ဖိုင်ကို တိုက်ရိုက်ဒေါင်းလုဒ်ရယူ၍ မရနိုင်ပါ (${rawMsg})။`
          : 'PDF ဖိုင်ကို တိုက်ရိုက်ဒေါင်းလုဒ်ရယူ၍ မရနိုင်ပါ။',
      );
    }

    // Save verified genuine PDF blob directly to device
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
