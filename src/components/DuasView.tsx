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
            className="font-[Amiri] text-xl sm:text-2xl text-[#E8C868] mb-2"
          >
            ادْعُونِي أَسْتَجِبْ لَكُمْ
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            ဒိုအာနှင့် အအ်မာလ်များ
          </h1>
          <p className="text-sm sm:text-[15px] text-[#E4EFE7] max-w-2xl leading-relaxed">
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
                        ? 'bg-[#146B3A] text-white font-semibold'
                        : 'bg-white border border-[#E2E8E4] text-[#35433A] hover:bg-[#EBF4EE]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {visibleDuas.length === 0 ? (
              <div className="bg-white border border-[#E2E8E4] rounded-xl p-10 text-center space-y-2">
                <HeartHandshake className="w-9 h-9 text-[#86948B] mx-auto" />
                <p className="text-base font-semibold text-[#1A241E]">
                  ဒိုအာများ မထည့်သွင်းရသေးပါ
                </p>
                <p className="text-sm text-[#5A6860]">
                  Admin Panel မှတစ်ဆင့် ဒိုအာအသစ်များ ထည့်သွင်းနိုင်ပါသည်။
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleDuas.map((dua) => (
                  <article
                    key={dua.id}
                    className="bg-white border border-[#E2E8E4] rounded-xl p-5 sm:p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-[#9B7417] mb-1">
                          {dua.categoryMy}
                          {dua.source ? ` · ${dua.source}` : ''}
                        </p>
                        <h2 className="text-base sm:text-lg font-bold text-[#1A241E]">
                          {dua.titleMy}
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyArabic(dua)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#D4DDD7] bg-[#F8FAF9] hover:bg-[#EBF4EE] text-xs font-semibold text-[#115E34] inline-flex items-center gap-1.5 transition-colors shrink-0"
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
                      className="bg-[#FBFBF8] border border-[#E6EAE4] rounded-xl px-5 py-5 text-right font-[Amiri] text-2xl sm:text-[28px] leading-[2.1] text-[#115E34]"
                    >
                      {dua.arabic}
                    </div>

                    <div className="space-y-2 text-sm">
                      {dua.transliteration && (
                        <p className="text-[#526058] italic">
                          <span className="font-semibold not-italic text-[#1A241E]">
                            အသံထွက် —{' '}
                          </span>
                          {dua.transliteration}
                        </p>
                      )}
                      <p className="text-[#232F28] leading-relaxed">
                        <span className="font-semibold text-[#115E34]">
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
            <div className="bg-white border border-[#E2E8E4] rounded-xl p-5 sm:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#EDF1EE] pb-3.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#C59B27]" />
                  <h3 className="text-base font-bold text-[#1A241E]">
                    တစ်စဗီဟ် (ဇိကိရ် မှတ်တမ်း)
                  </h3>
                </div>
                <div className="flex items-center gap-1 bg-[#F2F5F3] p-0.5 rounded-md">
                  {([33, 99] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTasbihTarget(t)}
                      className={`px-2 py-1 text-xs font-semibold rounded tabular-nums ${
                        tasbihTarget === t
                          ? 'bg-white text-[#115E34] shadow-xs'
                          : 'text-[#5A6860]'
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
                        ? 'bg-[#EBF4EE] border-[#146B3A]/40 text-[#115E34]'
                        : 'bg-[#F8FAF9] border-[#E2E8E4] text-[#4B5950]'
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
                  className="font-[Amiri] text-3xl text-[#115E34] mb-2"
                >
                  {activeDhikr.ar}
                </p>
                <p className="text-xs text-[#5A6860] leading-relaxed mb-5">
                  {activeDhikr.my}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setTasbihCount((c) => (c >= tasbihTarget ? 1 : c + 1))
                  }
                  className="w-36 h-36 mx-auto rounded-full bg-[#146B3A] hover:bg-[#0F522D] active:scale-[0.97] text-white shadow-md flex flex-col items-center justify-center transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-[#C59B27]/50"
                >
                  <span className="text-4xl font-bold tabular-nums">
                    {tasbihCount}
                  </span>
                  <span className="text-xs text-[#E8C868] mt-1 tabular-nums">
                    / {tasbihTarget}
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#EDF1EE]">
                <span className="text-xs text-[#5A6860]">
                  {tasbihCount === tasbihTarget
                    ? 'သတ်မှတ်အကြိမ်ရေ ပြည့်မြောက်ပါပြီ'
                    : 'နှိပ်၍ ဇိကိရ်ပွားများပါ'}
                </span>
                <button
                  type="button"
                  onClick={() => setTasbihCount(0)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#5A6860] hover:text-[#115E34] py-1 px-2 rounded-md hover:bg-[#F2F6F3]"
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
