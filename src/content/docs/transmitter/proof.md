---
title: "What was run"
description: "What the library was built with, run on, and read back by, and the one place two readers disagree."
---

This page is the 1.0.0 run. The 1.1.0 run, with timestamps and the `.package`, is in the [1.1.0 release notes](/releases/transmitter-1-1-0/).

## The build

* Library: compiles with 0 errors and 0 warnings in the CODESYS 3.5.22.30 (SP22 Patch 3) ScriptEngine.
* Example application, built against the installed library, for the CODESYS Control for Linux SL device (4102, 0000 0005, 4.20.0.0): 0 errors, 0 warnings, ready for download.

## The runtime

CODESYS Control for Linux SL 4.22.0.0 loads the application as a boot project and reports `Application started`, `CODESYS Control ready`. It runs in demo mode, because there is no runtime license.

## What went over the wire, and who read it

The example application has two publishers: writer group 1 and dataset writer 1 in the Variant encoding (1142 bytes), and writer group 2 and dataset writer 2 in the RawData encoding (1144 bytes). Seventeen fields each: one of every type the library supports, a 250 element REAL array, a 4 element INT array, and two counters.

Four independent readers read it.

| Reader | What it is | Variant | RawData |
|---|---|---|---|
| A decoder written from the spec | written from OPC 10000-14 and 10000-6 alone, which also reads the same variables from the runtime's OPC UA server and compares them | every field equal to the PLC's, no gap in the NetworkMessage and DataSetMessage sequence numbers over the capture | the same |
| An independent OPC UA PubSub stack | a subscriber with a DataSet metadata of the 17 fields | all 15 values checked equal, including the string, both arrays and the TIME | the 11 numeric scalars equal. That stack does not read RawData strings of any length or RawData arrays at all |
| HotLoop core's UADP subscriber | the driver in HotLoop core 4.19.4 and every release after it, run against a live runtime and told the RawData layout in its DataSet types | 21 values checked equal, including the string, the TIME and elements 0, 1, 124 and 249 of the 250 REAL array and all four of the INT array, and both counters advancing between two reads 3 seconds apart | the same 21 values and the same two counters. 62 key frames received, none refused |
| A second decoder | the UADP decoder in our own receiver code, run on 222 captured datagrams with the layout of the 17 fields | all 111 messages decoded, every checked value correct | all 111 messages decoded, every checked value correct, the arrays with their Int32 length and padding |

## RawData arrays and strings

This library writes an Int32 element count before each RawData array, and a string as an Int32 length, its bytes, then zero padding up to MaxStringLength. That is what the OPC Foundation's reference stack does, and it follows the spec text: OPC 10000-14 7.2.4.5.11 ("handled like a Structure DataType", padding "to the maximum size indicated by ArrayDimensions or MaxStringLength") with OPC 10000-6 5.2.5 ("One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value").

HotLoop core's subscriber and the second decoder both read the RawData arrays this way, with the length and the padding, and both decode this library's RawData.

One difference from the reference stack: where it throws when a string is longer than MaxStringLength, this library cuts it at a character boundary, because a PLC task has nowhere to throw to.

## What to know

* The run was on CODESYS Control for Linux SL 4.22.0.0 on x86-64. The library is Structured Text, and the byte order handling for a big endian target is written, and you check it on your own controller.
* Multicast: the block sets the TTL, loopback and send interface for a multicast group. Check the group on your own network.
* The block counts send failures and backs off when the network goes away or an address is not there, and the program keeps scanning.
* In demo mode the runtime stops at the end of its two hour window, as CODESYS says it does.
