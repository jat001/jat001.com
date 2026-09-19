/**
 * Everything the page says about the person or the site. Nothing here should
 * be duplicated in a component.
 */
export const profile = {
  name: 'Jat',
  tagline: 'Coding for fun.',
  description: 'A senior developer with over 10 years of programming experience.',

  /** BCP 47 tag for <html lang>. */
  locale: 'en',
  /** Origin, used for canonical and og:url. */
  url: 'https://jat001.com',
  /** Served from public/. */
  icon: '/avatar.svg',
  /** Social card image, served from public/. Square on purpose — that is what
   *  `twitter:card` `summary` expects. Its dimensions are read from the file
   *  at build time, so swapping it needs no change here. */
  socialImage: '/avatar.png',
  /** This site's own source. */
  repo: 'https://github.com/jat001/jat001.com',

  links: [
    { label: 'GitHub', href: 'https://github.com/jat001', display: '@jat001' },
    { label: 'Blog', href: 'https://www.sinosky.org', display: 'sinosky.org' },
    { label: 'Email', href: 'mailto:chat@jat.email', display: 'chat@jat.email' },
  ],

  /** Where the language logos point, and what their labels name. */
  languages: {
    label: 'WakaTime',
    href: 'https://wakatime.com/@Jat',
  },
} as const;

/** "Jat — Coding for fun." */
export const title = `${profile.name} — ${profile.tagline}`;
