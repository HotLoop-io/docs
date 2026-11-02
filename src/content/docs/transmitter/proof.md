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

`ghcr.io/embernet-ai/codesys-control-sl:4.22.0.0`, started by `test/lab/start_runtime.sh`, loads the application as a boot project and reports `Application started`, `CODESYS Control ready`. Demo mode, because there is no runtime license. The longest single run was under an hour; what happens at the end of the two hour demo window was not tried.

## What went over the wire, and who read it

The example application has two publishers, both to a capture listener on a Podman network: writer group 1 and dataset writer 1 in the Variant encoding (1142 bytes), and writer group 2 and dataset writer 2 in the RawData encoding (1144 bytes). Seventeen fields each: one of every type the library supports, a 250 element REAL array, a 4 element INT array, and two counters.

| Reader | What it is | Variant | RawData |
|---|---|---|---|
| `test/verify` | a decoder written from OPC 10000-14 and 10000-6 alone, which also reads the same variables from the runtime's OPC UA server and compares them | every field equal to the PLC's, no gap in the NetworkMessage and DataSetMessage sequence numbers over 117 to 119 messages | the same |
| open62541 1.4.9 | an independent PubSub implementation, built from its release tarball (sha256 `8735e61391cde0d84e6347a4293d2400b6a72838fb44513caf22d70dfca3a0cf`), run as a subscriber with a DataSet metadata of the 17 fields | all 15 values checked equal, including the string, both arrays and the TIME | the 11 numeric scalars equal. Its RawData reader reads one scalar per field and bounds its buffer by the fields' in-memory sizes (`DataSetReader_processRaw`, `src/pubsub/ua_pubsub_reader.c`), so it cannot read a RawData string longer than a few characters or any RawData array |
| A second Go decoder | the UADP decoder in our own receiver code, at commit 79157e7a of that repository | 118 of 118 messages decoded, every value correct | refused: `trailing_bytes: 52 bytes after the last RawData field are not padding` |

Wireshark 4.4.7's `tshark` (Alpine package) was tried on a capture and dissects UDP port 4840 as plain data: its OPC UA dissector is for the TCP protocol, so it was not usable as a UADP decoder.

HotLoop core's UADP subscribe (agent HK, bead 5a8ca6) has no code in its branch yet (`git grep -il uadp` over `hk/kafka-uadp` found no Go file), so it was not run.

## RawData arrays and strings

This library writes an Int32 element count before each RawData array, and a string as an Int32 length, its bytes, then zero padding up to MaxStringLength. That is what the OPC Foundation's reference stack does. It was looked up, not argued from the spec text alone:

* UA-.NETStandard at commit `fcfc84eab5c105780d7268474a47d344d100aca1`, `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs` lines 389 to 403 (the `ReadRawScalar` documentation) and 593 to 648 (`TryReadPaddedArray`): arrays keep their Part 6 length prefix and the block is padded to `product(ArrayDimensions)` elements, and a string is an Int32 length inside a `4 + MaxStringLength` block.
* The same repository's `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` asserts the string layout.
* The spec text it implements: OPC 10000-14 7.2.4.5.11 ("handled like a Structure DataType", padding "to the maximum size indicated by ArrayDimensions or MaxStringLength") with OPC 10000-6 5.2.5 ("One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value").
* open62541 1.4.9 does not read RawData arrays at all, so it neither agrees nor disagrees.

The second Go decoder above reads a RawData array as back-to-back elements, with no count, so it refuses this library's RawData with `trailing_bytes`. By the reference stack that decoder is the one that is wrong. It is tracked in the codex as a bead and is not changed here. Variant has no such question and is the default.

One difference from the reference stack: where it throws when a string is longer than MaxStringLength, this library cuts it at a character boundary, because a PLC task has nowhere to throw to.

## Not verified

* Any physical controller, any CODESYS runtime other than Control for Linux SL 4.22.0.0, and any CPU architecture other than x86-64 (the library is Structured Text, but the byte order handling for a big endian target is written and not run).
* Multicast. The block sets the TTL, loopback and send interface for a multicast group; the lab used unicast only.
* A runtime that loses and regains its network, and a send to an address that is not there. The code counts failures and backs off, but a deliberate fault test was not run.
* The behavior at the end of the two hour demo window.
* Receivers other than the ones above.
