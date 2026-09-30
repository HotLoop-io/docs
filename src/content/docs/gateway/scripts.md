---
title: "Scripts: write it once, run it anywhere"
description: "A script is a named sequence with typed fields: the CIP cycle written once, run from the screen, a rule, the API, or an agent, every write through the gate."
sidebar:
  label: "Scripts"
---

Every plant has a handful of procedures it runs exactly the same way every time. The CIP cycle. The line purge. The changeover to product B. Without scripts, the only way to have one in HotLoop is to paste it into every rule that needs it, and I promise you the day comes when somebody fixes a step in three of the four copies. The fourth one runs at 2am.

A script is that procedure with a name. You write it once, and everything that needs it calls it by name: an operator from the Scripts screen, a rule with a `call_script` step, an agent with `run_script`, anything at all through `POST /api/services/script/turn_on`. It speaks the same language a rule does, runs on the same sequence runner, and every write it makes goes through the [write gate](/gateway/write-gate/). It never had a side door to close.

:::note[New in 4.17.0]
Scripts are new in 4.17.0. A 4.16.0 Gateway has none of the screens, routes, or tools on this page, so [upgrade](/gateway/upgrading/) first. Know that the operator role gets `scripts.run` the moment you do, so your operators can run scripts straight away. Writing them stays admin.
:::

## What one looks like

```json
{
  "id": "cip_cycle",
  "name": "CIP cycle",
  "description": "Caustic wash, rinse, done. Tank must be empty.",
  "fields": [
    {"name": "minutes", "label": "Wash time", "type": "number", "min": 5, "max": 60, "step": 5, "unit": "min", "required": true},
    {"name": "circuit", "type": "select", "options": ["tank_1", "tank_2"], "default": "tank_1"}
  ],
  "sequence": [
    {"type": "condition", "params": {"expression": "float(states['sensor.cip_tank_level']) < 5"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_on"}},
    {"type": "wait", "params": {"expression": "float(states['sensor.cip_return_temp']) > 70", "timeoutSec": 900}},
    {"type": "log_event", "params": {"message": "CIP on {{ vars.circuit }} for {{ vars.minutes }} minutes"}},
    {"type": "call_service", "params": {"entityId": "switch.cip_pump", "service": "switch.turn_off"}}
  ],
  "mode": "skip",
  "maxRuntimeSec": 1800
}
```

| Key | What it is |
|---|---|
| `id` | Lowercase letters, digits, and underscores, starting with a letter. It's also the script's entity, `script.cip_cycle`, and it never changes |
| `fields` | What a run takes, up to 32: `number` with `min`, `max`, `step`, and `unit`, `text` with `max_length` and `pattern`, `boolean`, `select` with `options`, `entity` with the `domain`s it takes, `duration` (seconds, or `90s`, `1h30m`), `alarm`, and `tag`. Each can be `required` or have a `default`. A step reads one as `vars.<name>` |
| `sequence` | The steps, in the [automation](/gateway/automations/) language: `call_service`, `write_tag`, `condition`, `wait`, `stop`, `call_script`, `apply_recipe`, `set_variable`, `delay`, `log_event`, and the rest |
| `mode` | What a second run does while one is going: `skip` (the default), `queue`, `restart`, `parallel` ([run modes](#run-modes)) |
| `maxRuntimeSec` | The longest one run may take. Zero means five minutes |

A script is compiled when you save it, the same as a rule. A step that doesn't decode, an expression that doesn't compile, a wait longer than a run is allowed to take, a default its own field would refuse, a script that would end up calling itself: all refused at save. You find out in the editor, not from a pump that stopped halfway through a caustic wash.

## Running one

| From | How | Needs |
|---|---|---|
| The Scripts screen | **Run** on its card, fill in the form | `scripts.run` |
| Its entity | **Run** on the `script.<id>` tile, or `POST /api/services/script/turn_on` with the fields as the data | `scripts.run` |
| The API | `POST /api/scripts/{id}/run` with `{"fields": {"minutes": 20}, "reason": "end of shift clean"}` | `scripts.run` |
| A rule | a `call_script` step ([below](#from-a-rule-and-from-other-scripts)) | the rule's own |
| An agent | the `run_script` MCP tool, with a required `reason` | `HOTLOOP_ALLOW_MCP_WRITES` on |

A run answers as soon as it has started, with its id (`202`). Send `"wait": true` and it answers when the run ends instead (`200`), with its outcome and the trace of every step.

**Stop** on the screen, `POST /api/scripts/{id}/stop`, or `script.turn_off` cancels every run of that script right where it is, in every process, mid-wait or mid-delay included. Whatever a step already wrote stays written. Undoing is a write too, one nobody asked for, to equipment that has already moved, and that decision belongs to the operator, not to us.

## Fields are checked, never fixed

Before the first step runs, what the run was handed is checked against the fields. Every value has to be one its field takes, every required one has to be there, and a field the script doesn't have is an error, not something quietly ignored.

**A value is never moved to fit.** 70 minutes on a field whose max is 60 is refused, not trimmed to 60. `"12"` for a number is refused, not parsed. 12.5 on a step of 5 is refused, not rounded. The value that goes on to command equipment is exactly the one somebody entered, or nothing runs. A refused run leaves nothing behind in the history, because nothing started.

## Every write goes through the gate

A script runs as **`script:<id>`**. Every write it makes, every service call, and every log line carries that as its actor, and every write is audited against it in `GET /api/writes`, refused or not.

The **source** is whoever started it: `ui` from the screen, `automation` from a rule, `mcp` from an agent. That's the whole point, because the gate decides on source. A script an agent starts writes as `mcp`, and with `HOTLOOP_ALLOW_MCP_WRITES` off, every one of its writes gets refused exactly like the agent's own `write_tag` would. So `run_script` and an agent's `script.turn_on` refuse up front in that case, rather than kicking off a script whose every write is going to bounce.

Each run records who asked (`actor`), how (`source`), and what called it (`parent`, like `automation_run:812` or `script_run:77`). You can walk from any write back to the rule, the script, and the person or agent behind it.

## Ask first: the dry run

**Check first** in the run drawer, `POST /api/scripts/{id}/run?dry_run=true`, or `run_script` with `dryRun: true`. The fields are checked the same way, then every step is walked against the plant as it is right now:

- every `write_tag` and `call_service` is put to the write gate's own checks, the exact code the real write runs, so a dry run can't say yes to something the real write would refuse. Nothing is written, nothing is audited;
- a `condition` is evaluated now, and a false one ends the walk where it would end the run;
- a `set_variable` is bound, so the steps after it see what they would;
- a `call_script` walks the script it calls, numbered under the call (`3.1`, `3.2`);
- an `apply_recipe` runs the [recipe's](/gateway/recipes/) own check;
- a `wait`, a `delay`, and anything that touches no equipment (a message, an HTTP call, an alarm) is `not_checked`. A dry run is not going to sit there for fifteen minutes to tell you what the tank will read then.

Each step's verdict is `would_write`, `refused`, `ends_here`, `not_checked`, or `ok`. The first write that would be refused ends the walk, because it would end the run, and the answer says so in the gate's words: `step 1 (call_service): cip/pump: this tag is not marked writable`.

A clean dry run is advice, not a promise. A device can drop, somebody can disarm a tag, and a `wait` gives the plant all the time it needs to change its mind between your check and the step.

## Run modes

What happens when a run is asked for while another run of the same script is still going. Same words a rule uses, with one difference.

| Mode | A second run |
|---|---|
| `skip` | refused, `409`, and a `skipped` run in the history saying why. **The default**, and the right answer for anything that commands equipment |
| `queue` | waits its turn and starts when the one ahead ends. One deep: a third is refused |
| `restart` | cancels the one in progress where it is, then starts once it has stopped. Two runs never overlap |
| `parallel` | runs alongside |

The difference: a rule's queue drops the older pending run silently, and a script's queue refuses the newer one out loud. A rule gets fired by a trigger that doesn't care. A script gets asked for by somebody, or something, that may be waiting on the answer, and "your run quietly never happened" is not an answer.

A run that hits `maxRuntimeSec` ends `timed_out`, whether it was between steps or in the middle of a wait.

## From a rule, and from other scripts

A `call_script` step runs a script from a rule or from another script. `fieldExpressions` are evaluated when the step runs and merged over `fields`, and the script checks the lot against its own fields, exactly like a run from the screen:

```json
{"type": "call_script", "params": {"scriptId": "cip_cycle", "fields": {"circuit": "tank_2"}, "fieldExpressions": {"minutes": "states['input_number.cip_minutes']"}, "wait": true}}
```

With `"wait": true` the step takes the script's outcome as its own, and the script becomes part of the calling run: cancel the caller, or let it run out of time, and the script stops too. A busy script whose mode refuses another run fails a waiting step (`script busy`). Without `wait`, the script is started and left to finish on its own, and a busy one is just noted in the trace, because all the step was ever going to do was start it.

The script runs as `script:<id>` with the rule's source, `automation`, and its run names the rule's run as its parent. A rule made from a [blueprint](/gateway/blueprints/) can carry the same step, so every rule the blueprint makes calls the one procedure instead of hauling around its own copy.

Two limits, both there because the alternative is a script that loops until somebody pulls the plug:

- **A script that would call itself is refused at save**, directly or through any chain of other scripts: `script b would call itself: b calls a calls b`. An edit that closes a loop is refused the same way.
- **Five deep, at run time.** A sixth script in one chain fails the step that would have called it. If a loop ever sneaks past the save (two processes saving two halves of it in the same instant), the run catches it: a script already running in its own chain is refused, not run a second time.

## Editing and deleting

`PUT /api/scripts/{id}` replaces the definition, and any run in progress is cancelled if its steps, fields, or mode changed, because it was started from the old one. `DELETE /api/scripts/{id}` deletes the script and its run history and cancels its runs. Its entity is orphaned, not deleted: an admin deletes the orphan once nothing refers to it anymore.

## Its entity

Every script is an entity, `script.<id>`. It's `on` while a run of it is going, in any process, and `off` when none is. Its attributes carry its `mode`, how many runs are going (`current`), its `fields`, and when it last started and how that ended (`last_triggered`, `last_status`). It's on the Entities screen with a **Run** button, in `list_entities` over MCP, in `/api/states`, and a rule can trigger on it: "when the CIP cycle goes off, log the batch."

## The run history

Every run is a row in `script_runs`: who, how, the fields it got after they were checked, the trace of every step (resolved inputs, not templates, because that's what you need to read at 3am), and how it ended and why. It's in `GET /api/scripts/{id}/runs`, the run drawer, and the [logbook](/gateway/logbook/) as kind `script`, found by the script's entity or by anything a run wrote to. Each script keeps its newest 500 runs.

A run's row opens before its first step and closes after its last. A process stopping cancels every run in progress where it is, recorded as `cancelled: interrupted by restart`, and a run a crash cut off gets marked the same on the Gateway's next start. **Nothing resumes a run.** A CIP cycle picking itself back up at step four an hour later, with nobody asking and the tank in a whole different state, is a hell of a lot worse than a run that admits it stopped.

`scripts` and `script_runs` are in every backup. A run the backup caught mid-flight comes back marked `interrupted by restart` on the first start.

## More than one process

The Gateway and an `--mcp-stdio` process beside it (or two pods mid-rollout) both run scripts. A run's state lives in the database, and every process listens for changes on `hotloop_script`, so a script started in one process shows `on` everywhere, a script saved on one pod is the script on the other (and its runs there are cancelled if its steps changed), and **Stop** stops every run of it in every process.

The run mode is kept per process, though. Two processes can each start one run of a `skip` script in the same instant. If an agent's process and an operator's screen are firing the same procedure in the same second, that's a people problem, and no lock of ours was ever going to fix it.

## Permissions

| Permission | viewer | operator | admin |
|---|---|---|---|
| `scripts.read`: list them and their runs | yes | yes | yes |
| `scripts.run`: run, dry run, stop, `script.turn_on` and `turn_off` | no | yes | yes |
| `scripts.write`: create, edit, delete | no | no | yes |

Operators run scripts. Admins write them. Running the CIP cycle is what the button is for. Deciding which valves the CIP cycle opens is an engineer's call, and it stays one.

Over [MCP](/gateway/mcp/), `list_scripts` says what each script takes and whether it's running, and `run_script` takes `scriptId`, `fields`, a **required** `reason`, `dryRun`, and `wait`. With `HOTLOOP_ALLOW_MCP_WRITES` off, a dry run is still answered and says the switch is why.

## What's been proven, and on what

The script tests run against the real stack and a Modbus TCP device the test starts in its own process. **That device is a stand-in, not a PLC.**

They cover every run mode, field refusals, the save-time loop refusal, the five-deep cap and the runtime loop catch, a run started by an agent being refused by the gate and audited as the script, a crash's leftover run being marked on start, a dry run that writes nothing, and the entity's `turn_on` and `turn_off`. There are API and MCP tests, a backup restore test, and a headless Chrome test where an admin writes a script, an operator checks it, runs it, and watches the Modbus device take the write. Thirteen protections were broken on purpose (no loop check, no depth cap, source not kept, fields not checked, queue behaving as parallel, a dry run writing for real, `run_script` not gated, and more), and each one failed its test.

Not verified yet: a physical PLC. The two-process behavior (the Gateway and `--mcp-stdio` sharing `hotloop_script`) has no test of its own.

## Routes

| Route | What it does | Needs |
|---|---|---|
| `GET /api/scripts` | every script, its run counters, how many runs are going | `scripts.read` |
| `GET /api/scripts/{id}` | one script | `scripts.read` |
| `POST /api/scripts` | create one; `201`, `400` if it doesn't compile, `409` if the id is taken | `scripts.write` |
| `POST /api/scripts/validate` | check one without saving, for the editor | `scripts.write` |
| `PUT /api/scripts/{id}` | replace it; changed runs in progress are cancelled | `scripts.write` |
| `DELETE /api/scripts/{id}` | delete it and its history; its entity is orphaned | `scripts.write` |
| `POST /api/scripts/{id}/run` | run it; `?dry_run=true` to ask first. `400` for a bad field, `409` when busy | `scripts.run` |
| `POST /api/scripts/{id}/stop` | cancel every run of it, in every process | `scripts.run` |
| `GET /api/scripts/{id}/runs` | its runs, newest first, with traces | `scripts.read` |
