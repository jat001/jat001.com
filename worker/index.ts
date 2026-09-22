import { markdownPathname } from '../src/lib/markdown';

const NOT_FOUND_PATH = /^\/404(?:\.html)?$/i;
const WANTS_MARKDOWN = /^(?:.*,)?\s*text\/markdown\s*(?:[;,].*)?$/i;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const fetch = (pathname: string, request?: RequestInit): Promise<Response> =>
      env.ASSETS.fetch(url.origin + pathname, request);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405 });
    }

    if (NOT_FOUND_PATH.test(url.pathname)) {
      return new Response(
        request.method === 'HEAD' ? null : (await fetch('/404')).body,
        {
          status: 404,
          headers: {
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'Content-Type': 'text/html; charset=utf-8',
          },
        },
      );
    }

    let response: Response | null = null;
    let contentType = 'text/html';

    const accept = request.headers.get('accept');
    if (accept && WANTS_MARKDOWN.test(accept)) {
      const markdown = await fetch(markdownPathname(url.pathname), request);
      if (markdown.status === 200 || markdown.status === 304) {
        response = markdown;
        contentType = 'text/markdown';
      }
    }
    response ??= await fetch(url.pathname, request);

    response = new Response(response.body, response as ResponseInit);
    response.headers.set('Vary', 'Accept');
    response.headers.set('Content-Type', `${contentType}; charset=utf-8`);
    return response;
  },
};
