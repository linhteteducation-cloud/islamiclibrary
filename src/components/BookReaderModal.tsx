import {useEffect} from 'react';
import {
  Bookmark,
  Download,
  ExternalLink,
  FileText,
  User,
  X,
} from 'lucide-react';
import {isValidSafeHttpsUrl} from '../lib/googleDrive';
import {BookItem} from '../types/library';
import {BookCoverFrame} from './BookCoverFrame';

interface BookReaderModalProps {
  book: BookItem | null;
  onClose: () => void;
  isBookmarked: boolean;
  onToggleBookmark: (bookId: string) => void;
}

export function BookReaderModal({
  book,
  onClose,
  isBookmarked,
  onToggleBookmark,
}: BookReaderModalProps) {
  useEffect(() => {
    if (!book) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [book, onClose]);

  if (!book) return null;

  const safeViewUrl = isValidSafeHttpsUrl(book.driveViewUrl)
    ? book.driveViewUrl
    : '';
  const safeDownloadUrl = isValidSafeHttpsUrl(book.driveDownloadUrl)
    ? book.driveDownloadUrl
    : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-modal-title"
      className="fixed inset-0 z-50 bg-[#0D1830]/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 lg:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-5xl h-[94vh] sm:h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-[#E2E6EE] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#E2E6EE] bg-[#F6F7FA] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold text-[#B85338] truncate">
              {book.categoryLabel} · {book.type}
            </p>
            <h2
              id="book-modal-title"
              className="text-sm sm:text-base font-bold text-[#131B2E] truncate"
            >
              {book.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleBookmark(book.id)}
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
              className={`min-h-[40px] px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                isBookmarked
                  ? 'bg-[#B85338] border-[#B85338] text-white'
                  : 'bg-white border-[#D4DBE8] text-[#334155] hover:bg-[#EFF3FA]'
              }`}
            >
              <Bookmark
                className="w-4 h-4"
                fill={isBookmarked ? 'currentColor' : 'none'}
              />
              <span className="hidden sm:inline">
                {isBookmarked ? 'သိမ်းပြီး' : 'သိမ်းဆည်းရန်'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close reader"
              className="w-10 h-10 rounded-lg bg-white border border-[#D4DBE8] text-[#334155] hover:bg-[#EFF3FA] flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Book Details */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 pb-5 border-b border-[#E6EAF2]">
            <div className="sm:col-span-3 lg:col-span-2">
              <div className="aspect-[3/4] max-w-[140px] mx-auto sm:max-w-none rounded-lg overflow-hidden border border-[#E2E6EE] shadow-sm">
                <BookCoverFrame book={book} />
              </div>
            </div>

            <div className="sm:col-span-9 lg:col-span-10 flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-[#131B2E] leading-snug">
                  {book.title}
                </h3>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#525E75]">
                  {book.author.trim() && (
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-4 h-4 text-[#1E3A8A]" />
                      {book.author}
                    </span>
                  )}
                  {book.hijriYear && (
                    <>
                      {book.author.trim() && <span aria-hidden="true">·</span>}
                      <span>{book.hijriYear}</span>
                    </>
                  )}
                  {book.pages > 0 && (
                    <>
                      {(book.author.trim() || book.hijriYear) && (
                        <span aria-hidden="true">·</span>
                      )}
                      <span className="tabular-nums">{book.pages} စာမျက်နှာ</span>
                    </>
                  )}
                  {book.fileSize && (
                    <>
                      {(book.author.trim() || book.hijriYear || book.pages > 0) && (
                        <span aria-hidden="true">·</span>
                      )}
                      <span className="tabular-nums">{book.fileSize}</span>
                    </>
                  )}
                </div>

                {book.summary && (
                  <p className="text-sm text-[#334155] leading-[1.8] pt-1">
                    {book.summary}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {safeDownloadUrl && (
                  <a
                    href={safeDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[42px] px-5 py-2 rounded-lg bg-[#1E3A8A] hover:bg-[#172D6B] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>PDF ဒေါင်းလုဒ်ရယူရန်</span>
                  </a>
                )}
                {safeViewUrl && (
                  <a
                    href={safeViewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[42px] px-4 py-2 rounded-lg border border-[#D4DBE8] bg-white hover:bg-[#EFF3FA] text-[#131B2E] text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-[#1E3A8A]" />
                    <span>Google Drive ဖြင့်ဖွင့်ရန်</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Embedded Google Drive PDF Reader */}
          {safeViewUrl ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#525E75]">
                <FileText className="w-4 h-4 text-[#1E3A8A]" />
                <span>PDF အွန်လိုင်းစာဖတ်စနစ် (Google Drive Viewer)</span>
              </div>
              <div className="w-full h-[55vh] sm:h-[60vh] rounded-xl overflow-hidden border border-[#E2E6EE] bg-[#EFF2F7]">
                <iframe
                  title={book.title}
                  src={safeViewUrl}
                  className="w-full h-full border-0"
                  allow="autoplay"
                />
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-[#E2E6EE] bg-[#F6F7FA] text-center text-sm text-[#525E75]">
              PDF ကြည့်ရှုရန် လင့်ခ်မရှိသေးပါ။
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
