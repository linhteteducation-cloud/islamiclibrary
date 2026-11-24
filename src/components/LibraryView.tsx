import {useEffect, useMemo, useState} from 'react';
import {
  Bookmark,
  Clock,
  Download,
  FileText,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  downloadBookDirectly,
  resolveBookDriveFileId,
} from '../lib/directDownload';
import {
  clearRecentDownloads,
  RecentDownloadEntry,
  removeRecentDownload,
  subscribeRecentDownloads,
} from '../lib/recentDownloads';
import {
  BookItem,
  CategoryId,
  CategoryItem,
  MaterialType,
  PageRoute,
  SiteSettings,
} from '../types/library';
import {BookCoverFrame} from './BookCoverFrame';
import {BookTitleEditor} from './BookTitleEditor';
import {CategoryIcon} from './CategoryIcon';

interface LibraryViewProps {
  books: BookItem[];
  categories: CategoryItem[];
  siteSettings: SiteSettings;
  selectedCategory: CategoryId;
  onSelectCategory: (cat: CategoryId) => void;
  onOpenBook: (book: BookItem) => void;
  onNavigate: (page: PageRoute) => void;
  bookmarks: string[];
  onToggleBookmark: (bookId: string) => void;
  isAdmin?: boolean;
  onRenameBook?: (bookId: string, newTitle: string) => Promise<void>;
  onOpenCategoryManager?: () => void;
}

const MATERIAL_TYPES: MaterialType[] = [
  'All Types',
  'Book',
  'Periodical',
  'Research',
  'Dua',
  'Timetable',
];

export function LibraryView({
  books,
  categories,
  siteSettings,
  selectedCategory,
  onSelectCategory,
  onOpenBook,
  onNavigate,
  bookmarks,
  onToggleBookmark,
  isAdmin = false,
  onRenameBook,
  onOpenCategoryManager,
}: LibraryViewProps) {
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MaterialType>('All Types');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(
    null,
  );
  const [downloadError, setDownloadError] = useState('');
  const [recentDownloads, setRecentDownloads] = useState<RecentDownloadEntry[]>(
    [],
  );

  useEffect(() => {
    return subscribeRecentDownloads(setRecentDownloads);
  }, []);

  const booksById = useMemo(() => {
    const map = new Map<string, BookItem>();
    for (const book of books) {
      map.set(book.id, book);
    }
    return map;
  }, [books]);

  const handleDirectDownload = async (book: BookItem) => {
    if (downloadingBookId) return;
    setDownloadError('');
    setDownloadingBookId(book.id);
    try {
      await downloadBookDirectly(book);
    } catch (err) {
      setDownloadError(
        err instanceof Error
          ? err.message
          : 'PDF ဖိုင်ကို တိုက်ရိုက်ဒေါင်းလုဒ်ရယူ၍ မရနိုင်ပါ။',
      );
    } finally {
      setDownloadingBookId(null);
    }
  };

  const visibleCategories = useMemo(
    () =>
      categories.filter(
        (cat) => !siteSettings.hiddenCategories.includes(cat.id),
      ),
    [categories, siteSettings.hiddenCategories],
  );

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((book) => {
      if (siteSettings.hiddenCategories.includes(book.categoryId)) {
        return false;
      }
      if (selectedCategory !== 'all' && book.categoryId !== selectedCategory) {
        return false;
      }
      if (selectedType !== 'All Types' && book.type !== selectedType) {
        return false;
      }
      if (onlyBookmarked && !bookmarks.includes(book.id)) {
        return false;
      }
      if (q) {
        const match =
          book.title.toLowerCase().includes(q) ||
          book.author.toLowerCase().includes(q) ||
          book.categoryLabel.toLowerCase().includes(q) ||
          book.summary.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [
    books,
    siteSettings.hiddenCategories,
    selectedCategory,
    selectedType,
    onlyBookmarked,
    bookmarks,
    searchQuery,
  ]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {all: books.length};
    for (const b of books) {
      map[b.categoryId] = (map[b.categoryId] || 0) + 1;
    }
    return map;
  }, [books]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchDraft);
  };

  const handleResetFilters = () => {
    setSearchDraft('');
    setSearchQuery('');
    setSelectedType('All Types');
    setOnlyBookmarked(false);
    onSelectCategory('all');
  };

  const handleCategoryClick = (catId: CategoryId) => {
    if (catId === 'videos') {
      onNavigate('videos');
      return;
    }
    onSelectCategory(catId);
    setMobileFiltersOpen(false);
  };

  const activeCategoryObj = visibleCategories.find(
    (c) => c.id === selectedCategory,
  );

  return (
    <div>
      {/* Deep Lapis Header Banner */}
      <section className="islamic-lattice-bg relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 islamic-pattern-overlay pointer-events-none"
        />
        <div className="relative max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-9 sm:py-11 text-white">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            အစ္စလာမ့် စာကြည့်တိုက်
          </h1>
          <p className="text-sm sm:text-[15px] text-[#DCE4F2] max-w-3xl leading-[1.8]">
            Google Drive တွင် သိမ်းဆည်းထားသော အစ္စလာမ် PDF စာအုပ်များ၊ ဒိုအာများ၊
            သုတေသနစာတမ်းများနှင့် စာစောင်များကို ကဏ္ဍအလိုက် ဝင်ရောက်ဖတ်ရှုနိုင်ပါသည်။
          </p>
        </div>
      </section>

      {/* Search & Filter Bar */}
      <section className="bg-white border-b border-[#E2E6EE]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="text"
                value={searchDraft}
                onChange={(e) => {
                  setSearchDraft(e.target.value);
                  setSearchQuery(e.target.value);
                }}
                placeholder="စာအုပ်အမည်၊ စာရေးဆရာ ရှာဖွေရန် (Search books, authors...)"
                aria-label="Search books or authors"
                className="w-full min-h-[44px] pl-10 pr-9 py-2 text-sm bg-[#F6F7FA] border border-[#D4DBE8] rounded-lg text-[#131B2E] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] focus:bg-white transition-colors"
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchDraft('');
                    setSearchQuery('');
                  }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-[#525E75] hover:bg-[#EFF3FA]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as MaterialType)}
                aria-label="Filter by material type"
                className="flex-1 sm:w-44 min-h-[44px] px-3 py-2 text-sm bg-white border border-[#D4DBE8] rounded-lg text-[#131B2E] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
              >
                {MATERIAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === 'All Types' ? 'All Types' : type}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-lg bg-[#1E3A8A] hover:bg-[#172D6B] text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
              >
                Search
              </button>
            </div>
          </form>

          {/* Mobile Quick Category Strip */}
          <div className="mt-3 lg:hidden flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[#D4DBE8] bg-[#F6F7FA] text-xs font-semibold text-[#131B2E] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#1E3A8A]" />
              <span>ကဏ္ဍများ</span>
            </button>

            {isAdmin && onOpenCategoryManager && (
              <button
                type="button"
                onClick={onOpenCategoryManager}
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[#1E3A8A]/40 bg-[#EFF3FA] text-xs font-semibold text-[#1E3A8A] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Category Customize</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleCategoryClick('all')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#1E3A8A] text-white'
                  : 'bg-[#EFF2F7] text-[#334155]'
              }`}
            >
              All Books
            </button>

            {visibleCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryClick(cat.id)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-[#1E3A8A] text-white'
                    : 'bg-[#EFF2F7] text-[#334155]'
                }`}
              >
                {cat.nameMy}
              </button>
            ))}
          </div>

          {mobileFiltersOpen && (
            <div className="mt-3 lg:hidden bg-[#F6F7FA] border border-[#E2E6EE] rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleCategoryClick('all')}
                className={`w-full min-h-[42px] px-3 rounded-lg text-left text-xs font-semibold flex items-center justify-between ${
                  selectedCategory === 'all'
                    ? 'bg-[#1E3A8A] text-white'
                    : 'text-[#1E293B] hover:bg-white'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  All Books
                </span>
                <span className="tabular-nums opacity-80">{books.length}</span>
              </button>
              {visibleCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryClick(cat.id)}
                  className={`w-full min-h-[42px] px-3 rounded-lg text-left text-xs font-medium flex items-center justify-between ${
                    selectedCategory === cat.id
                      ? 'bg-[#1E3A8A] text-white font-semibold'
                      : 'text-[#1E293B] hover:bg-white'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <CategoryIcon name={cat.iconName} className="w-4 h-4 shrink-0" />
                    <span className="truncate">{cat.nameMy}</span>
                  </span>
                  {cat.id !== 'videos' && (
                    <span className="tabular-nums opacity-75 ml-2">
                      {categoryCounts[cat.id] || 0}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Main 2-Column Catalog Body */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* Desktop Left Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 space-y-6 sticky top-20">
            <div className="bg-white border border-[#E2E6EE] rounded-xl p-4">
              <div className="flex items-center justify-between gap-2 px-2.5 pb-3 border-b border-[#EFF2F7] mb-2">
                <h2 className="text-xs font-bold tracking-wider uppercase text-[#525E75]">
                  Categories
                </h2>
                {isAdmin && onOpenCategoryManager && (
                  <button
                    type="button"
                    onClick={onOpenCategoryManager}
                    title="Category များ ထပ်ခွဲ / Customize လုပ်ရန်"
                    className="px-2.5 py-1 rounded-md bg-[#EFF3FA] hover:bg-[#1E3A8A] text-[#1E3A8A] hover:text-white text-[11.5px] font-semibold inline-flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Customize</span>
                  </button>
                )}
              </div>
              <ul className="space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick('all')}
                    className={`w-full px-3 py-2.5 rounded-lg text-left text-[13px] font-medium flex items-center justify-between transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-[#1E3A8A] text-white font-semibold'
                        : 'text-[#1E293B] hover:bg-[#EFF3FA]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <LayoutGrid className="w-4 h-4 shrink-0" />
                      <span>All Books</span>
                    </span>
                    <span className="text-xs tabular-nums opacity-80">
                      {books.length}
                    </span>
                  </button>
                </li>
                {visibleCategories.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onClick={() => handleCategoryClick(cat.id)}
                        className={`w-full px-3 py-2.5 rounded-lg text-left text-[13px] font-medium flex items-center justify-between transition-colors ${
                          active
                            ? 'bg-[#1E3A8A] text-white font-semibold'
                            : 'text-[#1E293B] hover:bg-[#EFF3FA]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2.5 min-w-0">
                          <CategoryIcon
                            name={cat.iconName}
                            className={`w-4 h-4 shrink-0 ${
                              active ? 'text-white' : 'text-[#525E75]'
                            }`}
                          />
                          <span className="truncate">{cat.nameMy}</span>
                        </span>
                        {cat.id !== 'videos' && (
                          <span className="text-xs tabular-nums opacity-75 ml-2 shrink-0">
                            {categoryCounts[cat.id] || 0}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Right Main Grid */}
          <div className="lg:col-span-9 space-y-5">
            {/* Recent Downloads (localStorage persisted) */}
            <section
              aria-labelledby="recent-downloads-heading"
              className="bg-white border border-[#E2E6EE] rounded-xl p-4 sm:p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#1E3A8A] shrink-0" />
                  <h2
                    id="recent-downloads-heading"
                    className="text-sm font-bold text-[#131B2E]"
                  >
                    Recent Downloads
                  </h2>
                  {recentDownloads.length > 0 && (
                    <span className="text-xs font-medium text-[#525E75] tabular-nums">
                      ({recentDownloads.length})
                    </span>
                  )}
                </div>

                {recentDownloads.length > 0 && (
                  <button
                    type="button"
                    onClick={clearRecentDownloads}
                    className="min-h-[32px] px-2.5 py-1 rounded-md text-xs font-medium text-[#525E75] hover:text-[#B85338] hover:bg-[#FEF2F2] inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {recentDownloads.length === 0 ? (
                <p className="mt-2 text-xs text-[#64748B]">
                  Books you download will appear here for quick access.
                </p>
              ) : (
                <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {recentDownloads.map((entry) => {
                    const liveBook = booksById.get(entry.bookId);
                    const canDirectDownload = Boolean(
                      liveBook && resolveBookDriveFileId(liveBook),
                    );
                    return (
                      <div
                        key={entry.bookId}
                        className="group relative flex items-center gap-3 rounded-lg border border-[#E6EAF2] bg-[#F9FAFC] hover:border-[#1E3A8A]/35 p-2.5 transition-colors"
                      >
                        <button
                          type="button"
                          disabled={!liveBook}
                          onClick={() => liveBook && onOpenBook(liveBook)}
                          aria-label={`${entry.title} ဖွင့်ကြည့်ရန်`}
                          className="w-11 h-14 shrink-0 rounded-md overflow-hidden border border-[#E2E6EE] bg-[#EFF2F7] disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                        >
                          {liveBook ? (
                            <BookCoverFrame book={liveBook} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#1E3A8A]">
                              <FileText className="w-4 h-4" />
                            </div>
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          {entry.categoryLabel && (
                            <p className="text-[10.5px] font-semibold text-[#B85338] truncate">
                              {entry.categoryLabel}
                            </p>
                          )}
                          <button
                            type="button"
                            disabled={!liveBook}
                            onClick={() => liveBook && onOpenBook(liveBook)}
                            className="block w-full text-left text-xs font-bold text-[#131B2E] hover:text-[#1E3A8A] disabled:hover:text-[#131B2E] truncate"
                          >
                            {entry.title}
                          </button>
                          <p className="text-[11px] text-[#64748B] tabular-nums truncate mt-0.5">
                            {entry.fileSize || 'PDF'} ·{' '}
                            {new Date(entry.downloadedAt).toLocaleDateString()}
                          </p>

                          <div className="mt-1.5 flex items-center gap-1.5">
                            {canDirectDownload && liveBook && (
                              <button
                                type="button"
                                onClick={() => handleDirectDownload(liveBook)}
                                disabled={downloadingBookId === liveBook.id}
                                aria-label={`${entry.title} ထပ်မံဒေါင်းလုဒ်ရယူရန်`}
                                className="min-h-[30px] px-2 rounded-md border border-[#D4DBE8] bg-white hover:bg-[#EFF3FA] disabled:opacity-60 text-[#1E3A8A] text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                              >
                                {downloadingBookId === liveBook.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                                <span>ဒေါင်းရန်</span>
                              </button>
                            )}
                            {liveBook && (
                              <button
                                type="button"
                                onClick={() => onOpenBook(liveBook)}
                                className="min-h-[30px] px-2 rounded-md bg-[#1E3A8A] hover:bg-[#172D6B] text-white text-[11px] font-semibold transition-colors"
                              >
                                ဖတ်ရှုရန်
                              </button>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeRecentDownload(entry.bookId)}
                          aria-label={`Remove ${entry.title} from recent downloads`}
                          className="self-start p-1 rounded-md text-[#64748B] hover:text-[#B85338] hover:bg-[#FEF2F2] transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#525E75]">
                <span>
                  Showing{' '}
                  <strong className="font-semibold text-[#131B2E] tabular-nums">
                    {filteredBooks.length}
                  </strong>{' '}
                  of{' '}
                  <strong className="font-semibold text-[#131B2E] tabular-nums">
                    {books.length}
                  </strong>{' '}
                  books
                </span>
                {activeCategoryObj && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[#1E3A8A]">
                      {activeCategoryObj.nameMy}
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyBookmarked((prev) => !prev)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors ${
                    onlyBookmarked
                      ? 'bg-[#B85338] border-[#B85338] text-white'
                      : 'bg-white border-[#D4DBE8] text-[#334155] hover:bg-[#EFF3FA]'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>သိမ်းဆည်းထားမှု ({bookmarks.length})</span>
                </button>

                {(selectedCategory !== 'all' ||
                  selectedType !== 'All Types' ||
                  searchQuery ||
                  onlyBookmarked) && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium text-[#1E3A8A] hover:bg-[#EFF3FA] transition-colors"
                  >
                    အားလုံးပြန်ပြရန်
                  </button>
                )}
              </div>
            </div>

            {downloadError && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#B85338]"
              >
                <span>{downloadError}</span>
                <button
                  type="button"
                  onClick={() => setDownloadError('')}
                  aria-label="Dismiss download error"
                  className="shrink-0 p-1 rounded-md hover:bg-[#FEE2E2]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {filteredBooks.length === 0 ? (
              <div className="bg-white border border-[#E2E6EE] rounded-xl p-10 text-center space-y-3">
                <FileText className="w-10 h-10 text-[#64748B] mx-auto" />
                <p className="text-base font-semibold text-[#131B2E]">
                  {books.length === 0
                    ? 'စာကြည့်တိုက်တွင် PDF စာအုပ်များ မရှိသေးပါ'
                    : 'ရှာဖွေမှုနှင့် ကိုက်ညီသော စာအုပ်မတွေ့ရှိပါ'}
                </p>
                <p className="text-sm text-[#525E75] max-w-md mx-auto">
                  {books.length === 0
                    ? 'Admin Panel မှတစ်ဆင့် Google Drive ထဲသို့ PDF စာအုပ်များ တင်သွင်းနိုင်ပါသည်။'
                    : 'အခြားစာလုံး သို့မဟုတ် ကဏ္ဍတစ်ခုကို ပြောင်းလဲရှာဖွေကြည့်ပါ။'}
                </p>
                <div className="pt-1 flex justify-center gap-2">
                  {books.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onNavigate('admin')}
                      className="px-4 py-2 rounded-lg bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172D6B] inline-flex items-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Admin Panel ဖွင့်ရန်</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="px-4 py-2 rounded-lg bg-[#1E3A8A] text-white text-xs font-semibold hover:bg-[#172D6B]"
                    >
                      စာအုပ်အားလုံး ပြန်ပြရန်
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {filteredBooks.map((book) => {
                  const isSaved = bookmarks.includes(book.id);
                  return (
                    <article
                      key={book.id}
                      className="group bg-white border border-[#E2E6EE] hover:border-[#1E3A8A]/40 rounded-xl overflow-hidden flex flex-col transition-all duration-150 hover:shadow-md"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[#EFF2F7] bg-[#EFF2F7]">
                        <button
                          type="button"
                          onClick={() => onOpenBook(book)}
                          aria-label={`${book.title} ကြည့်ရှုရန်`}
                          className="w-full h-full block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E3A8A]"
                        >
                          <BookCoverFrame book={book} />
                          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/8 transition-colors pointer-events-none" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleBookmark(book.id)}
                          aria-label={isSaved ? 'Remove bookmark' : 'Bookmark book'}
                          className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-sm transition-colors ${
                            isSaved
                              ? 'bg-[#B85338] text-white shadow-sm'
                              : 'bg-[#0D1830]/60 text-white hover:bg-[#0D1830]/85'
                          }`}
                        >
                          <Bookmark
                            className="w-4 h-4"
                            fill={isSaved ? 'currentColor' : 'none'}
                          />
                        </button>
                      </div>

                      <div className="p-4 flex flex-col flex-1">
                        <p className="text-[11.5px] font-semibold text-[#B85338] mb-1 truncate">
                          {categories.find((c) => c.id === book.categoryId)
                            ?.nameMy || book.categoryLabel}
                        </p>

                        <BookTitleEditor
                          title={book.title}
                          canEdit={Boolean(isAdmin && onRenameBook)}
                          onSaveTitle={(nextTitle) =>
                            onRenameBook!(book.id, nextTitle)
                          }
                        />

                        {book.author.trim() ? (
                          <p className="text-xs text-[#525E75] flex items-center gap-1.5 truncate mb-4">
                            <User className="w-3.5 h-3.5 shrink-0 text-[#64748B]" />
                            <span className="truncate">{book.author}</span>
                          </p>
                        ) : (
                          <div className="mb-3" />
                        )}

                        <div className="mt-auto pt-3 border-t border-[#EFF2F7] flex items-center justify-between gap-2">
                          <span className="text-xs text-[#525E75] tabular-nums truncate">
                            {book.fileSize || 'PDF'}
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {resolveBookDriveFileId(book) && (
                              <button
                                type="button"
                                onClick={() => handleDirectDownload(book)}
                                disabled={downloadingBookId === book.id}
                                title="PDF တိုက်ရိုက်ဒေါင်းလုဒ်ရယူရန်"
                                aria-label={`${book.title} PDF ဒေါင်းလုဒ်ရယူရန်`}
                                className="min-h-[36px] px-2.5 py-1.5 rounded-md border border-[#D4DBE8] bg-white hover:bg-[#EFF3FA] disabled:opacity-60 text-[#1E3A8A] text-xs font-semibold inline-flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                              >
                                {downloadingBookId === book.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                                <span>ဒေါင်းရန်</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onOpenBook(book)}
                              className="min-h-[36px] px-3.5 py-1.5 rounded-md bg-[#1E3A8A] hover:bg-[#172D6B] text-white text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A]"
                            >
                              ဖတ်ရှုရန်
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
