---
title: "What was run"
description: "What the library was built with, run on, and read back by, and the one place two readers disagree."
---

:::caution[Not released]
HotLoop Transmitter has no release yet. This page describes the library as built on `main` of HotLoop-io/hotloop-transmitter and run on the CODESYS Control for Linux SL 4.22.0.0 runtime in a container. It has not run on a physical controller.
:::

Everything below ran on 2026-11-01 on The Beast, from `test/run.sh`. The raw outputs are in the codex at `work/out/hotloop/transmitter/evidence/2026-11-01/`. Nothing here ran on a physical controller.

## The build

* Library: `test/build.sh` ends `Compile complete -- 0 errors, 0 warnings` and `RESULT OK`, in the CODESYS 3.5.22.30 (SP22 Patch 3) ScriptEngine under Wine.
* Example application, built against the installed library, for the CODESYS Control for Linux SL device (4102, 0000 0005, 4.20.0.0): `Build complete -- 0 errors, 0 warnings : Ready for download`.

## The runtime

`ghcr.io/embernet-ai/codesys-control-sl:4.22.0.0`, started by `test/lab/start_runtime.sh`, loads the application as a boot project and reports `Application started`, `CODESYS Control ready`. Demo mode, because there is no runtime license. The longest single run was about an hour; what happens at the end of the two hour demo window was not tried.

## What went over the wire, and who read it

The example application has two publishers, both to a capture listener on a Podman network: writer group 1 and dataset writer 1 in the Variant encoding (1142 bytes), and writer group 2 and dataset writer 2 in the RawData encoding (1144 bytes). Seventeen fields each: one of every type the library supports, a 250 element REAL array, a 4 element INT array, and two counters.

| Reader | What it is | Variant | RawData |
|---|---|---|---|
| `test/verify` | a decoder written from OPC 10000-14 and 10000-6 alone, which also reads the same variables from the runtime's OPC UA server and compares them | every field equal to the PLC's, no gap in the NetworkMessage and DataSetMessage sequence numbers over 117 to 119 messages | the same |
| open62541 1.4.9 | an independent PubSub implementation, built from its release tarball (sha256 `8735e61391cde0d84e6347a4293d2400b6a72838fb44513caf22d70dfca3a0cf`), run as a subscriber with a DataSet metadata of the 17 fields | all 15 values checked equal, including the string, both arrays and the TIME | the 11 numeric scalars equal. Its RawData reader reads one scalar per field and bounds its buffer by the fields' in-memory sizes (`DataSetReader_processRaw`, `src/pubsub/ua_pubsub_reader.c`), so it cannot read a RawData string longer than a few characters or any RawData array |
| UT3-Code `uadp.Decode` at commit 79157e7a | the decoder in the Fireball UT3 receiver | 118 of 118 messages decoded, every value correct | refused: `trailing_bytes: 52 bytes after the last RawData field are not padding` |

Wireshark 4.4.7's `tshark` (Alpine package) was tried on a capture and dissects UDP port 4840 as plain data: its OPC UA dissector is for the TCP protocol, so it was not usable as a UADP decoder.

HotLoop core's UADP subscribe (agent HK, bead 5a8ca6) has no code in its branch yet (`git grep -il uadp` over `hk/kafka-uadp` found no Go file), so it was not run.

## The RawData disagreement

The UT3-Code decoder reads a RawData array as back-to-back elements. This library writes an Int32 element count first, and a string as an Int32 length, its bytes, then zero padding up to MaxStringLength. The reasoning, with its sources:

1. OPC 10000-14, 7.2.4.5.11: "The encoding of the DataSetMessage fields is handled like a Structure DataType", with padding "to the maximum size indicated by ArrayDimensions or MaxStringLength".
2. OPC 10000-6, 5.2.5: "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value."

Put together, an array field in RawData carries its count. The spec text never says so in one sentence, and the only other implementation tried here (open62541) does not read RawData arrays at all, so the array count is the one choice in this library that has a second reader's agreement on neither side. UT3-Code's `fields.go` states the opposite reading (a RawData array and separate fields are the same bytes). Which of the two is Part 14's meaning is a question for whoever owns the receiver or for the OPC Foundation; this repository did not touch the receiver. Variant has no such ambiguity and is the default.

## Not verified

* Any physical controller, any CODESYS runtime other than Control for Linux SL 4.22.0.0, and any CPU architecture other than x86-64 (the library is Structured Text, but the byte order handling for a big endian target is written and not run).
* Multicast. The block sets the TTL, loopback and send interface for a multicast group; the lab used unicast only.
* A runtime that loses and regains its network, and a send to an address that is not there. The code counts failures and backs off, but a deliberate fault test was not run.
* The behavior at the end of the two hour demo window.
* Receivers other than the three above.
