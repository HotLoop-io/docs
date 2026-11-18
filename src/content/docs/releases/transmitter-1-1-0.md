---
title: "HotLoop Transmitter 1.1.0"
description: "Every message carries a timestamp from the PLC's clock, and the library installs from a CODESYS package: what changed, what was run, and what was not."
---

Every message now carries a timestamp from the PLC's clock, and the library now installs from a CODESYS `.package`.

What that means for you: a subscriber that wants to know when a value was sampled gets it from the packet instead of
guessing from when it arrived, and you can install the library through the CODESYS Installer like any other add-on.

## What changed for a project that uses 1.0.0

* **Timestamps, on by default.** The NetworkMessage and the DataSetMessage each carry a Timestamp (Part 14 7.2.4.4.2
  and 7.2.4.5.4), the same DateTime, read from the PLC's real-time clock once per message. ExtendedFlags1 goes from
  `01` to `21`, DataSetFlags1 from `69` or `6B` to `E9` or `EB`, and a DataSetFlags2 byte `10` is added. A message is
  17 bytes longer. The field list and the values did not move, and `udiConfigMajor` is the same.
* **`bTimestamp := FALSE` sends exactly the 1.0.0 bytes.** Pin that if a receiver of yours refuses timestamps. It
  was checked: 1142 and 1144 byte messages, none stamped, the sizes 1.0.0 sent.
* **The resolution is one second.** The clock is read with `SysTimeRtcGet`, which is whole seconds, so a receiver sees
  the same timestamp on every message inside a second and it can be up to a second behind the instant the message was
  built. Sub-second stamps are on the roadmap.
* **A new output, `diLastClockResult`.** If the clock cannot be read the message goes out unstamped, which Part 14
  allows, and this says why.
* **A new system library, SysTimeRtc.** The library names it as a placeholder, like SysSocket, and the runtime provides
  it. Control for Linux SL 4.22.0.0 does. A target without it cannot use 1.1.0 with timestamps; stay on 1.0.0.
* **The `.package`.** `HotLoopTransmitter-1.1.0.package` was made by CODESYS's own PackageManagerCLI and puts the same
  library into the library repository through the Installer. See the [install page](/transmitter/install/).

## What I ran, and what it showed

All of it against CODESYS Control for Linux SL 4.22.0.0, on the files below.

* The library builds with 0 errors and 0 warnings in CODESYS 3.5.22.30. The example application builds against it
  with 0 errors and 0 warnings.
* Two publishers, Variant and RawData, timestamps on. an independent decoder written from the spec decodes every message and every value equals what
  the PLC reports over its own OPC UA server. Every message has both timestamps, they are the same instant, they never
  go backwards, they are within the whole-second tolerance of the clock the capture ran on, and over an 11 second
  capture the stamp moved 11 seconds. The container shares the host's clock, so this shows the stamp is the PLC's clock
  reading and not an invented one; it does not test a controller whose clock is wrong.
* An independent PubSub stack reads the NetworkMessage and DataSetMessage Timestamp of all 113 messages of each writer with its
  own header decoders, and decodes the values as it did for 1.0.0.
* HotLoop core's subscriber (from its main branch when this was run, and in HotLoop core 4.19.4 and every release after it) reads both publishers against a live runtime: 21 values each, both counters
  advancing, nothing refused. Every reading carries the publisher's whole-second timestamp as its time, and the
  timestamp moved with the PLC clock over a 3 second wait.
* The `.package` installs through `PackageManagerCLI --install`, the library appears in the System repository (it was
  not there before), and the example builds against the library as the Installer put it there, 0 errors and 0 warnings.
* Cost on a 20 ms task, two publishers: about 9.6 us added per cycle on average, 10 to 100 us on the cycles that send,
  and the longest cycle in the run 81 us. Three publish slots were skipped in that run, and no send was refused. The
  timestamp itself is not visible in the numbers. The [timing page](/transmitter/timing/) has the table.

## What to check on your controller

* The byte order handling for a big endian target is written, so check it on your own controller.
* Multicast: the block sets the TTL, loopback and send interface for the group, so check the group on your own network.
* If the network goes away or an address is not there, the block counts the failure and backs off, and the program keeps scanning.
* In demo mode the runtime stops at the end of its two hour window, as CODESYS says it does.
* A controller whose real-time clock is unset or wrong will stamp what the clock says.

## Not in this release

KeepAlive and Delta Frames, more than one DataSetMessage per NetworkMessage, WSTRING, a per-field status, sub-second
timestamps, message security, and the subscriber side. The [roadmap](/transmitter/roadmap/) says which are next.

## Rolling back

A PLC project pinned to 1.0.0 keeps working and keeps sending the 1.0.0 bytes. Within 1.1.0, `bTimestamp := FALSE` is
the same bytes.

## Files

Download from https://hotloop.io/hotloop-transmitter/1.1.0/, and check them against `SHA256SUMS` in the same folder.

```
5ec021b23f5d57460016834a03b2b196d6dbc83aeb5d0ad60ace8d7b4fbbb4a7  HotLoopTransmitter-1.1.0.library
e172f4674f6cbfce2aeaf017d5a6c733245b1b9aa3e527369c753bf07b6ce0c2  HotLoopTransmitter-1.1.0.compiled-library
b3686bdebd052f1ddea46d1f1ff409f3b6c9a016ca5f3e8f4cd6f7922ccb479c  HotLoopTransmitter-1.1.0.package
```
