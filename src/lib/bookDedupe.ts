import {BookItem} from '../types/library';

export function normalizeBookTitle(title: string): string {
  return title
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toTimestampMillis(ts: unknown): number {
  if (
    ts &&
    typeof ts === 'object' &&
    'toMillis' in ts &&
    typeof (ts as {toMillis: () => number}).toMillis === 'function'
  ) {
    return (ts as {toMillis: () => number}).toMillis();
  }
  return Number.MAX_SAFE_INTEGER;
}

function scoreBookQuality(book: BookItem): number {
  let score = 0;
  if (book.published) score += 4;
  if (book.summary.trim().length > 0) score += 2;
  if (book.author.trim().length > 0) score += 1;
  if (book.pages > 0) score += 1;
  if (book.fileSize && book.fileSize !== 'PDF') score += 1;
  if (book.downloads > 0) score += 1;
  return score;
}

function pickBestCopy(group: BookItem[]): BookItem {
  const sorted = [...group].sort((a, b) => {
    const scoreDiff = scoreBookQuality(b) - scoreBookQuality(a);
    if (scoreDiff !== 0) return scoreDiff;
    const dlDiff = (b.downloads || 0) - (a.downloads || 0);
    if (dlDiff !== 0) return dlDiff;
    // Prefer earliest created copy as canonical original
    return toTimestampMillis(a.createdAt) - toTimestampMillis(b.createdAt);
  });
  return sorted[0];
}

export interface DuplicateBookEntry {
  duplicate: BookItem;
  keptOriginal: BookItem;
  reason: 'drive-id' | 'title';
  canSafelyDeleteDriveFile: boolean;
}

export function findDuplicateBooks(books: BookItem[]): DuplicateBookEntry[] {
  const results: DuplicateBookEntry[] = [];
  const markedDuplicateIds = new Set<string>();

  // Pass 1: Exact same Google Drive File ID
  const byDriveId = new Map<string, BookItem[]>();
  for (const book of books) {
    const fid = book.driveFileId.trim();
    if (!fid) continue;
    const list = byDriveId.get(fid) || [];
    list.push(book);
    byDriveId.set(fid, list);
  }

  for (const group of byDriveId.values()) {
    if (group.length <= 1) continue;
    const keeper = pickBestCopy(group);
    for (const item of group) {
      if (item.id === keeper.id) continue;
      markedDuplicateIds.add(item.id);
      results.push({
        duplicate: item,
        keptOriginal: keeper,
        reason: 'drive-id',
        // Never delete Drive PDF if keeper still uses the exact same driveFileId!
        canSafelyDeleteDriveFile: false,
      });
    }
  }

  // Pass 2: Same normalized book title among remaining non-duplicate items
  const byTitle = new Map<string, BookItem[]>();
  for (const book of books) {
    if (markedDuplicateIds.has(book.id)) continue;
    const key = normalizeBookTitle(book.title);
    if (!key) continue;
    const list = byTitle.get(key) || [];
    list.push(book);
    byTitle.set(key, list);
  }

  for (const group of byTitle.values()) {
    if (group.length <= 1) continue;
    const keeper = pickBestCopy(group);
    for (const item of group) {
      if (item.id === keeper.id) continue;
      markedDuplicateIds.add(item.id);
      results.push({
        duplicate: item,
        keptOriginal: keeper,
        reason: 'title',
        canSafelyDeleteDriveFile:
          Boolean(item.driveFileId.trim()) &&
          item.driveFileId.trim() !== keeper.driveFileId.trim(),
      });
    }
  }

  // Verify no remaining kept book anywhere else uses the duplicate's driveFileId
  const keptDriveIds = new Set(
    books
      .filter((b) => !markedDuplicateIds.has(b.id))
      .map((b) => b.driveFileId.trim())
      .filter(Boolean),
  );

  return results.map((entry) => ({
    ...entry,
    canSafelyDeleteDriveFile:
      entry.canSafelyDeleteDriveFile &&
      !keptDriveIds.has(entry.duplicate.driveFileId.trim()),
  }));
}
