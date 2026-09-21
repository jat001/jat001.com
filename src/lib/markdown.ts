/**
 * Where a page's Markdown twin lives, by the rule the `.md.ts` endpoints
 * already follow: `/` is `/index.md`, `/about` is `/about.md`.
 *
 * Shared because two runtimes have to agree on the answer — the page, which
 * advertises the twin in `<link rel="alternate">`, and the Worker, which hands
 * it back when a request asks for `text/markdown`.
 */
export function markdownPathname(pathname: string): string {
  if (pathname.endsWith('/')) return `${pathname}index.md`;
  return `${pathname.replace(/\.html$/, '')}.md`;
}
