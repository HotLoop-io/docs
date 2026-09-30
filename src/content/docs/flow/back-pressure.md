---
title: "Back-pressure and bounded queues in Flow"
description: "Everything unbounded in Node-RED has a ceiling in Flow, and hitting it is loud. What's bounded, what happens at the limit, and what to alert on."
sidebar:
  label: "Back-pressure and bounded queues"
---

This is the whole project, so it gets its own page. Every wire hop in Node-RED goes through `setImmediate`, and nothing limits how much piles up there. Feed a slow sink from a fast source and it grows until the kubelet OOM-kills the pod, and the log it leaves behind tells whoever's holding the pager at 3 AM absolutely nothing.

In Flow, every place a queue could grow without limit has one, and hitting it is loud. Nothing disappears silently. A dropped message is counted, shows up in the editor as an event, and lands in a metric you can alert on. You hear about a limit from a graph, not from an angry operator.

## What is bounded

| Area | Node-RED | Flow |
|---|---|---|
| Node inbox | Unbounded | Bounded, four overflow policies |
| Delay and rate-limit queue | Unbounded | Bounded, refused to a Catch node past the limit |
| Trigger timers | Unbounded | Bounded |
| `exec` output | Buffered without limit | Capped per stream, truncation raises an error |
| `exec` concurrency | One process per message | Bounded, refused past the limit |
| File read | Whole file into memory | Capped, with per-line and chunked modes offered |
| HTTP request body | Unbounded | Capped |
| HTTP response wait | Forever | 504 after a timeout |
| TCP connections and frame size | Unbounded | Bounded |
| WebSocket send queue | Unbounded | Bounded, slow client disconnected |

Every row is a written, documented divergence in the [node list](https://hotloop.io/integrations/#flow-nodes), not a limit that got slipped in quietly. The HTTP row is a good example of why: a request no HTTP Response node answers is held open forever in Node-RED, one leaked connection per request, until the process runs out of sockets and stops answering with nothing in the log.

## The overflow policies

Every node's inbox holds 1,024 messages by default. What happens when it's full is the overflow policy, and that setting doesn't exist in Node-RED at all.

| Policy | Behavior |
|---|---|
| `block` | The sender waits for space, up to `blockTimeout`. Back-pressure propagates upstream, which is the right answer almost always. |
| `drop-newest` | Discard the arriving message. Counted and announced. |
| `drop-oldest` | Discard the head of the queue to make room. Counted and announced. For flows where only the latest reading matters. |
| `error` | Refuse the send and raise it to a Catch node, and let the flow decide. |

The defaults live in the config file:

```yaml
runtime:
  inboxCapacity: 1024
  overflow: block           # block | drop-newest | drop-oldest | error
  blockTimeout: 30s
```

`HOTLOOP_FLOW_INBOX_CAPACITY` and `HOTLOOP_FLOW_OVERFLOW` override the first two from the environment, and the Helm chart takes the same three under `runtime`. `blockTimeout` is file only.

A single node can override both with `ew_inboxCapacity` and `ew_overflow` in its entry in the flow file, so a known-bursty branch gets a deeper queue or a lossy policy without changing the whole runtime. The editor has no field for either yet, so that's a hand edit.

`block` has a floor under it. A flow is allowed to contain a cycle, and a cycle of full inboxes all blocking on each other would deadlock forever. So when a sender has waited `blockTimeout`, the message is dropped, counted, and raised to a Catch node as an error. The flow keeps running and you find out, instead of the runtime wedging silently.

## Choosing one

Use `block` unless you have a reason not to. The pressure goes back up the wire to the source instead of piling up in the middle, which is the whole point.

Use `drop-oldest` when only the latest reading matters, like a gauge on a screen. A temperature from forty seconds ago is worth nothing once you've got the current one.

Use `error` when overload means something to the flow itself and it should decide, by handling it at a Catch node.

`drop-newest` keeps what's already queued and throws away what arrives, for when the backlog is the part that matters.

## What to alert on

Prometheus at `/metrics`, per node, with `node` and `type` labels on everything:

| Metric | What it tells you |
|---|---|
| `hotloop_flow_node_queue_high_water` | The deepest that inbox has ever been since the node started. |
| `hotloop_flow_node_queue_capacity` | Where the overflow policy starts applying. |
| `hotloop_flow_node_queue_length` | Messages waiting right now. |
| `hotloop_flow_node_sends_blocked_total` | Times a sender had to wait for space. Sustained, it means the flow can't keep up. |
| `hotloop_flow_node_messages_dropped_total` | Messages discarded because an inbox was full. |

The alert that matters is high water against capacity:

```text
hotloop_flow_node_queue_high_water / hotloop_flow_node_queue_capacity > 0.8
```

It goes off while there's still headroom, before a single message is dropped, and it's the one number Node-RED structurally can't give you, since there's no distance to measure to a limit that isn't there. High water only goes down when the node restarts, and every deploy restarts every node, so treat it as "this has come close." For "this is happening right now," alert on `rate(hotloop_flow_node_sends_blocked_total[5m])` staying above zero, or on any increase in dropped messages.

## Concurrency

Every node instance gets its own goroutine, ordered within a node and parallel across nodes. One CPU-heavy Function node costs you a core, not the runtime, the editor API and every other node's I/O, which is what it costs on a single event loop.

## Cloning

Node-RED gives the first recipient on a wire the original message and clones only for the rest. It's a documented memory optimization. It's also how two branches that each believe the message is theirs end up quietly corrupting each other, and why one branch behaves differently from its identical-looking sibling for no reason but the order you wired them in. That's the kind of bug that makes you question your own eyes.

Every recipient in Flow gets its own copy, and that isn't free:

- Copying a small message, a reading and a topic, costs 411 to 453 ns and 680 bytes.
- A five-node chain moves a message every 1.14 to 1.40 µs, copies included.
- A 1 MiB binary buffer would cost 128 to 156 µs and another megabyte of heap for every recipient.

That last one is where copying really hurts, so large binary payloads travel as `ImmutableBytes`, which shares the buffer instead of copying it: 250 to 279 ns and 360 bytes for the same 1 MiB message. The file and HTTP nodes already hand binary payloads out that way, so it happens without you doing anything.

Those numbers are `go test -run=XXX -bench='Clone|ChainThroughput' -benchmem -count=5 ./internal/engine/ ./internal/runtime/`, on Linux under WSL2, a 24-CPU Ryzen 9 7900X, Go 1.27.1, on 2026-09-29.

## Atomic context operations

Node-RED's context API is get and set. Those two verbs are why a Node-RED flow can't safely run as more than one instance: two copies doing get, modify and set on a shared counter race each other, and there's no primitive in the API to stop it. Flow adds `CompareAndSwap`, `Increment` and `Update`. A test fires 10,000 concurrent increments at one counter under the race detector, and every one of them lands.

Be clear on what that gets you today. The only context store is in memory. Flow and global context survive a deploy, are gone on every restart, and aren't shared between instances. So you have the building blocks for running two instances, not two instances, and any counter or latch in your flow starts over when the pod moves. Node-RED has a file-backed store. Flow's is Phase 4 of the [roadmap](https://github.com/HotLoop-io/hotloop-flow/blob/main/docs/ROADMAP.md).
