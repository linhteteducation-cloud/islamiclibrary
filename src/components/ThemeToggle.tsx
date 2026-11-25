import {Moon, Sun} from 'lucide-react';
import {useTheme} from '../hooks/useTheme';

interface ThemeToggleProps {
  variant?: 'navbar' | 'drawer' | 'surface';
}

export function ThemeToggle({variant = 'navbar'}: ThemeToggleProps) {
  const {isDark, toggleTheme} = useTheme();

  if (variant === 'drawer') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-pressed={isDark}
        className="w-full text-left px-3.5 min-h-[44px] rounded-md text-sm font-medium flex items-center justify-between gap-2 text-[#E2E8F0] bg-[#13203E] hover:bg-[#1B2C54] transition-colors"
      >
        <span className="flex items-center gap-2">
          {isDark ? (
            <Sun className="w-4 h-4 text-[#E2C792]" />
          ) : (
            <Moon className="w-4 h-4 text-[#93C5FD]" />
          )}
          <span>
            {isDark
              ? 'နေ့ဘက်အလင်းစနစ် (Light Mode)'
              : 'ညဖတ်အမှောင်စနစ် (Dark Mode)'}
          </span>
        </span>
        <span className="text-[11px] font-semibold text-[#93C5FD] shrink-0">
          {isDark ? 'ON' : 'OFF'}
        </span>
      </button>
    );
  }

  if (variant === 'surface') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-pressed={isDark}
        aria-label={isDark ? 'Light mode သို့ပြောင်းရန်' : 'Dark mode သို့ပြောင်းရန်'}
        title={isDark ? 'Light Mode ပြောင်းရန်' : 'Dark Mode (ညဖတ်စနစ်) ပြောင်းရန်'}
        className="min-h-[40px] px-3 rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-white dark:bg-[#131E36] text-[#334155] dark:text-[#F1F5F9] hover:bg-[#EFF3FA] dark:hover:bg-[#1B2A4A] inline-flex items-center gap-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA]"
      >
        {isDark ? (
          <>
            <Sun className="w-4 h-4 text-[#FBBF24]" />
            <span className="hidden sm:inline">Light</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-[#1E3A8A]" />
            <span className="hidden sm:inline">Dark</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={isDark ? 'Light mode သို့ပြောင်းရန်' : 'Dark mode သို့ပြောင်းရန်'}
      title={isDark ? 'Light Mode ပြောင်းရန်' : 'Dark Mode (ညဖတ်စနစ်) ပြောင်းရန်'}
      className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-[#1D2F57] bg-[#13203E] hover:bg-[#1B2C54] text-[#E2E8F0] transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
    >
      {isDark ? (
        <Sun className="w-4 h-4 text-[#FBBF24]" />
      ) : (
        <Moon className="w-4 h-4 text-[#93C5FD]" />
      )}
    </button>
  );
}
