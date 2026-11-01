---
title: "HotLoop Transmitter"
description: "A CODESYS library, written in Structured Text over SysSocket UDP, that publishes PLC values as OPC UA PubSub (UADP) with no other library and no configurator."
---

:::caution[Not released]
HotLoop Transmitter has no release yet. This page describes the library as built on `main` of HotLoop-io/hotloop-transmitter and run on the CODESYS Control for Linux SL 4.22.0.0 runtime in a container. It has not run on a physical controller.
:::

HotLoop Transmitter puts a PLC's values on the network as OPC UA PubSub, the way Part 14 of the OPC UA spec says to,
from a library you drop into the CODESYS project. It is a transmitter in the instrument-loop sense: the part that
puts the process value on the wire so something else can read it.

It is written in Structured Text over `SysSocket` UDP, and it needs no other library, no extra license, and no
configurator. You add the library, call one function block once per cycle, and a UADP NetworkMessage goes out every
publishing interval to a unicast address or a multicast group.

What that means for you: a PLC that has no PubSub library can still feed anything that subscribes to OPC UA PubSub,
including HotLoop itself, with a few lines of Structured Text.

## Why this is Structured Text and not Go

Every new HotLoop tool is written in Go unless there is a real reason. This is the real reason: the thing has to
run inside the PLC's own scan, in the IEC 61131-3 runtime, as a library the programmer references from their project.
A CODESYS runtime runs Structured Text, not Go. The tests and tools around the library (the capture tool, the
verifier) are Go.

## Use it

1. Install `HotLoopTransmitter-<version>.library` into the CODESYS library repository (Tools, Library Repository,
   Install), then add it to the project's Library Manager. `docs/INSTALL.md` has the details.
2. Declare a publisher, add the variables you want to publish once at start, and call it every cycle:

```iecst
PROGRAM PLC_PRG
VAR
    pub : HLTX.FB_HLTX_Publisher;
    bInit : BOOL;
END_VAR

IF NOT bInit THEN
    bInit := TRUE;
    pub.sDestination := '239.0.0.22';        // a unicast host or a multicast group
    pub.uiPort := 4840;
    pub.uiPublisherId := 1;
    pub.uiWriterGroupId := 1;
    pub.uiDataSetWriterId := 1;
    pub.tPublishingInterval := T#100MS;
    pub.AddReal(ADR(GVL.rTemperature));
    pub.AddBool(ADR(GVL.bRunning));
    pub.AddArray(ADR(GVL.aValues), HLTX.E_HLTX_Type.REAL_T, 250);
END_IF
pub.bEnable := TRUE;
pub();
```

`docs/API.md` lists every input, output and method. `docs/WIRE-FORMAT.md` is the packet, byte by byte, with the
sections of the spec that define each byte.

## What it will and won't do to your scan

* It never blocks. The socket is non-blocking and the message is built in a fixed buffer.
* The cost of a call is the cost of building one message, and it is only paid on the cycles where a message goes
  out. The measured numbers are in `docs/TIMING.md`.
* A socket error, a bad address or an oversized field list never faults the application. The block reports an
  `eState` and an `eError`, counts the failure, and the program keeps scanning.
* It does not fragment. A message is at most 1472 bytes. A field list that does not fit puts the block in
  `ConfigError` and sends nothing.

The wire format is in [What goes on the wire](/tx2/wire-format/), every input and method is in the [API](/transmitter/api/), and what was run is in [What was run](/transmitter/proof/).

HotLoop Transmitter is under the HotLoop Business Source License 1.1, like every HotLoop product.
