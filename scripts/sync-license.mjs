// Builds src/content/docs/licensing.md from the canonical LICENSE.md in
// HotLoop-io/HotLoop-io, so the legal text on this site cannot drift from the
// source of truth.
//
//   node scripts/sync-license.mjs <path to HotLoop-io/HotLoop-io/LICENSE.md>
//
// The plain-language summary above the legal text is written here, and only the
// legal text below it is copied.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/sync-license.mjs <LICENSE.md>'); process.exit(1); }

const legal = readFileSync(src, 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/^# .*\n+/, '')                 // the page supplies its own title
  .replace(/^## /gm, '### ')               // nest under this page's section heading
  .trim();

if (/—/.test(legal)) { console.error('the license text contains an em-dash; it is legal text, so decide by hand'); process.exit(1); }

const page = `---
title: "HotLoop licensing: Gateway and Flow"
description: HotLoop is two products with two licenses. Gateway is free for individuals, with business use through Embernet. Flow is Apache-2.0, free for everyone.
sidebar:
  label: Licensing
---

Two products, licensed separately on purpose. Which license applies depends on the product, and for the Gateway, on who is running it.

| Product | Who | Cost | How to get it |
|---|---|---|---|
| HotLoop Gateway | Individual, home, hobbyist, nonprofit, or education | Free | Self-host directly, no agreement needed |
| HotLoop Gateway | Any business or for-profit use, internal or customer-facing | Through Embernet | Exclusively through [Embernet](https://embernet.ai) |
| HotLoop Flow | Anyone, including businesses and commercial use | Free | Self-host directly under Apache-2.0, no agreement needed |

## HotLoop Flow is Apache-2.0

Flow is licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0), which is an OSI-approved open source license with no business-use restriction. A business can run it, modify it, and ship it commercially without asking anyone, and it does not need Embernet or anybody else's permission.

## HotLoop Gateway is source-available

The Gateway is under the HotLoop Community License. It is source-available, and it is **not** an OSI-approved open source license, because it restricts business use. Individuals get it free, and any business that wants it goes through our partner [Embernet](https://embernet.ai), which provides the support, the SLAs, and the warranty.

### A few concrete situations

| Situation | Cost |
|---|---|
| Automating your own house | Free |
| A hobby project you are building for fun | Free |
| A class project or a student lab | Free |
| A local nonprofit running it in their own space | Free |
| Running it inside a company, internal only, no customers touching it | Through Embernet |
| Deploying it as part of a product or service you sell | Through Embernet |
| A landlord automating a rental property they operate as a business | Through Embernet |
| A contractor installing and managing it for paying clients | Through Embernet |

Genuinely unsure which side of the Gateway line you are on? Ask before you build a whole setup on a bad assumption. Email [support@hotloop.io](mailto:support@hotloop.io), or go straight to Embernet if it looks like a business case.

## One note on history

Container images for earlier versions of what is now HotLoop Gateway, versions 4.0.0 through 4.3.1, were published publicly under Apache-2.0, along with the Helm chart packages released beside them. They remain available, and they remain under Apache-2.0. The HotLoop Community License applies to the Gateway from its first release under the HotLoop name onward. HotLoop Flow, first published as Emberwire, has been Apache-2.0 the whole time and is not changing.

## The legal text

The summary above is plain language. The text below is what actually decides things, and it wins every argument, including this one. It is mirrored here from [HotLoop-io/HotLoop-io](https://github.com/HotLoop-io/HotLoop-io/blob/main/LICENSE.md), which is the canonical copy.

## HotLoop Community License, Version 1.0

${legal.replace(/^\*\*Version 1\.0, 2026\*\*\n+/, '')}
`;

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/content/docs/licensing.md');
writeFileSync(out, page);
console.log(`wrote ${out}`);
