import {useEffect, useRef, useState} from 'react';
import {Check, Loader2, Pencil, X} from 'lucide-react';
import {getScriptFontClass} from '../lib/scriptFonts';
import {BookCategoryId, CategoryItem} from '../types/library';

interface BookTitleEditorProps {
  title: string;
  categoryId?: BookCategoryId;
  categories?: CategoryItem[];
  canEdit: boolean;
  onSaveTitle?: (newTitle: string) => Promise<void>;
  onSaveBookDetails?: (
    newTitle: string,
    newCategoryId: BookCategoryId,
  ) => Promise<void>;
  variant?: 'card' | 'modal';
}

export function BookTitleEditor({
  title,
  categoryId,
  categories = [],
  canEdit,
  onSaveTitle,
  onSaveBookDetails,
  variant = 'card',
}: BookTitleEditorProps) {
  const editableCategories = categories.filter((c) => c.id !== 'videos');
  const hasCategoryEditor = Boolean(
    onSaveBookDetails && categoryId && editableCategories.length > 0,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftCategoryId, setDraftCategoryId] = useState<BookCategoryId>(
    categoryId || 'quran-tafsir',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraftTitle(title);
      if (categoryId) {
        setDraftCategoryId(categoryId);
      }
      setErrorMsg('');
    }
  }, [title, categoryId, isEditing]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleOpenEdit = () => {
    setDraftTitle(title);
    setDraftCategoryId(
      categoryId || editableCategories[0]?.id || 'quran-tafsir',
    );
    setErrorMsg('');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraftTitle(title);
    if (categoryId) {
      setDraftCategoryId(categoryId);
    }
    setErrorMsg('');
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftTitle.trim().slice(0, 240);
    if (!cleaned) {
      setErrorMsg('စာအုပ်အမည် ထည့်သွင်းပါ။');
      return;
    }

    const titleChanged = cleaned !== title.trim();
    const categoryChanged =
      hasCategoryEditor && draftCategoryId !== categoryId;

    if (!titleChanged && !categoryChanged) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg('');
      if (onSaveBookDetails && hasCategoryEditor) {
        await onSaveBookDetails(cleaned, draftCategoryId);
      } else if (onSaveTitle) {
        await onSaveTitle(cleaned);
      }
      setIsEditing(false);
    } catch {
      setErrorMsg(
        'ပြင်ဆင်သိမ်းဆည်းရာတွင် မအောင်မြင်ပါ။ ထပ်မံကြိုးစားကြည့်ပါ။',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const titleScriptClass = getScriptFontClass(title);
  const draftScriptClass = getScriptFontClass(draftTitle);

  if (canEdit && isEditing) {
    return (
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="space-y-2 mb-2.5 p-2.5 rounded-lg border border-[#1E3A8A]/35 dark:border-[#60A5FA]/40 bg-[#F6F7FA] dark:bg-[#09101E]"
      >
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-[#525E75] dark:text-[#94A3B8]">
            စာအုပ်အမည်
          </label>
          <input
            ref={inputRef}
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                handleCancel();
              }
            }}
            maxLength={240}
            disabled={isSaving}
            aria-label="စာအုပ်အမည်အသစ်"
            placeholder="စာအုပ်အမည်အသစ်..."
            className={`w-full px-2.5 py-1.5 rounded-lg border border-[#1E3A8A] dark:border-[#60A5FA] bg-white dark:bg-[#131E36] text-[#131B2E] dark:text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30 dark:focus:ring-[#60A5FA]/30 ${draftScriptClass} ${
              variant === 'modal'
                ? 'text-base font-semibold min-h-[42px]'
                : 'text-[13.5px] font-medium min-h-[38px]'
            }`}
          />
        </div>

        {hasCategoryEditor && (
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-[#525E75] dark:text-[#94A3B8]">
              ကဏ္ဍ (Category)
            </label>
            <select
              value={draftCategoryId}
              onChange={(e) =>
                setDraftCategoryId(e.target.value as BookCategoryId)
              }
              disabled={isSaving}
              aria-label="စာအုပ် Category ရွေးချယ်ရန်"
              className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-white dark:bg-[#131E36] text-xs font-semibold text-[#131B2E] dark:text-[#F1F5F9] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30 dark:focus:ring-[#60A5FA]/30"
            >
              {editableCategories.map((cat) => (
                <option
                  key={cat.id}
                  value={cat.id}
                  className="bg-white dark:bg-[#0D1526] text-[#131B2E] dark:text-[#F1F5F9]"
                >
                  {cat.nameMy}
                </option>
              ))}
            </select>
          </div>
        )}

        {errorMsg && (
          <p className="text-[11.5px] text-red-600 dark:text-red-400 font-medium">
            {errorMsg}
          </p>
        )}

        <div className="flex items-center gap-1.5 pt-0.5">
          <button
            type="submit"
            disabled={isSaving}
            className="min-h-[34px] px-3 py-1 rounded-md bg-[#1E3A8A] dark:bg-[#2563EB] hover:bg-[#172D6B] dark:hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>သိမ်းရန်</span>
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="min-h-[34px] px-2.5 py-1 rounded-md border border-[#D4DBE8] dark:border-[#263759] bg-white dark:bg-[#131E36] hover:bg-[#EFF3FA] dark:hover:bg-[#1B2A4A] text-[#334155] dark:text-[#E2E8F0] text-xs font-medium inline-flex items-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>ပယ်ဖျက်</span>
          </button>
        </div>
      </form>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <h3
          className={`text-lg sm:text-xl font-bold text-[#131B2E] dark:text-[#F1F5F9] leading-snug flex-1 min-w-0 ${titleScriptClass}`}
        >
          {title}
        </h3>
        {canEdit && (
          <button
            type="button"
            onClick={handleOpenEdit}
            className="shrink-0 min-h-[36px] px-3 py-1.5 rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-[#F6F7FA] dark:bg-[#131E36] hover:bg-[#EFF3FA] dark:hover:bg-[#1B2A4A] hover:border-[#1E3A8A]/50 dark:hover:border-[#60A5FA]/50 text-[#1E3A8A] dark:text-[#93C5FD] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>{hasCategoryEditor ? 'အမည်နှင့် Category ပြင်ရန်' : 'နာမည်ပြောင်းရန်'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-2 mb-2">
      <h3
        className={`text-[14px] font-semibold text-[#131B2E] dark:text-[#F1F5F9] leading-[1.55] line-clamp-2 flex-1 min-w-0 ${titleScriptClass}`}
      >
        {title}
      </h3>
      {canEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenEdit();
          }}
          title={
            hasCategoryEditor
              ? 'စာအုပ်နာမည်နှင့် Category ပြင်ရန်'
              : 'စာအုပ်နာမည်ပြောင်းရန်'
          }
          aria-label={
            hasCategoryEditor
              ? `${title} နာမည်နှင့် Category ပြင်ရန်`
              : `${title} နာမည်ပြောင်းရန်`
          }
          className="shrink-0 w-8 h-8 rounded-md border border-[#D4DBE8] dark:border-[#263759] bg-[#F6F7FA] dark:bg-[#131E36] hover:bg-[#EFF3FA] dark:hover:bg-[#1B2A4A] hover:border-[#1E3A8A]/50 dark:hover:border-[#60A5FA]/50 text-[#1E3A8A] dark:text-[#93C5FD] flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A8A] dark:focus-visible:ring-[#60A5FA]"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
