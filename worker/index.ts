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
     * `validators` hands over the caller's request, so its `If-None-Match`
     * reaches the store and a match comes back 304. The error branch cannot
     * take that answer — a 304 carries no body, and rewritten to 404 it
     * renders nothing — so it asks by URL and always gets the page.
     */
    const get = (path: string, validators = true): Promise<Response> => {
      const url = new URL(path, request.url);
      return env.ASSETS.fetch(validators ? new Request(url, request) : url);
    };

    const answer = (asset: Response, type: string, status?: number) => {
      const response = new Response(asset.body, {
        status: status ?? asset.status,
        headers: asset.headers,
      });
      // Two representations answer to one URL, and this has to be said even
      // when only one exists: a cache that stored the page unkeyed would go on
      // to hand it to an agent that asked for Markdown.
      response.headers.set('Vary', 'Accept');
      return labelEncoding(response, type);
    };

    if (pathname === ERROR_PAGE || pathname === `${ERROR_PAGE}.html`) {
      // Asked for without the extension, because html_handling drops it and
      // the store answers the spelled-out path with a bodyless redirect.
      return answer(await get(ERROR_PAGE, false), 'text/html', 404);
    }

    // A page without a twin falls back to itself, so which pages have Markdown
    // is decided by what the pages directory emits, not by a list in here.
    const twin = WANTS_MARKDOWN.test(request.headers.get('accept') ?? '')
      ? await get(markdownTwin(pathname))
      : null;
    const markdown = twin !== null && (twin.status === 200 || twin.status === 304);
    const asset = markdown ? (twin as Response) : await get(pathname);

    // Already the right answer, and with no body there is nothing to buffer,
    // relabel, or send chunked.
    if (asset.status === 304) {
      const notModified = new Response(null, { status: 304, headers: asset.headers });
      notModified.headers.set('Vary', 'Accept');
      return notModified;
    }

    return answer(asset, markdown ? 'text/markdown' : 'text/html');
  },
};
