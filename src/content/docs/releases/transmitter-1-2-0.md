---
title: "HotLoop Transmitter 1.2.0"
description: "HotLoop Alarms joins the release: a library that puts a PLC's own alarms where HotLoop reads them. The publisher is unchanged."
---

This release adds HotLoop Alarms, a second library that puts your PLC's own alarms where HotLoop reads them, and it ships the Transmitter as 1.2.0.0 with the same publisher it had in 1.1.0.

What that means for you: the alarms your CODESYS project already raises show up in HotLoop's alarm list, and acknowledging one in HotLoop acknowledges it in the PLC. If you only use the publisher, there is nothing to change.

## What changed for a project that uses 1.1.0

* **HotLoop Alarms 1.0.0.0, new.** `HotLoopAlarms-1.0.0.0.library` and `.compiled-library` are in the release. The block, `HLAL.FB_HLAL_Alarms`, is a client of the CODESYS alarm manager. Called once per cycle, it copies the active, waiting and acknowledged alarms into a table of plain variables (`aAlarms`, 64 rows) that the runtime's OPC UA server exports like any other variable. `udiChanges` counts up when the table changed, and `uiDropped` counts the active alarms that did not fit instead of losing them quietly. It needs no generated alarm connector library, only the project's own Alarm Configuration.
* **The acknowledge comes back.** A write of the command variables (`uiAckGroupId`, `uiAckAlarmId`, `udiAckInternalId` or `bAckAll`, then a new number in `udiAckRequest`) makes the block acknowledge that alarm, or every alarm, through the alarm manager. HotLoop 4.23.6 and later finds the block by what it holds and does all of this for you.
* **The Transmitter publisher did not change.** The field list and the wire format did not move, and `bTimestamp` works as it did. The library is rebuilt as 1.2.0.0, and the `.package` carries it.
* **The license is the HotLoop Source License Agreement 1.0,** the same as every HotLoop product.

## What I ran, and what it showed

All of it in the lab, against CODESYS Control for Linux SL 4.22.0.0 in a container.

* The Transmitter library builds with 0 errors and 0 warnings in CODESYS 3.5.22.30, and so do the example applications built against it.
* The lab: two publishers, Variant and RawData, 114 messages of each decoded, every value equal to what the PLC reports over its own OPC UA server, no gap in the sequence numbers, both timestamps in every message, and the 1.0.0 bytes with `bTimestamp := FALSE`. An independent OPC UA PubSub implementation reads the values and the timestamps of every message. 128 checks passed and none failed.
* HotLoop core's UADP subscriber reads both publishers against a live runtime: every value equal, both counters advancing, 62 key frames received and none refused.
* The `.package` installs through `PackageManagerCLI --install`, the library appears in the System repository, and the example builds against it with 0 errors and 0 warnings.
* HotLoop Alarms: against a real runtime with an Alarm Configuration of two alarms, a trip in the PLC shows in HotLoop, an acknowledge in HotLoop puts the PLC's table at acknowledged with the time, a reset puts it at waiting for the confirm, and a confirm in HotLoop empties the PLC's table. The second alarm goes the other order, and acknowledge-all acknowledged both active alarms.
* Cost of the publisher on a 20 ms task, two publishers, pinned to four cores: about 15 us added per cycle on average, and the longest cycle 144 us, with no publish slot skipped and no send refused. A 1.1.0 library rebuilt in the same hour measured 15.2 us and 261 us.

## What I did not run

* Any physical controller, any CODESYS runtime but Control for Linux SL 4.22.0.0, and any CPU but x86-64.
* HotLoop Alarms with an alarm class other than the one that acknowledges and asks for a confirm, or with more than 64 active alarms at once.
* The `.package` in the CODESYS Installer's window. It installed headless with PackageManagerCLI.
* A controller whose real-time clock is unset or wrong, multicast, a runtime that loses and regains its network, and the end of the two hour demo window.

## Not in this release

KeepAlive and Delta Frames, more than one DataSetMessage per NetworkMessage, WSTRING, a per-field status, sub-second
timestamps, message security, and the subscriber side. The [roadmap](/transmitter/roadmap/) says which are next.

## Rolling back

A PLC project pinned to 1.1.0 keeps working and sends the same bytes. HotLoop Alarms is a separate library: a project that does not add it is not affected.

## Files

Download from https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.library, and check them against `SHA256SUMS` in the same folder.

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
a404f20fc35c4a3d804aa194f29def3f8193e26e696357899d3ae5b3d44948c1  HotLoopTransmitter-1.2.0.compiled-library
05200d0279ac120fd69d2dc3eeba99d9b40cb76eba2d15d1431b94c5e8f3fc32  HotLoopTransmitter-1.2.0.library
d6b6606a5919e18d2d6d31a5529af4d76bc7058003fb26032ec1a578f78ea57d  HotLoopTransmitter-1.2.0.package
```
