import {useEffect, useState} from 'react';

export type AppTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'mml_theme_v1';
const themeListeners = new Set<(theme: AppTheme) => void>();

function getInitialTheme(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  if (document.documentElement.classList.contains('dark')) {
    return 'dark';
  }
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  } catch {
    // Ignore storage access errors
  }
  return 'light';
}

function applyThemeToDom(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'dark';
  document.documentElement.classList.toggle('dark', isDark);
  const themeMeta = document.head.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (themeMeta) {
    themeMeta.setAttribute('content', isDark ? '#060B17' : '#0B1B35');
  }
}

export function setAppTheme(nextTheme: AppTheme): void {
  applyThemeToDom(nextTheme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // Ignore storage quota errors
  }
  themeListeners.forEach((listener) => listener(nextTheme));
}

export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>(getInitialTheme);

  useEffect(() => {
    applyThemeToDom(theme);
    const onThemeChange = (next: AppTheme) => setThemeState(next);
    themeListeners.add(onThemeChange);

    const onStorage = (e: StorageEvent) => {
      if (
        e.key === THEME_STORAGE_KEY &&
        (e.newValue === 'light' || e.newValue === 'dark')
      ) {
        applyThemeToDom(e.newValue);
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      themeListeners.delete(onThemeChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [theme]);

  const toggleTheme = () => {
    setAppTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return {
    theme,
    isDark: theme === 'dark',
    setTheme: setAppTheme,
    toggleTheme,
  };
}
