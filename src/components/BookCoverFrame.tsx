import {useEffect, useMemo, useState} from 'react';
import {BookOpen} from 'lucide-react';
import {buildDriveThumbnailUrls} from '../lib/googleDrive';
import {BookItem} from '../types/library';

interface BookCoverFrameProps {
  book: BookItem;
  compact?: boolean;
}

const THEME_PALETTES: Record<
  BookItem['coverTheme'],
  {bg: string; border: string; accent: string; text: string}
> = {
  emerald: {
    bg: 'from-[#115E34] via-[#146B3A] to-[#0D4726]',
    border: 'border-[#C59B27]/50',
    accent: 'text-[#E7C664]',
    text: 'text-white',
  },
  gold: {
    bg: 'from-[#6D4C12] via-[#8A6118] to-[#52370A]',
    border: 'border-[#F3D786]/50',
    accent: 'text-[#F6DC8C]',
    text: 'text-[#FFFDF5]',
  },
  teal: {
    bg: 'from-[#134E5E] via-[#1B6478] to-[#0E3B47]',
    border: 'border-[#C59B27]/45',
    accent: 'text-[#E8C96D]',
    text: 'text-white',
  },
  burgundy: {
    bg: 'from-[#6B1E2E] via-[#842639] to-[#4F1320]',
    border: 'border-[#E6C574]/50',
    accent: 'text-[#F0D58A]',
    text: 'text-[#FFF9F9]',
  },
  slate: {
    bg: 'from-[#1F352E] via-[#2A463D] to-[#162621]',
    border: 'border-[#C59B27]/45',
    accent: 'text-[#E7C664]',
    text: 'text-white',
  },
};

export function BookCoverFrame({book, compact = false}: BookCoverFrameProps) {
  const palette = THEME_PALETTES[book.coverTheme] || THEME_PALETTES.emerald;
  const thumbnailCandidates = useMemo(
    () => buildDriveThumbnailUrls(book.driveFileId),
    [book.driveFileId],
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setImageLoaded(false);
  }, [book.driveFileId]);

  const activeThumbUrl =
    candidateIndex < thumbnailCandidates.length
      ? thumbnailCandidates[candidateIndex]
      : null;

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#F3F5F4]">
      {/* Styled fallback cover shown while loading or if Drive thumbnail is unavailable */}
      <div
        className={`w-full h-full bg-gradient-to-br ${palette.bg} flex flex-col items-center justify-between ${
          compact ? 'p-1.5' : 'p-4'
        }`}
      >
        <div
          className={`w-full h-full border ${palette.border} rounded-sm flex flex-col items-center justify-between ${
            compact ? 'p-1' : 'p-3.5'
          } relative`}
        >
          {!compact && (
            <div className="flex flex-col items-center gap-1 pt-1">
              <span
                className={`font-[Amiri] text-xs tracking-wide ${palette.accent}`}
                dir="rtl"
              >
                بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ
              </span>
              <div className="w-8 h-px bg-current opacity-30" />
            </div>
          )}

          <div className="flex flex-col items-center text-center my-auto px-1">
            {compact ? (
              <BookOpen className={`w-4 h-4 ${palette.accent}`} />
            ) : (
              <>
                <div className="w-8 h-8 rounded-full border border-white/20 bg-white/10 flex items-center justify-center mb-2.5">
                  <BookOpen className={`w-4 h-4 ${palette.accent}`} />
                </div>
                <p
                  className={`${palette.text} font-semibold text-xs sm:text-sm leading-snug line-clamp-3`}
                >
                  {book.title}
                </p>
              </>
            )}
          </div>

          {!compact && (
            <div className="w-full text-center border-t border-white/15 pt-2 flex items-center justify-between text-[10px] text-white/80">
              <span className="truncate">{book.hijriYear || 'PDF'}</span>
              <span className="shrink-0 font-semibold">
                {book.fileSize || 'PDF'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Live Google Drive PDF first-page thumbnail */}
      {activeThumbUrl && (
        <img
          src={activeThumbUrl}
          alt={book.title}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth > 0) {
              setImageLoaded(true);
            } else {
              setCandidateIndex((idx) => idx + 1);
            }
          }}
          onError={() => {
            setImageLoaded(false);
            setCandidateIndex((idx) => idx + 1);
          }}
          className={`absolute inset-0 w-full h-full bg-[#F3F5F4] transition-opacity duration-200 ${
            compact ? 'object-cover object-top' : 'object-contain p-1.5'
          } ${imageLoaded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />
      )}
    </div>
  );
}
