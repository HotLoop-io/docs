---
title: "What Transmitter adds to the PLC task"
description: "The measured cost of the publisher on a 20 ms cyclic task, and what that does and does not tell you about a physical controller."
---

Measured on 2026-11-04 on The Beast, which is a 64 thread AMD Threadripper 2990WX that other work shares (load average 21 to 22 during this run). The runtime is CODESYS Control for Linux SL 4.22.0.0 in a container, in demo mode, with a 20 ms cyclic task, pinned to four cores (40 to 43) with `taskset`. The runtime's own task statistics were not available over OPC UA, so the example application times itself: `PLC_PRG` reads `LTIME()` at its start and end, keeps a mean and a maximum, and counts each cycle into a histogram (`examples/lab/build_app.py`). The baseline is the same program without the publisher calls.

The publish run has two publishers, one Variant and one RawData, each sending about 1.1 KB every 100 ms, so a message goes out every fifth cycle. Statistics were reset 45 s after the runtime started and read 240 s later (`HLTX_RT_CPUS=40-43 HLTX_TIMING_SECONDS=240 test/run.sh all`).

| Measure | baseline (no publisher) | two publishers |
|---|---|---|
| Mean time in `PLC_PRG` per cycle | 115 ns | 10 753 ns |
| Longest time in `PLC_PRG` in the window | under 1 us | 14 303 us |
| Cycles under 10 us | 12 001 of 12 001 | 9 592 of 11 993 |
| Cycles 10 to 50 us | 0 | 2 296 |
| Cycles 50 to 100 us | 0 | 100 |
| Cycles 100 us to 1 ms | 0 | 3 |
| Cycles 1 to 10 ms | 0 | 1 |
| Cycles 10 ms or more | 0 | 1 |
| Messages sent / refused / slots skipped | 0 / 0 / 0 | 2 853 / 0 / 0 |

What that says:

* **A cycle that sends costs 10 to 100 us.** About 2 400 cycles in the window sent (one in five), and 2 401 cycles took 10 us or more, so the sending cycles are the whole of the cost: 96 percent of them took 10 to 50 us and 4 percent took 50 to 100 us, for two messages of about 1.1 KB. The cycles in between cost what the baseline costs.
* **The mean added cost is about 10.6 us per 20 ms cycle**, 0.05 percent of the task.
* **The tail is the send call, and it can be long.** The longest message took 14.3 ms in `PLC_PRG`, of which `udiMaxSendUs` (the `sendto` itself) was 14.26 ms and `udiMaxEncodeUs` (building the message) 51 us. One cycle in the window took 14.3 ms of a 20 ms task, one more took between 1 and 10 ms, and nothing overran. `sendto` is a kernel call into a container network on a busy host, and the block cannot make it faster. It never waits for the network; it can still be slow when the kernel is busy. If a stall like that matters to your control logic, call the publisher from its own task at a lower priority than the control task. That is what I would do, and I have not measured it here.
* **No send was refused and no slot was skipped** in the window.

The run it replaces (2026-11-01, load average 30 to 37) measured a mean of 11.7 us and a longest `PLC_PRG` of 3.7 ms, so the typical cost is steady and the tail moves with what the host is doing.

An earlier run on the same host, with the runtime sharing cores with a build (load average 37), saw single stalls of 1.0 s in the encode and 2.5 s in the send and 460 skipped slots. The encode is plain arithmetic, so a one second stall in it is the runtime's thread not being scheduled, not the block. I am keeping it here because it shows the limit of this measurement: this is a container on a general purpose kernel with no real-time scheduling, so it says what the block costs, and says nothing about the worst case a PLC task can suffer on such a host.

What this does not tell you: the cost on a physical controller. A small ARM CPU can be ten to a hundred times slower than this host, and the cost grows with the size of the field list. Measure it on the target with `udiLastCallUs`, `udiMaxCallUs`, `udiMaxEncodeUs` and `udiMaxSendUs` on the block, which are there for that.
