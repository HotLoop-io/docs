---
title: "Blueprints: one rule, filled in per pump"
description: "A blueprint is a rule with typed blanks. Fill it in per pump and get an ordinary automation that stays on its version until somebody reviews the upgrade."
sidebar:
  label: "Blueprints"
---

Every plant has the same rule copied onto forty pumps. Then somebody finds a bug in it and fixes it on thirty-seven of them. Nobody knows which three got missed until one of them does the old wrong thing at the worst possible moment. Copies drift. That's what copies do.

A blueprint is the rule written once, with typed blanks in it. "When *this motor* has been running longer than *this long*, say so, and stop it if *I ask you to*." Somebody who knows what the rule should do writes it one time. Everybody else fills in the blanks per pump, per tank, per line, and gets an ordinary [automation](/gateway/automations/) out the other end.

What comes out is a normal rule. It sits on the Automations screen next to the ones written by hand, the same engine arms it, and every write it makes goes through the [write gate](/gateway/write-gate/) as `automation:<id>`, audited, refusals included. There's no blueprint runtime and no side door. You fill in a form, you get a rule. That's the whole trick.

:::note[New in 4.17.0]
Blueprints are new in 4.17.0. A 4.16.0 Gateway has none of the screens, routes, or tools on this page, so [upgrade](/gateway/upgrading/) first. Know that the operator role gets `blueprints.apply` the moment you do, so your operators can make rules from blueprints straight away. Writing blueprints stays admin.
:::

## The one rule about blueprints

**A rule keeps the version of the blueprint it was made from.**

Edit a blueprint and its version goes up. Not one rule made from it changes. Somebody edits the blueprint on Wednesday with pump 12 on their mind. The rule on pump 7, which was right on Tuesday, doesn't get to quietly turn into something else, because pump 7 is the one that floods the basement.

Moving a rule to the new version is an **upgrade**, and a person asks for it. The rule's card on the Automations screen says *From blueprint Pump start watch, version 1* and *version 2 available*. [Upgrading a rule](#upgrading-a-rule) shows exactly what changes before anything does.

## What one looks like

```json
{
  "id": "pump_watch",
  "name": "Pump start watch",
  "description": "Says when a pump starts, with the limit it runs to.",
  "inputs": [
    {"name": "pump", "label": "Pump", "type": "entity", "domain": ["switch"], "required": true},
    {"name": "limit", "label": "Limit", "type": "number", "min": 0, "max": 100, "step": 5, "unit": "%", "required": true}
  ],
  "template": {
    "triggers": [{"type": "state", "entityId": {"!input": "pump"}, "to": "on"}],
    "condition": "float(states['sensor.tank_level']) < ${limit}",
    "actions": [
      {"type": "log_event", "params": {"message": "${pump} started, running to ${limit}%"}}
    ],
    "mode": "skip"
  }
}
```

| Key | What it is |
|---|---|
| `id` | Lowercase letters, digits, and underscores, starting with a letter |
| `inputs` | The blanks, typed, the same fields scripts and recipes use: `number` with `min`, `max`, `step`, and `unit`, `text` with `max_length` and `pattern`, `boolean`, `select` with `options`, `entity` with the `domain`s it takes, `duration` (seconds, or `90s`, `1h30m`), `alarm`, and `tag`. Each can be `required` or have a `default` |
| `template` | The rule: `description`, `triggers`, `condition`, `actions`, `mode`, `minIntervalSec`, `maxRuntimeSec`, in the automation language. Not its `id`, `name`, or `enabled`: those belong to each rule made from it |

The template's actions can be anything a rule can do, including a `call_script` step that runs a [script](/gateway/scripts/) or an `apply_recipe` step that applies a [recipe](/gateway/recipes/), with the blanks filled into the step's `fields`, `fieldExpressions`, `params`, or `paramExpressions`. The procedure stays in one place, and every rule the blueprint makes calls it.

### The blanks

**`{"!input": "pump"}`** as a value is replaced by the input's value, with its type. An entity lands in `entityId` as a string, a duration lands in `forSec` as a number. An optional input nobody filled in is `null`.

**`${pump}`** inside a string is replaced too, and how depends on where it is:

- In an expression (a rule's `condition`, an action's `expression`, a value in `dataExpressions`, `argExpressions`, `fieldExpressions` or `paramExpressions`, and anything between `{{` and `}}` in a message) it goes in as a **literal**. A string is quoted, a number is a number, a boolean is `true` or `false`, and an empty optional input is `nil`. With a limit of 40, the condition above becomes `float(states['sensor.tank_level']) < 40`.
- Anywhere else it's plain text: `switch.pump_1 started, running to 40%`.

**`${counter.domain}`** is an entity input's domain, for a service name that has to match whatever kind of entity got picked. `"${counter.domain}.reset"` is `counter.reset` for a PLC's counter and `input_counter.reset` for a counter helper.

That quoting is why a text input is safe inside an expression. Type `' || true || '` into one and the condition compares against that string, exactly as typed. It never becomes part of the expression. And no input value can contain `{{` at all, because every message a rule sends evaluates what's between `{{` and `}}` when it's sent, and a value somebody typed into a form doesn't get to become code.

### Checked when it's saved

A blueprint gets checked before it's stored, not when somebody first tries to use it:

- every blank names an input, and `.domain` only follows an entity input;
- every input is used somewhere. An input the template ignores is a form field that does nothing, and somebody will lose an afternoon to it;
- filled in with sample values of each input's type (its default when it has one), the template makes a rule that compiles. A text input that becomes a URL needs a `pattern` saying so, like `https?://\S+`, or the URL check refuses the sample.

## Filling one in

On the **Blueprints** screen, **Use** opens the form: the rule's id and name, and each input as the right control, a number with its range, a list, an entity picker. Then:

- **Check first** answers the rule it would make and what that rule would do if it fired right now: the condition evaluated, every write and service call put to the write gate's own checks as `automation:<id>`, and the first refusal in the gate's words. Nothing is stored, written, or audited.
- **Make the rule** makes it, armed unless you untick that, and it shows up on the Automations screen saying where it came from.

Every input is checked first and **never moved to fit**. 150 for an input whose max is 100 is refused, not quietly made 100. `"12"` for a number is refused, not parsed. An entity of the wrong domain is refused. Every input that's wrong is reported at once, so the form comes back with the whole list, not one problem at a time. A value the rule itself refuses (a duration of two days for a hold that can be one day at most) is refused in the rule's own words. Nothing gets made until all of it is right.

Making a rule **never replaces one**. An id that's already taken, by a hand-written rule or one made from a blueprint, is a `409`.

Over the API it's `POST /api/blueprints/{id}/instantiate`, with `?dry_run=true` for the check. The infeed pump's rule, from `motor_running_too_long`:

```json
{"automationId": "infeed_too_long", "name": "Infeed pump ran too long", "enabled": true, "inputs": {"motor": "motor.infeed_pump", "max_run": "90m", "stop_it": true}}
```

`name` defaults to the blueprint's and `enabled` to `true`. The answer is `201` with the rule, its `blueprintId`, `blueprintVersion`, and `blueprintInputs` set, or a `400` naming every input that's wrong.

## Upgrading a rule

On the rule's card, **Review upgrade** (`POST /api/automations/{id}/blueprint-upgrade?dry_run=true`) shows what changes, part by part, before and after, and what the rule would do if it fired right now, every write put to the gate's checks. Nothing has changed yet.

- If somebody edited the rule by hand since it was made, the review shows that edit as being replaced. Nobody's change disappears without being on the screen first.
- If the new version needs an input the rule has no value for, or refuses a value the rule was made with, the review says so and the upgrade is blocked until somebody gives a value.

**Upgrade** sends the version that was reviewed, `{"version": 2}`, and puts in exactly that. If the blueprint moved on again, or somebody else upgraded the rule in between, it's a `409` and you look again. What you reviewed is what goes in, or nothing does. The rule keeps its id, its name, and whether it's armed, and the upgrade is logged with who did it: *automation upgraded from blueprint pump_watch version 1 to 2*.

When the rule is already on the newest version, the same button reads **Change inputs**: the same review, the same version, new input values.

## The built-in ones

These ship in the binary and are read-only. **Copy** makes one of your own under a new id, starting at version 1, to change however you like.

| Blueprint | Inputs | What the rule does |
|---|---|---|
| `motor_running_too_long` | a motor, how long it may run (default an hour, at most a day), whether to stop it | When the motor has been `running` that long in one go, logs a warning. If asked, stops it with `motor.stop` |
| `tank_high_level_stop_pump` | a level sensor, the limit, the pump (a motor) | When the level is at or over the limit, the reading's quality is good, and the pump isn't already stopped, stops the pump and logs it |
| `alarm_to_notify` | an alarm, the state to act on (default `unack-active`), a webhook URL | When the alarm goes to that state, POSTs `{"text": "Alarm temp-hi is unack-active"}` to the URL |
| `shift_schedule_counter_reset` | a schedule helper, a counter (PLC or helper) | When the schedule turns on, resets the counter and logs it |

The honest notes on them:

- **`tank_high_level_stop_pump` is a convenience, not an interlock.** A trip that protects people or the plant belongs in the PLC, hard-wired where it has to be, not in anything that runs over a network. This one saves somebody from babysitting a level. It does not replace the high-level switch.
- It won't act on a reading it can't trust. A level with bad quality stops nothing, because a stop based on a garbage number is still a stop.
- **`shift_schedule_counter_reset` fires when the schedule turns on**, and two schedule blocks that touch are one long stretch of on. Give each shift its own block with the schedule off between them, even for a minute (06:00 to 13:59, 14:00 to 21:59), or only the first shift of the run resets the counter. See [helpers](/gateway/helpers/) for schedules.
- **`alarm_to_notify`** is for a chat room or a ticketing system. For paging a phone, with rate limits, retries, and acknowledge links, use the notifications HotLoop sends itself.

## Who can do what

| Action | viewer | operator | admin |
|---|---|---|---|
| See blueprints (`blueprints.read`) | yes | yes | yes |
| Make a rule from one, upgrade one (`blueprints.apply`) | no | yes | yes |
| Write, edit, copy, delete one (`blueprints.write`) | no | no | yes |

Why operators get to make rules: the blueprint is where an engineer already decided what the rule does, and picking which pump it watches is exactly the call an operator makes all day. The dangerous part, what the rule commands, got decided when the blueprint was written, by somebody holding `blueprints.write`. Deleting or hand-editing the rule afterwards still takes `automations.write`, which is admin.

Deleting a blueprint that any rule was made from is a `409`, naming the rules. Delete those first. A built-in blueprint can't be edited or deleted.

## Agents can look, not make

Over [MCP](/gateway/mcp/), an agent gets `list_blueprints` and `preview_blueprint`. It can find the right blueprint, work out the inputs, and show what the rule would do right now: `preview_blueprint` takes `blueprintId`, `automationId`, and `inputs`, and checks the inputs exactly as the screen does. The preview stores and writes nothing, so it's answered whatever `HOTLOOP_ALLOW_MCP_WRITES` says.

It can't make the rule. There's no tool for it, on purpose. A rule is a standing order to command equipment every time its trigger fires, for months after the conversation that suggested it is over, and whether a plant has one is a person's call, made on the Blueprints screen with their name on it.

## Where it all goes

- **Blueprints** the plant wrote live in the `blueprints` table. The built-in ones live in the binary and are never stored.
- **A rule made from one** is a row in `automations` like any other, with `blueprint_id`, `blueprint_version`, and `blueprint_inputs` saying where it came from. `GET /api/automations` has them as `blueprintId`, `blueprintVersion`, and `blueprintInputs`.
- **Every change** is in the system log and the [logbook](/gateway/logbook/) with who made it: *blueprint created*, *blueprint saved, now version 2*, *automation made from blueprint motor_running_too_long version 1*, *automation upgraded from blueprint pump_watch version 1 to 2*, *blueprint deleted*.
- **Backups** carry the blueprints and every rule's pinned version, so a restored plant offers exactly the upgrades it offered before. A backup from before blueprints existed restores every rule as written by hand.
- A rule whose blueprint is gone (a built-in one a later release dropped, say) keeps running exactly as it is. There's just nothing to upgrade it to.

## What's been proven, and on what

The tests run against a real database, the real engine and write gate, a Modbus TCP device the test starts in its own process, and real headless Chrome. **That Modbus device is a stand-in, not a PLC.**

- Every built-in instantiates and compiles. Out of range, off step, wrong domain, and unknown inputs are all refused, with every reason. Text inputs stay strings inside expressions, quotes, backslashes, and newlines included.
- `motor_running_too_long` on a motor entity built from that Modbus device's tags: the motor runs past its limit, the rule stops it, and the write is audited as `automation:infeed_too_long`. With the motor's run command disarmed, the dry run says the gate refuses in the gate's words, and the real stop is refused, audited, and never reaches the device.
- Pinning, the `409` on deleting a blueprint in use, never overwriting a rule, the reviewed-version rule, the required-input block, hand edits in the diff, and the logbook lines.
- The MCP preview makes nothing and refuses out-of-range inputs. Backups round-trip, and restore works from every schema level.
- In the browser: gallery, a refused input, check, make, and the motor stops. An admin copies a built-in and edits it to version 2, and the rule stays at version 1 until the operator reviews and takes the upgrade.

Seven protections were broken on purpose (an edit dragging rules to the new version, an upgrade skipping the reviewed-version check, refused inputs getting through, a text input unquoted in an expression, a dry run that never asks the gate, the gate no longer checking a tag is armed, and blueprints dropped from backups). The tests caught every one.

Not verified yet: a physical motor on a physical PLC.

## Routes

| Route | What it does | Needs |
|---|---|---|
| `GET /api/blueprints` | every blueprint, built-in first, with how many rules came from each | `blueprints.read` |
| `GET /api/blueprints/{id}` | one blueprint | `blueprints.read` |
| `POST /api/blueprints` | write one, at version 1 | `blueprints.write` |
| `PUT /api/blueprints/{id}` | replace it; new inputs or template bump the version, and no rule changes | `blueprints.write` |
| `DELETE /api/blueprints/{id}` | delete it; `409` while rules made from it exist | `blueprints.write` |
| `POST /api/blueprints/{id}/instantiate` | make a rule; `?dry_run=true` to check first | `blueprints.apply` |
| `POST /api/automations/{id}/blueprint-upgrade` | move a rule to the newest version; `?dry_run=true` to review | `blueprints.apply` |
