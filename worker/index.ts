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

/**
 * Every response from here is one of two types, so both are stated rather than
 * patched: the asset store answers HTML with no encoding at all, and it has no
 * way to know that a `.md` file is standing in for a page.
 */
function labelEncoding(response: Response, type: string): Response {
  response.headers.set('Content-Type', `${type}; charset=utf-8`);
  return response;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    /**
     * The only way in to the asset store.
     *
     * `validators` forwards the caller's `If-None-Match`, which is what lets a
     * pass-through answer 304. Any branch that rewrites the status or picks a
     * different file has to drop them: the store would answer 304 with no
     * body, and a 304 reused as something else renders nothing.
     */
    const get = (path: string, validators = true): Promise<Response> => {
      const url = new URL(path, request.url);
      return env.ASSETS.fetch(validators ? new Request(url, request) : url);
    };

    if (pathname === ERROR_PAGE || pathname === `${ERROR_PAGE}.html`) {
      // Asked for without the extension, because html_handling drops it and
      // the store answers the spelled-out path with a bodyless redirect.
      const asset = await get(ERROR_PAGE, false);
      const headers = new Headers(asset.headers);
      // These describe the 200 the store just served. Left on a 404 they only
      // invite the revalidation this branch has no way to answer.
      headers.delete('ETag');
      headers.delete('Last-Modified');
      return labelEncoding(new Response(asset.body, { status: 404, headers }), 'text/html');
    }

    // A page without a twin falls back to itself, so which pages have Markdown
    // is decided by what the pages directory emits, not by a list in here.
    const twin = WANTS_MARKDOWN.test(request.headers.get('accept') ?? '')
      ? await get(markdownTwin(pathname), false)
      : null;
    const markdown = twin?.status === 200;
    const asset = markdown ? (twin as Response) : await get(pathname);

    const response = new Response(asset.body, asset);
    // Two representations answer to one URL, and this has to be said even when
    // only one exists: a cache that stored the page unkeyed would go on to
    // hand it to an agent that asked for Markdown.
    response.headers.set('Vary', 'Accept');
    return labelEncoding(response, markdown ? 'text/markdown' : 'text/html');
  },
};
