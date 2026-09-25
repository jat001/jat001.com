import { markdownPathname, wantsMarkdown } from '../src/lib/markdown.js';

export default function proxy(request: Request): Response {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, { status: 405 });
  }

  const url = new URL(request.url);
  const response = new Response();

  if (wantsMarkdown(request)) {
    response.headers.set(
      'x-middleware-rewrite',
      url.origin + markdownPathname(url.pathname),
    );
  } else {
    response.headers.set('x-middleware-next', '1');
  }
  response.headers.set('Vary', 'Accept');

  return response;
}
