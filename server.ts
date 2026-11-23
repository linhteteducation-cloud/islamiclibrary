import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import express from 'express';
import type {NextFunction, Request, Response} from 'express';

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_CATALOG_URL =
  'https://myanmarfreeislamicbooks.blogspot.com/p/book-list.html?m=0';
const MAX_HTML_BYTES = 6 * 1024 * 1024; // 6 MB
const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT_MS = 25_000;
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

const BOOTSTRAPPED_ADMIN_EMAILS = new Set([
  'linhteteducation@gmail.com',
  'linhtetitservice@gmail.com',
]);

interface FirebaseConfigFile {
  apiKey?: string;
  projectId?: string;
  firestoreDatabaseId?: string;
}

let cachedFirebaseConfig: FirebaseConfigFile | null = null;
function getFirebaseConfig(): FirebaseConfigFile {
  if (cachedFirebaseConfig) return cachedFirebaseConfig;
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(cfgPath, 'utf-8');
  cachedFirebaseConfig = JSON.parse(raw) as FirebaseConfigFile;
  return cachedFirebaseConfig;
}

interface VerifiedAdmin {
  uid: string;
  email: string;
}

async function verifyAdminRequest(req: Request): Promise<VerifiedAdmin> {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const idToken = match?.[1]?.trim();
  if (!idToken) {
    throw Object.assign(new Error('Unauthorized: Missing auth token.'), {
      statusCode: 401,
    });
  }

  const cfg = getFirebaseConfig();
  if (!cfg.apiKey) {
    throw Object.assign(new Error('Server Firebase configuration missing.'), {
      statusCode: 500,
    });
  }

  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({idToken}),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!lookupRes.ok) {
    throw Object.assign(
      new Error('Unauthorized: Invalid or expired session token.'),
      {statusCode: 401},
    );
  }

  const lookupJson = (await lookupRes.json()) as {
    users?: Array<{
      localId?: string;
      email?: string;
      emailVerified?: boolean;
    }>;
  };
  const account = lookupJson.users?.[0];
  const uid = account?.localId?.trim() || '';
  const email = account?.email?.trim().toLowerCase() || '';

  if (!uid || !email || !account?.emailVerified) {
    throw Object.assign(
      new Error('Forbidden: Verified email account required.'),
      {statusCode: 403},
    );
  }

  if (BOOTSTRAPPED_ADMIN_EMAILS.has(email)) {
    return {uid, email};
  }

  // Fallback: check admins/{uid} document using the caller's Firebase ID token
  if (cfg.projectId && cfg.firestoreDatabaseId) {
    const adminDocUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId,
    )}/databases/${encodeURIComponent(
      cfg.firestoreDatabaseId,
    )}/documents/admins/${encodeURIComponent(uid)}`;
    const docRes = await fetch(adminDocUrl, {
      headers: {Authorization: `Bearer ${idToken}`},
      signal: AbortSignal.timeout(8_000),
    });
    if (docRes.ok) {
      return {uid, email};
    }
  }

  throw Object.assign(new Error('Forbidden: Admin access required.'), {
    statusCode: 403,
  });
}

// ---------- SSRF Validation & Safe Fetch ----------

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast & reserved
  return false;
}

function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase();
  const ver = net.isIP(ip);
  if (ver === 4) {
    return isPrivateOrReservedIpv4(ip);
  }
  if (ver === 6) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // fc00::/7 ULA
    if (
      ip.startsWith('fe8') ||
      ip.startsWith('fe9') ||
      ip.startsWith('fea') ||
      ip.startsWith('feb')
    ) {
      return true; // fe80::/10 link-local
    }
    if (ip.startsWith('ff')) return true; // multicast
    if (ip.startsWith('::ffff:')) {
      const v4 = ip.slice(7);
      if (net.isIP(v4) === 4) return isPrivateOrReservedIpv4(v4);
      return true;
    }
    return false;
  }
  return true;
}

function isAllowedBloggerHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    /^[a-z0-9-]+\.blogspot\.(com|sg|co\.uk|in|jp)$/i.test(host) ||
    host === 'www.blogger.com'
  );
}

function isAllowedMediaFireHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return /^(?:www\.|download\d+\.)?mediafire\.com$/i.test(host);
}

function isAllowedPdfFetchHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    isAllowedBloggerHost(host) ||
    isAllowedMediaFireHost(host) ||
    host === 'archive.org' ||
    /^[a-z0-9-]+\.archive\.org$/i.test(host) ||
    /^[a-z0-9-]+\.us\.archive\.org$/i.test(host)
  );
}

async function assertSafeExternalUrl(
  rawUrl: string,
  hostCheck: (hostname: string) => boolean,
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw Object.assign(new Error('Invalid external URL.'), {statusCode: 400});
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw Object.assign(new Error('Unsupported URL protocol.'), {
      statusCode: 400,
    });
  }
  if (parsed.username || parsed.password) {
    throw Object.assign(new Error('URL credentials are not allowed.'), {
      statusCode: 400,
    });
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw Object.assign(new Error('Custom ports are not allowed.'), {
      statusCode: 400,
    });
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || !hostCheck(host)) {
    throw Object.assign(
      new Error(`Host "${host}" is not allowed for import.`),
      {statusCode: 400},
    );
  }

  if (net.isIP(host)) {
    throw Object.assign(new Error('Direct IP URLs are not allowed.'), {
      statusCode: 400,
    });
  }

  const resolved = await dns.lookup(host, {all: true});
  if (!resolved.length) {
    throw Object.assign(new Error(`Unable to resolve host "${host}".`), {
      statusCode: 400,
    });
  }
  for (const entry of resolved) {
    if (isPrivateOrReservedIp(entry.address)) {
      throw Object.assign(
        new Error('Blocked private or reserved network destination.'),
        {statusCode: 403},
      );
    }
  }

  return parsed;
}

async function safeFetchExternal(
  rawUrl: string,
  hostCheck: (hostname: string) => boolean,
  options?: {maxBytes?: number; timeoutMs?: number},
): Promise<{finalUrl: string; headers: Headers; buffer: Buffer}> {
  let currentUrl = rawUrl;
  const maxBytes = options?.maxBytes ?? MAX_HTML_BYTES;
  const timeoutMs = options?.timeoutMs ?? FETCH_TIMEOUT_MS;

  for (let hop = 0; hop < 6; hop += 1) {
    const validated = await assertSafeExternalUrl(currentUrl, hostCheck);
    const res = await fetch(validated.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) {
        throw new Error('External server returned redirect without location.');
      }
      currentUrl = new URL(loc, validated).toString();
      continue;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} while fetching external resource.`);
    }

    const contentLengthHeader = res.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (!Number.isNaN(contentLength) && contentLength > maxBytes) {
        throw new Error('File exceeds maximum allowed size (50 MB).');
      }
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return {
        finalUrl: validated.toString(),
        headers: res.headers,
        buffer: Buffer.alloc(0),
      };
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new Error('File exceeds maximum allowed size (50 MB).');
        }
        chunks.push(value);
      }
    }

    return {
      finalUrl: validated.toString(),
      headers: res.headers,
      buffer: Buffer.concat(chunks, totalBytes),
    };
  }

  throw new Error('Too many redirects from external server.');
}

// ---------- HTML & Link Extraction Helpers ----------

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function normalizeBlogspotUrl(url: string): string {
  return url
    .trim()
    .replace(/^http:\/\//i, 'https://')
    .replace(/\.blogspot\.sg\//i, '.blogspot.com/');
}

function sanitizePdfFilename(rawTitle: string, fallback = 'book'): string {
  const cleaned = rawTitle
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  const base = cleaned || fallback;
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

function extractBlogspotCatalogItems(
  html: string,
  sourceUrl: string,
): Array<{index: number; title: string; postUrl: string}> {
  const seen = new Set<string>();
  const items: Array<{index: number; title: string; postUrl: string}> = [];

  const anchorRegex =
    /<a\b[^>]*href=["'](https?:\/\/[^"']*\.blogspot\.[^"']+\/\d{4}\/\d{2}\/[^"']+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const rawHref = match[1];
    const rawInner = match[2];
    const postUrl = normalizeBlogspotUrl(rawHref);
    const title = decodeHtmlEntities(rawInner.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();

    if (!title || title.length < 2 || seen.has(postUrl)) continue;
    seen.add(postUrl);
    items.push({
      index: items.length + 1,
      title,
      postUrl,
    });
  }

  // Fallback: if the user pasted a single post URL rather than an index page
  if (items.length === 0 && /\/\d{4}\/\d{2}\/[^/]+\.html/i.test(sourceUrl)) {
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const cleanedTitle = decodeHtmlEntities(
      (titleMatch?.[1] || '').replace(/^[^:]+:\s*/, ''),
    ).trim();
    items.push({
      index: 1,
      title: cleanedTitle || 'Blogspot Book',
      postUrl: normalizeBlogspotUrl(sourceUrl),
    });
  }

  return items;
}

function extractPostResources(html: string): {
  postTitle: string;
  driveFileIds: string[];
  mediafireUrls: string[];
  directPdfUrls: string[];
} {
  const h3Match = html.match(
    /<h3[^>]*class=["'][^"']*post-title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i,
  );
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const rawTitle = h3Match?.[1] || titleMatch?.[1] || '';
  const postTitle = decodeHtmlEntities(
    rawTitle
      .replace(/<[^>]+>/g, ' ')
      .replace(/^Myanmar Free Islamic Books:\s*/i, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();

  const driveFileIds = Array.from(
    new Set(
      [
        ...html.matchAll(
          /(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]{10,})/gi,
        ),
      ].map((m) => m[1]),
    ),
  );

  const rawHrefMatches = [
    ...html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi),
  ].map((m) => decodeHtmlEntities(m[1]));

  const mediafireUrls = Array.from(
    new Set(
      rawHrefMatches
        .filter((u) => /^https?:\/\/(?:www\.)?mediafire\.com\//i.test(u))
        .map((u) =>
          u
            .replace(/^http:\/\//i, 'https://')
            .replace(/mediafire\.com\/view\//i, 'mediafire.com/file/'),
        ),
    ),
  );

  const directPdfUrls = Array.from(
    new Set(
      rawHrefMatches.filter(
        (u) =>
          /\.pdf(?:\?[^#\s]*)?$/i.test(u) &&
          !/mediafire\.com/i.test(u) &&
          !/dstats\.net/i.test(u),
      ),
    ),
  );

  return {postTitle, driveFileIds, mediafireUrls, directPdfUrls};
}

function formatBytes(bytesInput: number | string | undefined): string {
  const bytes = typeof bytesInput === 'string' ? Number(bytesInput) : bytesInput;
  if (!bytes || Number.isNaN(bytes)) return 'PDF';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ---------- Google Drive Server Helpers ----------

async function makeDriveFilePublic(
  driveToken: string,
  fileId: string,
): Promise<void> {
  const res = await fetch(
    `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}/permissions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driveToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({role: 'reader', type: 'anyone'}),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (res.status === 401) {
    throw Object.assign(new Error('Google Drive token expired.'), {
      statusCode: 401,
    });
  }
}

async function tryCopyDrivePdf(
  driveToken: string,
  sourceFileId: string,
  fileName: string,
  folderId?: string,
): Promise<{id: string; name: string; size: string} | null> {
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(sourceFileId)) return null;

  const attemptCopy = async (parentId?: string) =>
    fetch(
      `${DRIVE_API_BASE}/files/${encodeURIComponent(
        sourceFileId,
      )}/copy?fields=id,name,size,mimeType`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${driveToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fileName,
          parents: parentId ? [parentId] : undefined,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );

  let copyRes = await attemptCopy(folderId);
  if (!copyRes.ok && folderId && (copyRes.status === 403 || copyRes.status === 404)) {
    const errBody = await copyRes.text().catch(() => '');
    if (/parent/i.test(errBody)) {
      copyRes = await attemptCopy(undefined);
    } else {
      return null;
    }
  }

  if (copyRes.status === 401) {
    throw Object.assign(
      new Error('Google Drive ချိတ်ဆက်ခွင့် သက်တမ်းကုန်ဆုံးသွားပါသည်။'),
      {statusCode: 401},
    );
  }

  if (!copyRes.ok) {
    return null;
  }

  const copied = (await copyRes.json()) as {
    id: string;
    name: string;
    size?: string;
    mimeType?: string;
  };

  if (copied.mimeType && copied.mimeType !== 'application/pdf') {
    // Delete non-PDF copy so Drive stays clean
    await fetch(`${DRIVE_API_BASE}/files/${encodeURIComponent(copied.id)}`, {
      method: 'DELETE',
      headers: {Authorization: `Bearer ${driveToken}`},
      signal: AbortSignal.timeout(8_000),
    }).catch(() => {});
    return null;
  }

  await makeDriveFilePublic(driveToken, copied.id);
  return {
    id: copied.id,
    name: copied.name || fileName,
    size: formatBytes(copied.size),
  };
}

async function uploadPdfBufferToDrive(
  driveToken: string,
  pdfBuffer: Buffer,
  fileName: string,
  folderId?: string,
): Promise<{id: string; name: string; size: string}> {
  const attemptUpload = async (parentId?: string) => {
    const boundary = `-------MMLBoundary${Date.now()}${Math.random()
      .toString(36)
      .slice(2)}`;
    const metadataJson = JSON.stringify({
      name: fileName,
      mimeType: 'application/pdf',
      parents: parentId ? [parentId] : undefined,
    });

    const head = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataJson}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
      'utf-8',
    );
    const tail = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
    const body = Buffer.concat([head, pdfBuffer, tail]);

    return fetch(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,size`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${driveToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(body.byteLength),
        },
        body,
        signal: AbortSignal.timeout(45_000),
      },
    );
  };

  let uploadRes = await attemptUpload(folderId);
  let errText = '';

  if (!uploadRes.ok && folderId && (uploadRes.status === 403 || uploadRes.status === 404)) {
    errText = await uploadRes.text().catch(() => '');
    if (/parent/i.test(errText)) {
      uploadRes = await attemptUpload(undefined);
      errText = '';
    }
  }

  if (uploadRes.status === 401) {
    throw Object.assign(
      new Error('Google Drive ချိတ်ဆက်ခွင့် သက်တမ်းကုန်ဆုံးသွားပါသည်။'),
      {statusCode: 401},
    );
  }

  if (!uploadRes.ok) {
    if (!errText) {
      errText = await uploadRes.text().catch(() => '');
    }
    throw new Error(
      `Google Drive upload failed (${uploadRes.status}): ${errText.slice(0, 180)}`,
    );
  }

  const uploaded = (await uploadRes.json()) as {
    id: string;
    name: string;
    size?: string;
  };

  await makeDriveFilePublic(driveToken, uploaded.id);
  return {
    id: uploaded.id,
    name: uploaded.name || fileName,
    size: formatBytes(uploaded.size ?? pdfBuffer.byteLength),
  };
}

function isPdfBuffer(buf: Buffer): boolean {
  if (buf.byteLength < 8) return false;
  return buf.subarray(0, 5).toString('ascii') === '%PDF-';
}

async function resolveMediaFirePdfBuffer(
  mediafirePageUrl: string,
): Promise<{buffer: Buffer; suggestedName?: string} | null> {
  const pageFetch = await safeFetchExternal(
    mediafirePageUrl,
    isAllowedMediaFireHost,
    {maxBytes: MAX_HTML_BYTES},
  );
  const html = pageFetch.buffer.toString('utf-8');
  const directMatch = html.match(
    /https:\/\/download\d+\.mediafire\.com\/[^\s"'<>]+/i,
  );
  if (!directMatch?.[0]) return null;

  const directUrl = decodeHtmlEntities(directMatch[0]);
  const fileFetch = await safeFetchExternal(directUrl, isAllowedMediaFireHost, {
    maxBytes: MAX_PDF_BYTES,
    timeoutMs: 40_000,
  });

  if (!isPdfBuffer(fileFetch.buffer)) {
    return null;
  }

  let suggestedName: string | undefined;
  try {
    const urlObj = new URL(directUrl);
    const lastSeg = decodeURIComponent(
      urlObj.pathname.split('/').filter(Boolean).pop() || '',
    );
    if (lastSeg.toLowerCase().endsWith('.pdf')) {
      suggestedName = lastSeg;
    }
  } catch {
    // ignore filename extraction errors
  }

  return {buffer: fileFetch.buffer, suggestedName};
}

// ---------- Express App & Vite / Static Mounting ----------

async function startServer() {
  const app = express();
  app.use(express.json({limit: '256kb'}));

  app.post(
    '/api/import/catalog',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await verifyAdminRequest(req);
        const rawUrl =
          typeof req.body?.sourceUrl === 'string' && req.body.sourceUrl.trim()
            ? req.body.sourceUrl.trim()
            : DEFAULT_CATALOG_URL;

        const fetched = await safeFetchExternal(rawUrl, isAllowedBloggerHost, {
          maxBytes: MAX_HTML_BYTES,
        });
        const html = fetched.buffer.toString('utf-8');
        const items = extractBlogspotCatalogItems(html, fetched.finalUrl);

        res.json({
          sourceUrl: fetched.finalUrl,
          count: items.length,
          items,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/import/transfer-book',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await verifyAdminRequest(req);
        const driveToken = String(req.headers['x-drive-token'] || '').trim();
        if (!driveToken) {
          throw Object.assign(
            new Error('Google Drive access token missing.'),
            {statusCode: 401},
          );
        }

        const postUrl =
          typeof req.body?.postUrl === 'string' ? req.body.postUrl.trim() : '';
        const fallbackTitle =
          typeof req.body?.bookTitle === 'string'
            ? req.body.bookTitle.trim()
            : '';
        const folderId =
          typeof req.body?.folderId === 'string' &&
          /^[a-zA-Z0-9_-]{5,200}$/.test(req.body.folderId.trim())
            ? req.body.folderId.trim()
            : undefined;

        if (!postUrl) {
          throw Object.assign(new Error('Missing postUrl parameter.'), {
            statusCode: 400,
          });
        }

        const postFetch = await safeFetchExternal(
          postUrl,
          isAllowedBloggerHost,
          {maxBytes: MAX_HTML_BYTES},
        );
        const postHtml = postFetch.buffer.toString('utf-8');
        const resources = extractPostResources(postHtml);
        const resolvedTitle =
          fallbackTitle || resources.postTitle || 'Islamic Book';
        const uploadFileName = sanitizePdfFilename(resolvedTitle);

        // 1. Try direct server-side Google Drive copy first
        for (const driveId of resources.driveFileIds) {
          const copied = await tryCopyDrivePdf(
            driveToken,
            driveId,
            uploadFileName,
            folderId,
          );
          if (copied) {
            res.json({
              driveFileId: copied.id,
              fileName: copied.name,
              fileSize: copied.size,
              title: resolvedTitle,
              sourceType: 'drive-copy',
            });
            return;
          }
        }

        // 2. Fallback to MediaFire direct PDF mirror -> upload straight into user's Drive
        for (const mfUrl of resources.mediafireUrls) {
          const mfPdf = await resolveMediaFirePdfBuffer(mfUrl).catch(
            () => null,
          );
          if (mfPdf) {
            const uploaded = await uploadPdfBufferToDrive(
              driveToken,
              mfPdf.buffer,
              uploadFileName,
              folderId,
            );
            res.json({
              driveFileId: uploaded.id,
              fileName: uploaded.name,
              fileSize: uploaded.size,
              title: resolvedTitle,
              sourceType: 'mediafire-pdf',
            });
            return;
          }
        }

        // 3. Fallback to any direct .pdf link on allowlisted hosts
        for (const pdfUrl of resources.directPdfUrls) {
          const pdfFetch = await safeFetchExternal(
            pdfUrl,
            isAllowedPdfFetchHost,
            {maxBytes: MAX_PDF_BYTES, timeoutMs: 40_000},
          ).catch(() => null);
          if (pdfFetch && isPdfBuffer(pdfFetch.buffer)) {
            const uploaded = await uploadPdfBufferToDrive(
              driveToken,
              pdfFetch.buffer,
              uploadFileName,
              folderId,
            );
            res.json({
              driveFileId: uploaded.id,
              fileName: uploaded.name,
              fileSize: uploaded.size,
              title: resolvedTitle,
              sourceType: 'direct-pdf',
            });
            return;
          }
        }

        res.status(422).json({
          error:
            'ဤစာမျက်နှာတွင် ဒေါင်းလုဒ်ရယူနိုင်သော PDF ဖိုင် မတွေ့ရှိပါ (သို့) ဖိုင်လင့်ခ် ပျက်နေပါသည်။',
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // Error handler for /api routes
  app.use(
    '/api',
    (
      err: unknown,
      _req: Request,
      res: Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: NextFunction,
    ) => {
      const status =
        typeof err === 'object' &&
        err !== null &&
        'statusCode' in err &&
        typeof (err as {statusCode: unknown}).statusCode === 'number'
          ? (err as {statusCode: number}).statusCode
          : 500;
      const message =
        err instanceof Error ? err.message : 'Server processing error.';
      res.status(status).json({error: message});
    },
  );

  const distDir = path.resolve(process.cwd(), 'dist');
  const useStaticProd =
    process.env.NODE_ENV === 'production' ||
    (process.env.npm_lifecycle_event === 'start' &&
      fs.existsSync(path.join(distDir, 'index.html')));

  if (!useStaticProd) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
