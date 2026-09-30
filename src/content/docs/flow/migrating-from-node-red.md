---
title: "Migrating from Node-RED to HotLoop Flow"
description: "Move a Node-RED flow to HotLoop Flow in the right order: ask what breaks, fix what's refused, bring the file and credentials over, then run both side by side."
sidebar:
  label: "Migrating from Node-RED"
---

Flow reads Node-RED v1 flow files, so a migration starts with the file you already have, and nobody loses a year of flows because the runtime changed underneath them. This page is the order to do it in, worst surprises first.

:::note[Coming from Emberwire instead?]
Flow was Emberwire 0.1.0 before 2.0.0, and that's a different move with its own breaks. See [Coming from Emberwire 0.1.0](/flow/install/#coming-from-emberwire-010).
:::

## 1. Ask it what will happen

Before you deploy anything, run the `import` subcommand against your `flows.json`:

```bash
podman run --rm -v "$PWD/flows.json":/flows.json:ro,Z \
  ghcr.io/hotloop-io/hotloop-flow:2.0.5 import /flows.json
```

It lists every node type in the file, subflow internals included, as supported, partially supported with each node's note printed under it, or not supported. Read the not-supported group first: those nodes won't start. The rest of the flow will.

## 2. Fix what won't load

These are refused with an error, never quietly ignored:

- **Node-RED community nodes.** They're npm packages that need Node.js, and they will never work here. Rebuild that part from built-in nodes, or leave it on Node-RED.
- **JSONata expressions.** Any property typed `jsonata` is refused, so a node that uses one errors on every message. It's the thing imported flows trip over most, so count them first: `grep -o jsonata flows.json | wc -l`. Most of them turn into Change or Switch rules, or a few lines in a Function node.
- **Link Call, and Link Out's "return" mode.** Both refused with an error rather than silently doing nothing.

These load, but don't do everything yet:

- **Cron-style Inject.** Interval and on-startup injection work. "At a specific time, on these days" doesn't, and `crontab` is ignored, so a cron-scheduled Inject loads without complaint and never fires on schedule. That's the dangerous kind, because nothing errors.
- **Function nodes.** They run on goja, not Node: ES2023 JavaScript, but no Node standard library, no `require()`, no npm modules, and no `setTimeout` or `setInterval`. Use a Delay or Trigger node for timing, which the runtime can actually account for. Every call also gets a 5 second limit, which Node-RED leaves off.
- **HTTP In and HTTP Response.** A multipart upload arrives as raw bytes, not `msg.files`. `msg.cookies` does nothing, so set a `Set-Cookie` header instead.
- **`influxdb out`.** Same type name as the community `node-red-contrib-influxdb` node, so your flow finds it, but the configuration isn't identical. Check its fields before you trust what lands in the bucket.

## 3. Read the notes for every node you use

Every node type that isn't fully compatible says what's different. Look up each type your flow uses in the [node list](https://hotloop.io/integrations/#flow-nodes) and read the note. The partially compatible node you didn't read about is the one that quietly does the wrong thing.

## 4. Expect these differences, which are deliberate

| Area | Node-RED | Flow |
|---|---|---|
| Message cloning | The first recipient on a wire gets the original | Every recipient gets its own copy |
| Queues | Unbounded | Bounded, with a policy per node |
| `exec` node | Any command, through a shell | Disabled until allowlisted, and no shell at all |
| File nodes | Any path the process can reach | Scoped to the data volume, symlinks resolved |
| Authentication | Off by default | It refuses to start without it |
| Credentials | AES-256-CTR, SHA-256 as the key | AES-256-GCM, Argon2id |
| Configuration | `settings.js`, executable JavaScript | Declarative YAML, unknown fields rejected |
| Context store | Memory, or a file-backed store | Memory only, for now |
| Redeploy | Can restart only what changed | Restarts every node, for now |

The last two rows are the biggest runtime gaps, and they'll bite a migrated flow before anything else does. Every deploy drops and reconnects every MQTT session, and a Delay node holding messages lets them go early. And context is gone on every restart, so a counter or a latch kept in flow or global context resets whenever the pod moves. If a flow depends on either, plan for it now, not after the first mid-shift deploy.

The queue and cloning differences are explained on [Back-pressure and bounded queues](/flow/back-pressure/), and the security ones on [Security posture](/flow/security/).

## 5. Bring the file across

Two ways in. On Podman or Quadlet, drop your `flows.json` into the data directory (`/data` in the container, or wherever `HOTLOOP_FLOW_DATA_DIR` points) and restart. If your old Node-RED saved it as `flows_<hostname>.json`, rename it, or set `HOTLOOP_FLOW_FLOW_FILE`.

On the Helm chart there's no shell in the pod to copy a file with, so deploy it through the API, with an account that has `flows.write` and the port-forward from [the install page](/flow/install/#helm) running:

```bash
TOKEN=$(curl -s -X POST http://localhost:1880/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<the password>"}' | jq -r .access_token)
curl -s -X POST http://localhost:1880/flows \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @flows.json
```

The answer carries `rev`, `warnings` and `failures`. Any node that couldn't start is listed in `failures` with its error, and everything else is already running.

Either way, your file isn't rewritten on load, and a save with no edits gives you identical bytes back, so the migration doesn't bury your git history in reformatting.

### Credentials

Copy Node-RED's `flows_cred.json` into the data directory as `credentials.json`, and set `HOTLOOP_FLOW_CREDENTIAL_SECRET` to the `credentialSecret` Node-RED used. If you never set one, Node-RED generated it and keeps it in `.config.runtime.json` in its user directory, as `_credentialSecret`. Flow reads the old format once, read-only, and re-encrypts everything under AES-256-GCM on the next save. Get the secret wrong and it refuses to start and says so, rather than coming up with every broker password missing.

On the Helm chart, setting `hotloopFlow.credentialSecret` at install makes the chart use it instead of generating one. But with no shell in the pod, there's no easy way to get the old file onto the volume, so re-entering the credentials in the editor is usually faster.

## 6. Run it next to the old one

Flow has never run on a real plant floor. It's been verified against Mosquitto, InfluxDB 2.7 and PostgreSQL 16, and its race detector is clean, but a flow that controls something real deserves the same commissioning you'd give any new runtime. Run it beside Node-RED first and compare what comes out.

Point the new copy's outputs somewhere harmless while you do, a different bucket, table or topic. Two runtimes subscribed to the same broker and writing to the same database will both write every reading, and you'll spend next week deduplicating your historian.
