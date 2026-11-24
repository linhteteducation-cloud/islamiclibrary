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
    // Deep Luminous Cobalt / Midnight Lapis Blue
    bg: 'from-[#0E1E4A] via-[#17306F] to-[#0A1533]',
    border: 'border-[#93C5FD]/40',
    accent: 'text-[#E2C792]',
    text: 'text-white',
  },
  gold: {
    // Energy Ochre / Burnt Amber
    bg: 'from-[#7A3B12] via-[#964918] to-[#57290B]',
    border: 'border-[#FDBA74]/45',
    accent: 'text-[#FED7AA]',
    text: 'text-[#FFFDF9]',
  },
  teal: {
    // Meadowland Olive Botanical Green
    bg: 'from-[#2D3E1E] via-[#3E5529] to-[#202C15]',
    border: 'border-[#BEF264]/35',
    accent: 'text-[#E5E0B5]',
    text: 'text-white',
  },
  burgundy: {
    // Warm Clay / Muted Rose
    bg: 'from-[#6B2737] via-[#833245] to-[#4C1A26]',
    border: 'border-[#FBCFE8]/40',
    accent: 'text-[#F5D0DC]',
    text: 'text-[#FFF9FA]',
  },
  slate: {
    // Deep Editorial Slate Navy
    bg: 'from-[#1E293B] via-[#2B3B52] to-[#131B29]',
    border: 'border-[#CBD5E1]/35',
    accent: 'text-[#E2C792]',
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
    <div className="relative w-full h-full overflow-hidden select-none bg-[#EFF2F7]">
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
          className={`absolute inset-0 w-full h-full bg-[#EFF2F7] transition-opacity duration-200 ${
            compact ? 'object-cover object-top' : 'object-contain p-1.5'
          } ${imageLoaded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />
      )}
    </div>
  );
}
