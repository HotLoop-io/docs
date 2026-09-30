---
title: "Model Context Protocol server and client"
description: "The Gateway as an MCP server and client: 25 tools in 4.17.0, up from 16 in 4.16.0, the one write path agents share with operators, and federating sites."
sidebar:
  label: "Model Context Protocol"
  order: 5
---

:::note[25 tools in 4.17.0]
4.17.0 ships 25 tools. 4.16.0 had 16. The nine new ones, for the logbook, scripts, recipes, blueprints and the network, are marked **New in 4.17.0**, and a 4.16.0 Gateway doesn't have them. [Upgrade](/gateway/upgrading/) first. None of the nine lets an agent make a rule or apply a recipe that names its own permission; that stays a person's call.
:::

The Gateway speaks MCP in both directions. Agents can read the plant and, when you allow it, drive it. And an automation rule can call a tool on some other MCP server.

The whole design comes down to one rule: **an agent is a caller like any other.** The tools read through the same cache the screens read and write through the same gate the screens write through. No privileged path, no bypass, no separate policy. A write an operator would be refused, the agent is refused. A write that succeeds lands in the same audit table, with `mcp:` and the client's name as the actor. The day an agent gets something wrong, and it will, is the day you'll be glad it had no side door.

## Serving

### Over HTTP

On by default at `/mcp` on the app's port, behind a bearer token the chart generates into the release Secret:

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

In-cluster, the endpoint is:

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

The token check sits in front of the handler, so a caller without it can't even list what exists. Leave `mcp.token` empty and the chart generates one, so the default deployment is never accidentally the open one. Keep the NetworkPolicy on anyway: a token is the second line of defense, not the only one.

### Over stdio

The same binary serves MCP on stdin and stdout with `--mcp-stdio`, for a client that spawns it directly. Everything else starts too, so the agent sees a live plant instead of a hollow server.

```json
{
  "mcpServers": {
    "hotloop": {
      "command": "/usr/local/bin/hotloop",
      "args": ["--mcp-stdio"],
      "env": {
        "HOTLOOP_DB_HOST": "timescale.plant.local",
        "HOTLOOP_DB_PASSWORD": "…",
        "HOTLOOP_ALLOW_MCP_WRITES": "false"
      }
    }
  }
}
```

In stdio mode every log line goes to stderr, because a single stray byte on stdout corrupts the protocol stream.

## Tools

| Tool | Does | In |
|---|---|---|
| `get_plant_status` | devices online, alarms outstanding, whether writes are enabled | 4.16.0 and 4.17.0 |
| `list_devices` | every device with protocol, address, state, tag count | 4.16.0 and 4.17.0 |
| `describe_device` | one device in detail, with its tags and poll statistics | 4.16.0 and 4.17.0 |
| `list_tags` | search the catalog by device, name or description | 4.16.0 and 4.17.0 |
| `read_tag` | current values, with quality | 4.16.0 and 4.17.0 |
| `query_history` | historical readings, raw or bucketed | 4.16.0 and 4.17.0 |
| `write_tag` | **command a tag** | 4.16.0 and 4.17.0 |
| `list_alarms` | alarms and their ISA-18.2 states | 4.16.0 and 4.17.0 |
| `ack_alarm` | acknowledge on an operator's behalf | 4.16.0 and 4.17.0 |
| `list_automations` | rules, run counts, last outcome | 4.16.0 and 4.17.0 |
| `trigger_automation` | run a rule now | 4.16.0 and 4.17.0 |
| `describe_protocol` | what this build actually speaks | 4.16.0 and 4.17.0 |
| `recent_events` | the system log, to work out what happened in what order | 4.16.0 and 4.17.0 |
| `list_entities` | find entities by domain, equipment node or label, with the services each takes | 4.16.0 and 4.17.0 |
| `get_states` | current state of one or more entities, with quality and attributes | 4.16.0 and 4.17.0 |
| `call_service` | **command an entity**: `switch.turn_on`, `number.set_value` | 4.16.0 and 4.17.0 |
| `get_logbook` | one timeline of state changes, writes, alarms, runs and config changes, by entity, equipment node, actor or kind | 4.17.0 |
| `list_scripts` | the plant's scripts, the fields each takes, whether it's running, its last run | 4.17.0 |
| `run_script` | **run a script**, or ask with `dryRun` what it would do right now | 4.17.0 |
| `list_recipes` | the plant's recipes: targets in order, parameters, precondition, version, last application | 4.17.0 |
| `validate_recipe` | would a recipe apply right now? every reason it would be refused, nothing written | 4.17.0 |
| `apply_recipe` | **apply a recipe**: checked whole, written in order, read back | 4.17.0 |
| `list_blueprints` | the blueprints people fill in to make rules, their inputs and versions | 4.17.0 |
| `preview_blueprint` | the rule a blueprint would make with given inputs, and what it would do now; makes nothing | 4.17.0 |
| `find_network_client` | where a device is on the plant network: its switch port, whether the port has a link, when the UniFi console last saw it | 4.17.0 |

### Entities

An entity is what people call a thing on the plant, `sensor.zone_1_temperature` or `switch.conveyor_run`, wrapping one or more tags. For an agent it's usually the better handle: the name means something, and the entity knows what you can do to it. An agent that has to reason about `press-01/40001` will eventually reason wrong.

`list_entities` filters by `domain`, by `equipment` (a node of the equipment tree by id, name or path of names like `Plant A/Packing`, matching everything at or under it), by `label` (an entity matches if it carries the label or its device does), and by `query`, a substring of the entity_id or name. Each result carries its current state, its quality, and the services it takes as `domain.service`. An entity with no services is read-only.

`get_states` takes `entity_ids` and answers each with its state, quality, attributes and `last_changed`. It holds the same line `read_tag` does: an `unknown` or `unavailable` state comes with a note saying it isn't a value, a disabled entity says it's disabled rather than missing, and bad quality is spelled out.

`call_service` takes `domain`, `service`, `entity_id`, `data` and a **required** `reason`:

```
> call_service domain=number service=set_value entity_id=number.press_01_sp
    data={"value": 212.5} reason="operator asked for 212.5 on zone 1"
Called number.set_value on number.press_01_sp (was 210). Writes: 212.5 to press-01/Setpoint: written
```

It runs through the same entity layer as `POST /api/services/...`, which turns the call into tag writes through the write gate. See [Writing](#writing).

### The network

**New in 4.17.0.**

`find_network_client` answers the first question about a PLC that went quiet: is it the PLC, or its switch port? Give it `deviceId` and it follows that device's confirmed link to its UniFi client. Give it `query` (a MAC, an IP, or part of a name) and it searches every console HotLoop reads.

It answers from the UniFi driver's last read and never asks the console, so an agent polling it in a loop costs the console nothing. That also means an `--mcp-stdio` process answers that no console is read there: it never logs in to one, because the Gateway beside it already holds the session. Point the agent at the Gateway's HTTP endpoint instead. See [UniFi Network](/gateway/unifi/).

### The logbook

**New in 4.17.0.**

`get_logbook` is the plant's timeline: state changes, writes, alarm transitions, automation runs and config changes, newest first. It narrows by `entity`, by `equipment` (id, name or path, and everything under it; a name that matches two nodes is an error listing both), by `actor` (part of it, so `mcp:` finds everything any agent did), by `kinds` (`state`, `write`, `alarm`, `automation`, `event`, `script`, `recipe`), and by `minutes` back (a day by default). It returns 50 entries by default, 1,000 at most, and a page with more after it ends by saying what to pass as `before` for the next.

For "what happened right before this went wrong", it beats `recent_events`: the equipment's own state changes are in it, and the gate's lines aren't in it twice. See [Logbook](/gateway/logbook/).

### Scripts

**New in 4.17.0.**

A script is a named sequence somebody wrote once, the CIP cycle or the line purge, so an agent runs the plant's own procedure instead of improvising one. `list_scripts` says what each takes. `run_script` takes `scriptId`, `fields`, a **required** `reason`, and two switches:

- `dryRun: true` walks the script against the plant as it is right now and says, step by step, what would be written and the first thing the gate would refuse, in the gate's words. Nothing is written or audited. Tell your agent to ask this first.
- `wait: true` answers once the run has ended, with its outcome and trace. Without it the answer is the run id, and `list_scripts`, or `get_logbook` with `kinds: ["script"]`, says how it ended.

The run belongs to the script, as `script:<id>`, with the source `mcp`, so every write it makes meets the agent switch in the gate exactly like `write_tag`. With `HOTLOOP_ALLOW_MCP_WRITES` off, `run_script` refuses before anything runs. A dry run is still answered, and names the switch as the reason. See [Scripts](/gateway/scripts/).

### Recipes

**New in 4.17.0.**

A recipe is a set of setpoints the plant applies together, a product grade or a changeover, so an agent loads the plant's own numbers instead of writing them one at a time and getting bored halfway. `list_recipes` shows each one's targets in order and the parameters it takes. `validate_recipe` asks whether one would apply right now and gives every reason it wouldn't, writing nothing. `apply_recipe` takes `recipeId`, `params`, an optional `version`, and a **required** `reason`.

The recipe is checked whole first and refused whole, with nothing written, if any value would be refused. Out of range is refused, never adjusted. Then the targets go out in order under one call id, the first one that fails stops the rest, and nothing is rolled back. The answer says, target by target, what went out and whether the device read the value back.

The writes are the agent's, with the source `mcp`, so the agent switch applies to each one in the gate. With `HOTLOOP_ALLOW_MCP_WRITES` off, `apply_recipe` refuses before anything is checked. A recipe that names its own apply permission is for the people granted it, and an agent is never one of them. See [Recipes](/gateway/recipes/).

### Blueprints

**New in 4.17.0.**

A blueprint is a rule written once with typed blanks: which motor, how long, what limit. `list_blueprints` says what each takes. `preview_blueprint` takes `blueprintId`, `automationId` and `inputs`, and answers with the rule it would make and what that rule would do if it fired right now, every write put to the gate's checks. The inputs are checked exactly the way the screen checks them: out of range is refused, not adjusted.

**An agent can't make the rule.** There's no tool for it, on purpose. A rule is a standing order to command equipment every time its trigger fires, for months after the conversation that suggested it is over, and whether a plant has one is a person's call, made on the Blueprints screen with their name on it. So the agent does the useful part (finds the blueprint, works out the inputs, shows what the rule would do) and hands the decision to a human. The preview stores nothing and writes nothing, so it answers whatever `HOTLOOP_ALLOW_MCP_WRITES` says. See [Blueprints](/gateway/blueprints/).

## Resources

| URI | Contents |
|---|---|
| `iiot://devices` | the device tree with tags, as JSON |
| `iiot://tags` | the tag catalog with current values |
| `iiot://alarms` | alarm definitions, live state, and a state reference |
| `iiot://protocols` | supported protocols, from the compiled-in drivers |

Resources let a client pull the whole namespace in one read instead of discovering it one tool call at a time.

## What the tools will not do

The tools are written so a model can't round off uncertainty by accident. Models love a confident number. These tools don't hand them one they haven't earned.

**A tag with no reading is not a tag reading zero.** `read_tag` says `no reading has been taken for this tag yet`, or `this tag is not configured` if it doesn't exist. Neither returns a value.

**Bad quality is stated, never implied.** Readings come back as `[quality: bad (the value is NOT known; do not treat it as a measurement)]`, and the server instructions repeat it. Don't average across bad readings, and don't report one as a measurement.

**`describe_protocol` can't lie.** What it lists comes from the drivers compiled into the binary, so it can't claim a protocol this Gateway doesn't have.

**A refusal is an answer, not a transport failure.** A refused write comes back as a tool result with `isError`: the call was well-formed and deliberately declined. It isn't a protocol error, and retrying gets the same answer.

## Writing

`write_tag` moves real equipment. Between a tool call and a machine sit the same checks an operator's write meets, and the two that matter most for agents are the switches:

1. `HOTLOOP_ALLOW_WRITES` (`safety.allowWrites` in the chart) must be on.
2. `HOTLOOP_ALLOW_MCP_WRITES` (`safety.allowMcpWrites`) must be on. It narrows the master switch and never goes around it: with writes on and this off, an operator can command a tag and an agent can't.
3. The tag must be marked writable. Tags are read-only until somebody says otherwise, one at a time.
4. The value must be inside the tag's configured range. It's **refused, not clamped**, because sending 400 when somebody asked for 500 is quietly doing something nobody asked for.

A **reason is required**, and it goes in the system log beside the write. An audit row nobody can interpret six months later is barely better than no row.

`call_service` meets exactly the same checks, because it's nothing but writes through the same gate, and then the entity's own on top: a number's step and narrower range, a text's pattern, the entity not being disabled. A refusal at any of them is audited against the entity as well as the tag: source `mcp`, the client by name, the entity_id, the service and the call id. A call without a reason is refused before anything is attempted, same as `write_tag`.

`trigger_automation` refuses outright unless both switches are on, because a rule's actions can command equipment and it would otherwise be a way around `write_tag` being switched off.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

To run a read-only agent, leave `safety.allowMcpWrites` at its default, `false`. The server instructions then tell clients up front that writes are off, so an agent doesn't burn a turn finding out. [The write gate](/gateway/write-gate/) has every check in order and what each refusal answers.

## Calling out

An automation's `mcp_call` action invokes a tool on another MCP server. Configure the servers in the chart:

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

Sessions are pooled and reused, because connecting per call would mean a handshake, an initialize and a tool listing every time a rule fires. A session that died is reconnected on the next call, not on a timer, because the next call is the first moment anybody cares. A configured server that's down doesn't stop the plant being monitored. Nothing is dialed until a rule needs it.

The MCP screen shows each configured server, whether it's connected, and the tools it advertises.

## Federating sites

One Gateway per plant is how this is meant to run. Each site keeps its own database, its own board and its own name, and none of them depend on a link to anywhere else staying up. A plant doesn't stop being monitored because the WAN dropped.

Seeing all of them at once uses the protocol the sites already speak. Configure a Gateway in the cloud with the sites as outbound MCP servers, exactly as for `mcp_call`:

```
HOTLOOP_MCP_SERVER_1_NAME=macedonia
HOTLOOP_MCP_SERVER_1_URL=https://macedonia.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

The Sites screen then calls `get_plant_status` on each of them in parallel and rolls the answers up. There's nothing to deploy at a site to make it show up, no site has to know it's federated, and nothing connects inward to a plant network.

Two behaviors are deliberate, and you can rely on them:

- A site that doesn't answer is shown as **unreachable, with the reason**, and left out of the roll-up. Counting a plant you can't reach as zero alarms is the single worst thing a screen like this could do.
- The numbers a site last reported are never shown. They look current, and they aren't.

Each site gets its own short deadline, so one plant on a dead link can't hold up the ones that are fine.

## Worth telling an agent

The server's own instructions cover this, but if you're writing a prompt around it:

- Alarm states follow ISA-18.2. `rtn-unack` means an alarm cleared on its own before anybody saw it. It's still worth reporting, and it's the state that proves acknowledgment and return-to-normal are independent.
- Use `query_history` with buckets, not raw, for anything longer than a few minutes. A day of one-second data is 86,400 points per tag. Buckets only aggregate good readings: bad and uncertain ones are counted in `badReadings`, never averaged in, and a bucket with nothing good has a null average.
- `recent_events` reconstructs an incident: device connections, writes, alarm transitions, automation runs and config changes, in order, each with the actor that caused it. Since 4.17.0, `get_logbook` does it better.
