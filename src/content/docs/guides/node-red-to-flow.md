---
title: "Migrate from Node-RED to HotLoop Flow"
description: "Move a Node-RED flows.json to HotLoop Flow in six steps: run the import report, read the gaps, handle community nodes and credentials, then deploy."
sidebar:
  label: "Node-RED to Flow"
---

You built it in Node-RED and it works. Here is how to run the same flows.json in HotLoop Flow, and how to find what will not carry over at your desk, before a line finds it for you.

## 1. Take the flows file

Flow reads Node-RED's v1 `flows.json`, the flat JSON array that every Node-RED export and flow library entry is written in. It loads and saves byte for byte, so the file you put in git does not churn when a pod restarts, and a one-property change is a one-line diff.

## 2. Run the import report

```bash
hotloop-flow import flows.json
```

The report lists every node type in the file, including the ones inside subflows, split into supported, partially supported with the gap spelled out, and not supported at all. A node that points at a config node that is not in the file, or at one of the wrong kind, is named with the id it could not find.

## 3. Read the gaps against the compatibility matrix

Every node says how close it is to Node-RED's node of the same name: full, partial, divergent, or Flow only. A test fails the build if a node claims partial compatibility without writing down what is missing. The whole matrix is [Node-RED compatibility](/flow/compatibility/).

The divergences are deliberate. Every recipient on a fan-out gets its own copy, the `exec` node has an allowlist and no shell, the file nodes are scoped, and every queue has a ceiling, as [Back-pressure, visibly](/flow/back-pressure/) explains.

## 4. Decide about community nodes

Most Node-RED community nodes do not run in Flow, because they are npm packages that need Node.js. The ones a plant leans on do: Flow runs the Node-RED Modbus, dashboard, PostgreSQL, and e-mail types natively, in Go, under their own type names, so a flow that uses them loads and runs unchanged. Any other community node fails by itself with its type named, and the rest of the flow starts. For what you write yourself, [signed WebAssembly plugins](/flow/plugins/) take the place of an npm package.

## 5. Bring the credentials

Node-RED's `flows_cred.json` imports read-only, and anything read that way is re-encrypted under authenticated encryption the next time you save. Set the admin account and credential secret Flow insists on before first start, as the [quick start](/flow/quick-start/) shows.

## 6. Check what trips flows up, then deploy

- **Schedules.** Inject on a crontab fires on the same minute Node-RED's would, checked against 22,620 firings across six time zones, either side of real clock changes.
- **JSONata.** Flow's own engine passes 1,673 of the 1,686 published test cases. The 13 misses are pinned in a test with the reason for each, and `$moment` tells you what to use instead of failing quietly.
- **Link Call.** It works, with Link Out's return mode.

Then deploy. The deploy shows the change on the canvas and in words, asks for a note, and keeps a record you can diff and roll back. [Bring your Node-RED flows](/flow/migrating-from-node-red/) has the long form of every step, and [Install HotLoop Flow](/flow/install/) gets a runtime running.
