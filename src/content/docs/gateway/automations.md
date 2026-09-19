---
title: "Automations: triggers, conditions, actions"
description: "Triggers, conditions, actions, and run modes, and why a rule is compiled when you save it, not when it fires."
sidebar:
  label: "Automations"
  order: 4
---

A rule is three things: something happens, a condition holds, actions run.

Rules can command equipment, so two properties are not negotiable.

**Conditions are compiled when a rule is saved, not when it fires.** A syntax
error is something the author sees while still looking at the editor, rather
than a rule that silently never runs, or worse, one that throws at 3am halfway
through a sequence that has already half-executed. The editor validates as you
type; a rule that does not compile is refused at save.

**Conditions are evaluated in a sandbox.** [expr-lang](https://expr-lang.org)
has no I/O, cannot reach the filesystem or the network, type-checks at compile
time, and is guaranteed to terminate. That last property matters most: a
condition is evaluated on the path that leads to a write, and an expression
language that can loop forever is one that can wedge the engine holding the
write lock.

## Triggers

Any one trigger firing runs the rule.

| Type | Fires when | Key fields |
|---|---|---|
| `tag_change` | a tag's value changes | `deviceId`, `tagName` |
| `threshold` | a value **crosses** a limit | `deviceId`, `tagName`, `threshold`, `direction`, `hysteresis` |
| `schedule` | a cron expression comes due | `cron` |
| `interval` | every N seconds | `intervalSec` |
| `alarm` | an alarm enters a state | `alarmId`, `alarmState` |
| `device_state` | a device connects or drops | `deviceId`, `toState` |
| `webhook` | an inbound POST arrives | `webhookPath` |
| `mqtt` | a message lands on a topic | `topic` |
| `startup` | the process starts | None |

### Thresholds fire on the crossing

`threshold` fires when a value *crosses* the limit, not while it sits above it.
Firing on "value is above 200" means the rule fires on every scan the value
stays high, which for a rule that commands something is a command storm.

`hysteresis` stops a value hovering on the limit from re-arming on every wobble:
once above, the value must fall below `threshold - hysteresis` before the
trigger can fire again.

```json
{
  "type": "threshold",
  "deviceId": "press-01", "tagName": "Zone1_Temp",
  "threshold": 200, "direction": "rising", "hysteresis": 5
}
```

`direction` is `rising`, `falling` or `either`. The first reading after startup
establishes a baseline and does not fire. Otherwise every threshold rule fires
once on boot regardless of what the value is.

## Conditions

An expression returning a boolean. Empty means unconditional.

What an expression can see:

| Name | Meaning |
|---|---|
| `value`, `string`, `quality` | the reading that fired the rule |
| `previous` | the reading before it |
| `tag`, `device` | what fired it |
| `tags["device/tag"]` | every current numeric reading |
| `strings["device/tag"]` | every current textual reading |
| `qualities["device/tag"]` | every current quality |
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
```

**Guard on quality.** `value > 200` is true for a bad reading of 250, and a bad
reading is one the system is telling you it does not know. On anything that
commands equipment, write `value > 200 and quality == 'good'`.

A condition must return a boolean. One returning a number or a string is
rejected at save rather than coerced into a truthiness nobody intended.

## Actions

Actions run in order. A failed step stops the rule unless it sets
`continueOnError`: a step that was supposed to close a valve and did not must
not be followed by steps that assume the valve is closed.

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

**This goes through the same gate as everything else.** An automation gets no
more privilege than a person: writes must be enabled, the tag must be marked
writable, the value must be in range, and the attempt is audited as
`automation:<rule-id>`.

### The rest

| Action | Does |
|---|---|
| `mqtt_publish` | publishes on an MQTT device's existing connection |
| `http_request` | calls an endpoint; `bindTo` stores the body in `vars` |
| `raise_alarm` / `clear_alarm` | drives an alarm the engine cannot see for itself |
| `log_event` | writes to the system log |
| `set_variable` | binds a value for later steps |
| `delay` | pauses, up to an hour |
| `mcp_call` | invokes a tool on a configured MCP server |

`mqtt_publish`, `http_request` and `log_event` support `{{ expression }}`
substitution in their strings.

```json
{
  "type": "mcp_call",
  "params": {
    "server": "maintenance",
    "tool": "create_work_order",
    "args": {"priority": "high"},
    "argExpressions": {"note": "'Zone 1 reached ' + string(value)"},
    "bindTo": "workOrder"
  }
}
```

## Run modes

What happens when a rule is triggered while a previous run is still going.

| Mode | Behavior |
|---|---|
| `skip` | drop the new trigger (**the default**, and the right answer near a device) |
| `queue` | run it after, at most one deep |
| `restart` | abandon the current run and start again |
| `parallel` | run both |

`queue` is capped at one pending run on purpose. A rule that cannot keep up
would otherwise build a backlog of commands that all fire against a plant whose
state has moved on.

`minIntervalSec` rate-limits regardless of trigger rate, a backstop against a
chattering tag driving a device into the ground. A manual run from the UI or MCP
bypasses the rate limit (somebody meant it) but not the run mode (two concurrent
runs are equally dangerous whoever started them).

`maxRuntimeSec` bounds a whole run; the default is five minutes. Without it a
rule hung on an unreachable endpoint holds its run slot forever, and under
`skip` that means it never fires again.

## Run history

Every run is recorded with a per-step trace: the **resolved** inputs, the
outputs, durations and errors. Not the templates. When a rule misfires at 3am,
`wrote 212.5 to press-01/Setpoint` is the thing worth knowing and
`wrote {{expression}}` is not.

Expand a run on the Automations screen to see its steps. A run that was still
going when the process stopped is marked canceled on the next start, rather
than appearing to have been executing since last Tuesday.

## A worked example

Start cooling when a zone runs hot during a shift, once every ten minutes at
most, and tell somebody.

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

Read the guards in order: it fires on the crossing rather than continuously;
hysteresis stops it re-arming on a wobble; the condition refuses to act on a
reading it cannot trust and only runs during the shift; and the rate limit means
that even if everything else is wrong it cannot command the plant more than once
every ten minutes.

## Webhooks

A `webhook` trigger registers `POST /api/webhook/<path>`. The body is available
as `vars.body`. A path claimed by no rule returns 404 rather than accepting
silently. A webhook posting into nothing looks exactly like one that works.

Two rules cannot claim the same path; the second is refused at load with a log
line naming both.

## When a rule will not arm

A rule that is enabled but did not compile shows as **NOT ARMED** on the
Automations screen, with a red dot and an explanation, and an error in the
system log. This is the state worth being loudest about: the author believes it
is running.

One bad rule does not disarm the others. Reload drops the rule that failed and
arms everything else.
