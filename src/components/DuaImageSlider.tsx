import {useEffect, useMemo, useRef, useState} from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ImagePlus,
  Maximize2,
  Pause,
  Play,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {getScriptFontClass} from '../lib/scriptFonts';
import {DuaSlideItem} from '../types/library';

interface DuaImageSliderProps {
  slides: DuaSlideItem[];
  isAdmin?: boolean;
  onOpenDuaSlidesAdmin?: () => void;
}

function getDownloadExt(slide: DuaSlideItem): string {
  if (slide.mimeType === 'image/png' || slide.imageUrl.startsWith('data:image/png')) {
    return 'png';
  }
  if (slide.mimeType === 'image/webp' || slide.imageUrl.startsWith('data:image/webp')) {
    return 'webp';
  }
  if (slide.mimeType === 'image/gif' || slide.imageUrl.startsWith('data:image/gif')) {
    return 'gif';
  }
  return 'jpg';
}

export function DuaImageSlider({
  slides,
  isAdmin = false,
  onOpenDuaSlidesAdmin,
}: DuaImageSliderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slidesPerView, setSlidesPerView] = useState(3);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isPausedByUserInteraction, setIsPausedByUserInteraction] =
    useState(false);
  const [lightboxSlide, setLightboxSlide] = useState<DuaSlideItem | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>(
    {},
  );
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    const updateLayout = () => {
      const w = window.innerWidth;
      if (w < 640) {
        setSlidesPerView(1);
      } else if (w < 1024) {
        setSlidesPerView(Math.min(2, Math.max(1, slides.length)));
      } else {
        setSlidesPerView(Math.min(3, Math.max(1, slides.length)));
      }
    };
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [slides.length]);

  const maxIndex = useMemo(
    () => Math.max(0, slides.length - slidesPerView),
    [slides.length, slidesPerView],
  );

  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxIndex));
  }, [maxIndex]);

  useEffect(() => {
    if (
      !isAutoPlaying ||
      isPausedByUserInteraction ||
      lightboxSlide !== null ||
      slides.length <= 1 ||
      maxIndex <= 0
    ) {
      return;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, 3800);

    return () => window.clearInterval(timer);
  }, [
    isAutoPlaying,
    isPausedByUserInteraction,
    lightboxSlide,
    slides.length,
    maxIndex,
  ]);

  const handlePrev = () => {
    if (maxIndex <= 0) return;
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
  };

  const handleNext = () => {
    if (maxIndex <= 0) return;
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  };

  const handleLightboxNav = (dir: -1 | 1) => {
    if (!lightboxSlide || slides.length <= 1) return;
    const idx = slides.findIndex((s) => s.id === lightboxSlide.id);
    if (idx === -1) return;
    const nextIdx = (idx + dir + slides.length) % slides.length;
    setLightboxSlide(slides[nextIdx]);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
    setIsPausedByUserInteraction(true);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    const endX = e.changedTouches[0]?.clientX ?? null;
    touchStartXRef.current = null;
    setIsPausedByUserInteraction(false);
    if (startX === null || endX === null) return;
    const delta = endX - startX;
    if (Math.abs(delta) > 42) {
      if (delta < 0) handleNext();
      else handlePrev();
    }
  };

  return (
    <section
      aria-label="နေ့စဉ် ဒိုအာပုံရိပ်များ"
      className="bg-white dark:bg-[#09101E] border-b border-[#E2E6EE] dark:border-[#192848] py-10 sm:py-14"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        {((slides.length > 1 && maxIndex > 0) || (isAdmin && onOpenDuaSlidesAdmin)) && (
          <div className="flex flex-wrap items-center justify-end gap-2 mb-4 sm:mb-5">
            {slides.length > 1 && maxIndex > 0 && (
              <>
                <span className="text-xs text-[#525E75] dark:text-[#94A3B8] tabular-nums mr-1">
                  {currentIndex + 1} / {maxIndex + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAutoPlaying((v) => !v)}
                  aria-label={
                    isAutoPlaying
                      ? 'အလိုအလျောက်ရွေ့လျားမှု ရပ်ရန်'
                      : 'အလိုအလျောက်ရွေ့လျားမှု ပြန်ဖွင့်ရန်'
                  }
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-[#F8FAFC] dark:bg-[#0D1526] hover:bg-[#EFF3FA] dark:hover:bg-[#131E36] text-[#131B2E] dark:text-[#E2E8F0] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  {isAutoPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>ရပ်ထားရန်</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>အလိုအလျောက်ရွေ့ရန်</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="ယခင် ဒိုအာပုံကြည့်ရန်"
                  className="min-h-[40px] min-w-[40px] rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-white dark:bg-[#0D1526] hover:bg-[#EFF3FA] dark:hover:bg-[#131E36] text-[#131B2E] dark:text-[#E2E8F0] inline-flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="နောက်ထပ် ဒိုအာပုံကြည့်ရန်"
                  className="min-h-[40px] min-w-[40px] rounded-lg border border-[#D4DBE8] dark:border-[#263759] bg-white dark:bg-[#0D1526] hover:bg-[#EFF3FA] dark:hover:bg-[#131E36] text-[#131B2E] dark:text-[#E2E8F0] inline-flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {isAdmin && onOpenDuaSlidesAdmin && (
              <button
                type="button"
                onClick={onOpenDuaSlidesAdmin}
                className="min-h-[40px] px-3.5 py-1.5 rounded-lg border border-[#146B3A]/35 dark:border-[#34D399]/35 bg-[#EBF4EE] dark:bg-[#0D231B] hover:bg-[#DCECE2] dark:hover:bg-[#123326] text-[#146B3A] dark:text-[#6EE7B7] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>ပုံ Dua ထည့် / စီမံရန်</span>
              </button>
            )}
          </div>
        )}

        {slides.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#263759] bg-[#F8FAFC] dark:bg-[#0D1526] p-7 sm:p-9 text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-[#EBF4EE] dark:bg-[#0D231B] text-[#146B3A] dark:text-[#6EE7B7] flex items-center justify-center mx-auto">
              <ImagePlus className="w-5 h-5" />
            </div>
            <p className="text-base font-bold text-[#131B2E] dark:text-[#F1F5F9]">
              ရွေ့လျားပြသမည့် ဒိုအာပုံရိပ် (PNG / JPEG) များ မထည့်ရသေးပါ
            </p>
            <p className="text-sm text-[#525E75] dark:text-[#94A3B8] max-w-lg mx-auto leading-relaxed">
              Admin Panel ထဲမှ PNG, JPEG, WebP ဒိုအာပုံလေးများ ထည့်သွင်းလိုက်သည်နှင့် ဤနေရာတွင် အလိုအလျောက် ရွေ့လျားပြသပေးပါမည်။
            </p>
            {onOpenDuaSlidesAdmin && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onOpenDuaSlidesAdmin}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors"
                >
                  <ImagePlus className="w-4 h-4" />
                  <span>ပုံ Dua (PNG / JPEG) ထည့်သွင်းရန်</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div
            onMouseEnter={() => setIsPausedByUserInteraction(true)}
            onMouseLeave={() => setIsPausedByUserInteraction(false)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative"
          >
            <div className="overflow-hidden rounded-xl">
              <div
                className="flex transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform"
                style={{
                  transform: `translate3d(-${(currentIndex * 100) / slidesPerView}%, 0, 0)`,
                }}
              >
                {slides.map((slide) => {
                  const hasFailed = Boolean(failedImageIds[slide.id]);
                  return (
                    <div
                      key={slide.id}
                      style={{flex: `0 0 ${100 / slidesPerView}%`}}
                      className="px-2 box-border"
                    >
                      <article className="group h-full bg-[#F9FAFC] dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] hover:border-[#146B3A]/45 dark:hover:border-[#34D399]/45 rounded-xl overflow-hidden flex flex-col transition-all duration-150 hover:shadow-md">
                        <button
                          type="button"
                          onClick={() => setLightboxSlide(slide)}
                          aria-label={`${slide.title} ပုံကြီးချဲ့ကြည့်ရန်`}
                          className="relative aspect-[4/3] w-full bg-[#F1F5F9] dark:bg-[#070D1C] border-b border-[#E2E6EE] dark:border-[#1E2C4A] flex items-center justify-center overflow-hidden p-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#146B3A]"
                        >
                          {hasFailed ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-[#64748B] dark:text-[#94A3B8] p-4 text-center">
                              <ImagePlus className="w-7 h-7 opacity-60" />
                              <span className="text-xs font-medium line-clamp-2">
                                {slide.title}
                              </span>
                            </div>
                          ) : (
                            <img
                              src={slide.imageUrl}
                              alt={slide.title}
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              onError={() =>
                                setFailedImageIds((prev) => ({
                                  ...prev,
                                  [slide.id]: true,
                                }))
                              }
                              className="w-full h-full object-contain rounded-lg transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                          )}

                          <span className="absolute right-3 bottom-3 w-8 h-8 rounded-lg bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <Maximize2 className="w-4 h-4" />
                          </span>
                        </button>

                        <div className="p-3.5 sm:p-4 flex flex-col flex-1 justify-between gap-1.5">
                          <h3
                            className={`text-sm font-bold text-[#131B2E] dark:text-[#F1F5F9] line-clamp-1 ${getScriptFontClass(slide.title)}`}
                          >
                            {slide.title}
                          </h3>
                          {slide.caption.trim() ? (
                            <p
                              className={`text-xs text-[#525E75] dark:text-[#94A3B8] line-clamp-2 leading-relaxed ${getScriptFontClass(slide.caption)}`}
                            >
                              {slide.caption}
                            </p>
                          ) : (
                            <p className="text-[11.5px] text-[#64748B] dark:text-[#94A3B8]">
                              နှိပ်၍ အကြီးချဲ့ဖတ်ရှုနိုင်ပါသည်
                            </p>
                          )}
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
            </div>

            {slides.length > 1 && maxIndex > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-5">
                {Array.from({length: maxIndex + 1}).map((_, idx) => {
                  const active = idx === currentIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      aria-label={`စာမျက်နှာ ${idx + 1} သို့သွားရန်`}
                      className={`h-2 rounded-full transition-all duration-200 ${
                        active
                          ? 'w-7 bg-[#146B3A] dark:bg-[#34D399]'
                          : 'w-2 bg-[#CBD5E1] dark:bg-[#263759] hover:bg-[#94A3B8]'
                      }`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-screen Zoom Lightbox Modal */}
      {lightboxSlide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightboxSlide.title}
          onClick={() => setLightboxSlide(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full bg-white dark:bg-[#0D1526] border border-[#E2E6EE] dark:border-[#1E2C4A] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
          >
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#E2E6EE] dark:border-[#1E2C4A]">
              <div className="min-w-0">
                <h3
                  className={`text-sm sm:text-base font-bold text-[#131B2E] dark:text-[#F1F5F9] truncate ${getScriptFontClass(lightboxSlide.title)}`}
                >
                  {lightboxSlide.title}
                </h3>
                {lightboxSlide.caption && (
                  <p
                    className={`text-xs text-[#525E75] dark:text-[#94A3B8] truncate ${getScriptFontClass(lightboxSlide.caption)}`}
                  >
                    {lightboxSlide.caption}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={lightboxSlide.imageUrl}
                  download={`${lightboxSlide.title || 'dua'}.${getDownloadExt(lightboxSlide)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#146B3A] hover:bg-[#0F522D] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>သိမ်းဆည်းရန်</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxSlide(null)}
                  aria-label="ပိတ်ရန်"
                  className="min-h-[38px] min-w-[38px] rounded-lg border border-[#D4DBE8] dark:border-[#263759] text-[#525E75] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#131E36] inline-flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="relative flex-1 min-h-[280px] bg-[#F8FAFC] dark:bg-[#060B17] flex items-center justify-center p-4 sm:p-6 overflow-auto">
              <img
                src={lightboxSlide.imageUrl}
                alt={lightboxSlide.title}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-lg"
              />

              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleLightboxNav(-1)}
                    aria-label="ယခင်ပုံ"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-[#0D1526]/90 border border-[#E2E6EE] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] shadow-md flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLightboxNav(1)}
                    aria-label="နောက်ပုံ"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 dark:bg-[#0D1526]/90 border border-[#E2E6EE] dark:border-[#263759] text-[#131B2E] dark:text-[#F1F5F9] shadow-md flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
