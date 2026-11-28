import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  enableNetwork,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  DEFAULT_CONTACT_LINKS,
  DEFAULT_FATWA_CATEGORIES,
  DEFAULT_SITE_SETTINGS,
} from '../data/libraryData';
import {
  AdminInviteItem,
  ArticleItem,
  BookItem,
  CategoryIconName,
  CategoryItem,
  ContactMessageItem,
  DuaItem,
  DuaSlideItem,
  DuaSlideMimeType,
  FatwaCategoryItem,
  FatwaQuestionItem,
  FatwaQuestionStatus,
  FooterContactLinks,
  PublishedFatwaItem,
  SiteSettings,
  TelegramSettings,
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

const SAFE_HTTPS_REGEX = /^https:\/\/[^\s]+$/;
const CONTACT_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const CONTACT_PHONE_REGEX = /^[+0-9][0-9\- ()]{4,29}$/;

export function normalizeSingleContactLink(
  channel: keyof FooterContactLinks,
  rawValue: string,
): {value: string; error?: string} {
  const trimmed = (rawValue || '').trim();
  if (!trimmed) return {value: ''};

  if (channel === 'email') {
    const cleanEmail = trimmed.replace(/^mailto:/i, '').trim().slice(0, 160);
    if (!CONTACT_EMAIL_REGEX.test(cleanEmail)) {
      return {
        value: '',
        error: 'Email လိပ်စာ ပုံစံ မမှန်ကန်ပါ (ဥပမာ - name@gmail.com)။',
      };
    }
    return {value: cleanEmail};
  }

  if (channel === 'phone') {
    const cleanPhone = trimmed
      .replace(/^tel:/i, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 30);
    if (!CONTACT_PHONE_REGEX.test(cleanPhone)) {
      return {
        value: '',
        error: 'ဖုန်းနံပါတ် ပုံစံ မမှန်ကန်ပါ (ဥပမာ - +959123456789)။',
      };
    }
    return {value: cleanPhone};
  }

  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return {
      value: '',
      error: 'လုံခြုံရေးအရ ခွင့်မပြုသော Link ဖြစ်နေပါသည်။ https:// Link ကိုသာ ထည့်သွင်းပါ။',
    };
  }

  let normalized = trimmed;
  if (channel === 'telegram' && normalized.startsWith('@')) {
    const username = normalized.slice(1).trim();
    normalized = username ? `https://t.me/${username}` : '';
  } else if (
    channel === 'whatsapp' &&
    /^[+0-9][0-9\s\-()]{5,25}$/.test(normalized)
  ) {
    const digitsOnly = normalized.replace(/[^0-9]/g, '');
    normalized = digitsOnly ? `https://wa.me/${digitsOnly}` : '';
  } else if (/^http:\/\//i.test(normalized)) {
    normalized = `https://${normalized.slice(7)}`;
  } else if (!/^https:\/\//i.test(normalized)) {
    normalized = `https://${normalized.replace(/^\/+/, '')}`;
  }

  normalized = normalized.slice(0, 300);
  if (
    !normalized ||
    normalized.length < 10 ||
    !SAFE_HTTPS_REGEX.test(normalized) ||
    !normalized.slice(8).includes('.')
  ) {
    return {
      value: '',
      error: `${channel} Link သည် မှန်ကန်သော https:// URL ဖြစ်ရပါမည်။`,
    };
  }

  return {value: normalized};
}

export function sanitizeContactLinks(
  links?: Partial<FooterContactLinks> | null,
): FooterContactLinks {
  const source = links || DEFAULT_CONTACT_LINKS;
  return {
    facebook: normalizeSingleContactLink('facebook', String(source.facebook ?? '')).value,
    telegram: normalizeSingleContactLink('telegram', String(source.telegram ?? '')).value,
    youtube: normalizeSingleContactLink('youtube', String(source.youtube ?? '')).value,
    whatsapp: normalizeSingleContactLink('whatsapp', String(source.whatsapp ?? '')).value,
    github: normalizeSingleContactLink('github', String(source.github ?? '')).value,
    email: normalizeSingleContactLink('email', String(source.email ?? '')).value,
    phone: normalizeSingleContactLink('phone', String(source.phone ?? '')).value,
    website: normalizeSingleContactLink('website', String(source.website ?? '')).value,
  };
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
      const hasContactLinks =
        data.contactLinks && typeof data.contactLinks === 'object';
      const rawLinks = hasContactLinks
        ? (data.contactLinks as Record<string, unknown>)
        : null;

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
        contactLinks: rawLinks
          ? {
              facebook: String(rawLinks.facebook ?? ''),
              telegram: String(rawLinks.telegram ?? ''),
              youtube: String(rawLinks.youtube ?? ''),
              whatsapp: String(rawLinks.whatsapp ?? ''),
              github: String(rawLinks.github ?? ''),
              email: String(rawLinks.email ?? ''),
              phone: String(rawLinks.phone ?? ''),
              website: String(rawLinks.website ?? ''),
            }
          : DEFAULT_CONTACT_LINKS,
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
      contactLinks: sanitizeContactLinks(settings.contactLinks),
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

// ---------- Appointed Admins (Email-based) ----------

export function subscribeAdminInvites(
  onData: (invites: AdminInviteItem[]) => void,
) {
  const path = 'adminInvites';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            email: String(data.email || d.id),
            roleLabel: String(data.roleLabel || ''),
            addedByUid: String(data.addedByUid || ''),
            addedByEmail: String(data.addedByEmail || ''),
            createdAtLabel: formatTimestamp(data.createdAt),
          };
        }),
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export async function appointAdminByEmail(
  adderUid: string,
  adderEmail: string,
  targetEmail: string,
  roleLabel: string,
) {
  const normalizedEmail = targetEmail.trim().toLowerCase();
  const path = `adminInvites/${normalizedEmail}`;
  if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(normalizedEmail)) {
    throw new Error('မှန်ကန်သော Gmail / Email လိပ်စာ ထည့်သွင်းပါ။');
  }
  try {
    await setDoc(doc(db, 'adminInvites', normalizedEmail), {
      email: normalizedEmail.slice(0, 160),
      roleLabel: roleLabel.trim().slice(0, 80) || 'Library Admin',
      addedByUid: adderUid,
      addedByEmail: (adderEmail || '').trim().slice(0, 160),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeAdminInvite(targetEmail: string) {
  const normalizedEmail = targetEmail.trim().toLowerCase();
  const path = `adminInvites/${normalizedEmail}`;
  try {
    await deleteDoc(doc(db, 'adminInvites', normalizedEmail));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------- Telegram Bot Non-Secret Settings ----------

export const DEFAULT_TELEGRAM_SETTINGS: TelegramSettings = {
  connected: false,
  botUsername: '',
  botFirstName: '',
  allowedChatIds: '',
  autoSyncToWebsite: true,
  defaultCategoryId: 'auto',
  lastUpdateId: 0,
};

export function subscribeTelegramSettings(
  onData: (settings: TelegramSettings) => void,
) {
  const path = 'telegramSettings/main';
  return onSnapshot(
    doc(db, 'telegramSettings', 'main'),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_TELEGRAM_SETTINGS);
        return;
      }
      const data = snap.data();
      onData({
        connected: Boolean(data.connected),
        botUsername: String(data.botUsername || ''),
        botFirstName: String(data.botFirstName || ''),
        allowedChatIds: String(data.allowedChatIds || ''),
        autoSyncToWebsite: data.autoSyncToWebsite !== false,
        defaultCategoryId:
          (data.defaultCategoryId as TelegramSettings['defaultCategoryId']) ||
          'auto',
        lastUpdateId: Math.max(0, Math.floor(Number(data.lastUpdateId) || 0)),
      });
    },
    (error) => handleFirestoreError(error, OperationType.GET, path),
  );
}

export async function saveTelegramSettings(
  uid: string,
  settings: TelegramSettings,
) {
  const path = 'telegramSettings/main';
  try {
    await setDoc(doc(db, 'telegramSettings', 'main'), {
      connected: Boolean(settings.connected),
      botUsername: settings.botUsername.trim().slice(0, 120),
      botFirstName: settings.botFirstName.trim().slice(0, 120),
      allowedChatIds: settings.allowedChatIds.trim().slice(0, 500),
      autoSyncToWebsite: Boolean(settings.autoSyncToWebsite),
      defaultCategoryId: String(settings.defaultCategoryId || 'auto').slice(
        0,
        60,
      ),
      lastUpdateId: Math.max(0, Math.floor(Number(settings.lastUpdateId) || 0)),
      updatedByUid: uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ---------- Categories (Custom & Customized Built-ins) ----------

export function subscribeCategories(
  onData: (categories: CategoryItem[]) => void,
) {
  const path = 'categories';
  const q = query(collection(db, path), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id as CategoryItem['id'],
            nameMy: String(data.nameMy || ''),
            nameEn: String(data.nameEn || ''),
            descriptionMy: String(data.descriptionMy || ''),
            iconName: (data.iconName as CategoryIconName) || 'folder',
            sortOrder: Number(data.sortOrder ?? 100),
            createdByUid: String(data.createdByUid || ''),
          };
        }),
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export async function saveCategoryRecord(
  uid: string,
  payload: {
    id: string;
    nameMy: string;
    nameEn: string;
    descriptionMy: string;
    iconName: CategoryIconName;
    sortOrder: number;
    isExistingDoc?: boolean;
  },
) {
  const cleanId = payload.id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (!cleanId || cleanId === 'all') {
    throw new Error('Category ID မမှန်ကန်ပါ။');
  }
  const path = `categories/${cleanId}`;
  const docRef = doc(db, 'categories', cleanId);
  const cleanFields = {
    nameMy: payload.nameMy.trim().slice(0, 120),
    nameEn: payload.nameEn.trim().slice(0, 120),
    descriptionMy: payload.descriptionMy.trim().slice(0, 400),
    iconName: payload.iconName,
    sortOrder: Math.max(0, Math.min(10000, Math.round(Number(payload.sortOrder) || 0))),
  };
  if (!cleanFields.nameMy) {
    throw new Error('မြန်မာကဏ္ဍအမည် ထည့်သွင်းပါ။');
  }

  try {
    await enableNetwork(db).catch(() => {});
    if (payload.isExistingDoc) {
      try {
        await updateDoc(docRef, {
          ...cleanFields,
          updatedAt: serverTimestamp(),
        });
      } catch (updateErr) {
        const msg =
          updateErr instanceof Error ? updateErr.message : String(updateErr);
        const code =
          typeof updateErr === 'object' && updateErr && 'code' in updateErr
            ? String((updateErr as {code?: unknown}).code || '')
            : '';
        if (code === 'not-found' || msg.includes('No document to update')) {
          await setDoc(docRef, {
            ...cleanFields,
            createdByUid: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          throw updateErr;
        }
      }
    } else {
      await setDoc(docRef, {
        ...cleanFields,
        createdByUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return cleanId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCategoryRecord(categoryId: string) {
  const path = `categories/${categoryId}`;
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------- Fatwa Categories (Full Admin Control) ----------

export function subscribeFatwaCategories(
  onData: (categories: FatwaCategoryItem[]) => void,
) {
  const path = 'fatwaCategories';
  const q = query(collection(db, path), orderBy('sortOrder', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            nameMy: String(data.nameMy || ''),
            nameEn: String(data.nameEn || ''),
            descriptionMy: String(data.descriptionMy || ''),
            sortOrder: Number(data.sortOrder ?? 100),
            createdByUid: String(data.createdByUid || ''),
          };
        }),
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export async function saveFatwaCategoryRecord(
  uid: string,
  payload: {
    id: string;
    nameMy: string;
    nameEn: string;
    descriptionMy: string;
    sortOrder: number;
    isExistingDoc?: boolean;
  },
) {
  const cleanId = payload.id
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (!cleanId || cleanId === 'all') {
    throw new Error('Fatwa Category ID မမှန်ကန်ပါ။');
  }
  const path = `fatwaCategories/${cleanId}`;
  const docRef = doc(db, 'fatwaCategories', cleanId);
  const cleanFields = {
    nameMy: payload.nameMy.trim().slice(0, 120),
    nameEn: payload.nameEn.trim().slice(0, 120),
    descriptionMy: payload.descriptionMy.trim().slice(0, 400),
    sortOrder: Math.max(
      0,
      Math.min(10000, Math.round(Number(payload.sortOrder) || 0)),
    ),
  };
  if (!cleanFields.nameMy) {
    throw new Error('ဖသ်ဝါ ကဏ္ဍအမည် ထည့်သွင်းပါ။');
  }

  try {
    await enableNetwork(db).catch(() => {});
    if (payload.isExistingDoc) {
      try {
        await updateDoc(docRef, {
          ...cleanFields,
          updatedAt: serverTimestamp(),
        });
      } catch (updateErr) {
        const msg =
          updateErr instanceof Error ? updateErr.message : String(updateErr);
        const code =
          typeof updateErr === 'object' && updateErr && 'code' in updateErr
            ? String((updateErr as {code?: unknown}).code || '')
            : '';
        if (code === 'not-found' || msg.includes('No document to update')) {
          await setDoc(docRef, {
            ...cleanFields,
            createdByUid: uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          throw updateErr;
        }
      }
    } else {
      await setDoc(docRef, {
        ...cleanFields,
        createdByUid: uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return cleanId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedDefaultFatwaCategories(uid: string) {
  for (const cat of DEFAULT_FATWA_CATEGORIES) {
    await saveFatwaCategoryRecord(uid, {
      id: cat.id,
      nameMy: cat.nameMy,
      nameEn: cat.nameEn,
      descriptionMy: cat.descriptionMy,
      sortOrder: cat.sortOrder,
      isExistingDoc: true,
    });
  }
}

export async function deleteFatwaCategoryRecord(categoryId: string) {
  const path = `fatwaCategories/${categoryId}`;
  try {
    await deleteDoc(doc(db, 'fatwaCategories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------- Fatwa Questions (Admin-Only PII) & Published Fatwa Archive ----------

export function subscribeFatwaQuestions(
  onData: (questions: FatwaQuestionItem[]) => void,
) {
  const path = 'fatwaQuestions';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          const rawStatus = String(data.status || 'pending');
          const status: FatwaQuestionStatus =
            rawStatus === 'answered' || rawStatus === 'archived'
              ? rawStatus
              : 'pending';
          return {
            id: d.id,
            askerName: String(data.askerName || ''),
            city: String(data.city || ''),
            email: String(data.email || ''),
            phone: String(data.phone || ''),
            viber: String(data.viber || ''),
            categoryId: String(data.categoryId || ''),
            categoryLabel: String(data.categoryLabel || ''),
            subject: String(data.subject || ''),
            question: String(data.question || ''),
            status,
            answerText: String(data.answerText || ''),
            muftiName: String(data.muftiName || ''),
            isPublishedPublicly: Boolean(data.isPublishedPublicly),
            publishedFatwaId: String(data.publishedFatwaId || ''),
            answeredByUid: String(data.answeredByUid || ''),
            createdAtLabel: formatTimestamp(data.createdAt),
            answeredAtLabel:
              status === 'answered' ? formatTimestamp(data.updatedAt) : '',
          };
        }),
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export function subscribePublishedFatwas(
  onData: (items: PublishedFatwaItem[]) => void,
) {
  const path = 'publishedFatwas';
  const q = query(collection(db, path), orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            categoryId: String(data.categoryId || ''),
            categoryLabel: String(data.categoryLabel || ''),
            subject: String(data.subject || ''),
            question: String(data.question || ''),
            answerText: String(data.answerText || ''),
            muftiName: String(data.muftiName || ''),
            createdByUid: String(data.createdByUid || ''),
            answeredAtLabel: formatTimestamp(data.updatedAt),
          };
        }),
      );
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export async function submitFatwaQuestion(payload: {
  askerName: string;
  city: string;
  email: string;
  phone: string;
  viber: string;
  categoryId: string;
  categoryLabel: string;
  subject: string;
  question: string;
}) {
  const path = 'fatwaQuestions';
  const askerName = payload.askerName.trim().slice(0, 120);
  const city = payload.city.trim().slice(0, 100);
  const email = payload.email.trim().toLowerCase().slice(0, 160);
  const phone = payload.phone.replace(/\s+/g, ' ').trim().slice(0, 30);
  const viber = payload.viber.replace(/\s+/g, ' ').trim().slice(0, 30);
  const categoryId = payload.categoryId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const categoryLabel = payload.categoryLabel.trim().slice(0, 120);
  const subject = payload.subject.trim().slice(0, 240);
  const question = payload.question.trim().slice(0, 6000);

  if (!askerName) throw new Error('အမည် ထည့်သွင်းပါ။');
  if (!city) throw new Error('နေထိုင်သည့်မြို့ ထည့်သွင်းပါ။');
  if (!CONTACT_EMAIL_REGEX.test(email)) {
    throw new Error('မှန်ကန်သော Email လိပ်စာ ထည့်သွင်းပါ။');
  }
  if (!CONTACT_PHONE_REGEX.test(phone)) {
    throw new Error('မှန်ကန်သော ဖုန်းနံပါတ် ထည့်သွင်းပါ။');
  }
  if (viber && !CONTACT_PHONE_REGEX.test(viber)) {
    throw new Error('Viber နံပါတ် ပုံစံ မမှန်ကန်ပါ (ဥပမာ - +959...)။');
  }
  if (!categoryId || !categoryLabel) {
    throw new Error('ဖသ်ဝါ ကဏ္ဍ ရွေးချယ်ပါ။');
  }
  if (!subject) throw new Error('မေးခွန်းခေါင်းစဉ် ထည့်သွင်းပါ။');
  if (!question) throw new Error('မေးမြန်းလိုသည့် အကြောင်းအရာ ထည့်သွင်းပါ။');

  try {
    await addDoc(collection(db, path), {
      askerName,
      city,
      email,
      phone,
      viber,
      categoryId,
      categoryLabel,
      subject,
      question,
      status: 'pending',
      answerText: '',
      muftiName: '',
      isPublishedPublicly: false,
      publishedFatwaId: '',
      answeredByUid: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function answerFatwaQuestion(
  uid: string,
  questionItem: FatwaQuestionItem,
  payload: {
    categoryId: string;
    categoryLabel: string;
    subject: string;
    status: FatwaQuestionStatus;
    answerText: string;
    muftiName: string;
    isPublishedPublicly: boolean;
  },
) {
  const cleanCategoryId = payload.categoryId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const cleanCategoryLabel = payload.categoryLabel.trim().slice(0, 120);
  const cleanSubject = payload.subject.trim().slice(0, 240);
  const cleanAnswer = payload.answerText.trim().slice(0, 12000);
  const cleanMufti = payload.muftiName.trim().slice(0, 160);
  const shouldPublish = Boolean(payload.isPublishedPublicly && cleanAnswer);

  let nextPublishedFatwaId = questionItem.publishedFatwaId;

  if (shouldPublish) {
    const targetPubId = questionItem.publishedFatwaId || questionItem.id;
    const pubPath = `publishedFatwas/${targetPubId}`;
    const pubRef = doc(db, 'publishedFatwas', targetPubId);
    const pubFields = {
      categoryId: cleanCategoryId || questionItem.categoryId,
      categoryLabel: cleanCategoryLabel || questionItem.categoryLabel,
      subject: cleanSubject || questionItem.subject,
      question: questionItem.question.trim().slice(0, 6000),
      answerText: cleanAnswer,
      muftiName: cleanMufti,
    };
    try {
      if (questionItem.publishedFatwaId) {
        try {
          await updateDoc(pubRef, {
            ...pubFields,
            updatedAt: serverTimestamp(),
          });
        } catch (updateErr) {
          const msg =
            updateErr instanceof Error ? updateErr.message : String(updateErr);
          const code =
            typeof updateErr === 'object' && updateErr && 'code' in updateErr
              ? String((updateErr as {code?: unknown}).code || '')
              : '';
          if (code === 'not-found' || msg.includes('No document to update')) {
            await setDoc(pubRef, {
              ...pubFields,
              createdByUid: uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            throw updateErr;
          }
        }
      } else {
        await setDoc(pubRef, {
          ...pubFields,
          createdByUid: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      nextPublishedFatwaId = targetPubId;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, pubPath);
    }
  } else if (questionItem.publishedFatwaId) {
    const pubPath = `publishedFatwas/${questionItem.publishedFatwaId}`;
    try {
      await deleteDoc(doc(db, 'publishedFatwas', questionItem.publishedFatwaId));
    } catch {
      // Ignore if already removed
    }
    void pubPath;
    nextPublishedFatwaId = '';
  }

  const questionPath = `fatwaQuestions/${questionItem.id}`;
  try {
    await updateDoc(doc(db, 'fatwaQuestions', questionItem.id), {
      categoryId: cleanCategoryId || questionItem.categoryId,
      categoryLabel: cleanCategoryLabel || questionItem.categoryLabel,
      subject: cleanSubject || questionItem.subject,
      status: payload.status,
      answerText: cleanAnswer,
      muftiName: cleanMufti,
      isPublishedPublicly: shouldPublish,
      publishedFatwaId: nextPublishedFatwaId,
      answeredByUid: cleanAnswer ? uid : questionItem.answeredByUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, questionPath);
  }
}

export async function deleteFatwaQuestionRecord(
  questionId: string,
  publishedFatwaId?: string,
) {
  if (publishedFatwaId) {
    try {
      await deleteDoc(doc(db, 'publishedFatwas', publishedFatwaId));
    } catch {
      // Ignore missing published archive item
    }
  }
  const path = `fatwaQuestions/${questionId}`;
  try {
    await deleteDoc(doc(db, 'fatwaQuestions', questionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deletePublishedFatwaRecord(fatwaId: string) {
  const path = `publishedFatwas/${fatwaId}`;
  try {
    await deleteDoc(doc(db, 'publishedFatwas', fatwaId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ---------- Home Page Sliding Dua Image Banners (PNG/JPEG/WebP/GIF/URL) ----------

export function subscribeDuaSlides(
  includeUnpublished: boolean,
  onData: (slides: DuaSlideItem[]) => void,
) {
  const path = 'duaSlides';
  const q = includeUnpublished
    ? query(collection(db, path))
    : query(collection(db, path), where('published', '==', true));

  return onSnapshot(
    q,
    (snap) => {
      const items: DuaSlideItem[] = snap.docs
        .map((d) => {
          const data = d.data();
          const rawMime = String(data.mimeType || 'image/jpeg');
          const mimeType: DuaSlideMimeType =
            rawMime === 'image/png' ||
            rawMime === 'image/jpeg' ||
            rawMime === 'image/webp' ||
            rawMime === 'image/gif' ||
            rawMime === 'url'
              ? rawMime
              : 'image/jpeg';

          return {
            id: d.id,
            title: String(data.title || ''),
            caption: String(data.caption || ''),
            imageUrl: String(data.imageUrl || ''),
            mimeType,
            sortOrder: Math.max(0, Math.round(Number(data.sortOrder ?? 0))),
            published: Boolean(data.published),
            createdByUid: String(data.createdByUid || ''),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          };
        })
        .sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          return toTimestampMillis(b.createdAt) - toTimestampMillis(a.createdAt);
        });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, path),
  );
}

export async function createDuaSlideRecord(
  uid: string,
  payload: {
    title: string;
    caption: string;
    imageUrl: string;
    mimeType: DuaSlideMimeType;
    sortOrder: number;
    published: boolean;
  },
) {
  const path = 'duaSlides';
  const cleanTitle = payload.title.trim().slice(0, 200) || 'ဒိုအာပုံရိပ်';
  const cleanCaption = payload.caption.trim().slice(0, 500);
  const cleanImageUrl = payload.imageUrl.trim();
  if (!cleanImageUrl || cleanImageUrl.length < 10 || cleanImageUrl.length > 850000) {
    throw new Error('ပုံဒေတာ မမှန်ကန်ပါ (သို့မဟုတ် 850KB ထက် ကျော်လွန်နေပါသည်)။');
  }
  try {
    const ref = await addDoc(collection(db, path), {
      title: cleanTitle,
      caption: cleanCaption,
      imageUrl: cleanImageUrl,
      mimeType: payload.mimeType,
      sortOrder: Math.max(0, Math.min(10000, Math.round(Number(payload.sortOrder) || 0))),
      published: Boolean(payload.published),
      createdByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDuaSlideRecord(
  slideId: string,
  payload: Partial<{
    title: string;
    caption: string;
    imageUrl: string;
    mimeType: DuaSlideMimeType;
    sortOrder: number;
    published: boolean;
  }>,
) {
  const path = `duaSlides/${slideId}`;
  try {
    const patch: Record<string, unknown> = {updatedAt: serverTimestamp()};
    if (payload.title !== undefined) {
      patch.title = payload.title.trim().slice(0, 200) || 'ဒိုအာပုံရိပ်';
    }
    if (payload.caption !== undefined) {
      patch.caption = payload.caption.trim().slice(0, 500);
    }
    if (payload.imageUrl !== undefined) {
      const cleanUrl = payload.imageUrl.trim();
      if (!cleanUrl || cleanUrl.length < 10 || cleanUrl.length > 850000) {
        throw new Error('ပုံဒေတာ မမှန်ကန်ပါ။');
      }
      patch.imageUrl = cleanUrl;
    }
    if (payload.mimeType !== undefined) {
      patch.mimeType = payload.mimeType;
    }
    if (payload.sortOrder !== undefined) {
      patch.sortOrder = Math.max(
        0,
        Math.min(10000, Math.round(Number(payload.sortOrder) || 0)),
      );
    }
    if (payload.published !== undefined) {
      patch.published = Boolean(payload.published);
    }
    await updateDoc(doc(db, 'duaSlides', slideId), patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteDuaSlideRecord(slideId: string) {
  const path = `duaSlides/${slideId}`;
  try {
    await deleteDoc(doc(db, 'duaSlides', slideId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

