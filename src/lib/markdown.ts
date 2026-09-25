/**
 * Where a page's Markdown twin lives, and who is asking for it.
 *
 * Shared because the runtimes have to agree: the page advertises the twin in
 * `<link rel="alternate">`, and the Cloudflare Worker, the Netlify edge
 * function and the Vercel middleware hand it back when a request asks for
 * `text/markdown`.
 */

import Negotiator from 'negotiator';

/** By the rule the `.md.ts` endpoints follow: `/` is `/index.md`. */
export function markdownPathname(pathname: string): string {
  if (pathname.endsWith('/')) return `${pathname}index.md`;
  return `${pathname.replace(/\.html$/, '')}.md`;
}

/**
 * Whether `Accept` prefers the twin to the page. HTML is offered first, so a
 * wildcard or a missing header goes to the page; a tie in `q` goes to
 * whichever the client listed first.
 */
export function wantsMarkdown(request: Request): boolean {
  const accept = request.headers.get('Accept');
  if (!accept) return false;
  return new Negotiator({ headers: { accept } }).mediaType([
    'text/html',
    'text/markdown',
  ]) === 'text/markdown';
}
