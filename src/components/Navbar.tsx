import {useEffect, useMemo, useRef, useState} from 'react';
import {BookOpen, Menu, Scale, Search, Shield, X} from 'lucide-react';
import {getScriptFontClass} from '../lib/scriptFonts';
import {BookItem, PageRoute, SiteSettings} from '../types/library';
import {PWAInstallButton} from './PWAInstallButton';
import {ThemeToggle} from './ThemeToggle';

interface NavbarProps {
  currentPage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  siteSettings: SiteSettings;
  isAdmin?: boolean;
  pendingFatwaCount?: number;
  books: BookItem[];
  onOpenBook: (book: BookItem) => void;
}

const ALL_NAV_ITEMS: {id: PageRoute; label: string}[] = [
  {id: 'home', label: 'မူလစာမျက်နှာ'},
  {id: 'library', label: 'စာကြည့်တိုက်'},
  {id: 'duas', label: 'ဒိုအာများ'},
  {id: 'videos', label: 'ဗီဒီယိုများ'},
  {id: 'articles', label: 'သတင်းဆောင်းပါးများ'},
];

const MOBILE_EXTRA_ITEMS: {id: PageRoute; label: string}[] = [
  {id: 'about', label: 'ကျွန်ုပ်တို့အကြောင်း'},
  {id: 'publishing', label: 'စာပေဖြန့်ချိရေး'},
  {id: 'contact', label: 'ဆက်သွယ်ရန်'},
];

export function Navbar({
  currentPage,
  onNavigate,
  siteSettings,
  isAdmin = false,
  pendingFatwaCount = 0,
  books,
  onOpenBook,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const desktopSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  const visibleDesktopLinks = ALL_NAV_ITEMS.filter(
    (item) => !siteSettings.hiddenSections.includes(item.id),
  );

  const visibleMobileLinks = [...ALL_NAV_ITEMS, ...MOBILE_EXTRA_ITEMS].filter(
    (item) => !siteSettings.hiddenSections.includes(item.id),
  );

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const filteredBooks = useMemo(() => {
    if (!trimmedQuery) return [];
    return books.filter((book) => {
      const titleMatch = (book.title || '').toLowerCase().includes(trimmedQuery);
      const authorMatch = (book.author || '').toLowerCase().includes(trimmedQuery);
      return titleMatch || authorMatch;
    });
  }, [books, trimmedQuery]);

  const displayedResults = useMemo(
    () => filteredBooks.slice(0, 8),
    [filteredBooks],
  );

  useEffect(() => {
    setHighlightedIndex(0);
  }, [trimmedQuery]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const inDesktop = desktopSearchRef.current?.contains(target);
      const inMobile = mobileSearchRef.current?.contains(target);
      if (!inDesktop && !inMobile) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isMobileSearchOpen) {
      mobileInputRef.current?.focus();
    }
  }, [isMobileSearchOpen]);

  const handleSelect = (page: PageRoute) => {
    onNavigate(page);
    setMobileOpen(false);
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
  };

  const handleSelectBookResult = (book: BookItem) => {
    onOpenBook(book);
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    setMobileOpen(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setIsMobileSearchOpen(false);
      return;
    }
    if (displayedResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsSearchOpen(true);
      setHighlightedIndex((prev) =>
        prev + 1 >= displayedResults.length ? 0 : prev + 1,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsSearchOpen(true);
      setHighlightedIndex((prev) =>
        prev - 1 < 0 ? displayedResults.length - 1 : prev - 1,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = displayedResults[highlightedIndex] || displayedResults[0];
      if (target) {
        handleSelectBookResult(target);
      }
    }
  };

  const renderSearchResultsDropdown = (align: 'desktop' | 'mobile' = 'desktop') => {
    if (!isSearchOpen || !trimmedQuery) return null;

    return (
      <div
        role="listbox"
        aria-label="စာအုပ်ရှာဖွေမှု ရလဒ်များ"
        className={`absolute top-full mt-2 rounded-xl bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] shadow-2xl z-50 overflow-hidden ${
          align === 'mobile'
            ? 'left-0 right-0 w-full'
            : 'right-0 w-[min(92vw,390px)]'
        }`}
      >
        <div className="px-3.5 py-2.5 border-b border-[#EDF1EE] dark:border-[#1E2C4A] flex items-center justify-between text-xs text-[#525E75] dark:text-[#94A3B8]">
          <span>
            တွေ့ရှိသော စာအုပ်{' '}
            <strong className="text-[#131B2E] dark:text-[#F1F5F9] tabular-nums">
              {filteredBooks.length}
            </strong>{' '}
            အုပ်
          </span>
          {filteredBooks.length > displayedResults.length && (
            <button
              type="button"
              onClick={() => handleSelect('library')}
              className="text-[#146B3A] dark:text-[#6EE7B7] font-semibold hover:underline"
            >
              စာကြည့်တိုက်တွင် ကြည့်ရန်
            </button>
          )}
        </div>

        {displayedResults.length === 0 ? (
          <div className="px-4 py-6 text-center space-y-2">
            <p className="text-xs sm:text-sm text-[#525E75] dark:text-[#94A3B8]">
              “{searchQuery.trim()}” နှင့် ကိုက်ညီသော စာအုပ် သို့မဟုတ် စာရေးသူ မတွေ့ရှိပါ။
            </p>
            <button
              type="button"
              onClick={() => handleSelect('library')}
              className="text-xs font-semibold text-[#1D4ED8] dark:text-[#93C5FD] hover:underline"
            >
              စာကြည့်တိုက် စာအုပ်အားလုံး ကြည့်ရန်
            </button>
          </div>
        ) : (
          <div className="max-h-[340px] overflow-y-auto divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A]">
            {displayedResults.map((book, idx) => {
              const isHighlighted = idx === highlightedIndex;
              return (
                <button
                  key={book.id}
                  type="button"
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelectBookResult(book)}
                  className={`w-full text-left px-3.5 py-2.5 min-h-[54px] flex items-center justify-between gap-3 transition-colors ${
                    isHighlighted
                      ? 'bg-[#F1F5F9] dark:bg-[#131E36]'
                      : 'hover:bg-[#F8FAFC] dark:hover:bg-[#111A2E]'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p
                      className={`text-sm font-semibold text-[#131B2E] dark:text-[#F1F5F9] line-clamp-1 ${getScriptFontClass(book.title)}`}
                    >
                      {book.title}
                    </p>
                    <p className="text-xs text-[#525E75] dark:text-[#94A3B8] line-clamp-1">
                      <span className={getScriptFontClass(book.author)}>
                        {book.author || 'အမည်မသိ စာရေးသူ'}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span>{book.categoryLabel}</span>
                    </p>
                  </div>
                  <BookOpen className="w-4 h-4 text-[#146B3A] dark:text-[#6EE7B7] shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0D1830]/98 dark:bg-[#070E1E]/98 backdrop-blur-md border-b border-[#1D2F57] dark:border-[#192848]">
      {/* Subtle 5-color editorial hairline inspired by the curatorial spectrum */}
      <div aria-hidden="true" className="h-[3px] w-full grid grid-cols-5">
        <span className="bg-[#1D4ED8]" />
        <span className="bg-[#E06D2B]" />
        <span className="bg-[#DDA0BD]" />
        <span className="bg-[#7D8C3F]" />
        <span className="bg-[#A64B3E]" />
      </div>

      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 lg:gap-6">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('home')}
          className="flex items-center gap-2 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] rounded-sm py-1"
        >
          <span className="font-serif text-base sm:text-lg xl:text-xl font-bold tracking-tight text-white">
            Myanmar Muslim Library
          </span>
        </button>

        {/* Zone 2: Desktop concise single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-3.5 xl:gap-5 text-[12.5px] xl:text-[13.5px] font-medium text-[#CBD5E1]"
        >
          {visibleDesktopLinks.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative py-2 whitespace-nowrap shrink-0 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] rounded-sm ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-[#60A5FA]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Global Search Bar + Controls + Admin Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop / Tablet Global Book Search Bar */}
          <div
            ref={desktopSearchRef}
            className="hidden md:block relative w-44 lg:w-40 xl:w-56 2xl:w-64 shrink-0"
          >
            <Search
              aria-hidden="true"
              className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="search"
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="စာအုပ် / စာရေးသူ ရှာရန်..."
              aria-label="စာအုပ်အမည် သို့မဟုတ် စာရေးသူ ရှာဖွေရန်"
              className="w-full h-10 pl-9 pr-8 rounded-md bg-[#132242] dark:bg-[#0D1526] border border-[#243A6B] dark:border-[#1E2C4A] text-xs sm:text-[13px] text-white placeholder:text-[#94A3B8] focus:outline-none focus:border-[#60A5FA] focus:ring-1 focus:ring-[#60A5FA] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
                aria-label="ရှာဖွေမှု ရှင်းလင်းရန်"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded text-[#94A3B8] hover:text-white inline-flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {renderSearchResultsDropdown('desktop')}
          </div>

          {/* Mobile Quick Search Toggle Button (expands inside header without adding sticky height) */}
          <button
            type="button"
            onClick={() => {
              setIsMobileSearchOpen(true);
              setIsSearchOpen(true);
              setMobileOpen(false);
            }}
            aria-label="စာအုပ်ရှာဖွေရန်"
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-[#E2E8F0] hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
          >
            <Search className="w-4 h-4" />
          </button>

          <ThemeToggle variant="navbar" />
          <PWAInstallButton variant="header" />

          {isAdmin && (
            <button
              type="button"
              onClick={() => handleSelect('fatwa-admin')}
              className={`hidden lg:inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 text-[12.5px] xl:text-[13px] font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6EE7B7] ${
                currentPage === 'fatwa-admin'
                  ? 'bg-[#B85338] text-white'
                  : 'bg-[#146B3A] text-white hover:bg-[#0F522D]'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>
                ဖသ်ဝါဖြေကြားရန်
                {pendingFatwaCount > 0 ? ` (${pendingFatwaCount})` : ''}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSelect('admin')}
            className={`hidden lg:inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3.5 py-2 text-[12.5px] xl:text-[13px] font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] ${
              currentPage === 'admin'
                ? 'bg-[#B85338] text-white'
                : 'bg-[#1D4ED8] text-white hover:bg-[#1E40AF]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Panel</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'မီနူးပိတ်ရန်' : 'မီနူးဖွင့်ရန်'}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-md text-[#E2E8F0] hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Header Inline Search Overlay */}
        {isMobileSearchOpen && (
          <div
            ref={mobileSearchRef}
            className="md:hidden absolute inset-0 z-50 bg-[#0D1830] dark:bg-[#070E1E] px-4 flex items-center gap-2"
          >
            <div className="relative flex-1 min-w-0">
              <Search
                aria-hidden="true"
                className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                ref={mobileInputRef}
                type="search"
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="စာအုပ်အမည် / စာရေးသူ ရှာရန်..."
                aria-label="စာအုပ်အမည် သို့မဟုတ် စာရေးသူ ရှာဖွေရန်"
                className="w-full h-10 pl-9 pr-8 rounded-md bg-[#132242] dark:bg-[#0D1526] border border-[#3B82F6] text-sm text-white placeholder:text-[#94A3B8] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    mobileInputRef.current?.focus();
                  }}
                  aria-label="ရှာဖွေမှု ရှင်းလင်းရန်"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded text-[#94A3B8] hover:text-white inline-flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              {renderSearchResultsDropdown('mobile')}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsMobileSearchOpen(false);
                setIsSearchOpen(false);
              }}
              aria-label="ရှာဖွေမှု ပိတ်ရန်"
              className="min-h-[40px] px-3 rounded-md text-xs font-semibold text-[#CBD5E1] hover:text-white hover:bg-white/10 shrink-0"
            >
              ပိတ်ရန်
            </button>
          </div>
        )}
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#1D2F57] bg-[#0D1830] shadow-xl">
          <nav
            aria-label="Mobile Navigation"
            className="max-w-[1400px] mx-auto px-4 py-3 grid grid-cols-1 gap-1"
          >
            {visibleMobileLinks.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full text-left px-3.5 min-h-[44px] rounded-md text-sm font-medium flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-[#1D4ED8] text-white font-semibold'
                      : 'text-[#E2E8F0] hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="text-xs text-[#DBEAFE]">လက်ရှိ</span>
                  )}
                </button>
              );
            })}

            <div className="pt-1 space-y-1.5">
              <ThemeToggle variant="drawer" />
              <PWAInstallButton
                variant="drawer"
                onAfterAction={() => setMobileOpen(false)}
              />
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => handleSelect('fatwa-admin')}
                className={`w-full text-left px-3.5 min-h-[44px] rounded-md text-sm font-semibold flex items-center gap-2 mt-1 border-t border-[#1D2F57] pt-2.5 transition-colors ${
                  currentPage === 'fatwa-admin'
                    ? 'bg-[#B85338] text-white'
                    : 'text-[#6EE7B7] hover:bg-white/8 hover:text-white'
                }`}
              >
                <Scale className="w-4 h-4" />
                <span>
                  ဖသ်ဝါဖြေကြားရန်
                  {pendingFatwaCount > 0 ? ` (${pendingFatwaCount})` : ''}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSelect('admin')}
              className={`w-full text-left px-3.5 min-h-[44px] rounded-md text-sm font-semibold flex items-center gap-2 ${
                isAdmin ? '' : 'mt-1 border-t border-[#1D2F57] pt-2.5'
              } transition-colors ${
                currentPage === 'admin'
                  ? 'bg-[#B85338] text-white'
                  : 'text-[#93C5FD] hover:bg-white/8 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Admin Panel</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
