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

/** The asset store labels HTML `text/html` with no encoding. Browsers fall
 *  back to the `<meta charset>`, but the header should not need rescuing. */
function labelEncoding(response) {
  const type = response.headers.get('Content-Type') ?? '';
  if (type.startsWith('text/html') && !type.includes('charset')) {
    response.headers.set('Content-Type', 'text/html; charset=utf-8');
  }
  return response;
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const get = (path) => env.ASSETS.fetch(new Request(new URL(path, request.url), request));

    if (pathname === '/404' || pathname === '/404.html') {
      // Asked for as `/404`: html_handling drops the extension, so the asset
      // store answers the spelled-out path with a redirect and no body at all.
      const asset = await get('/404');
      return labelEncoding(new Response(asset.body, { status: 404, headers: asset.headers }));
    }

    const markdown = WANTS_MARKDOWN.test(request.headers.get('accept') ?? '');
    const asset = await (markdown ? get('/index.md') : env.ASSETS.fetch(request));

    const response = new Response(asset.body, asset);
    // Two representations answer to one URL, so a shared cache that ignored
    // Accept would hand the page to an agent, or the Markdown to a browser.
    response.headers.set('Vary', 'Accept');
    if (markdown) {
      response.headers.set('Content-Type', 'text/markdown; charset=utf-8');
    }
    return labelEncoding(response);
  },
};
