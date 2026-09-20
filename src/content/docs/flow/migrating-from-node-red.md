---
title: "Migrating from Node-RED to HotLoop Flow"
description: How to move an existing Node-RED flow to HotLoop Flow, what will not load, and what behaves differently on purpose.
sidebar:
  label: "Migrating from Node-RED"
---

Flow reads Node-RED v1 flow files, so migrating starts with the file you already have. This page is the order to do it in, and the things worth knowing before you deploy.

:::note
Flow was published as Emberwire, in version 0.1.0, and is HotLoop Flow now. The steps below do not depend on the name, and commands and image names will be added here once the first release under the new name is out.
:::

## 1. Ask it what will happen

Before you deploy anything, run the `import` subcommand against your `flows.json`. It reports every node type in the file, including the ones inside subflows, split into supported, partially supported with the gap spelled out, and not supported at all.

Subflow internals are counted against the expanded graph, so an instance is never reported as "supported" while the report stays silent about what is inside it.

## 2. Know what will not load

These are refused, with an error, and never silently ignored:

- **Node-RED community nodes.** They are npm packages that need Node.js, and there is no version of this where they work.
- **JSONata expressions.** Any property typed `jsonata` is refused. Refusing beats returning the expression text and letting a flow route on a literal string, but it is also the most common thing an imported flow trips over, so check for it first.
- **Link Call, and Link Out's "return" mode.** Both are refused with an error rather than silently doing nothing.

These load but do not do everything yet:

- **Cron-style Inject scheduling.** Interval and startup injection work. "At a specific time, on these days" does not, and `crontab` is ignored.
- **Multipart uploads on HTTP In, and cookies on HTTP Response.** Not implemented in this build.

## 3. Read the partial and divergent notes for your nodes

Every node type that is not fully compatible says what is different. Look up each type your flow uses in the [node list](https://hotloop.io/integrations/#flow-nodes), and read the note. A partially compatible node that you did not read about is the one that quietly does the wrong thing.

## 4. Expect these differences, which are deliberate

| Area | Node-RED | Flow |
|---|---|---|
| Message cloning | The first recipient on a wire gets the original | Every recipient gets its own copy |
| Queues | Unbounded | Bounded, with a policy per node |
| `exec` node | Any command, through a shell | Disabled until allowlisted, and no shell at all |
| File nodes | Any path the process can reach | Scoped to the data volume, symlinks resolved |
| Authentication | Off by default | It refuses to start without it |
| Credentials | AES-256-CTR, SHA-256 as the key | AES-256-GCM, Argon2id |
| Configuration | `settings.js`, executable JavaScript | Declarative YAML |
| Redeploy | Diffs, and restarts only what changed | Restarts every node, for now |

The last row is the largest remaining runtime gap. If a flow holds state in memory across a redeploy, plan for that.

The queue and cloning differences are explained on [Back-pressure and bounded queues](/flow/back-pressure/), and the security ones on [Security posture](/flow/security/).

## 5. Bring the file across

Drop your `flows.json` into the data directory and restart, or build the flow in the editor. Your file is not rewritten on load, and a save with no edits gives you identical bytes back, so a migration does not touch your git history with reformatting.

Node-RED's `flows_cred.json` imports read-only, and anything read that way is re-encrypted under AES-256-GCM on the next save.

## 6. Check it under real conditions

Flow has never run on a real plant floor. It has been verified against MQTT, InfluxDB 2.7, and PostgreSQL 16, and its race detector is clean, but a flow that controls something real deserves the same commissioning discipline you would give any new runtime. Run it beside the old one first.
