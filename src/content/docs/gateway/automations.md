---
title: "Automations: triggers, conditions, actions"
description: "Ten triggers, sandboxed conditions compiled on save, actions that write through the gate, and the 4.17.0 sequence steps: condition, wait, stop and forSec."
sidebar:
  label: "Automations"
  order: 4
---

:::note[Part of this page is new in 4.17.0]
`forSec` on a state trigger, the `condition`, `wait` and `stop` steps, `call_script`, `apply_recipe`, how a run behaves while it waits, and rules made from blueprints are new in 4.17.0. Each is marked **New in 4.17.0** where it comes up. 4.16.0 doesn't have them, so [upgrade](/gateway/upgrading/) first. Everything else on this page is in 4.16.0 too.
:::

A rule is three things: something happens, a condition holds, actions run.

Rules can command equipment, unattended, at 3 AM, while you sleep. So two properties aren't up for negotiation.

**Conditions are compiled when you save the rule, not when it fires.** A syntax error is something you see while you're still looking at the editor, not a rule that silently never runs, or worse, one that throws halfway through a sequence that already moved something. The editor validates as you type, and a rule that doesn't compile is refused at save.

**Conditions run in a sandbox.** [expr-lang](https://expr-lang.org/) has no I/O, can't reach the filesystem or the network, type-checks at compile time, and is guaranteed to finish. That last one matters most. A condition sits on the path to a write, and a language that can loop forever is a language that can wedge the engine while it holds the write lock.

## Triggers

Any one trigger firing runs the rule.

| Type | Fires when | Key fields |
|---|---|---|
| `tag_change` | a tag's value changes | `deviceId`, `tagName` |
| `threshold` | a value **crosses** a limit | `deviceId`, `tagName`, `threshold`, `direction`, `hysteresis` |
| `state` | an entity's state changes, or (since 4.17.0) has held a state for a time | `entityId`, `from`, `to`, and `forSec` since 4.17.0 |
| `schedule` | a cron expression comes due | `cron` |
| `interval` | every N seconds | `intervalSec` |
| `alarm` | an alarm enters a state | `alarmId`, `alarmState` |
| `device_state` | a device connects or drops | `deviceId`, `toState` |
| `webhook` | an inbound POST arrives | `webhookPath` |
| `mqtt` | a message lands on a topic | `topic` |
| `startup` | the process starts | None |

### Thresholds fire on the crossing

`threshold` fires when a value *crosses* the limit, not while it sits above it. Fire on "the value is above 200" and the rule fires on every scan the value stays high. For a rule that commands something, that's a command storm aimed at your own equipment.

`hysteresis` stops a value hovering on the limit from re-arming on every wobble: once above, the value has to fall below `threshold - hysteresis` before the trigger can fire again.

```json
{
  "type": "threshold",
  "deviceId": "press-01", "tagName": "Zone1_Temp",
  "threshold": 200, "direction": "rising", "hysteresis": 5
}
```

`direction` is `rising`, `falling` or `either`. The first reading after startup sets a baseline and doesn't fire. Otherwise every threshold rule on the plant fires once on boot, whatever the value is.

### State triggers follow entities

`state` fires when an entity's state string changes: `off` to `on`, `212.5` to `213`, `on` to `unavailable`. `from` and `to` narrow it. Leave both out and it fires on every change, including to and from `unavailable`. That's usually what you want for "tell somebody" and never what you want for "command something". Say `to`.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on"
}
```

It fires on the state and nothing else. An attribute changing, or the quality going bad while the state holds its last good value, isn't a change of state.

Exactly when it fires, because a rule that commands equipment deserves to know. The trigger follows the entity engine's own record of what changed, not the tag bus. The engine computes each entity's state as readings arrive, and once a second recomputes everything as a backstop for a batch it was too slow to take. Every change it computes it reports once, in order, and the trigger sees every one. So:

- **It fires once per change.** The once-a-second recompute only reports what moved since the engine last looked, so nothing is reported twice, and reloading rules resets nothing a state trigger depends on.
- **It doesn't miss a change the engine saw.** A slow bus costs a second of latency, not the change.
- **It can't see a change nobody saw.** A coil that goes off, on, off between two polls never changed as far as the plant is concerned. A state trigger is as good as the scan behind it and no better. If you need every edge of a fast signal, latch it in the PLC.
- **Startup is a baseline.** Every entity appearing when the Gateway starts, or when one is enabled, isn't a change and doesn't fire.

If rules ever fall 10,000 changes behind (a database too slow to record the runs they start), the oldest are dropped, counted and logged, and `GET /api/diagnostics` shows `stateChangesPending` and `stateChangesDropped` under `automations`.

Rename an entity and every rule naming its old `entity_id` stops firing. That's the price of names that mean something. Rename deliberately, and search the rules first.

### Holding a state: forSec

**New in 4.17.0.**

"The pump has been running for five minutes" is a state trigger with `forSec`. The change starts a timer instead of firing the rule, and the rule fires when the new state has held for that many seconds.

```json
{
  "type": "state",
  "entityId": "binary_sensor.press_01_run",
  "from": "off", "to": "on",
  "forSec": 300
}
```

- **Any change of state calls it off.** On to off and back to on inside the five minutes is two changes: the first ends the hold, the second starts a new one from zero. Time doesn't add up across them. A drop to `unavailable` is a change too, so a device that goes quiet mid-hold calls it off.
- **Only the state counts.** An attribute changing, or the quality going bad while the state holds, doesn't call it off. If a hold shouldn't survive a bad reading, guard the rule's condition on `qualities`.
- **It fires once per hold.** An hour of running fires a five-minute rule once, at five minutes, not every five minutes.
- **Each rule has its own timer**, one per trigger. Two rules on the same entity with different `forSec` each fire at their own time.
- **The trace says so.** A run a hold fired reads `binary_sensor.press_01_run changed from off to on and held for 300s`, and `fromState`, `toState` and `entity` are those of the change that started the hold.
- **A hold doesn't survive a restart.** It lives in memory and nothing re-arms it. As the process comes back, every entity appears (a baseline, not a change), usually as `unknown`, and then the device's first reading moves it to what it reads. With `"from": "off"` that's no match, so a press that was already running starts no hold, and the rule fires the next time the press goes from off to on and runs five minutes. Without `from`, it's a race you don't control: if the first reading lands after the rules are listening, `unknown` to `on` is a change and starts a hold from zero; if the device answers faster than the Gateway comes up, nothing changed and nothing fires. Say `from` when a restart must not count as a start, and don't write a rule that needs one to.
- **Editing, disarming or deleting the rule drops its holds.** Saving some other rule doesn't.
- **An entity that goes away mid-hold** (disabled, or deleted with its device) never fires it.

`forSec` is at most a day (86400), and only a `state` trigger takes it. It's checked at save like everything else.

## Conditions

An expression that returns a boolean. Empty means unconditional.

What an expression can see:

| Name | Meaning |
|---|---|
| `value`, `string`, `quality` | the reading that fired the rule |
| `previous` | the reading before it |
| `tag`, `device` | what fired it |
| `tags["device/tag"]` | every current numeric reading |
| `strings["device/tag"]` | every current textual reading |
| `qualities["device/tag"]` | every current quality |
| `states["sensor.x"]` | every enabled entity's state, as a string |
| `attrs["sensor.x"]["unit_of_measurement"]` | every enabled entity's attributes |
| `qualities["sensor.x"]` | every entity's quality, next to the tags' (a tag key has a `/`, an entity_id never does) |
| `entity`, `fromState`, `toState` | the state change that fired the rule |
| `alarm`, `alarmState` | the alarm that fired the rule |
| `deviceState` | the device state that fired it |
| `now`, `hour`, `minute`, `weekday` | the clock; weekday 0 is Sunday |
| `trigger` | which trigger fired |
| `vars` | values bound by earlier steps |

```
value > 200
value > 200 and quality == 'good'
tags['press-01/Zone1_Temp'] > 200 and tags['press-01/Pressure'] < 50
hour >= 6 and hour < 18 and weekday != 0 and weekday != 6
qualities['press-01/Zone1_Temp'] == 'good'
strings['cnc-01/Program'] == 'PART_4471.NC'
value > previous
states['switch.press_01_pump'] == 'off' and toState == 'on'
float(states['sensor.press_01_zone1_temp']) > 200 and qualities['sensor.press_01_zone1_temp'] == 'good'
attrs['switch.press_01_pump']['armed'] == true
```

**Guard on quality.** `value > 200` is true for a bad reading of 250, and a bad reading is the system telling you it doesn't know. On anything that commands equipment, write `value > 200 and quality == 'good'`. Same for entities: a bad entity keeps showing its last good value, and `qualities['sensor.x']` is how a rule tells. Skip the guard and one flaky transmitter is enough to open a valve nobody wanted open.

**A state is a string.** It's `"212.5"`, `"on"` or `"unavailable"`, never a number, so `states['sensor.x'] > 200` is refused at save as a type error instead of saved as a comparison that's quietly always false. Write `float(states['sensor.x']) > 200`, and guard it: `float('unavailable')` is an error, and a condition that errors fails the run.

`string` is the reading that fired the rule, which means it isn't also expr-lang's `string()` function. To put a number in a string, use `toJSON(value)`.

A condition must return a boolean. One that returns a number or a string is refused at save, not coerced into a truthiness nobody intended.

## Actions

Actions run in order. A failed step stops the rule unless it sets `continueOnError`, because a step that was supposed to close a valve and didn't must not be followed by steps that assume the valve is closed.

### write_tag

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Cooling",
    "value": true
  }
}
```

Or computed:

```json
{
  "type": "write_tag",
  "params": {
    "deviceId": "press-01", "tagName": "Setpoint",
    "expression": "tags['press-01/Zone1_Temp'] - 10"
  }
}
```

**This goes through the same gate as everything else.** A rule gets no more privilege than a person: writes have to be on, the tag has to be armed, the value has to be in range, and the attempt is audited as `automation:<rule-id>`. See [The write gate](/gateway/write-gate/).

### call_service

Commands an entity by its service, the same way `POST /api/services/...` and MCP's `call_service` do.

```json
{
  "type": "call_service",
  "params": {
    "entityId": "switch.press_01_pump",
    "service": "switch.turn_on"
  }
}
```

With data, literal or computed:

```json
{
  "type": "call_service",
  "params": {
    "entityId": "number.press_01_zone1_sp",
    "service": "number.set_value",
    "dataExpressions": {"value": "float(states['sensor.press_01_zone1_temp']) - 10"}
  }
}
```

`service` is `domain.service`, and its domain has to be the entity's, so a rule that names a number with a switch's service is refused at save. So is a service the domain doesn't take. The list of what each domain takes comes from the entity layer itself, so when a domain gains a service, rules can use it with no change here. `data` is the literal service data, and `dataExpressions` are evaluated when the step runs and merged over it.

It's `write_tag` with a name on it. The call becomes tag writes through the same gate, audited as `automation:<rule-id>` with the entity, the service and the call id on every row. A refusal (writes off, the tag disarmed, a value off the entity's step) fails the step and the run, with the refusal in the trace. Every write the call made or had refused is in the step's output. A call is never rolled back: a composite that got two writes out of three stops there and says so.

### condition

**New in 4.17.0.**

A condition in the middle of a sequence. When it's false the sequence ends right there, and the run **succeeded**: the rule did what it was written to do, which was stop. The step's output says `false; the steps after this one did not run`.

```json
{
  "type": "condition",
  "params": {
    "expression": "states['binary_sensor.press_01_run'] == 'on' and qualities['binary_sensor.press_01_run'] == 'good'"
  }
}
```

It isn't the rule's `condition`. That one is checked once, before anything runs, against the plant as it was when the trigger fired, and a false one records the run as skipped. A condition step reads the plant **as it is when the step runs**, which is the whole point of one after a `delay` or a `wait`: "is the press still running, thirty seconds later?" `entity`, `toState`, `value` and the rest of what fired the rule stay what they were, and so do `vars`.

A condition that can't be evaluated (`float('unavailable')`) fails the step and the run. `continueOnError` on a condition is refused at save, because carrying on past one would mean it never stops anything.

### wait

**New in 4.17.0.**

Holds the sequence until an expression is true, for at most `timeoutSec`.

```json
{
  "type": "wait",
  "params": {
    "expression": "states['binary_sensor.press_01_valve_closed'] == 'on'",
    "timeoutSec": 30
  }
}
```

It looks once right away, again **whenever an entity the expression names changes** (its state, its quality or an attribute), and once a second regardless. The entities it watches are the ones written as literals in `states['...']`, `attrs['...']` and `qualities['...']`. A tag reading, the clock, or an entity named some other way gets caught by the once-a-second look. A wait on a Modbus coil is as quick as the poll behind it, not a second late.

When it comes true, the next step runs and sees the plant as the wait last saw it. When the timeout runs out first, the step **fails**, and the run with it, saying `still false after 30s`, unless the wait says to carry on:

```json
{
  "type": "wait",
  "params": {
    "expression": "float(states['sensor.press_01_zone1_temp']) < 60",
    "timeoutSec": 240,
    "continueOnTimeout": true
  }
}
```

Either way, `vars.wait.completed` is true or false afterwards and `vars.wait.waitedSec` is how long it waited, so a condition step after a carry-on wait can decide what to do: `vars.wait.completed == true`.

`timeoutSec` is required and at most an hour. A wait with no end holds its run slot until the run's budget takes it away, and under `skip` that means the rule stops firing. It also has to fit in the run's budget (`maxRuntimeSec`, five minutes by default): a ten-minute wait needs `"maxRuntimeSec": 900` or so on its rule, and without it the rule is refused at save instead of timing out as a run. An expression that errors while it waits fails the step.

### stop

**New in 4.17.0.**

Ends the sequence. `reason` is required and takes `{{ expression }}` substitution, and the trace shows it.

```json
{
  "type": "stop",
  "params": {"reason": "pump already running, nothing to do"}
}
```

Without `error`, the run succeeded. With `"error": true` the run failed, with the reason as its error, and it's logged and counted as a failure like any other:

```json
{
  "type": "stop",
  "params": {"reason": "valve did not close in time", "error": true}
}
```

`continueOnError` on a stop is refused at save.

### call_script

**New in 4.17.0.**

Runs a [script](/gateway/scripts/): a named sequence somebody wrote once, so every rule that needs a CIP cycle or a line purge calls the same one instead of carrying its own copy that drifts. `fields` are its inputs, `fieldExpressions` are evaluated when the step runs and merged over them, and the script checks the lot against its own fields exactly as it does a run from the screen. A value it refuses fails this step. It's never moved to fit.

```json
{
  "type": "call_script",
  "params": {
    "scriptId": "cip_cycle",
    "fields": {"circuit": "tank_2"},
    "fieldExpressions": {"minutes": "states['input_number.cip_minutes']"},
    "wait": true
  }
}
```

With `"wait": true` the step holds until the script's run has ended and takes its outcome: a script that fails fails the step, and the rule stops there unless the step says `continueOnError`. The script's run is part of this one, so if this run is canceled or runs out of budget, so is the script. Without `wait`, the script is started, the rule carries on, and the script finishes on its own.

The script runs as `script:<id>`, with this rule's source, `automation`, on every write it makes, and its run names `automation_run:<id>` as its parent, so you can walk from a write back to the rule that caused it. A script that's busy, and whose mode refuses another run, fails a waiting step (`script busy`) and is noted, not failed, by one that doesn't wait. Scripts calling scripts go five deep at most, and a script that would call itself is refused when it's saved.

### apply_recipe

**New in 4.17.0.**

Applies a [recipe](/gateway/recipes/): a set of setpoints that go out together, a product grade or a changeover. `params` are its parameters, `paramExpressions` are evaluated when the step runs and merged over them, and `version` applies an older version on purpose. Leave it out for the current one.

```json
{
  "type": "apply_recipe",
  "params": {
    "recipeId": "grade_a",
    "params": {"line_speed": 120},
    "paramExpressions": {"batch": "states['input_number.next_batch']"}
  }
}
```

The recipe does exactly what it does from the Recipes screen, with this rule as the one applying it. It's checked whole first, and if any target would be refused, nothing is written and the step fails with every reason. Then the targets go out in order under one call id, as `automation:<id>` with the source `automation`. The first that fails stops the rest and fails the step, and what was written stays written. The step succeeds only when every target was written. A value that went out but wasn't read back from the device isn't a failure, because it did go out, but the trace says `NOT confirmed by read-back`, and so does the application.

### The rest

| Action | Does |
|---|---|
| `mqtt_publish` | publishes on an MQTT device's existing connection |
| `http_request` | calls an endpoint; `bindTo` stores the body in `vars` |
| `raise_alarm` / `clear_alarm` | drives an alarm the engine can't see for itself |
| `log_event` | writes to the system log |
| `set_variable` | binds a value for later steps |
| `delay` | pauses, up to an hour |
| `mcp_call` | invokes a tool on a configured MCP server |

`mqtt_publish`, `http_request` and `log_event` take `{{ expression }}` substitution in their strings, and so does `stop`.

```json
{
  "type": "mcp_call",
  "params": {
    "server": "maintenance",
    "tool": "create_work_order",
    "args": {"priority": "high"},
    "argExpressions": {"note": "'Zone 1 reached ' + toJSON(value)"},
    "bindTo": "workOrder"
  }
}
```

[Model Context Protocol](/gateway/mcp/#calling-out) covers configuring the servers `mcp_call` can reach.

## Run modes

What happens when a rule is triggered while its previous run is still going.

| Mode | Behavior |
|---|---|
| `skip` | drop the new trigger (**the default**, and the right answer near a device) |
| `queue` | run it after, at most one deep |
| `restart` | abandon the current run and start again |
| `parallel` | run both |

`queue` is capped at one pending run on purpose. A rule that can't keep up would otherwise build a backlog of commands that all fire against a plant whose state has long since moved on.

`minIntervalSec` rate-limits a rule no matter how fast its trigger fires, a backstop against a chattering tag driving a device into the ground. A manual run from the screen or MCP skips the rate limit (somebody meant it) but not the run mode (two concurrent runs are equally dangerous whoever started them).

`maxRuntimeSec` bounds a whole run, five minutes by default. Without it, a rule hung on an unreachable endpoint holds its run slot forever, and under `skip` that means it never fires again. A run that runs out of it is recorded as `timed_out`.

:::caution[Still on 4.16.0? The editor wipes the run budget]
4.16.0's rule editor has no field for `maxRuntimeSec` or the description, and a save replaces the whole rule. So any hand edit in the editor, a rename included, silently resets the run budget to the five-minute default and blanks the description. Fixed in 4.17.0, where the editor has both fields and sends back everything it has no field for exactly as it came. Until you [upgrade](/gateway/upgrading/), edit a rule that needs a longer budget through the API: read it with `GET /api/automations`, change it, and send the whole rule back with `POST /api/automations`.
:::

### Waits, delays and run modes

**New in 4.17.0.**

A run sitting in a `wait` or a `delay` is a run in progress, and the run mode decides what a new trigger does to it:

| Mode | A trigger while a run waits |
|---|---|
| `skip` | is dropped and recorded as skipped. The waiting run carries on. |
| `queue` | runs once the waiting run has finished, however it finished. |
| `restart` | cancels the waiting run where it is and starts a new one. The old run is recorded as `cancelled`, `a newer trigger restarted the rule`. This is the "motion light" pattern: every trigger pushes the end back. |
| `parallel` | starts another run, which waits on its own. |

A run is canceled where it stands, a wait or a delay included, and recorded as `cancelled` with the reason, when:

- **its rule is disarmed or deleted**: `the rule was disarmed or deleted`. Its queued run and its `forSec` holds go too.
- **its rule is edited**: `the rule was edited`. A run waiting on a condition the author just changed doesn't carry on as if nothing happened; the edited rule starts clean. Saving some *other* rule touches nothing: runs, holds, queued runs, the run slot and interval timers of every unchanged rule carry on as they were.
- **the process stops**: `the process is stopping`. Shutdown doesn't wait out a wait, and nothing resumes the run on the next start.

A step that was canceled or ran out of budget stops the run even with `continueOnError`, because that flag is for a step that failed, not for a run somebody stopped. Whatever the step already did stays done: a write that went out before the cancel isn't undone, and it's in the trace.

## Run history

Every run is recorded with a per-step trace: the **resolved** inputs, the outputs, the durations and the errors. Not the templates. When a rule misfires at 3 AM, `wrote 212.5 to press-01/Setpoint` is the thing worth knowing, and `wrote {{expression}}` is useless.

Expand a run on the Automations screen to see its steps. A run that was still going when the process stopped is marked canceled, and one the process never got to record (a crash, a power cut) is marked canceled on the next start, instead of looking like it's been executing since last Tuesday.

## Rules made from blueprints

**New in 4.17.0.**

A [blueprint](/gateway/blueprints/) is a rule written once with typed blanks, filled in per pump, per tank, per line. What comes out is an ordinary rule: it sits on the Automations screen next to the ones written by hand, it's armed by the same engine, and every write it makes goes through the gate as `automation:<id>`. There's no blueprint runtime and no side door.

The one difference: **a rule keeps the version of the blueprint it was made from.** The screen says so on the rule (*From blueprint Motor running too long, version 1*, and *version 2 available*). Editing the blueprint changes none of its rules, because the person editing it on Wednesday was thinking about pump 12, and pump 7 is the one that floods the basement. Moving a rule to the new version is an upgrade a person asks for: **Review upgrade** shows exactly what changes and what the rule would do right now, and **Upgrade** puts in exactly what was reviewed or nothing.

`GET /api/automations` carries where a rule came from as `blueprintId`, `blueprintVersion` and `blueprintInputs`. Deleting or hand-editing such a rule is still `automations.write`, admin.

## Worked examples

### Cool a zone that runs hot

Start cooling when a zone runs hot during a shift, once every ten minutes at most, and tell somebody. Works on 4.16.0 too.

```json
{
  "id": "cool-zone-1",
  "name": "Cool zone 1 when hot",
  "enabled": true,
  "mode": "skip",
  "minIntervalSec": 600,
  "triggers": [{
    "type": "threshold",
    "deviceId": "press-01", "tagName": "Zone1_Temp",
    "threshold": 200, "direction": "rising", "hysteresis": 5
  }],
  "condition": "quality == 'good' and hour >= 6 and hour < 18",
  "actions": [
    {"type": "write_tag", "params": {
      "deviceId": "press-01", "tagName": "Cooling", "value": true}},
    {"type": "delay", "params": {"seconds": 30}},
    {"type": "log_event", "params": {
      "severity": "warning",
      "message": "Cooling started, zone 1 at {{ value }}"}}
  ]
}
```

Read the guards in order. It fires on the crossing, not continuously. Hysteresis stops it re-arming on a wobble. The condition refuses to act on a reading it can't trust, and only runs during the shift. And the rate limit means that even if everything else is wrong, it can't command the plant more than once every ten minutes.

### The fan follows the press

The same idea with entities: start the extraction fan when the press starts running, but only if nobody has disarmed the fan. Works on 4.16.0 too.

```json
{
  "id": "fan-with-press",
  "name": "Extraction fan follows the press",
  "enabled": true,
  "mode": "skip",
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on"
  }],
  "condition": "qualities['binary_sensor.press_01_run'] == 'good' and attrs['switch.press_01_fan']['armed'] == true",
  "actions": [
    {"type": "call_service", "params": {
      "entityId": "switch.press_01_fan", "service": "switch.turn_on"}},
    {"type": "log_event", "params": {
      "message": "{{ entity }} went {{ toState }}, fan started"}}
  ]
}
```

`from` and `to` mean a reconnect (`unavailable` to `on`) doesn't start the fan on its own. The condition means a disarmed fan is a skipped run, not a refused write in the audit trail every single time the press starts.

### Open the cooling valve after warm-up

**New in 4.17.0.** Once the press has run for ten minutes, open the cooling valve if it isn't already open, wait for its limit switch, and fail loudly if it never makes.

```json
{
  "id": "cool-after-warmup",
  "name": "Open cooling after ten minutes of running",
  "enabled": true,
  "mode": "restart",
  "maxRuntimeSec": 120,
  "triggers": [{
    "type": "state",
    "entityId": "binary_sensor.press_01_run",
    "from": "off", "to": "on",
    "forSec": 600
  }],
  "actions": [
    {"type": "condition", "params": {
      "expression": "states['valve.press_01_cooling'] != 'open'"}},
    {"type": "call_service", "params": {
      "entityId": "valve.press_01_cooling", "service": "valve.open"}},
    {"type": "wait", "params": {
      "expression": "states['valve.press_01_cooling'] == 'open'",
      "timeoutSec": 60, "continueOnTimeout": true}},
    {"type": "condition", "params": {
      "expression": "vars.wait.completed == false"}},
    {"type": "stop", "params": {
      "reason": "cooling valve did not open within 60s, it is {{ states['valve.press_01_cooling'] }}",
      "error": true}}
  ]
}
```

Top to bottom: the hold means a press that trips after two minutes never opens the valve, and `from` means a Gateway restart isn't a press start. The first condition makes an already-open valve a successful run that commands nothing. The wait wakes the moment the valve entity changes. If the valve never opens, the second condition lets the run through to a stop that fails it, with the valve's actual state in the reason and a warning in the system log. If it does open, that same condition is false and the run ends there, succeeded.

## Webhooks

A `webhook` trigger registers `POST /api/webhook/<path>`, and the body is available as `vars.body`. A path no rule claims answers 404 instead of accepting silently, because a webhook posting into nothing looks exactly like one that works, right up until the day you needed it.

Two rules can't claim the same path. The second is refused at load, with a log line naming both.

## When a rule won't arm

A rule that's enabled but didn't compile shows as **NOT ARMED** on the Automations screen, with a red dot and an explanation, plus an error in the system log. This is the state worth being loudest about, because its author believes it's running.

One bad rule doesn't disarm the others. A reload drops the rule that failed and arms everything else.
