import {useEffect, useState} from 'react';
import {Download, MoreVertical, Share, Smartphone, X} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'drawer' | 'footer';
  onAfterAction?: () => void;
}

export function PWAInstallButton({
  variant = 'header',
  onAfterAction,
}: PWAInstallButtonProps) {
  const {isInstallable, isInstalled, isIOS, isInAppBrowser, install} =
    usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!guideOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setGuideOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [guideOpen]);

  // Suppress install UI completely when already running inside installed standalone app
  if (isInstalled) {
    return null;
  }

  // On header, show native install button whenever Chromium prompt is ready or on iOS;
  // Drawer and Footer remain available as fallback entry points for in-app or non-Chromium browsers
  if (variant === 'header' && !isInstallable && !isIOS) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        onAfterAction?.();
      }
      return;
    }
    setGuideOpen(true);
  };

  const renderTrigger = () => {
    if (variant === 'header') {
      return (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center justify-center gap-1.5 min-h-[38px] sm:min-h-[40px] px-3 sm:px-3.5 py-1.5 text-[12.5px] sm:text-[13px] font-semibold rounded-md whitespace-nowrap shrink-0 bg-[#E2C792] text-[#0B152B] hover:bg-[#F3DFB1] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] shadow-sm"
          title="ဖုန်း App အဖြစ် Install လုပ်ရန်"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>App သွင်းရန်</span>
        </button>
      );
    }

    if (variant === 'drawer') {
      return (
        <button
          type="button"
          onClick={handleClick}
          className="w-full text-left px-3.5 min-h-[44px] rounded-md text-sm font-semibold flex items-center justify-between gap-2 bg-[#17284E] text-[#F3DFB1] hover:bg-[#1E3566] transition-colors"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#E2C792]" />
            <span>ဖုန်း App အဖြစ် သွင်းရန်</span>
          </span>
          <Download className="w-4 h-4 text-[#E2C792]" />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 text-[#E2C792] hover:text-white transition-colors font-semibold py-0.5"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>ဖုန်း App အဖြစ် သွင်းရန်</span>
      </button>
    );
  };

  return (
    <>
      {renderTrigger()}

      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091326]/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
          onClick={() => setGuideOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white text-[#131B2E] shadow-2xl border border-[#E2E8F0] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0D1830] px-5 py-4 flex items-center justify-between border-b border-[#1D2F57]">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Myanmar Muslim Library"
                  className="w-10 h-10 rounded-lg border border-[#E2C792]/30"
                />
                <div>
                  <h3
                    id="pwa-install-guide-title"
                    className="text-base font-bold text-white"
                  >
                    ဖုန်း App အဖြစ် Install လုပ်ရန်
                  </h3>
                  <p className="text-xs text-[#94A3B8]">
                    Myanmar Muslim Library (PWA)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="ပိတ်ရန်"
                className="p-1.5 rounded-md text-[#94A3B8] hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm leading-relaxed text-[#334155]">
              {isInAppBrowser && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                  လက်ရှိ Facebook / Messenger စတဲ့ App အတွင်း Browser မှ ဖွင့်ထားပါက{' '}
                  <strong>Open in Browser (Chrome သို့မဟုတ် Safari)</strong> ဖြင့် အရင်ဖွင့်ပြီးမှ Install လုပ်ပါ။
                </div>
              )}

              {isIOS ? (
                <ol className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#1E3A8A] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      ၁
                    </span>
                    <span>
                      Safari အောက်ခြေ (သို့မဟုတ် အပေါ်) ရှိ{' '}
                      <strong className="inline-flex items-center gap-1 text-[#0D1830]">
                        <Share className="w-3.5 h-3.5 text-[#1D4ED8]" /> Share
                      </strong>{' '}
                      ခလုတ်ကို နှိပ်ပါ။
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#1E3A8A] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      ၂
                    </span>
                    <span>
                      အောက်သို့ဆွဲချပြီး{' '}
                      <strong className="text-[#0D1830]">
                        Add to Home Screen
                      </strong>{' '}
                      ကို ရွေးချယ်နှိပ်ပါ။
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#1E3A8A] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      ၃
                    </span>
                    <span>
                      ညာဘက်အပေါ်ရှိ <strong className="text-[#0D1830]">Add</strong>{' '}
                      ကို နှိပ်လိုက်ပါက ဖုန်း Home Screen ပေါ်တွင် App အဖြစ် ရောက်ရှိပါမည်။
                    </span>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#1E3A8A] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      ၁
                    </span>
                    <span>
                      Chrome သို့မဟုတ် Edge Browser ညာဘက်အပေါ်ထောင့်ရှိ{' '}
                      <strong className="inline-flex items-center gap-0.5 text-[#0D1830]">
                        <MoreVertical className="w-3.5 h-3.5 text-[#1D4ED8]" />{' '}
                        Menu (⋮)
                      </strong>{' '}
                      ကို နှိပ်ပါ။
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-[#1E3A8A] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      ၂
                    </span>
                    <span>
                      <strong className="text-[#0D1830]">
                        Install app
                      </strong>{' '}
                      သို့မဟုတ်{' '}
                      <strong className="text-[#0D1830]">
                        Add to Home screen
                      </strong>{' '}
                      ကို နှိပ်၍{' '}
                      <strong className="text-[#0D1830]">Install</strong>{' '}
                      အတည်ပြုပါ။
                    </span>
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="w-full py-2.5 rounded-lg bg-[#0D1830] text-white text-sm font-semibold hover:bg-[#17284E] transition-colors"
              >
                နားလည်ပါပြီ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
