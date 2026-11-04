---
title: "What Transmitter adds to the PLC task"
description: "The measured cost of the publisher on a 20 ms cyclic task, and what that does and does not tell you about a physical controller."
---

Measured on 2026-11-04, on 1.1.0 with timestamps on, on The Beast, which is a 64 thread AMD Threadripper 2990WX that other work shares (load average 17 to 18 during this run). The runtime is CODESYS Control for Linux SL 4.22.0.0 in a container, in demo mode, with a 20 ms cyclic task, pinned to four cores (40 to 43) with `taskset`. The runtime's own task statistics were not available over OPC UA, so the example application times itself: `PLC_PRG` reads `LTIME()` at its start and end, keeps a mean and a maximum, and counts each cycle into a histogram (`examples/lab/build_app.py`). The baseline is the same program without the publisher calls.

The publish run has two publishers, one Variant and one RawData, each sending about 1.1 KB every 100 ms, so a message goes out every fifth cycle. Statistics were reset 45 s after the runtime started and read 240 s later (`HLTX_RT_CPUS=40-43 HLTX_TIMING_SECONDS=240 test/run.sh all`).

| Measure | baseline (no publisher) | two publishers, timestamps on |
|---|---|---|
| Mean time in `PLC_PRG` per cycle | 103 ns | 9 584 ns |
| Longest time in `PLC_PRG` in the window | 1 us | 81 us |
| Cycles under 10 us | 11 997 of 11 997 | 9 580 of 11 976 |
| Cycles 10 to 50 us | 0 | 2 299 |
| Cycles 50 to 100 us | 0 | 97 |
| Cycles 100 us or more | 0 | 0 |
| Messages sent / refused / slots skipped | 0 / 0 / 0 | 2 849 / 0 / 3 |

What that says:

* **A cycle that sends costs 10 to 100 us.** About 2 400 cycles in the window sent (one in five), and 2 396 cycles took 10 us or more, so the sending cycles are the whole of the cost: 96 percent of them took 10 to 50 us and 4 percent took 50 to 100 us, for two messages of about 1.16 KB. The cycles in between cost what the baseline costs.
* **The mean added cost is about 9.5 us per 20 ms cycle**, 0.05 percent of the task. The timestamp itself is one clock read and 17 more bytes a message; the run before it (1.0.0, no timestamp) measured 10.6 us, and the difference is inside what the host's load moves it by, so this run does not show a cost for the timestamp.
* **The longest send was 62 us and the longest encode 12 us** in this window. Three publish slots were skipped, so the task ran late three times; no send was refused. `sendto` is a kernel call into a container network on a busy host, and the block cannot make it faster. It never waits for the network; it can still be slow when the kernel is busy, which the 1.0.0 run showed (below).

The 1.0.0 run of the same day (load average 21 to 22) measured a mean of 10.6 us and one send of 14.3 ms, and the run before it (2026-11-01, load average 30 to 37) a mean of 11.7 us and a longest `PLC_PRG` of 3.7 ms. The typical cost is steady at 10 us a cycle; the tail moves with what the host is doing, so read the longest figure as a limit of the measurement, and put the publisher in its own lower priority task if a stall matters to your control logic (not measured here).

An earlier run on the same host, with the runtime sharing cores with a build (load average 37), saw single stalls of 1.0 s in the encode and 2.5 s in the send and 460 skipped slots. The encode is plain arithmetic, so a one second stall in it is the runtime's thread not being scheduled, not the block. I am keeping it here because it shows the limit of this measurement: this is a container on a general purpose kernel with no real-time scheduling, so it says what the block costs, and says nothing about the worst case a PLC task can suffer on such a host.

What this does not tell you: the cost on a physical controller. A small ARM CPU can be ten to a hundred times slower than this host, and the cost grows with the size of the field list. Measure it on the target with `udiLastCallUs`, `udiMaxCallUs`, `udiMaxEncodeUs` and `udiMaxSendUs` on the block, which are there for that.
