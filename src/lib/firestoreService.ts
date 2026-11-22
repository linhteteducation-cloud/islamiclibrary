import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {DEFAULT_SITE_SETTINGS} from '../data/libraryData';
import {
  ArticleItem,
  BookItem,
  ContactMessageItem,
  DuaItem,
  SiteSettings,
  VideoItem,
} from '../types/library';
import {OperationType, db, handleFirestoreError} from './firebase';

function formatTimestamp(ts: unknown): string {
  if (
    ts &&
    typeof ts === 'object' &&
    'toDate' in ts &&
    typeof (ts as {toDate: () => Date}).toDate === 'function'
  ) {
    return (ts as {toDate: () => Date}).toDate().toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return '';
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
  return Date.now();
}

// ---------- Subscriptions ----------

export function subscribeBooks(
  includeUnpublished: boolean,
  onData: (books: BookItem[]) => void,
) {
  const path = 'books';
  // Keep public query single-field (where published == true) so no composite index is required
  // and real-time sync works immediately for every visitor on the web.
  const q = includeUnpublished
    ? query(collection(db, path), orderBy('createdAt', 'desc'))
    : query(collection(db, path), where('published', '==', true));

  return onSnapshot(
    q,
    (snap) => {
      const items: BookItem[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title || ''),
            author: String(data.author || ''),
            categoryId: data.categoryId,
            categoryLabel: String(data.categoryLabel || ''),
            type: data.type || 'Book',
            hijriYear: String(data.hijriYear || ''),
            pages: Number(data.pages || 0),
            fileSize: String(data.fileSize || ''),
            summary: String(data.summary || ''),
            driveFileId: String(data.driveFileId || ''),
            driveViewUrl: String(data.driveViewUrl || ''),
            driveDownloadUrl: String(data.driveDownloadUrl || ''),
            coverTheme: data.coverTheme || 'emerald',
            downloads: Number(data.downloads || 0),
            published: Boolean(data.published),
            uploadedByUid: String(data.uploadedByUid || ''),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        })
        .sort(
          (a, b) =>
            toTimestampMillis(b.createdAt) - toTimestampMillis(a.createdAt),
        );
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export function subscribeDuas(onData: (duas: DuaItem[]) => void) {
  const path = 'duas';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            titleMy: String(data.titleMy || ''),
            titleAr: String(data.titleAr || ''),
            categoryMy: data.categoryMy,
            arabic: String(data.arabic || ''),
            transliteration: String(data.transliteration || ''),
            meaningMy: String(data.meaningMy || ''),
            source: String(data.source || ''),
            createdByUid: String(data.createdByUid || ''),
          };
        }),
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export function subscribeVideos(onData: (videos: VideoItem[]) => void) {
  const path = 'videos';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title || ''),
            speaker: String(data.speaker || ''),
            categoryMy: String(data.categoryMy || ''),
            duration: String(data.duration || ''),
            videoUrl: String(data.videoUrl || ''),
            description: String(data.description || ''),
            createdByUid: String(data.createdByUid || ''),
          };
        }),
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export function subscribeArticles(onData: (articles: ArticleItem[]) => void) {
  const path = 'articles';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title || ''),
            kicker: String(data.kicker || ''),
            author: String(data.author || ''),
            readTime: String(data.readTime || ''),
            excerpt: String(data.excerpt || ''),
            body: String(data.body || ''),
            createdByUid: String(data.createdByUid || ''),
            createdAtLabel: formatTimestamp(data.createdAt),
          };
        }),
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export function subscribeSiteSettings(onData: (settings: SiteSettings) => void) {
  const path = 'siteSettings/main';
  return onSnapshot(
    doc(db, 'siteSettings', 'main'),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_SITE_SETTINGS);
        return;
      }
      const data = snap.data();
      onData({
        hiddenSections: Array.isArray(data.hiddenSections)
          ? data.hiddenSections.map(String)
          : [],
        hiddenCategories: Array.isArray(data.hiddenCategories)
          ? data.hiddenCategories.map(String)
          : [],
        driveFolderId: String(data.driveFolderId || ''),
        driveFolderName: String(
          data.driveFolderName || DEFAULT_SITE_SETTINGS.driveFolderName,
        ),
        heroDescription: String(
          data.heroDescription || DEFAULT_SITE_SETTINGS.heroDescription,
        ),
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, path),
  );
}

export function subscribeContactMessages(
  onData: (messages: ContactMessageItem[]) => void,
) {
  const path = 'contactMessages';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || ''),
            contact: String(data.contact || ''),
            subject: String(data.subject || ''),
            message: String(data.message || ''),
            status: data.status === 'read' ? 'read' : 'unread',
            createdAtLabel: formatTimestamp(data.createdAt),
          };
        }),
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

// ---------- Mutations ----------

export async function createBookRecord(
  uid: string,
  payload: Omit<BookItem, 'id' | 'uploadedByUid' | 'createdAt' | 'updatedAt'>,
) {
  const path = 'books';
  try {
    const cleanPayload = {
      title: payload.title.trim().slice(0, 240),
      author: payload.author.trim().slice(0, 160),
      categoryId: payload.categoryId,
      categoryLabel: payload.categoryLabel.trim().slice(0, 120),
      type: payload.type,
      hijriYear: payload.hijriYear.trim().slice(0, 60),
      pages: Math.max(0, Math.min(10000, Math.round(Number(payload.pages) || 0))),
      fileSize: payload.fileSize.trim().slice(0, 40),
      summary: payload.summary.trim().slice(0, 3000),
      driveFileId: payload.driveFileId.trim().slice(0, 200),
      driveViewUrl: payload.driveViewUrl.trim().slice(0, 500),
      driveDownloadUrl: payload.driveDownloadUrl.trim().slice(0, 500),
      coverTheme: payload.coverTheme,
      downloads: Math.max(0, Math.round(Number(payload.downloads) || 0)),
      published: Boolean(payload.published),
      uploadedByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, path), cleanPayload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBookRecord(
  bookId: string,
  payload: Partial<
    Omit<BookItem, 'id' | 'uploadedByUid' | 'createdAt' | 'updatedAt'>
  >,
) {
  const path = `books/${bookId}`;
  try {
    const cleanPatch: Record<string, unknown> = {updatedAt: serverTimestamp()};
    if (payload.title !== undefined)
      cleanPatch.title = payload.title.trim().slice(0, 240);
    if (payload.author !== undefined)
      cleanPatch.author = payload.author.trim().slice(0, 160);
    if (payload.categoryId !== undefined)
      cleanPatch.categoryId = payload.categoryId;
    if (payload.categoryLabel !== undefined)
      cleanPatch.categoryLabel = payload.categoryLabel.trim().slice(0, 120);
    if (payload.type !== undefined) cleanPatch.type = payload.type;
    if (payload.hijriYear !== undefined)
      cleanPatch.hijriYear = payload.hijriYear.trim().slice(0, 60);
    if (payload.pages !== undefined)
      cleanPatch.pages = Math.max(
        0,
        Math.min(10000, Math.round(Number(payload.pages) || 0)),
      );
    if (payload.fileSize !== undefined)
      cleanPatch.fileSize = payload.fileSize.trim().slice(0, 40);
    if (payload.summary !== undefined)
      cleanPatch.summary = payload.summary.trim().slice(0, 3000);
    if (payload.driveFileId !== undefined)
      cleanPatch.driveFileId = payload.driveFileId.trim().slice(0, 200);
    if (payload.driveViewUrl !== undefined)
      cleanPatch.driveViewUrl = payload.driveViewUrl.trim().slice(0, 500);
    if (payload.driveDownloadUrl !== undefined)
      cleanPatch.driveDownloadUrl = payload.driveDownloadUrl.trim().slice(0, 500);
    if (payload.coverTheme !== undefined)
      cleanPatch.coverTheme = payload.coverTheme;
    if (payload.downloads !== undefined)
      cleanPatch.downloads = Math.max(0, Math.round(Number(payload.downloads) || 0));
    if (payload.published !== undefined)
      cleanPatch.published = Boolean(payload.published);

    await updateDoc(doc(db, 'books', bookId), cleanPatch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBookRecord(bookId: string) {
  const path = `books/${bookId}`;
  try {
    await deleteDoc(doc(db, 'books', bookId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createDuaRecord(
  uid: string,
  payload: Omit<DuaItem, 'id' | 'createdByUid'>,
) {
  const path = 'duas';
  try {
    await addDoc(collection(db, path), {
      titleMy: payload.titleMy.trim().slice(0, 240),
      titleAr: payload.titleAr.trim().slice(0, 240),
      categoryMy: payload.categoryMy,
      arabic: payload.arabic.trim().slice(0, 4000),
      transliteration: payload.transliteration.trim().slice(0, 2000),
      meaningMy: payload.meaningMy.trim().slice(0, 4000),
      source: payload.source.trim().slice(0, 200),
      createdByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteDuaRecord(duaId: string) {
  const path = `duas/${duaId}`;
  try {
    await deleteDoc(doc(db, 'duas', duaId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createVideoRecord(
  uid: string,
  payload: Omit<VideoItem, 'id' | 'createdByUid'>,
) {
  const path = 'videos';
  try {
    await addDoc(collection(db, path), {
      title: payload.title.trim().slice(0, 240),
      speaker: payload.speaker.trim().slice(0, 160),
      categoryMy: payload.categoryMy.trim().slice(0, 120),
      duration: payload.duration.trim().slice(0, 30),
      videoUrl: payload.videoUrl.trim().slice(0, 500),
      description: payload.description.trim().slice(0, 3000),
      createdByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteVideoRecord(videoId: string) {
  const path = `videos/${videoId}`;
  try {
    await deleteDoc(doc(db, 'videos', videoId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createArticleRecord(
  uid: string,
  payload: Omit<ArticleItem, 'id' | 'createdByUid' | 'createdAtLabel'>,
) {
  const path = 'articles';
  try {
    await addDoc(collection(db, path), {
      title: payload.title.trim().slice(0, 240),
      kicker: payload.kicker.trim().slice(0, 120),
      author: payload.author.trim().slice(0, 160),
      readTime: payload.readTime.trim().slice(0, 40),
      excerpt: payload.excerpt.trim().slice(0, 600),
      body: payload.body.trim().slice(0, 12000),
      createdByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteArticleRecord(articleId: string) {
  const path = `articles/${articleId}`;
  try {
    await deleteDoc(doc(db, 'articles', articleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSiteSettings(uid: string, settings: SiteSettings) {
  const path = 'siteSettings/main';
  try {
    await setDoc(doc(db, 'siteSettings', 'main'), {
      hiddenSections: settings.hiddenSections.slice(0, 20),
      hiddenCategories: settings.hiddenCategories.slice(0, 20),
      driveFolderId: settings.driveFolderId.trim().slice(0, 200),
      driveFolderName: settings.driveFolderName.trim().slice(0, 120),
      heroDescription: settings.heroDescription.trim().slice(0, 1000),
      updatedByUid: uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function submitContactMessage(payload: {
  name: string;
  contact: string;
  subject: string;
  message: string;
}) {
  const path = 'contactMessages';
  try {
    await addDoc(collection(db, path), {
      name: payload.name.trim().slice(0, 120),
      contact: payload.contact.trim().slice(0, 160),
      subject: payload.subject.trim().slice(0, 120),
      message: payload.message.trim().slice(0, 3000),
      status: 'unread',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markContactMessageRead(messageId: string) {
  const path = `contactMessages/${messageId}`;
  try {
    await updateDoc(doc(db, 'contactMessages', messageId), {
      status: 'read',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteContactMessage(messageId: string) {
  const path = `contactMessages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'contactMessages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
