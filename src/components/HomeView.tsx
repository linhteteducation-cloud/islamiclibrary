import {useState} from 'react';
import {
  ArrowRight,
  BookOpen,
  Download,
  FileText,
  HeartHandshake,
  Loader2,
  Scale,
  Shield,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  downloadBookDirectly,
  resolveBookDriveFileId,
} from '../lib/directDownload';
import {getScriptFontClass} from '../lib/scriptFonts';
import {
  BookCategoryId,
  BookItem,
  CategoryId,
  CategoryItem,
  DuaSlideItem,
  PageRoute,
  SiteSettings,
} from '../types/library';
import {BookCoverFrame} from './BookCoverFrame';
import {BookTitleEditor} from './BookTitleEditor';
import {CategoryIcon} from './CategoryIcon';
import {DuaImageSlider} from './DuaImageSlider';

interface HomeViewProps {
  books: BookItem[];
  categories: CategoryItem[];
  duaSlides: DuaSlideItem[];
  siteSettings: SiteSettings;
  onNavigate: (page: PageRoute) => void;
  onSelectCategory: (categoryId: CategoryId) => void;
  onOpenBook: (book: BookItem) => void;
  isAdmin?: boolean;
  onRenameBook?: (bookId: string, newTitle: string) => Promise<void>;
  onUpdateBookDetails?: (
    bookId: string,
    newTitle: string,
    categoryId: BookCategoryId,
  ) => Promise<void>;
  onOpenCategoryManager?: () => void;
  onOpenDuaSlidesAdmin?: () => void;
}

export function HomeView({
  books,
  categories,
  duaSlides,
  siteSettings,
  onNavigate,
  onSelectCategory,
  onOpenBook,
  isAdmin = false,
  onRenameBook,
  onUpdateBookDetails,
  onOpenCategoryManager,
  onOpenDuaSlidesAdmin,
}: HomeViewProps) {
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(
    null,
  );
  const [downloadError, setDownloadError] = useState('');

  const visibleCategories = categories.filter(
    (cat) => !siteSettings.hiddenCategories.includes(cat.id),
  );
  const featuredBooks = books.slice(0, 4);
  const showDuasButton = !siteSettings.hiddenSections.includes('duas');

  const handleCategoryCardClick = (id: CategoryId) => {
    if (id === 'videos') {
      onNavigate('videos');
      return;
    }
    onSelectCategory(id);
  };

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

  return (
    <div>
      {/* Deep Midnight Lapis Blue Hero Banner */}
      <section className="relative islamic-lattice-bg overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 islamic-pattern-overlay pointer-events-none"
        />
        <div className="relative max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24 text-center text-white">
          <p
            dir="rtl"
            className="font-[Amiri] text-2xl sm:text-3xl lg:text-[36px] text-[#E2C792] tracking-wide mb-3"
          >
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>

          <h1 className="font-serif text-3xl sm:text-5xl lg:text-[52px] font-bold tracking-tight text-white [text-wrap:balance] mb-5">
            Myanmar Muslim Library
          </h1>

          <p className="max-w-3xl mx-auto text-[15px] sm:text-base leading-[1.9] text-[#DCE4F2] font-normal mb-9">
            {siteSettings.heroDescription}
          </p>

          <div
            className={`grid grid-cols-1 ${
              showDuasButton
                ? 'sm:grid-cols-3 max-w-3xl'
                : 'sm:grid-cols-2 max-w-xl'
            } gap-3 mx-auto`}
          >
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-semibold text-sm shadow-sm whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>စာကြည့်တိုက်ဖွင့်ရန်</span>
            </button>

            {showDuasButton && (
              <button
                type="button"
                onClick={() => onNavigate('duas')}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/18 border border-white/25 text-white font-semibold text-sm whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <HeartHandshake className="w-4 h-4 shrink-0 text-[#E2C792]" />
                <span>ဒိုအာနှင့်အအ်မာလ်များ</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate('fatwa')}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] border border-[#34D399]/35 text-white font-semibold text-sm shadow-sm whitespace-nowrap transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6EE7B7]"
            >
              <Scale className="w-4 h-4 shrink-0 text-[#E2C792]" />
              <span>ဖသ်ဝါမေးမြန်းရန်</span>
            </button>
          </div>
        </div>
      </section>

      {/* Moving / Sliding Dua Image Gallery */}
      <DuaImageSlider
        slides={duaSlides}
        isAdmin={isAdmin}
        onOpenDuaSlidesAdmin={onOpenDuaSlidesAdmin}
      />

      {/* Browse by Category Grid */}
      {visibleCategories.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center mb-9 sm:mb-11">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#131B2E] dark:text-[#F1F5F9] [text-wrap:balance] mb-2">
              ကဏ္ဍအလိုက်ဖတ်ရှုရန်
            </h2>
            <p className="text-sm text-[#525E75] dark:text-[#94A3B8]">
              အကြောင်းအရာကဏ္ဍအလိုက် PDF စာအုပ်များနှင့် စာစောင်များ
            </p>
            {isAdmin && onOpenCategoryManager && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={onOpenCategoryManager}
                  className="min-h-[40px] px-4 py-2 rounded-lg border border-[#1E3A8A]/30 dark:border-[#263759] bg-white dark:bg-[#0D1526] hover:bg-[#EFF3FA] dark:hover:bg-[#131E36] text-[#1E3A8A] dark:text-[#93C5FD] text-xs font-semibold inline-flex items-center gap-2 transition-colors shadow-xs"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Category များ ထပ်ခွဲ / Customize လုပ်ရန်</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategoryCardClick(category.id)}
                className="group bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] hover:border-[#1E3A8A]/50 dark:hover:border-[#60A5FA]/60 rounded-xl p-5 sm:p-6 flex flex-col items-center text-center transition-all duration-150 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA]"
              >
                <div className="w-11 h-11 rounded-lg bg-[#EFF3FA] dark:bg-[#131E36] text-[#1E3A8A] dark:text-[#93C5FD] group-hover:bg-[#1E3A8A] dark:group-hover:bg-[#2563EB] group-hover:text-white flex items-center justify-center mb-3.5 transition-colors duration-150">
                  <CategoryIcon name={category.iconName} className="w-5 h-5" />
                </div>
                <span className="text-[13.5px] sm:text-sm font-semibold text-[#131B2E] dark:text-[#F1F5F9] group-hover:text-[#1E3A8A] dark:group-hover:text-[#93C5FD] leading-relaxed">
                  {category.nameMy}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Published PDF Books Section */}
      <section className="bg-white dark:bg-[#09101E] border-y border-[#E2E6EE] dark:border-[#192848] py-12 sm:py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold tracking-wider text-[#B85338] dark:text-[#F0947A] mb-1">
                Google Drive PDF စာကြည့်တိုက်
              </p>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#131B2E] dark:text-[#F1F5F9]">
                နောက်ဆုံးတင်သွင်းထားသော စာအုပ်များ
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:text-[#1D4ED8] dark:hover:text-[#BFDBFE] whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <span>စာအုပ်အားလုံးကြည့်ရန်</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {downloadError && (
            <div
              role="alert"
              className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[#FECACA] dark:border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#2B1218] px-4 py-3 text-xs font-medium text-[#B85338] dark:text-[#FCA5A5]"
            >
              <span>{downloadError}</span>
              <button
                type="button"
                onClick={() => setDownloadError('')}
                aria-label="Dismiss download error"
                className="shrink-0 p-1 rounded-md hover:bg-[#FEE2E2] dark:hover:bg-[#451A22]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {featuredBooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#263759] bg-[#F6F7FA] dark:bg-[#0D1526] p-8 sm:p-10 text-center space-y-3">
              <FileText className="w-9 h-9 text-[#64748B] dark:text-[#94A3B8] mx-auto" />
              <p className="text-base font-semibold text-[#131B2E] dark:text-[#F1F5F9]">
                စာကြည့်တိုက်တွင် PDF စာအုပ်များ မတင်ရသေးပါ
              </p>
              <p className="text-sm text-[#525E75] dark:text-[#94A3B8] max-w-md mx-auto">
                Admin Panel မှတစ်ဆင့် Google Drive ထဲသို့ PDF စာအုပ်များ တင်သွင်းပြီးပါက
                ဤနေရာတွင် အလိုအလျောက် ပေါ်လာမည် ဖြစ်ပါသည်။
              </p>
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Panel ဖွင့်ရန်</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {featuredBooks.map((book) => (
                <article
                  key={book.id}
                  className="group bg-[#F9FAFC] dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] hover:border-[#1E3A8A]/40 dark:hover:border-[#60A5FA]/50 rounded-xl overflow-hidden flex flex-col transition-all duration-150 hover:shadow-md"
                >
                  <button
                    type="button"
                    onClick={() => onOpenBook(book)}
                    aria-label={`${book.title} ကြည့်ရှုရန်`}
                    className="relative aspect-[4/3] w-full overflow-hidden border-b border-[#E2E6EE] dark:border-[#1E2C4A] bg-[#EFF2F7] dark:bg-[#131E36] block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA]"
                  >
                    <BookCoverFrame book={book} />
                    <span className="absolute inset-0 bg-black/0 group-hover:bg-black/8 dark:group-hover:bg-white/5 transition-colors pointer-events-none" />
                  </button>
                  <div className="p-4 flex flex-col flex-1">
                    <p className="text-[11.5px] font-semibold text-[#B85338] dark:text-[#F0947A] mb-1 truncate">
                      {categories.find((c) => c.id === book.categoryId)
                        ?.nameMy || book.categoryLabel}
                    </p>
                    <BookTitleEditor
                      title={book.title}
                      categoryId={book.categoryId}
                      categories={categories}
                      canEdit={Boolean(
                        isAdmin && (onUpdateBookDetails || onRenameBook),
                      )}
                      onSaveTitle={
                        onRenameBook
                          ? (nextTitle) => onRenameBook(book.id, nextTitle)
                          : undefined
                      }
                      onSaveBookDetails={
                        onUpdateBookDetails
                          ? (nextTitle, nextCategoryId) =>
                              onUpdateBookDetails(
                                book.id,
                                nextTitle,
                                nextCategoryId,
                              )
                          : undefined
                      }
                    />
                    {book.author.trim() ? (
                      <p
                        className={`text-xs text-[#525E75] dark:text-[#94A3B8] truncate mb-4 ${getScriptFontClass(book.author)}`}
                      >
                        {book.author}
                      </p>
                    ) : (
                      <div className="mb-3" />
                    )}
                    <div className="mt-auto pt-3 border-t border-[#E6EAF2] dark:border-[#1E2C4A] flex items-center justify-between gap-2">
                      <span className="text-xs text-[#525E75] dark:text-[#94A3B8] tabular-nums truncate">
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
                            className="min-h-[36px] px-2.5 py-1.5 rounded-md border border-[#D4DBE8] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-[#EFF3FA] dark:hover:bg-[#1B2A4A] disabled:opacity-60 text-[#1E3A8A] dark:text-[#E2E8F0] text-xs font-semibold inline-flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA]"
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
                          className="min-h-[36px] px-3.5 py-1.5 rounded-md bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA]"
                        >
                          ဖတ်ရှုရန်
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
