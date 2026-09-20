import { defineConfig, fontProviders } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import { profile } from './src/data/profile'

export default defineConfig({
  site: profile.url,

  // 404.html is emitted as a page, and a sitemap that advertises it invites
  // crawlers to index a page that answers 404.
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],

  // Bind every interface (0.0.0.0 and ::), so the dev server is reachable from a
  // phone on the same network. Dev and preview only — `astro build` is unaffected.
  server: { host: true },

  // Self-hosted: no third-party font request at runtime.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Space Grotesk',
      cssVariable: '--font-display',
      weights: [300, 400, 500, 600],
      subsets: ['latin'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      weights: [400, 500, 700],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
})
