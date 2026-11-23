import {useEffect, useMemo, useRef, useState} from 'react';
import {User} from 'firebase/auth';
import {
  AlertTriangle,
  BookPlus,
  Check,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  HardDrive,
  Inbox,
  LayoutGrid,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Shield,
  Sliders,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  CATEGORIES,
  DEFAULT_HERO_DESCRIPTION,
  MANAGEABLE_SECTIONS,
} from '../data/libraryData';
import {
  createArticleRecord,
  createBookRecord,
  createDuaRecord,
  createVideoRecord,
  deleteArticleRecord,
  deleteBookRecord,
  deleteContactMessage,
  deleteDuaRecord,
  deleteVideoRecord,
  markContactMessageRead,
  saveSiteSettings,
  subscribeContactMessages,
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
  ArticleItem,
  BookCategoryId,
  BookItem,
  ContactMessageItem,
  DriveFileSummary,
  DuaItem,
  MaterialType,
  SiteSettings,
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
  duas: DuaItem[];
  videos: VideoItem[];
  articles: ArticleItem[];
  siteSettings: SiteSettings;
}

type AdminTab = 'books' | 'visibility' | 'drive' | 'content' | 'messages';

interface PendingDelete {
  kind: 'book' | 'dua' | 'video' | 'article' | 'driveFile' | 'message';
  id: string;
  label: string;
  driveFileId?: string;
}

const BOOK_CATEGORIES = CATEGORIES.filter(
  (c) => c.id !== 'videos',
) as Array<{id: BookCategoryId; nameMy: string}>;

export function AdminPanelView({
  user,
  isAdmin,
  authLoading,
  driveToken,
  onSignInGoogle,
  onSignOut,
  books,
  duas,
  videos,
  articles,
  siteSettings,
}: AdminPanelViewProps) {
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
  }, [siteSettings]);

  useEffect(() => {
    if (!isAdmin) {
      setMessages([]);
      return;
    }
    const unsub = subscribeContactMessages(setMessages);
    return () => unsub();
  }, [isAdmin]);

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
      for (const file of files) {
        if (!file.id || !isValidDriveFileId(file.id)) continue;
        if (knownDriveIdsRef.current.has(file.id)) continue;

        knownDriveIdsRef.current.add(file.id);
        await makeDriveFilePublicReadable(driveToken, file.id).catch(() => {});

        const inferred = inferBookMetadataFromFileName(file.name);
        const catObj = BOOK_CATEGORIES.find((c) => c.id === inferred.categoryId);
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
    }, 20000);
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
        const catObj = BOOK_CATEGORIES.find(
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

      const catObj = BOOK_CATEGORIES.find((c) => c.id === resolvedCategoryId);
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
          categoryId: resolvedCategoryId,
          categoryLabel: catObj?.nameMy || '',
          type: bookType,
          hijriYear: bookHijriYear,
          pages: bookPages,
          fileSize: resolvedFileSize || 'PDF',
          summary: bookSummary,
          driveFileId: normalizedDriveId,
          driveViewUrl: urls.driveViewUrl,
          driveDownloadUrl: urls.driveDownloadUrl,
          coverTheme: bookCoverTheme,
          published: bookPublished,
        });
        showNotice('success', 'စာအုပ်အချက်အလက်ကို ပြင်ဆင်သိမ်းဆည်းပြီးပါပြီ။');
      } else {
        knownDriveIdsRef.current.add(normalizedDriveId);
        await createBookRecord(user.uid, {
          title: resolvedTitle,
          author: resolvedAuthor,
          categoryId: resolvedCategoryId,
          categoryLabel: catObj?.nameMy || '',
          type: bookType,
          hijriYear: bookHijriYear,
          pages: bookPages,
          fileSize: resolvedFileSize || 'PDF',
          summary: bookSummary,
          driveFileId: normalizedDriveId,
          driveViewUrl: urls.driveViewUrl,
          driveDownloadUrl: urls.driveDownloadUrl,
          coverTheme: bookCoverTheme,
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
      showNotice(
        'error',
        err instanceof Error ? err.message : 'စာအုပ်သိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      );
    } finally {
      setIsSavingBook(false);
    }
  };

  const handleEditBook = (book: BookItem) => {
    setEditingBookId(book.id);
    setBookTitle(book.title);
    setBookAuthor(book.author);
    setBookCategoryId(book.categoryId);
    setBookType(book.type);
    setBookHijriYear(book.hijriYear);
    setBookPages(book.pages);
    setBookFileSize(book.fileSize);
    setBookSummary(book.summary);
    setBookDriveFileId(book.driveFileId);
    setBookCoverTheme(book.coverTheme);
    setBookPublished(book.published);
    window.scrollTo({top: 0, behavior: 'smooth'});
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

  const unreadMessageCount = useMemo(
    () => messages.filter((m) => m.status === 'unread').length,
    [messages],
  );

  // Loading state
  if (authLoading) {
    return (
      <div className="max-w-[900px] mx-auto px-4 py-16 text-center text-sm text-[#5A6860]">
        စနစ်ကို စစ်ဆေးနေပါသည်...
      </div>
    );
  }

  // Not signed in -> Official Google Sign-In UI
  if (!user) {
    return (
      <div className="max-w-[560px] mx-auto px-4 py-14 sm:py-20">
        <div className="bg-white border border-[#E2E8E4] rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-[#EBF4EE] text-[#146B3A] flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#1A241E]">
              Admin Panel သို့ ဝင်ရောက်ရန်
            </h1>
            <p className="text-sm text-[#4A5850] leading-relaxed">
              စာအုပ် PDF များကို Google Drive ထဲသို့ တင်သွင်းရန်၊ မလိုအပ်သော ကဏ္ဍများကို
              ဖယ်ထုတ်စီမံရန်နှင့် ဝက်ဘ်ဆိုက်တစ်ခုလုံးကို ထိန်းချုပ်ရန် Admin Google Account
              ဖြင့် ဝင်ရောက်ပါ။
            </p>
          </div>

          {statusBanner && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 text-left">
              {statusBanner.text}
            </div>
          )}

          <div className="flex justify-center pt-1">
            <button
              type="button"
              disabled={isConnectingAuth}
              onClick={handleGoogleLogin}
              className="inline-flex items-center gap-3 px-5 py-2.5 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-[#3C4043] font-medium text-sm shadow-xs transition-colors disabled:opacity-60"
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
        <div className="bg-white border border-[#E2E8E4] rounded-2xl p-6 sm:p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-[#C59B27] mx-auto" />
          <h1 className="text-lg font-bold text-[#1A241E]">
            Admin ခွင့်ပြုချက် မရှိပါ
          </h1>
          <p className="text-sm text-[#4A5850]">
            လက်ရှိ ဝင်ရောက်ထားသော အကောင့် ({user.email}) သည် Admin အဖြစ်
            သတ်မှတ်ထားခြင်း မရှိပါ။ Admin အကောင့်ဖြင့် ပြန်လည်ဝင်ရောက်ပါ။
          </p>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="px-4 py-2 rounded-lg bg-[#146B3A] text-white text-sm font-semibold hover:bg-[#0F522D]"
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
        <div className="relative max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#E8C868] mb-1">
              ADMINISTRATION & GOOGLE DRIVE PDF STORAGE
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Admin Panel — စာကြည့်တိုက် စီမံခန့်ခွဲမှု
            </h1>
            <p className="text-xs sm:text-sm text-[#DCEAE1] mt-1">
              ဝင်ရောက်ထားသူ: {user.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!driveToken ? (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isConnectingAuth}
                className="min-h-[42px] px-4 py-2 rounded-lg bg-[#C59B27] hover:bg-[#B2891B] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors"
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
                <Check className="w-4 h-4 text-[#E8C868]" />
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

      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {statusBanner && (
          <div
            className={`p-4 rounded-xl border text-sm space-y-3 ${
              statusBanner.type === 'success'
                ? 'bg-[#EBF4EE] border-[#146B3A]/30 text-[#115E34]'
                : 'bg-red-50 border-red-200 text-red-800'
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
              <div className="pt-2 border-t border-red-200/80 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={driveActivationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[38px] px-3.5 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>Google Drive API ဖွင့်ရန် (Google Cloud Console)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => void refreshDriveFiles()}
                    disabled={isLoadingDrive}
                    className="min-h-[38px] px-3.5 py-2 rounded-lg bg-white border border-red-300 text-red-800 hover:bg-red-100/60 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`}
                    />
                    <span>ပြန်လည်စစ်ဆေးရန်</span>
                  </button>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">
                  မှတ်ချက် — Google Drive API မဖွင့်ရသေးမီကြားကာလတွင်လည်း Google Drive မှ PDF ဖိုင်၏ Share Link
                  (Anyone with the link) ကို အောက်ပါ &ldquo;Google Drive File ID သို့မဟုတ် Share Link&rdquo; အကွက်ထဲသို့ တိုက်ရိုက်ကူးထည့်၍ စာအုပ်တင်နိုင်ပါသည်။
                </p>
              </div>
            )}
          </div>
        )}

        {/* Admin Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#E2E8E4]">
          {[
            {id: 'books' as const, label: `စာအုပ်နှင့် PDF (${books.length})`, icon: BookPlus},
            {id: 'visibility' as const, label: 'ကဏ္ဍဖယ်ထုတ် / ပြသမှု', icon: Sliders},
            {id: 'drive' as const, label: 'Google Drive သိုလှောင်ခန်း', icon: HardDrive},
            {id: 'content' as const, label: 'ဒိုအာ · ဗီဒီယို · ဆောင်းပါး', icon: LayoutGrid},
            {
              id: 'messages' as const,
              label: `ဆက်သွယ်စာများ (${unreadMessageCount})`,
              icon: Inbox,
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
                    ? 'border-[#146B3A] text-[#115E34] bg-white'
                    : 'border-transparent text-[#526058] hover:text-[#115E34]'
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
              className="lg:col-span-5 bg-white border border-[#E2E8E4] rounded-xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#EDF1EE] pb-3">
                <h2 className="text-base font-bold text-[#1A241E]">
                  {editingBookId ? 'စာအုပ်အချက်အလက် ပြင်ဆင်ရန်' : 'PDF စာအုပ်အသစ် တင်ရန်'}
                </h2>
                {editingBookId && (
                  <button
                    type="button"
                    onClick={resetBookForm}
                    className="text-xs font-semibold text-[#9B7417] hover:underline"
                  >
                    အသစ်ပြန်စရန်
                  </button>
                )}
              </div>

              {/* Direct Google Drive PDF Upload Box */}
              <div className="rounded-xl border border-dashed border-[#146B3A]/45 bg-[#F6FAF7] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-[#115E34]">
                      ၁. PDF ဖိုင်ကို Google Drive သို့ တင်သွင်းပါ
                    </p>
                    <p className="text-[11.5px] text-[#4A5850]">
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
                    <div className="w-full h-2 bg-[#DCE6DF] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#146B3A] transition-all duration-200"
                        style={{width: `${uploadProgress}%`}}
                      />
                    </div>
                    <p className="text-[11px] text-[#115E34] tabular-nums">
                      Google Drive Upload: {uploadProgress}%
                    </p>
                  </div>
                )}

                {driveFiles.length > 0 && (
                  <div className="space-y-2">
                    <label
                      htmlFor="pick-existing-drive-pdf"
                      className="block text-[11px] font-semibold text-[#4A5850]"
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
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-white border border-[#D4DDD7] rounded-lg"
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
                <label className="block text-xs font-semibold text-[#35433A] mb-1">
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
                  className="w-full min-h-[42px] px-3 py-2 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg font-mono"
                />
                <p className="text-[11px] text-[#5A6860] mt-1">
                  Drive ချိတ်ဆက်ထားပါက Link ထည့်ရုံဖြင့် စာအုပ်အမည်နှင့် ဖိုင်အရွယ်အစားကို Drive မှ တိုက်ရိုက်ဆွဲယူပေးပါမည်
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#35433A] mb-1">
                  စာအုပ်အမည် {driveToken ? '(Drive မှ အလိုအလျောက် ယူနိုင်သည်)' : '*'}
                </label>
                <input
                  type="text"
                  required={!driveToken}
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="မထည့်ပါက Google Drive ဖိုင်အမည်အတိုင်း တင်ပေးပါမည်"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#35433A] mb-1">
                  စာရေးဆရာ / ပြုစုသူ (မပါလည်း တင်နိုင်သည်)
                </label>
                <input
                  type="text"
                  value={bookAuthor}
                  onChange={(e) => setBookAuthor(e.target.value)}
                  placeholder="စာရေးဆရာအမည် (မပါလျှင် အလွတ်ထားနိုင်သည်)"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#35433A] mb-1">
                    ကဏ္ဍ (Category)
                  </label>
                  <select
                    value={bookCategoryId}
                    onChange={(e) =>
                      setBookCategoryId(e.target.value as BookCategoryId)
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  >
                    {BOOK_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameMy}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#35433A] mb-1">
                    အမျိုးအစား (Type)
                  </label>
                  <select
                    value={bookType}
                    onChange={(e) =>
                      setBookType(
                        e.target.value as Exclude<MaterialType, 'All Types'>,
                      )
                    }
                    className="w-full min-h-[42px] px-3 py-2 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
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
                  <label className="block text-xs font-semibold text-[#35433A] mb-1">
                    ခုနှစ်
                  </label>
                  <input
                    type="text"
                    value={bookHijriYear}
                    onChange={(e) => setBookHijriYear(e.target.value)}
                    className="w-full min-h-[40px] px-2.5 py-1.5 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#35433A] mb-1">
                    စာမျက်နှာ
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={bookPages}
                    onChange={(e) => setBookPages(Number(e.target.value))}
                    className="w-full min-h-[40px] px-2.5 py-1.5 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#35433A] mb-1">
                    အရောင်ဒီဇိုင်း
                  </label>
                  <select
                    value={bookCoverTheme}
                    onChange={(e) =>
                      setBookCoverTheme(
                        e.target.value as BookItem['coverTheme'],
                      )
                    }
                    className="w-full min-h-[40px] px-2 py-1.5 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
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
                <label className="block text-xs font-semibold text-[#35433A] mb-1">
                  အကျဉ်းချုပ်မိတ်ဆက်
                </label>
                <textarea
                  rows={3}
                  value={bookSummary}
                  onChange={(e) => setBookSummary(e.target.value)}
                  placeholder="စာအုပ်အကြောင်း အကျဉ်းချုပ်..."
                  className="w-full px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                />
              </div>

              <label className="flex items-center gap-2.5 text-sm text-[#1A241E] cursor-pointer">
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
            <div className="lg:col-span-7 bg-white border border-[#E2E8E4] rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#EDF1EE] pb-3">
                <h2 className="text-base font-bold text-[#1A241E]">
                  စာကြည့်တိုက်ရှိ စာအုပ်စာရင်း ({books.length})
                </h2>
              </div>

              {books.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <FileText className="w-10 h-10 text-[#96A49B] mx-auto" />
                  <p className="text-sm font-semibold text-[#1A241E]">
                    စာအုပ်တစ်အုပ်မျှ မတင်ရသေးပါ
                  </p>
                  <p className="text-xs text-[#5A6860]">
                    ဘယ်ဘက်ပုံစံမှတစ်ဆင့် PDF ဖိုင်ကို Google Drive သို့ တင်သွင်းပြီး
                    ပထမဆုံးစာအုပ်ကို ထည့်သွင်းနိုင်ပါသည်။
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[#EDF1EE]">
                  {books.map((book) => (
                    <div
                      key={book.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-14 rounded-md overflow-hidden border border-[#E2E8E4] shrink-0 bg-[#F3F5F4]">
                          <BookCoverFrame book={book} compact />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-[#9B7417]">
                              {book.categoryLabel}
                            </span>
                            <span className="text-[11px] text-[#5A6860]">
                              · {book.fileSize || 'PDF'}
                            </span>
                            {!book.published && (
                              <span className="text-[11px] font-semibold text-amber-700">
                                · ဖျောက်ထားသည်
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-[#1A241E] truncate">
                            {book.title}
                          </p>
                          {book.author.trim() && (
                            <p className="text-xs text-[#5A6860] truncate">
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
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-[#D4DDD7] text-xs font-medium text-[#35433A] hover:bg-[#F2F6F3] inline-flex items-center gap-1"
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
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-[#D4DDD7] text-xs font-medium text-[#115E34] hover:bg-[#EBF4EE] inline-flex items-center gap-1"
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
                          className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 inline-flex items-center gap-1"
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
        )}

        {/* TAB 2: VISIBILITY & REMOVE UNNECESSARY SECTIONS */}
        {activeTab === 'visibility' && (
          <div className="bg-white border border-[#E2E8E4] rounded-xl p-5 sm:p-7 space-y-7">
            <div>
              <h2 className="text-lg font-bold text-[#1A241E] mb-1">
                မလိုအပ်သော ကဏ္ဍနှင့် စာမျက်နှာများ ဖယ်ထုတ် / ပြသမှု စီမံရန်
              </h2>
              <p className="text-sm text-[#4A5850]">
                အောက်ပါ စာမျက်နှာများနှင့် စာကြည့်တိုက်ကဏ္ဍများထဲမှ မလိုအပ်သည်များကို
                အမှန်ခြစ်ဖြုတ်၍ ဝက်ဘ်ဆိုက်တစ်ခုလုံးမှ ဖယ်ထုတ်ထားနိုင်ပါသည်။
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#115E34] border-b border-[#EDF1EE] pb-2">
                  ဝက်ဘ်ဆိုက် စာမျက်နှာများ (Site Sections)
                </h3>
                <div className="space-y-2">
                  {MANAGEABLE_SECTIONS.map((sec) => {
                    const isVisible = !hiddenSectionsDraft.includes(sec.id);
                    return (
                      <label
                        key={sec.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-[#E2E8E4] bg-[#F9FBFA] cursor-pointer"
                      >
                        <span className="text-sm font-medium text-[#1A241E]">
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
                <h3 className="text-sm font-bold text-[#115E34] border-b border-[#EDF1EE] pb-2">
                  စာကြည့်တိုက် ကဏ္ဍ ၁၂ ခု (Library Categories)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => {
                    const isVisible = !hiddenCategoriesDraft.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-[#E2E8E4] bg-[#F9FBFA] cursor-pointer gap-2"
                      >
                        <span className="text-xs font-medium text-[#1A241E] truncate">
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

            <div className="space-y-2 pt-2 border-t border-[#EDF1EE]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="hero-desc-editor"
                  className="block text-sm font-bold text-[#115E34]"
                >
                  မူလစာမျက်နှာ မိတ်ဆက်စာသား (Hero Description)
                </label>
                <button
                  type="button"
                  onClick={() => setHeroDescDraft(DEFAULT_HERO_DESCRIPTION)}
                  className="text-xs font-semibold text-[#146B3A] hover:underline"
                >
                  မူလစာသားအသစ် ပြန်ထည့်ရန်
                </button>
              </div>
              <textarea
                id="hero-desc-editor"
                rows={3}
                value={heroDescDraft}
                onChange={(e) => setHeroDescDraft(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
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
          <div className="bg-white border border-[#E2E8E4] rounded-xl p-5 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EDF1EE] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#EBF4EE] text-[#146B3A] flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1A241E]">
                    Google Drive PDF Storage ({siteSettings.driveFolderName})
                  </h2>
                  <p className="text-xs text-[#5A6860]">
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
                          ? 'bg-[#EBF4EE] border-[#146B3A] text-[#115E34]'
                          : 'border-[#D4DDD7] text-[#35433A] hover:bg-[#F5F8F6]'
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
                      className="min-h-[40px] px-4 py-2 rounded-lg border border-[#D4DDD7] text-xs font-semibold text-[#115E34] hover:bg-[#EBF4EE] inline-flex items-center gap-1.5"
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
              <p className="text-sm text-[#4A5850] py-6 text-center">
                Google Drive ထဲရှိ PDF ဖိုင်များကို ကြည့်ရှုစီမံရန် "Google Drive ချိတ်ဆက်ရန်"
                ခလုတ်ကို နှိပ်ပါ။
              </p>
            ) : driveFiles.length === 0 ? (
              <p className="text-sm text-[#4A5850] py-6 text-center">
                {driveScopeMode === 'all'
                  ? 'သင့် Google Drive ထဲတွင် PDF ဖိုင် မတွေ့ရှိသေးပါ။'
                  : 'Google Drive ဖိုလ်ဒါထဲတွင် PDF ဖိုင် မရှိသေးပါ။ ("Drive တစ်ခုလုံးမှ PDF ရှာရန်" ဖြင့်လည်း စစ်ဆေးနိုင်ပါသည်)'}
              </p>
            ) : (
                <div className="divide-y divide-[#EDF1EE]">
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
                            <p className="text-sm font-semibold text-[#1A241E] truncate">
                              {file.name}
                            </p>
                            {matchedBook && (
                              <span className="text-[11px] font-semibold text-[#115E34]">
                                · ဝက်ဘ်ပေါ်တွင် {matchedBook.published ? 'တင်ပြီး' : 'ဖျောက်ထား'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#5A6860] tabular-nums">
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
                              className="px-3 py-1.5 rounded-lg bg-[#EBF4EE] text-[#115E34] text-xs font-semibold hover:bg-[#DCECE1]"
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
                            className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
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
              <div className="pt-4 border-t border-[#EDF1EE] space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#115E34]">
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
                    className="flex-1 min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => void refreshDriveFiles()}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    ဖိုလ်ဒါအသစ်ဖြင့် ချိတ်ဆက်ရန်
                  </button>
                </div>
                <p className="text-[11px] text-[#5A6860] leading-relaxed">
                  ဖိုလ်ဒါအမည် ပြောင်းလဲလိုက်ပါက ဤအမည်ဖြင့် Google Drive တွင် ဖိုလ်ဒါအသစ် အလိုအလျောက် ဖန်တီးပေးမည်ဖြစ်ပြီး စာအုပ်အသစ်များကို ယင်းဖိုလ်ဒါအသစ်ထဲသို့ တင်သွားမည် ဖြစ်ပါသည်။
                </p>
              </div>
              <p className="text-xs text-[#5A6860] pt-3 border-t border-[#EDF1EE] leading-relaxed">
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
                      ? 'bg-[#146B3A] text-white'
                      : 'bg-white border border-[#E2E8E4] text-[#35433A]'
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
                  className="lg:col-span-5 bg-white border border-[#E2E8E4] rounded-xl p-5 space-y-3"
                >
                  <h3 className="text-sm font-bold text-[#1A241E]">
                    ဒိုအာအသစ် ထည့်သွင်းရန်
                  </h3>
                  <input
                    required
                    value={duaTitleMy}
                    onChange={(e) => setDuaTitleMy(e.target.value)}
                    placeholder="ခေါင်းစဉ် (မြန်မာ)"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                  <select
                    value={duaCategoryMy}
                    onChange={(e) =>
                      setDuaCategoryMy(e.target.value as DuaItem['categoryMy'])
                    }
                    className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
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
                    className="w-full px-3 py-2 text-base font-[Amiri] bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                  <input
                    value={duaTranslit}
                    onChange={(e) => setDuaTranslit(e.target.value)}
                    placeholder="အသံထွက် (Transliteration)"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                  <textarea
                    required
                    rows={3}
                    value={duaMeaning}
                    onChange={(e) => setDuaMeaning(e.target.value)}
                    placeholder="မြန်မာအနက်အဓိပ္ပာယ် *"
                    className="w-full px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                  <input
                    value={duaSource}
                    onChange={(e) => setDuaSource(e.target.value)}
                    placeholder="ကျမ်းကိုး (ဥပမာ - စူရဟ် သွာဟာ)"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
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

                <div className="lg:col-span-7 bg-white border border-[#E2E8E4] rounded-xl p-5 divide-y divide-[#EDF1EE]">
                  {duas.length === 0 ? (
                    <p className="text-sm text-[#5A6860] py-8 text-center">
                      ဒိုအာ မထည့်သွင်းရသေးပါ။
                    </p>
                  ) : (
                    duas.map((d) => (
                      <div
                        key={d.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-[#9B7417]">{d.categoryMy}</p>
                          <p className="text-sm font-bold text-[#1A241E] truncate">
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
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
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
                  className="lg:col-span-5 bg-white border border-[#E2E8E4] rounded-xl p-5 space-y-3"
                >
                  <h3 className="text-sm font-bold text-[#1A241E]">
                    ဗီဒီယိုအသစ် ထည့်သွင်းရန်
                  </h3>
                  <input
                    required
                    value={vidTitle}
                    onChange={(e) => setVidTitle(e.target.value)}
                    placeholder="ဗီဒီယိုခေါင်းစဉ် *"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                  <input
                    required
                    value={vidSpeaker}
                    onChange={(e) => setVidSpeaker(e.target.value)}
                    placeholder="ဟောကြားသူ *"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      value={vidCategory}
                      onChange={(e) => setVidCategory(e.target.value)}
                      placeholder="ကဏ္ဍ"
                      className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                    />
                    <input
                      value={vidDuration}
                      onChange={(e) => setVidDuration(e.target.value)}
                      placeholder="ကြာချိန် (ဥပမာ 25:10)"
                      className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                    />
                  </div>
                  <input
                    required
                    type="url"
                    value={vidUrl}
                    onChange={(e) => setVidUrl(e.target.value)}
                    placeholder="https://... (YouTube / Google Drive Link)"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                  <textarea
                    rows={3}
                    value={vidDesc}
                    onChange={(e) => setVidDesc(e.target.value)}
                    placeholder="အကြောင်းအရာအကျဉ်း"
                    className="w-full px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
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

                <div className="lg:col-span-7 bg-white border border-[#E2E8E4] rounded-xl p-5 divide-y divide-[#EDF1EE]">
                  {videos.length === 0 ? (
                    <p className="text-sm text-[#5A6860] py-8 text-center">
                      ဗီဒီယို မထည့်သွင်းရသေးပါ။
                    </p>
                  ) : (
                    videos.map((v) => (
                      <div
                        key={v.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-[#9B7417]">
                            {v.categoryMy} · {v.speaker}
                          </p>
                          <p className="text-sm font-bold text-[#1A241E] truncate">
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
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
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
                  className="lg:col-span-5 bg-white border border-[#E2E8E4] rounded-xl p-5 space-y-3"
                >
                  <h3 className="text-sm font-bold text-[#1A241E]">
                    ဆောင်းပါးအသစ် ထည့်သွင်းရန်
                  </h3>
                  <input
                    required
                    value={artTitle}
                    onChange={(e) => setArtTitle(e.target.value)}
                    placeholder="ဆောင်းပါးခေါင်းစဉ် *"
                    className="w-full min-h-[40px] px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={artKicker}
                      onChange={(e) => setArtKicker(e.target.value)}
                      placeholder="ကဏ္ဍခွဲ"
                      className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                    />
                    <input
                      required
                      value={artAuthor}
                      onChange={(e) => setArtAuthor(e.target.value)}
                      placeholder="ရေးသားသူ *"
                      className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                    />
                  </div>
                  <input
                    value={artReadTime}
                    onChange={(e) => setArtReadTime(e.target.value)}
                    placeholder="ဖတ်ရှုချိန် (ဥပမာ ၅ မိနစ်ဖတ်)"
                    className="w-full min-h-[40px] px-3 py-2 text-xs bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                  <textarea
                    required
                    rows={2}
                    value={artExcerpt}
                    onChange={(e) => setArtExcerpt(e.target.value)}
                    placeholder="အကျဉ်းချုပ် *"
                    className="w-full px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
                  />
                  <textarea
                    required
                    rows={5}
                    value={artBody}
                    onChange={(e) => setArtBody(e.target.value)}
                    placeholder="ဆောင်းပါးအပြည့်အစုံ *"
                    className="w-full px-3 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg"
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

                <div className="lg:col-span-7 bg-white border border-[#E2E8E4] rounded-xl p-5 divide-y divide-[#EDF1EE]">
                  {articles.length === 0 ? (
                    <p className="text-sm text-[#5A6860] py-8 text-center">
                      ဆောင်းပါး မထည့်သွင်းရသေးပါ။
                    </p>
                  ) : (
                    articles.map((a) => (
                      <div
                        key={a.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-[#9B7417]">{a.kicker}</p>
                          <p className="text-sm font-bold text-[#1A241E] truncate">
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
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
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
          <div className="bg-white border border-[#E2E8E4] rounded-xl p-5 sm:p-7 space-y-4">
            <h2 className="text-base font-bold text-[#1A241E] border-b border-[#EDF1EE] pb-3">
              စာဖတ်သူများထံမှ ဆက်သွယ်စာများ ({messages.length})
            </h2>

            {messages.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Mail className="w-9 h-9 text-[#96A49B] mx-auto" />
                <p className="text-sm text-[#5A6860]">
                  ဆက်သွယ်မေးမြန်းစာ မရှိသေးပါ။
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#EDF1EE]">
                {messages.map((msg) => (
                  <div key={msg.id} className="py-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-[#1A241E]">
                          {msg.name}{' '}
                          <span className="font-normal text-xs text-[#5A6860]">
                            ({msg.contact || 'ဆက်သွယ်ရန်မထည့်ပါ'})
                          </span>
                        </p>
                        <p className="text-xs text-[#9B7417]">
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
                            className="px-3 py-1 rounded-lg bg-[#EBF4EE] text-[#115E34] text-xs font-semibold"
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
                          className="px-3 py-1 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50"
                        >
                          ဖျက်ရန်
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-[#35433A] leading-relaxed bg-[#F8FAF9] p-3 rounded-lg">
                      {msg.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Explicit Confirmation Modal for Destructive Operations */}
      {pendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeleting && setPendingDelete(null)}
        >
          <div
            className="bg-white border border-[#E2E8E4] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A241E]">
                  ဖျက်သိမ်းရန် အတည်ပြုပါ
                </h3>
                <p className="text-sm text-[#4A5850] mt-1 leading-relaxed">
                  “{pendingDelete.label}” ကို အပြီးတိုင် ဖျက်သိမ်းရန် သေချာပါသလား။
                  ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ပြင်ဆင်၍ မရပါ။
                </p>
              </div>
            </div>

            {pendingDelete.kind === 'book' &&
              pendingDelete.driveFileId &&
              driveToken && (
                <label className="flex items-center gap-2.5 p-3 rounded-lg bg-[#F8FAF9] border border-[#E2E8E4] text-xs text-[#1A241E] cursor-pointer">
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
                className="min-h-[40px] px-4 py-2 rounded-lg border border-[#D4DDD7] text-xs font-semibold text-[#35433A] hover:bg-[#F5F8F6]"
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
