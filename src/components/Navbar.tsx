import {useState} from 'react';
import {Menu, Shield, X} from 'lucide-react';
import {PageRoute, SiteSettings} from '../types/library';

interface NavbarProps {
  currentPage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  siteSettings: SiteSettings;
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

export function Navbar({currentPage, onNavigate, siteSettings}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleDesktopLinks = ALL_NAV_ITEMS.filter(
    (item) => !siteSettings.hiddenSections.includes(item.id),
  );

  const visibleMobileLinks = [...ALL_NAV_ITEMS, ...MOBILE_EXTRA_ITEMS].filter(
    (item) => !siteSettings.hiddenSections.includes(item.id),
  );

  const handleSelect = (page: PageRoute) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E2E8E4]">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('home')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146B3A] rounded-md py-1"
        >
          <span className="w-8 h-8 rounded-lg bg-[#146B3A] text-[#F2D675] flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <path d="M12 3c2.5 2.5 5 4.2 5 7.5a5 5 0 0 1-10 0C7 7.2 9.5 5.5 12 3Z" />
              <path d="M4 20h16" />
              <path d="M6 20v-6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6" />
            </svg>
          </span>
          <span className="font-serif text-base sm:text-lg font-bold tracking-tight text-[#115E34]">
            Myanmar Muslim Library
          </span>
        </button>

        {/* Zone 2: Desktop concise navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-6 text-[13.5px] font-medium text-[#46544B]"
        >
          {visibleDesktopLinks.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`relative py-2 whitespace-nowrap shrink-0 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146B3A] rounded-sm ${
                  isActive
                    ? 'text-[#115E34] font-semibold'
                    : 'hover:text-[#115E34]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-[#146B3A] rounded-full"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Admin Panel Primary Action & Mobile Drawer Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleSelect('admin')}
            className={`hidden lg:inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[13px] font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146B3A] ${
              currentPage === 'admin'
                ? 'bg-[#C59B27] text-white'
                : 'bg-[#146B3A] text-white hover:bg-[#0F522D]'
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
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-[#1A241E] hover:bg-[#EBF4EE] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146B3A]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#E2E8E4] bg-white shadow-lg">
          <nav
            aria-label="Mobile Navigation"
            className="max-w-[1320px] mx-auto px-4 py-3 grid grid-cols-1 gap-1"
          >
            {visibleMobileLinks.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full text-left px-3.5 min-h-[44px] rounded-lg text-sm font-medium flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-[#146B3A] text-white font-semibold'
                      : 'text-[#2D3B33] hover:bg-[#EBF4EE] hover:text-[#115E34]'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="text-xs opacity-90">လက်ရှိ</span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => handleSelect('admin')}
              className={`w-full text-left px-3.5 min-h-[44px] rounded-lg text-sm font-semibold flex items-center gap-2 mt-1 border-t border-[#EDF1EE] pt-2 transition-colors ${
                currentPage === 'admin'
                  ? 'bg-[#C59B27] text-white'
                  : 'text-[#115E34] hover:bg-[#EBF4EE]'
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
