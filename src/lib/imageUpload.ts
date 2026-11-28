import {DuaSlideMimeType} from '../types/library';

const MAX_DATA_URL_CHARS = 780_000;

export interface ProcessedDuaImage {
  imageUrl: string;
  mimeType: DuaSlideMimeType;
  titleSuggestion: string;
  originalBytes: number;
  finalBytes: number;
}

function inferMimeFromFile(file: File): DuaSlideMimeType | null {
  const rawType = (file.type || '').toLowerCase().trim();
  if (rawType === 'image/png') return 'image/png';
  if (rawType === 'image/jpeg' || rawType === 'image/jpg') return 'image/jpeg';
  if (rawType === 'image/webp') return 'image/webp';
  if (rawType === 'image/gif') return 'image/gif';

  const lowerName = (file.name || '').toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  return null;
}

function normalizeDataUrlMime(
  dataUrl: string,
  expectedMime: DuaSlideMimeType,
): string {
  // Normalize rare non-standard prefix like data:image/jpg;base64, -> data:image/jpeg;base64,
  if (dataUrl.startsWith('data:image/jpg;base64,')) {
    return `data:image/jpeg;base64,${dataUrl.slice('data:image/jpg;base64,'.length)}`;
  }
  if (
    expectedMime !== 'url' &&
    dataUrl.startsWith('data:application/octet-stream;base64,')
  ) {
    return `data:${expectedMime};base64,${dataUrl.slice(
      'data:application/octet-stream;base64,'.length,
    )}`;
  }
  return dataUrl;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('ပုံဖိုင် ဖတ်ရှု၍ မရပါ။'));
      }
    };
    reader.onerror = () => reject(new Error('ပုံဖိုင် ဖတ်ရှုရာတွင် အမှားဖြစ်ပေါ်ပါသည်။'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('ပုံဖိုင် Format ကို Browser မှ ဖွင့်၍ မရပါ (PNG/JPEG မှန်ကန်ကြောင်း စစ်ဆေးပါ)။'));
    img.src = src;
  });
}

function estimateBase64Bytes(dataUrl: string): number {
  const idx = dataUrl.indexOf(';base64,');
  if (idx === -1) return dataUrl.length;
  const b64Len = dataUrl.length - (idx + 8);
  return Math.round((b64Len * 3) / 4);
}

function stripFileExtension(filename: string): string {
  return filename
    .replace(/\.(png|jpe?g|webp|gif)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function processDuaImageFile(
  file: File,
): Promise<ProcessedDuaImage> {
  const detectedMime = inferMimeFromFile(file);
  if (!detectedMime || detectedMime === 'url') {
    throw new Error(
      'PNG, JPEG (JPG), WebP သို့မဟုတ် GIF ပုံဖိုင်များကိုသာ တင်သွင်းနိုင်ပါသည်။',
    );
  }

  const titleSuggestion = stripFileExtension(file.name) || 'ဒိုအာပုံရိပ်';

  // Fast path: If already safely within Firestore size budget, keep pixel-identical original file!
  if (file.size <= 540_000) {
    const rawUrl = normalizeDataUrlMime(
      await readFileAsDataUrl(file),
      detectedMime,
    );
    if (rawUrl.length <= MAX_DATA_URL_CHARS) {
      return {
        imageUrl: rawUrl,
        mimeType: detectedMime,
        titleSuggestion,
        originalBytes: file.size,
        finalBytes: estimateBase64Bytes(rawUrl),
      };
    }
  }

  if (detectedMime === 'image/gif') {
    throw new Error(
      'GIF ဖိုင်အရွယ်အစား 540 KB ထက် ကျော်လွန်နေပါသည်။ ပိုမိုသေးငယ်သော GIF သို့မဟုတ် PNG/JPEG ကို ရွေးချယ်ပါ။',
    );
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser Canvas စနစ် မရနိုင်ပါ။');
    }

    const maxDimensions = [1600, 1280, 1024, 820, 640];
    const isPng = detectedMime === 'image/png';

    // Try lossless PNG at progressively scaled sizes first so transparent PNGs stay PNG when possible
    if (isPng) {
      for (const maxDim of [1280, 960, 760]) {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const candidate = canvas.toDataURL('image/png');
        if (candidate.length <= MAX_DATA_URL_CHARS) {
          return {
            imageUrl: candidate,
            mimeType: 'image/png',
            titleSuggestion,
            originalBytes: file.size,
            finalBytes: estimateBase64Bytes(candidate),
          };
        }
      }

      // Fallback for high-res PNGs: WebP preserves full alpha transparency at 5x smaller size
      for (const maxDim of maxDimensions) {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.9, 0.8, 0.7]) {
          const candidate = canvas.toDataURL('image/webp', quality);
          if (
            candidate.startsWith('data:image/webp;base64,') &&
            candidate.length <= MAX_DATA_URL_CHARS
          ) {
            return {
              imageUrl: candidate,
              mimeType: 'image/webp',
              titleSuggestion,
              originalBytes: file.size,
              finalBytes: estimateBase64Bytes(candidate),
            };
          }
        }
      }
    }

    // JPEG / WebP progressive crisp compression
    const targetMime: 'image/jpeg' | 'image/webp' =
      detectedMime === 'image/webp' ? 'image/webp' : 'image/jpeg';

    for (const maxDim of maxDimensions) {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (targetMime === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.88, 0.78, 0.68, 0.56]) {
        const candidate = canvas.toDataURL(targetMime, quality);
        if (candidate.length <= MAX_DATA_URL_CHARS) {
          return {
            imageUrl: candidate,
            mimeType: targetMime,
            titleSuggestion,
            originalBytes: file.size,
            finalBytes: estimateBase64Bytes(candidate),
          };
        }
      }
    }

    throw new Error(
      'ပုံအရွယ်အစား အလွန်ကြီးမားနေပါသည်။ ပိုမိုသေးငယ်သော PNG သို့မဟုတ် JPEG ဖိုင် ရွေးချယ်ပါ။',
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function normalizeDuaImageExternalUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('ပုံ Link (https://) ထည့်သွင်းပါ။');
  }
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    throw new Error('လုံခြုံရေးအရ ခွင့်မပြုသော Link ဖြစ်နေပါသည်။');
  }

  let candidate = trimmed;
  if (/^http:\/\//i.test(candidate)) {
    candidate = `https://${candidate.slice(7)}`;
  } else if (!/^https:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, '')}`;
  }

  // Convert Google Drive share links cleanly to direct high-res image URL
  const driveMatch = candidate.match(
    /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#\s]*&)?id=)|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]{10,200})/i,
  );
  if (driveMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveMatch[1])}=w1600`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('မှန်ကန်သော https:// ပုံ Link ထည့်သွင်းပါ။');
  }
  if (parsed.protocol !== 'https:' || candidate.length > 1000) {
    throw new Error('ပုံ Link သည် မှန်ကန်သော https:// URL ဖြစ်ရပါမည်။');
  }
  return parsed.toString();
}
