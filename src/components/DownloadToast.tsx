import {useEffect, useState} from 'react';
import {AlertCircle, CheckCircle2, Loader2, X} from 'lucide-react';
import {
  clearDownloadToast,
  DownloadToastState,
  formatDownloadBytes,
  subscribeDownloadToast,
} from '../lib/directDownload';

export function DownloadToast() {
  const [toast, setToast] = useState<DownloadToastState | null>(null);

  useEffect(() => {
    return subscribeDownloadToast(setToast);
  }, []);

  if (!toast) return null;

  const isError = toast.phase === 'error';
  const isDone = toast.phase === 'done';
  const loadedLabel = formatDownloadBytes(toast.loadedBytes);
  const totalLabel = formatDownloadBytes(toast.totalBytes);
  const sizeSummary =
    loadedLabel && totalLabel && toast.phase === 'downloading'
      ? `${loadedLabel} / ${totalLabel}`
      : loadedLabel || '';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[356px] z-[60] pointer-events-auto"
    >
      <div
        className={`rounded-xl border px-4 py-3.5 shadow-lg ${
          isError
            ? 'bg-[#FEF2F2] dark:bg-[#2B1218] border-[#FECACA] dark:border-[#7F1D1D] text-[#B85338] dark:text-[#FCA5A5]'
            : 'bg-[#0D1830] dark:bg-[#0D1526] border-[#1E3A8A] dark:border-[#263759] text-white'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {isError ? (
              <AlertCircle className="w-4 h-4 text-[#B85338] dark:text-[#FCA5A5]" />
            ) : isDone ? (
              <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
            ) : (
              <Loader2 className="w-4 h-4 text-[#93C5FD] animate-spin" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold leading-snug">
                {toast.message}
              </p>
              {sizeSummary && !isError && (
                <span className="text-[11px] font-medium text-[#93C5FD] tabular-nums shrink-0">
                  {sizeSummary}
                </span>
              )}
            </div>
            <p
              className={`text-xs truncate mt-0.5 ${
                isError
                  ? 'text-[#991B1B]/80 dark:text-[#FECACA]/85'
                  : 'text-[#CBD5E1]'
              }`}
            >
              {toast.bookTitle}
            </p>
          </div>

          <button
            type="button"
            onClick={clearDownloadToast}
            aria-label="Close download notification"
            className={`shrink-0 p-1 rounded-md transition-colors ${
              isError
                ? 'text-[#B85338] dark:text-[#FCA5A5] hover:bg-[#FEE2E2] dark:hover:bg-[#451A22]'
                : 'text-[#CBD5E1] hover:bg-white/10 hover:text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {toast.phase === 'downloading' && (
          <div className="mt-2.5 h-1.5 w-full rounded-sm bg-white/15 overflow-hidden">
            <div
              className="h-full bg-[#60A5FA] transition-[width] duration-150"
              style={{
                width:
                  toast.percent !== null && toast.percent !== undefined
                    ? `${toast.percent}%`
                    : '35%',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
