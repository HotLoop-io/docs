---
title: "What Transmitter adds to the PLC task"
description: "The measured cost of the publisher on a 20 ms cyclic task, and what that does and does not tell you about a physical controller."
---

Measured on 1.1.0 with timestamps on. The runtime is CODESYS Control for Linux SL 4.22.0.0 in demo mode, with a 20 ms cyclic task pinned to four cores. The publish run has two publishers, one Variant and one RawData, each sending about 1.1 KB every 100 ms, so a message goes out every fifth cycle. Statistics were reset 45 s after the runtime started and read 240 s later.

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

* **A cycle that sends costs 10 to 100 us.** About 2 400 cycles in the window sent (one in five), so the sending cycles are the whole of the cost: 96 percent of them took 10 to 50 us and 4 percent took 50 to 100 us, for two messages of about 1.16 KB. The cycles in between cost what the baseline costs.
* **The mean added cost is about 9.5 us per 20 ms cycle**, 0.05 percent of the task. The timestamp itself is one clock read and 17 more bytes a message, and this run does not show a cost for it.
* **No send was refused.** Three publish slots were skipped, so the task ran late three times. The block never waits for the network, though a send can be slow when the kernel is busy, so read the longest figure as a limit of the measurement and put the publisher in its own low-priority task if the main one is tight.

What this does not tell you: the cost on your controller. These numbers are from a container on a general purpose host. A small ARM CPU can be ten to a hundred times slower, and the cost grows with the size of the field list. Measure it on the target with `udiLastCallUs`, `udiMaxCallUs`, `udiMaxEncodeUs` and `udiMaxSendUs` on the block, which are there for that.
