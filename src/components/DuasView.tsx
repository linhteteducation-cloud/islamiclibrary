import {useState} from 'react';
import {Check, Copy, HeartHandshake, RotateCcw, Sparkles} from 'lucide-react';
import {DuaItem} from '../types/library';

const DUA_CATEGORIES: Array<'အားလုံး' | DuaItem['categoryMy']> = [
  'အားလုံး',
  'နေ့စဉ်ဒိုအာ',
  'အထူးအအ်မာလ်',
  'မုနာဂျာသ်',
  'ကုရ်အာန်လာဒိုအာ',
];

const DHIKR_PHRASES = [
  {
    id: 'subhanallah',
    ar: 'سُبْحَانَ اللّٰهِ',
    my: 'စုဗ်ဟာနလ္လာဟ် (အလ္လာဟ်အရှင်မြတ် သန့်ရှင်းစင်ကြယ်တော်မူပါ၏)',
  },
  {
    id: 'alhamdulillah',
    ar: 'اَلْحَمْدُ لِلّٰهِ',
    my: 'အလ်ဟမ်ဒုလိလ္လာဟ် (ချီးမွမ်းခြင်းအပေါင်းသည် အလ္လာဟ်အရှင်မြတ်အတွက်သာ)',
  },
  {
    id: 'allahuakbar',
    ar: 'اَللّٰهُ أَكْبَرُ',
    my: 'အလ္လာဟုအက်ဗရ် (အလ္လာဟ်အရှင်မြတ်သည် အကြီးမြတ်ဆုံးဖြစ်တော်မူ၏)',
  },
];

export function DuasView({duas}: {duas: DuaItem[]}) {
  const [selectedCat, setSelectedCat] = useState<'အားလုံး' | DuaItem['categoryMy']>('အားလုံး');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dhikrIdx, setDhikrIdx] = useState(0);
  const [tasbihCount, setTasbihCount] = useState(0);
  const [tasbihTarget, setTasbihTarget] = useState<33 | 99>(33);

  const visibleDuas =
    selectedCat === 'အားလုံး'
      ? duas
      : duas.filter((d) => d.categoryMy === selectedCat);

  const handleCopyArabic = async (dua: DuaItem) => {
    try {
      await navigator.clipboard.writeText(`${dua.arabic}\n\n${dua.meaningMy}`);
      setCopiedId(dua.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(dua.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const activeDhikr = DHIKR_PHRASES[dhikrIdx];

  return (
    <div>
      <section className="islamic-lattice-bg relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 islamic-pattern-overlay pointer-events-none"
        />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 text-white">
          <p
            dir="rtl"
            className="font-[Amiri] text-xl sm:text-2xl text-[#E2C792] mb-2"
          >
            ادْعُونِي أَسْتَجِبْ لَكُمْ
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">
            ဒိုအာနှင့် အအ်မာလ်များ
          </h1>
          <p className="text-sm sm:text-[15px] text-[#DCE4F2] max-w-2xl leading-[1.8]">
            နေ့စဉ်ဘဝနှင့် မြင့်မြတ်သော အခါသမယများတွင် ရွတ်ဖတ်ပွားများနိုင်သည့်
            ဒိုအာများကို အာရဗီစာသားနှင့် မြန်မာအနက်အဓိပ္ပာယ်ဖြင့် စုစည်းတင်ပြထားပါသည်။
          </p>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          <div className="lg:col-span-8 space-y-5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {DUA_CATEGORIES.map((cat) => {
                const active = selectedCat === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCat(cat)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs sm:text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-white font-semibold'
                        : 'bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#EFF3FA] dark:hover:bg-[#131E36]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {visibleDuas.length === 0 ? (
              <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl p-10 text-center space-y-2">
                <HeartHandshake className="w-9 h-9 text-[#64748B] dark:text-[#94A3B8] mx-auto" />
                <p className="text-base font-semibold text-[#131B2E] dark:text-[#F1F5F9]">
                  ဒိုအာများ မထည့်သွင်းရသေးပါ
                </p>
                <p className="text-sm text-[#525E75] dark:text-[#94A3B8]">
                  Admin Panel မှတစ်ဆင့် ဒိုအာအသစ်များ ထည့်သွင်းနိုင်ပါသည်။
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleDuas.map((dua) => (
                  <article
                    key={dua.id}
                    className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-[#B85338] dark:text-[#F0947A] mb-1">
                          {dua.categoryMy}
                          {dua.source ? ` · ${dua.source}` : ''}
                        </p>
                        <h2 className="text-base sm:text-lg font-bold text-[#131B2E] dark:text-[#F1F5F9]">
                          {dua.titleMy}
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyArabic(dua)}
                        className="min-h-[40px] px-3.5 py-1.5 rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-[#F6F7FA] dark:bg-[#131E36] hover:bg-[#EFF3FA] dark:hover:bg-[#1A2A4A] text-xs font-semibold text-[#1E3A8A] dark:text-[#93C5FD] inline-flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        {copiedId === dua.id ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>ကူးယူပြီး</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>စာသားကူးရန်</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div
                      dir="rtl"
                      className="bg-[#F8F9FC] dark:bg-[#091020] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl px-5 py-5 text-right font-[Amiri] text-2xl sm:text-[28px] leading-[2.1] text-[#0F2357] dark:text-[#F3DFB1]"
                    >
                      {dua.arabic}
                    </div>

                    <div className="space-y-2 text-sm">
                      {dua.transliteration && (
                        <p className="text-[#525E75] dark:text-[#94A3B8] italic">
                          <span className="font-semibold not-italic text-[#131B2E] dark:text-[#E2E8F0]">
                            အသံထွက် —{' '}
                          </span>
                          {dua.transliteration}
                        </p>
                      )}
                      <p className="text-[#1E293B] dark:text-[#CBD5E1] leading-[1.85]">
                        <span className="font-semibold text-[#1E3A8A] dark:text-[#93C5FD]">
                          အနက်အဓိပ္ပာယ် —{' '}
                        </span>
                        {dua.meaningMy}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 lg:sticky lg:top-20">
            <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#EFF2F7] dark:border-[#1E2C4A] pb-3.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#B85338] dark:text-[#F0947A]" />
                  <h3 className="text-base font-bold text-[#131B2E] dark:text-[#F1F5F9]">
                    တစ်စဗီဟ် (ဇိကိရ် မှတ်တမ်း)
                  </h3>
                </div>
                <div className="flex items-center gap-1 bg-[#EFF2F7] dark:bg-[#131E36] p-0.5 rounded-md">
                  {([33, 99] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTasbihTarget(t)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded tabular-nums transition-colors ${
                        tasbihTarget === t
                          ? 'bg-white dark:bg-[#2563EB] text-[#1E3A8A] dark:text-white shadow-xs'
                          : 'text-[#525E75] dark:text-[#94A3B8]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {DHIKR_PHRASES.map((phrase, idx) => (
                  <button
                    key={phrase.id}
                    type="button"
                    onClick={() => {
                      setDhikrIdx(idx);
                      setTasbihCount(0);
                    }}
                    className={`py-2 px-2 rounded-lg text-center border transition-colors ${
                      dhikrIdx === idx
                        ? 'bg-[#EFF3FA] dark:bg-[#1A2A4A] border-[#1E3A8A]/40 dark:border-[#60A5FA]/50 text-[#1E3A8A] dark:text-[#93C5FD]'
                        : 'bg-[#F8F9FC] dark:bg-[#091020] border-[#E2E6EE] dark:border-[#1E2C4A] text-[#475569] dark:text-[#CBD5E1]'
                    }`}
                  >
                    <span className="font-[Amiri] text-base block leading-tight">
                      {phrase.ar}
                    </span>
                  </button>
                ))}
              </div>

              <div className="text-center py-3">
                <p
                  dir="rtl"
                  className="font-[Amiri] text-3xl text-[#1E3A8A] dark:text-[#F3DFB1] mb-2"
                >
                  {activeDhikr.ar}
                </p>
                <p className="text-xs text-[#525E75] dark:text-[#94A3B8] leading-relaxed mb-5">
                  {activeDhikr.my}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setTasbihCount((c) => (c >= tasbihTarget ? 1 : c + 1))
                  }
                  className="w-36 h-36 mx-auto rounded-full bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#3B82F6] active:scale-[0.97] text-white shadow-md flex flex-col items-center justify-center transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#93C5FD]"
                >
                  <span className="text-4xl font-bold tabular-nums">
                    {tasbihCount}
                  </span>
                  <span className="text-xs text-[#E2C792] mt-1 tabular-nums">
                    / {tasbihTarget}
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#EFF2F7] dark:border-[#1E2C4A]">
                <span className="text-xs text-[#525E75] dark:text-[#94A3B8]">
                  {tasbihCount === tasbihTarget
                    ? 'သတ်မှတ်အကြိမ်ရေ ပြည့်မြောက်ပါပြီ'
                    : 'နှိပ်၍ ဇိကိရ်ပွားများပါ'}
                </span>
                <button
                  type="button"
                  onClick={() => setTasbihCount(0)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#525E75] dark:text-[#94A3B8] hover:text-[#1E3A8A] dark:hover:text-[#93C5FD] py-1 px-2 rounded-md hover:bg-[#EFF3FA] dark:hover:bg-[#131E36]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ပြန်စရန်</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
