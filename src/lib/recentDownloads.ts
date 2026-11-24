import {BookItem} from '../types/library';

export const RECENT_DOWNLOADS_STORAGE_KEY = 'mml_recent_downloads_v1';
const MAX_RECENT_DOWNLOADS = 6;

export interface RecentDownloadEntry {
  bookId: string;
  title: string;
  author: string;
  categoryLabel: string;
  fileSize: string;
  downloadedAt: number;
}

type RecentDownloadsListener = (entries: RecentDownloadEntry[]) => void;

const listeners = new Set<RecentDownloadsListener>();

function readFromStorage(): RecentDownloadEntry[] {
  try {
    const raw = window.localStorage.getItem(RECENT_DOWNLOADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentDownloadEntry =>
          Boolean(item) &&
          typeof item.bookId === 'string' &&
          typeof item.title === 'string' &&
          typeof item.downloadedAt === 'number',
      )
      .slice(0, MAX_RECENT_DOWNLOADS);
  } catch {
    return [];
  }
}

function writeToStorage(entries: RecentDownloadEntry[]): void {
  try {
    window.localStorage.setItem(
      RECENT_DOWNLOADS_STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_RECENT_DOWNLOADS)),
    );
  } catch {
    // Ignore localStorage quota or private mode restrictions
  }
}

function notifyAll(): void {
  const snapshot = readFromStorage();
  listeners.forEach((listener) => listener(snapshot));
}

export function getRecentDownloads(): RecentDownloadEntry[] {
  return readFromStorage();
}

export function recordRecentDownload(book: BookItem): void {
  if (!book?.id) return;
  const current = readFromStorage().filter((item) => item.bookId !== book.id);
  const nextEntry: RecentDownloadEntry = {
    bookId: book.id,
    title: book.title || 'Untitled Book',
    author: book.author || '',
    categoryLabel: book.categoryLabel || '',
    fileSize: book.fileSize || 'PDF',
    downloadedAt: Date.now(),
  };
  writeToStorage([nextEntry, ...current].slice(0, MAX_RECENT_DOWNLOADS));
  notifyAll();
}

export function removeRecentDownload(bookId: string): void {
  const next = readFromStorage().filter((item) => item.bookId !== bookId);
  writeToStorage(next);
  notifyAll();
}

export function clearRecentDownloads(): void {
  try {
    window.localStorage.removeItem(RECENT_DOWNLOADS_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  notifyAll();
}

export function subscribeRecentDownloads(
  listener: RecentDownloadsListener,
): () => void {
  listeners.add(listener);
  listener(readFromStorage());

  const handleStorage = (event: StorageEvent) => {
    if (event.key === RECENT_DOWNLOADS_STORAGE_KEY || event.key === null) {
      listener(readFromStorage());
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}
