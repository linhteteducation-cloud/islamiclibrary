import {useEffect, useMemo, useState} from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  CATEGORY_ICON_OPTIONS,
  generateCategorySlug,
} from '../data/libraryData';
import {
  BookItem,
  CategoryIconName,
  CategoryItem,
  SiteSettings,
} from '../types/library';
import {CategoryIcon} from './CategoryIcon';

interface CategoryManagerModalProps {
  open: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  books: BookItem[];
  siteSettings: SiteSettings;
  onSaveCategory: (payload: {
    id: string;
    nameMy: string;
    nameEn: string;
    descriptionMy: string;
    iconName: CategoryIconName;
    sortOrder: number;
    isExistingDoc?: boolean;
  }) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onToggleCategoryVisibility: (categoryId: string) => Promise<void>;
}

export function CategoryManagerModal({
  open,
  onClose,
  categories,
  books,
  siteSettings,
  onSaveCategory,
  onDeleteCategory,
  onToggleCategoryVisibility,
}: CategoryManagerModalProps) {
  // Add New Category state
  const [newNameMy, setNewNameMy] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIcon, setNewIcon] = useState<CategoryIconName>('layers');
  const [isAdding, setIsAdding] = useState(false);

  // Edit Existing Category state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameMy, setEditNameMy] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIcon, setEditIcon] = useState<CategoryIconName>('book-open');
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Visibility / Delete / Feedback states
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const categoryBookCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of books) {
      map[b.categoryId] = (map[b.categoryId] || 0) + 1;
    }
    return map;
  }, [books]);

  if (!open) return null;

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedMy = newNameMy.trim();
    if (!cleanedMy) {
      setFeedback({
        type: 'error',
        text: 'Category မြန်မာအမည် ထည့်သွင်းပါ။',
      });
      return;
    }
    try {
      setIsAdding(true);
      setFeedback(null);
      const existingIds = new Set(categories.map((c) => c.id));
      const newId = generateCategorySlug(newNameEn, existingIds);
      const maxOrder = categories.reduce(
        (max, c, i) => Math.max(max, c.sortOrder ?? i),
        categories.length,
      );
      await onSaveCategory({
        id: newId,
        nameMy: cleanedMy,
        nameEn: newNameEn.trim(),
        descriptionMy: newDescription.trim(),
        iconName: newIcon,
        sortOrder: maxOrder + 1,
        isExistingDoc: false,
      });
      setNewNameMy('');
      setNewNameEn('');
      setNewDescription('');
      setNewIcon('layers');
      setFeedback({
        type: 'success',
        text: `Category အသစ် "${cleanedMy}" ကို ထပ်ခွဲသိမ်းဆည်းပြီးပါပြီ။`,
      });
    } catch {
      setFeedback({
        type: 'error',
        text: 'Category အသစ်ထည့်သွင်းရာတွင် မအောင်မြင်ပါ။ Admin အကောင့်ဖြင့် ဝင်ထားကြောင်း စစ်ဆေးပါ။',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (cat: CategoryItem, index: number) => {
    setEditingId(cat.id);
    setEditNameMy(cat.nameMy);
    setEditNameEn(cat.nameEn);
    setEditDescription(cat.descriptionMy);
    setEditIcon(cat.iconName);
    setEditSortOrder(typeof cat.sortOrder === 'number' ? cat.sortOrder : index);
    setConfirmDeleteId(null);
    setFeedback(null);
  };

  const handleSaveEdit = async (e: React.FormEvent, catId: string) => {
    e.preventDefault();
    const cleanedMy = editNameMy.trim();
    if (!cleanedMy) {
      setFeedback({
        type: 'error',
        text: 'Category မြန်မာအမည် ထည့်သွင်းပါ။',
      });
      return;
    }
    try {
      setIsSavingEdit(true);
      setFeedback(null);
      const targetCat = categories.find((c) => c.id === catId);
      await onSaveCategory({
        id: catId,
        nameMy: cleanedMy,
        nameEn: editNameEn.trim(),
        descriptionMy: editDescription.trim(),
        iconName: editIcon,
        sortOrder: editSortOrder,
        isExistingDoc: Boolean(targetCat?.isCustom || targetCat?.isOverridden),
      });
      setEditingId(null);
      setFeedback({
        type: 'success',
        text: `"${cleanedMy}" Category ကို Customize လုပ်ပြီးပါပြီ။`,
      });
    } catch {
      setFeedback({
        type: 'error',
        text: 'Category ပြင်ဆင်သိမ်းဆည်းရာတွင် အမှားဖြစ်ပွားပါသည်။',
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteOrReset = async (cat: CategoryItem) => {
    try {
      setBusyId(cat.id);
      setFeedback(null);
      await onDeleteCategory(cat.id);
      setConfirmDeleteId(null);
      setFeedback({
        type: 'success',
        text: cat.isCustom
          ? `"${cat.nameMy}" Category ကို ဖျက်လိုက်ပါပြီ။`
          : `"${cat.nameMy}" ကို မူလအတိုင်း ပြန်ထားလိုက်ပါပြီ။`,
      });
    } catch {
      setFeedback({
        type: 'error',
        text: 'လုပ်ဆောင်ချက် မအောင်မြင်ပါ။',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleVisibility = async (catId: string) => {
    try {
      setBusyId(catId);
      setFeedback(null);
      await onToggleCategoryVisibility(catId);
    } catch {
      setFeedback({
        type: 'error',
        text: 'ပြသ/ဖျောက်မှု ပြောင်းလဲရာတွင် မအောင်မြင်ပါ။',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-manager-title"
      className="fixed inset-0 z-50 bg-[#0D1830]/70 dark:bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 lg:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0D1526] w-full max-w-4xl h-[92vh] sm:h-[88vh] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#E2E6EE] dark:border-[#1E2C4A] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-[#0D1830] dark:bg-[#070E1E] border-b border-transparent dark:border-[#1E2C4A] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wider uppercase text-[#93C5FD]">
              Admin Category Customizer
            </p>
            <h2
              id="category-manager-title"
              className="font-serif text-base sm:text-lg font-bold text-white truncate flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4 text-[#E2C792] shrink-0" />
              <span>Category များ ထပ်ခွဲရန်နှင့် Customize လုပ်ရန်</span>
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close category customizer"
            className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#F6F7FA] dark:bg-[#060B17]">
          {feedback && (
            <div
              className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-medium flex items-center justify-between gap-3 ${
                feedback.type === 'success'
                  ? 'bg-[#EFF3FA] dark:bg-[#131E36] border-[#1E3A8A]/30 dark:border-[#60A5FA]/40 text-[#1E3A8A] dark:text-[#93C5FD]'
                  : 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300'
              }`}
            >
              <span>{feedback.text}</span>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-xs underline shrink-0"
              >
                ပိတ်ရန်
              </button>
            </div>
          )}

          {/* Section 1: Add New Category */}
          <form
            onSubmit={handleAddCategory}
            className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-[#EFF2F7] dark:border-[#1E2C4A] pb-3">
              <Plus className="w-4 h-4 text-[#1E3A8A] dark:text-[#60A5FA]" />
              <h3 className="text-sm sm:text-base font-bold text-[#131B2E] dark:text-[#F1F5F9]">
                Category အသစ် ထပ်ခွဲထည့်သွင်းရန်
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">
                  မြန်မာကဏ္ဍအမည် (Myanmar Name) *
                </label>
                <input
                  type="text"
                  required
                  value={newNameMy}
                  onChange={(e) => setNewNameMy(e.target.value)}
                  maxLength={120}
                  placeholder="ဥပမာ - စီရသ် (တမန်တော်မြတ်အတ္ထုပ္ပတ္တိ)"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F6F7FA] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA] focus:bg-white dark:focus:bg-[#131E36]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">
                  အင်္ဂလိပ်အမည် (English Name - Optional)
                </label>
                <input
                  type="text"
                  value={newNameEn}
                  onChange={(e) => setNewNameEn(e.target.value)}
                  maxLength={120}
                  placeholder="e.g., Seerah & Biography"
                  className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F6F7FA] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA] focus:bg-white dark:focus:bg-[#131E36]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">
                ကဏ္ဍအကြောင်းအရာ အကျဉ်း (Description - Optional)
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                maxLength={400}
                placeholder="ဤကဏ္ဍအောက်ရှိ စာအုပ်များအကြောင်း အကျဉ်းချုပ်..."
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-[#F6F7FA] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A] dark:focus:ring-[#60A5FA] focus:bg-white dark:focus:bg-[#131E36]"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1] mb-2">
                အိုင်ကွန်ရွေးချယ်ရန် (Icon)
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {CATEGORY_ICON_OPTIONS.map((opt) => {
                  const selected = newIcon === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNewIcon(opt.id)}
                      className={`min-h-[40px] px-2.5 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors ${
                        selected
                          ? 'bg-[#1E3A8A] dark:bg-[#2563EB] border-[#1E3A8A] dark:border-[#2563EB] text-white'
                          : 'bg-[#F6F7FA] dark:bg-[#131E36] border-[#D4DBE8] dark:border-[#263759] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#EFF3FA] dark:hover:bg-[#1A2A4A]'
                      }`}
                    >
                      <CategoryIcon name={opt.id} className="w-4 h-4 shrink-0" />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isAdding}
                className="min-h-[42px] px-5 py-2 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#3B82F6] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <span>Category အသစ်ထည့်သွင်းရန်</span>
              </button>
            </div>
          </form>

          {/* Section 2: Existing & Custom Categories List */}
          <div className="bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-xl p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFF2F7] dark:border-[#1E2C4A] pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#131B2E] dark:text-[#F1F5F9]">
                  ရှိပြီးသား Category များ Customize လုပ်ရန် ({categories.length})
                </h3>
                <p className="text-xs text-[#525E75] dark:text-[#94A3B8]">
                  ကဏ္ဍအမည်၊ အိုင်ကွန်၊ ရှင်းလင်းချက်နှင့် ပြသ/ဖျောက်မှုများကို စိတ်ကြိုက်ပြင်ဆင်နိုင်ပါသည်။
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {categories.map((cat, idx) => {
                const isEditingThis = editingId === cat.id;
                const isHidden = siteSettings.hiddenCategories.includes(cat.id);
                const bookCount = categoryBookCounts[cat.id] || 0;
                const isBusy = busyId === cat.id;

                return (
                  <div
                    key={cat.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      isHidden
                        ? 'bg-[#F8F9FC] dark:bg-[#091020] border-[#E2E6EE] dark:border-[#1E2C4A] opacity-80'
                        : 'bg-white dark:bg-[#0B1221] border-[#E2E6EE] dark:border-[#1E2C4A]'
                    }`}
                  >
                    {isEditingThis ? (
                      <form
                        onSubmit={(e) => handleSaveEdit(e, cat.id)}
                        className="space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11.5px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">
                              မြန်မာအမည် *
                            </label>
                            <input
                              type="text"
                              required
                              value={editNameMy}
                              onChange={(e) => setEditNameMy(e.target.value)}
                              maxLength={120}
                              className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-[#F6F7FA] dark:bg-[#131E36] border border-[#1E3A8A] dark:border-[#60A5FA] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11.5px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">
                              အင်္ဂလိပ်အမည်
                            </label>
                            <input
                              type="text"
                              value={editNameEn}
                              onChange={(e) => setEditNameEn(e.target.value)}
                              maxLength={120}
                              className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-[#F6F7FA] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                          <div className="sm:col-span-3">
                            <label className="block text-[11.5px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">
                              ရှင်းလင်းချက်
                            </label>
                            <input
                              type="text"
                              value={editDescription}
                              onChange={(e) =>
                                setEditDescription(e.target.value)
                              }
                              maxLength={400}
                              className="w-full min-h-[40px] px-3 py-1.5 text-sm bg-[#F6F7FA] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11.5px] font-semibold text-[#334155] dark:text-[#CBD5E1] mb-1">
                              အိုင်ကွန်
                            </label>
                            <select
                              value={editIcon}
                              onChange={(e) =>
                                setEditIcon(e.target.value as CategoryIconName)
                              }
                              className="w-full min-h-[40px] px-2.5 py-1.5 text-xs bg-[#F6F7FA] dark:bg-[#131E36] border border-[#D4DBE8] dark:border-[#263759] rounded-lg text-[#131B2E] dark:text-[#F1F5F9]"
                            >
                              {CATEGORY_ICON_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="submit"
                            disabled={isSavingEdit}
                            className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#3B82F6] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            {isSavingEdit ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>သိမ်းဆည်းရန်</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-[#F6F7FA] dark:bg-[#131E36] hover:bg-[#EFF3FA] dark:hover:bg-[#1A2A4A] text-[#334155] dark:text-[#CBD5E1] text-xs font-medium"
                          >
                            မလုပ်တော့ပါ
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#EFF3FA] dark:bg-[#131E36] text-[#1E3A8A] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
                            <CategoryIcon
                              name={cat.iconName}
                              className="w-5 h-5"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-sm font-bold text-[#131B2E] dark:text-[#F1F5F9] truncate">
                                {cat.nameMy}
                              </h4>
                              {cat.isCustom && (
                                <span className="text-[11px] font-semibold text-[#1E3A8A] dark:text-[#93C5FD] bg-[#EFF3FA] dark:bg-[#131E36] px-2 py-0.5 rounded">
                                  အသစ်ထပ်ခွဲထားမှု
                                </span>
                              )}
                              {cat.isOverridden && (
                                <span className="text-[11px] font-semibold text-[#B85338] dark:text-[#F0947A] bg-[#B85338]/10 dark:bg-[#B85338]/20 px-2 py-0.5 rounded">
                                  Customize ပြီး
                                </span>
                              )}
                              {isHidden && (
                                <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] bg-[#EFF2F7] dark:bg-[#131E36] px-2 py-0.5 rounded">
                                  ဖျောက်ထားသည်
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#525E75] dark:text-[#94A3B8] truncate">
                              {cat.nameEn || cat.id}
                              {cat.id !== 'videos' && (
                                <> · စာအုပ် {bookCount} အုပ်</>
                              )}
                            </p>
                            {cat.descriptionMy && (
                              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-1 mt-0.5">
                                {cat.descriptionMy}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(cat, idx)}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-[#F6F7FA] dark:bg-[#131E36] hover:bg-[#EFF3FA] dark:hover:bg-[#1A2A4A] text-[#1E3A8A] dark:text-[#93C5FD] text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>ပြင်ရန်</span>
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleToggleVisibility(cat.id)}
                            className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                              isHidden
                                ? 'border-[#1E3A8A]/30 dark:border-[#60A5FA]/40 bg-[#EFF3FA] dark:bg-[#131E36] text-[#1E3A8A] dark:text-[#93C5FD] hover:bg-[#E0E8F9] dark:hover:bg-[#1A2A4A]'
                                : 'border-[#D4DBE8] dark:border-[#263759] bg-white dark:bg-[#0D1526] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F6F7FA] dark:hover:bg-[#131E36]'
                            }`}
                          >
                            {isHidden ? (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>ပြန်ပြရန်</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>ဖျောက်ရန်</span>
                              </>
                            )}
                          </button>

                          {(cat.isCustom || cat.isOverridden) && (
                            confirmDeleteId === cat.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleDeleteOrReset(cat)}
                                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                                >
                                  {cat.isCustom ? 'အတည်ပြု ဖျက်ရန်' : 'မူလအတိုင်းပြန်ထား'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-[#D4DBE8] dark:border-[#263759] text-xs text-[#525E75] dark:text-[#94A3B8]"
                                >
                                  မဖျက်တော့ပါ
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(cat.id)}
                                className="min-h-[36px] px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-950/80 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1.5"
                              >
                                {cat.isCustom ? (
                                  <>
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>ဖျက်ရန်</span>
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>မူလပြန်ထား</span>
                                  </>
                                )}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
