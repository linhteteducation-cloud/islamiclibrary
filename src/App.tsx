import {useEffect, useMemo, useState} from 'react';
import {User} from 'firebase/auth';
import {AdminPanelView} from './components/AdminPanelView';
import {ArticlesView} from './components/ArticlesView';
import {BookReaderModal} from './components/BookReaderModal';
import {CategoryManagerModal} from './components/CategoryManagerModal';
import {DownloadToast} from './components/DownloadToast';
import {DuasView} from './components/DuasView';
import {Footer} from './components/Footer';
import {HomeView} from './components/HomeView';
import {
  AboutView,
  ContactView,
  PublishingView,
} from './components/InstitutionalViews';
import {LibraryView} from './components/LibraryView';
import {Navbar} from './components/Navbar';
import {OfflineIndicator} from './components/OfflineIndicator';
import {VideosView} from './components/VideosView';
import {
  CATEGORIES,
  DEFAULT_SITE_SETTINGS,
  mergeCategories,
} from './data/libraryData';
import {
  checkIsAdminUser,
  initFirebaseAuth,
  signInAdminWithGoogleDrive,
  signOutAdmin,
  testFirestoreConnection,
} from './lib/firebase';
import {
  deleteCategoryRecord,
  saveCategoryRecord,
  saveSiteSettings,
  subscribeArticles,
  subscribeBooks,
  subscribeCategories,
  subscribeDuas,
  subscribeSiteSettings,
  subscribeVideos,
  updateBookRecord,
} from './lib/firestoreService';
import {
  ArticleItem,
  BookCategoryId,
  BookItem,
  CategoryIconName,
  CategoryId,
  CategoryItem,
  DuaItem,
  PageRoute,
  SiteSettings,
  VideoItem,
} from './types/library';

const BOOKMARKS_STORAGE_KEY = 'mil_bookmarks_v2';
const DEFAULT_SEO_ORIGIN = 'https://islamiclibrary-three.vercel.app';
const VALID_ROUTES: PageRoute[] = [
  'home',
  'library',
  'duas',
  'videos',
  'articles',
  'about',
  'publishing',
  'contact',
  'admin',
];

function parseInitialRouteFromUrl(): {
  page: PageRoute;
  category: CategoryId;
  bookId: string | null;
} {
  try {
    const pathname = window.location.pathname
      .replace(/^\/+|\/+$/g, '')
      .toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const paramPage = (params.get('page') || '').toLowerCase();
    const paramCategory = params.get('category') || '';
    const paramBookId = params.get('book');

    let page: PageRoute = 'home';
    if (VALID_ROUTES.includes(pathname as PageRoute)) {
      page = pathname as PageRoute;
    } else if (VALID_ROUTES.includes(paramPage as PageRoute)) {
      page = paramPage as PageRoute;
    } else if (paramCategory || paramBookId) {
      page = 'library';
    }

    const normalizedParamCat = paramCategory.trim().toLowerCase();
    const category: CategoryId =
      normalizedParamCat && /^[a-z0-9-]+$/.test(normalizedParamCat)
        ? (normalizedParamCat as CategoryId)
        : 'all';

    return {
      page,
      category,
      bookId: paramBookId ? paramBookId.trim() : null,
    };
  } catch {
    return {page: 'home', category: 'all', bookId: null};
  }
}

function buildUrlForState(
  page: PageRoute,
  category: CategoryId,
  bookId?: string | null,
): string {
  const path = page === 'home' ? '/' : `/${page}`;
  const params = new URLSearchParams();
  if (page === 'library' && category !== 'all') {
    params.set('category', category);
  }
  if (bookId) {
    params.set('book', bookId);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function upsertHeadMeta(
  selector: string,
  attrName: 'name' | 'property',
  attrValue: string,
  content: string,
): void {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function App() {
  const initialUrlState = parseInitialRouteFromUrl();
  const [currentPage, setCurrentPage] = useState<PageRoute>(initialUrlState.page);
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>(
    initialUrlState.category,
  );
  const [requestedBookId, setRequestedBookId] = useState<string | null>(
    initialUrlState.bookId,
  );
  const [activeBook, setActiveBook] = useState<BookItem | null>(null);

  // Firebase Auth + Google Drive in-memory OAuth state
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [driveToken, setDriveToken] = useState<string | null>(null);

  // Live Firestore collections (zero demo data)
  const [books, setBooks] = useState<BookItem[]>([]);
  const [duas, setDuas] = useState<DuaItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [customCategoryDocs, setCustomCategoryDocs] = useState<CategoryItem[]>(
    [],
  );
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(
    DEFAULT_SITE_SETTINGS,
  );

  const mergedCategories = useMemo(
    () => mergeCategories(customCategoryDocs),
    [customCategoryDocs],
  );

  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
    } catch {
      // Ignore storage quota errors
    }
  }, [bookmarks]);

  useEffect(() => {
    void testFirestoreConnection();

    const unsubAuth = initFirebaseAuth(async (firebaseUser, token) => {
      setUser(firebaseUser);
      setDriveToken(token);
      if (firebaseUser) {
        const adminStatus = await checkIsAdminUser(firebaseUser);
        setIsAdmin(adminStatus);
      } else {
        setIsAdmin(false);
      }
      setAuthLoading(false);
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubSettings = subscribeSiteSettings(setSiteSettings);
    const unsubDuas = subscribeDuas(setDuas);
    const unsubVideos = subscribeVideos(setVideos);
    const unsubArticles = subscribeArticles(setArticles);
    const unsubCategories = subscribeCategories(setCustomCategoryDocs);

    return () => {
      unsubSettings();
      unsubDuas();
      unsubVideos();
      unsubArticles();
      unsubCategories();
    };
  }, []);

  useEffect(() => {
    const unsubBooks = subscribeBooks(isAdmin, setBooks);
    return () => unsubBooks();
  }, [isAdmin]);

  const publishedBooks = books.filter((b) => b.published);
  const syncedActiveBook = activeBook
    ? (isAdmin ? books : publishedBooks).find((b) => b.id === activeBook.id) ??
      null
    : null;

  // Open deep-linked book (?book=<id>) once publishedBooks load
  useEffect(() => {
    if (!requestedBookId || publishedBooks.length === 0) return;
    const match = publishedBooks.find((b) => b.id === requestedBookId);
    if (match) {
      setActiveBook(match);
      setRequestedBookId(null);
    }
  }, [requestedBookId, publishedBooks]);

  // Sync browser Back/Forward navigation
  useEffect(() => {
    const onPopState = () => {
      const next = parseInitialRouteFromUrl();
      setCurrentPage(next.page);
      setSelectedCategory(next.category);
      if (next.bookId) {
        const match = publishedBooks.find((b) => b.id === next.bookId);
        if (match) {
          setActiveBook(match);
          setRequestedBookId(null);
        } else {
          setRequestedBookId(next.bookId);
        }
      } else {
        setActiveBook(null);
        setRequestedBookId(null);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [publishedBooks]);

  // Dynamic per-view / per-category / per-book SEO title, description, canonical & OpenGraph tags
  useEffect(() => {
    const host = window.location.hostname;
    const seoOrigin =
      host === 'localhost' || host === '127.0.0.1'
        ? DEFAULT_SEO_ORIGIN
        : window.location.origin;

    const relativeUrl = buildUrlForState(
      currentPage,
      selectedCategory,
      syncedActiveBook?.id || null,
    );
    const canonicalUrl = `${seoOrigin}${relativeUrl}`;

    let title = 'Myanmar Muslim Library – မြန်မာ အစ္စလာမ် စာအုပ်စာပေများ';
    let description =
      'မြန်မာ အစ္စလာမ် စာအုပ် PDF များ (ကုရ်အာန်၊ ဟဒီးစ်၊ ဖိကဟ်၊ ဒိုအာ) အခမဲ့ ဖတ်ရှုဒေါင်းလုဒ်ရယူနိုင်သော Myanmar Muslim Library – Free Burmese Islamic Books & Research PDFs.';

    if (syncedActiveBook) {
      title = `${syncedActiveBook.title} | Myanmar Muslim Library`;
      description = syncedActiveBook.summary
        ? `${syncedActiveBook.summary.slice(0, 145)} — Free Burmese Islamic PDF Book at Myanmar Muslim Library.`
        : `${syncedActiveBook.title} (${syncedActiveBook.categoryLabel}) - Free Burmese Islamic PDF Book to read & download at Myanmar Muslim Library.`;
    } else if (currentPage === 'library') {
      const cat =
        mergedCategories.find((c) => c.id === selectedCategory) ||
        CATEGORIES.find((c) => c.id === selectedCategory);
      if (cat) {
        title = `${cat.nameMy} (${cat.nameEn}) | Myanmar Muslim Library`;
        description = `${cat.descriptionMy} — ${cat.nameEn} Burmese Islamic PDF books at Myanmar Muslim Library.`;
      } else {
        title = 'စာကြည့်တိုက် (Digital Library) | Myanmar Muslim Library';
        description =
          'Browse and download free Burmese Islamic PDF books across Quran, Hadith, Fiqh, Aqeedah, History, and Children sections.';
      }
    } else if (currentPage === 'duas') {
      title = 'ဒိုအာနှင့် အအ်မာလ်များ (Duas) | Myanmar Muslim Library';
      description =
        'နေ့စဉ်ဖတ်ရှုရန် ဒိုအာများ၊ ကုရ်အာန်လာ ဒိုအာများနှင့် အဓိပ္ပာယ်များ — Daily Islamic Duas in Arabic and Burmese.';
    } else if (currentPage === 'videos') {
      title = 'ဗီဒီယိုတရားတော်များ (Videos) | Myanmar Muslim Library';
      description =
        'အစ္စလာမ့်တရားတော်များ၊ ဆွေးနွေးပွဲများနှင့် ပညာပေး ဗီဒီယိုများ — Burmese Islamic Video Lectures.';
    } else if (currentPage === 'articles') {
      title = 'သတင်းဆောင်းပါးများ (Articles) | Myanmar Muslim Library';
      description =
        'အစ္စလာမ့်စာပေ ဆောင်းပါးများနှင့် သုတေသနစာတမ်းများ — Burmese Islamic Articles & Essays.';
    } else if (currentPage === 'about') {
      title = 'ကျွန်ုပ်တို့အကြောင်း (About) | Myanmar Muslim Library';
    } else if (currentPage === 'publishing') {
      title = 'စာပေဖြန့်ချိရေး (Publishing) | Myanmar Muslim Library';
    } else if (currentPage === 'contact') {
      title = 'ဆက်သွယ်ရန် (Contact) | Myanmar Muslim Library';
    } else if (currentPage === 'admin') {
      title = 'Admin Panel | Myanmar Muslim Library';
    }

    document.title = title;
    upsertHeadMeta(
      'meta[name="description"]',
      'name',
      'description',
      description,
    );
    upsertHeadMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      currentPage === 'admin'
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    );
    upsertHeadMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertHeadMeta(
      'meta[property="og:description"]',
      'property',
      'og:description',
      description,
    );
    upsertHeadMeta(
      'meta[property="og:url"]',
      'property',
      'og:url',
      canonicalUrl,
    );
    upsertHeadMeta(
      'meta[name="twitter:title"]',
      'name',
      'twitter:title',
      title,
    );
    upsertHeadMeta(
      'meta[name="twitter:description"]',
      'name',
      'twitter:description',
      description,
    );

    let canonicalEl =
      document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.setAttribute('href', canonicalUrl);
  }, [currentPage, selectedCategory, syncedActiveBook, mergedCategories]);

  useEffect(() => {
    if (
      currentPage !== 'home' &&
      currentPage !== 'admin' &&
      siteSettings.hiddenSections.includes(currentPage)
    ) {
      setCurrentPage('home');
    }
  }, [currentPage, siteSettings.hiddenSections]);

  useEffect(() => {
    if (
      selectedCategory !== 'all' &&
      siteSettings.hiddenCategories.includes(selectedCategory)
    ) {
      setSelectedCategory('all');
    }
  }, [selectedCategory, siteSettings.hiddenCategories]);

  const handleSignInGoogle = async () => {
    const res = await signInAdminWithGoogleDrive();
    setUser(res.user);
    setDriveToken(res.accessToken);
    const adminStatus = await checkIsAdminUser(res.user);
    setIsAdmin(adminStatus);
  };

  const handleSignOut = async () => {
    await signOutAdmin();
    setUser(null);
    setDriveToken(null);
    setIsAdmin(false);
  };

  const syncHistoryUrl = (
    page: PageRoute,
    category: CategoryId,
    bookId?: string | null,
  ) => {
    try {
      const targetUrl = buildUrlForState(page, category, bookId);
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      if (targetUrl !== currentUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    } catch {
      // Ignore history API restrictions
    }
  };

  const handleNavigate = (page: PageRoute) => {
    const nextCategory =
      page === 'library' && selectedCategory === 'videos'
        ? 'all'
        : selectedCategory;
    setCurrentPage(page);
    if (nextCategory !== selectedCategory) {
      setSelectedCategory(nextCategory);
    }
    setActiveBook(null);
    setRequestedBookId(null);
    syncHistoryUrl(page, nextCategory, null);
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleSelectCategory = (categoryId: CategoryId) => {
    setSelectedCategory(categoryId);
    setCurrentPage('library');
    setActiveBook(null);
    setRequestedBookId(null);
    syncHistoryUrl('library', categoryId, null);
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleOpenBook = (book: BookItem) => {
    setActiveBook(book);
    setRequestedBookId(null);
    syncHistoryUrl(currentPage, selectedCategory, book.id);
  };

  const handleCloseBook = () => {
    setActiveBook(null);
    setRequestedBookId(null);
    syncHistoryUrl(currentPage, selectedCategory, null);
  };

  const handleToggleBookmark = (bookId: string) => {
    setBookmarks((prev) =>
      prev.includes(bookId)
        ? prev.filter((id) => id !== bookId)
        : [...prev, bookId],
    );
  };

  const handleRenameBook = async (bookId: string, newTitle: string) => {
    if (!isAdmin) {
      throw new Error('Admin အကောင့်ဖြင့် ချိတ်ဆက်ထားမှသာ ပြင်ဆင်နိုင်ပါမည်။');
    }
    const cleanedTitle = newTitle.trim().slice(0, 240);
    if (!cleanedTitle) {
      throw new Error('စာအုပ်အမည် ထည့်သွင်းပါ။');
    }
    await updateBookRecord(bookId, {title: cleanedTitle});
  };

  const handleChangeBookCategory = async (
    bookId: string,
    categoryId: BookCategoryId,
  ) => {
    if (!isAdmin) {
      throw new Error('Admin အကောင့်ဖြင့် ချိတ်ဆက်ထားမှသာ ပြင်ဆင်နိုင်ပါမည်။');
    }
    const cat = mergedCategories.find((c) => c.id === categoryId);
    if (!cat || cat.id === 'videos') {
      throw new Error('မှန်ကန်သော Category ကို ရွေးချယ်ပါ။');
    }
    await updateBookRecord(bookId, {
      categoryId: cat.id as BookCategoryId,
      categoryLabel: cat.nameMy,
    });
  };

  const handleSaveCategory = async (payload: {
    id: string;
    nameMy: string;
    nameEn: string;
    descriptionMy: string;
    iconName: CategoryIconName;
    sortOrder: number;
    isExistingDoc?: boolean;
  }) => {
    if (!isAdmin || !user) {
      throw new Error('Admin အကောင့်ဖြင့် ချိတ်ဆက်ထားမှသာ ပြင်ဆင်နိုင်ပါမည်။');
    }
    await saveCategoryRecord(user.uid, payload);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!isAdmin) {
      throw new Error('Admin အကောင့်ဖြင့် ချိတ်ဆက်ထားမှသာ ဖျက်နိုင်ပါမည်။');
    }
    await deleteCategoryRecord(categoryId);
    if (selectedCategory === categoryId) {
      setSelectedCategory('all');
    }
  };

  const handleToggleCategoryVisibility = async (categoryId: string) => {
    if (!isAdmin || !user) {
      throw new Error('Admin အကောင့်ဖြင့် ချိတ်ဆက်ထားမှသာ ပြင်ဆင်နိုင်ပါမည်။');
    }
    const exists = siteSettings.hiddenCategories.includes(categoryId);
    const nextHidden = exists
      ? siteSettings.hiddenCategories.filter((id) => id !== categoryId)
      : [...siteSettings.hiddenCategories, categoryId];
    await saveSiteSettings(user.uid, {
      ...siteSettings,
      hiddenCategories: nextHidden,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7FA] text-[#131B2E]">
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        siteSettings={siteSettings}
      />

      <main className="flex-1">
        {currentPage === 'home' && (
          <HomeView
            books={publishedBooks}
            categories={mergedCategories}
            siteSettings={siteSettings}
            onNavigate={handleNavigate}
            onSelectCategory={handleSelectCategory}
            onOpenBook={handleOpenBook}
            isAdmin={isAdmin}
            onRenameBook={handleRenameBook}
            onOpenCategoryManager={() => setCategoryManagerOpen(true)}
          />
        )}

        {currentPage === 'library' && (
          <LibraryView
            books={publishedBooks}
            categories={mergedCategories}
            siteSettings={siteSettings}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
            onOpenBook={handleOpenBook}
            onNavigate={handleNavigate}
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
            isAdmin={isAdmin}
            onRenameBook={handleRenameBook}
            onOpenCategoryManager={() => setCategoryManagerOpen(true)}
          />
        )}

        {currentPage === 'duas' && <DuasView duas={duas} />}
        {currentPage === 'videos' && <VideosView videos={videos} />}
        {currentPage === 'articles' && <ArticlesView articles={articles} />}
        {currentPage === 'about' && <AboutView onNavigate={handleNavigate} />}
        {currentPage === 'publishing' && (
          <PublishingView onNavigate={handleNavigate} />
        )}
        {currentPage === 'contact' && <ContactView />}

        {currentPage === 'admin' && (
          <AdminPanelView
            user={user}
            isAdmin={isAdmin}
            authLoading={authLoading}
            driveToken={driveToken}
            onSignInGoogle={handleSignInGoogle}
            onSignOut={handleSignOut}
            books={books}
            categories={mergedCategories}
            onOpenCategoryManager={() => setCategoryManagerOpen(true)}
            duas={duas}
            videos={videos}
            articles={articles}
            siteSettings={siteSettings}
          />
        )}
      </main>

      <Footer onNavigate={handleNavigate} siteSettings={siteSettings} />

      <BookReaderModal
        book={syncedActiveBook}
        onClose={handleCloseBook}
        isBookmarked={
          syncedActiveBook ? bookmarks.includes(syncedActiveBook.id) : false
        }
        onToggleBookmark={handleToggleBookmark}
        isAdmin={isAdmin}
        categories={mergedCategories}
        onRenameBook={handleRenameBook}
        onChangeBookCategory={handleChangeBookCategory}
      />

      <CategoryManagerModal
        open={categoryManagerOpen && isAdmin}
        onClose={() => setCategoryManagerOpen(false)}
        categories={mergedCategories}
        books={books}
        siteSettings={siteSettings}
        onSaveCategory={handleSaveCategory}
        onDeleteCategory={handleDeleteCategory}
        onToggleCategoryVisibility={handleToggleCategoryVisibility}
      />

      <OfflineIndicator />
      <DownloadToast />
    </div>
  );
}
