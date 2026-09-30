---
title: "Recipes: every setpoint or none of them"
description: "A product grade's setpoints as one write: checked whole, sent in order through the write gate, read back from the device, never clamped or rolled back."
sidebar:
  label: "Recipes"
---

Every plant has a laminated sheet taped next to the HMI. Grade A: zone temperatures, line speed, die gap. The changeover to the 500 ml bottle. The night setback. An operator types the numbers in one at a time, and every plant has the story about the night one of them went in wrong and nobody found out until the scrap bin did.

A recipe is that sheet, living in HotLoop instead of on the wall. It's a set of values that go out to the plant together: checked whole before anything moves, sent in order through the [write gate](/gateway/write-gate/), read back from the device afterwards, and every one of them on the record. It's built for equipment that can hurt somebody, which is why most of this page is about what happens when something goes wrong.

:::note[New in 4.17.0]
Recipes are new in 4.17.0. A 4.16.0 Gateway has none of the screens, routes, or tools on this page, so [upgrade](/gateway/upgrading/) first. Know that the operator role gets `recipes.apply` the moment you do, so your operators can apply any recipe that doesn't name its own permission straight away.
:::

## What one looks like

```json
{
  "id": "grade_a",
  "name": "Grade A",
  "description": "The 2pm run. Die at 210, line at whatever the order says.",
  "equipment_id": 7,
  "apply_permission": "recipes.apply",
  "params": [
    {"name": "speed", "label": "Line speed", "type": "number", "min": 0, "max": 400, "step": 10, "unit": "rpm", "required": true}
  ],
  "precondition": "states['input_boolean.line_ready'] == 'on'",
  "targets": [
    {"entity_id": "loop.line_02_die_tic", "service": "set_mode", "data": {"mode": "auto"}},
    {"entity_id": "loop.line_02_die_tic", "service": "set_setpoint", "data": {"value": 210}},
    {"entity_id": "number.line_02_speed", "service": "set_value", "data_expressions": {"value": "vars.speed"}},
    {"entity_id": "switch.line_02_heater", "service": "turn_on"},
    {"entity_id": "input_select.product", "service": "select_option", "data": {"option": "Grade A"}}
  ],
  "verify_sec": 10
}
```

| Key | What it is |
|---|---|
| `id` | Lowercase letters, digits, and underscores, starting with a letter. It's also the recipe's entity, `scene.grade_a`, and it never changes |
| `equipment_id` | The equipment tree node it belongs to, so the Recipes screen can group it. Leave it out for a whole-plant recipe |
| `apply_permission` | `recipes.apply` (the default) or a narrower `recipes.apply.<name>`. See [who may apply one](#who-may-apply-one) |
| `params` | What an application takes, up to 32, typed: `number` with `min`, `max`, `step`, and `unit`, `text`, `boolean`, `select`, `entity`, `duration`, `alarm`, and `tag`. A target reads one as `vars.<name>` |
| `precondition` | An automation-language expression that has to be true for the recipe to start. Optional |
| `targets` | The values, **in the order they go out**: an entity, the service that sets it, and its data as a value (`data`) or computed from the parameters (`data_expressions`). At least 1, at most 200 |
| `verify_sec` | How long each written value gets to show up in a reading from the device. 1 to 600, default 10 |

### What a target can set

A recipe sets values. It only takes services that leave equipment holding one:

| Domain | Services |
|---|---|
| `switch`, `input_boolean` | `turn_on`, `turn_off` |
| `number`, `input_number`, `input_counter` | `set_value` |
| `text`, `input_text` | `set_value` |
| `select`, `input_select` | `select_option` |
| `valve` | `set_position` |
| `motor` | `set_speed` |
| `loop` | `set_setpoint`, `set_mode` |

A button press, a motor start, a counter reset, a valve stop: refused at save. Those are actions, and actions belong in a [script](/gateway/scripts/). "Apply grade A" pressing a reset button every time somebody loads the grade is not what anybody means by a recipe, and you really don't want to learn that mid-run. Toggle is refused too, because a recipe that flips a switch does the opposite thing every other time.

Also refused at save: a target whose entity doesn't exist, an expression that doesn't compile, and the same entity set twice by the same service (two values for one setting, and the winner depends on an order nobody reads). A loop's mode and its setpoint are two settings, so both are fine. Put the mode first. A setpoint for auto means nothing to a loop sitting in manual.

## Building one

Nobody hand-types a forty-target recipe when the line is already running grade A. **Capture** on the Recipes screen (`POST /api/recipes/capture`) takes the entities you pick and drafts a recipe that sets each one back to what it holds right now, in the order you picked them: a number's value, a switch's on or off, a select's option, a valve's position, a motor's speed, a loop's mode and then its setpoint. Name it, trim it, turn the numbers that change per order into parameters, and save. Or skip capture and send the JSON to `POST /api/recipes`, which stores it as version 1. Both are admin work (`recipes.write`).

Capture refuses any entity it can't trust, and names every one: a reading with quality other than good, `unknown`, `unavailable`, or disabled. A recipe built from a bad reading writes that bad reading back to the plant every single time somebody applies it, so it never gets built.

## Applying one

| From | How |
|---|---|
| The Recipes screen | **Apply**, fill in the parameters. **Check first** asks without writing |
| The Entities screen | **Apply** on the recipe's `scene.<id>` tile |
| The API | `POST /api/recipes/{id}/apply` with `{"params": {"speed": 250}, "reason": "grade A for the 2pm run"}` |
| A service call | `POST /api/services/scene/turn_on`, with `params` and `version` in the data |
| A rule or a script | an `apply_recipe` step, [below](#from-a-rule-a-script-or-an-agent) |
| An agent | the `apply_recipe` MCP tool, with a required `reason` |

Every one of those does exactly the same three things, in this order.

### 1. Checked whole, refused whole

Before a single value goes anywhere:

- The parameters are checked against their fields, and **a value is never moved to fit.** 450 on a field whose max is 400 is refused, not clamped. `"250"` for a number is refused, not parsed. 255 on a step of 10 is refused, not rounded. The number that reaches the plant is exactly the one somebody typed, or nothing goes.
- The recipe's own permission is checked, and for an agent, the MCP write switch.
- The precondition is evaluated against the plant as it is right now.
- Every data expression is evaluated. If one fails, the recipe is refused. A target never goes out without the value it was meant to have.
- Nothing else in this process can be writing to any of its entities ([two at once](#two-at-once)).
- **Every target is put to the write gate's own checks**, the same ones its write will face: writes on, the tag writable, the value in the tag's range, the entity enabled and happy with the value (its step, its options, a loop in manual for its output), and the device connected. The check itself writes and audits nothing.

**If anything fails, the whole recipe is refused and nothing is written.** Not ten targets and then a refusal. Nothing. You also get every reason at once, not just the first, because a forty-target recipe should get fixed in one pass, not forty. Each target says `would_write`, `refused` with the gate's own words, or `not_sent`.

### 2. Written in order, stopped at the first failure, never rolled back

Then the targets go out in order, each one through the write gate. There's no side door. Every write carries the application's **call id**, so `GET /api/writes?call=<id>` pulls up the whole application in the audit trail, right next to every other write the plant ever took.

A check can pass and the write still fail a second later. The PLC answers with an exception. Somebody kicks a cable. Somebody disarms a tag between the check and the write. **The first target that doesn't go through stops the application**, and everything after it is `skipped`.

**Nothing already written is undone.** That's deliberate, and it's the rule every HotLoop write follows. An undo is a write too: one nobody asked for, to equipment that has already moved, based on what we think the value used to be, at the exact moment the plant just proved it isn't behaving the way we expected. That's how a half-applied recipe turns into a fully confused line. Deciding what to do about a half-applied recipe is the operator's call, and they get exactly what they need to make it:

```text
PARTIAL v3: 2 of 5 written before one failed, nothing undone
  1. set_mode loop.line_02_die_tic: written, verified
  2. set_setpoint loop.line_02_die_tic: written, verified
  3. set_value number.line_02_speed: failed: the device answered the write with an exception
  4. turn_on switch.line_02_heater: skipped
  5. select_option input_select.product: skipped
```

A target ends `written`, `failed` (it went out and the device said no, or said nothing, so nobody knows if it took), `not_sent` (the gate turned it away at the last moment), or `skipped`. The application ends `applied` (every target written), `partial` (some were), or `failed` (the first one wasn't).

The Recipes screen then offers **Apply the remaining targets**. That's a brand new application of only the targets that didn't get written, same version, same parameters, checked whole again first, under its own call id, with `application:<id>` as its parent so the two turn up together. Over the API it's `"resume": <application id>`. It never fires on its own. Somebody looks at what broke, fixes it, and presses the button.

An application that has started runs to its end, whatever happens to whoever asked for it. An operator closing the browser halfway through doesn't leave grade A half loaded, and a Gateway that's shutting down waits up to two minutes for an application in progress before it goes.

### 3. Read back

Written is not the same as taken. A PLC can accept a write and have its own logic stomp on it next scan. A scaled register can take 12.34 and hold 12.3. So after the last write, every written value is read back:

- only from a device reading **taken after its write**, so a cached value from before can't confirm anything;
- from the entity's state, or for a valve, a motor or a loop, the attribute the service sets (`current_position`, `speed`, `setpoint`, `mode`);
- a number counts if it's within a millionth of itself (a float register hands 0.1 back as 0.10000000149, which is the same setpoint), and anything else has to match exactly.

Each written target ends **`verified`**, or **`unconfirmed`** if it didn't read back within `verify_sec`, with what came back instead:

```text
  3. set_value number.line_02_speed: written, unconfirmed (not confirmed within 10s: read back 240, not 250)
```

Unconfirmed shows **amber, never green**, and it's a warning in the logbook and the system log. It is not a failure: the value went out, the device accepted it, and the application still counts as `applied`. It's a flag that says go look, because it may not have stuck. A helper holds its own value, so a helper target verifies straight from it. The answer comes back once read-back is done, so an apply takes up to `verify_sec`.

### Asking first

**Check first** on the screen, `POST /api/recipes/{id}/validate`, or the `validate_recipe` MCP tool runs every check from step 1 and writes, records, and logs nothing. It answers `would_apply` or `refused`, target by target. It's advice, not a promise: a device can drop and a tag can get disarmed between your check and your apply.

## Two at once

Two recipes interleaving their writes to the same setpoint leave it at whichever landed last, which is nobody's recipe. So while an application is writing and reading back, it holds every entity it targets, and any other application that touches one of them gets a `409` naming the recipe in the way. Wait for it, then apply. That hold lives inside one process, though. An application from the Gateway and one from an `--mcp-stdio` process beside it don't hold each other off. Run one writer, or keep the agent's recipes and the operators' on different equipment.

## Versions

The name, description, equipment node, and permission belong to the recipe and change in place. **What it writes is a version, and a version never changes.** Saving different targets, parameters, precondition, or `verify_sec` stores the next version and makes it current. Version 3 is exactly what it was the day it was saved, forever, and every application records the version and parameters it ran with. What went out to the plant last Tuesday always has an answer.

- Changing only the name or the note makes no new version.
- Saving over a version somebody else has since replaced is a `409`, not a quiet overwrite of their work. The editor sends the version it was editing as `current_version`.
- An older version can be applied on purpose: pick it in the apply drawer, or send `"version": 2`. The application says it was version 2.
- The **Versions** drawer shows every version, who saved it, their note, and what changed from the one before, target by target.

Deleting a recipe deletes its versions. Its applications stay, because they're what was actually sent to the plant, and that history outlives the recipe.

## Who may apply one

| Permission | viewer | operator | admin |
|---|---|---|---|
| `recipes.read`: see recipes, versions, applications | yes | yes | yes |
| `recipes.apply`: check, apply, apply the rest | no | yes | yes |
| `recipes.write`: create, capture, edit, delete | no | no | yes |

Loading grade A is what the operator is there for. Deciding what grade A *is* is an engineer's call.

A recipe can name a narrower permission of its own, `"apply_permission": "recipes.apply.night_setback"`. Applying it then takes that too, which the operator role doesn't hold. Add it to the permission list of the people who should have it. An explicit list replaces the role's set outright, so name everything they need: `["recipes.read", "recipes.apply", "recipes.apply.night_setback"]`.

`recipes.apply.*` grants every recipe's permission, and an admin holds everything. Somebody without it gets a `403`, and **the refusal is on the record**: a refused application in the recipe's history, with their name on it. The same goes for `scene.turn_on`.

An agent holds no user's permissions, so **an agent never applies a recipe that names its own permission.** It can read the recipe and ask whether it would apply, and the answer says why not.

## The precondition

```json
"precondition": "states['input_boolean.line_ready'] == 'on' and float(states['sensor.line_02_die_temp']) < 250"
```

It's the automation language, evaluated when somebody presses Apply, with the parameters as `vars`. False refuses the recipe and says so. It keeps the right numbers from going out at the wrong moment. **It is not an interlock.** An interlock lives in the PLC, where it still works when the network doesn't. [Helpers](/gateway/helpers/) like `input_boolean.line_ready` are a good way to give operators the switch.

## From a rule, a script, or an agent

A [rule](/gateway/automations/) or a [script](/gateway/scripts/) applies one with an `apply_recipe` step. `paramExpressions` are evaluated when the step runs and merged over `params`, and `version` pins an older one:

```json
{"type": "apply_recipe", "params": {"recipeId": "grade_a", "params": {"speed": 250}}}
```

It applies as the rule (`automation:<id>`) or the script (`script:<id>`), with that run's source on every write and the run as the application's parent. The step fails unless every target was written. An unconfirmed value doesn't fail it, but the trace says `NOT confirmed by read-back`. A script's dry run checks the recipe too. A rule made from a [blueprint](/gateway/blueprints/) can carry the same step, with the parameters filled in per line.

Over [MCP](/gateway/mcp/), `list_recipes` shows every recipe with its targets and parameters, `validate_recipe` asks whether one would apply right now, and `apply_recipe` takes `recipeId`, `params`, an optional `version`, and a **required** `reason`. An agent's writes carry the source `mcp`, so the MCP write switch applies to every one of them in the gate. With `HOTLOOP_ALLOW_MCP_WRITES` off, `apply_recipe` is refused before anything is even checked.

## The record

Every application, refusals included, is a row in `recipe_applications`: the recipe, the version, the parameters, who, from where, why, the call id, what happened to every target, and whether it read back. The row opens before the first write and closes after read-back, so an application the process died in the middle of still says it started. The next start marks it `failed`, `interrupted by restart`, pointing at its call id. **Nothing resumes it.** `GET /api/writes?call=<id>` shows exactly which values made it out before the lights went off, and what happens next is a person's call.

Each application is also one line in the system log and one entry in the [logbook](/gateway/logbook/), kind `recipe`, next to the writes it made. Each recipe keeps its newest 5000 applications. Recipes, every version, and every application are in backups, and an application the backup caught mid-write comes back marked `failed`, like a crash. The recipe's entity, `scene.<id>`, holds the time of its last application that wrote something (`unknown` until one has), with `last_result`, `last_version`, `last_applied_by`, `last_application`, and `unconfirmed` as attributes. A rule can trigger on it.

## What's been proven, and on what

The tests run the real code path: a real Postgres database, the real runtime and write gate, and a Modbus TCP device the test starts in its own process, which can be told to refuse or ignore writes to one address. **That device is a stand-in, not a PLC.**

Against it: a refused recipe moves no register and leaves no audit row. A parameter out of range is refused, not clamped. The device refusing target 2 of 3 leaves zone 1 written and zone 3 never sent, and the rest then goes out as its own application. An ignored write comes back unconfirmed. Overlapping applications get the `409`. Versions stay put, and a stale save conflicts. A rule, a script, and `scene.turn_on` each apply one. The per-recipe permission holds, and a crash's leftover application gets marked on start. A headless Chrome test drives capture, a second version and its diff, check, apply with read-back, the device refusing mid-apply, and applying the rest. Each of the eleven protections was broken on purpose, and a test failed every time.

Not verified yet: a physical PLC on a real line. The two-process case (the Gateway and an `--mcp-stdio` process on one database) has no test of its own.

## Routes

| Route | What it does | Needs |
|---|---|---|
| `GET /api/recipes` | every recipe with its current content and last application | `recipes.read` |
| `GET /api/recipes/{id}` | one recipe | `recipes.read` |
| `POST /api/recipes` | create one, as version 1 | `recipes.write` |
| `POST /api/recipes/capture` | draft one from what entities hold now; saves nothing | `recipes.write` |
| `PUT /api/recipes/{id}` | save; new content is a new version | `recipes.write` |
| `DELETE /api/recipes/{id}` | delete it and its versions; applications are kept | `recipes.write` |
| `GET /api/recipes/{id}/versions` | every version, as saved | `recipes.read` |
| `GET /api/recipes/{id}/versions/{version}` | one version | `recipes.read` |
| `POST /api/recipes/{id}/validate` | would it apply now? nothing written | `recipes.apply` |
| `POST /api/recipes/{id}/apply` | apply it | `recipes.apply`, plus its own permission if it names one |
| `GET /api/recipes/{id}/applications` | every application, refusals included | `recipes.read` |

`POST /api/recipes/{id}/apply` answers `200` for `applied` (check each target's `verification`), `400` for a parameter it doesn't take, out of range, or of the wrong type, `403` for the recipe's own permission, `404` for no such recipe or version, `409` for refused or busy with nothing written, and `502` for `partial` or `failed`, with `targets` saying exactly what went out.
