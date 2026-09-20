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

Shipped to the browser: **2.2 KB of JavaScript** and **2.0 KB of CSS**, gzipped.
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
  pages/        index.astro — the page itself; 404.astro
  scripts/      sphere.ts — the 3D, dynamically imported
  styles/       global.css — tokens for both themes
scripts/
  build-languages.mjs   WakaTime + icons -> src/data/languages.ts
```

The only copy outside `profile.ts` is interface text: the two hard-coded
`aria-label`s and the three lines on the 404 page.

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

The logos are not links. All 34 would have pointed at the same URL, which
cost 34 tab stops and 34 identical entries in a screen reader's link list to
reach one destination; WakaTime sits in the contact row instead. Hover is a
per-element state, so each logo still lights on its own — that never depended
on the anchor.

> An earlier version used Three.js sprites. It cost **143.9 KB gzipped** to draw
> the logos on a ball, versus 1.1 KB this way.

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

`body` is a flex column of `100svh`, `main` takes the slack and the footer
follows it in normal flow. On anything tall enough that puts the footer on
the bottom edge of the screen with nothing to scroll; on a landscape phone,
where the content needs about 500px against 390px of height, the page scrolls
and the footer is at the end of it rather than floating over the content.

The contact row is two fixed columns, not `auto-fit`: four contacts in a
column this wide fit three across, leaving the fourth alone in its own row.

Above 900px the left column is lifted 30px. It and the sphere end up within
25px of the same height, but a bordered panel beside a cloud that is mostly
air reads as the heavier side on a shared midline. Narrower than that there
is no sphere to balance against, and under 700px of height no slack to lift
into, so the rule is scoped to both.

The left column is capped at `30rem`. Below 900px the sphere is gone and
nothing else claims the width, so without a ceiling the contact cells reached
405px — nearly three times their desktop width. The two-column track tops out
at 472px, so the cap only bites once the columns have collapsed.

The name and tagline are sized in `cqw`, off the column rather than the
viewport. Once the column caps at `30rem` the viewport stops standing in for
it: on `14vw` the name filled 22% of its column at 540px and 67% at 1600px,
where it now holds 65-67% throughout. `.intro` carries `container-type` for
that and nothing else — no rule queries it.

Stacking is a **media query** at 480px, not a container query. A container
query cannot separate the two cases that matter, because their ranges
overlap: a phone's column is 288–432px and the column beside the sphere is
394–472px. A 400px threshold therefore stacked the row between 901px and
923px of viewport — two up on either side of that band, one up inside it. The
squeeze the container query was written for no longer exists either: it was
calibrated when three cells needed 407px, and two need 272px against a
394px floor.

The sphere's track reaches its `35rem` ceiling exactly where the shell caps
at `75rem`. Sized in plain `vw` it kept widening after the shell had stopped,
and the text column, being the `1fr`, paid for it: 552px of it at a 1200px
viewport against 448px at 1920px, so the contact cells came out *wider* on
the smaller screen.

## Deploying

`pnpm build` emits a static `dist/`, and two targets are wired to it. They
build the same output, so either can serve the site alone.

**Cloudflare Workers.** `wrangler.toml` declares an assets-only Worker — no
`main`, so `dist/` is served from the edge and no Worker ever boots. Connect
the repo in the dashboard under Workers & Pages → the Worker → Settings →
Builds. That runs over Cloudflare's GitHub App, so nothing is stored in the
repo and no API token is involved. Build settings live in the dashboard, not
in `wrangler.toml`, which Workers Builds ignores for that purpose:

| setting        | value                 |
| -------------- | --------------------- |
| Build command  | `pnpm run build`      |
| Deploy command | `pnx wrangler deploy` |

`not_found_handling` points unmatched paths at `404.html` and answers with a
real 404; Pages serves that file with a 404 of its own, so neither needs a
redirect. `wrangler deploy` from a checkout works too, for a manual push.

**GitHub Pages.** `.github/workflows/pages.yml` builds on every push to `main`
and hands the artefact to `actions/deploy-pages`. Set the Pages source to
"GitHub Actions" in repo settings.

Both assume the site sits at the root of its domain: `astro.config.ts` sets
`site` and deliberately no `base`. Serving from a subpath, such as the default
`jat001.github.io/jat001.com`, would need `base` plus matching changes to the
root-absolute paths in `profile.ts`. Domains are configured on each platform
— there is no `public/CNAME` in the repo.

Both builds reach for WakaTime, so an outage there fails the deploy instead of
shipping a stale list.
