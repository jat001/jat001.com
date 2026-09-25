import { markdownPathname, wantsMarkdown } from '../src/lib/markdown';

interface Env {
  ASSETS: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
}

const NOT_FOUND_PATH = /^\/404(?:\.html)?$/i;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405 });
    }

    const url = new URL(request.url);

    if (NOT_FOUND_PATH.test(url.pathname)) {
      return new Response(
        request.method === 'HEAD'
          ? null
          : (await env.ASSETS.fetch(url.origin + '/404')).body,
        {
          status: 404,
          headers: {
            'Cache-Control': 'public, max-age=0, must-revalidate',
            'Content-Type': 'text/html',
          },
        },
      );
    }

    let response = wantsMarkdown(request)
      ? await env.ASSETS.fetch(url.origin + markdownPathname(url.pathname), request)
      : await env.ASSETS.fetch(url.origin + url.pathname, request);
    // `response.headers` is immutable.
    response = new Response(response.body, response as ResponseInit);
    response.headers.set('Vary', 'Accept');
    return response;
  },
};
