import {useState} from 'react';
import {Menu, Shield, X} from 'lucide-react';
import {PageRoute, SiteSettings} from '../types/library';
import {PWAInstallButton} from './PWAInstallButton';
import {ThemeToggle} from './ThemeToggle';

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
    <header className="sticky top-0 z-40 bg-[#0D1830]/98 dark:bg-[#070E1E]/98 backdrop-blur-md border-b border-[#1D2F57] dark:border-[#192848]">
      {/* Subtle 5-color editorial hairline inspired by the curatorial spectrum */}
      <div aria-hidden="true" className="h-[3px] w-full grid grid-cols-5">
        <span className="bg-[#1D4ED8]" />
        <span className="bg-[#E06D2B]" />
        <span className="bg-[#DDA0BD]" />
        <span className="bg-[#7D8C3F]" />
        <span className="bg-[#A64B3E]" />
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: Brand wordmark */}
        <button
          type="button"
          onClick={() => handleSelect('home')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] rounded-sm py-1"
        >
          <span className="font-serif text-lg sm:text-xl font-bold tracking-tight text-white">
            Myanmar Muslim Library
          </span>
        </button>

        {/* Zone 2: Desktop concise single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden lg:flex items-center gap-7 text-[13.5px] font-medium text-[#CBD5E1]"
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

        {/* Zone 3: Theme Toggle, PWA Install, Admin Panel Primary Action & Mobile Drawer Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <ThemeToggle variant="navbar" />
          <PWAInstallButton variant="header" />

          <button
            type="button"
            onClick={() => handleSelect('admin')}
            className={`hidden lg:inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 text-[13px] font-semibold rounded-md whitespace-nowrap shrink-0 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] ${
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
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#1D2F57] bg-[#0D1830] shadow-xl">
          <nav
            aria-label="Mobile Navigation"
            className="max-w-[1280px] mx-auto px-4 py-3 grid grid-cols-1 gap-1"
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

            <button
              type="button"
              onClick={() => handleSelect('admin')}
              className={`w-full text-left px-3.5 min-h-[44px] rounded-md text-sm font-semibold flex items-center gap-2 mt-1 border-t border-[#1D2F57] pt-2.5 transition-colors ${
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
