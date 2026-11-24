---
title: "Transmitter roadmap"
description: "What HotLoop Transmitter has built, what is next, and what is deliberately not planned."
---

What is in the box today, what is next, and what is deliberately not planned. A line moves to "Shipped" only
when it has run on the real 4.22.0.0 runtime and a receiver has read it.

## Shipped in 1.3.0

* Timestamps to the millisecond, from the clock's high resolution time. `bHighResTimestamp` switches back to whole seconds.
* WSTRING fields, sent as UTF-8 in Variant and RawData (`AddWString`).
* A per-field status, so a Bad value is sent as Bad (`SetStatus`).
* Several DataSetMessages in one NetworkMessage, with the Sizes array, so one datagram can carry more than one writer (`AddDataSet`).
* Data Delta Frames and KeepAlive messages, to cut the bytes of a mostly steady dataset. A setting, `bDeltaFrames`, off by default.

## Shipped in 1.2.0

* HotLoop Alarms (`alarms/`): a library that reads the CODESYS alarm manager's own active, waiting and acknowledged alarms into plain variables, and carries out an acknowledge that HotLoop writes back. It ran on the real 4.22.0.0 runtime, and HotLoop's alarm list read it.

## Shipped in 1.1.0

* DataSetMessage and NetworkMessage timestamps from the PLC's real-time clock, on by default, `bTimestamp` switches them off.
* The library as a CODESYS `.package`, installed through the CODESYS Installer.

## Shipped in 1.0.0

* One publisher block, `FB_HLTX_Publisher`: one NetworkMessage per publishing interval, one DataSetMessage, a Data
  Key Frame, UADP over UDP, from Structured Text over SysSocket.
* Variant and RawData field encodings.
* BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING and TIME fields, and arrays of
  every one of those but STRING, in both encodings.
* Unicast and multicast destinations, publisher id, writer group id, dataset writer id, publishing interval,
  group version and configuration version, all set as inputs of the block.
* A non-blocking send, a bounded cost per call, counters for sent, refused and skipped, and an error state that
  never faults the application.

## Not planned

* Message security (signing and encryption). The block sends in the clear, on a network the plant already trusts.
* Chunked NetworkMessages. A message that does not fit in one 1500 byte frame is refused, not split.
* The subscriber side. HotLoop core subscribes to UADP; this library publishes.
* MQTT transport. UDP is what a CODESYS runtime reaches without more libraries.
