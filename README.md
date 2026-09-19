# jat001.com

Personal site. **One screen**: name and contact on the left, a rotating sphere
of language logos on the right. Light and dark.

## Stack

| Layer  | Choice                                                              |
| ------ | ------------------------------------------------------------------- |
| Build  | Astro 7, static output — **Astro is the only runtime dependency**   |
| 3D     | hand-projected DOM elements, no WebGL and no 3D library             |
| Styles | Astro scoped CSS + custom-property tokens (`src/styles/global.css`) |
| Fonts  | Astro `fonts` API via Fontsource, self-hosted and subset            |

Shipped to the browser: **2.3 KB of JavaScript** and **2.0 KB of CSS**, gzipped.
`devicon` and `simple-icons` are dev dependencies: their paths are inlined at
build time, so neither library reaches the browser.

## Commands

```sh
pnpm dev               # regenerate languages, then dev server
pnpm check             # regenerate languages, then astro check
pnpm build             # check, then astro build
pnpm preview           # build, then serve dist/
pnpm build:languages   # regenerate src/data/languages.ts from WakaTime
```

`src/data/languages.ts` is generated and gitignored, and every entry point
above regenerates it, so **all of them need WakaTime reachable**. A fresh
clone has no copy to fall back on.

`server.host` is set in the config, so both `dev` and `preview` listen on every
interface and can be opened from a phone on the same network.

> Stop the running server before `pnpm build`. On Windows it holds
> `dist/.prerender` open and the build fails at cleanup with `EBUSY`.

## Structure

```
src/
  components/   Hero (left), Sphere (right), ThemeToggle, Footer
  data/         profile.ts — all the copy; languages.ts — GENERATED
  layouts/      Base.astro — head, meta, fonts, no-flash theme script
  pages/        index.astro — the page itself: composition and grid
  scripts/      sphere.ts — the 3D, dynamically imported
  styles/       global.css — tokens for both themes
scripts/
  build-languages.mjs   WakaTime + icons -> src/data/languages.ts
```

The only copy outside `profile.ts` is the interface strings: `Skip to
content` and the two `aria-label`s.

## The sphere

Logos sit on a Fibonacci-distributed sphere. Each frame the points are rotated
and projected with a perspective divide, and the result is written as a plain
2D `transform` — so the logos stay ordinary DOM elements:

- vector-crisp at any zoom, and readable by screen readers
- they inherit `currentColor`, so switching theme costs nothing
- before the script runs they are a centred wrap of labelled logos, so the
  page is never blank and never needs JS to be readable

Idle it turns slowly; drag to spin it. The loop runs **only** while the sphere
is on screen and the tab is visible, and the element watches its own box, so
below 900px — where CSS hides it — the chunk is never even fetched.

Every logo links to `wakatime.com/@Jat`, and a drag does not navigate.

> An earlier version used Three.js sprites. It cost **143.9 KB gzipped** to draw
> the logos on a ball, versus 1.2 KB this way.

## The languages

`src/data/languages.ts` is generated. An entry appears when it clears two
bars:

1. over an hour of tracked time on WakaTime, and
2. an icon exists in devicon or simple-icons.

Nothing is hand-listed. Four adjustments sit at the top of
`scripts/build-languages.mjs`:

| constant        | why                                                                          |
| --------------- | ---------------------------------------------------------------------------- |
| `MIN_SECONDS`   | WakaTime logs seconds for any file merely opened                             |
| `ALIAS`         | `Vue`/`Vue.js` and `HTML`/`HTML5` are one thing; POSIX shells fold into Bash |
| `EXCLUDE`       | `Xorg`, `TeX`                                                                |
| `ICON_OVERRIDE` | `SQL` — see below                                                            |

The generator prints what it kept and what it dropped, so a run shows exactly
which entries cleared an hour but have no icon anywhere.

### Icons

Neither library covers the list alone, so both are used, with their baked
`fill` attributes stripped so everything tints with `currentColor`. Preference
runs devicon `plain` → simple-icons → devicon `line`/`original`, keeping the
coloured variants last: tinting one throws away colours somebody chose.

`devicon.json` under-reports — some icons ship a `plain` file it does not
list — so the generator checks the disk before giving up.

**SQL has no language mark in either library** — only products (MySQL,
PostgreSQL, SQL Server…). `ICON_OVERRIDE` points it at devicon's
`azuresqldatabase`, the most neutral of them.

Licences: devicon MIT, simple-icons CC0-1.0. The marks remain the trademarks of
their owners.

## Themes

Light is the base and dark mirrors it from the same token names:

```
:root                            -> light
prefers dark + not forced light  -> dark
[data-theme="dark"]              -> dark, forced
```

The query asks for dark, never for light, so a browser that reports no
preference at all matches nothing and keeps the base. Forcing light needs no
rule of its own for the same reason.

`localStorage` is read once, by an inline script in `<head>`, which applies a
stored choice before first paint so a reload never flashes the other theme.
It is written in one place only — the toggle, on click — and a click always
stores. One click therefore pins the theme: the page stops following the OS
until that key is cleared.

## Layout

One grid, two tracks, collapsing to one below 900px — where the sphere is
dropped rather than shrunk, so the page still fits a single screen.

The contact row is governed by a **container query**, not a media query: it is
squeezed by the sphere taking the other track, so it has to react to its own
column. Below 420px of column it stacks into label-against-value rows, which
also covers phones, where that column is the whole page.

## Deploying

`pnpm build` emits a static `dist/`. Any static host works.
