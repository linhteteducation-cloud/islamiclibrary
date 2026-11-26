import {useEffect, useMemo, useState} from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Scale,
  Search,
  Send,
  ShieldCheck,
  User,
} from 'lucide-react';
import {submitFatwaQuestion} from '../lib/firestoreService';
import {getScriptFontClass} from '../lib/scriptFonts';
import {FatwaCategoryItem, PublishedFatwaItem} from '../types/library';

interface FatwaViewProps {
  fatwaCategories: FatwaCategoryItem[];
  publishedFatwas: PublishedFatwaItem[];
}

export function FatwaView({
  fatwaCategories,
  publishedFatwas,
}: FatwaViewProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Ask Fatwa Form State
  const [askerName, setAskerName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [viber, setViber] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<string>(
    fatwaCategories[0]?.id || '',
  );
  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    if (
      fatwaCategories.length > 0 &&
      !fatwaCategories.some((c) => c.id === formCategoryId)
    ) {
      setFormCategoryId(fatwaCategories[0].id);
    }
  }, [fatwaCategories, formCategoryId]);

  const filteredPublished = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return publishedFatwas.filter((item) => {
      if (
        selectedCategoryId !== 'all' &&
        item.categoryId !== selectedCategoryId
      ) {
        return false;
      }
      if (!q) return true;
      return (
        item.subject.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q) ||
        item.answerText.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        item.muftiName.toLowerCase().includes(q)
      );
    });
  }, [publishedFatwas, selectedCategoryId, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmittedSuccess(false);

    const matchedCategory =
      fatwaCategories.find((c) => c.id === formCategoryId) ||
      fatwaCategories[0];
    if (!matchedCategory) {
      setSubmitError('ဖသ်ဝါ ကဏ္ဍ ရွေးချယ်ပေးပါ။');
      return;
    }
    if (!viber.trim()) {
      setSubmitError('ဆက်သွယ်နိုင်ရန် Viber No ထည့်သွင်းပါ။');
      return;
    }

    setSubmitting(true);
    try {
      await submitFatwaQuestion({
        askerName,
        city,
        email,
        phone,
        viber,
        categoryId: matchedCategory.id,
        categoryLabel: matchedCategory.nameMy,
        subject,
        question,
      });
      setSubmittedSuccess(true);
      setAskerName('');
      setCity('');
      setEmail('');
      setPhone('');
      setViber('');
      setSubject('');
      setQuestion('');
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'ဖသ်ဝါ မေးမြန်းချက် ပေးပို့ရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* Header */}
      <header className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#B85338] dark:text-[#F0947A]">
            <Scale className="w-4 h-4 shrink-0" />
            <span>ရှရီအသ် ဖသ်ဝါ မေးမြန်းဖြေကြားရေးဌာန</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#131B2E] dark:text-[#F1F5F9] [text-wrap:balance]">
            ဖသ်ဝါ မေးမြန်းရန်နှင့် အဖြေလွှာများ
          </h1>
          <p className="text-sm text-[#525E75] dark:text-[#94A3B8] leading-[1.8]">
            အစ္စလာမ်သာသနာ့ ရှရီအသ်စည်းမျဉ်းများ၊ ဝတ်ပြုကိုးကွယ်မှု၊ အိမ်ထောင်ရေး၊ စီးပွားရေးနှင့် နေ့စဉ်ဘဝဆိုင်ရာ သိလိုသည်များကို တိုက်ရိုက် မေးမြန်းနိုင်ပါသည်။ Admin နှင့် ပညာရှင်များက စစ်ဆေးပြီး Email / ဖုန်း / Viber မှတစ်ဆင့် ပြန်လည်ဖြေကြားပေးပါမည်။
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 border-t md:border-t-0 md:border-l border-[#E2E6EE] dark:border-[#1E2C4A] pt-4 md:pt-0 md:pl-6 shrink-0">
          <div>
            <p className="text-xs text-[#525E75] dark:text-[#94A3B8]">
              ဖသ်ဝါကဏ္ဍများ
            </p>
            <p className="text-xl font-bold text-[#131B2E] dark:text-[#F1F5F9] tabular-nums">
              {fatwaCategories.length}
            </p>
          </div>
          <div className="h-8 w-px bg-[#E2E6EE] dark:bg-[#1E2C4A]" />
          <div>
            <p className="text-xs text-[#525E75] dark:text-[#94A3B8]">
              ဖြေကြားပြီးစုစုပေါင်း
            </p>
            <p className="text-xl font-bold text-[#146B3A] dark:text-[#6EE7B7] tabular-nums">
              {publishedFatwas.length}
            </p>
          </div>
        </div>
      </header>

      {/* Main Split: Ask Fatwa Form + Published Q&A */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Ask Fatwa Form */}
        <section
          aria-labelledby="ask-fatwa-heading"
          className="lg:col-span-5 bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl p-6 sm:p-7 space-y-5"
        >
          <div className="border-b border-[#E6EAF2] dark:border-[#1E2C4A] pb-4 space-y-1">
            <h2
              id="ask-fatwa-heading"
              className="font-serif text-lg sm:text-xl font-bold text-[#131B2E] dark:text-[#F1F5F9]"
            >
              ဖသ်ဝါ အသစ် မေးမြန်းရန်
            </h2>
            <p className="text-xs text-[#525E75] dark:text-[#94A3B8] leading-relaxed">
              အဖြေပြန်လည်ပေးပို့နိုင်ရန် လိုအပ်သော ဆက်သွယ်ရန်အချက်အလက်များကို ပြည့်စုံစွာ ဖြည့်သွင်းပေးပါ။
            </p>
          </div>

          {submittedSuccess && (
            <div
              role="status"
              className="p-4 rounded-xl bg-[#EBF4EE] dark:bg-[#0D231B] border border-[#B8DEC5] dark:border-[#1B4332] text-[#115E34] dark:text-[#6EE7B7] text-sm space-y-1"
            >
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>မေးမြန်းချက် ပေးပို့ပြီးပါပြီ</span>
              </div>
              <p className="text-xs leading-relaxed">
                သင်၏ ဖသ်ဝါမေးခွန်းကို Admin ထံသို့ လုံခြုံစွာ ပေးပို့ပြီးဖြစ်ပါသည်။ စစ်ဆေးဖြေကြားပြီးပါက သင်ထည့်သွင်းထားသော Email / ဖုန်း / Viber မှတစ်ဆင့် ဆက်သွယ်ဖြေကြားပေးပါမည်။
              </p>
            </div>
          )}

          {submitError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-xs sm:text-sm text-red-700 dark:text-red-300 leading-relaxed"
            >
              {submitError}
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="fatwa-asker-name"
                  className="block text-xs font-semibold text-[#131B2E] dark:text-[#E2E8F0] mb-1.5"
                >
                  အမည် (လူနာမည်) *
                </label>
                <div className="relative">
                  <input
                    id="fatwa-asker-name"
                    type="text"
                    required
                    value={askerName}
                    onChange={(e) => setAskerName(e.target.value)}
                    placeholder="သင်၏ အမည်"
                    className="w-full min-h-[42px] pl-9 pr-3 py-2 text-sm bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA]"
                  />
                  <User className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="fatwa-city"
                  className="block text-xs font-semibold text-[#131B2E] dark:text-[#E2E8F0] mb-1.5"
                >
                  နေထိုင်သည့် မြို့ *
                </label>
                <div className="relative">
                  <input
                    id="fatwa-city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="ဥပမာ - ရန်ကုန် / မန္တလေး"
                    className="w-full min-h-[42px] pl-9 pr-3 py-2 text-sm bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA]"
                  />
                  <MapPin className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="fatwa-email"
                className="block text-xs font-semibold text-[#131B2E] dark:text-[#E2E8F0] mb-1.5"
              >
                Email လိပ်စာ *
              </label>
              <div className="relative">
                <input
                  id="fatwa-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full min-h-[42px] pl-9 pr-3 py-2 text-sm bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA]"
                />
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="fatwa-phone"
                  className="block text-xs font-semibold text-[#131B2E] dark:text-[#E2E8F0] mb-1.5"
                >
                  ဆက်သွယ်နိုင်ရန် ဖုန်း *
                </label>
                <div className="relative">
                  <input
                    id="fatwa-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09xxxxxxxxx"
                    className="w-full min-h-[42px] pl-9 pr-3 py-2 text-sm bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA]"
                  />
                  <Phone className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <label
                    htmlFor="fatwa-viber"
                    className="block text-xs font-semibold text-[#131B2E] dark:text-[#E2E8F0]"
                  >
                    Viber No *
                  </label>
                  {phone.trim() && viber !== phone && (
                    <button
                      type="button"
                      onClick={() => setViber(phone)}
                      className="text-[11px] font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:underline"
                    >
                      ဖုန်းနံပါတ်အတိုင်းထည့်
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="fatwa-viber"
                    type="tel"
                    required
                    value={viber}
                    onChange={(e) => setViber(e.target.value)}
                    placeholder="Viber 09xxxxxxxxx"
                    className="w-full min-h-[42px] pl-9 pr-3 py-2 text-sm bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA]"
                  />
                  <MessageCircle className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="fatwa-category"
                className="block text-xs font-semibold text-[#131B2E] dark:text-[#E2E8F0] mb-1.5"
              >
                ဖသ်ဝါ ကဏ္ဍ (Category) *
              </label>
              <select
                id="fatwa-category"
                required
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA]"
              >
                {fatwaCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nameMy}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="fatwa-subject"
                className="block text-xs font-semibold text-[#131B2E] dark:text-[#E2E8F0] mb-1.5"
              >
                မေးမြန်းလိုသည့် ခေါင်းစဉ် *
              </label>
              <input
                id="fatwa-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="မေးခွန်းအကျဉ်းချုပ် ခေါင်းစဉ်"
                className={`w-full min-h-[42px] px-3.5 py-2 text-sm bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA] ${getScriptFontClass(subject)}`}
              />
            </div>

            <div>
              <label
                htmlFor="fatwa-question"
                className="block text-xs font-semibold text-[#131B2E] dark:text-[#E2E8F0] mb-1.5"
              >
                ဖသ်ဝါ မေးခွန်းအသေးစိတ် *
              </label>
              <textarea
                id="fatwa-question"
                rows={5}
                required
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="သိလိုသော မေးခွန်းကို ရှင်းလင်းပြတ်သားစွာ ရေးသားမေးမြန်းပါ..."
                className={`w-full px-3.5 py-2.5 text-sm leading-relaxed bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA] ${getScriptFontClass(question)}`}
              />
            </div>

            <div className="flex items-start gap-2 text-[11.5px] text-[#525E75] dark:text-[#94A3B8] leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-[#146B3A] dark:text-[#6EE7B7] shrink-0 mt-0.5" />
              <span>
                မေးမြန်းသူ၏ အမည်၊ ဖုန်း၊ Viber နှင့် Email များကို Admin နှင့် ဖြေကြားမည့် အာလင်မ်ပညာရှင်များသာ စစ်ဆေးကြည့်ရှုနိုင်ပြီး လျှို့ဝှက်ထိန်းသိမ်းထားမည် ဖြစ်ပါသည်။
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting || fatwaCategories.length === 0}
              className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#146B3A]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>ပေးပို့နေပါသည်...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>ဖသ်ဝါ မေးခွန်းပေးပို့မည်</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Right: Categories Overview & Published Answers Archive */}
        <section
          aria-labelledby="fatwa-archive-heading"
          className="lg:col-span-7 space-y-6"
        >
          {/* Category Filter Bar */}
          <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2
                id="fatwa-archive-heading"
                className="font-serif text-lg sm:text-xl font-bold text-[#131B2E] dark:text-[#F1F5F9]"
              >
                ကဏ္ဍအလိုက် ဖြေကြားပြီး ဖသ်ဝါများ
              </h2>

              <div className="relative w-full sm:w-64">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="မေးခွန်း / အဖြေ ရှာဖွေရန်..."
                  className="w-full min-h-[38px] pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA]"
                />
                <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div
              role="tablist"
              aria-label="Fatwa category filters"
              className="flex flex-wrap items-center gap-1.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={selectedCategoryId === 'all'}
                onClick={() => setSelectedCategoryId('all')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedCategoryId === 'all'
                    ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-white'
                    : 'bg-[#F1F4F9] dark:bg-[#131E36] text-[#35433A] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#1B2A4A]'
                }`}
              >
                အားလုံး ({publishedFatwas.length})
              </button>

              {fatwaCategories.map((cat) => {
                const count = publishedFatwas.filter(
                  (f) => f.categoryId === cat.id,
                ).length;
                const active = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#1E3A8A] dark:bg-[#2563EB] text-white'
                        : 'bg-[#F1F4F9] dark:bg-[#131E36] text-[#35433A] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#1B2A4A]'
                    }`}
                  >
                    {cat.nameMy} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Published Q&A List */}
          {filteredPublished.length === 0 ? (
            <div className="bg-white dark:bg-[#0D1526] border border-dashed border-[#CBD5E1] dark:border-[#263759] rounded-2xl p-8 sm:p-10 text-center space-y-3">
              <HelpCircle className="w-9 h-9 text-[#64748B] dark:text-[#94A3B8] mx-auto" />
              <p className="text-base font-semibold text-[#131B2E] dark:text-[#F1F5F9]">
                {publishedFatwas.length === 0
                  ? 'အများဖတ်ရှုရန် ထုတ်ဝေထားသော ဖသ်ဝါအဖြေများ မရှိသေးပါ'
                  : 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ဖသ်ဝါ မတွေ့ရှိပါ'}
              </p>
              <p className="text-xs sm:text-sm text-[#525E75] dark:text-[#94A3B8] max-w-md mx-auto leading-relaxed">
                ဘေးဘက်ရှိ “ဖသ်ဝါ အသစ် မေးမြန်းရန်” ဖောင်မှတစ်ဆင့် သင်သိလိုသည်များကို တိုက်ရိုက်မေးမြန်းနိုင်ပါသည်။
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPublished.map((item) => {
                const isExpanded = expandedId === item.id;
                const matchedCat = fatwaCategories.find(
                  (c) => c.id === item.categoryId,
                );
                return (
                  <article
                    key={item.id}
                    className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : item.id)
                      }
                      className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 hover:bg-[#F8FAFC] dark:hover:bg-[#111C33] transition-colors"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#525E75] dark:text-[#94A3B8]">
                          <span className="font-semibold text-[#B85338] dark:text-[#F0947A]">
                            {matchedCat?.nameMy || item.categoryLabel}
                          </span>
                          {item.muftiName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>ဖြေကြားသူ - {item.muftiName}</span>
                            </>
                          )}
                          {item.answeredAtLabel && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{item.answeredAtLabel}</span>
                            </>
                          )}
                        </div>
                        <h3
                          className={`font-serif text-base sm:text-lg font-bold text-[#131B2E] dark:text-[#F1F5F9] leading-snug ${getScriptFontClass(item.subject)}`}
                        >
                          {item.subject}
                        </h3>
                      </div>
                      <span className="w-8 h-8 rounded-lg bg-[#F1F4F9] dark:bg-[#131E36] text-[#1E3A8A] dark:text-[#93C5FD] flex items-center justify-center shrink-0 mt-0.5">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-[#E6EAF2] dark:border-[#1E2C4A] space-y-4">
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-[#525E75] dark:text-[#94A3B8]">
                            မေးမြန်းချက်
                          </p>
                          <p
                            className={`text-sm text-[#131B2E] dark:text-[#E2E8F0] leading-[1.85] whitespace-pre-line ${getScriptFontClass(item.question)}`}
                          >
                            {item.question}
                          </p>
                        </div>

                        <div className="p-4 sm:p-5 rounded-xl bg-[#F4F8F5] dark:bg-[#0D231B]/70 border border-[#D4E6DA] dark:border-[#1B4332] space-y-2">
                          <p className="text-xs font-bold text-[#115E34] dark:text-[#6EE7B7]">
                            ရှရီအသ် အဖြေတော်
                          </p>
                          <p
                            className={`text-sm text-[#131B2E] dark:text-[#F1F5F9] leading-[1.9] whitespace-pre-line ${getScriptFontClass(item.answerText)}`}
                          >
                            {item.answerText}
                          </p>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
