---
title: "What Transmitter adds to the PLC task"
description: "The measured cost of the publisher on a 20 ms cyclic task, and what that does and does not tell you about a physical controller."
---

:::caution[Not released]
HotLoop Transmitter has no release yet. This page describes the library as built on `main` of HotLoop-io/hotloop-transmitter and run on the CODESYS Control for Linux SL 4.22.0.0 runtime in a container. It has not run on a physical controller.
:::

Measured on 2026-11-01 on The Beast (a 64 thread AMD Threadripper 2990WX shared with other containers), with the CODESYS Control for Linux SL 4.22.0.0 runtime in a container, in demo mode, running the example application at a 20 ms cyclic task. The runtime's own task statistics were not available over OPC UA, so the application times itself: `PLC_PRG` reads `LTIME()` at its start and end and keeps a mean and a maximum (`udiPrgMeanNs`, `udiPrgMaxUs` in `examples/lab/build_app.py`). Both runs are the same program; the baseline never calls the publishers.

The publish run has two publishers, one Variant and one RawData, each sending a message of about 1.1 KB every 100 ms, so a message goes out every fifth cycle of the 20 ms task. Statistics were reset 45 s after the runtime started and read 180 s later (`test/run.sh timing`, evidence in `work/out/hotloop/transmitter/evidence/2026-11-01/timing.txt` in the codex).

| Measure | baseline (no publisher) | two publishers |
|---|---|---|
| Mean time in `PLC_PRG` per cycle | 232 ns | 8 977 ns |
| Longest time in `PLC_PRG` in the window | 1 021 us | 3 090 us |
| Cycles in the window | 8 920 | 11 123 (its window ran longer, the rate was 50 per second in both) |

What that says:

* **The mean cost is about 8.7 us per cycle**, which is 0.04 percent of a 20 ms task. Spread over the cycles that send, a cycle that sends two 1.1 KB messages costs about 44 us, so about 22 us per message. That is the cost of building the message byte by byte in Structured Text and one non-blocking `sendto`.
* **The worst case in the window was 3.1 ms against 1.0 ms for the baseline.** The baseline's 1 ms is the container and the shared host (the program does nothing but count), so the part this library can claim is bounded by about 2 ms, in a 20 ms task, on a loaded machine. It is not a real-time guarantee: this was a container on a general purpose kernel.
* **No send blocked.** `udiSendErrors` stayed 0.
* **28 publish slots were counted as skipped, all in the first seconds after the runtime started** (the runtime was making its keys). The counter did not move again in the window or in the minutes after it.

What this does not tell you: the cost on a physical controller, where a small ARM CPU can be ten to a hundred times slower than this host. The block's cost is the time to copy the published bytes, so it grows with the size of the field list. Measure it on the target with `udiLastCallUs` and `udiMaxCallUs` on the block, which are there for that.
