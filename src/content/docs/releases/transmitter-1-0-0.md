---
title: "HotLoop Transmitter 1.0.0"
description: "The first release of HotLoop Transmitter: a CODESYS library that publishes PLC values as OPC UA PubSub, what is in it, what was run, and what was not."
---

First release. A CODESYS library, written in Structured Text over SysSocket UDP, that puts your PLC's values on the
wire as OPC UA PubSub (Part 14, UADP). You add the library, declare one function block, add the variables you want
out, and call it once per cycle. Anything that subscribes to OPC UA PubSub can read it, HotLoop core's main branch included.

What that means for you: a PLC with no PubSub library can now feed a PubSub subscriber with about fifteen lines of
Structured Text, and nothing else gets installed on the controller.

## What is in the box

* One block, `HLTX.FB_HLTX_Publisher`. One NetworkMessage per publishing interval, one DataSetMessage, a Data Key
  Frame, so every message holds every field.
* Variant and RawData field encodings, picked per publisher. Variant carries its own types. RawData carries none, so
  the receiver has to be told the layout, which the [wire format page](/transmitter/wire-format/) spells out byte by byte.
* BOOL, SINT, USINT, INT, UINT, DINT, UDINT, LINT, ULINT, REAL, LREAL, STRING and TIME fields, and arrays of all of
  those but STRING, up to 128 fields and 1472 bytes a message. A message never fragments.
* Unicast or multicast, with publisher id, writer group id, dataset writer id, publishing interval, group version
  and configuration version as inputs.
* A non-blocking send. A bad address, a dead socket or a field list that is too big puts the block in an error
  state you can read and never faults your application.

## What I ran, and what it showed

All of it on The Beast, on the files below, against CODESYS Control for Linux SL 4.22.0.0 in a container.

* The library builds with 0 errors and 0 warnings in CODESYS 3.5.22.30. The example application builds against it
  with 0 errors and 0 warnings.
* Two publishers, one Variant and one RawData, seventeen fields each. Every value on the wire equals what the PLC
  reports over its own OPC UA server, with no gap in the sequence numbers.
* open62541 1.4.9 decodes the Variant message in full and the RawData scalars. It cannot read a RawData array or a
  long RawData string at all, which is its limit and not the library's.
* HotLoop core's subscriber (from its main branch, not in a release yet) reads both publishers, including the string, the TIME, both arrays and
  two counters that move between reads, and refuses nothing.
* A second Go decoder reads all 222 captured datagrams.
* Cost on a 20 ms task, two publishers: about 10.6 us added per cycle on average. A cycle that sends costs 10 to
  100 us. The tail is the `sendto` call, and on a busy shared host it reached 14.3 ms once in 12 000 cycles. Put the
  publisher in its own lower priority task if that matters to your control logic. the [timing page](/transmitter/timing/) has the table.

## What I did not run

* Any physical controller, any CODESYS runtime but Control for Linux SL 4.22.0.0, and any CPU but x86-64. The byte
  order handling for a big endian target is written and not run.
* Multicast. The lab used unicast.
* A runtime that loses and regains its network, or a send to an address that is not there. The block counts failures
  and backs off, but I did not break a network on purpose.
* What happens when the two hour demo window of the runtime ends.
* Receivers other than the four above.

## Not in this release

DataSetMessage and NetworkMessage timestamps, KeepAlive and Delta Frames, more than one DataSetMessage per
NetworkMessage, WSTRING, a per-field status, message security, and the subscriber side. the [roadmap](/transmitter/roadmap/) says which
are next.

## If you are coming from another publisher

A receiver that insists on a timestamp, a KeepAlive or a Delta Frame will not be satisfied by this version, because
none of them are sent. Every message is a Key Frame, which any receiver can read cold. A RawData array here is an
Int32 length, the elements, and zero padding up to the declared size, which is how the OPC Foundation's reference
stack writes it. A receiver that expects an array as back to back elements with no length has to be told the fields
are separate scalars instead.

## For a project that already uses it

There is no earlier version. The wire format changes only when `udiConfigMajor` does, and a PLC project pinned to
this library version keeps the same fields and bytes.

## Files

Download both files and `SHA256SUMS` from https://hotloop.io/hotloop-transmitter/1.0.0/, then install `HotLoopTransmitter-1.0.0.library` through Tools, Library Repository, Install in CODESYS 3.5 SP22 or later.
The `.compiled-library` is the same library without its source.

```
91b8023a73870925082c170588feb43d363e6d07ce008e1471fa8f5ff8db2c0d  HotLoopTransmitter-1.0.0.library
b02b0b40e434f35e4af1def20d6cc38688463537c4800354931b8c6094a66686  HotLoopTransmitter-1.0.0.compiled-library
```
