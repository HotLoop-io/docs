---
title: "The write gate: safe writes to equipment"
description: "Every write, from a screen, the API, a rule, a script, a recipe or an agent, goes through one function. What it checks, in order, and what refusals answer."
sidebar:
  label: "The write gate"
---

This thing can move machinery. So here is exactly what stands between a request and a device, in the order the code runs it.

Every value headed for a device goes through **one function that can't be routed around**: a click on a screen, `POST /api/write`, an entity service call, an automation, a script, a recipe, an agent over MCP. The policy lives there and only there, because a check copied into six call sites is a check somebody forgets to add to the seventh, and the seventh is always the one that writes to the live press. A test fails the build if anything in the runtime can reach a device's write except through the gate, and it proves it can fail by planting four kinds of bypass in a copy of the package and catching every one.

Want to feel it instead of read it? [hotloop.io has an interactive version](https://hotloop.io/gateway/#the-gate). Flip the switches, send a setpoint, and watch exactly where it bounces.

## The checks, in order

1. **The caller may write.** This one happens at the API's door, before the gate. A logged-in user needs `values.write` to call `POST /api/write`: operators and admins have it, viewers don't, and without it the API answers 403. An agent's door is the MCP bearer token, and without that it gets a 401 and never even sees the tool list. Either way the gate never hears a word, so it isn't in the write audit. (An entity service call works differently, [below](#every-door-same-gate).)
2. **Writes are on.** `safety.allowWrites`, the master switch. Off by default since 4.4.0.
3. **Agent writes are on.** `safety.allowMcpWrites`, checked only when the request came in over MCP. It narrows the master switch and can never go around it: with writes on and this off, an operator can command a tag and an agent can't. Set it on with `safety.allowWrites` off and the Gateway refuses to start, rather than leave you guessing which one wins.
4. **The tag is armed.** Every tag is read-only until somebody marks it `writable`, one at a time, on purpose. A browse import of 4,000 tags arms none of them. A tag that doesn't exist is refused here too.
5. **The value is in range.** When the tag has a range and the value is a number, a value outside it is **refused, never clamped**. Somebody who typed 500 on a tag that tops out at 400 made a mistake they need to hear about. Quietly sending 400 means doing something nobody asked for, and they never find out.
6. **The caller's own check passes.** An entity adds what only the entity knows: a number's step and narrower range, a text's pattern and length, a select's options, a loop's output refused unless the loop reads manual right now, the entity being disabled or deleted mid-call. It runs inside the gate, after the tag's policy and range so an operator always hears about the tag first, and before the audit row so an entity refusal is recorded exactly like a tag one. It can only refuse. It can't change the value or let through anything the gate would have stopped.
7. **The device is running.** HotLoop has a running worker for it. A disabled device, or one that never started, is refused with `the device is not connected` instead of a value thrown at nothing.

**Only then is the audit row opened, and only then does the value go out.** If the row can't be written, the write isn't sent at all. An unauditable write is one nobody can account for afterwards, and on equipment that moves, that isn't a trade worth making. The row is finished with the result and the latency on a context cut loose from the request, so a write that times out or gets canceled still records what happened.

Every refusal from check 2 onward is audited as a refusal: a row with the actor, the source, the value that was asked for, the value it would have replaced, and `refused:` with the reason, plus a warning in the system log. Somebody repeatedly trying to command a tag they aren't allowed to is invisible unless it's written down, and an engineer should be able to find it after the fact. Check 1 isn't in the write audit, because the gate never saw it.

### Why that order

Policy runs before the audit row opens, so a refusal is recorded as a refusal and not as an attempt that happened to fail. The audit row opens before the value reaches the wire, so a write that hangs, or takes the process down with it, still left evidence that it was attempted. On a plant floor, "we don't know whether that command went out" is the worst answer there is.

### One thing check 7 doesn't catch

Check 7 asks whether the device has a worker, not whether its session is up at this exact instant. A device that dropped off the network and is reconnecting passes it. The audit row opens, the driver has no session, and the write fails as `the device is not connected`, recorded as a failed attempt rather than a refusal. Nothing reaches the device either way. The [dry run](#ask-before-you-send-the-dry-run) checks the session as well, and says so up front.

## What each refusal answers

The status code says whose problem it is, because that's how an operator reads it.

| What happened | The error says | HTTP |
|---|---|---|
| No permission, at the door | `<user> does not have the "values.write" permission` | 403 |
| Writes are off | `writes are disabled on this deployment` | 403 |
| Agent writes are off | `writes from MCP clients are disabled on this deployment` | 403 |
| The tag isn't armed | `this tag is not marked writable` | 403 |
| The entity is disabled | `the entity is disabled` | 403 |
| The tag doesn't exist | the tag, and `not found` | 404 |
| The entity vanished mid-call, or isn't in a state that allows it (a loop not in manual) | what changed | 409 |
| The value is outside the tag's range | `value is outside the tag's configured range` | 422 |
| The entity doesn't accept the value (step, pattern, options, its own range) | `the value is not one this entity accepts`, and why | 422 |
| The device isn't connected | `the device is not connected` | 503 |
| The device answered and said no | the device's own words | 502 |
| The write couldn't be audited, or anything else the API can't place | `internal error (ref …)`, with the detail in the server log under that ref | 500 |

Anything the API can't place is a 500. It used to be a 400, which meant a database outage told an operator they'd typed something wrong, and they went hunting for a typo that wasn't there.

Over MCP there are no status codes. A refusal comes back as a tool result marked `isError`, in the gate's own words:

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

That's an answer, not a transport failure. The call was understood and deliberately declined, and retrying it gets the same answer.

## Ask before you send: the dry run

The gate has a second entry point that asks without doing. It runs the same checks, in the same order, and gives the same error text for a refusal. It opens no audit row, raises no event, counts nothing, and never reaches the device. It even goes one step further than the real write: a device whose worker is up but whose session is down is reported as not connected, instead of "this would go out".

Where you get it:

- **Entity service calls**: `POST /api/services/{domain}/{service}?dry_run=true`. It answers 200 with the verdict: each write it would make as `would_write`, or the first that would be refused as `not_sent`, with the reason word for word. A request that couldn't even be planned (no such entity, a service the domain doesn't take, bad data) answers with the same status the real call would. `dry_run` takes `true` or `false` and nothing else, and `yes` is a 400, because a guess the wrong way turns a question into a command.
- **The command prompt** asks while you type and shows "Would be refused: ..." before anybody confirms.
- **Scripts**, new in 4.17.0: `POST /api/scripts/{id}/run?dry_run=true`, **Check first** in the run drawer, or MCP's `run_script` with `dryRun`. Every step is walked against the plant as it is right now, and the first write that would be refused ends the walk in the gate's words. See [Scripts](/gateway/scripts/).
- **Recipes**, new in 4.17.0: every target is put to these checks before the first value goes out, and one bad value refuses the whole recipe with nothing written. `POST /api/recipes/{id}/validate` and MCP's `validate_recipe` ask without applying. See [Recipes](/gateway/recipes/).
- **Blueprints**, new in 4.17.0: **Check first** shows what the rule would do if it fired right now, every write put to these checks, before the rule exists. See [Blueprints](/gateway/blueprints/).

A clean dry run is advice, not a promise. The gate still decides at the real write, because a device can drop, or somebody can disarm a tag, between your question and your command.

:::caution[Still on 4.16.0? The prompt can swallow a Set]
In 4.16.0 the dry run's verdict lands about a quarter second after you stop typing, right as the mouse heads for Set, and the prompt grows or shrinks under it. Set moves about 30px, so the click hits empty space, or hits the backdrop and closes the prompt. The operator watches it close, figures the setpoint went out, and nothing was written. Fixed in 4.17.0: the verdict sits beside the buttons and nothing moves. Until you [upgrade](/gateway/upgrading/), check the value actually changed after you press Set.
:::

## Every door, same gate

- **The screens and `POST /api/write`.** The actor is the logged-in username, not a header anyone could set.
- **Entity services**, `POST /api/services/{domain}/{service}`. `switch.turn_on` on `switch.press_01_pump` is a tag write through this gate, audited against the entity with its entity_id, the service and a call id. A button's press is two writes under one call id. A user without `values.write` isn't stopped at the door here: the missing permission is handed to the gate as the caller's own check, so a denied entity call is audited against the entity, with the value that was asked for, like any other refusal, and still answers 403.
- **Automations** write as `automation:<rule-id>`. A rule gets no more privilege than a person. See [Automations](/gateway/automations/).
- **Scripts**, new in 4.17.0, write as `script:<id>` and keep the source of whoever started them, so a script an agent kicks off hits the agent switch exactly like the agent's own `write_tag` would.
- **Recipes**, new in 4.17.0, write every target under one call id, so `GET /api/writes?call=<id>` is the whole application in the audit trail.
- **Agents** write as `mcp:<client name>`. `write_tag` and `call_service` hit the same checks an operator does, and both refuse to run without a stated reason, which goes in the system log beside the write. An audit row nobody can explain six months later is just a timestamp with a guilty conscience. `trigger_automation` refuses outright while agent writes are off, and so do `run_script` and `apply_recipe`, because a rule, a script or a recipe can command equipment and would otherwise be a way around the switch. See [Model Context Protocol](/gateway/mcp/).

## Why writes default to off

Before 4.4.0, `safety.allowWrites` and `safety.allowMcpWrites` were `true` by default. They're `false` now. A tag was always read-only until armed, but a fresh install shouldn't be one `writable` flag away from commanding equipment before anybody has looked at it.

On top of the gate, `safety.confirmWrites` (on by default) makes the screens ask for confirmation before they send anything. That's a prompt in the browser, not a check in the gate, and it's the one safety setting you can change from the Settings screen. `safety.allowWrites` and `safety.allowMcpWrites` are read-only there on purpose: the master control over whether this process can command equipment doesn't belong behind the same browser session that issues the writes.

## Turning writes on, deliberately

1. Add the device and discover its tags where the protocol can list them. Modbus and S7comm can't enumerate their own points, so declare those from the device's documentation.
2. Mark tags writable one at a time, and only the ones you mean.
3. Set `safety.allowWrites: true` in your values file and `helm upgrade`. Until you do, nothing in steps 1 and 2 can move a valve.
4. Only if agents should command equipment too, set `safety.allowMcpWrites: true`.

## What it doesn't do

The application can't enforce everything, and it's better to say so than to let you assume.

- **It isn't an interlock.** A trip that protects people or the plant belongs in the PLC, hard-wired where it has to be, not in anything that runs on a network.
- **It doesn't police your broker.** If you push node commands to edge relays over MQTT, the broker's own access control has to restrict who can publish them to the Gateway's credentials.
- **The OPC UA server can't write at all.** It's read-only, with no write handler and no setting that adds one, so the SCADA reading it can't command anything through it.
