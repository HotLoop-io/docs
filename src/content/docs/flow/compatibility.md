---
title: "Node-RED compatibility: flows.json and nodes"
description: What loads, what loads byte for byte, what is refused, and how each of the 51 node types compares to Node-RED.
sidebar:
  label: "Compatibility"
---

## Your flow files load byte for byte

A `flows.json` v1 file loads and saves **byte for byte**. Load a file Node-RED wrote, save it without editing anything, and you get identical bytes back: same key order, same spacing, no helpfully rewritten escapes. Edit one property and the diff is one line, not the entire node.

That matters for two reasons, both boring and both real. Your flow file lives on a volume and in git, and it should not churn just because a pod restarted. And when an operator reviews a deploy diff before pushing it to a line, they should see what changed and absolutely nothing else.

A node type this build has never heard of survives a load and save with every property intact, so it is safe to run a Node-RED-authored flow here and hand it back afterwards. Node-RED's `flows_cred.json` imports read-only, and anything read that way is re-encrypted under AES-256-GCM on the next save.

## Ask it what will happen before you deploy

Flow has an `import` subcommand that reports what would happen before anything is deployed. It lists every node type in the file, including the ones inside subflows, split into three groups: supported, partially supported with the gap spelled out, and not supported at all.

Subflow internals are counted against the expanded graph rather than the file, so an instance never gets reported as "supported" while staying silent about what is inside it. That is the difference between finding out now and finding out when a line stops.

## The four levels

Every node type is labeled with one of four levels, and a test fails the build if a node that is anything short of full does not say what is different.

| Level | Meaning |
|---|---|
| **full** | Behaves as the Node-RED node of the same type does. |
| **partial** | A subset. The notes say exactly which parts are missing. |
| **divergent** | Deliberately behaves differently. The notes say why. |
| **Flow-only** | No Node-RED counterpart. |

Of the 51 node types, 10 are full, 26 are partial, 9 are divergent, and 6 are Flow-only. The complete, filterable list is on the [integrations page](https://hotloop.io/integrations/#flow-nodes).

The reasoning behind that test is worth stating: a node that is partially compatible and silent about how is worse than one that is obviously absent, because the flow appears to work and quietly does the wrong thing.

## Not supported at all

**Node-RED community nodes.** They are npm packages that need Node.js, and there is no version of this where they work.

**JSONata expressions.** Any property typed `jsonata` is refused with an error rather than ignored. Returning the expression text would make a flow appear to work while routing on a literal string.

## Node type names in your files

Two of Flow's own node types, the InfluxDB and PostgreSQL connection nodes, carry the product's original name in their type string, because that string is stored inside a saved flow file. They are shown exactly as they appear in a flow.
