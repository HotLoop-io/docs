---
title: "The logbook: what happened, in one list"
description: "State changes, writes, alarms, rule runs, scripts, recipes and config changes on one timeline, for the whole plant, one place on the tree, or one entity."
sidebar:
  label: "Logbook"
---

Zone 1 on the extruder tripped high at 03:12 and the morning shift walks in to the alarm. The first question after anything goes wrong is always "what happened just before?", and until now the answer was in five places: the write audit, the alarm history, the automation runs, the system log, and the memory of whoever was on nights, who is asleep. So you open four screens, line the timestamps up by hand, and still miss the one damn thing that mattered, because nothing anywhere recorded what the equipment itself did.

The logbook is those five in one list, newest first. The pump went on. Somebody wrote 180 to the zone 1 setpoint. The high temperature alarm was raised and acknowledged. The cooldown rule ran. A device got reconfigured. For the whole plant, for one place on the equipment tree and everything under it, or for one entity. One list instead of five screens and a phone call.

:::note[New in 4.17.0]
The logbook is new in 4.17.0. A 4.16.0 Gateway has nothing on this page, so [upgrade](/gateway/upgrading/) first. It records state changes from the first start on 4.17.0, and not one from before, because nothing kept them.
:::

## Where you find it

- **The Logbook tab.** The equipment tree on the left picks where (**Whole plant**, or any node and everything under it). Chips narrow it by kind, a box searches by who did it, and **Older entries** pages back. It updates live.
- **Every entity's drawer** has a Logbook section with its newest 20 lines, and **Open in the logbook** for the rest.
- **`GET /api/logbook`**, for scripts and anything else.
- **`get_logbook`** over [MCP](/gateway/mcp/), so an agent asked "why did line 3 stop?" reads the same timeline you do.

Reading it takes `logbook.read`, which every role holds, viewers included. The person asking what happened at 3 a.m. often isn't the one with the admin password, and reading history changes nothing.

## What's in it

| Kind | From | What a line says |
|---|---|---|
| `state` | `entity_state_log` | an entity's state changed: `changed to on (was off)` |
| `write` | `write_audit` | a write to a tag, written, refused or failed, by whom and through which door |
| `alarm` | `alarm_events` | an alarm raised, acknowledged, cleared or shelved, with the note given |
| `automation` | `automation_runs` | a rule ran, how it ended, what started it |
| `event` | `events` | configuration changes, service call summaries, and the reasons given for writes |
| `script` | `script_runs` | a [script](/gateway/scripts/) ran, how it ended, who started it and what called it |
| `recipe` | `recipe_applications` | a [recipe](/gateway/recipes/) was applied or refused: which version, by whom, how many targets went out and were read back |

Only `state` is new. The rest are read where they already live, at query time, and merged. Nothing is written twice, so the logbook can never disagree with the trail a line came from, and each trail keeps its own retention (below).

From the system log it takes the `config` category and the `write` category's own lines: service call summaries, alarm service calls, the reasons given for writes. The write gate's own "wrote ..." and "write of ... refused" lines are left out, because the write audit already says exactly that and every write would otherwise show up twice.

### What's deliberately not in it

- **Numeric readings.** A sensor, a loop or a PLC counter changes every poll, and every reading is already in the historian. Logging them again buries every line anybody wants under a million a day that nobody does. Trend them.
- **Buttons.** A button's state is the time of its last press, every press is already a write in the audit, and it resets to unknown on every restart, which would be a line per button per restart saying nothing.
- **Alarm entities' states.** The alarm's own history is already here as `alarm` lines, with more in them: the value, the note, who acknowledged.

Everything else is recorded: binary sensors, switches, text, selects, motors, valves, helpers and scripts.

**[Helpers](/gateway/helpers/) are logged by whoever changed them,** in the same transaction as the value, with who, from where and under which call id, and never rate-limited. The recorder leaves them alone: it only runs in the Gateway, so it would miss an agent's change through `--mcp-stdio`, and every process holding the helper sees the change, so it would log it once per process. A schedule is the exception, because nobody sets it and the clock moves it, so the recorder logs it like any other entity.

## Chatter

A limit switch bouncing at 10 Hz is one fact ("it chattered, this many times"), not thirty-six thousand lines an hour. Each entity gets ten changes straight through, then one every two seconds. A change past that isn't logged; it's counted on the entity's next line instead:

```
changed to closed (was open); 14 changes before this not logged, it was changing faster than the logbook records
```

The count is exact: the lines plus their counts are every change the entity made. When the chatter stops, the entity's final state is always logged within two seconds, so the logbook never ends on a state the equipment has already left. The number suppressed since start is `suppressed` under `logbook` in `/api/diagnostics`.

## last_changed survives a restart

An entity's state is computed from live tags, never stored, so before the logbook every restart made every entity look like it had just changed. A pump that had been running for days showed as just started every time the pod rolled, which is exactly the wrong thing to tell somebody chasing a fault. The logbook keeps every tracked entity's newest state and when it last changed (`entity_last_state`), and the entity engine reads it at start. An entity that comes back in the same state keeps its `last_changed`.

From the inside, a restart looks like this: a device isn't connected yet, so its entities go unavailable, then unknown, then show their reading. That's this process catching up, not the plant changing, so it's waited through. A state that really did change while the Gateway was down gets a fresh `last_changed` and a line saying what it was before. For the same reason, a change into unavailable or unknown is held back for the first minute after a start. A device still down after that is logged then, at the time it was first seen down.

## Filtering

| Filter | On the screen | `GET /api/logbook` | `get_logbook` |
|---|---|---|---|
| where | the tree | `equipment_id` | `equipment` (id, name or path like `Plant A/Packing`) |
| one entity | from its drawer | `entity` | `entity` |
| who | the search box | `actor` | `actor` |
| kinds | the chips | `kinds` (comma-separated or repeated) | `kinds` |
| when | newest first | `from`, `to` (RFC 3339; `from` inclusive, `to` exclusive) | `minutes` back, default 1440 (a day) |
| page size | 100 | `limit`, default 100, at most 1000 | `limit`, default 50, at most 1000 |
| next page | **Older entries** | `before`, the previous page's `next` | `before` |

**Where** turns a place into every name the trails know it by: the entities there (by their own place, else their device's, the same rule the Entities screen uses), the devices there and every tag on them, the alarms on those tags, the automations with a trigger on any of it, and the node itself for its configuration changes. An automation run also shows up in a place if it wrote there while it ran, whatever triggered it.

**Entity** is the same for one entity: its state changes, writes to it and its tags, its alarms, the rules it triggers or that wrote to it, and config changes to it or its tags. An entity deleted since is still found by the name it had.

**Who** is part of the actor, ignoring case: `alice`, `automation:cooldown` (the rule's runs and every write it made), or `mcp:` for everything any agent did. A state change the equipment made on its own has no actor.

```json
{"entries":[
  {"at":"2026-09-28T09:14:02.51Z","kind":"state","id":41,"severity":"info","message":"changed to on (was off)","entity_id":"switch.tank_farm_pump","old_state":"off","state":"on","quality":"good"},
  {"at":"2026-09-28T09:14:02.18Z","kind":"write","id":88,"severity":"info","message":"wrote true to tank-farm/pump (switch.turn_on on switch.tank_farm_pump) (was 0)","actor":"admin","source":"ui","entity_id":"switch.tank_farm_pump","device_id":"tank-farm","tag":"tank-farm/pump","call_id":"5c9f8545a93b5443"}
 ],
 "next":"MjAyNi0wOS0yOFQwOToxMzo0MC4wMlp8c3RhdGV8Mzc"}
```

Paging is by a cursor (the time, kind and id of the last line), so a page is never shifted by lines added since the one before it. `next` is left out on the last page. The API answers `400` for an unknown kind, a malformed time, `from` not before `to`, a limit over 1000, a made-up cursor, or `entity` and `equipment_id` together; `404` for a tree node that doesn't exist; `503` when the logbook isn't running in the process answering.

## Live updates

While somebody is watching, the live feed (`GET /api/stream`) looks at the trails once a second and sends a `logbook` event naming the kinds that have something new, like `{"kinds":["state","write"]}`. The screen then asks for its own page again, because what it should show depends on its filters. It watches the tables, not this process, so a write an agent makes through `--mcp-stdio`, which is another process entirely, shows up all the same. If you've paged back into older entries, the screen leaves you where you are instead of yanking the list out from under you.

## How long it keeps

`entity_state_log` is partitioned by month, in both history modes, and a month is dropped whole once every line in it is older than `HOTLOOP_LOGBOOK_RETENTION_DAYS`. **Default 90.** Dropping a month is instant; deleting its rows one by one is not, which is why it's partitioned. So a line is kept somewhere between 90 days and 90 days plus a month. `0` keeps everything, and the Gateway says so at startup, because the table then grows until the volume fills. A negative number refuses to start.

The logbook's own maintenance runs once at start and daily after. It makes last month's partition and the next three months' ahead of time, so a line always has somewhere to land. A line for a month with no partition lands in the default partition, and maintenance moves it into its month when it makes it (which is what happens after a restore) or deletes it once it's past retention.

The other trails keep what they always kept:

| Trail | Kept |
|---|---|
| `write_audit` | everything, until somebody trims it |
| `alarm_events` | everything, until somebody trims it |
| `automation_runs` | the newest 500 runs of each automation |
| `events` | the newest 100,000 lines |

So on a busy plant the logbook's writes and alarms go back further than its state changes, and its automation runs and config changes less far. The logbook shows what the trails have, and it won't pretend otherwise.

## One process records

The Gateway records. A second process started with `--mcp-stdio` reads the logbook and its baseline, so what it says about `last_changed` agrees with the Gateway, but it writes nothing and maintains nothing. Two recorders would log every change twice.

The recorder is a hook on the entity engine that only queues. Once a second, one goroutine turns the queue into lines, applies the rate limit, and writes them with one `COPY` and one upsert of the newest states, in one transaction. The queue holds 50,000 changes; past that the oldest are dropped and counted, rather than the heap growing until the pod gets killed. A database that's down keeps lines queued, up to the same limit, and they go in when it's back. It all shows in `/api/diagnostics` under `logbook`:

```json
{"recording":true,"retentionDays":90,"queued":0,"dropped":0,"written":212,"suppressed":36,"writeErrors":0}
```

`dropped` above zero means changes are missing from the logbook. `queued` that keeps climbing means the database isn't keeping up. `lastError` says why the last write failed. If `dropped` ever moves, the logbook has a hole in it, and you want to know that before somebody leans on it in an incident review.

Both tables are in every backup: `entity_last_state` after the entity tables, `entity_state_log` just before `tag_history`.

## What's verified

The logbook is tested against the real thing, because a logbook is only worth something if what it says happened is what happened, and a mock plant would only prove it agrees with the mock. The tests run a real PostgreSQL database in both history modes, a Modbus server running inside the test process whose coils and registers the real runtime polls, and the real alarm and automation engines. Proven there:

- a chattering coil is rate-limited and every one of its changes is counted
- `last_changed` survives a restart, and a device still down after the one-minute grace is logged in order
- the recorder is off in an `--mcp-stdio` process, and a helper change is logged once, by whoever made it
- partitions are made ahead and dropped past retention
- the filters find every trail by tree node and by actor, the cursor pages through every trail, and it all works over the simple query protocol
- over HTTP, and in headless Chrome: the Logbook screen narrows by tree node, a change on the device appears without a reload, and the entity drawer shows the same timeline for its one entity

Not verified: no plant has run it, because no release carries it. The backup round-trip test covers TimescaleDB mode only, for these tables as for every other.
