import {DriveFileSummary} from '../types/library';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export function formatBytes(bytesInput: number | string | undefined): string {
  const bytes = typeof bytesInput === 'string' ? Number(bytesInput) : bytesInput;
  if (!bytes || Number.isNaN(bytes)) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function buildDriveUrls(fileId: string) {
  return {
    driveViewUrl: `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`,
    driveDownloadUrl: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
  };
}

export function buildDriveThumbnailUrls(fileId: string): string[] {
  const cleanId = fileId.trim();
  if (!isValidDriveFileId(cleanId)) return [];
  const encoded = encodeURIComponent(cleanId);
  return [
    `https://drive.google.com/thumbnail?id=${encoded}&sz=w800`,
    `https://lh3.googleusercontent.com/d/${encoded}=w800`,
  ];
}

export function isValidSafeHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function extractDriveFileId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Match /file/d/<ID>/... or /d/<ID>
  const pathMatch = trimmed.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,})/);
  if (pathMatch?.[1]) {
    return pathMatch[1];
  }

  // Match ?id=<ID> or &id=<ID>
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const parsed = new URL(trimmed);
      const idParam = parsed.searchParams.get('id');
      if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) {
        return idParam;
      }
    }
  } catch {
    // Fallback to raw input below
  }

  return trimmed;
}

export function isValidDriveFileId(fileId: string): boolean {
  return /^[a-zA-Z0-9_-]{5,200}$/.test(fileId.trim());
}

export class DriveApiError extends Error {
  status: number;
  isServiceDisabled: boolean;
  activationUrl?: string;

  constructor(
    message: string,
    options: {
      status: number;
      isServiceDisabled?: boolean;
      activationUrl?: string;
    },
  ) {
    super(message);
    this.name = 'DriveApiError';
    this.status = options.status;
    this.isServiceDisabled = Boolean(options.isServiceDisabled);
    this.activationUrl = options.activationUrl;
  }
}

interface GoogleErrorDetail {
  reason?: string;
  metadata?: {
    activationUrl?: string;
  };
  links?: Array<{
    url?: string;
  }>;
}

interface GoogleApiErrorPayload {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{reason?: string; message?: string}>;
    details?: GoogleErrorDetail[];
  };
}

export function parseDriveApiError(
  status: number,
  rawBody: string,
  fallbackActionLabel: string,
): DriveApiError {
  try {
    const parsed = JSON.parse(rawBody) as GoogleApiErrorPayload;
    const errObj = parsed?.error;
    const rawMsg = errObj?.message || '';
    const isDisabled =
      status === 403 &&
      (errObj?.details?.some((d) => d.reason === 'SERVICE_DISABLED') ||
        errObj?.errors?.some((e) => e.reason === 'accessNotConfigured') ||
        rawMsg.includes('has not been used in project') ||
        rawMsg.includes('is disabled'));

    if (isDisabled) {
      let activationUrl: string | undefined;
      for (const detail of errObj?.details || []) {
        if (detail.metadata?.activationUrl && isValidSafeHttpsUrl(detail.metadata.activationUrl)) {
          activationUrl = detail.metadata.activationUrl;
          break;
        }
        const linkUrl = detail.links?.find(
          (l) => l.url && isValidSafeHttpsUrl(l.url),
        )?.url;
        if (linkUrl) {
          activationUrl = linkUrl;
          break;
        }
      }
      if (!activationUrl) {
        const urlMatch = rawMsg.match(
          /https:\/\/console\.developers\.google\.com\/apis\/api\/drive\.googleapis\.com[^\s"']*/,
        );
        if (urlMatch?.[0] && isValidSafeHttpsUrl(urlMatch[0])) {
          activationUrl = urlMatch[0];
        }
      }

      return new DriveApiError(
        'Google Cloud Project ထဲတွင် Google Drive API ကို ဖွင့်ထားခြင်း (Enable) မရှိသေးပါ။ အောက်ပါ ခလုတ်ကို နှိပ်၍ Enable လုပ်ပြီး ၁-၂ မိနစ်ခန့် စောင့်ကာ ပြန်လည်စစ်ဆေးပါ။',
        {
          status,
          isServiceDisabled: true,
          activationUrl,
        },
      );
    }

    if (status === 401) {
      return new DriveApiError(
        'Google Drive ချိတ်ဆက်ခွင့် သက်တမ်းကုန်ဆုံးသွားပါသည်။ "Google Drive ချိတ်ဆက်ရန်" ဖြင့် ပြန်လည်ဝင်ရောက်ပါ။',
        {status},
      );
    }

    if (rawMsg) {
      return new DriveApiError(`${fallbackActionLabel} (${status}): ${rawMsg}`, {
        status,
      });
    }
  } catch {
    // Non-JSON response body
  }

  return new DriveApiError(`${fallbackActionLabel} (${status})`, {status});
}

export async function ensureLibraryDriveFolder(
  accessToken: string,
  folderName: string,
  existingFolderId?: string,
): Promise<{folderId: string; folderName: string}> {
  if (existingFolderId) {
    const checkRes = await fetch(
      `${DRIVE_API_BASE}/files/${encodeURIComponent(existingFolderId)}?fields=id,name,trashed`,
      {
        headers: {Authorization: `Bearer ${accessToken}`},
      },
    );
    if (checkRes.ok) {
      const existingData = (await checkRes.json()) as {
        id: string;
        name: string;
        trashed?: boolean;
      };
      if (existingData.id && !existingData.trashed) {
        await makeDriveFilePublicReadable(accessToken, existingData.id).catch(
          () => {},
        );
        return {folderId: existingData.id, folderName: existingData.name};
      }
    } else if (checkRes.status === 403 || checkRes.status === 401) {
      const errText = await checkRes.text();
      throw parseDriveApiError(
        checkRes.status,
        errText,
        'Google Drive ဖိုလ်ဒါ စစ်ဆေးမှု မအောင်မြင်ပါ',
      );
    }
  }

  // Search for existing folder created by this app (current or legacy name)
  const candidateNames = Array.from(
    new Set([folderName, 'Myanmar Islamic Library PDFs']),
  );
  const nameFilter = candidateNames
    .map((n) => `name='${n.replace(/'/g, "\\'")}'`)
    .join(' or ');
  const q = encodeURIComponent(
    `(${nameFilter}) and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const searchRes = await fetch(
    `${DRIVE_API_BASE}/files?q=${q}&fields=files(id,name)&pageSize=5`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );
  if (searchRes.ok) {
    const searchJson = (await searchRes.json()) as {
      files?: {id: string; name: string}[];
    };
    if (searchJson.files && searchJson.files.length > 0) {
      const matched =
        searchJson.files.find((f) => f.name === folderName) ||
        searchJson.files[0];
      await makeDriveFilePublicReadable(accessToken, matched.id).catch(
        () => {},
      );
      return {
        folderId: matched.id,
        folderName: matched.name,
      };
    }
  } else if (searchRes.status === 403 || searchRes.status === 401) {
    const errText = await searchRes.text();
    throw parseDriveApiError(
      searchRes.status,
      errText,
      'Google Drive ဖိုလ်ဒါ ရှာဖွေမှု မအောင်မြင်ပါ',
    );
  }

  // Create new folder in Google Drive
  const createRes = await fetch(`${DRIVE_API_BASE}/files?fields=id,name`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw parseDriveApiError(
      createRes.status,
      errText,
      'Google Drive ဖိုလ်ဒါ ဖန်တီးမှု မအောင်မြင်ပါ',
    );
  }

  const created = (await createRes.json()) as {id: string; name: string};
  await makeDriveFilePublicReadable(accessToken, created.id).catch(() => {});
  return {folderId: created.id, folderName: created.name};
}

export function inferBookMetadataFromFileName(fileName: string): {
  title: string;
  author: string;
  categoryId:
    | 'quran-tafsir'
    | 'hadith'
    | 'shariah'
    | 'dua-amal'
    | 'aqeedah'
    | 'history'
    | 'ethics'
    | 'children'
    | 'periodicals'
    | 'research'
    | 'azan';
} {
  const baseName = fileName.replace(/\.pdf$/i, '').trim() || 'Untitled PDF';
  const parts = baseName.split(/\s+-\s+/);
  const rawTitle = (parts[0] || baseName).replace(/_/g, ' ').trim();
  const rawAuthor =
    parts.length > 1
      ? parts.slice(1).join(' - ').replace(/_/g, ' ').trim()
      : '';

  const lower = baseName.toLowerCase();
  let categoryId:
    | 'quran-tafsir'
    | 'hadith'
    | 'shariah'
    | 'dua-amal'
    | 'aqeedah'
    | 'history'
    | 'ethics'
    | 'children'
    | 'periodicals'
    | 'research'
    | 'azan' = 'quran-tafsir';

  if (/hadith|ဟဒီးစ်|ဟဒီးသ်/.test(lower)) categoryId = 'hadith';
  else if (/shariah|fiqh|ရှရီအသ်|ဖိကဟ်/.test(lower)) categoryId = 'shariah';
  else if (/dua|amal|ဒိုအာ|အအ်မာလ်/.test(lower)) categoryId = 'dua-amal';
  else if (/aqeedah|aqidah|အကီဒဟ်|ယုံကြည်ချက်/.test(lower)) categoryId = 'aqeedah';
  else if (/history|seerah|သမိုင်း/.test(lower)) categoryId = 'history';
  else if (/ethics|akhlaq|ကိုယ်ကျင့်/.test(lower)) categoryId = 'ethics';
  else if (/child|kids|ကလေး|ရင်သွေး/.test(lower)) categoryId = 'children';
  else if (/periodical|magazine|journal|စာစောင်/.test(lower)) categoryId = 'periodicals';
  else if (/research|paper|သုတေသန/.test(lower)) categoryId = 'research';
  else if (/azan|adhan|prayer|timetable|အဇာန်|ဆွလာသ်/.test(lower)) categoryId = 'azan';

  return {
    title: rawTitle.slice(0, 240) || 'PDF စာအုပ်',
    author: rawAuthor.slice(0, 160),
    categoryId,
  };
}

export async function makeDriveFilePublicReadable(
  accessToken: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw parseDriveApiError(
      res.status,
      errText,
      'Google Drive PDF ဖတ်ရှုခွင့် သတ်မှတ်မှု မအောင်မြင်ပါ',
    );
  }
}

export function uploadPdfToGoogleDrive(
  accessToken: string,
  file: File,
  folderId: string,
  onProgress?: (percent: number) => void,
): Promise<{
  driveFileId: string;
  driveViewUrl: string;
  driveDownloadUrl: string;
  fileSize: string;
  fileName: string;
}> {
  if (
    file.type !== 'application/pdf' &&
    !file.name.toLowerCase().endsWith('.pdf')
  ) {
    return Promise.reject(new Error('PDF ဖိုင် (.pdf) ကိုသာ ရွေးချယ်တင်သွင်းနိုင်ပါသည်။'));
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return Promise.reject(new Error('PDF ဖိုင်အရွယ်အစားသည် 50 MB ထက် မကျော်ရပါ။'));
  }

  return new Promise((resolve, reject) => {
    const metadata = {
      name: file.name,
      mimeType: 'application/pdf',
      parents: folderId ? [folderId] : undefined,
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], {type: 'application/json'}),
    );
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,size,webViewLink,webContentLink`,
    );
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const pct = Math.min(95, Math.round((event.loaded / event.total) * 95));
        onProgress(pct);
      }
    };

    xhr.onload = async () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          parseDriveApiError(
            xhr.status,
            xhr.responseText,
            'Google Drive သို့ PDF တင်သွင်းမှု မအောင်မြင်ပါ',
          ),
        );
        return;
      }

      try {
        const uploaded = JSON.parse(xhr.responseText) as {
          id: string;
          name: string;
          size?: string;
        };

        await makeDriveFilePublicReadable(accessToken, uploaded.id);
        if (onProgress) onProgress(100);

        const urls = buildDriveUrls(uploaded.id);
        resolve({
          driveFileId: uploaded.id,
          driveViewUrl: urls.driveViewUrl,
          driveDownloadUrl: urls.driveDownloadUrl,
          fileSize: formatBytes(uploaded.size ?? file.size),
          fileName: uploaded.name,
        });
      } catch (err) {
        reject(err);
      }
    };

    xhr.onerror = () => {
      reject(new Error('Google Drive သို့ Upload တင်စဉ် ကွန်ရက်ချို့ယွင်းမှု ဖြစ်ပေါ်ပါသည်။'));
    };

    xhr.send(form);
  });
}

export async function getDriveFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<DriveFileSummary | null> {
  const cleanId = fileId.trim();
  if (!isValidDriveFileId(cleanId)) return null;
  const res = await fetch(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(cleanId)}?fields=id,name,size,mimeType,webViewLink,webContentLink,modifiedTime,trashed`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );
  if (!res.ok) {
    if (res.status === 404) return null;
    const errText = await res.text();
    throw parseDriveApiError(
      res.status,
      errText,
      'Google Drive ဖိုင်အချက်အလက် ရယူမှု မအောင်မြင်ပါ',
    );
  }
  const file = (await res.json()) as DriveFileSummary & {trashed?: boolean};
  if (file.trashed) return null;
  return file;
}

export async function listLibraryDrivePdfs(
  accessToken: string,
  folderId?: string,
): Promise<DriveFileSummary[]> {
  const folderClause = folderId ? ` and '${folderId}' in parents` : '';
  const q = encodeURIComponent(
    `mimeType='application/pdf' and trashed=false${folderClause}`,
  );
  const res = await fetch(
    `${DRIVE_API_BASE}/files?q=${q}&orderBy=modifiedTime desc&pageSize=100&fields=files(id,name,size,mimeType,webViewLink,webContentLink,modifiedTime)`,
    {
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );
  if (!res.ok) {
    const errText = await res.text();
    throw parseDriveApiError(
      res.status,
      errText,
      'Google Drive PDF စာရင်း ရယူမှု မအောင်မြင်ပါ',
    );
  }
  const json = (await res.json()) as {files?: DriveFileSummary[]};
  return json.files || [];
}

export async function deletePdfFromGoogleDrive(
  accessToken: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: {Authorization: `Bearer ${accessToken}`},
    },
  );
  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw parseDriveApiError(
      res.status,
      errText,
      'Google Drive ဖိုင် ဖျက်သိမ်းမှု မအောင်မြင်ပါ',
    );
  }
}
