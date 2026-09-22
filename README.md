# jat001.com

Personal site. **One screen**: name and contact on the left, a rotating sphere
of language logos on the right. Light and dark.

## Stack

| Layer  | Choice                                                              |
| ------ | ------------------------------------------------------------------- |
| Build  | Astro 7, static output — **nothing but its output runs anywhere**   |
| 3D     | hand-projected DOM elements, no WebGL and no 3D library             |
| Styles | Astro scoped CSS + custom-property tokens (`src/styles/global.css`) |
| Fonts  | Astro `fonts` API via Fontsource, self-hosted and subset            |

`devicon` and `simple-icons` are read only by the generator; their paths are
inlined at build time, so neither library reaches the browser.

The split is by what reaches `dist/`, not by npm's published-package sense of
runtime: `astro`, its integrations and the two icon libraries all put bytes in
the output, so they are `dependencies`. `typescript`, `@types/node` and
`@astrojs/check` only ever check — Astro strips types with esbuild, never tsc
— so they are `devDependencies`, where the Astro docs site and the Next.js
TypeScript example keep them too.

One consequence: `pnpm build` runs `astro check` first, so it needs a full
install. None of the three hosts does a production-only one.

## Commands

```sh
pnpm dev               # regenerate languages, then dev server
pnpm check             # regenerate languages, then astro check
pnpm build             # check, then astro build
pnpm preview           # build, then serve dist/
pnpm generate-types    # generate worker-configuration.d.ts and .astro/*.d.ts
pnpm build:languages   # refresh src/data/languages.ts if it is over 12 h old
```

`generate-types` is the one script that needs `wrangler`, which is not a
dependency of this project. It is deliberately outside the `build` chain:
neither the GitHub Pages runner nor Vercel's build image has wrangler, and a
build that reached for one would fail on both. `tsconfig.json` excludes
`worker/` for the same reason — `astro check` would otherwise want the `Env`
that script writes. Run it after editing `wrangler.jsonc`, for the editor's
benefit; nothing else depends on it, and Workers Builds compiles
`worker/index.ts` on its own.

> On Windows, run `pnpm config set shellEmulator true` once. These scripts
> chain with `&&` and `;`, and `cmd.exe` reads `;` as part of an argument
> rather than as a command separator. pnpm's own shell reads both.

`src/data/languages.ts` is generated and gitignored. `dev`, `check`, `build`
and `preview` refresh it, but only if the copy on disk is **over 12 h old** —
the age comes from the `Generated:` timestamp in its own header, not the file's
mtime, which a checkout would reset. So a working tree reaches WakaTime about
twice a day, and `--force` whenever you want it now. A fresh clone has no copy
at all and must reach WakaTime; if it cannot, the fetch throws and the build
fails rather than shipping a stale list.

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
  lib/          markdown.ts — where a page's Markdown twin lives
  pages/        index.astro — the page itself; 404.astro; index.md.ts
  scripts/      sphere.ts — the 3D, dynamically imported
  styles/       global.css — tokens for both themes
scripts/
  build-languages.mjs   WakaTime + icons -> src/data/languages.ts
worker/
  index.ts      Cloudflare only: Accept negotiation, and a 404 that says 404
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
below 960px — where CSS hides it — the chunk is never even fetched.

The logos are not links. All 34 would have pointed at the same URL, which
cost 34 tab stops and 34 identical entries in a screen reader's link list to
reach one destination; WakaTime sits in the contact row instead. Hover is a
per-element state, so each logo still lights on its own — that never depended
on the anchor.

## The languages

`src/data/languages.ts` is generated. An entry appears when it clears two
bars:

1. over an hour of tracked time on WakaTime, and
2. an icon exists in devicon or simple-icons.

Nothing is hand-listed. Five adjustments sit at the top of
`scripts/build-languages.mjs`:

| constant        | why                                                                          |
| --------------- | ---------------------------------------------------------------------------- |
| `MIN_SECONDS`   | WakaTime logs seconds for any file merely opened                             |
| `MAX_AGE_HOURS` | how long a generated list counts as current                                  |
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

One grid, two tracks, collapsing to one below 960px — where the sphere is
dropped rather than shrunk, so the page still fits a single screen.

`body` is a flex column of `100svh`, `main` takes the slack and the footer
follows it in normal flow. On anything tall enough that puts the footer on
the bottom edge of the screen with nothing to scroll; on a landscape phone,
where the content needs about 500px against 390px of height, the page scrolls
and the footer is at the end of it rather than floating over the content.

The contact row is two fixed columns, not `auto-fit`: four contacts in a
column this wide fit three across, leaving the fourth alone in its own row.

From 960px the left column is lifted 30px. It and the sphere end up within 25px
of the same height, but a bordered panel beside a cloud that is mostly air
reads as the heavier side on a shared midline. Narrower than that there is no
sphere to balance against, and under 700px of height no slack to lift into, so
the rule is scoped to both.

The sphere asks for a square capped at `74svh`, which keeps it on one screen,
and is then stretched to the row, so it is never shorter than the text column.
Once the window is too short for that column the page scrolls anyway, and a
smaller sphere only cost balance. On a 1280px-wide window at 500px of height
the stage was 370px beside a 529px column; at 360px it was 266px, the radius
sat on the script's 120px floor and the logos spilled out of the stage. Both
now fill the column. From 717px of height up, `74svh` already clears the column
at any width, so nothing changes there. The cap is on a `::before` spacer
because a `max-height` on the stage would cap the stretch too, and `main`
centres its row rather than stretching it, which would otherwise hand the stage
the whole screen.

The left column is capped at `30rem`. Below 960px the sphere is gone and
nothing else claims the width, so without a ceiling the contact cells reached
431px — nearly twice their desktop width. The two-column track tops out at
468px, so the cap only bites once the columns have collapsed.

The name and tagline are sized in `cqw`, off the column rather than the
viewport. Once the column caps at `30rem` the viewport stops standing in for
it: on `14vw` the name filled 22% of its column at 540px and 67% at 1600px,
where it now holds 65-67% throughout. `.intro` carries `container-type` for
that and nothing else — no rule queries it.

The 404 page is the same rule. Its `main` is capped with
`min(100%, calc(30rem + 2 * var(--gut)))`, so the cap lands on the content
box rather than the border box, and the mark is `46cqw`. It had the same
split: a flat 27% of its container from 480px to 1200px, then 36% once the
container capped at 1072px while `14vw` carried on, and 40% at the bottom
where the `64px` floor held the type still against a shrinking container.

Stacking is a **media query** at 480px, not a container query. A container
query cannot separate the two cases that matter, because their ranges overlap:
a phone's column is 288–432px and the column beside the sphere is 374–468px. A
400px threshold would therefore stack the row between 960px and 1026px of
viewport — two up on either side of that band, one up inside it. The squeeze
the container query was written for no longer exists either: it was calibrated
when three cells needed 407px, and two need 272px against a 374px floor.

The tracks are `29fr` and `35fr` — 464px and 560px, the split on a full-width
shell — so the sphere is the wider column at every width. Both earlier sizings
lost that. In plain `vw` the sphere kept widening after the shell had capped,
and the text column paid for it: 552px of it at a 1200px viewport against 448px
at 1920px, so the contact cells came out _wider_ on the smaller screen. A ramp
that met `35rem` where the shell caps fixed that end but had to start low, and
at 901px, where the columns used to split, gave the sphere 381px against 394px
of text. The fixed split gives it 452px against 374px at 960px, where they
split now, and from 1280px up the same 464px and 560px as before.

## Deploying

`pnpm build` emits a static `dist/`, and three targets are wired to it. They
build the same output, so any one of them can serve the site alone.

**Cloudflare Workers.** `wrangler.jsonc` serves `dist/` from the edge and lists
in `run_worker_first` the handful of paths that reach `worker/index.ts`
instead. Everything absent from that list — the CSS, the fonts, the icons —
never wakes it. Connect the repo in the dashboard under Workers & Pages → the
Worker → Settings → Builds. That runs over Cloudflare's GitHub App, so nothing
is stored in the repo and no API token is involved. Build settings live in the
dashboard, not in `wrangler.jsonc`, which Workers Builds ignores for that
purpose:

| setting                     | value                                                                            |
| --------------------------- | -------------------------------------------------------------------------------- |
| Build command               | `pnpm install && pnpm run build`                                                 |
| Deploy command              | `pnpx wrangler deploy`                                                           |
| Build watch paths — include | `*`                                                                              |
| Build watch paths — exclude | `.github/*, .vscode/*, .gitignore, README.md, AGENTS.md, CLAUDE.md, vercel.json` |
| Build variables             | `PNPM_VERSION = 12`, `SKIP_DEPENDENCY_INSTALL = 1`                               |

The two build variables replace the install the image would otherwise run
itself, `pnpm install --frozen-lockfile` under the pnpm the image ships. That
one defaults to 10, and a pnpm 12 lockfile is two YAML documents — the first
naming the pnpm to use, the second the project — which 10 rejects outright with
`ERR_PNPM_BROKEN_LOCKFILE`. `SKIP_DEPENDENCY_INSTALL` hands the install to the
build command, which runs the same `pnpm install` as Vercel's `installCommand`,
and `PNPM_VERSION` carries only the major: the exact version is the one pinned
in the lockfile, which pnpm reads and switches to on its own.

The watch paths mirror `paths-ignore` in the Pages workflow and `ignoreCommand`
in `vercel.json`, and no two of the three are written the same way.
Cloudflare's `*` matches the `/` character, where GitHub's does not, so `*.md`
here would take every Markdown file in the tree rather than the three at the
root — including, one day, content under `src/`, which would then stop
triggering a deploy.

Narrowing it to the root is not expressible. `/*.md` fails twice over: the
wildcard may only sit at the start or end of a rule, not between `/` and
`.md`, and the paths being matched are repo-relative with no leading slash,
as the docs' own `docs/README.md` example shows. The rules came from branch
filtering — `fix/*` matching `fix/bugs` — and have no notion of a path
boundary. So the root docs are named one by one, and a new one has to be
added by hand. That direction only ever costs a spare build.

Excludes are applied first and whatever survives is matched against the
includes, so `*` plus that exclude list means "build unless the push touched
nothing else". A push of 20 commits or 3000 files skips the check and builds
regardless.

`not_found_handling` points unmatched paths at `404.html` and answers with a
real 404; Pages and Vercel serve that file with a 404 of their own, so none of
them needs a redirect. `wrangler deploy` from a checkout works too, for a
manual push.

> **Pages need a cache rule to be cacheable.** Enable **Respect Strong ETags**
> in a cache rule whose condition covers the hostname you serve. Without it,
> anything that rewrites HTML at the edge leaves a body with no length to
> declare, so the response goes out `chunked` with no `Content-Length` and no
> `ETag`, and nothing can revalidate a page.
>
> With the rule on, a page comes back byte for byte as it was built and
> `If-None-Match` answers `304` with an empty body. Markdown, images and plain
> text are never affected, being nothing that gets rewritten — which is what
> makes this look for a while like something about HTML that cannot be helped.
> Scope the rule to the hostname rather than to a path: one covering a single
> file fixes only that file. Cache rules are zone-scoped, so a `*.workers.dev`
> hostname cannot have one.

**GitHub Pages.** `.github/workflows/pages.yml` builds on a push to `main` and
hands the artefact to `actions/deploy-pages`. Set the Pages source to "GitHub
Actions" in repo settings. `paths-ignore` skips the run when a push touched
only `worker/`, `wrangler.jsonc`, `vercel.json`, `.vscode/`, `.gitignore` or a
root `*.md`, none of which reach this build — ignored rather than allow-listed,
because a forgotten build input would leave the site stale without saying so,
where a forgotten inert file costs one spare run. `.gitattributes` is left out
of the list: it sets the line endings of the checkout, so it can change the
bytes that get built.

**Vercel.** `vercel.json` holds everything, build settings included — those in
the file override the dashboard's. JSON rather than the TOML or TypeScript
forms, which the CLI compiles before the build and runs an install of its own
for, one the config cannot redirect because it has not been read yet. Its
`routes` do in config what `worker/index.ts` does on Cloudflare: `/404` answers
404, and `/` hands back `index.md` when `Accept` asks for `text/markdown`, with
`Vary: Accept` on both answers. A `has` value is matched against the whole
header rather than searched for inside it, so the `Accept` pattern has to
consume the rest of the list and carries its own `^` and `$`. That leaves it
correct as a search as well, so `worker/index.ts` holds the same regex.
`cleanUrls` sends `/index.html` and `/404.html` to their clean paths with a
308, and `trailingSlash: false` does the same for `/404/`. HTML keeps its
`ETag` without a cache rule, and `If-None-Match` answers `304`.

`ignoreCommand` is the third copy of the ignore list, written as a shell
command: exit 0 skips the build and 1 builds it. Anything else fails the
deployment outright, where the guide says 1 or greater builds — git's own 128,
for a previous commit that is not in the clone, came back as `Command failed
with exit code 128` — so the test is wrapped in an `if` that can only answer 0
or 1. It diffs `HEAD` against `VERCEL_GIT_PREVIOUS_SHA`, the last successful
deployment, rather than the `HEAD^` of the guide, which sees only the final
commit of a push: a `src/` change followed by a README fix would have been
skipped. Short of a clean run where nothing but ignored files changed, it
builds — no previous deployment, or one whose commit has fallen out of the
depth-10 clone, included. The pathspecs are git's, whose `*` crosses `/` as
Cloudflare's does, but here the root is expressible: under `:(glob)` a `*`
stops at `/`, so `*.md` means the root docs and nothing below. A redeploy from
the dashboard runs it as well, so redeploying the commit that is already live
cancels itself; the dialog's **Use project's Ignore Build Step** is the way
past that.

All three assume the site sits at the root of its domain: `astro.config.ts`
sets `site` and deliberately no `base`. Serving from a subpath, such as the
default `jat001.github.io/jat001.com`, would need `base` plus matching changes
to the root-absolute paths in `profile.ts`. Domains are configured on each
platform — there is no `public/CNAME` in the repo.

All three builds reach for WakaTime, so an outage there fails the deploy
instead of shipping a stale list.
