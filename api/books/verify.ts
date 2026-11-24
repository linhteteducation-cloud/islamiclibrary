import type {IncomingMessage, ServerResponse} from 'node:http';
import {resolveVerifiedPdfSource} from '../_pdfService';

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const parsedUrl = new URL(req.url || '/', 'http://localhost');
    const fileId = (parsedUrl.searchParams.get('fileId') || '').trim();
    const sourceUrl = (parsedUrl.searchParams.get('url') || '').trim();

    const verified = await resolveVerifiedPdfSource({fileId, sourceUrl});
    await verified.reader.cancel().catch(() => {});

    const body = JSON.stringify({
      verified: true,
      mimeType: 'application/pdf',
      upstreamMimeType: verified.upstreamMimeType,
      contentLength: verified.contentLength,
      supportsRange: verified.supportsRange,
      sourceType: verified.sourceType,
    });

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(body);
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
