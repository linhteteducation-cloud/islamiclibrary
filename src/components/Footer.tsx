import {Globe, Mail, MessageSquare, Phone} from 'lucide-react';
import {sanitizeContactLinks} from '../lib/firestoreService';
import {PageRoute, SiteSettings} from '../types/library';
import {PWAInstallButton} from './PWAInstallButton';

interface FooterProps {
  onNavigate: (page: PageRoute) => void;
  siteSettings: SiteSettings;
}

export function Footer({onNavigate, siteSettings}: FooterProps) {
  const isVisible = (id: string) => !siteSettings.hiddenSections.includes(id);
  const contactLinks = sanitizeContactLinks(siteSettings.contactLinks);

  const buttonClass =
    'min-h-[38px] px-3 py-1.5 rounded-lg bg-[#132242] hover:bg-[#1C3260] border border-white/15 hover:border-[#93C5FD]/50 text-[#E2E8F0] hover:text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]';

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
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('fatwa')}
                  className="hover:text-white transition-colors py-0.5"
                >
                  ဖသ်ဝါမေးမြန်းရန်
                </button>
              </li>
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

        {/* Bottom Contact Buttons Box & Copyright */}
        <div className="mt-10 rounded-xl bg-white/[0.04] border border-white/10 p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <span className="text-xs font-semibold tracking-wide text-[#93C5FD] shrink-0">
              ဆက်သွယ်ရန် (Contact & Social Links)
            </span>

            <div
              className="flex flex-wrap items-center gap-2"
              aria-label="Contact and social media buttons"
            >
              {contactLinks.facebook && (
                <a
                  href={contactLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Facebook — ${contactLinks.facebook}`}
                  aria-label="Contact on Facebook"
                  className={buttonClass}
                >
                  <svg
                    className="w-4 h-4 text-[#93C5FD] shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4v2.2H8v3h2.5V21h3z" />
                  </svg>
                  <span>Facebook</span>
                </a>
              )}

              {contactLinks.telegram && (
                <a
                  href={contactLinks.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Telegram — ${contactLinks.telegram}`}
                  aria-label="Contact on Telegram"
                  className={buttonClass}
                >
                  <svg
                    className="w-4 h-4 text-[#7DD3FC] shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M21.4 4.6 2.9 11.7c-1.3.5-1.3 1.2-.2 1.5l4.7 1.5 11-6.9c.5-.3 1-.1.6.2l-8.9 8-.3 4.8c.5 0 .7-.2 1-.5l2.3-2.2 4.8 3.5c.9.5 1.5.2 1.7-.8l3.1-14.6c.3-1.3-.5-1.9-1.3-1.6z" />
                  </svg>
                  <span>Telegram</span>
                </a>
              )}

              {contactLinks.youtube && (
                <a
                  href={contactLinks.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`YouTube — ${contactLinks.youtube}`}
                  aria-label="YouTube Channel"
                  className={buttonClass}
                >
                  <svg
                    className="w-4 h-4 text-[#FCA5A5] shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.8 4.7 12 4.7 12 4.7s-5.8 0-7.6.5a2.8 2.8 0 0 0-2 2A29.7 29.7 0 0 0 2 12a29.7 29.7 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.8.5 7.6.5 7.6.5s5.8 0 7.6-.5a2.8 2.8 0 0 0 2-2A29.7 29.7 0 0 0 22 12a29.7 29.7 0 0 0-.4-4.8zM10 15.2V8.8l5.5 3.2-5.5 3.2z" />
                  </svg>
                  <span>YouTube</span>
                </a>
              )}

              {contactLinks.whatsapp && (
                <a
                  href={contactLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`WhatsApp — ${contactLinks.whatsapp}`}
                  aria-label="Contact on WhatsApp"
                  className={buttonClass}
                >
                  <svg
                    className="w-4 h-4 text-[#6EE7B7] shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12.04 2a9.94 9.94 0 0 0-8.5 15.07L2 22l5.08-1.48A9.95 9.95 0 1 0 12.04 2zm5.8 14.12c-.25.7-1.43 1.34-1.97 1.42-.52.08-1.18.11-1.9-.12-.44-.14-1-.33-1.72-.64-3.02-1.3-4.99-4.35-5.14-4.55-.15-.2-1.23-1.64-1.23-3.12 0-1.48.78-2.2 1.05-2.5.28-.3.6-.38.8-.38h.58c.18 0 .43-.07.67.52.25.6.85 2.08.92 2.23.08.15.13.33.03.53-.1.2-.15.33-.3.5-.15.18-.32.4-.45.53-.15.15-.3.32-.13.62.18.3.78 1.29 1.68 2.09 1.15 1.03 2.13 1.35 2.43 1.5.3.15.48.13.65-.08.18-.2.75-.88.95-1.18.2-.3.4-.25.68-.15.28.1 1.76.83 2.06.98.3.15.5.23.58.35.07.13.07.73-.18 1.43z" />
                  </svg>
                  <span>WhatsApp</span>
                </a>
              )}

              {contactLinks.phone && (
                <a
                  href={`tel:${contactLinks.phone.replace(/\s+/g, '')}`}
                  title={`Phone — ${contactLinks.phone}`}
                  aria-label={`Call ${contactLinks.phone}`}
                  className={buttonClass}
                >
                  <Phone className="w-4 h-4 text-[#6EE7B7] shrink-0" />
                  <span>{contactLinks.phone}</span>
                </a>
              )}

              {contactLinks.email && (
                <a
                  href={`mailto:${contactLinks.email}`}
                  title={`Email — ${contactLinks.email}`}
                  aria-label={`Send email to ${contactLinks.email}`}
                  className={buttonClass}
                >
                  <Mail className="w-4 h-4 text-[#FCD34D] shrink-0" />
                  <span>Email</span>
                </a>
              )}

              {contactLinks.website && (
                <a
                  href={contactLinks.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Website — ${contactLinks.website}`}
                  aria-label="Open Website"
                  className={buttonClass}
                >
                  <Globe className="w-4 h-4 text-[#93C5FD] shrink-0" />
                  <span>Website</span>
                </a>
              )}

              {contactLinks.github && (
                <a
                  href={contactLinks.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`GitHub — ${contactLinks.github}`}
                  aria-label="GitHub Profile"
                  className={buttonClass}
                >
                  <svg
                    className="w-4 h-4 text-[#CBD5E1] shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.2-3.37-1.2-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.35 1.12 2.92.85.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.4 9.4 0 0 1 12 6.85c.85 0 1.7.12 2.5.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.81 0 .27.18.6.69.49A10.22 10.22 0 0 0 22 12.23C22 6.58 17.52 2 12 2z" />
                  </svg>
                  <span>GitHub</span>
                </a>
              )}

              {isVisible('contact') && (
                <button
                  type="button"
                  onClick={() => onNavigate('contact')}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#146B3A]/35 hover:bg-[#146B3A]/60 border border-[#34D399]/35 text-[#A7F3D0] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#34D399]"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                  <span>စာပို့ဆက်သွယ်ရန်</span>
                </button>
              )}
            </div>
          </div>

          <div className="pt-3.5 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[#94A3B8]">
            <p className="text-center md:text-left">
              © 2026 Myanmar Muslim Library • Developed by Junide Solaimani
            </p>
            <p className="font-[Amiri] text-base text-[#E2C792]" dir="rtl" lang="ar">
              وَقُل رَّبِّ زِدْنِي عِلْمًا
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
