import {useEffect, useMemo, useRef, useState} from 'react';
import {User} from 'firebase/auth';
import {
  AlertTriangle,
  BookPlus,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Globe,
  HardDrive,
  Inbox,
  LayoutGrid,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  Sliders,
  Sparkles,
  StopCircle,
  Trash2,
  Upload,
  UserPlus,
  XCircle,
} from 'lucide-react';
import {
  DEFAULT_CONTACT_LINKS,
  DEFAULT_FATWA_CATEGORIES,
  DEFAULT_HERO_DESCRIPTION,
  generateFatwaCategorySlug,
  MANAGEABLE_SECTIONS,
} from '../data/libraryData';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  SECOND_BOOTSTRAPPED_ADMIN_EMAIL,
} from '../lib/firebase';
import {findDuplicateBooks, normalizeBookTitle} from '../lib/bookDedupe';
import {getScriptFontClass} from '../lib/scriptFonts';
import {
  appointAdminByEmail,
  createArticleRecord,
  createBookRecord,
  createDuaRecord,
  createVideoRecord,
  DEFAULT_TELEGRAM_SETTINGS,
  deleteArticleRecord,
  deleteBookRecord,
  deleteContactMessage,
  deleteDuaRecord,
  deleteFatwaCategoryRecord,
  deleteVideoRecord,
  markContactMessageRead,
  normalizeSingleContactLink,
  revokeAdminInvite,
  saveFatwaCategoryRecord,
  saveSiteSettings,
  saveTelegramSettings,
  seedDefaultFatwaCategories,
  subscribeAdminInvites,
  subscribeContactMessages,
  subscribeTelegramSettings,
  updateBookRecord,
} from '../lib/firestoreService';
import {
  buildDriveUrls,
  deletePdfFromGoogleDrive,
  DriveApiError,
  ensureLibraryDriveFolder,
  extractDriveFileId,
  formatBytes,
  getDriveFileMetadata,
  inferBookMetadataFromFileName,
  isValidDriveFileId,
  isValidSafeHttpsUrl,
  listLibraryDrivePdfs,
  makeDriveFilePublicReadable,
  uploadPdfToGoogleDrive,
} from '../lib/googleDrive';
import {
  BlogspotCatalogItem,
  fetchBlogspotCatalog,
  transferBlogspotBookToDrive,
} from '../lib/blogspotImport';
import {
  checkTelegramChats,
  disconnectTelegramBotConfig,
  getTelegramConfigStatus,
  saveTelegramBotConfig,
  syncTelegramPdfsToDrive,
  TelegramConfigStatus,
  TelegramDiscoveredChat,
} from '../lib/telegramIntegration';
import {
  AdminInviteItem,
  ArticleItem,
  BookCategoryId,
  BookItem,
  CategoryItem,
  ContactMessageItem,
  DriveFileSummary,
  DuaItem,
  FatwaCategoryItem,
  FooterContactLinks,
  MaterialType,
  PageRoute,
  SiteSettings,
  TelegramSettings,
  VideoItem,
} from '../types/library';
import {BookCoverFrame} from './BookCoverFrame';

interface AdminPanelViewProps {
  user: User | null;
  isAdmin: boolean;
  authLoading: boolean;
  driveToken: string | null;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  books: BookItem[];
  categories: CategoryItem[];
  onOpenCategoryManager: () => void;
  duas: DuaItem[];
  videos: VideoItem[];
  articles: ArticleItem[];
  siteSettings: SiteSettings;
  fatwaCategories: FatwaCategoryItem[];
  fatwaCategoryDocs: FatwaCategoryItem[];
  pendingFatwaCount: number;
  onNavigate: (page: PageRoute) => void;
  requestedTab?: string | null;
  onClearRequestedTab?: () => void;
}

type AdminTab =
  | 'books'
  | 'import'
  | 'visibility'
  | 'drive'
  | 'content'
  | 'messages'
  | 'fatwaCategories'
  | 'links'
  | 'settings';

interface PendingDelete {
  kind:
    | 'book'
    | 'dua'
    | 'video'
    | 'article'
    | 'driveFile'
    | 'message'
    | 'fatwaCategory'
    | 'adminInvite';
  id: string;
  label: string;
  driveFileId?: string;
}

export function AdminPanelView({
  user,
  isAdmin,
  authLoading,
  driveToken,
  onSignInGoogle,
  onSignOut,
  books,
  categories,
  onOpenCategoryManager,
  duas,
  videos,
  articles,
  siteSettings,
  fatwaCategories,
  fatwaCategoryDocs,
  pendingFatwaCount,
  onNavigate,
  requestedTab,
  onClearRequestedTab,
}: AdminPanelViewProps) {
  const bookCategories = useMemo(
    () => categories.filter((c) => c.id !== 'videos'),
    [categories],
  );
  const [activeTab, setActiveTab] = useState<AdminTab>('books');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isConnectingAuth, setIsConnectingAuth] = useState(false);

  // Book upload / edit form state
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookCategoryId, setBookCategoryId] =
    useState<BookCategoryId>('quran-tafsir');
  const [bookType, setBookType] =
    useState<Exclude<MaterialType, 'All Types'>>('Book');
  const [bookHijriYear, setBookHijriYear] = useState('၁၄၄၇ ဟစ်ဂျရီ');
  const [bookPages, setBookPages] = useState<number>(0);
  const [bookFileSize, setBookFileSize] = useState('');
  const [bookSummary, setBookSummary] = useState('');
  const [bookDriveFileId, setBookDriveFileId] = useState('');
  const [bookCoverTheme, setBookCoverTheme] =
    useState<BookItem['coverTheme']>('emerald');
  const [bookPublished, setBookPublished] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSavingBook, setIsSavingBook] = useState(false);

  // Dedicated Book Edit Modal state (opens immediately when clicking "ပြင်ရန်" next to any book)
  const [bookListSearch, setBookListSearch] = useState('');
  const [editModalBookId, setEditModalBookId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editCategoryId, setEditCategoryId] =
    useState<BookCategoryId>('quran-tafsir');
  const [editType, setEditType] =
    useState<Exclude<MaterialType, 'All Types'>>('Book');
  const [editHijriYear, setEditHijriYear] = useState('၁၄၄၇ ဟစ်ဂျရီ');
  const [editPages, setEditPages] = useState<number>(0);
  const [editFileSize, setEditFileSize] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editDriveFileId, setEditDriveFileId] = useState('');
  const [editCoverTheme, setEditCoverTheme] =
    useState<BookItem['coverTheme']>('emerald');
  const [editPublished, setEditPublished] = useState(true);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [isSavingEditModal, setIsSavingEditModal] = useState(false);
  const [isUploadingReplacementPdf, setIsUploadingReplacementPdf] =
    useState(false);

  // Google Drive files list
  const [driveFiles, setDriveFiles] = useState<DriveFileSummary[]>([]);
  const [driveScopeMode, setDriveScopeMode] = useState<'folder' | 'all'>('folder');
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [driveActivationUrl, setDriveActivationUrl] = useState<string | null>(
    null,
  );
  const knownDriveIdsRef = useRef<Set<string>>(new Set());
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    const nextSet = new Set<string>();
    for (const b of books) {
      if (b.driveFileId) nextSet.add(b.driveFileId);
    }
    knownDriveIdsRef.current = nextSet;
  }, [books]);

  // Blogspot / External Web Link importer state
  const [importSourceUrl, setImportSourceUrl] = useState(
    'https://myanmarfreeislamicbooks.blogspot.com/p/book-list.html?m=0',
  );
  const [catalogItems, setCatalogItems] = useState<BlogspotCatalogItem[]>([]);
  const [isFetchingCatalog, setIsFetchingCatalog] = useState(false);
  const [importSearchQuery, setImportSearchQuery] = useState('');
  const [selectedImportUrls, setSelectedImportUrls] = useState<
    Record<string, boolean>
  >({});
  const [importCategoryOverride, setImportCategoryOverride] = useState<
    'auto' | BookCategoryId
  >('auto');
  const [isImportingBatch, setIsImportingBatch] = useState(false);
  const importStopRequestedRef = useRef(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    currentTitle: string;
  } | null>(null);
  const [importStatuses, setImportStatuses] = useState<
    Record<
      string,
      {
        status: 'importing' | 'done' | 'error';
        message?: string;
        sourceType?: string;
      }
    >
  >({});

  // Visibility settings draft
  const [hiddenSectionsDraft, setHiddenSectionsDraft] = useState<string[]>(
    siteSettings.hiddenSections,
  );
  const [hiddenCategoriesDraft, setHiddenCategoriesDraft] = useState<string[]>(
    siteSettings.hiddenCategories,
  );
  const [heroDescDraft, setHeroDescDraft] = useState(
    siteSettings.heroDescription,
  );
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Footer contact links sync draft
  const [contactLinksDraft, setContactLinksDraft] = useState<FooterContactLinks>(
    siteSettings.contactLinks ?? DEFAULT_CONTACT_LINKS,
  );
  const [isSavingContactLinks, setIsSavingContactLinks] = useState(false);
  const [contactLinksError, setContactLinksError] = useState<string | null>(
    null,
  );

  // Fatwa categories full CRUD state
  const [fatwaCatNameMy, setFatwaCatNameMy] = useState('');
  const [fatwaCatNameEn, setFatwaCatNameEn] = useState('');
  const [fatwaCatDescMy, setFatwaCatDescMy] = useState('');
  const [fatwaCatOrder, setFatwaCatOrder] = useState(0);
  const [editingFatwaCatId, setEditingFatwaCatId] = useState<string | null>(
    null,
  );
  const [isSavingFatwaCat, setIsSavingFatwaCat] = useState(false);

  // Sub-content CRUD state
  const [contentKind, setContentKind] = useState<'duas' | 'videos' | 'articles'>(
    'duas',
  );
  // Dua fields
  const [duaTitleMy, setDuaTitleMy] = useState('');
  const [duaTitleAr, setDuaTitleAr] = useState('');
  const [duaCategoryMy, setDuaCategoryMy] =
    useState<DuaItem['categoryMy']>('နေ့စဉ်ဒိုအာ');
  const [duaArabic, setDuaArabic] = useState('');
  const [duaTranslit, setDuaTranslit] = useState('');
  const [duaMeaning, setDuaMeaning] = useState('');
  const [duaSource, setDuaSource] = useState('');
  // Video fields
  const [vidTitle, setVidTitle] = useState('');
  const [vidSpeaker, setVidSpeaker] = useState('');
  const [vidCategory, setVidCategory] = useState('ကုရ်အာန် သဖ်စီးရ်');
  const [vidDuration, setVidDuration] = useState('');
  const [vidUrl, setVidUrl] = useState('');
  const [vidDesc, setVidDesc] = useState('');
  // Article fields
  const [artTitle, setArtTitle] = useState('');
  const [artKicker, setArtKicker] = useState('အယ်ဒီတာ့အာဘော်');
  const [artAuthor, setArtAuthor] = useState('');
  const [artReadTime, setArtReadTime] = useState('၅ မိနစ်ဖတ်');
  const [artExcerpt, setArtExcerpt] = useState('');
  const [artBody, setArtBody] = useState('');
  const [isSavingContent, setIsSavingContent] = useState(false);

  // Contact messages
  const [messages, setMessages] = useState<ContactMessageItem[]>([]);

  // Auto-dedupe state
  const duplicateEntries = useMemo(() => findDuplicateBooks(books), [books]);
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<
    Record<string, boolean>
  >({});
  const [dedupeDeleteDriveFiles, setDedupeDeleteDriveFiles] = useState(true);
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);

  // Auto-select all detected duplicates whenever the duplicate list updates
  useEffect(() => {
    setSelectedDuplicateIds((prev) => {
      const next: Record<string, boolean> = {};
      for (const entry of duplicateEntries) {
        next[entry.duplicate.id] =
          entry.duplicate.id in prev ? prev[entry.duplicate.id] : true;
      }
      return next;
    });
  }, [duplicateEntries]);

  // Admin management state
  const [adminInvites, setAdminInvites] = useState<AdminInviteItem[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRoleLabel, setNewAdminRoleLabel] = useState('Library Admin');
  const [isAppointingAdmin, setIsAppointingAdmin] = useState(false);

  // Telegram Bot permanent integration state
  const [telegramSettings, setTelegramSettings] = useState<TelegramSettings>(
    DEFAULT_TELEGRAM_SETTINGS,
  );
  const [telegramConfigStatus, setTelegramConfigStatus] =
    useState<TelegramConfigStatus | null>(null);
  const [telegramTokenInput, setTelegramTokenInput] = useState('');
  const [telegramAllowedChatsInput, setTelegramAllowedChatsInput] =
    useState('');
  const [telegramDefaultCatInput, setTelegramDefaultCatInput] = useState<
    'auto' | BookCategoryId
  >('auto');
  const [telegramAutoSyncInput, setTelegramAutoSyncInput] = useState(true);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isCheckingTelegramChats, setIsCheckingTelegramChats] = useState(false);
  const [discoveredTelegramChats, setDiscoveredTelegramChats] = useState<
    TelegramDiscoveredChat[]
  >([]);
  const [telegramPendingCount, setTelegramPendingCount] = useState<
    number | null
  >(null);
  const [isSyncingTelegramToDrive, setIsSyncingTelegramToDrive] =
    useState(false);
  const [telegramLiveAutoPoll, setTelegramLiveAutoPoll] = useState(false);
  const [lastTelegramSyncResult, setLastTelegramSyncResult] = useState<{
    uploadedCount: number;
    publishedCount: number;
    skippedCount: number;
    errors: string[];
    timestamp: string;
  } | null>(null);
  const telegramSyncLockRef = useRef(false);
  const telegramHydratedRef = useRef(false);

  // Confirmation modal for destructive actions (MANDATORY per workspace-integration)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [alsoDeleteFromDrive, setAlsoDeleteFromDrive] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setHiddenSectionsDraft(siteSettings.hiddenSections);
    setHiddenCategoriesDraft(siteSettings.hiddenCategories);
    setHeroDescDraft(siteSettings.heroDescription);
    setContactLinksDraft(siteSettings.contactLinks ?? DEFAULT_CONTACT_LINKS);
  }, [siteSettings]);

  useEffect(() => {
    if (requestedTab === 'fatwaCategories') {
      setActiveTab('fatwaCategories');
      onClearRequestedTab?.();
    }
  }, [requestedTab, onClearRequestedTab]);

  useEffect(() => {
    if (!isAdmin) {
      setMessages([]);
      setAdminInvites([]);
      setTelegramSettings(DEFAULT_TELEGRAM_SETTINGS);
      return;
    }
    const unsubMsgs = subscribeContactMessages(setMessages);
    const unsubInvites = subscribeAdminInvites(setAdminInvites);
    const unsubTelegram = subscribeTelegramSettings((next) => {
      setTelegramSettings(next);
      if (!telegramHydratedRef.current) {
        setTelegramAllowedChatsInput(next.allowedChatIds);
        setTelegramDefaultCatInput(next.defaultCategoryId);
        setTelegramAutoSyncInput(next.autoSyncToWebsite);
      }
    });
    return () => {
      unsubMsgs();
      unsubInvites();
      unsubTelegram();
    };
  }, [isAdmin]);

  const [seoCanonicalOriginInput, setSeoCanonicalOriginInput] = useState(
    'https://islamiclibrary-three.vercel.app',
  );
  const [seoMetaTokenInput, setSeoMetaTokenInput] = useState('');
  const [seoHtmlFilenameInput, setSeoHtmlFilenameInput] = useState('');
  const [isSavingSeoConfig, setIsSavingSeoConfig] = useState(false);
  const [copiedSeoKey, setCopiedSeoKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !user) {
      setTelegramConfigStatus(null);
      telegramHydratedRef.current = false;
      return;
    }
    let cancelled = false;
    void getTelegramConfigStatus(user)
      .then((status) => {
        if (cancelled) return;
        setTelegramConfigStatus(status);
        telegramHydratedRef.current = true;
        if (status.allowedChatIds) {
          setTelegramAllowedChatsInput(status.allowedChatIds);
        }
        setTelegramDefaultCatInput(status.defaultCategoryId || 'auto');
        setTelegramAutoSyncInput(status.autoSyncToWebsite);
      })
      .catch(() => {
        // Ignore silent status check errors on mount
      });

    void user
      .getIdToken()
      .then((idToken) =>
        fetch('/api/seo/config', {
          headers: {Authorization: `Bearer ${idToken}`},
        }),
      )
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          cfg: {
            canonicalOrigin?: string;
            googleSiteVerificationToken?: string;
            googleVerificationHtmlFilename?: string;
          } | null,
        ) => {
          if (cancelled || !cfg) return;
          if (cfg.canonicalOrigin) setSeoCanonicalOriginInput(cfg.canonicalOrigin);
          if (cfg.googleSiteVerificationToken) {
            setSeoMetaTokenInput(cfg.googleSiteVerificationToken);
          }
          if (cfg.googleVerificationHtmlFilename) {
            setSeoHtmlFilenameInput(cfg.googleVerificationHtmlFilename);
          }
        },
      )
      .catch(() => {
        // Ignore silent SEO config fetch errors
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, user]);

  const handleSaveSeoConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSavingSeoConfig(true);
    setStatusBanner(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/seo/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          canonicalOrigin: seoCanonicalOriginInput.trim(),
          googleSiteVerificationToken: seoMetaTokenInput.trim(),
          googleVerificationHtmlFilename: seoHtmlFilenameInput.trim(),
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        canonicalOrigin?: string;
        googleSiteVerificationToken?: string;
        googleVerificationHtmlFilename?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || 'SEO အချက်အလက် သိမ်းဆည်းမှု မအောင်မြင်ပါ။');
      }
      setSeoCanonicalOriginInput(
        payload.canonicalOrigin || seoCanonicalOriginInput,
      );
      setSeoMetaTokenInput(payload.googleSiteVerificationToken || '');
      setSeoHtmlFilenameInput(payload.googleVerificationHtmlFilename || '');
      showNotice(
        'success',
        'Google Search Console Verification နှင့် SEO အချက်အလက်များကို သိမ်းဆည်းပြီးပါပြီ။',
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'SEO အချက်အလက် သိမ်းဆည်းမှု မအောင်မြင်ပါ။',
      );
    } finally {
      setIsSavingSeoConfig(false);
    }
  };

  const handleCopySeoValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSeoKey(key);
      window.setTimeout(() => setCopiedSeoKey(null), 2000);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const showNotice = (type: 'success' | 'error', text: string) => {
    setStatusBanner({type, text});
  };

  const handleDriveError = (err: unknown, fallbackText: string) => {
    if (err instanceof DriveApiError && err.isServiceDisabled) {
      const safeUrl =
        err.activationUrl && isValidSafeHttpsUrl(err.activationUrl)
          ? err.activationUrl
          : 'https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=556645996276';
      setDriveActivationUrl(safeUrl);
      showNotice('error', err.message);
      return;
    }
    setDriveActivationUrl(null);
    showNotice('error', err instanceof Error ? err.message : fallbackText);
  };

  const handleGoogleLogin = async () => {
    setIsConnectingAuth(true);
    setStatusBanner(null);
    setDriveActivationUrl(null);
    try {
      await onSignInGoogle();
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error
          ? err.message
          : 'Google Sign-In မအောင်မြင်ပါ။ ထပ်မံကြိုးစားပါ။',
      );
    } finally {
      setIsConnectingAuth(false);
    }
  };

  const syncDriveFilesToWebsite = async (
    files: DriveFileSummary[],
    silent = false,
  ): Promise<number> => {
    if (!driveToken || !user || syncInFlightRef.current) return 0;
    syncInFlightRef.current = true;
    let addedCount = 0;
    try {
      const existingTitles = new Set(
        books.map((b) => normalizeBookTitle(b.title)).filter(Boolean),
      );

      for (const file of files) {
        if (!file.id || !isValidDriveFileId(file.id)) continue;
        if (knownDriveIdsRef.current.has(file.id)) continue;

        const inferred = inferBookMetadataFromFileName(file.name);
        const normalizedKey = normalizeBookTitle(inferred.title);
        if (normalizedKey && existingTitles.has(normalizedKey)) {
          knownDriveIdsRef.current.add(file.id);
          continue;
        }

        knownDriveIdsRef.current.add(file.id);
        if (normalizedKey) existingTitles.add(normalizedKey);
        await makeDriveFilePublicReadable(driveToken, file.id).catch(() => {});

        const catObj = bookCategories.find((c) => c.id === inferred.categoryId);
        const urls = buildDriveUrls(file.id);

        await createBookRecord(user.uid, {
          title: inferred.title,
          author: inferred.author,
          categoryId: inferred.categoryId,
          categoryLabel: catObj?.nameMy || 'ကုရ်အာန်နှင့် သဖ်စီးရ်',
          type: 'Book',
          hijriYear: '၁၄၄၇ ဟစ်ဂျရီ',
          pages: 0,
          fileSize: formatBytes(file.size),
          summary: '',
          driveFileId: file.id,
          driveViewUrl: urls.driveViewUrl,
          driveDownloadUrl: urls.driveDownloadUrl,
          coverTheme: 'emerald',
          downloads: 0,
          published: true,
        });
        addedCount += 1;
      }

      if (addedCount > 0) {
        showNotice(
          'success',
          `Google Drive မှ PDF စာအုပ်အသစ် ${addedCount} အုပ်ကို ဝက်ဘ်ဆိုက်စာကြည့်တိုက်ပေါ်သို့ အလိုအလျောက် တင်ပြပြီးပါပြီ။`,
        );
      } else if (!silent && files.length > 0) {
        // Keep existing notice untouched during silent checks
      }
      return addedCount;
    } finally {
      syncInFlightRef.current = false;
    }
  };

  const refreshDriveFiles = async (options?: {
    silent?: boolean;
    scope?: 'folder' | 'all';
    autoSync?: boolean;
  }) => {
    if (!driveToken || !user) return;
    const scope = options?.scope ?? driveScopeMode;
    const shouldAutoSync = options?.autoSync ?? scope === 'folder';
    if (!options?.silent) {
      setIsLoadingDrive(true);
    }
    try {
      const folder = await ensureLibraryDriveFolder(
        driveToken,
        siteSettings.driveFolderName || 'Myanmar Muslim Library PDFs',
        siteSettings.driveFolderId,
      );
      if (folder.folderId !== siteSettings.driveFolderId) {
        await saveSiteSettings(user.uid, {
          ...siteSettings,
          driveFolderId: folder.folderId,
          driveFolderName: folder.folderName,
        });
      }
      const files = await listLibraryDrivePdfs(
        driveToken,
        scope === 'folder' ? folder.folderId : undefined,
      );
      setDriveFiles(files);
      setDriveActivationUrl(null);
      if (shouldAutoSync) {
        await syncDriveFilesToWebsite(files, options?.silent);
      }
    } catch (err) {
      if (!options?.silent || err instanceof DriveApiError) {
        handleDriveError(err, 'Google Drive ဖိုင်များ ရယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်။');
      }
    } finally {
      if (!options?.silent) {
        setIsLoadingDrive(false);
      }
    }
  };

  useEffect(() => {
    if (!isAdmin || !driveToken) return;
    void refreshDriveFiles();
    const timer = window.setInterval(() => {
      void refreshDriveFiles({silent: true, scope: 'folder', autoSync: true});
    }, 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, driveToken]);

  const resetBookForm = () => {
    setEditingBookId(null);
    setBookTitle('');
    setBookAuthor('');
    setBookCategoryId('quran-tafsir');
    setBookType('Book');
    setBookHijriYear('၁၄၄၇ ဟစ်ဂျရီ');
    setBookPages(0);
    setBookFileSize('');
    setBookSummary('');
    setBookDriveFileId('');
    setBookCoverTheme('emerald');
    setBookPublished(true);
    setUploadProgress(null);
  };

  const handlePdfFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selectedFiles.length === 0) return;

    if (!driveToken || !user) {
      showNotice(
        'error',
        'PDF တင်ရန် Google Drive ချိတ်ဆက်မှု လိုအပ်ပါသည်။ "Google Drive ချိတ်ဆက်ရန်" ခလုတ်ကို နှိပ်ပါ။',
      );
      return;
    }

    setStatusBanner(null);
    setUploadProgress(1);
    try {
      const folder = await ensureLibraryDriveFolder(
        driveToken,
        siteSettings.driveFolderName || 'Myanmar Muslim Library PDFs',
        siteSettings.driveFolderId,
      );

      if (folder.folderId !== siteSettings.driveFolderId) {
        await saveSiteSettings(user.uid, {
          ...siteSettings,
          driveFolderId: folder.folderId,
          driveFolderName: folder.folderName,
        });
      }

      let lastCreatedId: string | null = null;
      let lastUploadedTitle = '';
      let lastUploadedAuthor = '';
      let lastUploadedCategory: BookCategoryId = bookCategoryId;
      let lastUploadedFileId = '';
      let lastUploadedSize = '';

      for (let i = 0; i < selectedFiles.length; i += 1) {
        const file = selectedFiles[i];
        const uploaded = await uploadPdfToGoogleDrive(
          driveToken,
          file,
          folder.folderId,
          (pct) => {
            const overall = Math.round(
              ((i + pct / 100) / selectedFiles.length) * 100,
            );
            setUploadProgress(overall);
          },
        );

        const inferred = inferBookMetadataFromFileName(uploaded.fileName);
        const isSingle = selectedFiles.length === 1;
        const resolvedTitle =
          isSingle && bookTitle.trim() ? bookTitle.trim() : inferred.title;
        const resolvedAuthor =
          isSingle && bookAuthor.trim() ? bookAuthor.trim() : inferred.author;
        const resolvedCategoryId = isSingle
          ? bookCategoryId
          : inferred.categoryId;
        const catObj = bookCategories.find(
          (c) => c.id === resolvedCategoryId,
        );

        knownDriveIdsRef.current.add(uploaded.driveFileId);
        const createdId = await createBookRecord(user.uid, {
          title: resolvedTitle,
          author: resolvedAuthor,
          categoryId: resolvedCategoryId,
          categoryLabel: catObj?.nameMy || 'ကုရ်အာန်နှင့် သဖ်စီးရ်',
          type: bookType,
          hijriYear: bookHijriYear,
          pages: isSingle ? bookPages : 0,
          fileSize: uploaded.fileSize,
          summary: isSingle ? bookSummary : '',
          driveFileId: uploaded.driveFileId,
          driveViewUrl: uploaded.driveViewUrl,
          driveDownloadUrl: uploaded.driveDownloadUrl,
          coverTheme: bookCoverTheme,
          downloads: 0,
          published: true,
        });

        lastCreatedId = createdId || null;
        lastUploadedTitle = resolvedTitle;
        lastUploadedAuthor = resolvedAuthor;
        lastUploadedCategory = resolvedCategoryId;
        lastUploadedFileId = uploaded.driveFileId;
        lastUploadedSize = uploaded.fileSize;
      }

      setUploadProgress(null);

      if (selectedFiles.length === 1 && lastCreatedId) {
        setEditingBookId(lastCreatedId);
        setBookTitle(lastUploadedTitle);
        setBookAuthor(lastUploadedAuthor);
        setBookCategoryId(lastUploadedCategory);
        setBookDriveFileId(lastUploadedFileId);
        setBookFileSize(lastUploadedSize);
        setBookPublished(true);
        showNotice(
          'success',
          `“${lastUploadedTitle}” ကို Google Drive သို့ တင်ပြီး ဝက်ဘ်ဆိုက်စာကြည့်တိုက်ပေါ်သို့ ချက်ချင်းလွှင့်တင်ပြီးပါပြီ။ (အချက်အလက် ထပ်ပြင်လိုပါက အောက်တွင် ပြင်ဆင်သိမ်းဆည်းနိုင်ပါသည်)`,
        );
      } else {
        resetBookForm();
        showNotice(
          'success',
          `PDF စာအုပ် ${selectedFiles.length} အုပ်ကို Google Drive သို့ တင်ပြီး ဝက်ဘ်ဆိုက်ပေါ်သို့ ချက်ချင်းလွှင့်တင်ပြီးပါပြီ။`,
        );
      }
      await refreshDriveFiles({silent: true});
    } catch (err) {
      setUploadProgress(null);
      handleDriveError(err, 'PDF Upload မအောင်မြင်ပါ။');
    }
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const normalizedDriveId = extractDriveFileId(bookDriveFileId);
    if (!normalizedDriveId) {
      showNotice(
        'error',
        'Google Drive PDF Link (သို့မဟုတ် File ID) ကို ဖြည့်သွင်းပါ။',
      );
      return;
    }
    if (!isValidDriveFileId(normalizedDriveId)) {
      showNotice(
        'error',
        'Google Drive File ID သို့မဟုတ် Share Link ပုံစံ မမှန်ကန်ပါ။ (ဥပမာ - https://drive.google.com/file/d/.../view)',
      );
      return;
    }

    setIsSavingBook(true);
    try {
      let resolvedTitle = bookTitle.trim();
      let resolvedAuthor = bookAuthor.trim();
      let resolvedCategoryId = bookCategoryId;
      let resolvedFileSize = bookFileSize.trim();

      // Pull file metadata directly from Google Drive when title/size is omitted
      const cachedMatch = driveFiles.find((f) => f.id === normalizedDriveId);
      const driveMeta =
        cachedMatch ??
        (driveToken
          ? await getDriveFileMetadata(driveToken, normalizedDriveId).catch(
              () => null,
            )
          : null);

      if (driveMeta) {
        const inferred = inferBookMetadataFromFileName(driveMeta.name);
        if (!resolvedTitle) resolvedTitle = inferred.title;
        if (!resolvedAuthor && inferred.author) resolvedAuthor = inferred.author;
        if (!resolvedFileSize) resolvedFileSize = formatBytes(driveMeta.size);
        if (!editingBookId && bookCategoryId === 'quran-tafsir') {
          resolvedCategoryId = inferred.categoryId;
        }
      }

      if (!resolvedTitle) {
        setIsSavingBook(false);
        showNotice(
          'error',
          'စာအုပ်အမည် ဖြည့်သွင်းပါ (သို့မဟုတ် Drive ချိတ်ဆက်ပြီး Drive မှ တိုက်ရိုက်ဆွဲယူပါ)။',
        );
        return;
      }

      const safeCategory =
        bookCategories.find((c) => c.id === resolvedCategoryId) ??
        bookCategories[0];
      const safeType: Exclude<MaterialType, 'All Types'> = [
        'Book',
        'Periodical',
        'Research',
        'Dua',
        'Timetable',
      ].includes(bookType)
        ? bookType
        : 'Book';
      const safeCoverTheme: BookItem['coverTheme'] = [
        'emerald',
        'gold',
        'teal',
        'burgundy',
        'slate',
      ].includes(bookCoverTheme)
        ? bookCoverTheme
        : 'emerald';
      const urls = buildDriveUrls(normalizedDriveId);

      if (driveToken) {
        // Ensure picked/pasted Google Drive PDFs created via this app are readable by every visitor
        await makeDriveFilePublicReadable(driveToken, normalizedDriveId).catch(
          () => {},
        );
      }
      if (editingBookId) {
        await updateBookRecord(editingBookId, {
          title: resolvedTitle,
          author: resolvedAuthor,
          categoryId: safeCategory.id,
          categoryLabel: safeCategory.nameMy,
          type: safeType,
          hijriYear: bookHijriYear,
          pages: bookPages,
          fileSize: resolvedFileSize || 'PDF',
          summary: bookSummary,
          driveFileId: normalizedDriveId,
          driveViewUrl: urls.driveViewUrl,
          driveDownloadUrl: urls.driveDownloadUrl,
          coverTheme: safeCoverTheme,
          published: bookPublished,
        });
        showNotice('success', 'စာအုပ်အချက်အလက်ကို ပြင်ဆင်သိမ်းဆည်းပြီးပါပြီ။');
      } else {
        knownDriveIdsRef.current.add(normalizedDriveId);
        await createBookRecord(user.uid, {
          title: resolvedTitle,
          author: resolvedAuthor,
          categoryId: safeCategory.id,
          categoryLabel: safeCategory.nameMy,
          type: safeType,
          hijriYear: bookHijriYear,
          pages: bookPages,
          fileSize: resolvedFileSize || 'PDF',
          summary: bookSummary,
          driveFileId: normalizedDriveId,
          driveViewUrl: urls.driveViewUrl,
          driveDownloadUrl: urls.driveDownloadUrl,
          coverTheme: safeCoverTheme,
          downloads: 0,
          published: bookPublished,
        });
        showNotice(
          'success',
          'PDF စာအုပ်အသစ်ကို စာကြည့်တိုက်ထဲသို့ အောင်မြင်စွာ တင်ပြီးပါပြီ။',
        );
      }
      resetBookForm();
    } catch (err) {
      showNotice('error', formatReadableError(err, 'စာအုပ်သိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။'));
    } finally {
      setIsSavingBook(false);
    }
  };

  function formatReadableError(err: unknown, fallback: string): string {
    const raw = err instanceof Error ? err.message : String(err || '');
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw) as {error?: string};
      if (parsed && typeof parsed.error === 'string' && parsed.error) {
        return parsed.error;
      }
    } catch {
      // Raw text error
    }
    return raw;
  }

  const handleEditBook = (book: BookItem) => {
    const validCat = bookCategories.some((c) => c.id === book.categoryId)
      ? book.categoryId
      : 'quran-tafsir';
    const validType: Exclude<MaterialType, 'All Types'> = [
      'Book',
      'Periodical',
      'Research',
      'Dua',
      'Timetable',
    ].includes(book.type)
      ? book.type
      : 'Book';
    const validTheme: BookItem['coverTheme'] = [
      'emerald',
      'gold',
      'teal',
      'burgundy',
      'slate',
    ].includes(book.coverTheme)
      ? book.coverTheme
      : 'emerald';

    setEditModalBookId(book.id);
    setEditTitle(book.title || '');
    setEditAuthor(book.author || '');
    setEditCategoryId(validCat);
    setEditType(validType);
    setEditHijriYear(book.hijriYear || '၁၄၄၇ ဟစ်ဂျရီ');
    setEditPages(Number.isFinite(book.pages) ? book.pages : 0);
    setEditFileSize(book.fileSize || 'PDF');
    setEditSummary(book.summary || '');
    setEditDriveFileId(book.driveFileId || '');
    setEditCoverTheme(validTheme);
    setEditPublished(Boolean(book.published));
    setEditModalError(null);
  };

  const handleReplacePdfInEditModal = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user || !driveToken) return;
    setEditModalError(null);
    setIsUploadingReplacementPdf(true);
    try {
      const folder = await ensureLibraryDriveFolder(
        driveToken,
        siteSettings.driveFolderName || 'Myanmar Muslim Library PDFs',
        siteSettings.driveFolderId,
      );
      const uploaded = await uploadPdfToGoogleDrive(
        driveToken,
        file,
        folder.folderId,
      );
      setEditDriveFileId(uploaded.driveFileId);
      setEditFileSize(uploaded.fileSize);
      if (!editTitle.trim()) {
        setEditTitle(inferBookMetadataFromFileName(uploaded.fileName).title);
      }
      await refreshDriveFiles({silent: true, autoSync: false});
    } catch (err) {
      setEditModalError(
        formatReadableError(err, 'PDF အသစ် အစားထိုးတင်ရာတွင် အမှားဖြစ်ပေါ်ပါသည်။'),
      );
    } finally {
      setIsUploadingReplacementPdf(false);
    }
  };

  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalBookId) return;

    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setEditModalError('စာအုပ်အမည် ဖြည့်သွင်းပါ။');
      return;
    }

    const normalizedDriveId = extractDriveFileId(editDriveFileId);
    if (!normalizedDriveId || !isValidDriveFileId(normalizedDriveId)) {
      setEditModalError(
        'Google Drive File ID သို့မဟုတ် Share Link ပုံစံ မမှန်ကန်ပါ။ (ဥပမာ - https://drive.google.com/file/d/.../view)',
      );
      return;
    }

    setIsSavingEditModal(true);
    setEditModalError(null);
    try {
      const safeCat =
        bookCategories.find((c) => c.id === editCategoryId) ??
        bookCategories[0];
      const safeType: Exclude<MaterialType, 'All Types'> = [
        'Book',
        'Periodical',
        'Research',
        'Dua',
        'Timetable',
      ].includes(editType)
        ? editType
        : 'Book';
      const safeTheme: BookItem['coverTheme'] = [
        'emerald',
        'gold',
        'teal',
        'burgundy',
        'slate',
      ].includes(editCoverTheme)
        ? editCoverTheme
        : 'emerald';
      const urls = buildDriveUrls(normalizedDriveId);

      if (driveToken) {
        await makeDriveFilePublicReadable(driveToken, normalizedDriveId).catch(
          () => {},
        );
      }

      await updateBookRecord(editModalBookId, {
        title: trimmedTitle,
        author: editAuthor.trim(),
        categoryId: safeCat.id,
        categoryLabel: safeCat.nameMy,
        type: safeType,
        hijriYear: editHijriYear.trim(),
        pages: Math.max(0, Math.min(10000, Math.round(Number(editPages) || 0))),
        fileSize: editFileSize.trim() || 'PDF',
        summary: editSummary.trim(),
        driveFileId: normalizedDriveId,
        driveViewUrl: urls.driveViewUrl,
        driveDownloadUrl: urls.driveDownloadUrl,
        coverTheme: safeTheme,
        published: editPublished,
      });

      setEditModalBookId(null);
      showNotice(
        'success',
        `“${trimmedTitle}” စာအုပ်အချက်အလက်ကို ပြင်ဆင်သိမ်းဆည်းပြီးပါပြီ။`,
      );
    } catch (err) {
      setEditModalError(
        formatReadableError(
          err,
          'စာအုပ်အချက်အလက် ပြင်ဆင်သိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
        ),
      );
    } finally {
      setIsSavingEditModal(false);
    }
  };

  const handleTogglePublish = async (book: BookItem) => {
    try {
      await updateBookRecord(book.id, {published: !book.published});
      showNotice(
        'success',
        book.published
          ? 'စာအုပ်ကို စာဖတ်သူမြင်ကွင်းမှ ခေတ္တဖယ်ထုတ်ထားပါပြီ။'
          : 'စာအုပ်ကို စာကြည့်တိုက်တွင် ပြန်လည်ဖော်ပြထားပါပြီ။',
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'အခြေအနေပြောင်းလဲ၍ မရပါ။',
      );
    }
  };

  const handleSaveVisibility = async () => {
    if (!user) return;
    setIsSavingSettings(true);
    try {
      await saveSiteSettings(user.uid, {
        ...siteSettings,
        hiddenSections: hiddenSectionsDraft,
        hiddenCategories: hiddenCategoriesDraft,
        heroDescription: heroDescDraft,
      });
      showNotice(
        'success',
        'ဝက်ဘ်ဆိုက် ကဏ္ဍနှင့် စာမျက်နှာ ပြသမှုစီမံချက်များကို သိမ်းဆည်းပြီးပါပြီ။',
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'ဆက်တင်သိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveContactLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setContactLinksError(null);

    const channels: (keyof FooterContactLinks)[] = [
      'facebook',
      'telegram',
      'youtube',
      'whatsapp',
      'phone',
      'email',
      'website',
      'github',
    ];
    const normalizedLinks: FooterContactLinks = {...DEFAULT_CONTACT_LINKS};

    for (const ch of channels) {
      const res = normalizeSingleContactLink(ch, contactLinksDraft[ch]);
      if (res.error) {
        setContactLinksError(res.error);
        return;
      }
      normalizedLinks[ch] = res.value;
    }

    setContactLinksDraft(normalizedLinks);
    setIsSavingContactLinks(true);
    try {
      await saveSiteSettings(user.uid, {
        ...siteSettings,
        contactLinks: normalizedLinks,
      });
      showNotice(
        'success',
        'ဆက်သွယ်ရေး ခလုတ်လင့်ခ်များကို Website အောက်ခြေသို့ Live Sync လုပ်ပြီးပါပြီ။',
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'ဆက်သွယ်ရေးလင့်ခ်များ Sync လုပ်ရာတွင် အမှားဖြစ်ပေါ်ပါသည်။';
      setContactLinksError(msg);
      showNotice('error', msg);
    } finally {
      setIsSavingContactLinks(false);
    }
  };

  const executeConfirmedDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      if (pendingDelete.kind === 'book') {
        await deleteBookRecord(pendingDelete.id);
        if (
          alsoDeleteFromDrive &&
          pendingDelete.driveFileId &&
          driveToken
        ) {
          await deletePdfFromGoogleDrive(driveToken, pendingDelete.driveFileId);
          await refreshDriveFiles();
        }
        showNotice('success', `"${pendingDelete.label}" ကို ဖျက်လိုက်ပါပြီ။`);
      } else if (pendingDelete.kind === 'driveFile') {
        if (!driveToken) {
          throw new Error('Google Drive ချိတ်ဆက်မှု မရှိသေးပါ။');
        }
        await deletePdfFromGoogleDrive(driveToken, pendingDelete.id);
        await refreshDriveFiles();
        showNotice(
          'success',
          `Google Drive မှ "${pendingDelete.label}" ကို ဖျက်လိုက်ပါပြီ။`,
        );
      } else if (pendingDelete.kind === 'dua') {
        await deleteDuaRecord(pendingDelete.id);
        showNotice('success', 'ဒိုအာကို ဖျက်လိုက်ပါပြီ။');
      } else if (pendingDelete.kind === 'video') {
        await deleteVideoRecord(pendingDelete.id);
        showNotice('success', 'ဗီဒီယိုကို ဖျက်လိုက်ပါပြီ။');
      } else if (pendingDelete.kind === 'article') {
        await deleteArticleRecord(pendingDelete.id);
        showNotice('success', 'ဆောင်းပါးကို ဖျက်လိုက်ပါပြီ။');
      } else if (pendingDelete.kind === 'message') {
        await deleteContactMessage(pendingDelete.id);
        showNotice('success', 'မက်ဆေ့ချ်ကို ဖျက်လိုက်ပါပြီ။');
      } else if (pendingDelete.kind === 'fatwaCategory') {
        if (fatwaCategoryDocs.length === 0) {
          for (const cat of DEFAULT_FATWA_CATEGORIES) {
            if (cat.id !== pendingDelete.id && user) {
              await saveFatwaCategoryRecord(user.uid, {
                id: cat.id,
                nameMy: cat.nameMy,
                nameEn: cat.nameEn,
                descriptionMy: cat.descriptionMy,
                sortOrder: cat.sortOrder,
                isExistingDoc: true,
              });
            }
          }
        } else {
          await deleteFatwaCategoryRecord(pendingDelete.id);
        }
        if (editingFatwaCatId === pendingDelete.id) {
          setEditingFatwaCatId(null);
          setFatwaCatNameMy('');
          setFatwaCatNameEn('');
          setFatwaCatDescMy('');
          setFatwaCatOrder(0);
        }
        showNotice(
          'success',
          `“${pendingDelete.label}” ဖသ်ဝါကဏ္ဍကို ဖျက်သိမ်းပြီးပါပြီ။`,
        );
      } else if (pendingDelete.kind === 'adminInvite') {
        await revokeAdminInvite(pendingDelete.id);
        showNotice(
          'success',
          `${pendingDelete.label} ကို Admin စာရင်းမှ ဖယ်ရှားပြီးပါပြီ။`,
        );
      }
      setPendingDelete(null);
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error ? err.message : 'ဖျက်သိမ်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveFatwaCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const cleanedMy = fatwaCatNameMy.trim();
    if (!cleanedMy) {
      showNotice('error', 'ဖသ်ဝါ ကဏ္ဍအမည် (မြန်မာ) ထည့်သွင်းပါ။');
      return;
    }
    setIsSavingFatwaCat(true);
    try {
      const existingIds = new Set(fatwaCategories.map((c) => c.id));
      const targetId =
        editingFatwaCatId || generateFatwaCategorySlug(fatwaCatNameEn, existingIds);

      if (!editingFatwaCatId && fatwaCategoryDocs.length === 0) {
        await seedDefaultFatwaCategories(user.uid);
      }

      const maxOrder = fatwaCategories.reduce(
        (max, c, idx) => Math.max(max, c.sortOrder ?? idx),
        fatwaCategories.length,
      );

      await saveFatwaCategoryRecord(user.uid, {
        id: targetId,
        nameMy: cleanedMy,
        nameEn: fatwaCatNameEn.trim(),
        descriptionMy: fatwaCatDescMy.trim(),
        sortOrder: editingFatwaCatId ? fatwaCatOrder : maxOrder + 1,
        isExistingDoc: Boolean(editingFatwaCatId),
      });

      showNotice(
        'success',
        editingFatwaCatId
          ? `“${cleanedMy}” ဖသ်ဝါကဏ္ဍကို ပြင်ဆင်သိမ်းဆည်းပြီးပါပြီ။`
          : `“${cleanedMy}” ဖသ်ဝါကဏ္ဍအသစ်ကို ထည့်သွင်းပြီးပါပြီ။`,
      );
      setEditingFatwaCatId(null);
      setFatwaCatNameMy('');
      setFatwaCatNameEn('');
      setFatwaCatDescMy('');
      setFatwaCatOrder(0);
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error
          ? err.message
          : 'ဖသ်ဝါကဏ္ဍ သိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      );
    } finally {
      setIsSavingFatwaCat(false);
    }
  };

  const handleSeedFatwaDefaults = async () => {
    if (!user) return;
    setIsSavingFatwaCat(true);
    try {
      await seedDefaultFatwaCategories(user.uid);
      showNotice(
        'success',
        'မူလ ဖသ်ဝါကဏ္ဍ ၆ ခုကို Firestore ထဲသို့ ထည့်သွင်းပြီးပါပြီ။',
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error
          ? err.message
          : 'မူလကဏ္ဍများ ထည့်သွင်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      );
    } finally {
      setIsSavingFatwaCat(false);
    }
  };

  const selectedDuplicatesList = useMemo(
    () =>
      duplicateEntries.filter(
        (entry) => selectedDuplicateIds[entry.duplicate.id],
      ),
    [duplicateEntries, selectedDuplicateIds],
  );

  const handleRemoveSelectedDuplicates = async () => {
    if (selectedDuplicatesList.length === 0) return;
    setIsRemovingDuplicates(true);
    setStatusBanner(null);
    let removedCount = 0;
    let driveRemovedCount = 0;
    try {
      for (const entry of selectedDuplicatesList) {
        await deleteBookRecord(entry.duplicate.id);
        removedCount += 1;

        if (
          dedupeDeleteDriveFiles &&
          entry.canSafelyDeleteDriveFile &&
          driveToken &&
          entry.duplicate.driveFileId
        ) {
          const deleted = await deletePdfFromGoogleDrive(
            driveToken,
            entry.duplicate.driveFileId,
          )
            .then(() => true)
            .catch(() => false);
          if (deleted) driveRemovedCount += 1;
        }
      }

      if (driveRemovedCount > 0 && driveToken) {
        await refreshDriveFiles({silent: true, autoSync: false});
      }

      showNotice(
        'success',
        `ထပ်နေသော စာအုပ် ${removedCount} အုပ်ကို အလိုအလျောက် ဖယ်ရှားပြီးပါပြီ။${
          driveRemovedCount > 0
            ? ` (Google Drive ထဲမှ ထပ်နေသည့် PDF ${driveRemovedCount} ဖိုင်ကိုပါ ရှင်းလင်းပြီး)`
            : ''
        }`,
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error
          ? err.message
          : 'ထပ်နေသော စာအုပ်များ ဖယ်ရှားရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      );
    } finally {
      setIsRemovingDuplicates(false);
    }
  };

  const handleAppointAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const targetEmail = newAdminEmail.trim().toLowerCase();
    if (!targetEmail) return;
    if (
      targetEmail === BOOTSTRAPPED_ADMIN_EMAIL ||
      targetEmail === SECOND_BOOTSTRAPPED_ADMIN_EMAIL
    ) {
      showNotice(
        'error',
        `${targetEmail} သည် မူလ Admin အဖြစ် ပါဝင်ပြီးသား ဖြစ်ပါသည်။`,
      );
      return;
    }

    setIsAppointingAdmin(true);
    setStatusBanner(null);
    try {
      await appointAdminByEmail(
        user.uid,
        user.email || '',
        targetEmail,
        newAdminRoleLabel,
      );
      setNewAdminEmail('');
      setNewAdminRoleLabel('Library Admin');
      showNotice(
        'success',
        `${targetEmail} ကို Admin အဖြစ် ခန့်အပ်ပြီးပါပြီ။ ၎င်းအကောင့်ဖြင့် Google Sign-In ဝင်ရောက်ရုံဖြင့် Admin Panel ကို အသုံးပြုနိုင်ပါပြီ။`,
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error
          ? err.message
          : 'Admin ခန့်အပ်ရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      );
    } finally {
      setIsAppointingAdmin(false);
    }
  };

  const handleSaveTelegramConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setIsSavingTelegram(true);
    setStatusBanner(null);
    try {
      const saved = await saveTelegramBotConfig(user, {
        botToken: telegramTokenInput.trim() || undefined,
        allowedChatIds: telegramAllowedChatsInput.trim(),
        autoSyncToWebsite: telegramAutoSyncInput,
        defaultCategoryId: telegramDefaultCatInput,
        lastUpdateId: telegramSettings.lastUpdateId,
      });

      await saveTelegramSettings(user.uid, {
        connected: saved.tokenConfigured,
        botUsername: saved.botUsername,
        botFirstName: saved.botFirstName,
        allowedChatIds: saved.allowedChatIds,
        autoSyncToWebsite: saved.autoSyncToWebsite,
        defaultCategoryId: saved.defaultCategoryId,
        lastUpdateId: saved.lastUpdateId,
      });

      setTelegramConfigStatus(saved);
      setTelegramTokenInput('');
      showNotice(
        'success',
        `Telegram Bot (@${saved.botUsername}) ကို ဝက်ဘ်ဆိုက်နှင့် အပြီးတိုင် ချိတ်ဆက်သိမ်းဆည်းပြီးပါပြီ။`,
      );
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error
          ? err.message
          : 'Telegram Bot ချိတ်ဆက်သိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      );
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    if (!user) return;
    setIsSavingTelegram(true);
    setStatusBanner(null);
    try {
      setTelegramLiveAutoPoll(false);
      await disconnectTelegramBotConfig(user);
      await saveTelegramSettings(user.uid, DEFAULT_TELEGRAM_SETTINGS);
      const refreshed = await getTelegramConfigStatus(user).catch(() => null);
      setTelegramConfigStatus(refreshed);
      setDiscoveredTelegramChats([]);
      setTelegramPendingCount(null);
      showNotice('success', 'Telegram Bot ချိတ်ဆက်မှုကို ဖြုတ်သိမ်းပြီးပါပြီ။');
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error
          ? err.message
          : 'Telegram Bot ချိတ်ဆက်မှု ဖြုတ်သိမ်း၍ မရပါ။',
      );
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const handleCheckTelegramChats = async () => {
    if (!user) return;
    setIsCheckingTelegramChats(true);
    setStatusBanner(null);
    try {
      const res = await checkTelegramChats(user);
      setDiscoveredTelegramChats(res.chats);
      setTelegramPendingCount(res.pendingPdfCount);
      if (res.chats.length === 0) {
        showNotice(
          'success',
          'Telegram Bot ထံသို့ မကြာသေးမီက ပို့ထားသော Chat/PDF မတွေ့သေးပါ။ Bot (သို့မဟုတ် Bot ပါသော Group/Channel) ထဲသို့ PDF ဖိုင် ၁ ဖိုင် စမ်းပို့ပြီး ထပ်မံစစ်ဆေးပါ။',
        );
      } else {
        showNotice(
          'success',
          `Telegram Chat ${res.chats.length} ခုနှင့် Drive တင်ရန်အသင့် PDF ${res.pendingPdfCount} ဖိုင် တွေ့ရှိပါသည်။`,
        );
      }
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error
          ? err.message
          : 'Telegram Chat များ စစ်ဆေးရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      );
    } finally {
      setIsCheckingTelegramChats(false);
    }
  };

  const handleSyncTelegramToDrive = async (options?: {silent?: boolean}) => {
    if (!user || telegramSyncLockRef.current) return;
    if (!driveToken) {
      if (!options?.silent) {
        showNotice(
          'error',
          'Telegram Bot မှ PDF များကို Google Drive ပေါ်တင်ရန် ဦးစွာ "Google Drive ချိတ်ဆက်ရန်" ခလုတ်ကို နှိပ်ပါ။',
        );
      }
      return;
    }

    telegramSyncLockRef.current = true;
    if (!options?.silent) {
      setIsSyncingTelegramToDrive(true);
      setStatusBanner(null);
    }

    try {
      const folder = await ensureLibraryDriveFolder(
        driveToken,
        siteSettings.driveFolderName || 'Myanmar Muslim Library PDFs',
        siteSettings.driveFolderId,
      );
      if (folder.folderId !== siteSettings.driveFolderId) {
        await saveSiteSettings(user.uid, {
          ...siteSettings,
          driveFolderId: folder.folderId,
          driveFolderName: folder.folderName,
        });
      }

      const syncRes = await syncTelegramPdfsToDrive(
        user,
        driveToken,
        folder.folderId,
      );

      await saveTelegramSettings(user.uid, {
        connected: Boolean(telegramConfigStatus?.tokenConfigured),
        botUsername:
          telegramConfigStatus?.botUsername || telegramSettings.botUsername,
        botFirstName:
          telegramConfigStatus?.botFirstName || telegramSettings.botFirstName,
        allowedChatIds: telegramAllowedChatsInput.trim(),
        autoSyncToWebsite: telegramAutoSyncInput,
        defaultCategoryId: telegramDefaultCatInput,
        lastUpdateId: syncRes.lastUpdateId,
      });

      let publishedCount = 0;
      if (telegramAutoSyncInput && syncRes.uploadedBooks.length > 0) {
        const existingTitles = new Set(
          books.map((b) => normalizeBookTitle(b.title)).filter(Boolean),
        );

        for (const uploaded of syncRes.uploadedBooks) {
          const inferred = inferBookMetadataFromFileName(
            uploaded.title || uploaded.fileName,
          );
          const resolvedTitle = uploaded.title || inferred.title;
          const normalizedKey = normalizeBookTitle(resolvedTitle);

          if (
            knownDriveIdsRef.current.has(uploaded.driveFileId) ||
            (normalizedKey && existingTitles.has(normalizedKey))
          ) {
            knownDriveIdsRef.current.add(uploaded.driveFileId);
            continue;
          }

          knownDriveIdsRef.current.add(uploaded.driveFileId);
          if (normalizedKey) existingTitles.add(normalizedKey);

          const resolvedCategoryId =
            telegramDefaultCatInput === 'auto'
              ? inferred.categoryId
              : telegramDefaultCatInput;
          const catObj = bookCategories.find(
            (c) => c.id === resolvedCategoryId,
          );
          const urls = buildDriveUrls(uploaded.driveFileId);

          await createBookRecord(user.uid, {
            title: resolvedTitle,
            author: inferred.author,
            categoryId: resolvedCategoryId,
            categoryLabel: catObj?.nameMy || 'ကုရ်အာန်နှင့် သဖ်စီးရ်',
            type: 'Book',
            hijriYear: '၁၄၄၇ ဟစ်ဂျရီ',
            pages: 0,
            fileSize: uploaded.fileSize || 'PDF',
            summary: '',
            driveFileId: uploaded.driveFileId,
            driveViewUrl: urls.driveViewUrl,
            driveDownloadUrl: urls.driveDownloadUrl,
            coverTheme: 'emerald',
            downloads: 0,
            published: true,
          });
          publishedCount += 1;
        }
      }

      if (syncRes.uploadedBooks.length > 0) {
        // Trigger immediate fast Drive-to-Website verification sync
        await refreshDriveFiles({
          silent: true,
          scope: 'folder',
          autoSync: true,
        });
      }

      setTelegramPendingCount(0);
      setLastTelegramSyncResult({
        uploadedCount: syncRes.uploadedBooks.length,
        publishedCount,
        skippedCount: syncRes.skippedCount,
        errors: syncRes.errors,
        timestamp: new Date().toLocaleTimeString(),
      });

      if (syncRes.uploadedBooks.length > 0) {
        showNotice(
          'success',
          `Telegram Bot မှ PDF ${syncRes.uploadedBooks.length} အုပ်ကို Google Drive ထဲသို့ တင်ပြီး ${
            publishedCount > 0
              ? `ဝက်ဘ်ဆိုက်စာကြည့်တိုက်ပေါ်သို့ ${publishedCount} အုပ် ချက်ချင်း Sync လုပ်တင်ပြပြီးပါပြီ။`
              : 'Drive နှင့် ချိတ်ဆက်ပြီးပါပြီ။'
          }`,
        );
      } else if (!options?.silent) {
        showNotice(
          'success',
          syncRes.errors.length > 0
            ? `Telegram စစ်ဆေးမှု ပြီးဆုံးပါသည်။ (သတိပြုရန်: ${syncRes.errors[0]})`
            : 'Telegram Bot ထံတွင် Drive တင်ရန် PDF အသစ် မရှိသေးပါ။',
        );
      }
    } catch (err) {
      if (!options?.silent) {
        handleDriveError(
          err,
          'Telegram Bot မှ Google Drive သို့ PDF တင်ရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
        );
      }
    } finally {
      telegramSyncLockRef.current = false;
      if (!options?.silent) {
        setIsSyncingTelegramToDrive(false);
      }
    }
  };

  useEffect(() => {
    if (
      !telegramLiveAutoPoll ||
      !isAdmin ||
      !user ||
      !driveToken ||
      !telegramConfigStatus?.tokenConfigured
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      void handleSyncTelegramToDrive({silent: true});
    }, 8000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    telegramLiveAutoPoll,
    isAdmin,
    user,
    driveToken,
    telegramConfigStatus?.tokenConfigured,
  ]);

  const unreadMessageCount = useMemo(
    () => messages.filter((m) => m.status === 'unread').length,
    [messages],
  );

  const existingBookTitleSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of books) {
      const normalized = normalizeBookTitle(b.title);
      if (normalized) set.add(normalized);
    }
    return set;
  }, [books]);

  const filteredCatalogItems = useMemo(() => {
    const q = importSearchQuery.trim().toLowerCase();
    if (!q) return catalogItems;
    return catalogItems.filter((item) =>
      item.title.toLowerCase().includes(q),
    );
  }, [catalogItems, importSearchQuery]);

  const selectedImportCount = useMemo(
    () =>
      catalogItems.filter((item) => selectedImportUrls[item.postUrl]).length,
    [catalogItems, selectedImportUrls],
  );

  const handleFetchCatalog = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setIsFetchingCatalog(true);
    setStatusBanner(null);
    try {
      const data = await fetchBlogspotCatalog(user, importSourceUrl.trim());
      setCatalogItems(data.items);
      setSelectedImportUrls({});
      setImportStatuses({});
      if (data.items.length === 0) {
        showNotice(
          'error',
          'ဤလင့်ခ်အတွင်း Blogspot / Library စာအုပ်ပို့စ် လင့်ခ်များ မတွေ့ရှိပါ။ (စာအုပ်စာရင်း စာမျက်နှာ၊ Label စာမျက်နှာ သို့မဟုတ် စာအုပ်ပို့စ် URL ကို စစ်ဆေးပါ)',
        );
      } else {
        showNotice(
          'success',
          `စာအုပ်စာရင်း စုစုပေါင်း ${data.items.length} အုပ် ရှာဖွေတွေ့ရှိပါသည်။ Drive ထဲသို့ ထည့်လိုသော စာအုပ်များကို ရွေးချယ်၍ စတင်နိုင်ပါပြီ။`,
        );
      }
    } catch (err) {
      showNotice(
        'error',
        err instanceof Error
          ? err.message
          : 'စာအုပ်စာရင်း ရယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      );
    } finally {
      setIsFetchingCatalog(false);
    }
  };

  const selectFirstUnimported = (limit: number | 'all') => {
    const next: Record<string, boolean> = {};
    let picked = 0;
    for (const item of filteredCatalogItems) {
      const normalizedTitle = item.title
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      const alreadyExists =
        existingBookTitleSet.has(normalizedTitle) ||
        importStatuses[item.postUrl]?.status === 'done';
      if (alreadyExists) continue;
      next[item.postUrl] = true;
      picked += 1;
      if (limit !== 'all' && picked >= limit) break;
    }
    setSelectedImportUrls(next);
  };

  const runBatchImport = async (itemsToImport: BlogspotCatalogItem[]) => {
    if (!user || !driveToken) {
      showNotice(
        'error',
        'Google Drive ထဲသို့ စာအုပ်ထည့်ရန် ဦးစွာ "Google Drive ချိတ်ဆက်ရန်" ခလုတ်ကို နှိပ်၍ ချိတ်ဆက်ပါ။',
      );
      return;
    }
    if (itemsToImport.length === 0) {
      showNotice('error', 'ထည့်သွင်းမည့် စာအုပ်ကို အနည်းဆုံး ၁ အုပ် ရွေးချယ်ပါ။');
      return;
    }

    importStopRequestedRef.current = false;
    setIsImportingBatch(true);
    setStatusBanner(null);

    let successCount = 0;
    let errorCount = 0;

    try {
      const folder = await ensureLibraryDriveFolder(
        driveToken,
        siteSettings.driveFolderName || 'Myanmar Muslim Library PDFs',
        siteSettings.driveFolderId,
      );

      if (folder.folderId !== siteSettings.driveFolderId) {
        await saveSiteSettings(user.uid, {
          ...siteSettings,
          driveFolderId: folder.folderId,
          driveFolderName: folder.folderName,
        });
      }

      for (let i = 0; i < itemsToImport.length; i += 1) {
        if (importStopRequestedRef.current) break;

        const item = itemsToImport[i];
        setImportProgress({
          current: i + 1,
          total: itemsToImport.length,
          currentTitle: item.title,
        });
        setImportStatuses((prev) => ({
          ...prev,
          [item.postUrl]: {status: 'importing'},
        }));

        try {
          const result = await transferBlogspotBookToDrive(user, driveToken, {
            postUrl: item.postUrl,
            bookTitle: item.title,
            folderId: folder.folderId,
          });

          const inferred = inferBookMetadataFromFileName(
            result.title || item.title,
          );
          const resolvedCategoryId =
            importCategoryOverride === 'auto'
              ? inferred.categoryId
              : importCategoryOverride;
          const catObj = bookCategories.find(
            (c) => c.id === resolvedCategoryId,
          );
          const urls = buildDriveUrls(result.driveFileId);

          knownDriveIdsRef.current.add(result.driveFileId);
          await createBookRecord(user.uid, {
            title: item.title || result.title,
            author: inferred.author,
            categoryId: resolvedCategoryId,
            categoryLabel: catObj?.nameMy || 'ကုရ်အာန်နှင့် သဖ်စီးရ်',
            type: 'Book',
            hijriYear: '၁၄၄၇ ဟစ်ဂျရီ',
            pages: 0,
            fileSize: result.fileSize || 'PDF',
            summary: '',
            driveFileId: result.driveFileId,
            driveViewUrl: urls.driveViewUrl,
            driveDownloadUrl: urls.driveDownloadUrl,
            coverTheme: 'emerald',
            downloads: 0,
            published: true,
          });

          successCount += 1;
          setImportStatuses((prev) => ({
            ...prev,
            [item.postUrl]: {
              status: 'done',
              sourceType: result.sourceType,
              message: `Drive (${result.fileSize}) ထဲသို့ ထည့်ပြီးပါပြီ`,
            },
          }));
          setSelectedImportUrls((prev) => ({
            ...prev,
            [item.postUrl]: false,
          }));
        } catch (err) {
          const status =
            typeof err === 'object' &&
            err !== null &&
            'status' in err &&
            typeof (err as {status: unknown}).status === 'number'
              ? (err as {status: number}).status
              : 0;
          const msg =
            err instanceof Error ? err.message : 'PDF ထည့်သွင်းမှု မအောင်မြင်ပါ';

          errorCount += 1;
          setImportStatuses((prev) => ({
            ...prev,
            [item.postUrl]: {status: 'error', message: msg},
          }));

          if (status === 401) {
            showNotice(
              'error',
              'Google Drive ချိတ်ဆက်ခွင့် သက်တမ်းကုန်ဆုံးသွားပါသည်။ ထိပ်ရှိ ခလုတ်မှ ပြန်လည်ချိတ်ဆက်ပြီး ဆက်လက်တင်သွင်းပါ။',
            );
            break;
          }
        }
      }

      if (successCount > 0) {
        await refreshDriveFiles({silent: true, autoSync: false});
        showNotice(
          'success',
          `စာအုပ် ${successCount} အုပ်ကို သင့် Google Drive ထဲသို့ ကူးယူထည့်သွင်းပြီး ဝက်ဘ်ဆိုက်စာကြည့်တိုက်ပေါ်သို့ တင်ပြပြီးပါပြီ။${
            errorCount > 0 ? ` (${errorCount} အုပ် မအောင်မြင်ပါ)` : ''
          }`,
        );
      } else if (errorCount > 0) {
        showNotice(
          'error',
          `ရွေးချယ်ထားသော စာအုပ် ${errorCount} အုပ်တွင် PDF ဖိုင်ရယူ၍ မရနိုင်ပါ။ အောက်ပါ စာရင်းတွင် အသေးစိတ် ကြည့်ရှုနိုင်ပါသည်။`,
        );
      }
    } catch (err) {
      handleDriveError(err, 'Google Drive သို့ စာအုပ်များ တင်သွင်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။');
    } finally {
      setIsImportingBatch(false);
      setImportProgress(null);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="max-w-[900px] mx-auto px-4 py-16 text-center text-sm text-[#525E75] dark:text-[#94A3B8]">
        စနစ်ကို စစ်ဆေးနေပါသည်...
      </div>
    );
  }

  // Not signed in -> Official Google Sign-In UI
  if (!user) {
    return (
      <div className="max-w-[560px] mx-auto px-4 py-14 sm:py-20">
        <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-[#EFF3FA] dark:bg-[#131E36] text-[#1E3A8A] dark:text-[#60A5FA] flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#131B2E] dark:text-[#F1F5F9]">
              Admin Panel သို့ ဝင်ရောက်ရန်
            </h1>
            <p className="text-sm text-[#525E75] dark:text-[#94A3B8] leading-relaxed">
              စာအုပ် PDF များကို Google Drive ထဲသို့ တင်သွင်းရန်၊ မလိုအပ်သော ကဏ္ဍများကို
              ဖယ်ထုတ်စီမံရန်နှင့် ဝက်ဘ်ဆိုက်တစ်ခုလုံးကို ထိန်းချုပ်ရန် Admin Google Account
              ဖြင့် ဝင်ရောက်ပါ။
            </p>
          </div>

          {statusBanner && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 text-left">
              {statusBanner.text}
            </div>
          )}

          <div className="flex justify-center pt-1">
            <button
              type="button"
              disabled={isConnectingAuth}
              onClick={handleGoogleLogin}
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-lg border border-[#DADCE0] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-[#F8F9FA] dark:hover:bg-[#1A2A4A] text-[#3C4043] dark:text-[#F1F5F9] font-medium text-sm shadow-xs transition-colors disabled:opacity-60"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-5 h-5 shrink-0"
                aria-hidden="true"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>
                {isConnectingAuth ? 'ဝင်ရောက်နေပါသည်...' : 'Sign in with Google'}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Signed in, but not Admin
  if (!isAdmin) {
    return (
      <div className="max-w-[560px] mx-auto px-4 py-14 sm:py-20">
        <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-[#B85338] dark:text-[#F0947A] mx-auto" />
          <h1 className="text-lg font-bold text-[#131B2E] dark:text-[#F1F5F9]">
            Admin ခွင့်ပြုချက် မရှိပါ
          </h1>
          <p className="text-sm text-[#525E75] dark:text-[#94A3B8]">
            လက်ရှိ ဝင်ရောက်ထားသော အကောင့် ({user.email}) သည် Admin အဖြစ်
            သတ်မှတ်ထားခြင်း မရှိပါ။ Admin အကောင့်ဖြင့် ပြန်လည်ဝင်ရောက်ပါ။
          </p>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="px-4 py-2 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#172D6B] dark:hover:bg-[#3B82F6]"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Admin Top Header */}
      <section className="islamic-lattice-bg relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 islamic-pattern-overlay pointer-events-none"
        />
        <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#E2C792] mb-1">
              ADMINISTRATION &amp; GOOGLE DRIVE PDF STORAGE
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold">
              Admin Panel — စာကြည့်တိုက် စီမံခန့်ခွဲမှု
            </h1>
            <p className="text-xs sm:text-sm text-[#DCE4F2] mt-1">
              ဝင်ရောက်ထားသူ: {user.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!driveToken ? (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isConnectingAuth}
                className="min-h-[42px] px-4 py-2 rounded-lg bg-[#B85338] hover:bg-[#9E452E] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors"
              >
                <HardDrive className="w-4 h-4" />
                <span>
                  {isConnectingAuth
                    ? 'ချိတ်ဆက်နေသည်...'
                    : 'Google Drive ချိတ်ဆက်ရန်'}
                </span>
              </button>
            ) : (
              <span className="px-3.5 py-2 rounded-lg bg-white/15 border border-white/25 text-xs font-semibold inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[#E2C792]" />
                <span>Google Drive ချိတ်ဆက်ပြီး</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => void onSignOut()}
              className="min-h-[42px] px-4 py-2 rounded-lg bg-black/25 hover:bg-black/40 border border-white/20 text-white text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>ထွက်ရန်</span>
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {statusBanner && (
          <div
            className={`p-4 rounded-xl border text-sm space-y-3 ${
              statusBanner.type === 'success'
                ? 'bg-[#EFF3FA] dark:bg-[#131E36] border-[#1E3A8A]/30 dark:border-[#60A5FA]/40 text-[#1E3A8A] dark:text-[#93C5FD]'
                : 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="leading-relaxed">{statusBanner.text}</span>
              <button
                type="button"
                onClick={() => {
                  setStatusBanner(null);
                  setDriveActivationUrl(null);
                }}
                className="text-xs font-semibold underline shrink-0"
              >
                ပိတ်ရန်
              </button>
            </div>

            {driveActivationUrl && statusBanner.type === 'error' && (
              <div className="pt-2 border-t border-red-200/80 dark:border-red-900/60 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={driveActivationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3.5 py-2 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172E6E] dark:hover:bg-[#3B82F6] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Google Drive API ဖွင့်ရန် (Google Cloud Console)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void refreshDriveFiles()}
                    disabled={isLoadingDrive}
                    className="min-h-[38px] px-3.5 py-2 rounded-lg bg-white dark:bg-[#131E36] border border-red-300 dark:border-red-800/60 text-red-800 dark:text-red-300 hover:bg-red-100/60 dark:hover:bg-red-950/80 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`}
                    />
                    <span>ပြန်လည်စစ်ဆေးရန်</span>
                  </button>
                </div>
                <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
                  မှတ်ချက် — Google Drive API မဖွင့်ရသေးမီကြားကာလတွင်လည်း Google Drive မှ PDF ဖိုင်၏ Share Link
                  (Anyone with the link) ကို အောက်ပါ &ldquo;Google Drive File ID သို့မဟုတ် Share Link&rdquo; အကွက်ထဲသို့ တိုက်ရိုက်ကူးထည့်၍ စာအုပ်တင်နိုင်ပါသည်။
                </p>
              </div>
            )}
          </div>
        )}

        {/* Admin Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#E2E6EE] dark:border-[#1E2C4A]">
          {[
            {id: 'books' as const, label: `စာအုပ်နှင့် PDF (${books.length})`, icon: BookPlus},
            {id: 'import' as const, label: 'Web Link မှ စာအုပ်ဆွဲတင်ရန်', icon: Globe},
            {id: 'visibility' as const, label: 'ကဏ္ဍဖယ်ထုတ် / ပြသမှု', icon: Sliders},
            {id: 'drive' as const, label: 'Google Drive သိုလှောင်ခန်း', icon: HardDrive},
            {id: 'content' as const, label: 'ဒိုအာ · ဗီဒီယို · ဆောင်းပါး', icon: LayoutGrid},
            {
              id: 'fatwaCategories' as const,
              label: `ဖသ်ဝါကဏ္ဍများ (${fatwaCategories.length})`,
              icon: Scale,
            },
            {
              id: 'messages' as const,
              label: `ဆက်သွယ်စာများ (${unreadMessageCount})`,
              icon: Inbox,
            },
            {
              id: 'links' as const,
              label: 'ဆက်သွယ်ရေးလင့်ခ် (Footer Sync)',
              icon: Link2,
            },
            {
              id: 'settings' as const,
              label: 'Admin & Telegram Bot',
              icon: Settings,
            },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[42px] px-4 py-2 rounded-t-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                  active
                    ? 'border-[#1E3A8A] dark:border-[#60A5FA] text-[#1E3A8A] dark:text-[#93C5FD] bg-white dark:bg-[#0D1526]'
                    : 'border-transparent text-[#525D73] dark:text-[#94A3B8] hover:text-[#1E3A8A] dark:hover:text-[#93C5FD]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: BOOKS & PDF UPLOAD */}
        {activeTab === 'books' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
            {/* Upload / Edit Form */}
            <form
              onSubmit={handleSaveBook}
              className="lg:col-span-5 bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-3">
                <h2 className="text-base font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                  {editingBookId ? 'စာအုပ်အချက်အလက် ပြင်ဆင်ရန်' : 'PDF စာအုပ်အသစ် တင်ရန်'}
                </h2>
                {editingBookId && (
                  <button
                    type="button"
                    onClick={resetBookForm}
                    className="text-xs font-semibold text-[#9B7417] dark:text-[#E2C792] hover:underline"
                  >
                    အသစ်ပြန်စရန်
                  </button>
                )}
              </div>

              {/* Direct Google Drive PDF Upload Box */}
              <div className="rounded-xl border border-dashed border-[#146B3A]/45 dark:border-[#34D399]/40 bg-[#F6FAF7] dark:bg-[#091815] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-[#115E34] dark:text-[#6EE7B7]">
                      ၁. PDF ဖိုင်ကို Google Drive သို့ တင်သွင်းပါ
                    </p>
                    <p className="text-[11.5px] text-[#4A5850] dark:text-[#94A3B8]">
                      ဖိုင်များကို Google Drive ({siteSettings.driveFolderName}) ထဲတွင် သိမ်းဆည်းပါမည်
                    </p>
                  </div>
                </div>

                {!driveToken ? (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#C59B27] hover:bg-[#B2891B] text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
                  >
                    <HardDrive className="w-4 h-4" />
                    <span>PDF တင်ရန် Google Drive ချိတ်ဆက်ပါ</span>
                  </button>
                ) : (
                  <label className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>PDF ဖိုင်ရွေးချယ်တင်သွင်းရန် (တစ်အုပ် / အများအပြား)</span>
                    <input
                      type="file"
                      multiple
                      accept="application/pdf,.pdf"
                      onChange={handlePdfFileSelected}
                      className="sr-only"
                    />
                  </label>
                )}

                {uploadProgress !== null && (
                  <div className="space-y-1">
                    <div className="w-full h-2 bg-[#DCE6DF] dark:bg-[#1E2C4A] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#146B3A] dark:bg-[#34D399] transition-all duration-200"
                        style={{width: `${uploadProgress}%`}}
                      />
                    </div>
                    <p className="text-[11px] text-[#115E34] dark:text-[#6EE7B7] tabular-nums">
                      Google Drive Upload: {uploadProgress}%
                    </p>
                  </div>
                )}

                {driveFiles.length > 0 && (
                  <div className="space-y-2">
                    <label
                      htmlFor="pick-existing-drive-pdf"
                      className="block text-[11px] font-semibold text-[#4A5850] dark:text-[#CBD5E1]"
                    >
                      သို့မဟုတ် Drive ထဲရှိပြီးသား PDF ရွေးချယ်၍ တန်းတင်ရန်
                    </label>
                    <select
                      id="pick-existing-drive-pdf"
                      value={bookDriveFileId}
                      onChange={(e) => {
                        const fid = e.target.value;
                        setBookDriveFileId(fid);
                        const match = driveFiles.find((f) => f.id === fid);
                        if (match) {
                          const inferred = inferBookMetadataFromFileName(
                            match.name,
                          );
                          setBookFileSize(formatBytes(match.size));
                          setBookTitle(inferred.title);
                          setBookAuthor(inferred.author);
                          setBookCategoryId(inferred.categoryId);
                        }
                      }}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-white dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
                    >
                      <option value="">-- Google Drive PDF ရွေးချယ်ပါ --</option>
                      {driveFiles.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} ({formatBytes(f.size)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                  Google Drive File ID သို့မဟုတ် Share Link *
                </label>
                <input
                  type="text"
                  required
                  value={bookDriveFileId}
                  onChange={(e) =>
                    setBookDriveFileId(extractDriveFileId(e.target.value))
                  }
                  placeholder="PDF တင်ပြီးပါက အလိုအလျောက် ဖြည့်ပေးပါမည် (သို့) Drive Link ကူးထည့်ပါ"
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] font-mono"
                />
                <p className="text-[11px] text-[#5A6860] dark:text-[#94A3B8] mt-1">
                  Drive ချိတ်ဆက်ထားပါက Link ထည့်ရုံဖြင့် စာအုပ်အမည်နှင့် ဖိုင်အရွယ်အစားကို Drive မှ တိုက်ရိုက်ဆွဲယူပေးပါမည်
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                  စာအုပ်အမည် {driveToken ? '(Drive မှ အလိုအလျောက် ယူနိုင်သည်)' : '*'}
                </label>
                <input
                  type="text"
                  required={!driveToken}
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="မထည့်ပါက Google Drive ဖိုင်အမည်အတိုင်း တင်ပေးပါမည်"
                  className={`w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] ${getScriptFontClass(bookTitle)}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                  စာရေးဆရာ / ပြုစုသူ (မပါလည်း တင်နိုင်သည်)
                </label>
                <input
                  type="text"
                  value={bookAuthor}
                  onChange={(e) => setBookAuthor(e.target.value)}
                  placeholder="စာရေးဆရာအမည် (မပါလျှင် အလွတ်ထားနိုင်သည်)"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1]">
                      ကဏ္ဍ (Category)
                    </label>
                    <button
                      type="button"
                      onClick={onOpenCategoryManager}
                      className="text-[11px] font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Customize / ထပ်ခွဲရန်</span>
                    </button>
                  </div>
                  <select
                    value={bookCategoryId}
                    onChange={(e) =>
                      setBookCategoryId(e.target.value as BookCategoryId)
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
                  >
                    {bookCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameMy}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                    အမျိုးအစား (Type)
                  </label>
                  <select
                    value={bookType}
                    onChange={(e) =>
                      setBookType(
                        e.target.value as Exclude<MaterialType, 'All Types'>,
                      )
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
                  >
                    <option value="Book">Book</option>
                    <option value="Periodical">Periodical</option>
                    <option value="Research">Research</option>
                    <option value="Dua">Dua</option>
                    <option value="Timetable">Timetable</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                    ခုနှစ်
                  </label>
                  <input
                    type="text"
                    value={bookHijriYear}
                    onChange={(e) => setBookHijriYear(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                    စာမျက်နှာ
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={bookPages}
                    onChange={(e) => setBookPages(Number(e.target.value))}
                    className="w-full min-h-[40px] px-2.5 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                    အရောင်ဒီဇိုင်း
                  </label>
                  <select
                    value={bookCoverTheme}
                    onChange={(e) =>
                      setBookCoverTheme(
                        e.target.value as BookItem['coverTheme'],
                      )
                    }
                    className="w-full min-h-[40px] px-2 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
                  >
                    <option value="emerald">Emerald</option>
                    <option value="gold">Gold</option>
                    <option value="teal">Teal</option>
                    <option value="burgundy">Burgundy</option>
                    <option value="slate">Slate</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                  အကျဉ်းချုပ်မိတ်ဆက်
                </label>
                <textarea
                  rows={3}
                  value={bookSummary}
                  onChange={(e) => setBookSummary(e.target.value)}
                  placeholder="စာအုပ်အကြောင်း အကျဉ်းချုပ်..."
                  className="w-full px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B]"
                />
              </div>

              <label className="flex items-center gap-2.5 text-sm text-[#1A241E] dark:text-[#F1F5F9] cursor-pointer">
                <input
                  type="checkbox"
                  checked={bookPublished}
                  onChange={(e) => setBookPublished(e.target.checked)}
                  className="w-4 h-4 accent-[#146B3A]"
                />
                <span>ဝက်ဘ်ဆိုက်တွင် တိုက်ရိုက်ဖော်ပြမည် (Published)</span>
              </label>

              <button
                type="submit"
                disabled={isSavingBook}
                className="w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {isSavingBook
                  ? 'သိမ်းဆည်းနေပါသည်...'
                  : editingBookId
                    ? 'ပြင်ဆင်မှု သိမ်းဆည်းရန်'
                    : 'စာကြည့်တိုက်ထဲသို့ ထည့်သွင်းရန်'}
              </button>
            </form>

            {/* Existing Books Table / List */}
            <div className="lg:col-span-7 space-y-5">
              {/* Auto Duplicate Detection & Cleanup Panel */}
              <div className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#FDF9EE] dark:bg-[#1E190C] text-[#9B7417] dark:text-[#E2C792] flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                        ထပ်နေသော စာအုပ်များ အလိုအလျောက် ရွေးချယ်ဖယ်ရှားစနစ်
                      </h3>
                      <p className="text-[11.5px] text-[#5A6860] dark:text-[#94A3B8]">
                        ခေါင်းစဉ်တူ (သို့) Drive File ID တူနေသော စာအုပ်ပွားများကို စစ်ဆေးပြီး
                        အလိုအလျောက် အမှန်ခြစ်ရွေးပေးထားပါသည်
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      duplicateEntries.length > 0
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                        : 'bg-[#EBF4EE] dark:bg-[#0D231B] text-[#115E34] dark:text-[#6EE7B7]'
                    }`}
                  >
                    {duplicateEntries.length > 0
                      ? `ထပ်နေသည့်စာအုပ် ${duplicateEntries.length} အုပ် တွေ့ရှိ`
                      : 'ထပ်နေသော စာအုပ်မရှိပါ'}
                  </span>
                </div>

                {duplicateEntries.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <div className="max-h-[260px] overflow-y-auto border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-lg divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A]">
                      {duplicateEntries.map((entry) => {
                        const checked = Boolean(
                          selectedDuplicateIds[entry.duplicate.id],
                        );
                        return (
                          <label
                            key={entry.duplicate.id}
                            className={`p-3 flex items-start gap-2.5 cursor-pointer text-xs ${
                              checked
                                ? 'bg-red-50/50 dark:bg-red-950/30'
                                : 'bg-white dark:bg-[#0D1526]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isRemovingDuplicates}
                              onChange={(e) =>
                                setSelectedDuplicateIds((prev) => ({
                                  ...prev,
                                  [entry.duplicate.id]: e.target.checked,
                                }))
                              }
                              className="w-4 h-4 mt-0.5 accent-red-600 shrink-0"
                            />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-[#1A241E] dark:text-[#F1F5F9] truncate">
                                  {entry.duplicate.title}
                                </span>
                                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                                  ·{' '}
                                  {entry.reason === 'drive-id'
                                    ? 'Drive File ID တူ'
                                    : 'စာအုပ်ခေါင်းစဉ်တူ'}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#5A6860] dark:text-[#94A3B8] truncate">
                                မူရင်းအဖြစ် ချန်ထားမည်: &ldquo;{entry.keptOriginal.title}&rdquo; ·{' '}
                                {entry.duplicate.fileSize || 'PDF'}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const next: Record<string, boolean> = {};
                            for (const e of duplicateEntries)
                              next[e.duplicate.id] = true;
                            setSelectedDuplicateIds(next);
                          }}
                          className="text-xs font-semibold text-[#115E34] dark:text-[#6EE7B7] hover:underline"
                        >
                          အားလုံး အော်တိုရွေးမည်
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDuplicateIds({})}
                          className="text-xs font-medium text-[#5A6860] dark:text-[#94A3B8] hover:underline"
                        >
                          ရွေးချယ်မှု ဖျက်မည်
                        </button>
                        {driveToken && (
                          <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[#35433A] dark:text-[#CBD5E1] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={dedupeDeleteDriveFiles}
                              onChange={(e) =>
                                setDedupeDeleteDriveFiles(e.target.checked)
                              }
                              className="w-3.5 h-3.5 accent-red-600"
                            />
                            <span>Drive ထဲမှ ထပ်နေသော PDF ပါ ဖျက်မည်</span>
                          </label>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={
                          isRemovingDuplicates ||
                          selectedDuplicatesList.length === 0
                        }
                        onClick={() => void handleRemoveSelectedDuplicates()}
                        className="min-h-[38px] px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          {isRemovingDuplicates
                            ? 'ဖယ်ရှားနေပါသည်...'
                            : `ရွေးထားသော ထပ်နေသည့်စာအုပ် (${selectedDuplicatesList.length}) အုပ် ဖယ်ရှားမည်`}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-3">
                <h2 className="text-base font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                  စာကြည့်တိုက်ရှိ စာအုပ်စာရင်း ({books.length})
                </h2>
                {books.length > 0 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-[#6B7A70] dark:text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={bookListSearch}
                      onChange={(e) => setBookListSearch(e.target.value)}
                      placeholder="စာအုပ်အမည် ရှာဖွေရန်..."
                      className="w-full min-h-[36px] pl-8 pr-3 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B]"
                    />
                  </div>
                )}
              </div>

              {books.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <FileText className="w-10 h-10 text-[#96A49B] dark:text-[#64748B] mx-auto" />
                  <p className="text-sm font-semibold text-[#1A241E] dark:text-[#F1F5F9]">
                    စာအုပ်တစ်အုပ်မျှ မတင်ရသေးပါ
                  </p>
                  <p className="text-xs text-[#5A6860] dark:text-[#94A3B8]">
                    ဘယ်ဘက်ပုံစံမှတစ်ဆင့် PDF ဖိုင်ကို Google Drive သို့ တင်သွင်းပြီး
                    ပထမဆုံးစာအုပ်ကို ထည့်သွင်းနိုင်ပါသည်။
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A]">
                  {books
                    .filter((b) => {
                      const q = bookListSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        b.title.toLowerCase().includes(q) ||
                        b.author.toLowerCase().includes(q) ||
                        b.categoryLabel.toLowerCase().includes(q)
                      );
                    })
                    .map((book) => (
                    <div
                      key={book.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-14 rounded-md overflow-hidden border border-[#E2E8E4] dark:border-[#1E2C4A] shrink-0 bg-[#F3F5F4] dark:bg-[#131E36]">
                          <BookCoverFrame book={book} compact />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-[#9B7417] dark:text-[#E2C792]">
                              {book.categoryLabel}
                            </span>
                            <span className="text-[11px] text-[#5A6860] dark:text-[#94A3B8]">
                              · {book.fileSize || 'PDF'}
                            </span>
                            {!book.published && (
                              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                                · ဖျောက်ထားသည်
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9] truncate ${getScriptFontClass(book.title)}`}
                          >
                            {book.title}
                          </p>
                          {book.author.trim() && (
                            <p className="text-xs text-[#5A6860] dark:text-[#94A3B8] truncate">
                              {book.author}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleTogglePublish(book)}
                          title={book.published ? 'ဖျောက်ထားရန်' : 'ပြန်ဖော်ပြရန်'}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-[#D4DDD7] dark:border-[#263759] text-xs font-medium text-[#35433A] dark:text-[#CBD5E1] hover:bg-[#F2F6F3] dark:hover:bg-[#131E36] inline-flex items-center gap-1"
                        >
                          {book.published ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>ဖျောက်ရန်</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>ပြသရန်</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEditBook(book)}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-[#D4DDD7] dark:border-[#263759] text-xs font-medium text-[#115E34] dark:text-[#6EE7B7] hover:bg-[#EBF4EE] dark:hover:bg-[#132920] inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>ပြင်ရန်</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setAlsoDeleteFromDrive(true);
                            setPendingDelete({
                              kind: 'book',
                              id: book.id,
                              label: book.title,
                              driveFileId: book.driveFileId,
                            });
                          }}
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/60 inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ဖျက်ရန်</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WEB LINK / BLOGSPOT BATCH IMPORTER */}
        {activeTab === 'import' && (
          <div className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-7 space-y-6">
            <div className="space-y-1.5 border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-4">
              <h2 className="text-lg font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                Blogspot / Web Link မှ စာအုပ် PDF များ Drive ထဲသို့ တိုက်ရိုက်ဆွဲတင်ရန်
              </h2>
              <p className="text-sm text-[#4A5850] dark:text-[#94A3B8] leading-relaxed">
                ပြင်ပ Blogspot နှင့် အစ္စလာမ့်စာကြည့်တိုက် URL များ (ဥပမာ - myanmarfreeislamicbooks.blogspot.com၊ library.ioumyanmar.com)
                မှ စာအုပ်များ (bit.ly / Google Drive / MediaFire လင့်ခ်များအပါအဝင်) ကို စစ်ဆေးဆွဲယူပြီး သင့် Google Drive ဖိုလ်ဒါ ({siteSettings.driveFolderName})
                ထဲသို့ အလိုအလျောက် ကူးယူသိမ်းဆည်းကာ ဝက်ဘ်ဆိုက်စာကြည့်တိုက်ပေါ်သို့ တိုက်ရိုက်တင်ပေးပါမည်။
              </p>
            </div>

            {!driveToken && (
              <div className="p-4 rounded-xl bg-[#FDF9EE] dark:bg-[#1E190C] border border-[#C59B27]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs sm:text-sm text-[#6E500A] dark:text-[#F3DFB1]">
                  စာအုပ် PDF များကို သင့် Google Drive ထဲသို့ ထည့်သွင်းနိုင်ရန် ဦးစွာ Google Drive ချိတ်ဆက်ပါ။
                </p>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isConnectingAuth}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#C59B27] hover:bg-[#B2891B] text-white text-xs font-semibold inline-flex items-center gap-2 shrink-0"
                >
                  <HardDrive className="w-4 h-4" />
                  <span>Google Drive ချိတ်ဆက်ရန်</span>
                </button>
              </div>
            )}

            {/* Source URL Fetch Form */}
            <div className="space-y-2.5">
              <form
                onSubmit={handleFetchCatalog}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              >
                <input
                  type="url"
                  required
                  value={importSourceUrl}
                  onChange={(e) => setImportSourceUrl(e.target.value)}
                  placeholder="https://myanmarfreeislamicbooks.blogspot.com/p/book-list.html?m=0"
                  className="flex-1 min-h-[44px] px-3.5 py-2 text-xs sm:text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] font-mono"
                />
                <button
                  type="submit"
                  disabled={isFetchingCatalog || isImportingBatch}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
                >
                  {isFetchingCatalog ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>စာရင်းဆွဲယူနေသည်...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      <span>စာအုပ်စာရင်း စစ်ဆေးဆွဲယူရန်</span>
                    </>
                  )}
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[#5A6860] dark:text-[#94A3B8] font-medium">အသင့်သုံး လင့်ခ်များ -</span>
                <button
                  type="button"
                  disabled={isFetchingCatalog || isImportingBatch}
                  onClick={() =>
                    setImportSourceUrl(
                      'https://myanmarfreeislamicbooks.blogspot.com/p/book-list.html?m=0',
                    )
                  }
                  className="px-2.5 py-1 rounded-md border border-[#D4DDD7] dark:border-[#263759] bg-[#F8FAF9] dark:bg-[#131E36] hover:bg-[#EBF4EE] dark:hover:bg-[#1A2A4A] text-[#115E34] dark:text-[#6EE7B7] font-medium disabled:opacity-50"
                >
                  Myanmar Free Islamic Books
                </button>
                <button
                  type="button"
                  disabled={isFetchingCatalog || isImportingBatch}
                  onClick={() =>
                    setImportSourceUrl(
                      'http://library.ioumyanmar.com/search/label/%E1%80%A1%E1%80%85%E1%80%B9%E1%80%85%E1%80%9C%E1%80%AC%E1%80%99%E1%80%BA%E1%80%80%E1%80%AD%E1%80%AF%20%E1%80%9C%E1%80%B1%E1%80%B7%E1%80%9C%E1%80%AC%E1%80%9C%E1%80%AD%E1%80%AF%E1%80%9E%E1%80%B0%E1%80%99%E1%80%BB%E1%80%AC%E1%80%B8%E1%80%A1%E1%80%90%E1%80%BD%E1%80%80%E1%80%BA?m=1',
                    )
                  }
                  className="px-2.5 py-1 rounded-md border border-[#D4DDD7] dark:border-[#263759] bg-[#F8FAF9] dark:bg-[#131E36] hover:bg-[#EBF4EE] dark:hover:bg-[#1A2A4A] text-[#115E34] dark:text-[#6EE7B7] font-medium disabled:opacity-50"
                >
                  IOU Myanmar (အစ္စလာမ်လေ့လာသူများ)
                </button>
                <button
                  type="button"
                  disabled={isFetchingCatalog || isImportingBatch}
                  onClick={() =>
                    setImportSourceUrl('http://library.ioumyanmar.com/')
                  }
                  className="px-2.5 py-1 rounded-md border border-[#D4DDD7] dark:border-[#263759] bg-[#F8FAF9] dark:bg-[#131E36] hover:bg-[#EBF4EE] dark:hover:bg-[#1A2A4A] text-[#115E34] dark:text-[#6EE7B7] font-medium disabled:opacity-50"
                >
                  IOU Myanmar (စာအုပ်အားလုံး)
                </button>
              </div>
            </div>

            {catalogItems.length > 0 && (
              <div className="space-y-4">
                {/* Filter & Batch Controls */}
                <div className="p-4 rounded-xl bg-[#F8FAF9] dark:bg-[#091020] border border-[#E2E8E4] dark:border-[#1E2C4A] space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    <div className="md:col-span-6 relative">
                      <Search className="w-4 h-4 text-[#6B7A70] dark:text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={importSearchQuery}
                        onChange={(e) => setImportSearchQuery(e.target.value)}
                        placeholder={`စာအုပ် ${catalogItems.length} အုပ်ထဲမှ ခေါင်းစဉ်ရှာရန်...`}
                        className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B]"
                      />
                    </div>

                    <div className="md:col-span-6 flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] shrink-0">
                        ကဏ္ဍသတ်မှတ်ချက်:
                      </span>
                      <select
                        value={importCategoryOverride}
                        onChange={(e) =>
                          setImportCategoryOverride(
                            e.target.value as 'auto' | BookCategoryId,
                          )
                        }
                        className="flex-1 min-h-[40px] px-3 py-1.5 text-xs bg-white dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
                      >
                        <option value="auto">
                          စာအုပ်အမည်အလိုက် အလိုအလျောက် ခွဲခြားမည် (Auto)
                        </option>
                        {bookCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nameMy}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isImportingBatch}
                        onClick={() => selectFirstUnimported(10)}
                        className="px-3 py-1.5 rounded-lg border border-[#D4DDD7] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-[#EBF4EE] dark:hover:bg-[#1A2A4A] text-xs font-semibold text-[#115E34] dark:text-[#6EE7B7] disabled:opacity-50"
                      >
                        မတင်ရသေးသည့် ၁၀ အုပ် ရွေးမည်
                      </button>
                      <button
                        type="button"
                        disabled={isImportingBatch}
                        onClick={() => selectFirstUnimported(25)}
                        className="px-3 py-1.5 rounded-lg border border-[#D4DDD7] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-[#EBF4EE] dark:hover:bg-[#1A2A4A] text-xs font-semibold text-[#115E34] dark:text-[#6EE7B7] disabled:opacity-50"
                      >
                        မတင်ရသေးသည့် ၂၅ အုပ် ရွေးမည်
                      </button>
                      <button
                        type="button"
                        disabled={isImportingBatch}
                        onClick={() => selectFirstUnimported('all')}
                        className="px-3 py-1.5 rounded-lg border border-[#D4DDD7] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-[#EBF4EE] dark:hover:bg-[#1A2A4A] text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] disabled:opacity-50"
                      >
                        မြင်နေရသမျှ ရွေးမည် ({filteredCatalogItems.length})
                      </button>
                      {selectedImportCount > 0 && (
                        <button
                          type="button"
                          disabled={isImportingBatch}
                          onClick={() => setSelectedImportUrls({})}
                          className="px-3 py-1.5 rounded-lg border border-[#D4DDD7] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-red-50 dark:hover:bg-red-950/50 text-xs font-medium text-[#5A6860] dark:text-[#94A3B8]"
                        >
                          ရွေးချယ်မှု ဖျက်မည်
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isImportingBatch ? (
                        <button
                          type="button"
                          onClick={() => {
                            importStopRequestedRef.current = true;
                          }}
                          className="min-h-[40px] px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <StopCircle className="w-4 h-4" />
                          <span>လက်ရှိအုပ်ပြီးလျှင် ရပ်မည်</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={selectedImportCount === 0 || !driveToken}
                          onClick={() =>
                            void runBatchImport(
                              catalogItems.filter(
                                (item) => selectedImportUrls[item.postUrl],
                              ),
                            )
                          }
                          className="min-h-[40px] px-4 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                        >
                          <Upload className="w-4 h-4" />
                          <span>
                            ရွေးထားသော {selectedImportCount} အုပ်ကို Drive ထဲထည့်ပြီး Web တင်မည်
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {importProgress && (
                    <div className="space-y-1.5 pt-2 border-t border-[#E2E8E4] dark:border-[#1E2C4A]">
                      <div className="flex items-center justify-between text-xs text-[#115E34] dark:text-[#6EE7B7] font-semibold">
                        <span className="truncate pr-3">
                          ထည့်သွင်းနေသည်: {importProgress.currentTitle}
                        </span>
                        <span className="tabular-nums shrink-0">
                          {importProgress.current} / {importProgress.total}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#DCE6DF] dark:bg-[#1E2C4A] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#146B3A] dark:bg-[#34D399] transition-all duration-300"
                          style={{
                            width: `${Math.round(
                              (importProgress.current / importProgress.total) *
                                100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Catalog Book Rows */}
                <div className="max-h-[540px] overflow-y-auto border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A]">
                  {filteredCatalogItems.map((item) => {
                    const normalizedTitle = item.title
                      .replace(/\s+/g, ' ')
                      .trim()
                      .toLowerCase();
                    const alreadyInLibrary =
                      existingBookTitleSet.has(normalizedTitle);
                    const rowState = importStatuses[item.postUrl];
                    const isSelected = Boolean(
                      selectedImportUrls[item.postUrl],
                    );

                    return (
                      <div
                        key={item.postUrl}
                        className={`p-3 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-[#F4FAF6] dark:bg-[#0D231B]'
                            : 'bg-white dark:bg-[#0D1526]'
                        }`}
                      >
                        <label className="flex items-start sm:items-center gap-3 min-w-0 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            disabled={isImportingBatch}
                            checked={isSelected}
                            onChange={(e) =>
                              setSelectedImportUrls((prev) => ({
                                ...prev,
                                [item.postUrl]: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 mt-0.5 sm:mt-0 accent-[#146B3A] shrink-0"
                          />
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-mono text-[#6B7A70] dark:text-[#94A3B8] tabular-nums">
                                #{item.index}
                              </span>
                              <span className="text-xs sm:text-sm font-semibold text-[#1A241E] dark:text-[#F1F5F9]">
                                {item.title}
                              </span>
                              {alreadyInLibrary && rowState?.status !== 'done' && (
                                <span className="text-[11px] font-semibold text-[#115E34] dark:text-[#6EE7B7]">
                                  · စာကြည့်တိုက်တွင် ရှိပြီး
                                </span>
                              )}
                            </div>

                            {rowState?.status === 'importing' && (
                              <p className="text-[11px] text-[#9B7417] dark:text-[#E2C792] inline-flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Google Drive ထဲသို့ PDF ကူးယူတင်သွင်းနေသည်...</span>
                              </p>
                            )}
                            {rowState?.status === 'done' && (
                              <p className="text-[11px] text-[#115E34] dark:text-[#6EE7B7] inline-flex items-center gap-1 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{rowState.message}</span>
                              </p>
                            )}
                            {rowState?.status === 'error' && (
                              <p className="text-[11px] text-red-700 dark:text-red-400 inline-flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>{rowState.message}</span>
                              </p>
                            )}
                          </div>
                        </label>

                        <div className="flex items-center gap-2 shrink-0 pl-7 sm:pl-0">
                          <a
                            href={item.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-lg border border-[#D4DDD7] dark:border-[#263759] text-[11px] font-medium text-[#526058] dark:text-[#CBD5E1] hover:bg-[#F5F8F6] dark:hover:bg-[#131E36] inline-flex items-center gap-1"
                          >
                            <span>မူရင်း</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            type="button"
                            disabled={isImportingBatch || !driveToken}
                            onClick={() => void runBatchImport([item])}
                            className="px-3 py-1.5 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] hover:bg-[#DCECE1] dark:hover:bg-[#133528] text-[#115E34] dark:text-[#6EE7B7] text-[11px] font-semibold disabled:opacity-50"
                          >
                            Drive ထဲထည့်မည်
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: VISIBILITY & REMOVE UNNECESSARY SECTIONS */}
        {activeTab === 'visibility' && (
          <div className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-7 space-y-7">
            <div>
              <h2 className="text-lg font-bold text-[#1A241E] dark:text-[#F1F5F9] mb-1">
                မလိုအပ်သော ကဏ္ဍနှင့် စာမျက်နှာများ ဖယ်ထုတ် / ပြသမှု စီမံရန်
              </h2>
              <p className="text-sm text-[#4A5850] dark:text-[#94A3B8]">
                အောက်ပါ စာမျက်နှာများနှင့် စာကြည့်တိုက်ကဏ္ဍများထဲမှ မလိုအပ်သည်များကို
                အမှန်ခြစ်ဖြုတ်၍ ဝက်ဘ်ဆိုက်တစ်ခုလုံးမှ ဖယ်ထုတ်ထားနိုင်ပါသည်။
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#115E34] dark:text-[#6EE7B7] border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-2">
                  ဝက်ဘ်ဆိုက် စာမျက်နှာများ (Site Sections)
                </h3>
                <div className="space-y-2">
                  {MANAGEABLE_SECTIONS.map((sec) => {
                    const isVisible = !hiddenSectionsDraft.includes(sec.id);
                    return (
                      <label
                        key={sec.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-[#E2E8E4] dark:border-[#1E2C4A] bg-[#F9FBFA] dark:bg-[#131E36] cursor-pointer"
                      >
                        <span className="text-sm font-medium text-[#1A241E] dark:text-[#F1F5F9]">
                          {sec.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setHiddenSectionsDraft((prev) =>
                                prev.filter((id) => id !== sec.id),
                              );
                            } else {
                              setHiddenSectionsDraft((prev) => [
                                ...prev,
                                sec.id,
                              ]);
                            }
                          }}
                          className="w-4 h-4 accent-[#146B3A]"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-2">
                  <h3 className="text-sm font-bold text-[#1E3A8A] dark:text-[#93C5FD]">
                    စာကြည့်တိုက် ကဏ္ဍများ ({categories.length} ခု)
                  </h3>
                  <button
                    type="button"
                    onClick={onOpenCategoryManager}
                    className="min-h-[34px] px-3 py-1 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#3B82F6] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Category ထပ်ခွဲ / Customize</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {categories.map((cat) => {
                    const isVisible = !hiddenCategoriesDraft.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-[#E2E8E4] dark:border-[#1E2C4A] bg-[#F9FBFA] dark:bg-[#131E36] cursor-pointer gap-2"
                      >
                        <span className="text-xs font-medium text-[#1A241E] dark:text-[#F1F5F9] truncate">
                          {cat.nameMy}
                        </span>
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setHiddenCategoriesDraft((prev) =>
                                prev.filter((id) => id !== cat.id),
                              );
                            } else {
                              setHiddenCategoriesDraft((prev) => [
                                ...prev,
                                cat.id,
                              ]);
                            }
                          }}
                          className="w-4 h-4 accent-[#146B3A] shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#EDF1EE] dark:border-[#1E2C4A]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="hero-desc-editor"
                  className="block text-sm font-bold text-[#115E34] dark:text-[#6EE7B7]"
                >
                  မူလစာမျက်နှာ မိတ်ဆက်စာသား (Hero Description)
                </label>
                <button
                  type="button"
                  onClick={() => setHeroDescDraft(DEFAULT_HERO_DESCRIPTION)}
                  className="text-xs font-semibold text-[#146B3A] dark:text-[#6EE7B7] hover:underline"
                >
                  မူလစာသားအသစ် ပြန်ထည့်ရန်
                </button>
              </div>
              <textarea
                id="hero-desc-editor"
                rows={3}
                value={heroDescDraft}
                onChange={(e) => setHeroDescDraft(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
              />
            </div>

            <button
              type="button"
              disabled={isSavingSettings}
              onClick={() => void handleSaveVisibility()}
              className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {isSavingSettings ? 'သိမ်းဆည်းနေပါသည်...' : 'စီမံချက်များ သိမ်းဆည်းရန်'}
            </button>
          </div>
        )}

        {/* TAB 3: GOOGLE DRIVE STORAGE */}
        {activeTab === 'drive' && (
          <div className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] text-[#146B3A] dark:text-[#6EE7B7] flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                    Google Drive PDF Storage ({siteSettings.driveFolderName})
                  </h2>
                  <p className="text-xs text-[#5A6860] dark:text-[#94A3B8]">
                    Folder ID: {siteSettings.driveFolderId || 'ချိတ်ဆက်ပြီးပါက အလိုအလျောက် ဖန်တီးပေးပါမည်'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!driveToken ? (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#C59B27] text-white text-xs font-semibold"
                  >
                    Google Drive ချိတ်ဆက်ရန်
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMode =
                          driveScopeMode === 'folder' ? 'all' : 'folder';
                        setDriveScopeMode(nextMode);
                        void refreshDriveFiles({
                          scope: nextMode,
                          autoSync: false,
                        });
                      }}
                      disabled={isLoadingDrive}
                      className={`min-h-[40px] px-3.5 py-2 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                        driveScopeMode === 'all'
                          ? 'bg-[#EBF4EE] dark:bg-[#0D231B] border-[#146B3A] dark:border-[#34D399] text-[#115E34] dark:text-[#6EE7B7]'
                          : 'border-[#D4DDD7] dark:border-[#263759] text-[#35433A] dark:text-[#CBD5E1] hover:bg-[#F5F8F6] dark:hover:bg-[#131E36]'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>
                        {driveScopeMode === 'all'
                          ? 'Drive တစ်ခုလုံး ပြနေသည်'
                          : 'Drive တစ်ခုလုံးမှ PDF ရှာရန်'}
                      </span>
                    </button>

                    {driveFiles.some(
                      (f) => !books.some((b) => b.driveFileId === f.id),
                    ) && (
                      <button
                        type="button"
                        onClick={() => void syncDriveFilesToWebsite(driveFiles)}
                        disabled={isLoadingDrive}
                        className="min-h-[40px] px-3.5 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>PDF အသစ်အားလုံး ဝက်ဘ်သို့ တန်းတင်မည်</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void refreshDriveFiles()}
                      disabled={isLoadingDrive}
                      className="min-h-[40px] px-4 py-2 rounded-lg border border-[#D4DDD7] dark:border-[#263759] text-xs font-semibold text-[#115E34] dark:text-[#6EE7B7] hover:bg-[#EBF4EE] dark:hover:bg-[#132920] inline-flex items-center gap-1.5"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`}
                      />
                      <span>ပြန်လည်စစ်ဆေးရန်</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {!driveToken ? (
              <p className="text-sm text-[#4A5850] dark:text-[#94A3B8] py-6 text-center">
                Google Drive ထဲရှိ PDF ဖိုင်များကို ကြည့်ရှုစီမံရန် "Google Drive ချိတ်ဆက်ရန်"
                ခလုတ်ကို နှိပ်ပါ။
              </p>
            ) : driveFiles.length === 0 ? (
              <p className="text-sm text-[#4A5850] dark:text-[#94A3B8] py-6 text-center">
                {driveScopeMode === 'all'
                  ? 'သင့် Google Drive ထဲတွင် PDF ဖိုင် မတွေ့ရှိသေးပါ။'
                  : 'Google Drive ဖိုလ်ဒါထဲတွင် PDF ဖိုင် မရှိသေးပါ။ ("Drive တစ်ခုလုံးမှ PDF ရှာရန်" ဖြင့်လည်း စစ်ဆေးနိုင်ပါသည်)'}
              </p>
            ) : (
                <div className="divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A]">
                  {driveFiles.map((file) => {
                    const matchedBook = books.find(
                      (b) => b.driveFileId === file.id,
                    );
                    return (
                      <div
                        key={file.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#1A241E] dark:text-[#F1F5F9] truncate">
                              {file.name}
                            </p>
                            {matchedBook && (
                              <span className="text-[11px] font-semibold text-[#115E34] dark:text-[#6EE7B7]">
                                · ဝက်ဘ်ပေါ်တွင် {matchedBook.published ? 'တင်ပြီး' : 'ဖျောက်ထား'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#5A6860] dark:text-[#94A3B8] tabular-nums">
                            {formatBytes(file.size)} · ID: {file.id}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {matchedBook ? (
                            <button
                              type="button"
                              onClick={() => {
                                handleEditBook(matchedBook);
                                setActiveTab('books');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] text-[#115E34] dark:text-[#6EE7B7] text-xs font-semibold hover:bg-[#DCECE1] dark:hover:bg-[#133528]"
                            >
                              စာအုပ်အချက်အလက်ပြင်ရန်
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void syncDriveFilesToWebsite([file])}
                              className="px-3 py-1.5 rounded-lg bg-[#146B3A] text-white text-xs font-semibold hover:bg-[#0F522D]"
                            >
                              ဝက်ဘ်သို့ တင်မည်
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setPendingDelete({
                                kind: 'driveFile',
                                id: file.id,
                                label: file.name,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/60"
                          >
                            Drive မှ ဖျက်ရန်
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Drive Folder Name Configurator */}
              <div className="pt-4 border-t border-[#EDF1EE] dark:border-[#1E2C4A] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#115E34] dark:text-[#6EE7B7]">
                  Google Drive ဖိုလ်ဒါ အမည်ပြောင်းလဲရန် (Folder Name Settings)
                </h3>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <input
                    type="text"
                    value={siteSettings.driveFolderName}
                    onChange={async (e) => {
                      if (!user) return;
                      await saveSiteSettings(user.uid, {
                        ...siteSettings,
                        driveFolderName: e.target.value,
                      });
                    }}
                    placeholder="ဥပမာ - Myanmar Muslim Library PDFs"
                    className="flex-1 min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B]"
                  />
                  <button
                    type="button"
                    onClick={() => void refreshDriveFiles()}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    ဖိုလ်ဒါအသစ်ဖြင့် ချိတ်ဆက်ရန်
                  </button>
                </div>
                <p className="text-[11px] text-[#5A6860] dark:text-[#94A3B8] leading-relaxed">
                  ဖိုလ်ဒါအမည် ပြောင်းလဲလိုက်ပါက ဤအမည်ဖြင့် Google Drive တွင် ဖိုလ်ဒါအသစ် အလိုအလျောက် ဖန်တီးပေးမည်ဖြစ်ပြီး စာအုပ်အသစ်များကို ယင်းဖိုလ်ဒါအသစ်ထဲသို့ တင်သွားမည် ဖြစ်ပါသည်။
                </p>
              </div>
              <p className="text-xs text-[#5A6860] dark:text-[#94A3B8] pt-3 border-t border-[#EDF1EE] dark:border-[#1E2C4A] leading-relaxed">
                Google Drive ({siteSettings.driveFolderName}) ဖိုလ်ဒါထဲသို့ PDF ဖိုင်အသစ်များ တိုက်ရိုက်ထည့်သွင်းတိုင်း ဝက်ဘ်ဆိုက်စာကြည့်တိုက်ပေါ်သို့ အလိုအလျောက် Sync လုပ်၍ တင်ပြပေးပါမည်။ ဝက်ဘ်ပေါ်တွင် ခေတ္တမပြလိုပါက စာအုပ်စာရင်းမှ &ldquo;ဖျောက်ရန်&rdquo; ကို နှိပ်နိုင်ပါသည်။
              </p>
            </div>
          )}

        {/* TAB 4: DUAS / VIDEOS / ARTICLES CRUD */}
        {activeTab === 'content' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              {(
                [
                  {id: 'duas', label: `ဒိုအာများ (${duas.length})`},
                  {id: 'videos', label: `ဗီဒီယိုများ (${videos.length})`},
                  {id: 'articles', label: `ဆောင်းပါးများ (${articles.length})`},
                ] as const
              ).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setContentKind(sub.id)}
                  className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold ${
                    contentKind === sub.id
                      ? 'bg-[#146B3A] dark:bg-[#2563EB] text-white'
                      : 'bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] text-[#35433A] dark:text-[#CBD5E1] hover:bg-[#F5F8F6] dark:hover:bg-[#131E36]'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {contentKind === 'duas' && user && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setIsSavingContent(true);
                    try {
                      await createDuaRecord(user.uid, {
                        titleMy: duaTitleMy,
                        titleAr: duaTitleAr,
                        categoryMy: duaCategoryMy,
                        arabic: duaArabic,
                        transliteration: duaTranslit,
                        meaningMy: duaMeaning,
                        source: duaSource,
                      });
                      setDuaTitleMy('');
                      setDuaTitleAr('');
                      setDuaArabic('');
                      setDuaTranslit('');
                      setDuaMeaning('');
                      setDuaSource('');
                      showNotice('success', 'ဒိုအာအသစ် ထည့်သွင်းပြီးပါပြီ။');
                    } catch (err) {
                      showNotice(
                        'error',
                        err instanceof Error
                          ? err.message
                          : 'ဒိုအာသိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
                      );
                    } finally {
                      setIsSavingContent(false);
                    }
                  }}
                  className="lg:col-span-5 bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 space-y-3"
                >
                  <h3 className="text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                    ဒိုအာအသစ် ထည့်သွင်းရန်
                  </h3>
                  <input
                    required
                    value={duaTitleMy}
                    onChange={(e) => setDuaTitleMy(e.target.value)}
                    placeholder="ခေါင်းစဉ် (မြန်မာ)"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <select
                    value={duaCategoryMy}
                    onChange={(e) =>
                      setDuaCategoryMy(e.target.value as DuaItem['categoryMy'])
                    }
                    className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg"
                  >
                    <option value="နေ့စဉ်ဒိုအာ">နေ့စဉ်ဒိုအာ</option>
                    <option value="အထူးအအ်မာလ်">အထူးအအ်မာလ်</option>
                    <option value="မုနာဂျာသ်">မုနာဂျာသ်</option>
                    <option value="ကုရ်အာန်လာဒိုအာ">ကုရ်အာန်လာဒိုအာ</option>
                  </select>
                  <textarea
                    required
                    dir="rtl"
                    rows={3}
                    value={duaArabic}
                    onChange={(e) => setDuaArabic(e.target.value)}
                    placeholder="Arabic text..."
                    className="w-full px-3 py-2 text-base font-[Amiri] bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F3DFB1] placeholder:text-[#64748B] rounded-lg"
                  />
                  <input
                    value={duaTranslit}
                    onChange={(e) => setDuaTranslit(e.target.value)}
                    placeholder="အသံထွက် (Transliteration)"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <textarea
                    required
                    rows={3}
                    value={duaMeaning}
                    onChange={(e) => setDuaMeaning(e.target.value)}
                    placeholder="မြန်မာအနက်အဓိပ္ပာယ် *"
                    className="w-full px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <input
                    value={duaSource}
                    onChange={(e) => setDuaSource(e.target.value)}
                    placeholder="ကျမ်းကိုး (ဥပမာ - စူရဟ် သွာဟာ)"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={isSavingContent}
                    className="w-full min-h-[42px] rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSavingContent ? 'သိမ်းဆည်းနေပါသည်...' : 'ဒိုအာသိမ်းဆည်းရန်'}</span>
                  </button>
                </form>

                <div className="lg:col-span-7 bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A]">
                  {duas.length === 0 ? (
                    <p className="text-sm text-[#5A6860] dark:text-[#94A3B8] py-8 text-center">
                      ဒိုအာ မထည့်သွင်းရသေးပါ။
                    </p>
                  ) : (
                    duas.map((d) => (
                      <div
                        key={d.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-[#9B7417] dark:text-[#E2C792]">{d.categoryMy}</p>
                          <p className="text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9] truncate">
                            {d.titleMy}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              kind: 'dua',
                              id: d.id,
                              label: d.titleMy,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/60"
                        >
                          ဖျက်ရန်
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {contentKind === 'videos' && user && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const trimmedUrl = vidUrl.trim();
                    if (!isValidSafeHttpsUrl(trimmedUrl)) {
                      showNotice(
                        'error',
                        'ဗီဒီယိုလင့်ခ်သည် https:// ဖြင့် စတင်သော မှန်ကန်သည့် URL ဖြစ်ရပါမည်။',
                      );
                      return;
                    }
                    setIsSavingContent(true);
                    try {
                      await createVideoRecord(user.uid, {
                        title: vidTitle,
                        speaker: vidSpeaker,
                        categoryMy: vidCategory,
                        duration: vidDuration,
                        videoUrl: trimmedUrl,
                        description: vidDesc,
                      });
                      setVidTitle('');
                      setVidSpeaker('');
                      setVidDuration('');
                      setVidUrl('');
                      setVidDesc('');
                      showNotice('success', 'ဗီဒီယိုအသစ် ထည့်သွင်းပြီးပါပြီ။');
                    } catch (err) {
                      showNotice(
                        'error',
                        err instanceof Error
                          ? err.message
                          : 'ဗီဒီယိုသိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
                      );
                    } finally {
                      setIsSavingContent(false);
                    }
                  }}
                  className="lg:col-span-5 bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 space-y-3"
                >
                  <h3 className="text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                    ဗီဒီယိုအသစ် ထည့်သွင်းရန်
                  </h3>
                  <input
                    required
                    value={vidTitle}
                    onChange={(e) => setVidTitle(e.target.value)}
                    placeholder="ဗီဒီယိုခေါင်းစဉ် *"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <input
                    required
                    value={vidSpeaker}
                    onChange={(e) => setVidSpeaker(e.target.value)}
                    placeholder="ဟောကြားသူ *"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      value={vidCategory}
                      onChange={(e) => setVidCategory(e.target.value)}
                      placeholder="ကဏ္ဍ"
                      className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                    />
                    <input
                      value={vidDuration}
                      onChange={(e) => setVidDuration(e.target.value)}
                      placeholder="ကြာချိန် (ဥပမာ 25:10)"
                      className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                    />
                  </div>
                  <input
                    required
                    type="url"
                    value={vidUrl}
                    onChange={(e) => setVidUrl(e.target.value)}
                    placeholder="https://... (YouTube / Google Drive Link)"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <textarea
                    rows={3}
                    value={vidDesc}
                    onChange={(e) => setVidDesc(e.target.value)}
                    placeholder="အကြောင်းအရာအကျဉ်း"
                    className="w-full px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={isSavingContent}
                    className="w-full min-h-[42px] rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSavingContent ? 'သိမ်းဆည်းနေပါသည်...' : 'ဗီဒီယိုသိမ်းဆည်းရန်'}</span>
                  </button>
                </form>

                <div className="lg:col-span-7 bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A]">
                  {videos.length === 0 ? (
                    <p className="text-sm text-[#5A6860] dark:text-[#94A3B8] py-8 text-center">
                      ဗီဒီယို မထည့်သွင်းရသေးပါ။
                    </p>
                  ) : (
                    videos.map((v) => (
                      <div
                        key={v.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-[#9B7417] dark:text-[#E2C792]">
                            {v.categoryMy} · {v.speaker}
                          </p>
                          <p className="text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9] truncate">
                            {v.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              kind: 'video',
                              id: v.id,
                              label: v.title,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/60"
                        >
                          ဖျက်ရန်
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {contentKind === 'articles' && user && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setIsSavingContent(true);
                    try {
                      await createArticleRecord(user.uid, {
                        title: artTitle,
                        kicker: artKicker,
                        author: artAuthor,
                        readTime: artReadTime,
                        excerpt: artExcerpt,
                        body: artBody,
                      });
                      setArtTitle('');
                      setArtAuthor('');
                      setArtExcerpt('');
                      setArtBody('');
                      showNotice('success', 'ဆောင်းပါးအသစ် ထည့်သွင်းပြီးပါပြီ။');
                    } catch (err) {
                      showNotice(
                        'error',
                        err instanceof Error
                          ? err.message
                          : 'ဆောင်းပါးသိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
                      );
                    } finally {
                      setIsSavingContent(false);
                    }
                  }}
                  className="lg:col-span-5 bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 space-y-3"
                >
                  <h3 className="text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                    ဆောင်းပါးအသစ် ထည့်သွင်းရန်
                  </h3>
                  <input
                    required
                    value={artTitle}
                    onChange={(e) => setArtTitle(e.target.value)}
                    placeholder="ဆောင်းပါးခေါင်းစဉ် *"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={artKicker}
                      onChange={(e) => setArtKicker(e.target.value)}
                      placeholder="ကဏ္ဍခွဲ"
                      className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                    />
                    <input
                      required
                      value={artAuthor}
                      onChange={(e) => setArtAuthor(e.target.value)}
                      placeholder="ရေးသားသူ *"
                      className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                    />
                  </div>
                  <input
                    value={artReadTime}
                    onChange={(e) => setArtReadTime(e.target.value)}
                    placeholder="ဖတ်ရှုချိန် (ဥပမာ ၅ မိနစ်ဖတ်)"
                    className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <textarea
                    required
                    rows={2}
                    value={artExcerpt}
                    onChange={(e) => setArtExcerpt(e.target.value)}
                    placeholder="အကျဉ်းချုပ် *"
                    className="w-full px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <textarea
                    required
                    rows={5}
                    value={artBody}
                    onChange={(e) => setArtBody(e.target.value)}
                    placeholder="ဆောင်းပါးအပြည့်အစုံ *"
                    className="w-full px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <button
                    type="submit"
                    disabled={isSavingContent}
                    className="w-full min-h-[42px] rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSavingContent ? 'သိမ်းဆည်းနေပါသည်...' : 'ဆောင်းပါးသိမ်းဆည်းရန်'}</span>
                  </button>
                </form>

                <div className="lg:col-span-7 bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A]">
                  {articles.length === 0 ? (
                    <p className="text-sm text-[#5A6860] dark:text-[#94A3B8] py-8 text-center">
                      ဆောင်းပါး မထည့်သွင်းရသေးပါ။
                    </p>
                  ) : (
                    articles.map((a) => (
                      <div
                        key={a.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-[#9B7417] dark:text-[#E2C792]">{a.kicker}</p>
                          <p className="text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9] truncate">
                            {a.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              kind: 'article',
                              id: a.id,
                              label: a.title,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/60"
                        >
                          ဖျက်ရန်
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CONTACT MESSAGES INBOX */}
        {activeTab === 'messages' && (
          <div className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-7 space-y-4">
            <h2 className="text-base font-bold text-[#1A241E] dark:text-[#F1F5F9] border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-3">
              စာဖတ်သူများထံမှ ဆက်သွယ်စာများ ({messages.length})
            </h2>

            {messages.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Mail className="w-9 h-9 text-[#96A49B] dark:text-[#64748B] mx-auto" />
                <p className="text-sm text-[#5A6860] dark:text-[#94A3B8]">
                  ဆက်သွယ်မေးမြန်းစာ မရှိသေးပါ။
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A]">
                {messages.map((msg) => (
                  <div key={msg.id} className="py-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                          {msg.name}{' '}
                          <span className="font-normal text-xs text-[#5A6860] dark:text-[#94A3B8]">
                            ({msg.contact || 'ဆက်သွယ်ရန်မထည့်ပါ'})
                          </span>
                        </p>
                        <p className="text-xs text-[#9B7417] dark:text-[#E2C792]">
                          {msg.subject}
                          {msg.createdAtLabel ? ` · ${msg.createdAtLabel}` : ''}
                          {msg.status === 'unread' ? ' · အသစ်' : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {msg.status === 'unread' && (
                          <button
                            type="button"
                            onClick={() => void markContactMessageRead(msg.id)}
                            className="px-3 py-1 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] text-[#115E34] dark:text-[#6EE7B7] text-xs font-semibold"
                          >
                            ဖတ်ပြီးမှတ်မည်
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              kind: 'message',
                              id: msg.id,
                              label: msg.name,
                            })
                          }
                          className="px-3 py-1 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/60"
                        >
                          ဖျက်ရန်
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-[#35433A] dark:text-[#CBD5E1] leading-relaxed bg-[#F8FAF9] dark:bg-[#131E36] p-3 rounded-lg">
                      {msg.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: FOOTER CONTACT BUTTONS & LIVE LINKS SYNC */}
        {activeTab === 'links' && user && (
          <form
            onSubmit={(e) => void handleSaveContactLinks(e)}
            className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-7 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] text-[#146B3A] dark:text-[#6EE7B7] flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                    Website အောက်ခြေ ဆက်သွယ်ရေး ခလုတ်များနှင့် လင့်ခ်များ (Footer Contact Sync)
                  </h2>
                  <p className="text-xs sm:text-sm text-[#4A5850] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                    အောက်ပါအကွက်များတွင် ဆက်သွယ်လိုသော လင့်ခ်များ ထည့်သွင်းပြီး Sync လုပ်ပါက Website အောက်ခြေအကွက်ထဲရှိ ဆက်သွယ်ရေး Button များထဲသို့ ချက်ချင်းပြောင်းလဲ Sync ပေးပါမည်။ မထည့်လိုသော ခလုတ်ကို အလွတ်ထား၍ ဖျောက်ထားနိုင်ပါသည်။
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setContactLinksError(null);
                  setContactLinksDraft(DEFAULT_CONTACT_LINKS);
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#D4DDD7] dark:border-[#263759] text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] hover:bg-[#F5F8F6] dark:hover:bg-[#131E36] shrink-0"
              >
                မူလလင့်ခ်များ ပြန်ထည့်ရန်
              </button>
            </div>

            {contactLinksError && (
              <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-xs sm:text-sm text-red-700 dark:text-red-300 leading-relaxed">
                {contactLinksError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="footer-link-facebook"
                  className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1.5"
                >
                  Facebook Page / Profile Link
                </label>
                <input
                  id="footer-link-facebook"
                  type="text"
                  value={contactLinksDraft.facebook}
                  onChange={(e) =>
                    setContactLinksDraft((prev) => ({
                      ...prev,
                      facebook: e.target.value,
                    }))
                  }
                  placeholder="https://www.facebook.com/yourpage"
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="footer-link-telegram"
                  className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1.5"
                >
                  Telegram Link သို့မဟုတ် @Username
                </label>
                <input
                  id="footer-link-telegram"
                  type="text"
                  value={contactLinksDraft.telegram}
                  onChange={(e) =>
                    setContactLinksDraft((prev) => ({
                      ...prev,
                      telegram: e.target.value,
                    }))
                  }
                  placeholder="https://t.me/yourchannel သို့မဟုတ် @username"
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="footer-link-youtube"
                  className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1.5"
                >
                  YouTube Channel Link
                </label>
                <input
                  id="footer-link-youtube"
                  type="text"
                  value={contactLinksDraft.youtube}
                  onChange={(e) =>
                    setContactLinksDraft((prev) => ({
                      ...prev,
                      youtube: e.target.value,
                    }))
                  }
                  placeholder="https://www.youtube.com/@yourchannel"
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="footer-link-whatsapp"
                  className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1.5"
                >
                  WhatsApp Link သို့မဟုတ် ဖုန်းနံပါတ် (+959...)
                </label>
                <input
                  id="footer-link-whatsapp"
                  type="text"
                  value={contactLinksDraft.whatsapp}
                  onChange={(e) =>
                    setContactLinksDraft((prev) => ({
                      ...prev,
                      whatsapp: e.target.value,
                    }))
                  }
                  placeholder="https://wa.me/959... သို့မဟုတ် +959..."
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="footer-link-phone"
                  className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1.5"
                >
                  တိုက်ရိုက် ဖုန်းခေါ်ရန် နံပါတ် (Phone)
                </label>
                <div className="relative">
                  <input
                    id="footer-link-phone"
                    type="text"
                    value={contactLinksDraft.phone}
                    onChange={(e) =>
                      setContactLinksDraft((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="+95 9 123 456 789"
                    className="w-full min-h-[42px] pl-9 pr-3.5 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <Phone className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="footer-link-email"
                  className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1.5"
                >
                  ဆက်သွယ်ရန် Email လိပ်စာ
                </label>
                <div className="relative">
                  <input
                    id="footer-link-email"
                    type="email"
                    value={contactLinksDraft.email}
                    onChange={(e) =>
                      setContactLinksDraft((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="contact@example.com"
                    className="w-full min-h-[42px] pl-9 pr-3.5 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="footer-link-website"
                  className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1.5"
                >
                  အခြား Website / Blog Link
                </label>
                <div className="relative">
                  <input
                    id="footer-link-website"
                    type="text"
                    value={contactLinksDraft.website}
                    onChange={(e) =>
                      setContactLinksDraft((prev) => ({
                        ...prev,
                        website: e.target.value,
                      }))
                    }
                    placeholder="https://yourwebsite.com"
                    className="w-full min-h-[42px] pl-9 pr-3.5 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                  <Globe className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="footer-link-github"
                  className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1.5"
                >
                  GitHub Profile Link
                </label>
                <input
                  id="footer-link-github"
                  type="text"
                  value={contactLinksDraft.github}
                  onChange={(e) =>
                    setContactLinksDraft((prev) => ({
                      ...prev,
                      github: e.target.value,
                    }))
                  }
                  placeholder="https://github.com/username"
                  className="w-full min-h-[42px] px-3.5 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                />
              </div>
            </div>

            {/* Active Footer Buttons Preview */}
            <div className="p-4 rounded-xl bg-[#0B152B] border border-[#1D2F57] space-y-2.5">
              <p className="text-[11px] font-semibold text-[#93C5FD]">
                Footer အောက်ခြေတွင် ပေါ်မည့် ခလုတ်များ (Live Preview)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  {key: 'facebook' as const, label: 'Facebook'},
                  {key: 'telegram' as const, label: 'Telegram'},
                  {key: 'youtube' as const, label: 'YouTube'},
                  {key: 'whatsapp' as const, label: 'WhatsApp'},
                  {
                    key: 'phone' as const,
                    label: contactLinksDraft.phone.trim() || 'Phone',
                  },
                  {key: 'email' as const, label: 'Email'},
                  {key: 'website' as const, label: 'Website'},
                  {key: 'github' as const, label: 'GitHub'},
                ]
                  .filter((item) => Boolean(contactLinksDraft[item.key].trim()))
                  .map((item) => (
                    <span
                      key={item.key}
                      className="px-3 py-1.5 rounded-lg bg-[#132242] border border-white/15 text-[#E2E8F0] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" />
                      <span>{item.label}</span>
                    </span>
                  ))}
                <span className="px-3 py-1.5 rounded-lg bg-[#146B3A]/35 border border-[#34D399]/35 text-[#A7F3D0] text-xs font-semibold">
                  စာပို့ဆက်သွယ်ရန်
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#EDF1EE] dark:border-[#1E2C4A]">
              <p className="text-xs text-[#5A6860] dark:text-[#94A3B8]">
                Sync လုပ်ပြီးသည်နှင့် Website အောက်ခြေရှိ ခလုတ်များ အားလုံးထံ ချက်ချင်း အသက်ဝင်ပါမည်။
              </p>
              <button
                type="submit"
                disabled={isSavingContactLinks}
                className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isSavingContactLinks ? 'animate-spin' : ''}`}
                />
                <span>
                  {isSavingContactLinks
                    ? 'Sync လုပ်နေပါသည်...'
                    : 'လင့်ခ်များ သိမ်းဆည်းပြီး Footer သို့ Sync လုပ်မည်'}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* TAB: FATWA CATEGORIES FULL MANAGEMENT */}
        {activeTab === 'fatwaCategories' && user && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] text-[#146B3A] dark:text-[#6EE7B7] flex items-center justify-center shrink-0">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                    ဖသ်ဝါမေးမြန်းရန် ကဏ္ဍများ (Fatwa Categories) စီမံခန့်ခွဲမှု
                  </h2>
                  <p className="text-xs sm:text-sm text-[#4A5850] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                    ဖသ်ဝါစာမျက်နှာတွင် စာဖတ်သူများ ရွေးချယ်မေးမြန်းနိုင်မည့် ကဏ္ဍတစ်ခုချင်းစီကို အသစ်ထည့်ခြင်း၊ ပြင်ဆင်ခြင်း၊ အစဉ်လိုက်စီခြင်းနှင့် ဖျက်သိမ်းခြင်းတို့ကို အပြည့်အဝ စီမံနိုင်ပါသည်။
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {fatwaCategoryDocs.length === 0 && (
                  <button
                    type="button"
                    disabled={isSavingFatwaCat}
                    onClick={() => void handleSeedFatwaDefaults()}
                    className="min-h-[40px] px-4 py-2 rounded-lg border border-[#D4DDD7] dark:border-[#263759] bg-[#F8FAF9] dark:bg-[#131E36] hover:bg-[#EBF4EE] dark:hover:bg-[#1B2A4A] text-xs font-semibold text-[#115E34] dark:text-[#6EE7B7]"
                  >
                    မူလကဏ္ဍ ၆ ခု Sync သိမ်းရန်
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onNavigate('fatwa-admin')}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>
                    ဖသ်ဝါဖြေကြားရန် ({pendingFatwaCount})
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Add / Edit Fatwa Category Form */}
              <form
                onSubmit={(e) => void handleSaveFatwaCategory(e)}
                className="lg:col-span-5 bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-3">
                  <h3 className="text-sm sm:text-base font-bold text-[#115E34] dark:text-[#6EE7B7]">
                    {editingFatwaCatId
                      ? 'ဖသ်ဝါကဏ္ဍ ပြင်ဆင်ရန်'
                      : 'ဖသ်ဝါကဏ္ဍ အသစ်ထည့်ရန်'}
                  </h3>
                  {editingFatwaCatId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFatwaCatId(null);
                        setFatwaCatNameMy('');
                        setFatwaCatNameEn('');
                        setFatwaCatDescMy('');
                        setFatwaCatOrder(0);
                      }}
                      className="text-xs font-semibold text-[#5A6860] dark:text-[#94A3B8] hover:underline"
                    >
                      မပြင်တော့ပါ
                    </button>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="fatwa-cat-name-my"
                    className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1"
                  >
                    ကဏ္ဍအမည် (မြန်မာ) *
                  </label>
                  <input
                    id="fatwa-cat-name-my"
                    type="text"
                    required
                    value={fatwaCatNameMy}
                    onChange={(e) => setFatwaCatNameMy(e.target.value)}
                    placeholder="ဥပမာ - ဝတ်ပြုကိုးကွယ်မှု (အိဗာဒသ်)"
                    className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="fatwa-cat-name-en"
                      className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1"
                    >
                      English Label (URL Slug အတွက်)
                    </label>
                    <input
                      id="fatwa-cat-name-en"
                      type="text"
                      value={fatwaCatNameEn}
                      onChange={(e) => setFatwaCatNameEn(e.target.value)}
                      placeholder="Ibadah & Prayer"
                      className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="fatwa-cat-order"
                      className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1"
                    >
                      အစဉ် (Order)
                    </label>
                    <input
                      id="fatwa-cat-order"
                      type="number"
                      min={0}
                      max={10000}
                      value={fatwaCatOrder}
                      onChange={(e) =>
                        setFatwaCatOrder(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="fatwa-cat-desc"
                    className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1"
                  >
                    အကြောင်းအရာ ရှင်းလင်းချက်
                  </label>
                  <textarea
                    id="fatwa-cat-desc"
                    rows={3}
                    value={fatwaCatDescMy}
                    onChange={(e) => setFatwaCatDescMy(e.target.value)}
                    placeholder="ဤကဏ္ဍထဲတွင် မည်သည့်မေးခွန်းများ မေးမြန်းနိုင်ကြောင်း..."
                    className="w-full px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingFatwaCat}
                  className="w-full min-h-[44px] px-5 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {isSavingFatwaCat
                      ? 'သိမ်းဆည်းနေပါသည်...'
                      : editingFatwaCatId
                        ? 'ပြင်ဆင်မှု သိမ်းဆည်းရန်'
                        : 'ဖသ်ဝါကဏ္ဍအသစ် ထည့်သွင်းမည်'}
                  </span>
                </button>
              </form>

              {/* Fatwa Categories List */}
              <div className="lg:col-span-7 bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A]">
                {fatwaCategories.length === 0 ? (
                  <p className="text-sm text-[#5A6860] dark:text-[#94A3B8] py-8 text-center">
                    ဖသ်ဝါကဏ္ဍ မရှိသေးပါ။ ဘေးဘက်မှ အသစ်ထည့်သွင်းပါ။
                  </p>
                ) : (
                  fatwaCategories.map((cat, idx) => (
                    <div
                      key={cat.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5A6860] dark:text-[#94A3B8]">
                          <span className="font-mono tabular-nums">
                            #{typeof cat.sortOrder === 'number' ? cat.sortOrder : idx}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{cat.id}</span>
                          {cat.nameEn && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{cat.nameEn}</span>
                            </>
                          )}
                        </div>
                        <p className="text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                          {cat.nameMy}
                        </p>
                        {cat.descriptionMy && (
                          <p className="text-xs text-[#5A6860] dark:text-[#94A3B8] line-clamp-2">
                            {cat.descriptionMy}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFatwaCatId(cat.id);
                            setFatwaCatNameMy(cat.nameMy);
                            setFatwaCatNameEn(cat.nameEn);
                            setFatwaCatDescMy(cat.descriptionMy);
                            setFatwaCatOrder(
                              typeof cat.sortOrder === 'number' ? cat.sortOrder : idx,
                            );
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#D4DDD7] dark:border-[#263759] text-[#1E3A8A] dark:text-[#93C5FD] text-xs font-semibold hover:bg-[#EFF3FA] dark:hover:bg-[#131E36] inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>ပြင်ရန်</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              kind: 'fatwaCategory',
                              id: cat.id,
                              label: cat.nameMy,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/60 inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>ဖျက်ရန်</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: ADMIN & TELEGRAM BOT SETTINGS */}
        {activeTab === 'settings' && user && (
          <div className="space-y-6">
            {/* SECTION 1: APPOINT & MANAGE ADMINS */}
            <div className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-7 space-y-5">
              <div className="flex items-start gap-3 border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-4">
                <div className="w-10 h-10 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] text-[#146B3A] dark:text-[#6EE7B7] flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                    နောက်ထပ် Admin ခန့်အပ်ခြင်းနှင့် စီမံခန့်ခွဲခြင်း (Admin Roles)
                  </h2>
                  <p className="text-xs sm:text-sm text-[#4A5850] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                    စာအုပ်တင်ခြင်း၊ Drive စီမံခြင်းနှင့် Telegram Bot Sync လုပ်ငန်းများကို
                    ကူညီစီမံရန် ယုံကြည်စိတ်ချရသော Gmail အကောင့်များကို Admin အဖြစ်
                    ထပ်မံခန့်အပ်နိုင်ပါသည်။
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={(e) => void handleAppointAdmin(e)}
                  className="lg:col-span-5 p-4 sm:p-5 rounded-xl bg-[#F8FAF9] dark:bg-[#091020] border border-[#E2E8E4] dark:border-[#1E2C4A] space-y-3.5"
                >
                  <h3 className="text-sm font-bold text-[#115E34] dark:text-[#6EE7B7]">
                    Admin အသစ် ခန့်အပ်ရန်
                  </h3>

                  <div>
                    <label
                      htmlFor="appoint-admin-email"
                      className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1"
                    >
                      Admin ခန့်အပ်မည့် Gmail / Google Account *
                    </label>
                    <input
                      id="appoint-admin-email"
                      type="email"
                      required
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      className="w-full min-h-[42px] px-3 py-2 text-sm bg-white dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="appoint-admin-role"
                      className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1"
                    >
                      တာဝန် / ရာထူးအမည် (Role Label)
                    </label>
                    <input
                      id="appoint-admin-role"
                      type="text"
                      value={newAdminRoleLabel}
                      onChange={(e) => setNewAdminRoleLabel(e.target.value)}
                      placeholder="ဥပမာ - Library Editor / Librarian"
                      className="w-full min-h-[42px] px-3 py-2 text-sm bg-white dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isAppointingAdmin}
                    className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>
                      {isAppointingAdmin
                        ? 'ခန့်အပ်နေပါသည်...'
                        : 'Admin အဖြစ် ခန့်အပ်မည်'}
                    </span>
                  </button>

                  <p className="text-[11px] text-[#5A6860] dark:text-[#94A3B8] leading-relaxed">
                    ခန့်အပ်လိုက်သော Gmail အကောင့်ဖြင့် ဝက်ဘ်ဆိုက် Admin Panel တွင် Sign in with
                    Google ဝင်ရောက်လိုက်သည်နှင့် Admin စီမံခွင့် အပြည့်အဝ ရရှိပါမည်။
                  </p>
                </form>

                <div className="lg:col-span-7 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#526058] dark:text-[#94A3B8]">
                    လက်ရှိ Admin စာရင်း (မူလ Admin + ခန့်အပ်ထားသူများ)
                  </h3>
                  <div className="border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A]">
                    {[BOOTSTRAPPED_ADMIN_EMAIL, SECOND_BOOTSTRAPPED_ADMIN_EMAIL].map(
                      (email) => (
                        <div
                          key={email}
                          className="p-3.5 flex items-center justify-between gap-3 bg-[#FAFCFB] dark:bg-[#0B1221]"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9] truncate">
                              {email}
                            </p>
                            <p className="text-[11px] text-[#115E34] dark:text-[#6EE7B7] font-semibold">
                              မူလ System Admin (အမြဲတမ်း)
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] text-[#115E34] dark:text-[#6EE7B7] text-[11px] font-semibold shrink-0">
                            Primary
                          </span>
                        </div>
                      ),
                    )}

                    {adminInvites.length === 0 ? (
                      <p className="p-4 text-xs text-[#5A6860] dark:text-[#94A3B8] text-center">
                        ထပ်မံခန့်အပ်ထားသော Admin မရှိသေးပါ။
                      </p>
                    ) : (
                      adminInvites.map((invite) => {
                        const isSelf =
                          (user.email || '').trim().toLowerCase() ===
                          invite.email.trim().toLowerCase();
                        return (
                          <div
                            key={invite.id}
                            className="p-3.5 flex flex-wrap items-center justify-between gap-3"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-sm font-bold text-[#1A241E] dark:text-[#F1F5F9] truncate">
                                {invite.email}
                              </p>
                              <p className="text-[11px] text-[#5A6860] dark:text-[#94A3B8]">
                                {invite.roleLabel || 'Library Admin'}
                                {invite.addedByEmail
                                  ? ` · ခန့်အပ်သူ: ${invite.addedByEmail}`
                                  : ''}
                                {invite.createdAtLabel
                                  ? ` · ${invite.createdAtLabel}`
                                  : ''}
                              </p>
                            </div>
                            {!isSelf ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPendingDelete({
                                    kind: 'adminInvite',
                                    id: invite.email,
                                    label: invite.email,
                                  })
                                }
                                className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/60"
                              >
                                Admin မှ ဖယ်ရှားရန်
                              </button>
                            ) : (
                              <span className="text-[11px] font-semibold text-[#9B7417] dark:text-[#E2C792]">
                                လက်ရှိဝင်ထားသူ
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: PERMANENT TELEGRAM BOT CONNECTION -> GOOGLE DRIVE -> WEBSITE AUTO-SYNC */}
            <div className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-7 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] text-[#146B3A] dark:text-[#6EE7B7] flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                      Telegram Bot ချိတ်ဆက်မှုနှင့် Google Drive / Website အလိုအလျောက် Sync
                    </h2>
                    <p className="text-xs sm:text-sm text-[#4A5850] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                      Telegram Bot ကို ဤဝက်ဘ်ဆိုက်နှင့် အပြီးတိုင် တွဲဆက်ထားပြီး Bot ထံ (သို့) Group/Channel
                      ထဲသို့ ပို့သမျှ PDF စာအုပ်များကို Google Drive ပေါ်သို့ တိုက်ရိုက်တင်ကာ
                      ဝက်ဘ်ဆိုက်စာကြည့်တိုက်ပေါ်သို့ ချက်ချင်း Sync လုပ်ပေးမည် ဖြစ်ပါသည်။
                    </p>
                  </div>
                </div>

                {telegramConfigStatus?.tokenConfigured ? (
                  <span className="px-3.5 py-1.5 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] border border-[#146B3A]/30 dark:border-[#10B981]/30 text-[#115E34] dark:text-[#6EE7B7] text-xs font-bold inline-flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      ချိတ်ဆက်ပြီး (@
                      {telegramConfigStatus.botUsername ||
                        telegramSettings.botUsername ||
                        'TelegramBot'}
                      )
                    </span>
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs font-semibold shrink-0">
                    Telegram Bot မချိတ်ဆက်ရသေးပါ
                  </span>
                )}
              </div>

              {/* Setup Instructions */}
              <div className="rounded-xl bg-[#FDF9EE] dark:bg-[#1E190C] border border-[#C59B27]/35 dark:border-[#C59B27]/40 p-4 space-y-2 text-xs text-[#54400B] dark:text-[#E2C792] leading-relaxed">
                <p className="font-bold text-[#6E500A] dark:text-[#F3DFB1]">
                  Telegram Bot ချိတ်ဆက်ရန် လိုအပ်သည့် အချက်အလက်များနှင့် အဆင့်များ:
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    Telegram တွင် <span className="font-mono font-bold">@BotFather</span> ထံသို့{' '}
                    <span className="font-mono font-semibold">/newbot</span> ပို့၍ Bot အသစ်ဖွင့်ပြီး
                    ရရှိလာသော <strong>Bot API Token</strong> ကို အောက်တွင် ထည့်သွင်းပါ။
                  </li>
                  <li>
                    Group / Channel မှ စာအုပ် PDF များ ဆွဲတင်လိုပါက ယင်း Bot ကို Group/Channel ထဲတွင်{' '}
                    <strong>Admin</strong> အဖြစ် ထည့်ထားပါ (သို့မဟုတ် Group မှ PDF အားလုံး ဖတ်နိုင်ရန်
                    @BotFather တွင် <span className="font-mono font-semibold">/setprivacy → Disable</span>{' '}
                    လုပ်ထားပါ)။
                  </li>
                  <li>
                    <strong>Allowed Chat IDs</strong> ကို အလွတ်ထားပါက Bot ရရှိသမျှ Chat အားလုံးမှ PDF
                    များကို ယူပေးမည်ဖြစ်ပြီး၊ သီးသန့် Group/Channel တစ်ခုတည်းမှ ယူလိုပါက
                    &ldquo;Telegram Chat များ စစ်ဆေးရန်&rdquo; ကိုနှိပ်၍ Chat ID ထည့်သွင်းနိုင်ပါသည်။
                  </li>
                  <li>
                    Telegram Bot API စည်းမျဉ်းအရ PDF ဖိုင် ၁ ဖိုင်လျှင် အများဆုံး{' '}
                    <strong>20 MB – 50 MB</strong> အတွင်းရှိ ဖိုင်များကို စစ်ဆေးပြီး Google Drive
                    ({siteSettings.driveFolderName}) ထဲသို့ တိုက်ရိုက်သိမ်းဆည်းပေးပါမည်။
                  </li>
                </ol>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left: Bot Config Form */}
                <form
                  onSubmit={(e) => void handleSaveTelegramConfig(e)}
                  className="lg:col-span-6 p-4 sm:p-5 rounded-xl bg-[#F8FAF9] dark:bg-[#091020] border border-[#E2E8E4] dark:border-[#1E2C4A] space-y-4"
                >
                  <h3 className="text-sm font-bold text-[#115E34] dark:text-[#6EE7B7]">
                    ၁. Telegram Bot အချက်အလက် ချိတ်ဆက်သိမ်းဆည်းရန်
                  </h3>

                  <div>
                    <label
                      htmlFor="tg-bot-token"
                      className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1"
                    >
                      Telegram Bot API Token{' '}
                      {telegramConfigStatus?.tokenConfigured
                        ? `(သိမ်းဆည်းပြီး: ${telegramConfigStatus.maskedToken})`
                        : '*'}
                    </label>
                    <input
                      id="tg-bot-token"
                      type="password"
                      autoComplete="off"
                      value={telegramTokenInput}
                      onChange={(e) => setTelegramTokenInput(e.target.value)}
                      placeholder={
                        telegramConfigStatus?.tokenConfigured
                          ? 'Token ပြောင်းလိုမှသာ အသစ်ထည့်ပါ (သိမ်းဆည်းပြီးဖြစ်သည်)'
                          : '1234567890:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
                      }
                      className="w-full min-h-[42px] px-3 py-2 text-xs sm:text-sm bg-white dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg font-mono"
                    />
                    <p className="text-[11px] text-[#5A6860] dark:text-[#94A3B8] mt-1">
                      Bot Token ကို Server ဘက်တွင်သာ လုံခြုံစွာ သိမ်းဆည်းထားပြီး အခြားသူများ
                      မြင်တွေ့နိုင်မည် မဟုတ်ပါ။
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label
                        htmlFor="tg-allowed-chats"
                        className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1]"
                      >
                        Allowed Chat IDs (ကော်မာခံ၍ ထည့်နိုင်သည် — မထည့်လည်းရသည်)
                      </label>
                      {telegramConfigStatus?.tokenConfigured && (
                        <button
                          type="button"
                          disabled={isCheckingTelegramChats}
                          onClick={() => void handleCheckTelegramChats()}
                          className="text-[11px] font-bold text-[#146B3A] dark:text-[#6EE7B7] hover:underline disabled:opacity-50"
                        >
                          {isCheckingTelegramChats
                            ? 'စစ်ဆေးနေသည်...'
                            : 'Chat များ စစ်ဆေးရန်'}
                        </button>
                      )}
                    </div>
                    <input
                      id="tg-allowed-chats"
                      type="text"
                      value={telegramAllowedChatsInput}
                      onChange={(e) =>
                        setTelegramAllowedChatsInput(e.target.value)
                      }
                      placeholder="ဥပမာ - -1001234567890, 987654321 (အားလုံးလက်ခံရန် အလွတ်ထားပါ)"
                      className="w-full min-h-[42px] px-3 py-2 text-xs bg-white dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg font-mono"
                    />
                  </div>

                  {discoveredTelegramChats.length > 0 && (
                    <div className="p-3 rounded-lg bg-white dark:bg-[#0D1526] border border-[#D4DDD7] dark:border-[#263759] space-y-2">
                      <p className="text-[11px] font-bold text-[#115E34] dark:text-[#6EE7B7]">
                        တွေ့ရှိထားသော Telegram Chat များ (နှိပ်၍ Chat ID ထည့်နိုင်သည်):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {discoveredTelegramChats.map((chat) => (
                          <button
                            key={chat.chatId}
                            type="button"
                            onClick={() => {
                              const current = telegramAllowedChatsInput
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean);
                              if (!current.includes(chat.chatId)) {
                                setTelegramAllowedChatsInput(
                                  [...current, chat.chatId].join(', '),
                                );
                              }
                            }}
                            className="px-2.5 py-1 rounded-md border border-[#146B3A]/30 dark:border-[#10B981]/30 bg-[#EBF4EE] dark:bg-[#0D231B] hover:bg-[#DCECE1] dark:hover:bg-[#133328] text-[#115E34] dark:text-[#6EE7B7] text-[11px] font-medium"
                          >
                            {chat.title} ({chat.chatId})
                            {chat.pendingPdfCount > 0
                              ? ` · PDF ${chat.pendingPdfCount}`
                              : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="tg-default-cat"
                      className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1"
                    >
                      Website တင်ရာတွင် ထည့်သွင်းမည့် ကဏ္ဍ (Default Category)
                    </label>
                    <select
                      id="tg-default-cat"
                      value={telegramDefaultCatInput}
                      onChange={(e) =>
                        setTelegramDefaultCatInput(
                          e.target.value as 'auto' | BookCategoryId,
                        )
                      }
                      className="w-full min-h-[42px] px-3 py-2 text-xs bg-white dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg"
                    >
                      <option value="auto">
                        စာအုပ်အမည်အလိုက် အလိုအလျောက် ခွဲခြားမည် (Auto)
                      </option>
                      {bookCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameMy}
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2.5 text-xs text-[#1A241E] dark:text-[#F1F5F9] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={telegramAutoSyncInput}
                      onChange={(e) => setTelegramAutoSyncInput(e.target.checked)}
                      className="w-4 h-4 accent-[#146B3A] dark:accent-[#3B82F6]"
                    />
                    <span>
                      Drive ပေါ်ရောက်သည်နှင့် ဝက်ဘ်ဆိုက်စာကြည့်တိုက်ပေါ်သို့ အလိုအလျောက်
                      တန်းတင်မည်
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isSavingTelegram}
                      className="flex-1 min-h-[42px] px-4 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <Bot className="w-4 h-4" />
                      <span>
                        {isSavingTelegram
                          ? 'ချိတ်ဆက်သိမ်းဆည်းနေသည်...'
                          : 'Telegram Bot ချိတ်ဆက်သိမ်းဆည်းမည်'}
                      </span>
                    </button>

                    {telegramConfigStatus?.tokenConfigured && (
                      <button
                        type="button"
                        disabled={isSavingTelegram}
                        onClick={() => void handleDisconnectTelegram()}
                        className="min-h-[42px] px-3.5 py-2 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/60 text-xs font-semibold"
                      >
                        ဖြုတ်သိမ်းရန်
                      </button>
                    )}
                  </div>
                </form>

                {/* Right: Upload to Google Drive + Fast Auto-Sync Control Box */}
                <div className="lg:col-span-6 p-4 sm:p-5 rounded-xl bg-[#F6FAF7] dark:bg-[#091020] border border-[#146B3A]/30 dark:border-[#1E2C4A] space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-[#115E34] dark:text-[#6EE7B7]">
                      ၂. Telegram Bot မှ Google Drive ပေါ်တင်ပြီး Website Sync လုပ်ရန်
                    </h3>
                    <p className="text-xs text-[#4A5850] dark:text-[#94A3B8] leading-relaxed">
                      Telegram Bot ထံ ပို့ထားသော PDF စာအုပ်များကို ခလုတ်တစ်ချက်တည်းဖြင့် သင့်
                      Google Drive ထဲသို့ တိုက်ရိုက်တင်သွင်းပြီး Website တွင် အလိုအလျောက်
                      Sync လုပ်ဖော်ပြပေးပါမည်။
                    </p>
                  </div>

                  {!driveToken && (
                    <div className="p-3.5 rounded-lg bg-[#FDF9EE] dark:bg-[#1E190C] border border-[#C59B27]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <p className="text-xs text-[#6E500A] dark:text-[#F3DFB1]">
                        Drive ပေါ်တင်နိုင်ရန် ဦးစွာ Google Drive ချိတ်ဆက်ပေးပါ။
                      </p>
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={isConnectingAuth}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#C59B27] hover:bg-[#B2891B] text-white text-xs font-semibold inline-flex items-center gap-1.5 shrink-0"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Google Drive ချိတ်ဆက်ရန်</span>
                      </button>
                    </div>
                  )}

                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      disabled={
                        isSyncingTelegramToDrive ||
                        !telegramConfigStatus?.tokenConfigured ||
                        !driveToken
                      }
                      onClick={() => void handleSyncTelegramToDrive()}
                      className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
                    >
                      {isSyncingTelegramToDrive ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Telegram မှ Drive & Website သို့ တင်သွင်းနေသည်...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>
                            Telegram Bot မှ PDF များ Google Drive ပေါ်တင်ပြီး Website Sync
                            လုပ်မည်
                          </span>
                        </>
                      )}
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={
                          isCheckingTelegramChats ||
                          !telegramConfigStatus?.tokenConfigured
                        }
                        onClick={() => void handleCheckTelegramChats()}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#D4DDD7] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-[#EBF4EE] dark:hover:bg-[#1A2947] text-[#115E34] dark:text-[#6EE7B7] text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isCheckingTelegramChats ? 'animate-spin' : ''}`}
                        />
                        <span>
                          Telegram PDF အသစ် စစ်ဆေးရန်
                          {telegramPendingCount !== null
                            ? ` (${telegramPendingCount})`
                            : ''}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={!driveToken}
                        onClick={() =>
                          void refreshDriveFiles({scope: 'folder', autoSync: true})
                        }
                        className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#D4DDD7] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-[#EBF4EE] dark:hover:bg-[#1A2947] text-[#35433A] dark:text-[#CBD5E1] text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Drive → Website အမြန် Sync လုပ်ရန်</span>
                      </button>
                    </div>
                  </div>

                  {/* Continuous Live Auto-Poll Mode */}
                  <div className="p-3.5 rounded-lg bg-white dark:bg-[#0D1526] border border-[#DCE6DF] dark:border-[#1E2C4A] space-y-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={telegramLiveAutoPoll}
                        disabled={
                          !telegramConfigStatus?.tokenConfigured || !driveToken
                        }
                        onChange={(e) =>
                          setTelegramLiveAutoPoll(e.target.checked)
                        }
                        className="w-4 h-4 mt-0.5 accent-[#146B3A] dark:accent-[#3B82F6] shrink-0"
                      />
                      <div className="text-xs space-y-0.5">
                        <p className="font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                          အလိုအလျောက် Continuous Sync ဖွင့်ထားမည် (စက္ကန့် ၈ တိုင်း)
                        </p>
                        <p className="text-[11px] text-[#5A6860] dark:text-[#94A3B8] leading-relaxed">
                          ဤခလုတ် ဖွင့်ထားစဉ် Telegram Bot ထံသို့ PDF ပို့လိုက်သည်နှင့် Google Drive
                          ပေါ်သို့ အော်တိုတင်ပေးပြီး Drive Tool မှလည်း ၅ စက္ကန့်အတွင်း Website
                          ပေါ်သို့ အမြန် Sync လုပ်တင်ပေးနေပါမည်။
                        </p>
                      </div>
                    </label>
                  </div>

                  {lastTelegramSyncResult && (
                    <div className="p-3.5 rounded-lg bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] text-xs space-y-1">
                      <p className="font-bold text-[#115E34] dark:text-[#6EE7B7]">
                        နောက်ဆုံး Sync ရလဒ် ({lastTelegramSyncResult.timestamp})
                      </p>
                      <p className="text-[#35433A] dark:text-[#CBD5E1]">
                        Google Drive တင်ပြီး: {lastTelegramSyncResult.uploadedCount} အုပ် ·
                        Website တင်ပြီး: {lastTelegramSyncResult.publishedCount} အုပ် · ကျော်သွားသည်:{' '}
                        {lastTelegramSyncResult.skippedCount} ခု
                      </p>
                      {lastTelegramSyncResult.errors.length > 0 && (
                        <p className="text-red-700 dark:text-red-300 text-[11px]">
                          သတိပြုရန်: {lastTelegramSyncResult.errors[0]}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 3: GOOGLE SEARCH CONSOLE & SEO STATUS */}
            <div className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-7 space-y-5">
              <div className="flex items-start gap-3 border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-4">
                <div className="w-10 h-10 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] text-[#146B3A] dark:text-[#6EE7B7] flex items-center justify-center shrink-0">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                    Google Search Console &amp; SEO (Google တွင် ရှာတွေ့စေရန်)
                  </h2>
                  <p className="text-xs sm:text-sm text-[#4A5850] dark:text-[#94A3B8] mt-0.5 leading-relaxed">
                    သင့်ဝဘ်ဆိုက်ကို Google Search နှင့် AI များ ရှာတွေ့နိုင်ရန် SEO Title၊
                    မြန်မာ+အင်္ဂလိပ် Meta Description၊ OpenGraph ပုံ၊ Schema.org
                    Structured Data၊ <code className="font-mono">/sitemap.xml</code> နှင့်{' '}
                    <code className="font-mono">/robots.txt</code> များကို
                    အလိုအလျောက် တပ်ဆင်ပေးထားပြီးဖြစ်ပါသည်။
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-3 p-4 rounded-xl bg-[#F8FAF9] dark:bg-[#091020] border border-[#E2E8E4] dark:border-[#1E2C4A]">
                  <h3 className="text-sm font-bold text-[#115E34] dark:text-[#6EE7B7]">
                    Google Search Console တွင် တင်သွင်းရန် လင့်ခ်များ
                  </h3>

                  <div className="space-y-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#0D1526] border border-[#DCE6DF] dark:border-[#1E2C4A] space-y-1">
                      <span className="font-semibold text-[#526058] dark:text-[#94A3B8]">
                        1. URL Prefix (ဝဘ်ဆိုက်ပင်မလင့်ခ်)
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate font-mono text-[#1A241E] dark:text-[#F1F5F9]">
                          {seoCanonicalOriginInput}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopySeoValue('origin', seoCanonicalOriginInput)
                          }
                          className="px-2.5 py-1 rounded border border-[#D4DDD7] dark:border-[#263759] bg-[#F8FAF9] dark:bg-[#131E36] hover:bg-[#EBF4EE] dark:hover:bg-[#1A2947] text-[#115E34] dark:text-[#6EE7B7] font-semibold inline-flex items-center gap-1 shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedSeoKey === 'origin' ? 'ကူးပြီး' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#0D1526] border border-[#DCE6DF] dark:border-[#1E2C4A] space-y-1">
                      <span className="font-semibold text-[#526058] dark:text-[#94A3B8]">
                        2. Sitemap URL (စာမျက်နှာနှင့် စာအုပ်အားလုံးစာရင်း)
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate font-mono text-[#1A241E] dark:text-[#F1F5F9]">
                          {`${seoCanonicalOriginInput.replace(/\/$/, '')}/sitemap.xml`}
                        </code>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopySeoValue(
                              'sitemap',
                              `${seoCanonicalOriginInput.replace(/\/$/, '')}/sitemap.xml`,
                            )
                          }
                          className="px-2.5 py-1 rounded border border-[#D4DDD7] dark:border-[#263759] bg-[#F8FAF9] dark:bg-[#131E36] hover:bg-[#EBF4EE] dark:hover:bg-[#1A2947] text-[#115E34] dark:text-[#6EE7B7] font-semibold inline-flex items-center gap-1 shrink-0"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedSeoKey === 'sitemap' ? 'ကူးပြီး' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-3 pt-1">
                        <a
                          href="/sitemap.xml"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-[#146B3A] dark:text-[#6EE7B7] hover:underline inline-flex items-center gap-1"
                        >
                          <span>sitemap.xml စစ်ကြည့်ရန်</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <a
                          href="/robots.txt"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-[#146B3A] dark:text-[#6EE7B7] hover:underline inline-flex items-center gap-1"
                        >
                          <span>robots.txt စစ်ကြည့်ရန်</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#EBF4EE]/60 dark:bg-[#0D231B] border border-[#C7DED0] dark:border-[#10B981]/30 text-[#115E34] dark:text-[#6EE7B7] space-y-1 leading-relaxed">
                      <p className="font-bold">တပ်ဆင်ပြီးသား SEO စနစ်များ:</p>
                      <p>✓ Bilingual Title &amp; Meta Description (MY/EN)</p>
                      <p>✓ OpenGraph &amp; Twitter Share Card (/og-cover.jpg)</p>
                      <p>✓ Schema.org WebSite + Library + SearchAction JSON-LD</p>
                      <p>✓ Clean URL Routing + Dynamic Live Book Sitemap</p>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={(e) => void handleSaveSeoConfig(e)}
                  className="lg:col-span-7 p-4 sm:p-5 rounded-xl bg-[#F8FAF9] dark:bg-[#091020] border border-[#E2E8E4] dark:border-[#1E2C4A] space-y-3.5"
                >
                  <h3 className="text-sm font-bold text-[#115E34] dark:text-[#6EE7B7]">
                    Google Search Console ပိုင်ရှင်အတည်ပြုချက် (Verify Ownership)
                  </h3>

                  <div>
                    <label
                      htmlFor="seo-canonical-origin"
                      className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1"
                    >
                      ဝဘ်ဆိုက် Domain URL (Vercel / Custom Domain)
                    </label>
                    <input
                      id="seo-canonical-origin"
                      type="url"
                      value={seoCanonicalOriginInput}
                      onChange={(e) => setSeoCanonicalOriginInput(e.target.value)}
                      placeholder="https://islamiclibrary-three.vercel.app"
                      className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm bg-white dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="seo-google-meta-token"
                      className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1"
                    >
                      Google Verification HTML Tag (သို့) content ကုဒ် (Optional)
                    </label>
                    <input
                      id="seo-google-meta-token"
                      type="text"
                      value={seoMetaTokenInput}
                      onChange={(e) => setSeoMetaTokenInput(e.target.value)}
                      placeholder='<meta name="google-site-verification" content="abc..." />'
                      className="w-full min-h-[40px] px-3 py-2 text-xs bg-white dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="seo-google-html-file"
                      className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1"
                    >
                      Google HTML Verification ဖိုင်နာမည် (Optional)
                    </label>
                    <input
                      id="seo-google-html-file"
                      type="text"
                      value={seoHtmlFilenameInput}
                      onChange={(e) => setSeoHtmlFilenameInput(e.target.value)}
                      placeholder="google1234abcd5678ef.html"
                      className="w-full min-h-[40px] px-3 py-2 text-xs bg-white dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingSeoConfig}
                    className="min-h-[42px] px-4 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isSavingSeoConfig ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>သိမ်းဆည်းနေပါသည်...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Google Verification ကုဒ် သိမ်းဆည်းမည်</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-[#5A6860] dark:text-[#94A3B8] leading-relaxed">
                    မှတ်ချက် - Vercel Static Build ပေါ်တွင် တင်ထားပါက Google Search Console
                    မှရရှိသော HTML Tag ကုဒ် (သို့) <code className="font-mono">google...html</code>{' '}
                    ဖိုင်နာမည်ကို Chat ထဲတွင် ပေးပို့လိုက်ပါက ဝဘ်ဆိုက် Code ထဲသို့
                    တိုက်ရိုက်ထည့်သွင်းပေးပါမည်။
                  </p>
                </form>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Dedicated Book Edit Modal */}
      {editModalBookId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          onClick={() => !isSavingEditModal && setEditModalBookId(null)}
        >
          <form
            onSubmit={(e) => void handleSaveEditModal(e)}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl my-auto max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EBF4EE] dark:bg-[#0D231B] text-[#146B3A] dark:text-[#6EE7B7] flex items-center justify-center shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                  စာအုပ်အချက်အလက် ပြင်ဆင်ရန်
                </h3>
              </div>
              <button
                type="button"
                disabled={isSavingEditModal}
                onClick={() => setEditModalBookId(null)}
                className="text-xs font-semibold text-[#5A6860] dark:text-[#94A3B8] hover:text-[#1A241E] dark:hover:text-[#F1F5F9] px-2 py-1"
              >
                ပိတ်ရန်
              </button>
            </div>

            {editModalError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300 leading-relaxed">
                {editModalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                စာအုပ်အမည် *
              </label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={`w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg ${getScriptFontClass(editTitle)}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                စာရေးဆရာ / ပြုစုသူ
              </label>
              <input
                type="text"
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                placeholder="စာရေးဆရာအမည် (မပါလျှင် အလွတ်ထားနိုင်သည်)"
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1]">
                    ကဏ္ဍ (Category)
                  </label>
                  <button
                    type="button"
                    onClick={onOpenCategoryManager}
                    className="text-[11px] font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Customize</span>
                  </button>
                </div>
                <select
                  value={editCategoryId}
                  onChange={(e) =>
                    setEditCategoryId(e.target.value as BookCategoryId)
                  }
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg"
                >
                  {bookCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameMy}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                  အမျိုးအစား (Type)
                </label>
                <select
                  value={editType}
                  onChange={(e) =>
                    setEditType(
                      e.target.value as Exclude<MaterialType, 'All Types'>,
                    )
                  }
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg"
                >
                  <option value="Book">Book</option>
                  <option value="Periodical">Periodical</option>
                  <option value="Research">Research</option>
                  <option value="Dua">Dua</option>
                  <option value="Timetable">Timetable</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                  ခုနှစ်
                </label>
                <input
                  type="text"
                  value={editHijriYear}
                  onChange={(e) => setEditHijriYear(e.target.value)}
                  className="w-full min-h-[40px] px-2.5 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                  စာမျက်နှာ
                </label>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={editPages}
                  onChange={(e) => setEditPages(Number(e.target.value) || 0)}
                  className="w-full min-h-[40px] px-2.5 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                  ဖိုင်အရွယ်အစား
                </label>
                <input
                  type="text"
                  value={editFileSize}
                  onChange={(e) => setEditFileSize(e.target.value)}
                  placeholder="PDF"
                  className="w-full min-h-[40px] px-2.5 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                  အရောင်ဒီဇိုင်း
                </label>
                <select
                  value={editCoverTheme}
                  onChange={(e) =>
                    setEditCoverTheme(
                      e.target.value as BookItem['coverTheme'],
                    )
                  }
                  className="w-full min-h-[40px] px-2 py-1.5 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg"
                >
                  <option value="emerald">Emerald</option>
                  <option value="gold">Gold</option>
                  <option value="teal">Teal</option>
                  <option value="burgundy">Burgundy</option>
                  <option value="slate">Slate</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1]">
                  Google Drive File ID သို့မဟုတ် Share Link *
                </label>
                {driveToken && (
                  <label className="text-[11px] font-bold text-[#146B3A] dark:text-[#6EE7B7] hover:underline cursor-pointer inline-flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    <span>
                      {isUploadingReplacementPdf
                        ? 'PDF တင်နေသည်...'
                        : 'PDF အသစ် အစားထိုးတင်ရန်'}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      disabled={isUploadingReplacementPdf}
                      onChange={(e) => void handleReplacePdfInEditModal(e)}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
              <input
                type="text"
                required
                value={editDriveFileId}
                onChange={(e) =>
                  setEditDriveFileId(extractDriveFileId(e.target.value))
                }
                className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                အကျဉ်းချုပ်မိတ်ဆက်
              </label>
              <textarea
                rows={3}
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="စာအုပ်အကြောင်း အကျဉ်းချုပ်..."
                className="w-full px-3 py-2 text-sm bg-[#F8FAF9] dark:bg-[#131E36] border border-[#D4DDD7] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
              />
            </div>

            <label className="flex items-center gap-2.5 text-sm text-[#1A241E] dark:text-[#F1F5F9] cursor-pointer">
              <input
                type="checkbox"
                checked={editPublished}
                onChange={(e) => setEditPublished(e.target.checked)}
                className="w-4 h-4 accent-[#146B3A] dark:accent-[#3B82F6]"
              />
              <span>ဝက်ဘ်ဆိုက်တွင် တိုက်ရိုက်ဖော်ပြမည် (Published)</span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EDF1EE] dark:border-[#1E2C4A]">
              <button
                type="button"
                disabled={isSavingEditModal || isUploadingReplacementPdf}
                onClick={() => setEditModalBookId(null)}
                className="min-h-[42px] px-4 py-2 rounded-lg border border-[#D4DDD7] dark:border-[#263759] text-xs sm:text-sm font-semibold text-[#35433A] dark:text-[#CBD5E1] hover:bg-[#F5F8F6] dark:hover:bg-[#131E36]"
              >
                မပြင်တော့ပါ
              </button>
              <button
                type="submit"
                disabled={isSavingEditModal || isUploadingReplacementPdf}
                className="min-h-[42px] px-5 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs sm:text-sm font-semibold disabled:opacity-60"
              >
                {isSavingEditModal ? 'သိမ်းဆည်းနေပါသည်...' : 'ပြင်ဆင်မှု သိမ်းဆည်းရန်'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Explicit Confirmation Modal for Destructive Operations */}
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeleting && setPendingDelete(null)}
        >
          <div
            className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                  ဖျက်သိမ်းရန် အတည်ပြုပါ
                </h3>
                <p className="text-sm text-[#4A5850] dark:text-[#94A3B8] mt-1 leading-relaxed">
                  “{pendingDelete.label}” ကို အပြီးတိုင် ဖျက်သိမ်းရန် သေချာပါသလား။
                  ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ပြင်ဆင်၍ မရပါ။
                </p>
              </div>
            </div>

            {pendingDelete.kind === 'book' &&
              pendingDelete.driveFileId &&
              driveToken && (
                <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#F8FAF9] dark:bg-[#131E36] border border-[#E2E8E4] dark:border-[#263759] text-xs text-[#1A241E] dark:text-[#F1F5F9] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alsoDeleteFromDrive}
                    onChange={(e) => setAlsoDeleteFromDrive(e.target.checked)}
                    className="w-4 h-4 accent-red-600"
                  />
                  <span>
                    Google Drive ထဲရှိ PDF ဖိုင်ကိုပါ တစ်ပါတည်း ဖျက်သိမ်းမည်
                  </span>
                </label>
              )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPendingDelete(null)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-[#D4DDD7] dark:border-[#263759] text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] hover:bg-[#F5F8F6] dark:hover:bg-[#131E36]"
              >
                မဖျက်တော့ပါ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void executeConfirmedDelete()}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                {isDeleting ? 'ဖျက်နေပါသည်...' : 'အတည်ပြု ဖျက်သိမ်းမည်'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
