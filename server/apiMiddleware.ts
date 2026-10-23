import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleCoreApiRequest } from './coreApiHandler';

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

export function createApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const rawUrl = req.url || '';
    if (!rawUrl.startsWith('/api/') && rawUrl !== '/api') {
      next();
      return;
    }

    const host = req.headers.host || 'localhost';
    const url = new URL(rawUrl, `http://${host}`);

    let body: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      try {
        body = await readJsonBody(req);
      } catch {
        body = {};
      }
    }

    const headers: Record<string, string | undefined> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      headers[key.toLowerCase()] = Array.isArray(val) ? val.join(', ') : val;
    }

    const result = await handleCoreApiRequest({
      method: req.method || 'GET',
      url: rawUrl,
      pathname: url.pathname,
      searchParams: url.searchParams,
      headers,
      body,
    });

    res.statusCode = result.statusCode;
    for (const [headerKey, headerVal] of Object.entries(result.headers)) {
      res.setHeader(headerKey, headerVal);
    }

    if (result.body instanceof Uint8Array || Buffer.isBuffer(result.body)) {
      res.end(Buffer.from(result.body));
    } else {
      res.end(result.body);
    }
  };
}
