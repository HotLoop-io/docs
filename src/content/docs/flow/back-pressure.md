---
title: "Back-pressure and bounded queues in Flow"
description: Everything unbounded in Node-RED is bounded in Flow, visibly. Here is what is bounded, what happens at the limit, and how to choose a policy.
sidebar:
  label: "Back-pressure and bounded queues"
---

This is the throughline of the entire project, so it gets its own page. Node-RED's characteristic failure mode is a pod that quietly inflates until the kubelet kills it, leaving a log that explains nothing to the person holding the pager.

In Flow, every place a queue could grow without limit has a limit, and hitting the limit is loud, not silent. Nothing is thrown away quietly: every dropped message is counted, announced, and exported as a metric you can alert on.

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

Every one of those is a written, documented divergence in the [compatibility matrix](https://hotloop.io/integrations/#flow-nodes), not a silent cap that was decided on and never mentioned.

## The overflow policies

`runtime.overflow` sets the default, and any node can override it. This is the setting that does not exist in Node-RED at all.

| Policy | Behavior |
|---|---|
| `block` | The sender waits for space, up to `blockTimeout`. Back-pressure propagates upstream, which is the correct answer almost always. |
| `drop-newest` | Discard the arriving message. Counted and announced. |
| `drop-oldest` | Discard the head of the queue to make room. Counted and announced. For flows where only the latest reading matters. |
| `error` | Refuse the send and raise it to a Catch node, letting the flow decide. |

## Choosing one

`block` is the correct answer almost always, because back-pressure propagates upstream instead of piling up in the middle. Use `drop-oldest` for flows where only the latest reading matters. Use `error` when you want the flow itself to decide what overload means, by raising it to a Catch node.

## Concurrency

Every node instance gets its own goroutine, ordered within a node and parallel across nodes. One CPU-heavy Function node cannot stall the runtime, the editor API, and every other node's I/O, which is what happens in a single event loop.

## Cloning

Node-RED hands the first recipient on a wire the original message and only clones for the recipients after it. That is a documented memory optimization, and it is also why two branches that each believe they own their message can quietly corrupt each other. Every recipient in Flow gets its own copy. That costs about 1.4 microseconds per hop on the author's machine, and a shared path for large binary payloads takes a 1 MB payload from 217 microseconds down to 341 nanoseconds, which is exactly where the copying would have hurt.

## Atomic context operations

Node-RED's context API is get and set. Those two verbs are why a Node-RED flow cannot safely be run in more than one instance: two copies doing get, modify, and set against a shared counter will race, and the API offers no primitive you could fix it with. Flow adds `CompareAndSwap`, `Increment`, and `Update`, which cost nothing on a transactional store, and tests them under 10,000 concurrent increments with zero lost updates.
