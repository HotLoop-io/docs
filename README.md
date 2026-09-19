# docs.hotloop.io

Source for [docs.hotloop.io](https://docs.hotloop.io), built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build), and published to GitHub Pages by a workflow on every push to `main`.

```
npm install
npm run dev       # http://localhost:4321
npm run build     # generates the social card and icons, then builds to dist/
```

Node 22.12 or newer is required, and `.nvmrc` pins the version CI uses.

## What is here, and what is not

Docs for HotLoop Gateway and HotLoop Flow, including what has not been proven yet. There are no installation pages on purpose. The images, charts, and command names are changing as both products move into this organization, and a command that is wrong within a week is worse than none. They will be added when the names are final.

## Where the pages come from

- **The Gateway's protocols, automations, and MCP pages** are adapted from the docs in the Gateway repository, with `scripts/adapt-source-doc.mjs`. It applies the house style with an explicit rule for every em-dash, and it refuses to finish if one survives, so a source doc that grows a new one is noticed instead of published.
- **The licensing page** is generated from the canonical `LICENSE.md` in [HotLoop-io/HotLoop-io](https://github.com/HotLoop-io/HotLoop-io) with `scripts/sync-license.mjs`. CI regenerates it and fails the build if the committed page is stale.
- **The Flow pages** are written from Flow's README and its generated compatibility document, keeping to what those actually state.
- **Design tokens** are a vendored copy of `brand/tokens.css` in HotLoop-io/HotLoop-io. CI fetches the canonical file and fails the build if the two differ.

## Writing

No em-dashes as connectors, Oxford commas, American spelling. The reasoning is in the [brand standard](https://github.com/HotLoop-io/HotLoop-io/blob/main/brand/BRAND.md).
