import {useEffect, useMemo, useState} from 'react';
import {User} from 'firebase/auth';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Scale,
  Search,
  Send,
  Shield,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  answerFatwaQuestion,
  deleteFatwaQuestionRecord,
} from '../lib/firestoreService';
import {getScriptFontClass} from '../lib/scriptFonts';
import {
  FatwaCategoryItem,
  FatwaQuestionItem,
  FatwaQuestionStatus,
  PageRoute,
} from '../types/library';

interface FatwaAdminViewProps {
  user: User | null;
  isAdmin: boolean;
  authLoading: boolean;
  onSignInGoogle: () => Promise<void>;
  fatwaCategories: FatwaCategoryItem[];
  fatwaQuestions: FatwaQuestionItem[];
  onNavigate: (page: PageRoute) => void;
}

export function FatwaAdminView({
  user,
  isAdmin,
  authLoading,
  onSignInGoogle,
  fatwaCategories,
  fatwaQuestions,
  onNavigate,
}: FatwaAdminViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | FatwaQuestionStatus>(
    'pending',
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Answer composer state
  const [draftCategoryId, setDraftCategoryId] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftStatus, setDraftStatus] =
    useState<FatwaQuestionStatus>('answered');
  const [draftMuftiName, setDraftMuftiName] = useState('');
  const [draftAnswer, setDraftAnswer] = useState('');
  const [draftPublishPublicly, setDraftPublishPublicly] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedViber, setCopiedViber] = useState(false);

  const [notice, setNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [confirmDeleteItem, setConfirmDeleteItem] =
    useState<FatwaQuestionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const stats = useMemo(() => {
    let pending = 0;
    let answered = 0;
    let published = 0;
    for (const q of fatwaQuestions) {
      if (q.status === 'pending') pending += 1;
      if (q.status === 'answered') answered += 1;
      if (q.isPublishedPublicly) published += 1;
    }
    return {
      total: fatwaQuestions.length,
      pending,
      answered,
      published,
    };
  }, [fatwaQuestions]);

  const filteredQuestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return fatwaQuestions.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && item.categoryId !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.subject.toLowerCase().includes(q) ||
        item.askerName.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        item.viber.toLowerCase().includes(q) ||
        item.question.toLowerCase().includes(q)
      );
    });
  }, [fatwaQuestions, statusFilter, categoryFilter, searchQuery]);

  const activeQuestion = useMemo(() => {
    if (filteredQuestions.length === 0) return null;
    return (
      filteredQuestions.find((q) => q.id === selectedId) ||
      filteredQuestions[0]
    );
  }, [filteredQuestions, selectedId]);

  useEffect(() => {
    if (!activeQuestion) return;
    setSelectedId(activeQuestion.id);
    setDraftCategoryId(activeQuestion.categoryId);
    setDraftSubject(activeQuestion.subject);
    setDraftStatus(
      activeQuestion.status === 'pending' ? 'answered' : activeQuestion.status,
    );
    setDraftMuftiName(activeQuestion.muftiName);
    setDraftAnswer(activeQuestion.answerText);
    setDraftPublishPublicly(activeQuestion.isPublishedPublicly);
    setCopiedViber(false);
  }, [activeQuestion]);

  if (authLoading) {
    return (
      <div className="max-w-[1000px] mx-auto px-4 py-16 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#146B3A] mx-auto" />
        <p className="text-sm text-[#525E75] dark:text-[#94A3B8]">
          Admin အကောင့် အတည်ပြုနေပါသည်...
        </p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="max-w-[540px] mx-auto px-4 py-16">
        <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl p-7 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#EBF4EE] dark:bg-[#0D231B] text-[#146B3A] dark:text-[#6EE7B7] flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="font-serif text-xl font-bold text-[#131B2E] dark:text-[#F1F5F9]">
            Admin သီးသန့် ဖသ်ဝါဖြေကြားရေးဌာန
          </h1>
          <p className="text-sm text-[#525E75] dark:text-[#94A3B8] leading-relaxed">
            မေးမြန်းထားသော ဖသ်ဝါများနှင့် မေးမြန်းသူ၏ ကိုယ်ရေးအချက်အလက်များကို Admin အကောင့်ဖြင့် ဝင်ရောက်ထားသူများသာ စစ်ဆေးဖြေကြားနိုင်ပါသည်။
          </p>
          <button
            type="button"
            onClick={() => void onSignInGoogle()}
            className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#1E3A8A] hover:bg-[#172D6B] text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            <span>Admin Google Account ဖြင့် ဝင်ရောက်ရန်</span>
          </button>
        </div>
      </div>
    );
  }

  const handleSaveAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuestion) return;
    setNotice(null);

    if (draftStatus === 'answered' && !draftAnswer.trim()) {
      setNotice({
        type: 'error',
        text: '“ဖြေကြားပြီး” အဖြစ် မှတ်တမ်းတင်ရန် ဖသ်ဝါအဖြေစာသား ထည့်သွင်းပါ။',
      });
      return;
    }

    const cat = fatwaCategories.find((c) => c.id === draftCategoryId);
    setIsSaving(true);
    try {
      await answerFatwaQuestion(user.uid, activeQuestion, {
        categoryId: cat?.id || activeQuestion.categoryId,
        categoryLabel: cat?.nameMy || activeQuestion.categoryLabel,
        subject: draftSubject.trim() || activeQuestion.subject,
        status: draftStatus,
        answerText: draftAnswer,
        muftiName: draftMuftiName,
        isPublishedPublicly: draftPublishPublicly,
      });
      setNotice({
        type: 'success',
        text:
          draftPublishPublicly && draftAnswer.trim()
            ? 'ဖသ်ဝါအဖြေကို သိမ်းဆည်းပြီး Website ဖသ်ဝါစာမျက်နှာတွင်ပါ ထုတ်ဝေပြီးပါပြီ။'
            : 'ဖသ်ဝါအဖြေနှင့် အခြေအနေကို သိမ်းဆည်းပြီးပါပြီ။',
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'သိမ်းဆည်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteItem) return;
    setIsDeleting(true);
    try {
      await deleteFatwaQuestionRecord(
        confirmDeleteItem.id,
        confirmDeleteItem.publishedFatwaId,
      );
      setConfirmDeleteItem(null);
      setNotice({
        type: 'success',
        text: 'ဖသ်ဝါ မေးမြန်းချက်ကို ဖျက်သိမ်းလိုက်ပါပြီ။',
      });
    } catch (err) {
      setNotice({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'ဖျက်သိမ်းရာတွင် အမှားဖြစ်ပေါ်ပါသည်။',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyViber = async (viberNo: string) => {
    try {
      await navigator.clipboard.writeText(viberNo);
      setCopiedViber(true);
      setTimeout(() => setCopiedViber(false), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Top Bar / Stats */}
      <header className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#146B3A] dark:text-[#6EE7B7]">
            <Scale className="w-4 h-4" />
            <span>Admin သီးသန့် စစ်ဆေးဖြေကြားရေးဌာန</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#131B2E] dark:text-[#F1F5F9]">
            ဖသ်ဝါ ဖြေကြားရန်နှင့် စစ်ဆေးရန်
          </h1>
          <p className="text-xs sm:text-sm text-[#525E75] dark:text-[#94A3B8]">
            စာဖတ်သူများ မေးမြန်းထားသော ဖသ်ဝါမေးခွန်းများနှင့် ဆက်သွယ်ရန်အချက်အလက်များကို စစ်ဆေးဖြေကြားနိုင်ပါသည်။
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="grid grid-cols-3 gap-3 sm:gap-5 px-4 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#131E36] border border-[#E2E6EE] dark:border-[#263759]">
            <div>
              <p className="text-[11px] text-[#525E75] dark:text-[#94A3B8]">
                မဖြေရသေး
              </p>
              <p className="text-lg font-bold text-[#B85338] dark:text-[#FCA5A5] tabular-nums">
                {stats.pending}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#525E75] dark:text-[#94A3B8]">
                ဖြေကြားပြီး
              </p>
              <p className="text-lg font-bold text-[#146B3A] dark:text-[#6EE7B7] tabular-nums">
                {stats.answered}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#525E75] dark:text-[#94A3B8]">
                Public ထုတ်ဝေ
              </p>
              <p className="text-lg font-bold text-[#1E3A8A] dark:text-[#93C5FD] tabular-nums">
                {stats.published}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="min-h-[42px] px-4 py-2 rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-[#EFF3FA] dark:hover:bg-[#1B2A4A] text-[#1E3A8A] dark:text-[#93C5FD] text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Fatwa ကဏ္ဍများ စီမံရန်</span>
          </button>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs sm:text-sm font-medium ${
            notice.type === 'success'
              ? 'bg-[#EBF4EE] dark:bg-[#0D231B] border-[#B8DEC5] dark:border-[#1B4332] text-[#115E34] dark:text-[#6EE7B7]'
              : 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {id: 'pending' as const, label: `မဖြေရသေး (${stats.pending})`},
            {id: 'answered' as const, label: `ဖြေကြားပြီး (${stats.answered})`},
            {id: 'archived' as const, label: 'သိမ်းဆည်းထားသော'},
            {id: 'all' as const, label: `အားလုံး (${stats.total})`},
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#146B3A] text-white'
                  : 'bg-[#F1F4F9] dark:bg-[#131E36] text-[#35433A] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#1B2A4A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by Fatwa category"
            className="min-h-[38px] px-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg"
          >
            <option value="all">ကဏ္ဍအားလုံး</option>
            {fatwaCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameMy}
              </option>
            ))}
          </select>

          <div className="relative sm:w-60">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="အမည် / မြို့ / ဖုန်း / မေးခွန်း ရှာရန်..."
              className="w-full min-h-[38px] pl-9 pr-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
            />
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Inbox + Answer Editor */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white dark:bg-[#0D1526] border border-dashed border-[#CBD5E1] dark:border-[#263759] rounded-2xl p-10 text-center space-y-2">
          <Scale className="w-9 h-9 text-[#64748B] dark:text-[#94A3B8] mx-auto" />
          <p className="text-base font-semibold text-[#131B2E] dark:text-[#F1F5F9]">
            ရွေးချယ်ထားသော အခြေအနေအတွက် ဖသ်ဝါမေးခွန်း မရှိသေးပါ
          </p>
          <p className="text-xs text-[#525E75] dark:text-[#94A3B8]">
            စာဖတ်သူများ “ဖသ်ဝါမေးမြန်းရန်” မှ မေးမြန်းလိုက်သည်နှင့် ဤနေရာတွင် ချက်ချင်းပေါ်လာပါမည်။
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Question List */}
          <div className="lg:col-span-5 bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl divide-y divide-[#EDF1EE] dark:divide-[#1E2C4A] max-h-[75vh] overflow-y-auto">
            {filteredQuestions.map((item) => {
              const selected = activeQuestion?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left p-4 space-y-1.5 transition-colors ${
                    selected
                      ? 'bg-[#EFF4FB] dark:bg-[#132242]'
                      : 'hover:bg-[#F8FAFC] dark:hover:bg-[#111C33]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[#525E75] dark:text-[#94A3B8]">
                    <span className="font-semibold text-[#B85338] dark:text-[#F0947A] truncate">
                      {item.categoryLabel}
                    </span>
                    <span className="shrink-0 font-semibold">
                      {item.status === 'pending'
                        ? 'မဖြေရသေး'
                        : item.status === 'answered'
                          ? 'ဖြေကြားပြီး'
                          : 'သိမ်းဆည်းထား'}
                    </span>
                  </div>
                  <p
                    className={`text-sm font-bold text-[#131B2E] dark:text-[#F1F5F9] line-clamp-2 ${getScriptFontClass(item.subject)}`}
                  >
                    {item.subject}
                  </p>
                  <p className="text-xs text-[#525E75] dark:text-[#94A3B8] truncate">
                    {item.askerName} · {item.city}
                    {item.createdAtLabel ? ` · ${item.createdAtLabel}` : ''}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Question Details & Answer Composer */}
          {activeQuestion && (
            <div className="lg:col-span-7 bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl p-5 sm:p-7 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EDF1EE] dark:border-[#1E2C4A] pb-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#B85338] dark:text-[#F0947A]">
                    {activeQuestion.categoryLabel}
                    {activeQuestion.createdAtLabel
                      ? ` · ${activeQuestion.createdAtLabel}`
                      : ''}
                  </p>
                  <h2
                    className={`font-serif text-lg sm:text-xl font-bold text-[#131B2E] dark:text-[#F1F5F9] ${getScriptFontClass(activeQuestion.subject)}`}
                  >
                    {activeQuestion.subject}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteItem(activeQuestion)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/60 inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ဖျက်ရန်</span>
                </button>
              </div>

              {/* Asker Contact Information */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#131E36] border border-[#E2E6EE] dark:border-[#263759] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-[#64748B] dark:text-[#94A3B8]">မေးမြန်းသူ အမည်</p>
                  <p className="font-bold text-[#131B2E] dark:text-[#F1F5F9] mt-0.5">
                    {activeQuestion.askerName}
                  </p>
                </div>

                <div>
                  <p className="text-[#64748B] dark:text-[#94A3B8]">နေထိုင်သည့်မြို့</p>
                  <p className="font-bold text-[#131B2E] dark:text-[#F1F5F9] mt-0.5 inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#146B3A] dark:text-[#6EE7B7]" />
                    <span>{activeQuestion.city}</span>
                  </p>
                </div>

                <div>
                  <p className="text-[#64748B] dark:text-[#94A3B8]">Email</p>
                  <a
                    href={`mailto:${activeQuestion.email}`}
                    className="font-semibold text-[#1E3A8A] dark:text-[#93C5FD] hover:underline mt-0.5 inline-flex items-center gap-1 break-all"
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>{activeQuestion.email}</span>
                  </a>
                </div>

                <div>
                  <p className="text-[#64748B] dark:text-[#94A3B8]">
                    ဆက်သွယ်ရန် ဖုန်း / Viber No
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <a
                      href={`tel:${activeQuestion.phone.replace(/\s+/g, '')}`}
                      className="font-semibold text-[#146B3A] dark:text-[#6EE7B7] hover:underline inline-flex items-center gap-1"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{activeQuestion.phone}</span>
                    </a>
                    {activeQuestion.viber && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyViber(activeQuestion.viber)
                        }
                        className="px-2 py-0.5 rounded bg-white dark:bg-[#0D1526] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#E2E8F0] inline-flex items-center gap-1 hover:border-[#1E3A8A]"
                        title="Viber နံပါတ် ကူးယူရန်"
                      >
                        <MessageCircle className="w-3 h-3 text-[#7C3AED] dark:text-[#C4B5FD]" />
                        <span>Viber: {activeQuestion.viber}</span>
                        {copiedViber ? (
                          <Check className="w-3 h-3 text-[#146B3A]" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-60" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Question */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[#525E75] dark:text-[#94A3B8]">
                  မေးမြန်းထားသော မေးခွန်းအပြည့်အစုံ
                </p>
                <div
                  className={`p-4 rounded-xl bg-[#FAFCFB] dark:bg-[#0B1221] border border-[#E6EAF2] dark:border-[#1E2C4A] text-sm text-[#131B2E] dark:text-[#F1F5F9] leading-[1.85] whitespace-pre-line ${getScriptFontClass(activeQuestion.question)}`}
                >
                  {activeQuestion.question}
                </div>
              </div>

              {/* Answer Form */}
              <form
                onSubmit={(e) => void handleSaveAnswer(e)}
                className="space-y-4 pt-4 border-t border-[#EDF1EE] dark:border-[#1E2C4A]"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                      ဖသ်ဝါ ကဏ္ဍ
                    </label>
                    <select
                      value={draftCategoryId}
                      onChange={(e) => setDraftCategoryId(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg"
                    >
                      {fatwaCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameMy}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                      အခြေအနေ (Status)
                    </label>
                    <select
                      value={draftStatus}
                      onChange={(e) =>
                        setDraftStatus(e.target.value as FatwaQuestionStatus)
                      }
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg"
                    >
                      <option value="pending">မဖြေရသေး (Pending)</option>
                      <option value="answered">ဖြေကြားပြီး (Answered)</option>
                      <option value="archived">သိမ်းဆည်းထား (Archived)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                      မေးခွန်းခေါင်းစဉ် (ပြင်ဆင်လိုပါက)
                    </label>
                    <input
                      type="text"
                      required
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      className={`w-full min-h-[40px] px-3 py-1.5 text-xs sm:text-sm bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] rounded-lg ${getScriptFontClass(draftSubject)}`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                      ဖြေကြားသည့် အာလင်မ် / ပညာရှင်အမည်
                    </label>
                    <input
                      type="text"
                      value={draftMuftiName}
                      onChange={(e) => setDraftMuftiName(e.target.value)}
                      placeholder="ဥပမာ - မွတ်ဖ်သီ / အာလင်မ် အမည်"
                      className="w-full min-h-[40px] px-3 py-1.5 text-xs sm:text-sm bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1] mb-1">
                    ဖသ်ဝါ ရှရီအသ် အဖြေတော်
                  </label>
                  <textarea
                    rows={6}
                    value={draftAnswer}
                    onChange={(e) => setDraftAnswer(e.target.value)}
                    placeholder="ကုရ်အာန်၊ ဟဒီးစ်နှင့် ဖိကဟ်ကျမ်းကိုးအထောက်အထားများဖြင့် အဖြေရေးသားပါ..."
                    className={`w-full px-3.5 py-2.5 text-sm leading-relaxed bg-[#F8FAFC] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] rounded-lg ${getScriptFontClass(draftAnswer)}`}
                  />
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F4F8F5] dark:bg-[#0D231B]/60 border border-[#D4E6DA] dark:border-[#1B4332] cursor-pointer text-xs text-[#131B2E] dark:text-[#F1F5F9]">
                  <input
                    type="checkbox"
                    checked={draftPublishPublicly}
                    onChange={(e) => setDraftPublishPublicly(e.target.checked)}
                    className="w-4 h-4 mt-0.5 accent-[#146B3A] shrink-0"
                  />
                  <span className="leading-relaxed">
                    <strong>ဝက်ဘ်ဆိုက် ဖသ်ဝါစာမျက်နှာတွင် အများပြည်သူ ဖတ်ရှုနိုင်ရန် ထုတ်ဝေမည်</strong>
                    <br />
                    <span className="text-[11px] text-[#525E75] dark:text-[#94A3B8]">
                      (မေးမြန်းသူ၏ အမည်၊ မြို့၊ Email၊ ဖုန်းနှင့် Viber နံပါတ်များ လုံးဝ မပါဝင်ဘဲ မေးခွန်းနှင့် အဖြေကိုသာ ဖော်ပြပါမည်)
                    </span>
                  </span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <a
                    href={`mailto:${activeQuestion.email}?subject=${encodeURIComponent(`Fatwa Answer: ${draftSubject || activeQuestion.subject}`)}&body=${encodeURIComponent(draftAnswer)}`}
                    className="min-h-[42px] px-4 py-2 rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-[#EFF3FA] dark:hover:bg-[#1B2A4A] text-[#1E3A8A] dark:text-[#93C5FD] text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email App မှ ပို့ရန်</span>
                  </a>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>သိမ်းဆည်းနေပါသည်...</span>
                      </>
                    ) : (
                      <>
                        {draftAnswer.trim() ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span>ဖသ်ဝါအဖြေ သိမ်းဆည်းမည်</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isDeleting && setConfirmDeleteItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#0D1526] border border-[#E2E8E4] dark:border-[#1E2C4A] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1A241E] dark:text-[#F1F5F9]">
                  ဖသ်ဝါ မေးမြန်းချက် ဖျက်သိမ်းရန်
                </h3>
                <p className="text-sm text-[#4A5850] dark:text-[#94A3B8] mt-1 leading-relaxed">
                  “{confirmDeleteItem.subject}” ကို အပြီးတိုင် ဖျက်သိမ်းရန် သေချာပါသလား။
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteItem(null)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-[#D4DDD7] dark:border-[#263759] text-xs font-semibold text-[#35433A] dark:text-[#CBD5E1]"
              >
                မဖျက်တော့ပါ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleConfirmDelete()}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                {isDeleting ? 'ဖျက်နေပါသည်...' : 'အတည်ပြု ဖျက်သိမ်းမည်'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
