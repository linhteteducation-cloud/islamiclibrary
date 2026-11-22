import {useMemo, useState} from 'react';
import {
  Bookmark,
  FileText,
  LayoutGrid,
  Search,
  Shield,
  SlidersHorizontal,
  User,
  X,
} from 'lucide-react';
import {CATEGORIES} from '../data/libraryData';
import {
  BookItem,
  CategoryId,
  MaterialType,
  PageRoute,
  SiteSettings,
} from '../types/library';
import {BookCoverFrame} from './BookCoverFrame';
import {CategoryIcon} from './CategoryIcon';

interface LibraryViewProps {
  books: BookItem[];
  siteSettings: SiteSettings;
  selectedCategory: CategoryId;
  onSelectCategory: (cat: CategoryId) => void;
  onOpenBook: (book: BookItem) => void;
  onNavigate: (page: PageRoute) => void;
  bookmarks: string[];
  onToggleBookmark: (bookId: string) => void;
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
  siteSettings,
  selectedCategory,
  onSelectCategory,
  onOpenBook,
  onNavigate,
  bookmarks,
  onToggleBookmark,
}: LibraryViewProps) {
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MaterialType>('All Types');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const visibleCategories = useMemo(
    () =>
      CATEGORIES.filter(
        (cat) => !siteSettings.hiddenCategories.includes(cat.id),
      ),
    [siteSettings.hiddenCategories],
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
      {/* Emerald Header Banner */}
      <section className="islamic-lattice-bg relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 islamic-pattern-overlay pointer-events-none"
        />
        <div className="relative max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-9 sm:py-11 text-white">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            အစ္စလာမ့် စာကြည့်တိုက်
          </h1>
          <p className="text-sm sm:text-[15px] text-[#E4EFE7] max-w-3xl leading-relaxed">
            Google Drive တွင် သိမ်းဆည်းထားသော အစ္စလာမ် PDF စာအုပ်များ၊ ဒိုအာများ၊
            သုတေသနစာတမ်းများနှင့် စာစောင်များကို ကဏ္ဍအလိုက် ဝင်ရောက်ဖတ်ရှုနိုင်ပါသည်။
          </p>
        </div>
      </section>

      {/* Search & Filter Bar */}
      <section className="bg-white border-b border-[#E2E8E4]">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="w-4 h-4 text-[#6B7970] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                className="w-full min-h-[44px] pl-10 pr-9 py-2 text-sm bg-[#F8FAF9] border border-[#D4DDD7] rounded-lg text-[#1A241E] placeholder:text-[#78857D] focus:outline-none focus:ring-2 focus:ring-[#146B3A] focus:bg-white transition-colors"
              />
              {searchDraft && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchDraft('');
                    setSearchQuery('');
                  }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-[#5A6860] hover:bg-[#EBF4EE]"
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
                className="flex-1 sm:w-44 min-h-[44px] px-3 py-2 text-sm bg-white border border-[#D4DDD7] rounded-lg text-[#1A241E] focus:outline-none focus:ring-2 focus:ring-[#146B3A]"
              >
                {MATERIAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === 'All Types' ? 'All Types' : type}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="min-h-[44px] px-5 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146B3A]"
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
              className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[#D4DDD7] bg-[#F8FAF9] text-xs font-semibold text-[#1A241E] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#146B3A]" />
              <span>ကဏ္ဍများ</span>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryClick('all')}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#146B3A] text-white'
                  : 'bg-[#F2F5F3] text-[#35433A]'
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
                    ? 'bg-[#146B3A] text-white'
                    : 'bg-[#F2F5F3] text-[#35433A]'
                }`}
              >
                {cat.nameMy}
              </button>
            ))}
          </div>

          {mobileFiltersOpen && (
            <div className="mt-3 lg:hidden bg-[#F8FAF9] border border-[#E2E8E4] rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleCategoryClick('all')}
                className={`w-full min-h-[42px] px-3 rounded-lg text-left text-xs font-semibold flex items-center justify-between ${
                  selectedCategory === 'all'
                    ? 'bg-[#146B3A] text-white'
                    : 'text-[#2C3A32] hover:bg-white'
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
                      ? 'bg-[#146B3A] text-white font-semibold'
                      : 'text-[#2C3A32] hover:bg-white'
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
      <section className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* Desktop Left Sidebar */}
          <aside className="hidden lg:block lg:col-span-3 space-y-6 sticky top-20">
            <div className="bg-white border border-[#E2E8E4] rounded-xl p-4">
              <h2 className="text-xs font-bold tracking-wider uppercase text-[#5A6860] px-2.5 pb-3 border-b border-[#EDF1EE] mb-2">
                Categories
              </h2>
              <ul className="space-y-1">
                <li>
                  <button
                    type="button"
                    onClick={() => handleCategoryClick('all')}
                    className={`w-full px-3 py-2.5 rounded-lg text-left text-[13px] font-medium flex items-center justify-between transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-[#146B3A] text-white font-semibold'
                        : 'text-[#2C3A32] hover:bg-[#F2F6F3]'
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
                            ? 'bg-[#146B3A] text-white font-semibold'
                            : 'text-[#2C3A32] hover:bg-[#F2F6F3]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2.5 min-w-0">
                          <CategoryIcon
                            name={cat.iconName}
                            className={`w-4 h-4 shrink-0 ${
                              active ? 'text-white' : 'text-[#5A6860]'
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#4A5850]">
                <span>
                  Showing{' '}
                  <strong className="font-semibold text-[#1A241E] tabular-nums">
                    {filteredBooks.length}
                  </strong>{' '}
                  of{' '}
                  <strong className="font-semibold text-[#1A241E] tabular-nums">
                    {books.length}
                  </strong>{' '}
                  books
                </span>
                {activeCategoryObj && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[#115E34]">
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
                      ? 'bg-[#C59B27] border-[#C59B27] text-white'
                      : 'bg-white border-[#D4DDD7] text-[#334239] hover:bg-[#F5F8F6]'
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
                    className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium text-[#146B3A] hover:bg-[#EBF4EE] transition-colors"
                  >
                    အားလုံးပြန်ပြရန်
                  </button>
                )}
              </div>
            </div>

            {filteredBooks.length === 0 ? (
              <div className="bg-white border border-[#E2E8E4] rounded-xl p-10 text-center space-y-3">
                <FileText className="w-10 h-10 text-[#86948B] mx-auto" />
                <p className="text-base font-semibold text-[#1A241E]">
                  {books.length === 0
                    ? 'စာကြည့်တိုက်တွင် PDF စာအုပ်များ မရှိသေးပါ'
                    : 'ရှာဖွေမှုနှင့် ကိုက်ညီသော စာအုပ်မတွေ့ရှိပါ'}
                </p>
                <p className="text-sm text-[#5A6860] max-w-md mx-auto">
                  {books.length === 0
                    ? 'Admin Panel မှတစ်ဆင့် Google Drive ထဲသို့ PDF စာအုပ်များ တင်သွင်းနိုင်ပါသည်။'
                    : 'အခြားစာလုံး သို့မဟုတ် ကဏ္ဍတစ်ခုကို ပြောင်းလဲရှာဖွေကြည့်ပါ။'}
                </p>
                <div className="pt-1 flex justify-center gap-2">
                  {books.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => onNavigate('admin')}
                      className="px-4 py-2 rounded-lg bg-[#146B3A] text-white text-xs font-semibold hover:bg-[#0F522D] inline-flex items-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      <span>Admin Panel ဖွင့်ရန်</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="px-4 py-2 rounded-lg bg-[#146B3A] text-white text-xs font-semibold hover:bg-[#0F522D]"
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
                      className="group bg-white border border-[#E2E8E4] rounded-xl overflow-hidden flex flex-col transition-shadow duration-150 hover:shadow-md"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-[#EDF1EE] bg-[#F3F5F4]">
                        <button
                          type="button"
                          onClick={() => onOpenBook(book)}
                          aria-label={`${book.title} ကြည့်ရှုရန်`}
                          className="w-full h-full block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#146B3A]"
                        >
                          <BookCoverFrame book={book} />
                          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleBookmark(book.id)}
                          aria-label={isSaved ? 'Remove bookmark' : 'Bookmark book'}
                          className={`absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-sm transition-colors ${
                            isSaved
                              ? 'bg-[#C59B27] text-white shadow-sm'
                              : 'bg-black/40 text-white hover:bg-black/60'
                          }`}
                        >
                          <Bookmark
                            className="w-4 h-4"
                            fill={isSaved ? 'currentColor' : 'none'}
                          />
                        </button>
                      </div>

                      <div className="p-4 flex flex-col flex-1">
                        <p className="text-[11.5px] font-medium text-[#9B7417] mb-1 truncate">
                          {book.categoryLabel}
                        </p>

                        <h3 className="text-[13.5px] font-semibold text-[#1A241E] leading-snug line-clamp-2 mb-2">
                          {book.title}
                        </h3>

                        {book.author.trim() ? (
                          <p className="text-xs text-[#5A6860] flex items-center gap-1.5 truncate mb-4">
                            <User className="w-3.5 h-3.5 shrink-0 text-[#7A887F]" />
                            <span className="truncate">{book.author}</span>
                          </p>
                        ) : (
                          <div className="mb-3" />
                        )}

                        <div className="mt-auto pt-3 border-t border-[#EFF3F0] flex items-center justify-between gap-2">
                          <span className="text-xs text-[#5A6860] tabular-nums">
                            {book.fileSize || 'PDF'}
                          </span>

                          <button
                            type="button"
                            onClick={() => onOpenBook(book)}
                            className="min-h-[34px] px-3.5 py-1.5 rounded-md bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146B3A]"
                          >
                            View
                          </button>
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
