import {useEffect, useState} from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'; platform: string}>;
}

// Capture beforeinstallprompt early at module evaluation time so React never misses it
let capturedPromptEvent: BeforeInstallPromptEvent | null = null;
const promptSubscribers = new Set<(ev: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    capturedPromptEvent = e as BeforeInstallPromptEvent;
    promptSubscribers.forEach((cb) => cb(capturedPromptEvent));
  });

  window.addEventListener('appinstalled', () => {
    capturedPromptEvent = null;
    promptSubscribers.forEach((cb) => cb(null));
  });
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as {standalone?: boolean}).standalone === true
  );
}

function checkIsIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isLegacyIOS = /iphone|ipad|ipod/.test(ua);
  const isIPadOS =
    window.navigator.platform === 'MacIntel' &&
    window.navigator.maxTouchPoints > 1;
  return isLegacyIOS || isIPadOS;
}

function checkIsInAppBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|wv\)/i.test(ua);
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(capturedPromptEvent);
  const [isInstalled, setIsInstalled] = useState<boolean>(checkIsStandalone);
  const [isIOS] = useState<boolean>(checkIsIOS);
  const [isInAppBrowser] = useState<boolean>(checkIsInAppBrowser);

  useEffect(() => {
    setIsInstalled(checkIsStandalone());
    setDeferredPrompt(capturedPromptEvent);

    const onPromptChange = (ev: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(ev);
    };
    promptSubscribers.add(onPromptChange);

    const onAppInstalled = () => {
      capturedPromptEvent = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
    };
    window.addEventListener('appinstalled', onAppInstalled);

    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };
    standaloneQuery.addEventListener('change', onDisplayModeChange);

    return () => {
      promptSubscribers.delete(onPromptChange);
      window.removeEventListener('appinstalled', onAppInstalled);
      standaloneQuery.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptEvent = deferredPrompt ?? capturedPromptEvent;
    if (!promptEvent) return false;

    await promptEvent.prompt();
    const {outcome} = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      capturedPromptEvent = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      return true;
    }
    return false;
  };

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isInAppBrowser,
    install,
  };
}
