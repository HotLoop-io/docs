---
title: "Node-RED compatibility: flows.json and nodes"
description: "What loads byte for byte, what's refused, and where each of Flow's 51 node types stands against Node-RED: full, partial, divergent or Flow-only."
sidebar:
  label: "Compatibility"
---

## Your flow files load byte for byte

A `flows.json` v1 file loads and saves **byte for byte**. Load a file Node-RED wrote, save it without editing anything, and you get identical bytes back: same key order, same whitespace, no escapes "helpfully" rewritten. Edit one property and the diff is one line, not the whole node.

That was harder in Go than it sounds. A JavaScript object keeps keys in insertion order, so Node-RED gets this for free. A Go map has no order at all, and `encoding/json` sorts keys on purpose. So Flow keeps each entry's original bytes and hands them back untouched when nothing changed, and re-encodes against the original key order when something did.

Two reasons this matters, neither of them glamorous. Your flow file lives on a volume and in git, and it shouldn't churn because a pod restarted. And an operator reviewing a deploy diff before it goes to a line should see the change and nothing but the change.

A node type this build has never heard of survives a load and save with every property intact, so it's safe to run a Node-RED flow here and hand it back afterwards. Node-RED's `flows_cred.json` imports read-only, and anything read that way is re-encrypted under AES-256-GCM on the next save. [Migrating from Node-RED](/flow/migrating-from-node-red/) has how.

## Ask it what will happen before you deploy

```bash
hotloop-flow import flows.json
```

No binary on your machine? The image carries it:

```bash
podman run --rm -v "$PWD/flows.json":/flows.json:ro,Z \
  ghcr.io/hotloop-io/hotloop-flow:2.0.5 import /flows.json
```

It lists every node type in the file, subflow internals included, in three groups: supported, partially supported with each node's note printed under it, and not supported, which means those nodes won't start. The rest of the flow still runs. A deploy works the same way: a broken node gets reported and logged and every other node runs, because one typo in one dialog shouldn't stop a line when the other 40 nodes are fine.

Subflow internals are counted against the expanded graph, not the file, so a subflow can't hide an unsupported node inside an instance that looks supported. Better the report tells you than the line does.

## The four levels

Every node type carries one of four levels, and a test fails the build if a node that's anything short of full doesn't say in writing what's different.

| Level | Meaning |
|---|---|
| **full** | Behaves as the Node-RED node of the same type does. |
| **partial** | A subset. The notes say exactly which parts are missing. |
| **divergent** | Deliberately behaves differently. The notes say why. |
| **Flow-only** | No Node-RED counterpart. |

Of the 51 node types, 10 are full, 26 are partial, 9 are divergent, and 6 are Flow-only. The complete, filterable list with every note is on the [integrations page](https://hotloop.io/integrations/#flow-nodes). It's generated from the node registry, not maintained by hand, because a list somebody updates by hand is wrong the day after they stop.

Why the test exists: a node that does 90% of the job and keeps quiet about the other 10% is worse than one that isn't there at all. The missing one fails loudly. The silent one lets the flow look like it works while it quietly does the wrong thing.

Watch one Flow-only node in particular. `influxdb out` uses the same type name as the community `node-red-contrib-influxdb` node, so an imported flow finds it, but its configuration isn't identical. Check its fields after you import, before you trust what lands in the bucket.

## Not supported at all

**Node-RED community nodes.** They're npm packages that need Node.js, and no future release is going to change that. It's the price of the small image and the sandbox, and if your flows live on community nodes, it may be a price you shouldn't pay.

**JSONata expressions.** Any property typed `jsonata` is refused with an error, not ignored. Returning the expression text instead would make a flow look like it works while it routes on a literal string.

**Link Call, and Link Out's "return" mode.** Both are refused with an error rather than silently doing nothing.

## Node type names in your files

Two of Flow's own node types, the InfluxDB and PostgreSQL connection nodes, carry the product name in their type string, because that string gets saved inside your flow file: `hotloop-flow-influxdb` and `hotloop-flow-postgres`. They've been named that since 2.0.0. A flow saved by Emberwire 0.1.0 has the old `emberwire-` types, which 2.x won't find, and `hotloop-flow import` lists them as not supported.
