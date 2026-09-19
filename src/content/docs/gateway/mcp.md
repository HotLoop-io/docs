---
title: "Model Context Protocol server and client"
description: "The Gateway as an MCP server and client: tools, resources, the write path, and how sites are federated."
sidebar:
  label: "Model Context Protocol"
  order: 5
---

The gateway speaks MCP in both directions: agents can read and drive the plant,
and an automation rule can call a tool somewhere else.

The design rule is that **an agent is a caller like any other**. The tools read
through the same cache the UI reads and write through the same gate the UI
writes through. There is no privileged path, no bypass, and no separate policy.
A write an operator would be refused is refused; a write that succeeds lands in
the same audit table with `mcp:` in front of the actor.

## Serving

### Over HTTP

Enabled by default at `/mcp` on the app's port, protected by a bearer token the
chart generates into the release Secret.

```bash
kubectl -n hotloop get secret <release> \
  -o jsonpath='{.data.mcp-token}' | base64 -d
```

In-cluster, the endpoint is:

```
http://<release>.<namespace>.svc.cluster.local:8080/mcp
```

The token check sits in front of the handler, so an unauthenticated caller
cannot even enumerate what exists. Leaving `mcp.token` empty makes the chart
generate one. The default deployment is not accidentally the open one. Combine
it with the NetworkPolicy; a token is a second line of defense, not the only one.

### Over stdio

The same binary serves MCP on stdin and stdout with `--mcp-stdio`, for a client
that spawns it directly. Everything else starts too, so the agent sees a live
plant rather than a hollow server.

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

In stdio mode all logging goes to stderr. Anything written to stdout would
corrupt the protocol stream.

## Tools

| Tool | Does |
|---|---|
| `get_plant_status` | devices online, alarms outstanding, whether writes are enabled |
| `list_devices` | every device with protocol, address, state, tag count |
| `describe_device` | one device in detail, with its tags and poll statistics |
| `list_tags` | search the catalog by device, name or description |
| `read_tag` | current values, with quality |
| `query_history` | historical readings, raw or bucketed |
| `write_tag` | **command a tag** |
| `list_alarms` | alarms and their ISA-18.2 states |
| `ack_alarm` | acknowledge on an operator's behalf |
| `list_automations` | rules, run counts, last outcome |
| `trigger_automation` | run a rule now |
| `describe_protocol` | what this build actually speaks |
| `recent_events` | the system log, to work out what happened in what order |

## Resources

| URI | Contents |
|---|---|
| `iiot://devices` | the device tree with tags, as JSON |
| `iiot://tags` | the tag catalog with current values |
| `iiot://alarms` | alarm definitions, live state, and a state reference |
| `iiot://protocols` | supported protocols, from the compiled-in drivers |

Resources exist so a client can pull the whole namespace in one read rather than
discovering it a tool call at a time.

## What the tools will not do

The tools are written so that a model cannot round off uncertainty by accident.

**A tag with no reading is not a tag reading zero.** `read_tag` says
`no reading has been taken for this tag yet`, or `this tag is not configured` if
it does not exist. Neither returns a value.

**Bad quality is stated, not implied.** Readings come back as
`[quality: bad (the value is NOT known; do not treat it as a measurement)]`. The
server instructions repeat it. Do not average across bad readings and do not
report one as a measurement.

**`describe_protocol` cannot lie.** Availability comes from the drivers compiled
into the binary, so the tool cannot claim a protocol the gateway does not have.

**A refusal is an answer, not a transport failure.** A refused write comes back
as a tool result with `isError`, meaning the call was well-formed and
deliberately declined. It is not a protocol error to be retried.

## Writing

`write_tag` moves real equipment. Four things stand between a tool call and a
machine:

1. `HOTLOOP_ALLOW_WRITES` must be on.
2. `HOTLOOP_ALLOW_MCP_WRITES` must be on. This is a *narrowing* of the master
   switch, not a way around it: with writes on and this off, an operator can
   command a tag and an agent cannot.
3. The tag must be marked writable. Tags are read-only until somebody says
   otherwise, one at a time.
4. The value must be within the tag's configured range. It is **rejected, not
   clamped**, because sending 400 when someone asked for 500 is quietly doing something
   different from what was asked.

A **reason is required** and is recorded next to the write. An audit row nobody
can interpret six months later is barely better than none.

`trigger_automation` is gated identically, because a rule's actions can command
equipment; otherwise it would be a way around `write_tag` being switched off.

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

To run a read-only agent, set `allowMcpWrites: false`. The server instructions
then tell clients up front that writes are disabled, so an agent does not waste
a turn discovering it.

## Calling out

An automation's `mcp_call` action invokes a tool on another MCP server. Configure
the servers in the chart:

```yaml
mcp:
  outboundServers:
    - name: maintenance
      url: http://maintenance-mcp.default.svc.cluster.local:8080/mcp
      existingSecret: maintenance-mcp-token
      secretKey: token
```

Sessions are pooled and reused; connecting per call would mean a handshake, an
initialize and a tool listing every time a rule fires. A session that has died
is reconnected on the next call rather than on a timer, because the next call is
the first moment anybody cares. A configured server that is down does not stop
the plant being monitored. Nothing is dialed until a rule needs it.

The MCP screen shows each configured server, whether it is connected, and the
tools it advertises.

## Federating sites

One gateway per plant is how this is meant to run. Each site keeps its own
database, its own board and its own name, and none of them depend on a link to
anywhere else staying up. A plant does not stop being monitored because the WAN
dropped.

Seeing all of them at once uses the protocol the sites already speak. Configure
a gateway at the cloud with the sites as outbound MCP servers, exactly as for the
`mcp_call` action:

```
HOTLOOP_MCP_SERVER_1_NAME=macedonia
HOTLOOP_MCP_SERVER_1_URL=https://macedonia.example/mcp
HOTLOOP_MCP_SERVER_1_TOKEN=…
HOTLOOP_MCP_SERVER_2_NAME=ashtabula
HOTLOOP_MCP_SERVER_2_URL=https://ashtabula.example/mcp
HOTLOOP_MCP_SERVER_2_TOKEN=…
```

The Sites screen then calls `get_plant_status` on each of them in parallel and
rolls the answers up. There is nothing to deploy at a site to make it appear, no
site has to know it is federated, and nothing connects inward to a plant network.

Two behaviors are deliberate and worth relying on:

- A site that does not answer is shown as **unreachable, with the reason**, and
  is left out of the roll-up. Counting a plant you cannot reach as zero alarms is
  the worst thing a screen like this could do.
- The numbers a site last reported are never shown. They look current and are not.

Each site gets its own short deadline, so one plant on a dead link cannot hold up
the ones that are up.

## Worth telling an agent

The server's own instructions cover this, but for anyone writing a prompt around
it:

- Alarm states follow ISA-18.2. `rtn-unack` means an alarm cleared on its own
  before anybody saw it. It is still worth reporting, and it is the state that
  proves acknowledgement and return-to-normal are independent.
- `query_history` with buckets, not raw, for anything longer than a few minutes.
  A day of one-second data is 86,400 points per tag.
- `recent_events` is the way to reconstruct an incident: device connections,
  writes, alarm transitions, automation runs and configuration changes, in order,
  each with the actor that caused it.
