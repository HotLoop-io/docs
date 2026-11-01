---
title: "What Transmitter adds to the PLC task"
description: "The measured cost of the publisher on a 20 ms cyclic task, and what that does and does not tell you about a physical controller."
---

:::caution[Not released]
HotLoop Transmitter has no release yet. This page describes the library as built on `main` of HotLoop-io/hotloop-transmitter and run on the CODESYS Control for Linux SL 4.22.0.0 runtime in a container. It has not run on a physical controller.
:::

Measured on 2026-11-01 on The Beast, which is a 64 thread AMD Threadripper 2990WX that other work shares (load average 30 to 37 during these runs). The runtime is CODESYS Control for Linux SL 4.22.0.0 in a container, in demo mode, with a 20 ms cyclic task, pinned to four cores (40 to 43) with `taskset`. The runtime's own task statistics were not available over OPC UA, so the example application times itself: `PLC_PRG` reads `LTIME()` at its start and end, keeps a mean and a maximum, and counts each cycle into a histogram (`examples/lab/build_app.py`). The baseline is the same program without the publisher calls.

The publish run has two publishers, one Variant and one RawData, each sending about 1.1 KB every 100 ms, so a message goes out every fifth cycle. Statistics were reset 45 s after the runtime started and read 240 s later (`HLTX_RT_CPUS=40-43 test/run.sh timing`; raw output is `run4-timing-pinned.txt` in the codex evidence folder `work/out/hotloop/transmitter/evidence/2026-11-01/`).

| Measure | baseline (no publisher) | two publishers |
|---|---|---|
| Mean time in `PLC_PRG` per cycle | 125 ns | 11 661 ns |
| Longest time in `PLC_PRG` in the window | 2 us | 3 668 us |
| Cycles under 10 us | 8 947 of 8 947 | 9 559 of 12 003 |
| Cycles 10 to 50 us | 0 | 1 421 |
| Cycles 50 to 100 us | 0 | 1 008 |
| Cycles 100 us to 1 ms | 0 | 13 |
| Cycles 1 to 10 ms | 0 | 2 |
| Messages sent / refused / slots skipped | 0 / 0 / 0 | 2 853 / 0 / 0 |

What that says:

* **A cycle that sends costs 10 to 100 us.** About 2 400 cycles in the window sent (one in five), and 2 444 cycles took 10 us or more, so the sending cycles are the whole of the cost: 58 percent of them took 10 to 50 us and 41 percent took 50 to 100 us, for two messages of about 1.1 KB. The cycles in between cost what the baseline costs.
* **The mean added cost is about 11.5 us per 20 ms cycle**, 0.06 percent of the task.
* **The tail is the send call.** The longest message took 3.65 ms, of which `udiMaxSendUs` (the `sendto` itself) was 3.65 ms and `udiMaxEncodeUs` (building the message) 0.76 ms. `sendto` is a kernel call into a container network on a busy host, and the block cannot make it faster. It is non-blocking in the sense that it never waits for the network; it can still be slow when the kernel is busy.
* **No send was refused and no slot was skipped** in the window.

An earlier run on the same host, with the runtime sharing cores with a build (load average 37), saw single stalls of 1.0 s in the encode and 2.5 s in the send and 460 skipped slots. The encode is plain arithmetic, so a one second stall in it is the runtime's thread not being scheduled, not the block. That run is kept in the evidence folder (`run3-all-loaded.out`) because it shows the limit of this measurement: this is a container on a general purpose kernel with no real-time scheduling, so it says what the block costs, and says nothing about the worst case a PLC task can suffer on such a host.

What this does not tell you: the cost on a physical controller. A small ARM CPU can be ten to a hundred times slower than this host, and the cost grows with the size of the field list. Measure it on the target with `udiLastCallUs`, `udiMaxCallUs`, `udiMaxEncodeUs` and `udiMaxSendUs` on the block, which are there for that.
