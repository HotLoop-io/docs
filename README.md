# docs.hotloop.io

Source for [docs.hotloop.io](https://docs.hotloop.io), the documentation for every HotLoop product, built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build) and published to GitHub Pages on every push to `main`.

```
npm install
npm run dev       # http://localhost:4321
npm run build     # builds to dist/, then audits it
```

Node 22.12 or newer is required, and `.nvmrc` pins the version the build uses.

## What is here

One section per product: HotLoop IoT, Edge, Gateway, Edge Relay, Flow, Cascade, HotLoop for CODESYS, and Transmitter, plus the shared pages (install, k3s and Helm, Podman Quadlet, the `:stable` auto-update, release notes, the roadmap, the license and the terms). A bigger product carries everything the smaller one has, so its sidebar section links to those pages instead of copying them.

The pages teach a buyer and a new user how to install, set up and use each product, and say how far each one has been proven. The look is hotloop.io's, with the same fonts, colors, header and footer.

## How the pages are kept

Most pages are generated from the products' own documentation by `scripts/sync-docs.mjs`, which a maintainer runs and whose result is committed, so a generated page is edited at its source or in the sync's rules and never by hand. A generated page says so in its front matter. The hand-written pages live in `src/pinned/` and in `src/content/docs/`.

- `scripts/sync-manifest.mjs` says which source becomes which page, with its title and description.
- `scripts/sales-lens.mjs` and `scripts/sales-lens-rules.mjs` keep the pages a sales document: they take out our source tree, our test rig and CI, the libraries underneath, and the mechanics of running the roadmap, and keep what a customer installs, sets, opens or calls. `scripts/forbidden.mjs` fails the sync and the build if any of that comes back.
- `src/data/sync.json` is what the sync writes about itself, and the sidebar and the landing page read it.
- The License and Terms pages are the canonical text from the HotLoop-io organization, wrapped in a title and never edited here.

`npm run sync -- --check` writes nothing and fails if the committed pages differ from a fresh sync.

## When a release ships

Each product's release checklist has a step that points here: run the sync, read what it changed, build, open a pull request, merge on green, and watch the one Pages deploy. Then open a page that moved and check it serves the new version.

The sync ends by checking the translations (next section). If it lists stale pages, retranslate exactly those segments with the builder before the pull request. The build fails on a stale translated page, so it cannot merge, and a language page never says something the English page stopped saying.

## Translations

English plus thirteen languages (es fr it de nb bg el ko ja vi hi zh-hans ar). A page is translated in all thirteen or not at all, and a page that is not translated is served in English under the language folder, with a notice, noindex, out of the sitemap and out of every hreflang list (`src/routeData.ts`).

**Every translated page records the English it was made from.** `src/i18n-source/<page with / as __>.json` holds, per language, the hash of each English segment. A segment is the front matter title, description and sidebar label, then each paragraph, list item, heading and table row outside code (a soft-wrapped paragraph is one). English comes from `src/pinned/<page>.md` for a pinned page, with its `{{hotloop}}` style tokens unfilled, so a version bump is not a change, and from `src/content/docs/<page>` for the rest.

**The sync and the build say exactly what went stale.** `node scripts/i18n-source.mjs` (the sync ends with it, `npm run i18n` and `npm run build` run it) lines the English up against each record and prints, per page and set of languages, the segment numbers, their line in the English file and the new English. It also fails on a translated page with no record, a record with no page, a translation that no longer has its record's number of segments, and any link between translated pages whose `#anchor` is not a heading of the page it lands on.

**A release number is not wording.** Before a segment is hashed, the latest version of each product (from `src/data/sync.json`), its x line (`4.23.x`) and its major.minor (`4.23`) are read as `{{hotloop}}`, `{{flow}}` and `{{cascade}}` style tokens, so a release that only moves the number marks nothing stale. Older versions in a release list stay as written, and a record keeps the versions it was made against so a line that was the latest then still matches. `node scripts/i18n-source.mjs migrate` brought the records that predate this over.

**The number in a translation moves with the release.** Because a release number is a token, a new release does not mark a page stale, so nothing would change the number a translation printed the day it was made. The sync runs `node scripts/i18n-source.mjs bump` after it writes the pages: for each translation whose recorded versions are behind `src/data/sync.json`, and whose only difference from the English is the version, it swaps the old number for the new one in each line where the English names the latest release, then records the page again. `sync-docs.mjs --check` fails with `old version <page> <lang>` when a translation still holds the release before the latest one. A line where the English names an older release is history and is left alone.

**A stale translation fails the build instead of falling back to English.** This was decided on proof, 2026-11-22 (bead 1c3dbd). Falling back means deleting a language page, and the build is green while the page quietly leaves the index of up to thirteen languages: nobody sees it. Failing means the flagged segments, usually a handful, are retranslated in the same pull request as the English change, and a language reader never meets old text under a new version. If an English fix has to ship before its retranslation, delete that page's translated files and its record in the same pull request: the page then falls back to English like any untranslated page, and returns when it is retranslated.

**Retranslating exactly the flagged segments.** From the translation tools (`codex/secrets/access/site-i18n/docs-core`, README there), with `DOCS` set to this clone:

1. `node resync.mjs <page>` rewrites `tr/<page>/<lang>.txt`: every segment that did not change keeps its translation, every changed or new one becomes a `@@RETRANSLATE@@ <English>` line, and `tr/<page>/work.txt` lists each with the translation it replaces.
2. Translate those lines (the glossary in `codex/work/notes/i18n/glossary`, product names untouched, no em or en dashes), put them in with `node fill.mjs <page> < fill.json`.
3. `node build.mjs <page>` refuses any line still marked, writes the language pages, records the new English, and rewrites the `#anchor` of every link between translated pages. Build, and the check is clean.

**Anchors.** A link from a translated page into a page that is translated later carries the English heading slug until then. `node scripts/i18n-source.mjs links` lists every such link and `links --fix` rewrites it to the translated slug; the builder runs the fix after every build, so translating a page repairs the pages that point at it.

A translator who builds pages some other way records them with `node scripts/i18n-source.mjs record <page> [lang ...]` after writing them. It fails when the translation does not have one segment per English segment.

## Writing

Every page lands the plane: what the thing is, why it matters, and what it means for the person reading, with the real numbers and the real incident where there is one. The voice is direct and plain: we, never an unnamed I, no profanity, jokes or insults, no positioning against another vendor's product, and no past failure told for its own sake. The reference tables stay exact. Wording a source repo still carries that breaks this is rewritten by the page rules at the end of `scripts/sales-lens-rules.mjs` until the source is fixed. No em dashes as connectors, Oxford commas, American spelling. The house style is in the [brand standard](https://github.com/HotLoop-io/HotLoop-io/blob/main/brand/BRAND.md).
