/**
 * The routes static hosting gets wrong, and nothing else.
 *
 * A page can have two representations and the choice arrives in a request
 * header, which a static host never reads. The error document answers 200 from
 * its own URL, which is a soft 404: a page that says it is missing while
 * claiming to be fine.
 *
 * `run_worker_first` in wrangler.toml lists the paths that reach here. Anything
 * absent from that list is served off the edge without waking this up.
 */

import { markdownTwin } from '../src/lib/markdown';

/** `text/markdown` as a whole media type, not a substring of another one. */
const WANTS_MARKDOWN = /(?:^|,)\s*text\/markdown\s*(?:;|,|$)/i;

/** The error document, whose path this platform fixes at `/404.html`. */
const ERROR_PAGE = '/404';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    /**
     * The only way in to the asset store. Handing over the caller's request
     * carries its `If-None-Match` with it, so a match comes back 304.
     *
     * `conditional: false` asks by URL alone, and the error branch has to:
     * it rewrites the status, and a 304 rewritten to 404 has no body left to
     * render. A plain URL also follows the store's own redirects, where a
     * forwarded request inherits `redirect: "manual"` and would not.
     */
    const get = (path: string, conditional = true): Promise<Response> => {
      const url = new URL(path, request.url);
      return env.ASSETS.fetch(conditional ? new Request(url, request) : url);
    };

    if (pathname === ERROR_PAGE || pathname === `${ERROR_PAGE}.html`) {
      // Asked for by the tidy path, since html_handling redirects the
      // spelled-out one and this skips the hop. No `Vary` on the way out: the
      // error document has no second representation to be confused with.
      const asset = await get(ERROR_PAGE, false);
      const response = new Response(asset.body, { status: 404, headers: asset.headers });
      response.headers.set('Content-Type', 'text/html; charset=utf-8');
      return response;
    }

    // A page without a twin falls back to itself, so which pages have Markdown
    // is decided by what the pages directory emits, not by a list in here.
    const twin = WANTS_MARKDOWN.test(request.headers.get('accept') ?? '')
      ? await get(markdownTwin(pathname))
      : null;
    const markdown = twin !== null && (twin.status === 200 || twin.status === 304);
    const asset = markdown ? (twin as Response) : await get(pathname);

    // Nothing to relabel on a bodyless answer, but it still has to say what it
    // varies on, or a cache will hand it back for the other representation.
    if (asset.status === 304) {
      const notModified = new Response(null, { status: 304, headers: asset.headers });
      notModified.headers.set('Vary', 'Accept');
      return notModified;
    }

    const response = new Response(asset.body, asset);
    // Said even where only one representation exists today: a cache that
    // stored the page unkeyed would go on to serve it to an agent that asked
    // for Markdown.
    response.headers.set('Vary', 'Accept');
    // Stated rather than inherited: the store labels HTML with no encoding,
    // and has no way to know a `.md` file is standing in for a page.
    response.headers.set(
      'Content-Type',
      markdown ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8'
    );
    return response;
  },
};
