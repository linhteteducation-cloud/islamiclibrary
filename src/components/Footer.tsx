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

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#94A3B8]">
          <p>© 2026 Myanmar Muslim Library • Developed by Junide Solaimani</p>
          <p className="font-[Amiri] text-base text-[#E2C792]" dir="rtl">
            وَقُل رَّبِّ زِدْنِي عِلْمًا
          </p>
        </div>
      </div>
    </footer>
  );
}
