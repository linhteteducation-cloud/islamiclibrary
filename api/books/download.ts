import type {IncomingMessage, ServerResponse} from 'node:http';
import {Readable} from 'node:stream';
import type {ReadableStream as NodeWebReadableStream} from 'node:stream/web';
import {resolveVerifiedPdfSource} from '../_pdfService';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const fileId = (parsedUrl.searchParams.get('fileId') || '').trim();
    const sourceUrl = (parsedUrl.searchParams.get('url') || '').trim();
    const rawStart = (parsedUrl.searchParams.get('start') || '').trim();
    const rawEnd = (parsedUrl.searchParams.get('end') || '').trim();

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
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({error: 'Invalid byte chunk range.'}));
        return;
      }
      rangeHeader = `bytes=${startNum}-${endNum}`;
      requirePdfMagicHeader = startNum === 0;
    }

    const rawTitle = (
      parsedUrl.searchParams.get('title') || 'Islamic_Library_Book'
    ).trim();
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
    const asciiFallbackSlug = fileId.slice(0, 8) || 'Book';
    const asciiFilename = asciiBase
      ? asciiBase.toLowerCase().endsWith('.pdf')
        ? asciiBase
        : `${asciiBase}.pdf`
      : `MML_${asciiFallbackSlug}.pdf`;

    const checkOnly = parsedUrl.searchParams.get('check') === '1';
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
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: true,
          verified: true,
          mimeType: 'application/pdf',
          upstreamMimeType,
          filename: utf8Filename,
          contentLength,
          supportsRange,
        }),
      );
      return;
    }

    const upstreamLength = upstream.headers.get('content-length');
    res.statusCode = 200;
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
    const status =
      typeof err === 'object' &&
      err !== null &&
      'statusCode' in err &&
      typeof (err as {statusCode: unknown}).statusCode === 'number'
        ? (err as {statusCode: number}).statusCode
        : 500;
    const message =
      err instanceof Error ? err.message : 'PDF download failed.';
    if (!res.headersSent) {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({error: message}));
    } else {
      res.end();
    }
  }
}
