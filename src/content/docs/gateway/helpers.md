---
title: "Helpers: values the plant's people own"
description: "Toggles, numbers, choices, text, counters, timers and schedules that HotLoop keeps instead of a PLC. Refused, never clamped, and kept across restarts."
sidebar:
  label: "Helpers"
---

"Line 2 is in changeover." "Today's batch target is 1,250 kg." "B shift is on." "Twelve parts scrapped since the last reset." "The purge has nine minutes left." None of that lives in a PLC register, and every rule and screen on the plant needs to know it.

So today it lives on a whiteboard, a clipboard, or a spare register somebody borrowed in the PLC with a comment that says don't touch. The rules can't read the whiteboard, and when the batch target changes, the whiteboard sure as hell can't tell you who changed it, when, or why. That's how a whole shift runs the wrong target and nobody finds out until the scale does.

A helper is that value, kept by HotLoop. It's an entity like any other: an `entity_id`, a state, attributes, services, a place on the equipment tree. It shows up in `/api/states`, on the Entities screen, in `list_entities` over MCP, and in a rule's state trigger. The difference is where the value lives: in HotLoop's database, with a line in the system log for every change. **No helper service ever writes a tag.**

:::note[New in 4.17.0]
Helpers are new in 4.17.0. A 4.16.0 Gateway has nothing on this page, so [upgrade](/gateway/upgrading/) first. Know that the operator role gets `helpers.write` the moment you do, so your operators can set helpers straight away.
:::

## The seven kinds

| Domain | State | Options | Services |
|---|---|---|---|
| `input_boolean` | `on` or `off` | `initial` (true or false), `restore` | `turn_on`, `turn_off`, `toggle` |
| `input_number` | the number, like `"1250"` | `min` and `max` (both required), `step` (default 1), `mode` (`slider` or `box`), `initial` (default `min`), `restore`, and a `unit_of_measurement` beside the options | `set_value {value}`, `increment`, `decrement` |
| `input_select` | the choice | `choices` (required, up to 100), `initial` (default the first choice), `restore` | `select_option {option}`, `select_next {cycle}`, `select_previous {cycle}` |
| `input_text` | the text | `max_length` (1 to 255, default 255), `pattern`, `initial` (default empty), `restore` | `set_value {value}` |
| `input_counter` | a whole number | `initial` (default 0), `step` (default 1), `min`, `max`, `restore` | `increment`, `decrement`, `reset`, `set_value {value}` |
| `timer` | `idle`, `active` or `paused` | `duration_sec` (required, 1 second to 7 days), `restore` | `start {duration}`, `pause`, `cancel`, `finish` |
| `schedule` | `on` or `off` | `schedule` (required) | none, it follows the clock |

The counter is `input_counter`, not `counter`. `counter` is already the PLC composite whose reset writes a tag, and a scrap tally that shares a name with something that commands a PLC is an incident report waiting to be written.

Every option is checked when the helper is saved, and `initial` against all the others. An `input_number` from 0 to 100 that starts at 150 is refused, not started at 100. An option a domain doesn't take is an error, not a setting quietly ignored, and so is a misspelled one, so a typo in `max` never turns into a counter with no ceiling.

## Making one

Making, changing and deleting helpers is configuration, so it takes `entities.write`, which only an admin holds. On the Entities screen, press **New helper** (next to New equipment), pick the kind, fill in the form. A schedule's blocks go in one line per day, like `06:00-14:00, 22:00-06:00`; block `data` needs the API.

```
POST /api/helpers
{"name": "Batch target", "domain": "input_number", "unit_of_measurement": "kg",
 "options": {"min": 0, "max": 5000, "step": 50, "initial": 1000}}
```

The `entity_id` is made from the name (`input_number.batch_target`, then `_2`, `_3` if that's taken) unless you give one. Give one that's taken and you get a `409`, not a renamed helper you didn't ask for.

| Method | Path | Permission | Does |
|---|---|---|---|
| `GET` | `/api/helpers` | `entities.read` | every helper, with the stored value (`changed_by`, `source`, `call_id`, `rev`) |
| `POST` | `/api/helpers` | `entities.write` | create one at its initial value |
| `GET` | `/api/helpers/{entity_id}` | `entities.read` | one helper |
| `PUT` | `/api/helpers/{entity_id}` | `entities.write` | name, icon, unit, options, `disabled`, `hidden`, `entity_id`, `equipment_id`, `labels` |
| `DELETE` | `/api/helpers/{entity_id}` | `entities.write` | the helper and its value |
| `POST` | `/api/services/{domain}/{service}` | `helpers.write` | set it |

A change of options that would leave the current value outside them is a `400`: a range narrowed past the value, or the selected choice removed. Set the value first, or pick options that include it. A value is never moved to fit. `DELETE /api/entities/{entity_id}` refuses a helper with a `409` that points you at `/api/helpers`.

## Setting one

Setting a helper takes `helpers.write`. Operators hold it and viewers don't, because running the shift selector and counting scrap is operating the plant, not configuring it. It isn't `values.write` either, because no tag moves. For the same reason, writes being off (`safety.allowWrites`) doesn't stop an operator setting a helper.

It's an entity service call, the same call every other entity takes:

```
POST /api/services/input_counter/increment   {"entity_id": "input_counter.scrap", "reason": "short shot"}
POST /api/services/timer/start               {"entity_id": "timer.purge", "duration": "0:15:00"}
```

The answer says what the helper is now, and `writes` is empty because nothing went to a device:

```json
{"call_id":"0f3c2a1b9d8e7f60","entity_id":"input_number.batch_target","service":"input_number.set_value","writes":[],"state":"1250"}
```

`?dry_run=true` answers in the same words the real call would, and changes nothing. A timer's `duration` is a number of seconds (to the millisecond) or `H:MM:SS`. Service data is read strictly: `"50"` where a number goes is a `400`, because reading it as fifty would be a guess.

On the Entities screen every helper gets its own tile, with its controls for whoever holds `helpers.write`. Every change is confirmed first, with a reason, like every other command. A running timer's tile counts down on the screen's own clock.

**From MCP there's no new tool.** `list_entities` finds helpers, `get_states` reads them, and `call_service` sets them, with its required `reason`. An agent changes a helper only on a deployment with `HOTLOOP_ALLOW_WRITES` and `HOTLOOP_ALLOW_MCP_WRITES` both on, the same two switches a tag write needs. A helper moves no equipment, but it's what rules act on, and an agent flipping the changeover switch is an agent starting whatever the changeover rule does.

## In automations

A helper is what rules act on and what rules set. Flip changeover on, and line 2's speed setpoint goes to 0:

```json
{"triggers": [{"type": "state", "entityId": "input_boolean.changeover", "to": "on"}],
 "actions": [{"type": "call_service", "params": {"entityId": "number.line_2_speed_sp",
   "service": "number.set_value", "data": {"value": 0}}}]}
```

The helper only decided that it should happen. The rule's write to the tag goes through the [write gate](/gateway/write-gate/) like any other, audited as `automation:<rule-id>`, so a changeover switch can't move anything an operator couldn't. A rule sets a helper with `call_service` exactly the way it sets a switch.

In a condition, `states['input_select.shift'] == 'B'` works. Every state is a string, so compare a number as one: `float(states['input_number.batch_target']) >= 1000`. A schedule's block data is in its attributes, so `attrs['schedule.shifts']['crew'] == 'B'` works too. See [Automations](/gateway/automations/) for the rest of the language.

A timer finishing is a state trigger: `{"type": "state", "entityId": "timer.purge", "from": "active", "to": "idle"}`. Two edges to know. `finish` and `cancel` land on `idle` too, so by state alone a rule can't tell a purge that ran out from one somebody cancelled. And a timer that ran out while HotLoop was down never fires it (see below).

## Refused, never clamped

A value a helper won't take is refused, and nothing changes. "Stopped at the limit" is a value nobody asked for, and on a plant the value nobody asked for is the one that ends up in a batch record.

- a number outside `min` to `max`, or off its `step` (counted from `min`)
- an `increment` that would pass `max` or a `decrement` that would pass `min`: refused, not stopped at the limit
- an option that isn't one of the choices, or `select_next` past the last choice with `cycle: false` (`cycle` defaults to true)
- text longer than `max_length`, or not matching `pattern` (the whole text has to match)
- a count that isn't a whole number, or past the counter's `min` or `max`
- a timer paused when it isn't running, cancelled or finished when it's idle, or started for less than a second or more than seven days
- a disabled helper, a caller without `helpers.write`, an agent with MCP writes off

A value refused on its merits answers `422`, a timer in the wrong state `409`, a permission or a switch `403`. Every refusal is a warning in the system log (`GET /api/events`) against the helper, with who asked and why it was refused. A broken request (a field the service doesn't take, a string where a number goes) is a `400` and records nothing, because it never got as far as asking the helper.

## Where every change goes

Every change is one line in the system log, written in the same transaction as the value, so there's never a change without its line or a line without its change:

```
otto   input_counter.increment: 12 -> 13; reason: short shot
system timer finished: active -> idle, due at 2026-09-27T21:10:00Z
```

A change of state is also a line in the [logbook](/gateway/logbook/), in that same transaction, with the same who, source and call id. It's written by whichever process made the change, so an agent's change through `--mcp-stdio` is logged too, and logged once. Helper lines are never rate-limited: every one is somebody deciding something. A call that leaves the state where it was (a number set to the value it already has) is in the system log but not the logbook, because nothing changed.

## Restarts and timers

A helper keeps its value across a restart: the Gateway comes back with the shift still B and the counter still 13. Set `restore: false` on one that should start fresh (a "since the last restart" counter), and the Gateway puts it back to its initial value as it starts, and logs that it did. Only the Gateway does that. A second process started with `--mcp-stdio` holds the same helpers and hears every change, but never resets anything, because wiping the plant's values because an agent connected would be absurd.

A timer runs on the wall clock. Started for ten minutes, it finishes ten minutes later whatever happens in between: a restart that took two minutes leaves it eight to run. A paused timer stays paused, with what it had left, across any number of restarts. `start` on a paused timer resumes it; `start` with a `duration` runs for that; `start` on a running timer starts it over. The attributes carry `finishes_at` (the screen counts down to it; nothing sends a new state every second), `remaining` while paused, and `duration`.

**A timer that ran out while no HotLoop was running** comes back `idle`, with `finished_late_at` set to when it was due and a warning in the log. **Nothing fires for it.** The engine's first look at it after a start is a baseline, not a change, so the rule waiting on it doesn't run. Whatever it was timing, a purge or a cure, happened long ago or not at all, and doing it now, late and unasked, is worse than saying it was missed. Look for `finished_late_at` and decide like an adult.

A timer is not an interlock. It runs on a process's clock, through a database and a network, to the second and usually the millisecond. Anything that must stop on time belongs in the PLC.

## Schedules

A schedule is on inside its blocks and off outside them:

```json
{"schedule": {
  "mon": [{"from": "06:00", "to": "14:00", "data": {"crew": "A"}},
          {"from": "14:00", "to": "22:00", "data": {"crew": "B"}}],
  "fri": [{"from": "22:00", "to": "06:00", "data": {"crew": "C"}}]
}}
```

- Days are `mon` to `sun`. A time is `HH:MM` or `HH:MM:SS`, and `24:00` is the end of a day, so a whole day is `00:00` to `24:00`. A block that starts and ends at the same time is refused.
- A block whose `to` is earlier than its `from` runs past midnight: Friday's 22:00 to 06:00 is on until Saturday 06:00.
- Blocks that touch are one stretch of on. Blocks that overlap are refused, because which one's data applies would be a guess.
- While a block is on, its `data` is in the entity's attributes (`crew: "B"`), and `next_event` always says when the schedule next changes. Data values are numbers, bools or strings, and can't reuse the entity's own attribute names.
- It's read on the wall clock in the site's timezone, `HOTLOOP_TIMEZONE` (or `TZ` when that's unset, else UTC). A shift that starts at 06:00 starts at 06:00 on the day the clocks change too. The night they go forward, the hour that doesn't happen isn't on; the night they go back, the hour that happens twice is on both times. The Timezone on the Settings screen changes how times are displayed, not this.

## More than one process, and backups

Every change is announced with Postgres `NOTIFY`, and every process holding the helpers listens. A helper set in one process shows its new value in every other within a round trip, and one created, deleted or changed through `PUT /api/helpers/{entity_id}` appears, goes or changes in the others the same way. Every write is conditional on the row's revision, so two processes counting the same counter at once never lose a count, and a timer both hold is finished by exactly one of them.

Helpers are in every backup: their configuration with the entities, their values in `helper_state`, revisions included. A restored plant comes back with the shift, the targets and the counts it had, and a timer that was running is still running on the wall clock (or idle and marked late, if it ran out in the meantime).

## What's verified

The helper tests run the real stack, not a mock of it: a real PostgreSQL database in both history modes, the real runtime, alarm and automation engines, the entity registry and state engine, and a Modbus server running inside the test process for the rule that writes through the gate. Proven there:

- every service of every kind changes its value, and every refusal is logged and never clamped
- an agent can't change a helper with the MCP switches off
- narrowing options past the current value is refused
- a timer carries on across a restart, and one that ran out while nothing was running comes back idle and fires nothing
- two processes on one database converge: no lost count, and a shared timer finished exactly once
- a schedule's edges, both clock-change nights included, with the clock set to those nights in New York rather than lived through
- a helper driving a rule that writes a real Modbus register through the gate
- in headless Chrome: an admin makes a counter from **New helper**, an operator sets it from its tile, and the tile repaints from the live feed when anybody changes it

Not verified: no plant has run helpers yet, because no release carries them.
