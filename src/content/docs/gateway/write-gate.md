---
title: "The write gate: safe writes to equipment"
description: Every write, from the UI, the API, an automation, or an agent, goes through one function that cannot be routed around. Here is what it checks.
sidebar:
  label: "The write gate"
---

This software can command machinery, so it is worth being precise about what stands in the way.

Every write goes through **one function that cannot be routed around**, whether it comes from the UI, the API, an automation, or an agent. Policy lives in that one place rather than being re-implemented at each call site, where one of them would eventually be forgotten.

## What it checks

1. **Writes must be enabled.** `safety.allowWrites` is off by default, and has been since 4.4.0.
2. **Agent writes must additionally be enabled.** `safety.allowMcpWrites` is a *narrowing* of the master switch, not a way around it. With writes on and this off, an operator can command a tag and an agent cannot.
3. **The caller must have permission.** `values.write` for a logged-in user, which a viewer does not have and an operator and an admin do, and the MCP write setting for an MCP client.
4. **The tag must be marked `writable`.** Tags are read-only until somebody decides otherwise, one at a time. A browse import never arms anything.
5. **The value must be within the tag's range.** It is **rejected, not clamped**, because sending 400 when someone asked for 500 is quietly doing something else.
6. **The attempt is audited.** Before the value reaches the wire, including every refusal, with the actor and the source. The actor is the logged-in username, not a header anyone could set.

An MCP client gets no special path. `write_tag` hits the same gate an operator does, and it requires a stated reason that is recorded next to the write.

## Why writes default to off

Before 4.4.0, `safety.allowWrites` and `safety.allowMcpWrites` were `true` by default. They are `false` now. A tag is still read-only until marked otherwise regardless, but a fresh install should not be one `writable: true` flag away from commanding equipment before anyone has looked at it.

## Turning writes on, deliberately

1. Add the device, and discover tags where the protocol supports it. Modbus and S7comm cannot enumerate their own points, so declare those from the device documentation.
2. Mark tags writable one at a time.
3. Turn on `safety.allowWrites` when you are ready to command anything.

## What this does not do

The application cannot enforce everything, and it is better to say so than to imply otherwise. If you push node commands to edge relays over MQTT, the broker's own access controls should restrict who can publish them to the Gateway's credentials. See [Model Context Protocol](/gateway/mcp/) for how agents reach the same gate.
