---
title: "Transmitter roadmap"
description: "What HotLoop Transmitter has built, what is next, and what is deliberately not planned."
---

What is in the box today, what is next, and what is deliberately not planned. A line moves to "Shipped" only
when it has run on the real 4.22.0.0 runtime and a receiver has read it.

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

## Next

* Sub-second timestamps. The 1.1.0 stamp is the real-time clock's whole seconds.
* Several DataSetMessages in one NetworkMessage (the Sizes array), so one datagram can carry more than one writer.
* Data Delta Frames and KeepAlive messages, to cut the bytes of a mostly steady dataset.
* WSTRING fields.
* A per-field status, so a Bad value can be sent as Bad.

## Not planned

* Message security (signing and encryption). The block sends in the clear, on a network the plant already trusts.
* Chunked NetworkMessages. A message that does not fit in one 1500 byte frame is refused, not split.
* The subscriber side. HotLoop core subscribes to UADP; this library publishes.
* MQTT transport. UDP is what a CODESYS runtime reaches without more libraries.
