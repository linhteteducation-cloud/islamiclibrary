import {BookItem} from '../types/library';
import {extractDriveFileId, isValidDriveFileId} from './googleDrive';

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

export async function downloadBookDirectly(book: BookItem): Promise<void> {
  const fileId = resolveBookDriveFileId(book);
  if (!fileId) {
    throw new Error('ဒေါင်းလုဒ်ရယူရန် PDF ဖိုင်လင့်ခ် မတွေ့ရှိပါ။');
  }

  const filename = sanitizeDownloadFilename(book.title);
  const query = new URLSearchParams({
    fileId,
    title: book.title || filename,
  });

  // Verify upstream availability first so any error appears cleanly inside the page without navigating away
  const checkRes = await fetch(
    `/api/books/download?${query.toString()}&check=1`,
  );
  if (!checkRes.ok) {
    const errPayload = (await checkRes.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      errPayload?.error ||
        'PDF ဖိုင်ကို တိုက်ရိုက်ဒေါင်းလုဒ်ရယူ၍ မရနိုင်ပါ။',
    );
  }

  // Trigger browser-native attachment download directly without opening Google Drive
  const anchor = document.createElement('a');
  anchor.href = `/api/books/download?${query.toString()}`;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
  }, 1500);
}
