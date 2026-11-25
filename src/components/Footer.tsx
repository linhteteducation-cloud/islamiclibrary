import {PageRoute, SiteSettings} from '../types/library';
import {PWAInstallButton} from './PWAInstallButton';

interface FooterProps {
  onNavigate: (page: PageRoute) => void;
  siteSettings: SiteSettings;
}

export function Footer({onNavigate, siteSettings}: FooterProps) {
  const isVisible = (id: string) => !siteSettings.hiddenSections.includes(id);

  return (
    <footer className="bg-[#0B152B] dark:bg-[#050A15] text-[#CBD5E1] border-t border-[#1D2F57] dark:border-[#192848] mt-16">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          <div className="md:col-span-5 space-y-3">
            <h3 className="font-serif text-xl font-bold text-white">
              Myanmar Muslim Library
            </h3>
            <p className="text-sm leading-[1.8] text-[#94A3B8] max-w-md">
              ဤ အခမဲ့ အွန်လိုင်း အစ္စလာမ့်စာကြည့်တိုက်တွင် ကုရ်အာန်ကျမ်းတော်မြတ်နှင့်ကိုယ်တော်မြတ် (ဆွ) ၏ မွန်မြတ်လှသော ဟဒီးစ်တော်များ၊ အစ္စလာမ့်ယုံကြည်ချက်အကီဒဟ်များ၊ သမိုင်းဖတ်စာများ၊ အစ္စလာမ်ရှရီအသ်ဥပဒေများ၊ ဒိုအာနှင့် အအ်မာလ်များ၊ ကိုယ်ကျင့်သီလနှင့် ကောင်ရာညွန်းကြားခြင်းများဆိုင်ရာ PDF စာအုပ်များနှင့် သုတေသနစာတမ်းများကို စုံလင်စွာ ဖတ်ရှုဒေါင်းလုဒ်ရယူနိုင်ပါသည်။
            </p>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <h4 className="text-xs font-semibold tracking-wider text-[#93C5FD]">
              အဓိကကဏ္ဍများ
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="hover:text-white transition-colors py-0.5"
                >
                  မူလစာမျက်နှာ
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('library')}
                  className="hover:text-white transition-colors py-0.5"
                >
                  စာကြည့်တိုက်
                </button>
              </li>
              {isVisible('duas') && (
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('duas')}
                    className="hover:text-white transition-colors py-0.5"
                  >
                    ဒိုအာနှင့်အအ်မာလ်များ
                  </button>
                </li>
              )}
              {isVisible('videos') && (
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('videos')}
                    className="hover:text-white transition-colors py-0.5"
                  >
                    ဗီဒီယိုများ
                  </button>
                </li>
              )}
            </ul>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <h4 className="text-xs font-semibold tracking-wider text-[#93C5FD]">
              စာပေနှင့် စီမံခန့်ခွဲမှု
            </h4>
            <ul className="space-y-2 text-sm">
              {isVisible('articles') && (
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('articles')}
                    className="hover:text-white transition-colors py-0.5"
                  >
                    သတင်းဆောင်းပါးများ
                  </button>
                </li>
              )}
              {isVisible('about') && (
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('about')}
                    className="hover:text-white transition-colors py-0.5"
                  >
                    ကျွန်ုပ်တို့အကြောင်း
                  </button>
                </li>
              )}
              {isVisible('publishing') && (
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('publishing')}
                    className="hover:text-white transition-colors py-0.5"
                  >
                    စာပေဖြန့်ချိရေး
                  </button>
                </li>
              )}
              {isVisible('contact') && (
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigate('contact')}
                    className="hover:text-white transition-colors py-0.5"
                  >
                    ဆက်သွယ်ရန်
                  </button>
                </li>
              )}
              <li>
                <PWAInstallButton variant="footer" />
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="text-[#93C5FD] hover:text-white transition-colors font-semibold py-0.5"
                >
                  Admin Panel
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#94A3B8]">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <p>© 2026 Myanmar Muslim Library • Developed by Junide Solaimani</p>

            <div
              className="flex items-center gap-1.5"
              aria-label="Junide Solaimani social profile links"
            >
              <a
                href="https://www.facebook.com/junidesolaimani"
                target="_blank"
                rel="noopener noreferrer"
                title="Facebook — Junide Solaimani"
                aria-label="Junide Solaimani on Facebook"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 hover:border-[#93C5FD]/40 text-[#CBD5E1] hover:text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4v2.2H8v3h2.5V21h3z" />
                </svg>
              </a>

              <a
                href="https://t.me/junidesolaimani"
                target="_blank"
                rel="noopener noreferrer"
                title="Telegram — Junide Solaimani"
                aria-label="Junide Solaimani on Telegram"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 hover:border-[#93C5FD]/40 text-[#CBD5E1] hover:text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M21.4 4.6 2.9 11.7c-1.3.5-1.3 1.2-.2 1.5l4.7 1.5 11-6.9c.5-.3 1-.1.6.2l-8.9 8-.3 4.8c.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.3-1.6z" />
                </svg>
              </a>

              <a
                href="https://github.com/junidesolaimani"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub — Junide Solaimani"
                aria-label="Junide Solaimani on GitHub"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 hover:border-[#93C5FD]/40 text-[#CBD5E1] hover:text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.4 9.4 0 0 1 12 6.85c.85 0 1.7.12 2.5.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.81 0 .27.18.6.69.49A10.22 10.22 0 0 0 22 12.23C22 6.58 17.52 2 12 2z" />
                </svg>
              </a>

              <a
                href="mailto:linhteteducation@gmail.com"
                title="Email — Junide Solaimani"
                aria-label="Email Junide Solaimani"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 hover:border-[#93C5FD]/40 text-[#CBD5E1] hover:text-white flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </a>
            </div>
          </div>

          <p className="font-[Amiri] text-base text-[#E2C792]" dir="rtl" lang="ar">
            وَقُل رَّبِّ زِدْنِي عِلْمًا
          </p>
        </div>
      </div>
    </footer>
  );
}
