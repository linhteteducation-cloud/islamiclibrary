import dns from 'node:dns/promises';
import type {IncomingMessage, ServerResponse} from 'node:http';
import net from 'node:net';

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
}

function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.trim().toLowerCase();
  const ver = net.isIP(ip);
  if (ver === 4) return isPrivateOrReservedIpv4(ip);
  if (ver === 6) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('ff')) return true;
    if (/^fe[89ab]/.test(ip)) return true;
    if (ip.startsWith('::ffff:')) {
      const v4 = ip.slice(7);
      return net.isIP(v4) === 4 ? isPrivateOrReservedIpv4(v4) : true;
    }
    return false;
  }
  return true;
}

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

function isAllowedDriveDownloadHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'drive.google.com' ||
    host === 'drive.usercontent.google.com' ||
    host === 'docs.google.com' ||
    /^[a-z0-9-]+\.googleusercontent\.com$/i.test(host)
  );
}

function isAllowedMediaFireHost(hostname: string): boolean {
  return /^(?:www\.|download\d+\.)?mediafire\.com$/i.test(hostname.toLowerCase());
}

function isAllowedDirectPdfSourceHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    isAllowedDriveDownloadHost(host) ||
    isAllowedMediaFireHost(host) ||
    /^[a-z0-9-]+\.blogspot\.(com|sg|co\.uk|in|jp)$/i.test(host) ||
    host === 'www.blogger.com' ||
    host === 'library.ioumyanmar.com' ||
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
    throw Object.assign(new Error('Unsupported URL protocol.'), {statusCode: 400});
  }
  if (parsed.username || parsed.password) {
    throw Object.assign(new Error('URL credentials are not allowed.'), {statusCode: 400});
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw Object.assign(new Error('Custom ports are not allowed.'), {statusCode: 400});
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || !hostCheck(host)) {
    throw Object.assign(new Error(`Host "${host}" is not allowed for download.`), {
      statusCode: 400,
    });
  }
  if (net.isIP(host)) {
    throw Object.assign(new Error('Direct IP URLs are not allowed.'), {statusCode: 400});
  }

  const resolved = await dns.lookup(host, {all: true});
  if (!resolved.length) {
    throw Object.assign(new Error(`Unable to resolve host "${host}".`), {statusCode: 400});
  }
  for (const entry of resolved) {
    if (isPrivateOrReservedIp(entry.address)) {
      throw Object.assign(new Error('Blocked private or reserved network destination.'), {
        statusCode: 403,
      });
    }
  }
  return parsed;
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

  return {valid: allowedPdfOrBinaryMimes.has(baseMime), baseMime};
}

async function fetchUrlHopStream(
  initialUrl: string,
  hostCheck: (hostname: string) => boolean,
) {
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
    const headerTimeout = setTimeout(() => controller.abort(), 20_000);
    let upstream: globalThis.Response;
    try {
      upstream = await fetch(normalizedCurrent, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'application/pdf,application/octet-stream,*/*;q=0.8',
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
        throw Object.assign(new Error('Broken redirect: invalid redirect target URL.'), {
          statusCode: 502,
        });
      }
      continue;
    }

    return {res: upstream, finalUrl: normalizedCurrent};
  }

  throw Object.assign(new Error('Broken redirect: exceeded maximum redirect hops.'), {
    statusCode: 502,
  });
}

function extractDriveConfirmDownloadUrl(html: string, baseUrl: string): string | null {
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
      // continue
    }
  }
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

async function validateAndClosePdfResponse(
  upstream: globalThis.Response,
  sourceLabel: string,
) {
  if (!upstream.ok) {
    await upstream.body?.cancel().catch(() => {});
    throw Object.assign(
      new Error(`${sourceLabel} returned HTTP ${upstream.status} while verifying PDF.`),
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
    throw Object.assign(new Error(`${sourceLabel} returned an empty response body.`), {
      statusCode: 502,
    });
  }

  const {done, value} = await reader.read();
  await reader.cancel().catch(() => {});
  if (done || !value || value.byteLength === 0) {
    throw Object.assign(new Error(`${sourceLabel} returned an empty PDF stream.`), {
      statusCode: 502,
    });
  }

  const headSlice = Buffer.from(value.subarray(0, Math.min(1024, value.byteLength)));
  const headLatin = headSlice.toString('latin1');
  if (
    /^\s*(?:<!doctype\s+html|<html|<head|<body|<script|<\?xml)/i.test(headLatin) ||
    !headSlice.includes('%PDF-')
  ) {
    throw Object.assign(
      new Error(
        `${sourceLabel} did not return valid PDF content (missing %PDF- signature).`,
      ),
      {statusCode: 422},
    );
  }

  const rawLength = upstream.headers.get('content-length');
  return {
    upstreamMimeType: mimeCheck.baseMime || 'application/pdf',
    contentLength: rawLength && /^\d+$/.test(rawLength) ? Number(rawLength) : null,
    supportsRange:
      (upstream.headers.get('accept-ranges') || '').toLowerCase() === 'bytes',
  };
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const rawFileId = (parsedUrl.searchParams.get('fileId') || '').trim();
    const rawSourceUrl = (parsedUrl.searchParams.get('url') || '').trim();
    const derivedFileId =
      rawFileId || (rawSourceUrl ? extractDriveIdFromDownloadUrl(rawSourceUrl) : '');

    if (derivedFileId) {
      if (!/^[a-zA-Z0-9_-]{5,200}$/.test(derivedFileId)) {
        throw Object.assign(new Error('Invalid Google Drive fileId.'), {statusCode: 400});
      }
      const candidates = [
        `https://drive.usercontent.google.com/download?id=${encodeURIComponent(derivedFileId)}&export=download&confirm=t`,
        `https://drive.google.com/uc?export=download&confirm=t&id=${encodeURIComponent(derivedFileId)}`,
      ];

      for (const candidateUrl of candidates) {
        let current = await fetchUrlHopStream(
          candidateUrl,
          isAllowedDriveDownloadHost,
        ).catch(() => null);
        if (!current) continue;
        if (!current.res.ok) {
          await current.res.body?.cancel().catch(() => {});
          continue;
        }
        const ctype = (current.res.headers.get('content-type') || '').toLowerCase();
        if (ctype.includes('text/html')) {
          const htmlText = await current.res.text().catch(() => '');
          const confirmedUrl = extractDriveConfirmDownloadUrl(
            htmlText,
            current.res.url || current.finalUrl || candidateUrl,
          );
          if (!confirmedUrl) continue;
          current = await fetchUrlHopStream(
            confirmedUrl,
            isAllowedDriveDownloadHost,
          ).catch(() => null);
          if (!current) continue;
        }

        const verified = await validateAndClosePdfResponse(
          current.res,
          'Google Drive',
        ).catch(() => null);
        if (verified) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              verified: true,
              mimeType: 'application/pdf',
              ...verified,
              sourceType: 'google-drive',
            }),
          );
          return;
        }
      }

      throw Object.assign(
        new Error(
          'PDF ဖိုင်ကို Google Drive မှ တိုက်ရိုက်ဒေါင်းလုဒ်ရယူ၍ မရနိုင်ပါ (ဖိုင်အများမြင် Permission ဖွင့်ထားကြောင်း စစ်ဆေးပါ)။',
        ),
        {statusCode: 502},
      );
    }

    if (!rawSourceUrl) {
      throw Object.assign(new Error('Missing PDF fileId or source url parameter.'), {
        statusCode: 400,
      });
    }

    const validatedUrl = await assertSafeExternalUrl(
      rawSourceUrl,
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
      let targetRes = pageHop.res;
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
        );
        targetRes = directHop.res;
      }
      const verified = await validateAndClosePdfResponse(targetRes, 'MediaFire PDF');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          verified: true,
          mimeType: 'application/pdf',
          ...verified,
          sourceType: 'mediafire-pdf',
        }),
      );
      return;
    }

    const hop = await fetchUrlHopStream(
      validatedUrl.toString(),
      isAllowedDirectPdfSourceHost,
    );
    const verified = await validateAndClosePdfResponse(
      hop.res,
      validatedUrl.hostname,
    );
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        verified: true,
        mimeType: 'application/pdf',
        ...verified,
        sourceType: 'direct-url',
      }),
    );
  } catch (err) {
    const status =
      typeof err === 'object' &&
      err !== null &&
      'statusCode' in err &&
      typeof (err as {statusCode: unknown}).statusCode === 'number'
        ? (err as {statusCode: number}).statusCode
        : 500;
    const message =
      err instanceof Error ? err.message : 'PDF verification failed.';
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({error: message}));
  }
}
