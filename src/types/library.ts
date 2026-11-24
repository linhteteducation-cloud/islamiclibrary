export type PageRoute =
  | 'home'
  | 'library'
  | 'duas'
  | 'videos'
  | 'articles'
  | 'about'
  | 'publishing'
  | 'contact'
  | 'admin';

export type BuiltInBookCategoryId =
  | 'quran-tafsir'
  | 'hadith'
  | 'shariah'
  | 'dua-amal'
  | 'aqeedah'
  | 'history'
  | 'ethics'
  | 'children'
  | 'periodicals'
  | 'research'
  | 'azan';

export type BookCategoryId = BuiltInBookCategoryId | (string & {});

export type CategoryId = 'all' | 'videos' | BookCategoryId;

export type MaterialType = 'All Types' | 'Book' | 'Periodical' | 'Research' | 'Dua' | 'Timetable';

export type CategoryIconName =
  | 'book-open'
  | 'scroll-text'
  | 'scale'
  | 'heart-handshake'
  | 'star'
  | 'history'
  | 'heart'
  | 'baby'
  | 'newspaper'
  | 'file-search'
  | 'clock'
  | 'video'
  | 'folder'
  | 'sparkles'
  | 'layers';

export interface CategoryItem {
  id: Exclude<CategoryId, 'all'>;
  nameMy: string;
  nameEn: string;
  descriptionMy: string;
  iconName: CategoryIconName;
  sortOrder?: number;
  isCustom?: boolean;
  isOverridden?: boolean;
  createdByUid?: string;
}

export interface BookItem {
  id: string;
  title: string;
  author: string;
  categoryId: BookCategoryId;
  categoryLabel: string;
  type: Exclude<MaterialType, 'All Types'>;
  hijriYear: string;
  pages: number;
  fileSize: string;
  summary: string;
  driveFileId: string;
  driveViewUrl: string;
  driveDownloadUrl: string;
  coverTheme: 'emerald' | 'gold' | 'teal' | 'burgundy' | 'slate';
  downloads: number;
  published: boolean;
  uploadedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DuaItem {
  id: string;
  titleMy: string;
  titleAr: string;
  categoryMy: 'နေ့စဉ်ဒိုအာ' | 'အထူးအအ်မာလ်' | 'မုနာဂျာသ်' | 'ကုရ်အာန်လာဒိုအာ';
  arabic: string;
  transliteration: string;
  meaningMy: string;
  source: string;
  createdByUid: string;
}

export interface VideoItem {
  id: string;
  title: string;
  speaker: string;
  categoryMy: string;
  duration: string;
  videoUrl: string;
  description: string;
  createdByUid: string;
}

export interface ArticleItem {
  id: string;
  title: string;
  kicker: string;
  author: string;
  readTime: string;
  excerpt: string;
  body: string;
  createdByUid: string;
  createdAtLabel?: string;
}

export interface SiteSettings {
  hiddenSections: string[];
  hiddenCategories: string[];
  driveFolderId: string;
  driveFolderName: string;
  heroDescription: string;
}

export interface ContactMessageItem {
  id: string;
  name: string;
  contact: string;
  subject: string;
  message: string;
  status: 'unread' | 'read';
  createdAtLabel?: string;
}

export interface DriveFileSummary {
  id: string;
  name: string;
  size?: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  modifiedTime?: string;
}

export interface AdminInviteItem {
  id: string; // lowercase email
  email: string;
  roleLabel: string;
  addedByUid: string;
  addedByEmail: string;
  createdAtLabel?: string;
}

export interface TelegramSettings {
  connected: boolean;
  botUsername: string;
  botFirstName: string;
  allowedChatIds: string;
  autoSyncToWebsite: boolean;
  defaultCategoryId: 'auto' | BookCategoryId;
  lastUpdateId: number;
}

