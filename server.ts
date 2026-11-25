import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {Readable} from 'node:stream';
import type {ReadableStream as NodeWebReadableStream} from 'node:stream/web';
import express from 'express';
import type {NextFunction, Request, Response} from 'express';

function resolveListenPort(isProductionMode: boolean): number {
  const eqArg = process.argv.find((arg) => arg.startsWith('--port='));
  if (eqArg) {
    const parsed = Number(eqArg.slice('--port='.length));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const idx = process.argv.indexOf('--port');
  if (idx !== -1 && process.argv[idx + 1]) {
    const parsed = Number(process.argv[idx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const envPort = Number(process.env.PORT);
  if (Number.isFinite(envPort) && envPort > 0) {
    // Container images often export PORT=8080 for nginx reverse proxy while dev server must listen on 3000
    if (!isProductionMode && envPort === 8080) {
      return 3000;
    }
    return envPort;
  }
  return 3000;
}

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

  // Fallback: check admins/{uid} or adminInvites/{email} using the caller's Firebase ID token
  if (cfg.projectId && cfg.firestoreDatabaseId) {
    const baseFirestore = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId,
    )}/databases/${encodeURIComponent(cfg.firestoreDatabaseId)}/documents`;

    const [uidRes, inviteRes] = await Promise.all([
      fetch(`${baseFirestore}/admins/${encodeURIComponent(uid)}`, {
        headers: {Authorization: `Bearer ${idToken}`},
        signal: AbortSignal.timeout(8_000),
      }).catch(() => null),
      fetch(`${baseFirestore}/adminInvites/${encodeURIComponent(email)}`, {
        headers: {Authorization: `Bearer ${idToken}`},
        signal: AbortSignal.timeout(8_000),
      }).catch(() => null),
    ]);

    if (uidRes?.ok || inviteRes?.ok) {
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

const ALLOWED_BLOGGER_CUSTOM_HOSTS = new Set(['library.ioumyanmar.com']);

function isAllowedBloggerHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    /^[a-z0-9-]+\.blogspot\.(com|sg|co\.uk|in|jp)$/i.test(host) ||
    host === 'www.blogger.com' ||
    ALLOWED_BLOGGER_CUSTOM_HOSTS.has(host)
  );
}

function isAllowedShortenerHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'bit.ly' ||
    host === 'j.mp' ||
    host === 'tinyurl.com' ||
    host === 'goo.gl' ||
    host === 'is.gd'
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

function isAllowedDriveDownloadHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'drive.google.com' ||
    host === 'drive.usercontent.google.com' ||
    host === 'docs.google.com' ||
    /^[a-z0-9-]+\.googleusercontent\.com$/i.test(host)
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
  const trimmed = url.trim().replace(/\.blogspot\.sg\//i, '.blogspot.com/');
  // Only upgrade *.blogspot.* and www.blogger.com to HTTPS; custom Blogger domains like library.ioumyanmar.com may only serve HTTP
  if (/^http:\/\/(?:[a-z0-9-]+\.blogspot\.|www\.blogger\.com)/i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }
  return trimmed;
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

function isGenericBlogNavText(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    !lower ||
    lower.length < 2 ||
    lower === 'read more' ||
    lower === 'read more »' ||
    lower === 'ဆက်ဖတ်ရန်' ||
    lower === 'comments' ||
    /^\d+\s+comments?$/i.test(lower) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(lower)
  );
}

function extractBlogspotCatalogItems(
  html: string,
  sourceUrl: string,
): Array<{index: number; title: string; postUrl: string}> {
  const seen = new Set<string>();
  const items: Array<{index: number; title: string; postUrl: string}> = [];
  let sourceHost = '';
  try {
    sourceHost = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    sourceHost = '';
  }

  const pushCandidate = (rawHref: string, rawTitleHtml: string) => {
    const cleanHref = rawHref.split('#')[0].replace(/\?showComment=\d+$/i, '');
    let parsedHref: URL;
    try {
      parsedHref = new URL(cleanHref, sourceUrl);
    } catch {
      return;
    }
    const hrefHost = parsedHref.hostname.toLowerCase();
    const isSameOrBlogger =
      (sourceHost && hrefHost === sourceHost) ||
      /\.blogspot\./i.test(hrefHost);
    if (!isSameOrBlogger) return;
    if (!/\/\d{4}\/\d{2}\/[^/?#]+\.html$/i.test(parsedHref.pathname)) return;

    const postUrl = normalizeBlogspotUrl(parsedHref.toString());
    const title = decodeHtmlEntities(rawTitleHtml.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();

    if (isGenericBlogNavText(title) || seen.has(postUrl)) return;
    seen.add(postUrl);
    items.push({
      index: items.length + 1,
      title,
      postUrl,
    });
  };

  // Pass 1: Prefer explicit Blogger post-title headings first so real titles win over "Read more"
  const headingAnchorRegex =
    /<h[1-4]\b[^>]*class=["'][^"']*post-title[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[1-4]>/gi;
  for (const match of html.matchAll(headingAnchorRegex)) {
    pushCandidate(match[1], match[2]);
  }

  // Pass 2: General post links anywhere in the body (used by /p/book-list.html tables/lists)
  const anchorRegex =
    /<a\b[^>]*href=["'](https?:\/\/[^"']+\/\d{4}\/\d{2}\/[^"'?#]+\.html(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRegex)) {
    pushCandidate(match[1], match[2]);
  }

  // Fallback: if the user pasted a single post URL rather than an index page
  if (items.length === 0 && /\/\d{4}\/\d{2}\/[^/?#]+\.html/i.test(sourceUrl)) {
    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const cleanedTitle = decodeHtmlEntities(
      (titleMatch?.[1] || '').replace(/^[^:]+:\s*/, ''),
    ).trim();
    items.push({
      index: 1,
      title: cleanedTitle || 'Islamic Library Book',
      postUrl: normalizeBlogspotUrl(sourceUrl),
    });
  }

  return items;
}

interface BloggerFeedJson {
  feed?: {
    openSearch$totalResults?: {$t?: string};
    entry?: Array<{
      title?: {$t?: string};
      link?: Array<{rel?: string; href?: string}>;
    }>;
  };
}

async function tryFetchBloggerFeedCatalogItems(
  sourceUrl: string,
): Promise<Array<{index: number; title: string; postUrl: string}>> {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return [];
  }

  const labelMatch = parsed.pathname.match(/^\/search\/label\/([^/]+)\/?$/i);
  const feedBase = labelMatch
    ? `${parsed.origin}/feeds/posts/default/-/${labelMatch[1]}?alt=json`
    : `${parsed.origin}/feeds/posts/default?alt=json`;

  const seen = new Set<string>();
  const items: Array<{index: number; title: string; postUrl: string}> = [];

  for (let page = 0; page < 3; page += 1) {
    const startIndex = page * 150 + 1;
    const feedUrl = `${feedBase}&max-results=150&start-index=${startIndex}`;
    const res = await safeFetchExternal(feedUrl, isAllowedBloggerHost, {
      maxBytes: MAX_HTML_BYTES,
    }).catch(() => null);
    if (!res) break;

    let data: BloggerFeedJson;
    try {
      data = JSON.parse(res.buffer.toString('utf-8')) as BloggerFeedJson;
    } catch {
      break;
    }

    const entries = data.feed?.entry || [];
    if (entries.length === 0) break;

    for (const entry of entries) {
      const altHref = entry.link?.find((l) => l.rel === 'alternate')?.href;
      const rawTitle = entry.title?.$t || '';
      const title = decodeHtmlEntities(rawTitle).replace(/\s+/g, ' ').trim();
      if (!altHref || !title || title.length < 2) continue;

      const postUrl = normalizeBlogspotUrl(altHref);
      if (seen.has(postUrl)) continue;
      seen.add(postUrl);
      items.push({
        index: items.length + 1,
        title,
        postUrl,
      });
    }

    const totalResults = Number(data.feed?.openSearch$totalResults?.$t || 0);
    if (entries.length < 150 || (totalResults > 0 && items.length >= totalResults)) {
      break;
    }
  }

  return items;
}

const DRIVE_FILE_ID_REGEX =
  /(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]{10,})/i;

async function resolveShortLinkUrl(shortUrl: string): Promise<string | null> {
  let currentUrl = shortUrl.trim();
  for (let hop = 0; hop < 4; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return null;
    }

    if (!isAllowedShortenerHost(parsed.hostname)) {
      return parsed.toString();
    }

    const validated = await assertSafeExternalUrl(
      parsed.toString(),
      isAllowedShortenerHost,
    ).catch(() => null);
    if (!validated) return null;

    const res = await fetch(validated.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    if (!res) return null;
    await res.body?.cancel().catch(() => {});

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return null;
      try {
        currentUrl = new URL(loc, validated).toString();
      } catch {
        return null;
      }
      continue;
    }
    return null;
  }
  return null;
}

function extractPostResources(html: string): {
  postTitle: string;
  driveFileIds: string[];
  mediafireUrls: string[];
  directPdfUrls: string[];
  shortUrls: string[];
} {
  const h3Match = html.match(
    /<h[1-3][^>]*class=["'][^"']*post-title[^"']*["'][^>]*>([\s\S]*?)<\/h[1-3]>/i,
  );
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const rawTitle = h3Match?.[1] || titleMatch?.[1] || '';
  const postTitle = decodeHtmlEntities(
    rawTitle
      .replace(/<[^>]+>/g, ' ')
      .replace(/^Myanmar Free Islamic Books:\s*/i, '')
      .replace(/^IOU Myanmar Library:\s*/i, ''),
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
        .filter((u) => /^https?:\/\/(?:www\.|download\d+\.)?mediafire\.com\//i.test(u))
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

  const shortUrls = Array.from(
    new Set(
      rawHrefMatches.filter((u) => {
        try {
          const parsed = new URL(u);
          return (
            isAllowedShortenerHost(parsed.hostname) &&
            parsed.pathname.replace(/\//g, '').length >= 3
          );
        } catch {
          return false;
        }
      }),
    ),
  );

  return {postTitle, driveFileIds, mediafireUrls, directPdfUrls, shortUrls};
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

// ---------- Telegram Bot Permanent Server Store & Helpers ----------

const TELEGRAM_DATA_DIR = path.resolve(process.cwd(), '.data');
const TELEGRAM_CONFIG_PATH = path.join(TELEGRAM_DATA_DIR, 'telegram-bot.json');

interface StoredTelegramConfig {
  botToken: string;
  botUsername: string;
  botFirstName: string;
  allowedChatIds: string;
  autoSyncToWebsite: boolean;
  defaultCategoryId: string;
  lastUpdateId: number;
}

const DEFAULT_STORED_TELEGRAM: StoredTelegramConfig = {
  botToken: '',
  botUsername: '',
  botFirstName: '',
  allowedChatIds: '',
  autoSyncToWebsite: true,
  defaultCategoryId: 'auto',
  lastUpdateId: 0,
};

function readStoredTelegramConfig(): StoredTelegramConfig {
  try {
    if (!fs.existsSync(TELEGRAM_CONFIG_PATH)) {
      return {...DEFAULT_STORED_TELEGRAM};
    }
    const raw = fs.readFileSync(TELEGRAM_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoredTelegramConfig>;
    return {
      botToken: typeof parsed.botToken === 'string' ? parsed.botToken.trim() : '',
      botUsername:
        typeof parsed.botUsername === 'string' ? parsed.botUsername.trim() : '',
      botFirstName:
        typeof parsed.botFirstName === 'string'
          ? parsed.botFirstName.trim()
          : '',
      allowedChatIds:
        typeof parsed.allowedChatIds === 'string'
          ? parsed.allowedChatIds.trim()
          : '',
      autoSyncToWebsite: parsed.autoSyncToWebsite !== false,
      defaultCategoryId:
        typeof parsed.defaultCategoryId === 'string' && parsed.defaultCategoryId
          ? parsed.defaultCategoryId
          : 'auto',
      lastUpdateId: Math.max(0, Math.floor(Number(parsed.lastUpdateId) || 0)),
    };
  } catch {
    return {...DEFAULT_STORED_TELEGRAM};
  }
}

function writeStoredTelegramConfig(cfg: StoredTelegramConfig): void {
  fs.mkdirSync(TELEGRAM_DATA_DIR, {recursive: true, mode: 0o700});
  fs.writeFileSync(TELEGRAM_CONFIG_PATH, JSON.stringify(cfg, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

function resolveBotToken(cfg: StoredTelegramConfig): {
  token: string;
  source: 'saved' | 'env' | 'none';
} {
  if (cfg.botToken) return {token: cfg.botToken, source: 'saved'};
  const envToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (envToken) return {token: envToken, source: 'env'};
  return {token: '', source: 'none'};
}

function maskToken(token: string): string {
  if (!token) return '';
  if (token.length <= 12) return '***';
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

interface TelegramUpdateMessage {
  message_id?: number;
  chat?: {id?: number | string; title?: string; username?: string; first_name?: string; type?: string};
  from?: {id?: number | string; username?: string; first_name?: string};
  caption?: string;
  document?: {
    file_id?: string;
    file_unique_id?: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramUpdateMessage;
  channel_post?: TelegramUpdateMessage;
}

async function callTelegramApi<T>(
  botToken: string,
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params || {}),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    error_code?: number;
    result?: T;
  };
  if (!res.ok || !json.ok) {
    const err = new Error(
      json.description || `Telegram API error (${res.status})`,
    ) as Error & {statusCode?: number; telegramCode?: number};
    err.statusCode = res.status === 401 || res.status === 404 ? 400 : res.status;
    err.telegramCode = json.error_code;
    throw err;
  }
  return json.result as T;
}

async function fetchTelegramUpdatesSafe(
  botToken: string,
  offset?: number,
): Promise<TelegramUpdate[]> {
  try {
    return await callTelegramApi<TelegramUpdate[]>(botToken, 'getUpdates', {
      offset,
      limit: 25,
      timeout: 1,
      allowed_updates: ['message', 'channel_post'],
    });
  } catch (err) {
    const code =
      typeof err === 'object' &&
      err !== null &&
      'telegramCode' in err &&
      (err as {telegramCode?: number}).telegramCode;
    // If another webhook was previously active on this token, clear it cleanly (preserving updates)
    if (code === 409) {
      await callTelegramApi(botToken, 'deleteWebhook', {
        drop_pending_updates: false,
      });
      return callTelegramApi<TelegramUpdate[]>(botToken, 'getUpdates', {
        offset,
        limit: 25,
        timeout: 1,
        allowed_updates: ['message', 'channel_post'],
      });
    }
    throw err;
  }
}

let telegramSyncInFlight = false;

// ---------- SEO & Google Search Console Helpers ----------

const SEO_CONFIG_PATH = path.join(TELEGRAM_DATA_DIR, 'seo-config.json');
const DEFAULT_PUBLIC_SITE_URL = 'https://islamiclibrary-three.vercel.app';
const SITEMAP_CATEGORY_IDS = [
  'quran-tafsir',
  'hadith',
  'shariah',
  'dua-amal',
  'aqeedah',
  'history',
  'ethics',
  'children',
  'periodicals',
  'research',
  'azan',
];

interface StoredSeoConfig {
  canonicalOrigin: string;
  googleSiteVerificationToken: string;
  googleVerificationHtmlFilename: string;
}

const DEFAULT_SEO_CONFIG: StoredSeoConfig = {
  canonicalOrigin: DEFAULT_PUBLIC_SITE_URL,
  googleSiteVerificationToken: '',
  googleVerificationHtmlFilename: '',
};

function sanitizeGoogleMetaToken(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const metaMatch = trimmed.match(/content=["']([a-zA-Z0-9_-]{12,128})["']/i);
  const candidate = (metaMatch?.[1] || trimmed).trim();
  if (!/^[a-zA-Z0-9_-]{12,128}$/.test(candidate)) {
    throw Object.assign(
      new Error(
        'Google Verification Meta Token ဖော်မတ် မမှန်ကန်ပါ (content="..." တန်ဖိုး သို့မဟုတ် Token စာသားသီးသန့် ထည့်ပါ)။',
      ),
      {statusCode: 400},
    );
  }
  return candidate;
}

function sanitizeGoogleHtmlFilename(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const base = trimmed.split('/').filter(Boolean).pop() || trimmed;
  if (!/^google[a-f0-9]{10,40}\.html$/i.test(base)) {
    throw Object.assign(
      new Error(
        'Google HTML Verification ဖိုင်နာမည် မမှန်ကန်ပါ (ဥပမာ - google1234abcd5678ef.html)။',
      ),
      {statusCode: 400},
    );
  }
  return base;
}

function sanitizeCanonicalOrigin(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_PUBLIC_SITE_URL;
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return DEFAULT_PUBLIC_SITE_URL;
    }
    return parsed.origin;
  } catch {
    return DEFAULT_PUBLIC_SITE_URL;
  }
}

function readStoredSeoConfig(): StoredSeoConfig {
  try {
    if (!fs.existsSync(SEO_CONFIG_PATH)) {
      return {...DEFAULT_SEO_CONFIG};
    }
    const raw = fs.readFileSync(SEO_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoredSeoConfig>;
    return {
      canonicalOrigin:
        typeof parsed.canonicalOrigin === 'string' && parsed.canonicalOrigin.trim()
          ? parsed.canonicalOrigin.trim()
          : DEFAULT_PUBLIC_SITE_URL,
      googleSiteVerificationToken:
        typeof parsed.googleSiteVerificationToken === 'string' &&
        /^[a-zA-Z0-9_-]{12,128}$/.test(parsed.googleSiteVerificationToken.trim())
          ? parsed.googleSiteVerificationToken.trim()
          : '',
      googleVerificationHtmlFilename:
        typeof parsed.googleVerificationHtmlFilename === 'string' &&
        /^google[a-f0-9]{10,40}\.html$/i.test(
          parsed.googleVerificationHtmlFilename.trim(),
        )
          ? parsed.googleVerificationHtmlFilename.trim()
          : '',
    };
  } catch {
    return {...DEFAULT_SEO_CONFIG};
  }
}

function writeStoredSeoConfig(cfg: StoredSeoConfig): void {
  fs.mkdirSync(TELEGRAM_DATA_DIR, {recursive: true, mode: 0o700});
  fs.writeFileSync(SEO_CONFIG_PATH, JSON.stringify(cfg, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

function resolvePublicOrigin(req: Request, cfg: StoredSeoConfig): string {
  const fwdHost = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const hostHeader = fwdHost || String(req.headers.host || '').trim();
  const hostnameOnly = hostHeader.split(':')[0]?.toLowerCase() || '';
  if (
    hostnameOnly &&
    hostnameOnly !== 'localhost' &&
    hostnameOnly !== '127.0.0.1' &&
    hostnameOnly !== '0.0.0.0'
  ) {
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https')
      .split(',')[0]
      .trim();
    return `${proto === 'http' ? 'http' : 'https'}://${hostHeader}`;
  }
  return cfg.canonicalOrigin || DEFAULT_PUBLIC_SITE_URL;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function fetchPublishedBookSitemapEntries(): Promise<
  Array<{id: string; lastmod?: string}>
> {
  try {
    const cfg = getFirebaseConfig();
    if (!cfg.projectId || !cfg.firestoreDatabaseId) return [];
    const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      cfg.projectId,
    )}/databases/${encodeURIComponent(
      cfg.firestoreDatabaseId,
    )}/documents:runQuery`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        structuredQuery: {
          from: [{collectionId: 'books'}],
          where: {
            fieldFilter: {
              field: {fieldPath: 'published'},
              op: 'EQUAL',
              value: {booleanValue: true},
            },
          },
          select: {
            fields: [{fieldPath: 'updatedAt'}],
          },
          limit: 300,
        },
      }),
      signal: AbortSignal.timeout(4_500),
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      document?: {
        name?: string;
        updateTime?: string;
        fields?: {
          updatedAt?: {timestampValue?: string};
        };
      };
    }>;

    const entries: Array<{id: string; lastmod?: string}> = [];
    for (const row of rows) {
      const fullName = row.document?.name || '';
      const id = fullName.split('/').pop() || '';
      if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) continue;
      const rawDate =
        row.document?.fields?.updatedAt?.timestampValue ||
        row.document?.updateTime;
      const isoDate =
        rawDate && !Number.isNaN(Date.parse(rawDate))
          ? new Date(rawDate).toISOString().slice(0, 10)
          : undefined;
      entries.push({id, lastmod: isoDate});
    }
    return entries;
  } catch {
    return [];
  }
}

function injectGoogleVerificationMeta(html: string, token: string): string {
  if (!token || !/^[a-zA-Z0-9_-]{12,128}$/.test(token)) {
    return html;
  }
  const tag = `<meta name="google-site-verification" content="${token}" />`;
  if (html.includes('name="google-site-verification"')) {
    return html.replace(
      /<meta\s+name=["']google-site-verification["'][^>]*>/i,
      tag,
    );
  }
  return html.replace('</head>', `    ${tag}\n  </head>`);
}

// ---------- Express App & Vite / Static Mounting ----------

async function startServer() {
  const app = express();
  app.use(express.json({limit: '256kb'}));

  // Protect internal server files & secrets directory from direct HTTP access
  app.use((req: Request, res: Response, next: NextFunction) => {
    const cleanPath = req.path.toLowerCase();
    if (
      cleanPath.startsWith('/.data') ||
      cleanPath.startsWith('/.env') ||
      cleanPath === '/server.ts' ||
      cleanPath === '/firestore.rules' ||
      cleanPath === '/firebase-blueprint.json'
    ) {
      res.status(404).end();
      return;
    }
    next();
  });

  // Dynamic robots.txt, sitemap.xml & Google Search Console verification file routes
  app.get('/robots.txt', (req: Request, res: Response) => {
    const seo = readStoredSeoConfig();
    const origin = resolvePublicOrigin(req, seo);
    res.type('text/plain; charset=utf-8').send(
      `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`,
    );
  });

  app.get('/sitemap.xml', async (req: Request, res: Response) => {
    const seo = readStoredSeoConfig();
    const origin = resolvePublicOrigin(req, seo);
    const todayIso = new Date().toISOString().slice(0, 10);

    const staticUrls: Array<{
      loc: string;
      changefreq: string;
      priority: string;
      lastmod?: string;
    }> = [
      {loc: `${origin}/`, changefreq: 'daily', priority: '1.0', lastmod: todayIso},
      {loc: `${origin}/library`, changefreq: 'daily', priority: '0.9', lastmod: todayIso},
      ...SITEMAP_CATEGORY_IDS.map((catId) => ({
        loc: `${origin}/library?category=${encodeURIComponent(catId)}`,
        changefreq: 'weekly',
        priority: '0.8',
      })),
      {loc: `${origin}/duas`, changefreq: 'weekly', priority: '0.8'},
      {loc: `${origin}/videos`, changefreq: 'weekly', priority: '0.8'},
      {loc: `${origin}/articles`, changefreq: 'weekly', priority: '0.8'},
      {loc: `${origin}/publishing`, changefreq: 'monthly', priority: '0.6'},
      {loc: `${origin}/about`, changefreq: 'monthly', priority: '0.6'},
      {loc: `${origin}/contact`, changefreq: 'monthly', priority: '0.5'},
    ];

    const bookEntries = await fetchPublishedBookSitemapEntries();
    for (const book of bookEntries) {
      staticUrls.push({
        loc: `${origin}/library?book=${encodeURIComponent(book.id)}`,
        changefreq: 'monthly',
        priority: '0.7',
        lastmod: book.lastmod,
      });
    }

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      staticUrls
        .map(
          (item) =>
            `  <url>\n` +
            `    <loc>${escapeXml(item.loc)}</loc>\n` +
            (item.lastmod ? `    <lastmod>${escapeXml(item.lastmod)}</lastmod>\n` : '') +
            `    <changefreq>${item.changefreq}</changefreq>\n` +
            `    <priority>${item.priority}</priority>\n` +
            `  </url>`,
        )
        .join('\n') +
      `\n</urlset>\n`;

    res
      .header('Cache-Control', 'public, max-age=300')
      .type('application/xml; charset=utf-8')
      .send(xml);
  });

  app.get(/^\/(google[a-f0-9]{10,40}\.html)$/i, (req: Request, res: Response, next: NextFunction) => {
    const requestedFile = req.params[0] || '';
    const seo = readStoredSeoConfig();
    if (
      seo.googleVerificationHtmlFilename &&
      seo.googleVerificationHtmlFilename.toLowerCase() === requestedFile.toLowerCase()
    ) {
      res
        .type('text/html; charset=utf-8')
        .send(`google-site-verification: ${seo.googleVerificationHtmlFilename}`);
      return;
    }
    next();
  });

  app.get(
    '/api/seo/config',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await verifyAdminRequest(req);
        res.json(readStoredSeoConfig());
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/seo/config',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await verifyAdminRequest(req);
        const current = readStoredSeoConfig();
        const nextOrigin =
          typeof req.body?.canonicalOrigin === 'string'
            ? sanitizeCanonicalOrigin(req.body.canonicalOrigin)
            : current.canonicalOrigin;
        const nextMetaToken =
          typeof req.body?.googleSiteVerificationToken === 'string'
            ? sanitizeGoogleMetaToken(req.body.googleSiteVerificationToken)
            : current.googleSiteVerificationToken;
        const nextHtmlFilename =
          typeof req.body?.googleVerificationHtmlFilename === 'string'
            ? sanitizeGoogleHtmlFilename(req.body.googleVerificationHtmlFilename)
            : current.googleVerificationHtmlFilename;

        const updated: StoredSeoConfig = {
          canonicalOrigin: nextOrigin,
          googleSiteVerificationToken: nextMetaToken,
          googleVerificationHtmlFilename: nextHtmlFilename,
        };
        writeStoredSeoConfig(updated);
        res.json(updated);
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/telegram/config',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await verifyAdminRequest(req);
        const stored = readStoredTelegramConfig();
        const {token, source} = resolveBotToken(stored);

        let botUsername = stored.botUsername;
        let botFirstName = stored.botFirstName;
        if (token && !botUsername) {
          const me = await callTelegramApi<{
            username?: string;
            first_name?: string;
          }>(token, 'getMe').catch(() => null);
          if (me) {
            botUsername = me.username || '';
            botFirstName = me.first_name || '';
          }
        }

        res.json({
          tokenConfigured: Boolean(token),
          tokenSource: source,
          maskedToken: maskToken(token),
          botUsername,
          botFirstName,
          allowedChatIds: stored.allowedChatIds,
          autoSyncToWebsite: stored.autoSyncToWebsite,
          defaultCategoryId: stored.defaultCategoryId,
          lastUpdateId: stored.lastUpdateId,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/telegram/config',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await verifyAdminRequest(req);
        const stored = readStoredTelegramConfig();
        const submittedToken =
          typeof req.body?.botToken === 'string'
            ? req.body.botToken.trim()
            : '';
        const {token: existingToken} = resolveBotToken(stored);
        const effectiveToken = submittedToken || existingToken;

        if (!effectiveToken) {
          throw Object.assign(
            new Error(
              'Telegram Bot Token ကို ဖြည့်သွင်းပါ (ဥပမာ - @BotFather မှ ရရှိသော Token)။',
            ),
            {statusCode: 400},
          );
        }

        if (!/^\d{6,}:[a-zA-Z0-9_-]{20,}$/.test(effectiveToken)) {
          throw Object.assign(
            new Error('Telegram Bot Token ပုံစံ မမှန်ကန်ပါ။'),
            {statusCode: 400},
          );
        }

        const me = await callTelegramApi<{
          username?: string;
          first_name?: string;
        }>(effectiveToken, 'getMe');

        // Ensure long polling / getUpdates works seamlessly
        await callTelegramApi(effectiveToken, 'deleteWebhook', {
          drop_pending_updates: false,
        }).catch(() => {});

        const nextConfig: StoredTelegramConfig = {
          botToken: submittedToken ? effectiveToken : stored.botToken,
          botUsername: me.username || '',
          botFirstName: me.first_name || '',
          allowedChatIds:
            typeof req.body?.allowedChatIds === 'string'
              ? req.body.allowedChatIds.trim().slice(0, 500)
              : stored.allowedChatIds,
          autoSyncToWebsite:
            typeof req.body?.autoSyncToWebsite === 'boolean'
              ? req.body.autoSyncToWebsite
              : stored.autoSyncToWebsite,
          defaultCategoryId:
            typeof req.body?.defaultCategoryId === 'string' &&
            req.body.defaultCategoryId.trim()
              ? req.body.defaultCategoryId.trim().slice(0, 60)
              : stored.defaultCategoryId,
          lastUpdateId:
            typeof req.body?.lastUpdateId === 'number' &&
            req.body.lastUpdateId >= 0
              ? Math.floor(req.body.lastUpdateId)
              : stored.lastUpdateId,
        };

        writeStoredTelegramConfig(nextConfig);
        const {token: activeToken, source} = resolveBotToken(nextConfig);

        res.json({
          tokenConfigured: Boolean(activeToken),
          tokenSource: source,
          maskedToken: maskToken(activeToken),
          botUsername: nextConfig.botUsername,
          botFirstName: nextConfig.botFirstName,
          allowedChatIds: nextConfig.allowedChatIds,
          autoSyncToWebsite: nextConfig.autoSyncToWebsite,
          defaultCategoryId: nextConfig.defaultCategoryId,
          lastUpdateId: nextConfig.lastUpdateId,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/telegram/disconnect',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await verifyAdminRequest(req);
        if (fs.existsSync(TELEGRAM_CONFIG_PATH)) {
          fs.unlinkSync(TELEGRAM_CONFIG_PATH);
        }
        res.json({ok: true});
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/telegram/check-chats',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await verifyAdminRequest(req);
        const stored = readStoredTelegramConfig();
        const {token} = resolveBotToken(stored);
        if (!token) {
          throw Object.assign(
            new Error('Telegram Bot ချိတ်ဆက်ထားခြင်း မရှိသေးပါ။'),
            {statusCode: 400},
          );
        }

        const updates = await fetchTelegramUpdatesSafe(
          token,
          stored.lastUpdateId > 0 ? stored.lastUpdateId + 1 : undefined,
        );

        const chatMap = new Map<
          string,
          {
            chatId: string;
            title: string;
            type: string;
            username: string;
            pendingPdfCount: number;
          }
        >();
        let pendingPdfCount = 0;

        for (const u of updates) {
          const msg = u.message || u.channel_post;
          if (!msg?.chat?.id) continue;
          const chatId = String(msg.chat.id);
          const isPdf = Boolean(
            msg.document &&
              (msg.document.mime_type === 'application/pdf' ||
                msg.document.file_name?.toLowerCase().endsWith('.pdf')),
          );
          if (isPdf) pendingPdfCount += 1;

          const existing = chatMap.get(chatId);
          if (existing) {
            if (isPdf) existing.pendingPdfCount += 1;
          } else {
            chatMap.set(chatId, {
              chatId,
              title:
                msg.chat.title ||
                msg.chat.first_name ||
                msg.from?.first_name ||
                `Chat ${chatId}`,
              type: msg.chat.type || 'private',
              username: msg.chat.username || msg.from?.username || '',
              pendingPdfCount: isPdf ? 1 : 0,
            });
          }
        }

        res.json({
          chats: Array.from(chatMap.values()),
          pendingPdfCount,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/api/telegram/sync-to-drive',
    async (req: Request, res: Response, next: NextFunction) => {
      if (telegramSyncInFlight) {
        res.status(409).json({
          error: 'Telegram Sync လုပ်ဆောင်နေဆဲ ဖြစ်ပါသည်။ ခေတ္တစောင့်ပါ။',
        });
        return;
      }

      telegramSyncInFlight = true;
      try {
        await verifyAdminRequest(req);
        const driveToken = String(req.headers['x-drive-token'] || '').trim();
        if (!driveToken) {
          throw Object.assign(
            new Error('Google Drive access token missing.'),
            {statusCode: 401},
          );
        }

        const stored = readStoredTelegramConfig();
        const {token: botToken} = resolveBotToken(stored);
        if (!botToken) {
          throw Object.assign(
            new Error('Telegram Bot Token ချိတ်ဆက်သတ်မှတ်ထားခြင်း မရှိသေးပါ။'),
            {statusCode: 400},
          );
        }

        const folderId =
          typeof req.body?.folderId === 'string' &&
          /^[a-zA-Z0-9_-]{5,200}$/.test(req.body.folderId.trim())
            ? req.body.folderId.trim()
            : undefined;

        const allowedSet = new Set(
          stored.allowedChatIds
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        );

        const updates = await fetchTelegramUpdatesSafe(
          botToken,
          stored.lastUpdateId > 0 ? stored.lastUpdateId + 1 : undefined,
        );

        const uploadedBooks: Array<{
          driveFileId: string;
          fileName: string;
          fileSize: string;
          title: string;
          telegramMessageId: number;
          chatId: string;
          chatTitle: string;
        }> = [];
        const errors: string[] = [];
        let skippedCount = 0;
        let maxUpdateId = stored.lastUpdateId;

        for (const u of updates) {
          if (u.update_id > maxUpdateId) maxUpdateId = u.update_id;
          const msg = u.message || u.channel_post;
          if (!msg?.chat?.id) {
            skippedCount += 1;
            continue;
          }

          const chatId = String(msg.chat.id);
          if (allowedSet.size > 0 && !allowedSet.has(chatId)) {
            skippedCount += 1;
            continue;
          }

          const doc = msg.document;
          const isPdf = Boolean(
            doc?.file_id &&
              (doc.mime_type === 'application/pdf' ||
                doc.file_name?.toLowerCase().endsWith('.pdf')),
          );
          if (!isPdf || !doc?.file_id) {
            skippedCount += 1;
            continue;
          }

          const rawCaption = (msg.caption || '').split(/\r?\n/)[0]?.trim() || '';
          const rawFileName =
            doc.file_name?.trim() || `Telegram_Book_${u.update_id}.pdf`;
          const displayTitle = (
            rawCaption || rawFileName.replace(/\.pdf$/i, '')
          ).slice(0, 240);
          const safeDriveFileName = sanitizePdfFilename(
            rawCaption || rawFileName,
          );

          try {
            if (doc.file_size && doc.file_size > MAX_PDF_BYTES) {
              throw new Error(`${displayTitle}: ဖိုင်အရွယ်အစား 50 MB ထက် ကျော်လွန်နေပါသည်။`);
            }

            const fileMeta = await callTelegramApi<{
              file_path?: string;
              file_size?: number;
            }>(botToken, 'getFile', {file_id: doc.file_id});

            if (!fileMeta.file_path) {
              throw new Error(`${displayTitle}: Telegram ဖိုင်လမ်းကြောင်း ရယူ၍ မရပါ။`);
            }

            const fileUrl = `https://api.telegram.org/file/bot${botToken}/${fileMeta.file_path}`;
            const fileRes = await fetch(fileUrl, {
              signal: AbortSignal.timeout(45_000),
            });
            if (!fileRes.ok) {
              throw new Error(
                `${displayTitle}: Telegram မှ PDF ဒေါင်းလုဒ် မအောင်မြင်ပါ (${fileRes.status})`,
              );
            }

            const arrBuf = await fileRes.arrayBuffer();
            if (arrBuf.byteLength > MAX_PDF_BYTES) {
              throw new Error(`${displayTitle}: PDF အရွယ်အစား 50 MB ထက် ကျော်နေပါသည်။`);
            }
            const pdfBuf = Buffer.from(arrBuf);
            if (!isPdfBuffer(pdfBuf)) {
              throw new Error(`${displayTitle}: PDF ဖိုင်အစစ် မဟုတ်ပါ။`);
            }

            const uploaded = await uploadPdfBufferToDrive(
              driveToken,
              pdfBuf,
              safeDriveFileName,
              folderId,
            );

            uploadedBooks.push({
              driveFileId: uploaded.id,
              fileName: uploaded.name,
              fileSize: uploaded.size,
              title: displayTitle,
              telegramMessageId: msg.message_id || u.update_id,
              chatId,
              chatTitle:
                msg.chat.title || msg.chat.first_name || `Chat ${chatId}`,
            });

            // Send friendly confirmation reply back in Telegram (best-effort)
            await callTelegramApi(botToken, 'sendMessage', {
              chat_id: chatId,
              text: `✅ "${displayTitle}" (${uploaded.size}) ကို Google Drive နှင့် Website စာကြည့်တိုက်ပေါ်သို့ တင်ပြီးပါပြီ။`,
              reply_to_message_id: msg.message_id,
            }).catch(() => {});
          } catch (itemErr) {
            const status =
              typeof itemErr === 'object' &&
              itemErr !== null &&
              'statusCode' in itemErr &&
              typeof (itemErr as {statusCode: unknown}).statusCode === 'number'
                ? (itemErr as {statusCode: number}).statusCode
                : 0;
            if (status === 401) {
              throw itemErr;
            }
            errors.push(
              itemErr instanceof Error
                ? itemErr.message
                : `${displayTitle}: တင်သွင်းမှု မအောင်မြင်ပါ။`,
            );
          }
        }

        if (maxUpdateId > stored.lastUpdateId) {
          writeStoredTelegramConfig({
            ...stored,
            lastUpdateId: maxUpdateId,
          });
        }

        res.json({
          uploadedBooks,
          skippedCount,
          errors,
          lastUpdateId: maxUpdateId,
        });
      } catch (err) {
        next(err);
      } finally {
        telegramSyncInFlight = false;
      }
    },
  );

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
        let items = extractBlogspotCatalogItems(html, fetched.finalUrl);

        let parsedFinal: URL | null = null;
        try {
          parsedFinal = new URL(fetched.finalUrl);
        } catch {
          parsedFinal = null;
        }
        const isLabelOrIndexPath = Boolean(
          parsedFinal &&
            (parsedFinal.pathname.startsWith('/search') ||
              parsedFinal.pathname === '/'),
        );

        // For label/search/home pages or when HTML parsing yields empty, read clean entries from Blogger JSON feed
        if (isLabelOrIndexPath || items.length === 0) {
          const isSinglePostUrl = Boolean(
            parsedFinal &&
              /\/\d{4}\/\d{2}\/[^/?#]+\.html$/i.test(parsedFinal.pathname),
          );
          if (!isSinglePostUrl) {
            const feedItems = await tryFetchBloggerFeedCatalogItems(
              fetched.finalUrl,
            );
            if (feedItems.length > 0) {
              items = feedItems;
            }
          }
        }

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

        const driveIdSet = new Set(resources.driveFileIds);
        const mediafireSet = new Set(resources.mediafireUrls);
        const directPdfSet = new Set(resources.directPdfUrls);

        // Expand shortened links (bit.ly, goo.gl, tinyurl, etc.) via SSRF-checked redirect resolution
        if (resources.shortUrls.length > 0) {
          const resolvedTargets = await Promise.all(
            resources.shortUrls.slice(0, 8).map((s) => resolveShortLinkUrl(s)),
          );
          for (const target of resolvedTargets) {
            if (!target) continue;
            const driveMatch = target.match(DRIVE_FILE_ID_REGEX);
            if (driveMatch?.[1]) {
              driveIdSet.add(driveMatch[1]);
              continue;
            }
            try {
              const targetUrl = new URL(target);
              if (isAllowedMediaFireHost(targetUrl.hostname)) {
                mediafireSet.add(
                  target
                    .replace(/^http:\/\//i, 'https://')
                    .replace(/mediafire\.com\/view\//i, 'mediafire.com/file/'),
                );
                continue;
              }
              if (
                /\.pdf(?:\?[^#\s]*)?$/i.test(targetUrl.pathname) &&
                isAllowedPdfFetchHost(targetUrl.hostname)
              ) {
                directPdfSet.add(target);
              }
            } catch {
              // ignore invalid redirect targets
            }
          }
        }

        // 1. Try direct server-side Google Drive copy first
        for (const driveId of driveIdSet) {
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
        for (const mfUrl of mediafireSet) {
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
        for (const pdfUrl of directPdfSet) {
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

  // ---------- Verified PDF Source & Direct Download Service ----------

  function isAllowedDirectPdfSourceHost(hostname: string): boolean {
    return (
      isAllowedDriveDownloadHost(hostname) || isAllowedPdfFetchHost(hostname)
    );
  }

  function extractDriveIdFromDownloadUrl(rawUrl: string): string {
    const match = rawUrl.match(
      /(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#\s]*&)?id=)|drive\.usercontent\.google\.com\/download\?(?:[^#\s]*&)?id=|docs\.google\.com\/file\/d\/)([a-zA-Z0-9_-]{10,200})/i,
    );
    return match?.[1] || '';
  }

  function isValidPdfMimeTypeHeader(contentTypeHeader: string): {
    valid: boolean;
    baseMime: string;
  } {
    const baseMime = contentTypeHeader.split(';')[0]?.trim().toLowerCase() || '';
    if (
      baseMime === 'text/html' ||
      baseMime === 'application/xhtml+xml' ||
      baseMime === 'text/plain' ||
      baseMime === 'application/json' ||
      baseMime === 'application/xml' ||
      baseMime === 'text/xml'
    ) {
      return {valid: false, baseMime};
    }

    const allowedPdfOrBinaryMimes = new Set([
      '',
      'application/pdf',
      'application/x-pdf',
      'application/acrobat',
      'applications/vnd.pdf',
      'text/pdf',
      'text/x-pdf',
      'application/octet-stream',
      'application/binary',
      'binary/octet-stream',
    ]);

    return {
      valid: allowedPdfOrBinaryMimes.has(baseMime),
      baseMime,
    };
  }

  const resolvedDriveUrlCache = new Map<
    string,
    {url: string; expiresAt: number}
  >();

  async function validatePdfUpstreamResponse(
    upstream: globalThis.Response,
    sourceLabel: string,
    options?: {requirePdfMagicHeader?: boolean},
  ): Promise<{
    upstream: globalThis.Response;
    firstChunk: Uint8Array;
    reader: ReadableStreamDefaultReader<Uint8Array>;
    upstreamMimeType: string;
    contentLength: number | null;
    supportsRange: boolean;
  }> {
    const requireMagic = options?.requirePdfMagicHeader ?? true;

    if (!upstream.ok) {
      await upstream.body?.cancel().catch(() => {});
      throw Object.assign(
        new Error(
          `${sourceLabel} returned HTTP ${upstream.status} while verifying PDF.`,
        ),
        {statusCode: 502},
      );
    }

    const rawContentType = upstream.headers.get('content-type') || '';
    const mimeCheck = isValidPdfMimeTypeHeader(rawContentType);
    if (!mimeCheck.valid) {
      await upstream.body?.cancel().catch(() => {});
      throw Object.assign(
        new Error(
          `Expected a PDF file but ${sourceLabel} returned "${mimeCheck.baseMime || 'unknown'}" (HTML error page or unsupported format).`,
        ),
        {statusCode: 422},
      );
    }

    const reader = upstream.body?.getReader();
    if (!reader) {
      throw Object.assign(
        new Error(`${sourceLabel} returned an empty response body.`),
        {statusCode: 502},
      );
    }

    const {done, value} = await reader.read();
    if (done || !value || value.byteLength === 0) {
      await reader.cancel().catch(() => {});
      throw Object.assign(
        new Error(`${sourceLabel} returned an empty PDF stream.`),
        {statusCode: 502},
      );
    }

    const headSlice = Buffer.from(
      value.subarray(0, Math.min(1024, value.byteLength)),
    );
    const headLatin = headSlice.toString('latin1');
    if (
      /^\s*(?:<!doctype\s+html|<html|<head|<body|<script|<\?xml)/i.test(
        headLatin,
      )
    ) {
      await reader.cancel().catch(() => {});
      throw Object.assign(
        new Error(
          `${sourceLabel} returned HTML/XML instead of PDF data.`,
        ),
        {statusCode: 422},
      );
    }
    if (requireMagic && !headSlice.includes('%PDF-')) {
      await reader.cancel().catch(() => {});
      throw Object.assign(
        new Error(
          `${sourceLabel} did not return valid PDF content (missing %PDF- signature).`,
        ),
        {statusCode: 422},
      );
    }

    const rawLength = upstream.headers.get('content-length');
    const contentLength =
      rawLength && /^\d+$/.test(rawLength) ? Number(rawLength) : null;
    const supportsRange =
      (upstream.headers.get('accept-ranges') || '').toLowerCase() === 'bytes';

    return {
      upstream,
      firstChunk: value,
      reader,
      upstreamMimeType: mimeCheck.baseMime || 'application/pdf',
      contentLength,
      supportsRange,
    };
  }

  async function fetchUrlHopStream(
    initialUrl: string,
    hostCheck: (hostname: string) => boolean,
    rangeHeader?: string,
  ): Promise<{res: globalThis.Response; finalUrl: string; cookies: string}> {
    let currentUrl = initialUrl;
    const cookieJar = new Map<string, string>();
    const visited = new Set<string>();

    for (let hop = 0; hop < 7; hop += 1) {
      const validated = await assertSafeExternalUrl(currentUrl, hostCheck);
      const normalizedCurrent = validated.toString();
      if (visited.has(normalizedCurrent)) {
        throw Object.assign(
          new Error('Broken redirect loop detected while fetching PDF source.'),
          {statusCode: 502},
        );
      }
      visited.add(normalizedCurrent);

      const cookieHeader = Array.from(cookieJar.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

      const controller = new AbortController();
      const headerTimeout = setTimeout(() => controller.abort(), 30_000);
      let upstream: globalThis.Response;
      try {
        upstream = await fetch(normalizedCurrent, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: 'application/pdf,application/octet-stream,*/*;q=0.8',
            ...(rangeHeader ? {Range: rangeHeader} : {}),
            ...(cookieHeader ? {Cookie: cookieHeader} : {}),
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(headerTimeout);
      }

      const setCookies =
        typeof upstream.headers.getSetCookie === 'function'
          ? upstream.headers.getSetCookie()
          : [];
      for (const sc of setCookies) {
        const pair = sc.split(';')[0]?.trim();
        const eqIdx = pair?.indexOf('=') ?? -1;
        if (pair && eqIdx > 0) {
          cookieJar.set(pair.slice(0, eqIdx), pair.slice(eqIdx + 1));
        }
      }

      if (upstream.status >= 300 && upstream.status < 400) {
        const loc = upstream.headers.get('location');
        await upstream.body?.cancel().catch(() => {});
        if (!loc || !loc.trim()) {
          throw Object.assign(
            new Error('Broken redirect: upstream returned redirect without Location header.'),
            {statusCode: 502},
          );
        }
        try {
          currentUrl = new URL(loc, validated).toString();
        } catch {
          throw Object.assign(
            new Error('Broken redirect: invalid redirect target URL.'),
            {statusCode: 502},
          );
        }
        continue;
      }

      return {
        res: upstream,
        finalUrl: normalizedCurrent,
        cookies: Array.from(cookieJar.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join('; '),
      };
    }

    throw Object.assign(
      new Error('Broken redirect: exceeded maximum redirect hops.'),
      {statusCode: 502},
    );
  }

  function extractDriveConfirmDownloadUrl(
    html: string,
    baseUrl: string,
  ): string | null {
    // Pattern 1: Modern Google Drive virus-scan warning form on drive.usercontent.google.com
    const formMatch = html.match(
      /<form[^>]*id=["']download-form["'][^>]*action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/i,
    );
    if (formMatch?.[1]) {
      try {
        const actionUrl = new URL(decodeHtmlEntities(formMatch[1]), baseUrl);
        const inputRegex =
          /<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi;
        for (const inp of formMatch[2].matchAll(inputRegex)) {
          actionUrl.searchParams.set(
            decodeHtmlEntities(inp[1]),
            decodeHtmlEntities(inp[2]),
          );
        }
        if (!actionUrl.searchParams.has('confirm')) {
          actionUrl.searchParams.set('confirm', 't');
        }
        return actionUrl.toString();
      } catch {
        // continue to fallback regex
      }
    }

    // Pattern 2: Classic uc-download-link anchor
    const linkMatch = html.match(
      /href=["']([^"']*\/(?:uc|download)\?[^"']*confirm=[^"']+)["']/i,
    );
    if (linkMatch?.[1]) {
      try {
        return new URL(decodeHtmlEntities(linkMatch[1]), baseUrl).toString();
      } catch {
        return null;
      }
    }
    return null;
  }

  async function resolvePublicDrivePdfUpstream(
    fileId: string,
    options?: {rangeHeader?: string; requirePdfMagicHeader?: boolean},
  ): Promise<{
    upstream: globalThis.Response;
    firstChunk: Uint8Array;
    reader: ReadableStreamDefaultReader<Uint8Array>;
    upstreamMimeType: string;
    contentLength: number | null;
    supportsRange: boolean;
    sourceType: string;
  }> {
    const cached = resolvedDriveUrlCache.get(fileId);
    const validCachedUrl =
      cached && cached.expiresAt > Date.now() ? cached.url : null;

    const candidates = [
      ...(validCachedUrl ? [validCachedUrl] : []),
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
      `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(fileId)}`,
    ];

    for (const candidateUrl of candidates) {
      let current = await fetchUrlHopStream(
        candidateUrl,
        isAllowedDriveDownloadHost,
        options?.rangeHeader,
      ).catch(() => null);
      if (!current) continue;

      if (!current.res.ok) {
        await current.res.body?.cancel().catch(() => {});
        continue;
      }

      const contentType = (
        current.res.headers.get('content-type') || ''
      ).toLowerCase();

      if (contentType.includes('text/html')) {
        const htmlText = await current.res.text().catch(() => '');
        const confirmedUrl = extractDriveConfirmDownloadUrl(
          htmlText,
          current.res.url || current.finalUrl || candidateUrl,
        );
        if (!confirmedUrl) continue;
        current = await fetchUrlHopStream(
          confirmedUrl,
          isAllowedDriveDownloadHost,
          options?.rangeHeader,
        ).catch(() => null);
        if (!current) continue;
      }

      if (
        options?.rangeHeader &&
        !options.rangeHeader.startsWith('bytes=0-') &&
        current.res.status !== 206
      ) {
        await current.res.body?.cancel().catch(() => {});
        continue;
      }

      const validated = await validatePdfUpstreamResponse(
        current.res,
        'Google Drive',
        {requirePdfMagicHeader: options?.requirePdfMagicHeader ?? true},
      ).catch(() => null);
      if (validated) {
        resolvedDriveUrlCache.set(fileId, {
          url: current.finalUrl,
          expiresAt: Date.now() + 5 * 60_000,
        });
        return {...validated, sourceType: 'google-drive'};
      }
    }

    if (validCachedUrl) {
      resolvedDriveUrlCache.delete(fileId);
    }

    throw Object.assign(
      new Error(
        'PDF ဖိုင်ကို Google Drive မှ တိုက်ရိုက်ဒေါင်းလုဒ်ရယူ၍ မရနိုင်ပါ (ဖိုင်အများမြင် Permission ဖွင့်ထားကြောင်း စစ်ဆေးပါ)။',
      ),
      {statusCode: 502},
    );
  }

  async function resolveDirectUrlPdfUpstream(
    sourceUrl: string,
    options?: {rangeHeader?: string; requirePdfMagicHeader?: boolean},
  ): Promise<{
    upstream: globalThis.Response;
    firstChunk: Uint8Array;
    reader: ReadableStreamDefaultReader<Uint8Array>;
    upstreamMimeType: string;
    contentLength: number | null;
    supportsRange: boolean;
    sourceType: string;
  }> {
    const validatedUrl = await assertSafeExternalUrl(
      sourceUrl,
      isAllowedDirectPdfSourceHost,
    );

    if (isAllowedMediaFireHost(validatedUrl.hostname)) {
      const pageHop = await fetchUrlHopStream(
        validatedUrl.toString(),
        isAllowedMediaFireHost,
      );
      if (!pageHop.res.ok) {
        await pageHop.res.body?.cancel().catch(() => {});
        throw Object.assign(
          new Error(`MediaFire source returned HTTP ${pageHop.res.status}.`),
          {statusCode: 502},
        );
      }
      const ctype = (pageHop.res.headers.get('content-type') || '').toLowerCase();
      if (ctype.includes('text/html')) {
        const html = await pageHop.res.text();
        const directMatch = html.match(
          /https:\/\/download\d+\.mediafire\.com\/[^\s"'<>]+/i,
        );
        if (!directMatch?.[0]) {
          throw Object.assign(
            new Error('MediaFire page did not contain a valid direct PDF link.'),
            {statusCode: 422},
          );
        }
        const directHop = await fetchUrlHopStream(
          decodeHtmlEntities(directMatch[0]),
          isAllowedMediaFireHost,
          options?.rangeHeader,
        );
        const validated = await validatePdfUpstreamResponse(
          directHop.res,
          'MediaFire PDF',
          {requirePdfMagicHeader: options?.requirePdfMagicHeader ?? true},
        );
        return {...validated, sourceType: 'mediafire-pdf'};
      }
      const validated = await validatePdfUpstreamResponse(
        pageHop.res,
        'MediaFire PDF',
        {requirePdfMagicHeader: options?.requirePdfMagicHeader ?? true},
      );
      return {...validated, sourceType: 'mediafire-pdf'};
    }

    const hop = await fetchUrlHopStream(
      validatedUrl.toString(),
      isAllowedDirectPdfSourceHost,
      options?.rangeHeader,
    );
    const validated = await validatePdfUpstreamResponse(
      hop.res,
      validatedUrl.hostname,
      {requirePdfMagicHeader: options?.requirePdfMagicHeader ?? true},
    );
    return {...validated, sourceType: 'direct-url'};
  }

  async function resolveVerifiedPdfSource(params: {
    fileId: string;
    sourceUrl: string;
    rangeHeader?: string;
    requirePdfMagicHeader?: boolean;
  }) {
    const rawFileId = params.fileId.trim();
    const rawUrl = params.sourceUrl.trim();
    const derivedFileId =
      rawFileId || (rawUrl ? extractDriveIdFromDownloadUrl(rawUrl) : '');

    if (derivedFileId) {
      if (!/^[a-zA-Z0-9_-]{5,200}$/.test(derivedFileId)) {
        throw Object.assign(new Error('Invalid Google Drive fileId.'), {
          statusCode: 400,
        });
      }
      return resolvePublicDrivePdfUpstream(derivedFileId, {
        rangeHeader: params.rangeHeader,
        requirePdfMagicHeader: params.requirePdfMagicHeader,
      });
    }

    if (rawUrl) {
      return resolveDirectUrlPdfUpstream(rawUrl, {
        rangeHeader: params.rangeHeader,
        requirePdfMagicHeader: params.requirePdfMagicHeader,
      });
    }

    throw Object.assign(
      new Error('Missing PDF fileId or source url parameter.'),
      {statusCode: 400},
    );
  }

  // Verify PDF URL source and MIME type before initiating download
  app.get(
    '/api/books/verify',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const fileId =
          typeof req.query.fileId === 'string' ? req.query.fileId.trim() : '';
        const sourceUrl =
          typeof req.query.url === 'string' ? req.query.url.trim() : '';

        const verified = await resolveVerifiedPdfSource({fileId, sourceUrl});
        await verified.reader.cancel().catch(() => {});

        res.json({
          verified: true,
          mimeType: 'application/pdf',
          upstreamMimeType: verified.upstreamMimeType,
          contentLength: verified.contentLength,
          supportsRange: verified.supportsRange,
          sourceType: verified.sourceType,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  app.get(
    '/api/books/download',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const fileId =
          typeof req.query.fileId === 'string' ? req.query.fileId.trim() : '';
        const sourceUrl =
          typeof req.query.url === 'string' ? req.query.url.trim() : '';

        const rawStart =
          typeof req.query.start === 'string' ? req.query.start.trim() : '';
        const rawEnd =
          typeof req.query.end === 'string' ? req.query.end.trim() : '';
        let rangeHeader: string | undefined;
        let requirePdfMagicHeader = true;

        if (rawStart !== '' || rawEnd !== '') {
          const startNum = Number(rawStart);
          const endNum = Number(rawEnd);
          if (
            !Number.isInteger(startNum) ||
            !Number.isInteger(endNum) ||
            startNum < 0 ||
            endNum < startNum ||
            endNum - startNum + 1 > 16 * 1024 * 1024
          ) {
            throw Object.assign(new Error('Invalid byte chunk range.'), {
              statusCode: 400,
            });
          }
          rangeHeader = `bytes=${startNum}-${endNum}`;
          requirePdfMagicHeader = startNum === 0;
        }

        const rawTitle =
          typeof req.query.title === 'string'
            ? req.query.title.trim()
            : 'Islamic_Library_Book';
        const safeBaseTitle =
          rawTitle
            .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120) || 'Islamic_Library_Book';
        const utf8Filename = safeBaseTitle.toLowerCase().endsWith('.pdf')
          ? safeBaseTitle
          : `${safeBaseTitle}.pdf`;
        const asciiBase = safeBaseTitle
          .replace(/[^\x20-\x7E]/g, '')
          .replace(/["\\]/g, '')
          .trim();
        const asciiFallbackSlug =
          fileId.slice(0, 8) || 'Book';
        const asciiFilename = asciiBase
          ? asciiBase.toLowerCase().endsWith('.pdf')
            ? asciiBase
            : `${asciiBase}.pdf`
          : `MML_${asciiFallbackSlug}.pdf`;

        const checkOnly = req.query.check === '1';
        const {
          upstream,
          firstChunk,
          reader,
          upstreamMimeType,
          contentLength,
          supportsRange,
        } = await resolveVerifiedPdfSource({
          fileId,
          sourceUrl,
          rangeHeader,
          requirePdfMagicHeader,
        });

        if (checkOnly) {
          await reader.cancel().catch(() => {});
          res.json({
            ok: true,
            verified: true,
            mimeType: 'application/pdf',
            upstreamMimeType,
            filename: utf8Filename,
            contentLength,
            supportsRange,
          });
          return;
        }

        const upstreamLength = upstream.headers.get('content-length');
        res.setHeader('Content-Type', 'application/pdf');
        if (!rangeHeader) {
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(utf8Filename)}`,
          );
        }
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, max-age=300');
        if (upstreamLength && /^\d+$/.test(upstreamLength)) {
          res.setHeader('Content-Length', upstreamLength);
        }

        const webStream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(firstChunk);
          },
          async pull(controller) {
            try {
              const {done, value} = await reader.read();
              if (done) {
                controller.close();
                return;
              }
              if (value) {
                controller.enqueue(value);
              }
            } catch (err) {
              controller.error(err);
            }
          },
          cancel() {
            void reader.cancel().catch(() => {});
          },
        });

        const nodeStream = Readable.fromWeb(
          webStream as unknown as NodeWebReadableStream<Uint8Array>,
        );
        req.on('close', () => {
          nodeStream.destroy();
          void reader.cancel().catch(() => {});
        });
        nodeStream.pipe(res);
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

  const listenPort = resolveListenPort(useStaticProd);

  if (!useStaticProd) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {middlewareMode: true, hmr: false, ws: false},
      appType: 'spa',
    });

    app.get('/@vite/client', (_req: Request, res: Response) => {
      res.type('application/javascript; charset=utf-8').send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== "undefined") {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
export function updateStyle(id, content) {
  if (typeof document === "undefined" || linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    document.head.appendChild(style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (typeof document === "undefined") return;
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id="' + CSS.escape(id) + '"]').forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
const noop = () => {};
export function createHotContext() {
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    invalidate: noop,
    decline: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const parsed = new URL(url, "http://vite.dev");
  return pathname + "?" + queryToInject + (parsed.search ? "&" + parsed.search.slice(1) : "") + (parsed.hash || "");
}
export class ErrorOverlay extends HTMLElement {}
if (typeof customElements !== "undefined" && !customElements.get("vite-error-overlay")) {
  customElements.define("vite-error-overlay", ErrorOverlay);
}
`);
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir, {index: false}));
    app.get('*', (_req: Request, res: Response) => {
      const seo = readStoredSeoConfig();
      const indexPath = path.join(distDir, 'index.html');
      if (seo.googleSiteVerificationToken && fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf-8');
        res
          .type('text/html; charset=utf-8')
          .send(injectGoogleVerificationMeta(html, seo.googleSiteVerificationToken));
        return;
      }
      res.sendFile(indexPath);
    });
  }

  app.listen(listenPort, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${listenPort}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
