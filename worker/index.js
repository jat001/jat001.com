/**
 * The routes static hosting gets wrong, and nothing else.
 *
 * `/` has two representations and the choice is in a request header, which a
 * static host never reads. `/404` and `/404.html` answer 200 from one, which
 * is a soft 404: a page that says it is missing while claiming to be fine.
 *
 * Only those paths are listed in `run_worker_first`, so the CSS, the fonts and
 * the icons are still served off the edge without waking this up.
 */

/** `text/markdown` as a whole media type, not a substring of another one. */
const WANTS_MARKDOWN = /(?:^|,)\s*text\/markdown\s*(?:;|,|$)/i;

/**
 * Every response from here is one of two types, so both are stated rather than
 * patched: the asset store answers HTML with no encoding at all, and it has no
 * way to know that index.md is standing in for the page.
 */
function labelEncoding(response, type) {
  response.headers.set('Content-Type', `${type}; charset=utf-8`);
  return response;
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const get = (path) => env.ASSETS.fetch(new Request(new URL(path, request.url), request));

    if (pathname === '/404' || pathname === '/404.html') {
      // Asked for as `/404`, because html_handling drops the extension and the
      // store answers the spelled-out path with a bodyless redirect. Asked for
      // without the caller's headers, too: a cache revalidating this URL sends
      // If-None-Match, the store would answer 304 with nothing in it, and a
      // 304 rewritten to 404 is a blank page.
      const asset = await env.ASSETS.fetch(new URL('/404', request.url));
      const headers = new Headers(asset.headers);
      // Those validators describe the 200 just served. On a 404 they only
      // invite the revalidation this branch cannot answer.
      headers.delete('ETag');
      headers.delete('Last-Modified');
      return labelEncoding(new Response(asset.body, { status: 404, headers }), 'text/html');
    }

    const markdown = WANTS_MARKDOWN.test(request.headers.get('accept') ?? '');
    const asset = await (markdown ? get('/index.md') : env.ASSETS.fetch(request));

    const response = new Response(asset.body, asset);
    // Two representations answer to one URL, so a shared cache that ignored
    // Accept would hand the page to an agent, or the Markdown to a browser.
    response.headers.set('Vary', 'Accept');
    return labelEncoding(response, markdown ? 'text/markdown' : 'text/html');
  },
};
