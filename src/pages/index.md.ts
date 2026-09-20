import type { APIRoute } from 'astro';
import { profile } from '../data/profile';
import { languages } from '../data/languages';

/**
 * The page as Markdown, for agents that ask for `text/markdown`. Built from
 * the same data the page renders, so the two cannot drift.
 *
 * On Cloudflare the Worker hands this back for `/` when the Accept header
 * asks for it; everywhere else it is reachable at /index.md, which the page
 * advertises with `<link rel="alternate">`.
 */
export const GET: APIRoute = ({ site }) => {
  const url = (site ?? new URL(profile.url)).href.replace(/\/$/, '');

  const body = [
    `# ${profile.name}`,
    '',
    profile.tagline,
    '',
    profile.description,
    '',
    '## Contact',
    '',
    ...profile.links.map((l) => `- ${l.label}: ${l.href.replace(/^mailto:/, '')}`),
    '',
    '## Languages',
    '',
    `Tracked on WakaTime, over an hour each: ${languages.map((l) => l.label).join(', ')}.`,
    '',
    '---',
    '',
    `Source: ${url}/`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
