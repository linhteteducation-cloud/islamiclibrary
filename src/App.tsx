import {useEffect, useState} from 'react';
import {User} from 'firebase/auth';
import {AdminPanelView} from './components/AdminPanelView';
import {ArticlesView} from './components/ArticlesView';
import {BookReaderModal} from './components/BookReaderModal';
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
import {PrayerTimesTicker} from './components/PrayerTimesTicker';
import {VideosView} from './components/VideosView';
import {DEFAULT_SITE_SETTINGS} from './data/libraryData';
import {
  checkIsAdminUser,
  initFirebaseAuth,
  signInAdminWithGoogleDrive,
  signOutAdmin,
  testFirestoreConnection,
} from './lib/firebase';
import {
  subscribeArticles,
  subscribeBooks,
  subscribeDuas,
  subscribeSiteSettings,
  subscribeVideos,
} from './lib/firestoreService';
import {
  ArticleItem,
  BookItem,
  CategoryId,
  DuaItem,
  PageRoute,
  SiteSettings,
  VideoItem,
} from './types/library';

const BOOKMARKS_STORAGE_KEY = 'mil_bookmarks_v2';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageRoute>('home');
  const [selectedCategory, setSelectedCategory] = useState<CategoryId>('all');
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
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(
    DEFAULT_SITE_SETTINGS,
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

    return () => {
      unsubSettings();
      unsubDuas();
      unsubVideos();
      unsubArticles();
    };
  }, []);

  useEffect(() => {
    const unsubBooks = subscribeBooks(isAdmin, setBooks);
    return () => unsubBooks();
  }, [isAdmin]);

  const publishedBooks = books.filter((b) => b.published);
  const syncedActiveBook = activeBook
    ? publishedBooks.find((b) => b.id === activeBook.id) ?? null
    : null;

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

  const handleNavigate = (page: PageRoute) => {
    setCurrentPage(page);
    if (page === 'library' && selectedCategory === 'videos') {
      setSelectedCategory('all');
    }
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleSelectCategory = (categoryId: CategoryId) => {
    setSelectedCategory(categoryId);
    setCurrentPage('library');
    window.scrollTo({top: 0, behavior: 'smooth'});
  };

  const handleToggleBookmark = (bookId: string) => {
    setBookmarks((prev) =>
      prev.includes(bookId)
        ? prev.filter((id) => id !== bookId)
        : [...prev, bookId],
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8F7] text-[#1A241E]">
      <PrayerTimesTicker />
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        siteSettings={siteSettings}
      />

      <main className="flex-1">
        {currentPage === 'home' && (
          <HomeView
            books={publishedBooks}
            siteSettings={siteSettings}
            onNavigate={handleNavigate}
            onSelectCategory={handleSelectCategory}
            onOpenBook={setActiveBook}
          />
        )}

        {currentPage === 'library' && (
          <LibraryView
            books={publishedBooks}
            siteSettings={siteSettings}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onOpenBook={setActiveBook}
            onNavigate={handleNavigate}
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
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
        onClose={() => setActiveBook(null)}
        isBookmarked={
          syncedActiveBook ? bookmarks.includes(syncedActiveBook.id) : false
        }
        onToggleBookmark={handleToggleBookmark}
      />
    </div>
  );
}
