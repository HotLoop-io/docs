# docs.hotloop.io

Source for [docs.hotloop.io](https://docs.hotloop.io), built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build), and published to GitHub Pages by a workflow on every push to `main`.

```
npm install
npm run dev       # http://localhost:4321
npm run build     # generates the social card and icons, then builds to dist/
```

Node 22.12 or newer is required, and `.nvmrc` pins the version CI uses.

## What is here, and what is not

Docs for the HotLoop lineup (the Gateway and the Edge Relay today, IoT and Edge when they ship) and for HotLoop Flow, including what has not been proven yet. Every page says what it has actually been run against, because a doc that rounds up is how somebody finds out at commissioning.

Install pages exist for what you can install: Gateway 4.16.0, Edge Relay 4.16.0 and Flow 2.0.5. When a release ships, the image tags on those pages move the same day its release notes land on hotloop.io, so the two never disagree about what's current.

Some Gateway pages cover work that is merged on main and not in any release yet. Each one says so in a caution box at the top, and carries a **Next release** badge in the sidebar (the `NEXT` badge in `astro.config.mjs`). When the next release ships them, drop the badge and the box in the same change.

## Writing

Every page lands the plane: what the thing is, why it matters, and what it means for the person reading, with the real numbers and the real incident where there is one. The voice is Patrick's, blunt and a little unhinged, and the reference tables stay exact. No em-dashes as connectors, Oxford commas, American spelling. The house style is in the [brand standard](https://github.com/HotLoop-io/HotLoop-io/blob/main/brand/BRAND.md).

## Where the pages come from

- **The Gateway's protocols, automations, and MCP pages** are adapted from the docs in the Gateway repository, with `scripts/adapt-source-doc.mjs`. It applies the house style with an explicit rule for every em-dash, and it refuses to finish if one survives, so a source doc that grows a new one is noticed instead of published.
- **The licensing page** is generated from the canonical `LICENSE.md` in [HotLoop-io/HotLoop-io](https://github.com/HotLoop-io/HotLoop-io) with `scripts/sync-license.mjs`. CI regenerates it and fails the build if the committed page is stale.
- **The Flow pages** are written from Flow's README and its generated compatibility document, keeping to what those actually state.
- **Design tokens** are a vendored copy of `brand/tokens.css` in HotLoop-io/HotLoop-io. CI fetches the canonical file and fails the build if the two differ.
