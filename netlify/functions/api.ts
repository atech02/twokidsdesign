import { handleCoreApiRequest } from '../../server/coreApiHandler';

/**
 * Netlify Functions v2 Handler (Web Standards Request/Response)
 * Handles all /api/* routes deployed to Netlify Functions.
 */
export default async (req: Request, _context?: any): Promise<Response> => {
  const url = new URL(req.url);

  // Normalize path if routed via /.netlify/functions/api or /api
  let pathname = url.pathname;
  if (pathname.startsWith('/.netlify/functions/api')) {
    pathname = pathname.replace('/.netlify/functions/api', '/api');
    if (!pathname.startsWith('/api')) {
      pathname = '/api' + pathname;
    }
  }

  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((val, key) => {
    headers[key.toLowerCase()] = val;
  });

  let body: any = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const raw = await req.text().catch(() => '');
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
  }

  const result = await handleCoreApiRequest({
    method: req.method,
    url: req.url,
    pathname,
    searchParams: url.searchParams,
    headers,
    body,
  });

  const isNoBodyStatus =
    result.statusCode === 204 || result.statusCode === 205 || result.statusCode === 304;
  const responseBody = isNoBodyStatus
    ? null
    : result.body instanceof Uint8Array
      ? Buffer.from(result.body)
      : result.body;

  return new Response(responseBody, {
    status: result.statusCode,
    headers: result.headers,
  });
};

/**
 * Netlify Functions v1 / AWS Lambda Handler Compatibility Fallback
 */
export const handler = async (event: any, _context?: any) => {
  const rawPath = event.path || '';
  let pathname = rawPath;
  if (pathname.startsWith('/.netlify/functions/api')) {
    pathname = pathname.replace('/.netlify/functions/api', '/api');
    if (!pathname.startsWith('/api')) {
      pathname = '/api' + pathname;
    }
  }

  const searchParams = new URLSearchParams(event.queryStringParameters || {});
  let body: any = undefined;
  if (event.body) {
    try {
      body = event.isBase64Encoded
        ? JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'))
        : JSON.parse(event.body);
    } catch {
      body = event.body;
    }
  }

  const headers: Record<string, string | undefined> = {};
  if (event.headers) {
    for (const [key, val] of Object.entries(event.headers)) {
      headers[key.toLowerCase()] = String(val);
    }
  }

  const result = await handleCoreApiRequest({
    method: event.httpMethod || 'GET',
    url: rawPath,
    pathname,
    searchParams,
    headers,
    body,
  });

  const isBinary = result.body instanceof Uint8Array || Buffer.isBuffer(result.body);
  return {
    statusCode: result.statusCode,
    headers: result.headers,
    body: isBinary ? Buffer.from(result.body).toString('base64') : (result.body as string),
    isBase64Encoded: isBinary,
  };
};

/**
 * Netlify Function Route Path Configuration
 */
export const config = {
  path: ['/api/*', '/.netlify/functions/api/*'],
};
