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

## Writing

Every page lands the plane: what the thing is, why it matters, and what it means for the person reading, with the real numbers and the real incident where there is one. The voice is direct and plain: we, never an unnamed I, no profanity, jokes or insults, no positioning against another vendor's product, and no past failure told for its own sake. The reference tables stay exact. Wording a source repo still carries that breaks this is rewritten by the page rules at the end of `scripts/sales-lens-rules.mjs` until the source is fixed. No em dashes as connectors, Oxford commas, American spelling. The house style is in the [brand standard](https://github.com/HotLoop-io/HotLoop-io/blob/main/brand/BRAND.md).
