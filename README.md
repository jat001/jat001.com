# jat001.com

Personal site. **One screen**: name and contact on the left, a rotating sphere
of tool logos on the right. Light and dark.

## Stack

| Layer  | Choice                                                              |
| ------ | ------------------------------------------------------------------- |
| Build  | Astro 7, static output — **Astro is the only runtime dependency**   |
| 3D     | hand-projected DOM elements, no WebGL and no 3D library             |
| Styles | Astro scoped CSS + custom-property tokens (`src/styles/global.css`) |
| Fonts  | Astro `fonts` API via Fontsource, self-hosted and subset            |

Shipped to the browser: **2.6 KB of JavaScript** and **2.0 KB of CSS**, gzipped.
`devicon`, `simple-icons` and `@types/node` are dev dependencies only — their
output is inlined at build time and none of them reach the browser.

## Commands

```sh
pnpm dev           # dev server
pnpm build         # astro check && astro build
pnpm preview       # serve dist/
pnpm build:tools   # regenerate src/data/tools.ts from WakaTime
```

`server.host` is set in the config, so both `dev` and `preview` listen on every
interface and can be opened from a phone on the same network.

> Stop the running server before `pnpm build`. On Windows it holds
> `dist/.prerender` open and the build fails at cleanup with `EBUSY`.

## Structure

```
src/
  components/   Hero (left), Sphere (right), ThemeToggle, Footer
  data/         profile.ts — all the copy; tools.ts — GENERATED
  layouts/      Base.astro — head, meta, fonts, no-flash theme script
  pages/        index.astro — the page itself: composition and grid
  scripts/      sphere.ts — the 3D, dynamically imported
  styles/       global.css — tokens for both themes
scripts/
  build-tools.mjs   WakaTime + icon catalogues -> src/data/tools.ts
```

Copy lives in `src/data/profile.ts`; only the interface strings (`Skip to
content`, the two `aria-label`s) sit in their components.

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

Every logo links to `wakatime.com/@Jat`. Because a drag would otherwise end in
a navigation, pointer travel over 4px marks the gesture as a drag and the click
that follows is swallowed in the capture phase. There is deliberately no
`setPointerCapture`: capturing retargets the click to the stage, which would
stop taps ever reaching the links.

Dragging applies its rotation in `pointermove`, not in the animation loop.
Pointer events routinely outpace frames — 120Hz against 60Hz — and integrating
only the newest delta once per frame threw the rest of the travel away.

> An earlier version used Three.js sprites. It cost **143.9 KB gzipped** to draw
> the logos on a ball, versus 1.3 KB this way.

## The tools

`src/data/tools.ts` is generated. An entry appears when it clears two bars:

1. over an hour of tracked time on WakaTime, and
2. an icon exists in devicon or simple-icons.

Nothing is hand-listed. Four adjustments sit at the top of
`scripts/build-tools.mjs`:

| constant        | why                                                                          |
| --------------- | ---------------------------------------------------------------------------- |
| `MIN_SECONDS`   | WakaTime logs seconds for any file merely opened                             |
| `ALIAS`         | `Vue`/`Vue.js` and `HTML`/`HTML5` are one thing; POSIX shells fold into Bash |
| `EXCLUDE`       | `Xorg`, `TeX`                                                                |
| `ICON_OVERRIDE` | `SQL` — see below                                                            |

The generator prints what it kept and what it dropped, so a run shows exactly
which entries cleared an hour but have no icon anywhere.

### Icons

Neither library covers this list alone, so both are used and their baked `fill`
attributes are stripped so everything renders as `currentColor`. Preference
order is devicon `plain` → simple-icons → devicon `line`/`original`, because
the grid tints with `currentColor` and the last step is throwing away colours
somebody chose.

- **devicon** is the only source for Bash, C#, Groovy, Java, Objective-C and
  PowerShell. (simple-icons files Bash under "GNU Bash", which does not match.)
- **simple-icons** is the only source for CocoaPods, CSS and TOML, and also
  supplies C, CoffeeScript, Markdown and Rust, which devicon ships without a
  `plain` variant.
- `devicon.json` under-reports: some icons ship a `plain` file it does not
  list, so the generator checks the disk before giving up.

**SQL has no language mark in either library** — only products (MySQL,
PostgreSQL, SQL Server…). `ICON_OVERRIDE` points it at devicon's
`azuresqldatabase`, the most neutral of them.

Licences: devicon MIT, simple-icons CC0-1.0. The marks remain the trademarks of
their owners.

## Themes

Dark by default, light mirrored from the same token names. Resolution order:

```
:root                            -> dark
prefers light + not forced dark  -> light
[data-theme="light"|"dark"]      -> forced, stored in localStorage
```

An inline script in `<head>` applies a stored override before first paint, so
reloading in light mode never flashes dark.

> `body` must **not** have `transition: background`. Animating the shorthand
> latches onto the old computed value and never picks up a `var()` change, so
> the page keeps the old colour when the theme flips.

## Layout

One grid, two tracks, collapsing to one below 900px — where the sphere is
dropped rather than shrunk, so the page still fits a single screen.

The contact row is governed by a **container query**, not a media query: it is
squeezed by the sphere taking the other track, so it has to react to its own
column. Below 420px of column it stacks into label-against-value rows, which
also covers phones, where that column is the whole page.

## Deploying

`pnpm build` emits a static `dist/`. Any static host works.
