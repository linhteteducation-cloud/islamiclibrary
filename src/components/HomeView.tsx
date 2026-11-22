import {ArrowRight, BookOpen, FileText, HeartHandshake, Shield} from 'lucide-react';
import {CATEGORIES} from '../data/libraryData';
import {BookItem, CategoryId, PageRoute, SiteSettings} from '../types/library';
import {BookCoverFrame} from './BookCoverFrame';
import {CategoryIcon} from './CategoryIcon';

interface HomeViewProps {
  books: BookItem[];
  siteSettings: SiteSettings;
  onNavigate: (page: PageRoute) => void;
  onSelectCategory: (categoryId: CategoryId) => void;
  onOpenBook: (book: BookItem) => void;
}

export function HomeView({
  books,
  siteSettings,
  onNavigate,
  onSelectCategory,
  onOpenBook,
}: HomeViewProps) {
  const visibleCategories = CATEGORIES.filter(
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

  return (
    <div>
      {/* Hero Banner */}
      <section className="relative islamic-lattice-bg overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 islamic-pattern-overlay pointer-events-none"
        />
        <div className="relative max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24 text-center text-white">
          <p
            dir="rtl"
            className="font-[Amiri] text-2xl sm:text-3xl lg:text-[34px] text-[#E8C868] tracking-wide mb-3"
          >
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
          </p>

          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[46px] font-bold tracking-tight text-white [text-wrap:balance] mb-5">
            Myanmar Islamic Library
          </h1>

          <p className="max-w-3xl mx-auto text-[14.5px] sm:text-base leading-[1.85] text-[#E6EFE9] font-normal mb-8">
            {siteSettings.heroDescription}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-lg bg-[#C59B27] hover:bg-[#B2891B] text-white font-semibold text-sm shadow-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F3D786]"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>စာကြည့်တိုက်ဖွင့်ရန်</span>
            </button>

            {showDuasButton && (
              <button
                type="button"
                onClick={() => onNavigate('duas')}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-lg bg-[#0D4A28]/70 hover:bg-[#0B3F22] border border-white/25 text-white font-semibold text-sm transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <HeartHandshake className="w-4 h-4 shrink-0 text-[#E8C868]" />
                <span>ဒိုအာနှင့်အအ်မာလ်များ</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Browse by Category Grid */}
      {visibleCategories.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center mb-9 sm:mb-11">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1A241E] [text-wrap:balance] mb-2">
              ကဏ္ဍအလိုက်ဖတ်ရှုရန်
            </h2>
            <p className="text-sm text-[#5A6860]">
              အကြောင်းအရာကဏ္ဍအလိုက် PDF စာအုပ်များနှင့် စာစောင်များ
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategoryCardClick(category.id)}
                className="group bg-white border border-[#E2E8E4] hover:border-[#146B3A]/45 rounded-xl p-5 sm:p-6 flex flex-col items-center text-center transition-all duration-150 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146B3A]"
              >
                <div className="w-11 h-11 rounded-lg bg-[#EBF4EE] text-[#146B3A] group-hover:bg-[#146B3A] group-hover:text-white flex items-center justify-center mb-3.5 transition-colors duration-150">
                  <CategoryIcon name={category.iconName} className="w-5 h-5" />
                </div>
                <span className="text-[13.5px] sm:text-sm font-semibold text-[#1E2A23] group-hover:text-[#115E34] leading-snug">
                  {category.nameMy}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Published PDF Books Section (Zero Demo Data) */}
      <section className="bg-white border-y border-[#E2E8E4] py-12 sm:py-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold tracking-wider text-[#9B7417] mb-1">
                Google Drive PDF စာကြည့်တိုက်
              </p>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1A241E]">
                နောက်ဆုံးတင်သွင်းထားသော စာအုပ်များ
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#146B3A] hover:text-[#0F522D] whitespace-nowrap shrink-0 self-start sm:self-auto"
            >
              <span>စာအုပ်အားလုံးကြည့်ရန်</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {featuredBooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D4DDD7] bg-[#F8FAF9] p-8 sm:p-10 text-center space-y-3">
              <FileText className="w-9 h-9 text-[#7A887F] mx-auto" />
              <p className="text-base font-semibold text-[#1A241E]">
                စာကြည့်တိုက်တွင် PDF စာအုပ်များ မတင်ရသေးပါ
              </p>
              <p className="text-sm text-[#5A6860] max-w-md mx-auto">
                Admin Panel မှတစ်ဆင့် Google Drive ထဲသို့ PDF စာအုပ်များ တင်သွင်းပြီးပါက
                ဤနေရာတွင် အလိုအလျောက် ပေါ်လာမည် ဖြစ်ပါသည်။
              </p>
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs font-semibold transition-colors"
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
                  className="group bg-[#F9FBFA] border border-[#E2E8E4] rounded-xl overflow-hidden flex flex-col transition-shadow duration-150 hover:shadow-md"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden border-b border-[#E2E8E4]">
                    <BookCoverFrame book={book} />
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <p className="text-[11.5px] font-medium text-[#9B7417] mb-1">
                      {book.categoryLabel}
                    </p>
                    <h3 className="text-sm font-semibold text-[#1A241E] leading-snug line-clamp-2 mb-1.5">
                      {book.title}
                    </h3>
                    <p className="text-xs text-[#5A6860] truncate mb-4">
                      {book.author}
                    </p>
                    <div className="mt-auto pt-3 border-t border-[#E8ECE9] flex items-center justify-between gap-2">
                      <span className="text-xs text-[#5A6860] tabular-nums">
                        {book.fileSize || 'PDF'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenBook(book)}
                        className="px-3.5 py-1.5 rounded-md bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs font-semibold transition-colors"
                      >
                        View
                      </button>
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
