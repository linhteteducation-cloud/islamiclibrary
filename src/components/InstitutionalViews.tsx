import {useState} from 'react';
import {
  BookOpen,
  CheckCircle2,
  Mail,
  MapPin,
  Printer,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {COVER_IMAGES} from '../data/libraryData';
import {submitContactMessage} from '../lib/firestoreService';
import {PageRoute} from '../types/library';

export function AboutView({onNavigate}: {onNavigate: (p: PageRoute) => void}) {
  return (
    <div>
      <section className="islamic-lattice-bg relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 islamic-pattern-overlay pointer-events-none"
        />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 text-white">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">
            ကျွန်ုပ်တို့အကြောင်း
          </h1>
          <p className="text-sm sm:text-[15px] text-[#DCE4F2] max-w-2xl leading-[1.8]">
            Myanmar Muslim Library ၏ ရည်မှန်းချက်နှင့် စာပေထိန်းသိမ်းရေး လုပ်ငန်းစဉ်များ
          </p>
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl p-5 sm:p-8">
          <div className="lg:col-span-6 rounded-xl overflow-hidden aspect-[16/10] bg-[#EFF2F7] dark:bg-[#131E36]">
            <img
              src={COVER_IMAGES.libraryFeature}
              alt="Islamic Library Study Room"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="lg:col-span-6 space-y-4">
            <p className="text-xs font-semibold text-[#B85338] dark:text-[#F0947A]">
              Myanmar Muslim Library
            </p>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#131B2E] dark:text-[#F1F5F9] leading-snug">
              စစ်မှန်သော အစ္စလာမ့်အသိပညာများကို အခမဲ့ မျှဝေပေးခြင်း
            </h2>
            <p className="text-sm sm:text-[15px] leading-[1.85] text-[#475569] dark:text-[#CBD5E1]">
              ဤအွန်လိုင်းစာကြည့်တိုက်သည် မြန်မာမွတ်စလင်မ် ပညာရှင်ကြီးများ၊ စာရေးဆရာများနှင့်
              ဘာသာပြန်သူများ ပြုစုခဲ့သော ကုရ်အာန်သဖ်စီးရ်၊ အဲဟ်လေဗိုက်သ် (အ.စ) ၏ ဟဒီးစ်တော်များ၊
              သမိုင်း၊ ရှရီအသ်ဥပဒေနှင့် လစဉ်ထုတ် စာစောင်များကို Google Drive PDF စနစ်ဖြင့်
              စနစ်တကျ သိမ်းဆည်းမျှဝေပေးနေသော ဒစ်ဂျစ်တယ်စာကြည့်တိုက် ဖြစ်ပါသည်။
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('library')}
                className="min-h-[42px] px-5 py-2 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#3B82F6] text-white text-sm font-semibold transition-colors"
              >
                စာကြည့်တိုက်သို့ သွားရန်
              </button>
              <button
                type="button"
                onClick={() => onNavigate('publishing')}
                className="min-h-[42px] px-5 py-2 rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-[#EFF3FA] dark:hover:bg-[#1A2A4A] text-[#131B2E] dark:text-[#E2E8F0] text-sm font-semibold transition-colors"
              >
                စာပေဖြန့်ချိရေး ကြည့်ရန်
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: BookOpen,
              title: 'အခမဲ့ လေ့လာဖတ်ရှုနိုင်မှု',
              desc: 'မည်သည့် PDF စာအုပ်နှင့် စာစောင်ကိုမဆို PC နှင့် ဖုန်းများမှ အချိန်မရွေး ဖတ်ရှုဒေါင်းလုဒ်ရယူနိုင်ပါသည်။',
            },
            {
              icon: ShieldCheck,
              title: 'Google Drive သိုလှောင်မှု',
              desc: 'PDF စာအုပ်ဖိုင်များကို Google Drive တွင် လုံခြုံစွာ သိမ်းဆည်းထားသဖြင့် မြန်ဆန်စွာ ဖတ်ရှုနိုင်ပါသည်။',
            },
            {
              icon: Printer,
              title: 'စနစ်တကျ စီမံခန့်ခွဲမှု',
              desc: 'Admin Panel မှတစ်ဆင့် စာအုပ်များနှင့် ကဏ္ဍများကို အချိန်နှင့်တစ်ပြေးညီ စီမံထိန်းသိမ်းပေးပါသည်။',
            },
          ].map((card) => (
            <div
              key={card.title}
              className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl p-6 space-y-2.5"
            >
              <div className="w-10 h-10 rounded-lg bg-[#EFF3FA] dark:bg-[#131E36] text-[#1E3A8A] dark:text-[#60A5FA] flex items-center justify-center">
                <card.icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#131B2E] dark:text-[#F1F5F9]">{card.title}</h3>
              <p className="text-sm text-[#525E75] dark:text-[#94A3B8] leading-[1.8]">{card.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PublishingView({onNavigate}: {onNavigate: (p: PageRoute) => void}) {
  return (
    <div>
      <section className="islamic-lattice-bg relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 islamic-pattern-overlay pointer-events-none"
        />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 text-white">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">စာပေဖြန့်ချိရေး</h1>
          <p className="text-sm sm:text-[15px] text-[#DCE4F2] max-w-2xl leading-[1.8]">
            အစ္စလာမ့်စာပေများ ပုံနှိပ်ထုတ်ဝေခြင်း၊ ဘာသာပြန်ဆိုခြင်းနှင့် PDF ဖြန့်ဝေခြင်း
          </p>
        </div>
      </section>

      <section className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-6">
        <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl p-6 sm:p-8 space-y-5">
          <h2 className="font-serif text-xl font-bold text-[#131B2E] dark:text-[#F1F5F9]">
            စာမူပေးပို့ခြင်းနှင့် စာပေကူညီဖြန့်ဝေခြင်း
          </h2>
          <p className="text-sm sm:text-[15px] text-[#475569] dark:text-[#CBD5E1] leading-[1.85]">
            သင်၏ ဘာသာပြန်စာမူများ၊ သုတေသနစာတမ်းများ သို့မဟုတ် မြန်မာအစ္စလာမ့်
            စာအုပ် PDF များကို ဒစ်ဂျစ်တယ်စနစ်ဖြင့် ထိန်းသိမ်းမျှဝေလိုပါက ကျွန်ုပ်တို့ထံ
            ဆက်သွယ်ပေးပို့နိုင်ပါသည်။
          </p>

          <div className="pt-3">
            <button
              type="button"
              onClick={() => onNavigate('contact')}
              className="min-h-[42px] px-5 py-2 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#3B82F6] text-white text-sm font-semibold transition-colors"
            >
              စာမူပေးပို့ရန် ဆက်သွယ်မေးမြန်းပါ
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function ContactView() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [subject, setSubject] = useState('စာအုပ်တောင်းဆိုရန်');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      await submitContactMessage({name, contact, subject, message});
      setSubmitted(true);
      setName('');
      setContact('');
      setMessage('');
    } catch {
      setErrorMsg('မက်ဆေ့ချ် ပေးပို့ရာတွင် အခက်အခဲရှိနေပါသည်။ ခေတ္တနေပြီး ထပ်မံကြိုးစားပါ။');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <section className="islamic-lattice-bg relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 islamic-pattern-overlay pointer-events-none"
        />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 text-white">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">ဆက်သွယ်ရန်</h1>
          <p className="text-sm sm:text-[15px] text-[#DCE4F2] max-w-2xl leading-[1.8]">
            စာအုပ်တောင်းဆိုခြင်း၊ စာမူပေးပို့ခြင်းနှင့် အကြံပြုချက်များအတွက် ဆက်သွယ်နိုင်ပါသည်။
          </p>
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl p-6 space-y-5">
              <h2 className="text-lg font-bold text-[#131B2E] dark:text-[#F1F5F9]">
                စာကြည့်တိုက် ဆက်သွယ်ရေး
              </h2>
              <div className="space-y-4 text-sm text-[#475569] dark:text-[#CBD5E1]">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#1E3A8A] dark:text-[#60A5FA] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#131B2E] dark:text-[#F1F5F9]">တည်နေရာ</p>
                    <p>မြန်မာနိုင်ငံ</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-[#1E3A8A] dark:text-[#60A5FA] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-[#131B2E] dark:text-[#F1F5F9]">Admin Contact</p>
                    <p>linhteteducation@gmail.com</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl p-6 sm:p-8">
            {submitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#EFF3FA] dark:bg-[#131E36] text-[#1E3A8A] dark:text-[#60A5FA] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-[#131B2E] dark:text-[#F1F5F9]">
                  သင့်မက်ဆေ့ချ်ကို Admin ထံ ပေးပို့ပြီးပါပြီ
                </h3>
                <p className="text-sm text-[#525E75] dark:text-[#94A3B8] max-w-md mx-auto">
                  စာကြည့်တိုက် Admin Panel တွင် လက်ခံရရှိပြီး မကြာမီ ပြန်လည်ဆက်သွယ်ပေးပါမည်။
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="mt-2 px-4 py-2 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#172D6B] dark:hover:bg-[#3B82F6]"
                >
                  နောက်ထပ်မက်ဆေ့ချ်ပို့ရန်
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-lg font-bold text-[#131B2E] dark:text-[#F1F5F9] mb-1">
                  မက်ဆေ့ချ် ပေးပို့ရန်
                </h2>

                {errorMsg && (
                  <p className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300">
                    {errorMsg}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                    >
                      အမည် *
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="သင့်အမည် ထည့်သွင်းပါ"
                      className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#F6F7FA] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA] focus:bg-white dark:focus:bg-[#131E36]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                    >
                      အီးမေးလ် (သို့) ဖုန်းနံပါတ်
                    </label>
                    <input
                      id="contact-email"
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#F6F7FA] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA] focus:bg-white dark:focus:bg-[#131E36]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact-subject"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                  >
                    အကြောင်းအရာ
                  </label>
                  <select
                    id="contact-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#F6F7FA] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA] focus:bg-white dark:focus:bg-[#131E36]"
                  >
                    <option value="စာအုပ်တောင်းဆိုရန်">စာအုပ်တောင်းဆိုရန်</option>
                    <option value="စာမူပေးပို့ရန်">စာမူပေးပို့ရန်</option>
                    <option value="အကြံပြုချက်ပေးရန်">အကြံပြုချက်ပေးရန်</option>
                    <option value="အထွေထွေမေးမြန်းရန်">အထွေထွေမေးမြန်းရန်</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="contact-msg"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1.5"
                  >
                    အသေးစိတ်အကြောင်းအရာ *
                  </label>
                  <textarea
                    id="contact-msg"
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="မေးမြန်းလိုသည်များကို ဤနေရာတွင် ရေးသားပါ..."
                    className="w-full px-3.5 py-2.5 text-sm bg-[#F6F7FA] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA] focus:bg-white dark:focus:bg-[#131E36]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#3B82F6] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-60"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'ပေးပို့နေပါသည်...' : 'ပေးပို့ရန်'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
