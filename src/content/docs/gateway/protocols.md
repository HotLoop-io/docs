---
title: "Protocols: OPC UA, Modbus, MQTT, Sparkplug B"
description: "Exactly what the Gateway speaks, how far each driver has been verified, and what to do about everything else."
sidebar:
  label: "Protocols"
  order: 3
---

This document says exactly what the gateway speaks, exactly how far each driver
has been verified, and what to do about everything else. It is the first thing
to read and the one to trust when something disagrees with it.

The list of native protocols is derived from the drivers compiled into the
binary: `/api/protocols`, the Protocols screen and the MCP `describe_protocol`
tool all read the same registry. The catalog cannot advertise a protocol the
binary does not have.

## Verification status

Honesty about this is the whole point of the document, so it comes before the
detail.

| Protocol | Native | Verified against | Status |
|---|---|---|---|
| Modbus TCP/RTU | yes | a real Modbus server, in-process, over TCP | **verified live** |
| OPC UA | yes | Microsoft opc-plc (C#) and Emberburn (Python) | **verified live, two independent servers** |
| MQTT / Sparkplug B | yes | Eclipse Mosquitto 2.0 with crafted Tahu frames | **verified live** |
| MTConnect | yes | golden agent documents, served over HTTP | **verified live** |
| HTTP / REST | yes | real HTTP endpoints | **verified live** |
| S7comm | yes | frame-level decode and encode tests | **NOT verified against hardware** |
| EtherNet/IP | yes | address, batching and type-mapping tests | **NOT verified against hardware** |

**S7comm and EtherNet/IP have not been run against a physical PLC.** Their
decoding is tested thoroughly: every data type, sign extension, the two-byte S7
STRING header, byte ordering, block planning, read-modify-write for bits. But
tested decoding is not the same as a value that came off a real controller. If
you are the first person to point either at real hardware, treat it as
commissioning and check a known value before trusting a screen.

Everything else in this table has moved real values off a real server.

## Native protocols

### OPC UA

Prefer this one when a device offers a choice. It browses, it is properly
secured, and it subscribes.

The driver **subscribes rather than polls**. The server sends a value when it
changes, at a rate it can sustain, instead of being asked the same question
every scan by a client with no idea whether anything moved. If a server refuses
a subscription the driver falls back to batched reads rather than failing the
device.

**Address the nodes by namespace URI.** This matters more than it looks:

```
nsu=http://opcua.edge.server;s=Zone1_Temperature    good
ns=3;s=Zone1_Temperature                            works until it doesn't
```

A namespace *index* is assigned in whatever order the server happens to load its
namespaces. Add a namespace, upgrade firmware, and index 3 quietly becomes
something else. Every reading is then wrong with no error anywhere. The URI is
part of the model and does not move. `Browse` returns the URI form for exactly
this reason.

A bare string is rejected as an address. gopcua would happily read `Temperature`
as `ns=0;s=Temperature`, which means a typo parses cleanly into a node that does
not exist and the tag reads bad forever. An explicit form is required so the
mistake surfaces when you save it.

Configuration: `securityPolicy`, `securityMode`, `username`/`password` or
`certFile`/`keyFile`, `subscribe`, `publishIntervalMs`, `samplingIntervalMs`,
`browseMaxNodes`, `browseRoot`.

### Modbus TCP/RTU

The 1979 workhorse. PLCs, VFDs, power meters, RTUs, and the fallback of every
gateway that has nothing better.

```
holding:100:float32:CDAB    a float across registers 100-101, word-swapped
holding:40:bit3             bit 3 of register 40
holding:200:string16        16 characters from register 200
input:12:int16              a signed input register
coil:5                      a single coil
```

**Word order** is the setting people get wrong, and a float read with the wrong
order is not obviously wrong on a screen. It is a plausible number that is not
the truth. All four permutations are supported by the names vendor manuals
print: `ABCD`, `CDAB`, `BADC`, `DCBA`. Set a device default with `byteOrder` and
override per tag with the fourth address field.

**Addressing** is raw and zero-based. If your drawings use the traditional
40001-style numbering, set `oneBased: true` and write the numbers from the
drawings. Getting this wrong by one is the oldest Modbus bug there is.

Reads are merged into blocks: adjacent and near-adjacent registers become one
request. `maxGap` controls how many unused registers are worth reading to avoid a
second round trip (default 8), `maxBlock` caps a single request (default 120,
protocol ceiling 125).

Writing a single bit of a holding register is a read-modify-write, because
Modbus has no atomic bit-set there. The other fifteen bits are preserved.

### MQTT and Sparkplug B

Plain MQTT, or Sparkplug B as a **full primary host application**.

Plain topics:
```
mqtt:plant/line1/temperature              a scalar payload
mqtt:plant/line1/state|data.temperature   JSON, extracted by path
mqtt:plant/+/flow                         wildcards work
```

Sparkplug metrics:
```
spb:GroupId|EdgeNodeId|DeviceId|Metric/Name
spb:Plant|Edge1||Node/Uptime               empty device = a node-level metric
```

As a primary host the driver does the things the specification asks for and most
integrations skip:

- Publishes a retained `STATE` birth with a matching will, so edge nodes can see
  the host drop rather than inferring it from a timeout. Sparkplug 3.0 form
  (`spBv1.0/STATE/<host>` carrying JSON) by default; set `legacyState` for the
  pre-3.0 `ONLINE`/`OFFLINE` string.
- Tracks the per-node rolling sequence number and asks a node to rebirth when it
  skips, because a gap means messages were missed and the alias table can no
  longer be trusted.
- Requests rebirth after its own reconnect. A host that was away has no idea
  what changed while it was gone.
- Matches `NDEATH` to `NBIRTH` by `bdSeq`, so a death certificate left over from
  a previous session cannot kill the current one.

Message ordering is enforced. Delivering Sparkplug messages concurrently
reorders them, which makes a healthy node look like it is dropping messages and
provokes a rebirth storm.

### EtherNet/IP (CIP)

Allen-Bradley ControlLogix, CompactLogix and Micro820. Tags have names, so the
controller can be asked what it holds.

```
Temperature                    type from the tag's declared dataType
Speed:dint                     an explicit type wins
Program:MainProgram.Speed      a program-scoped tag (the colon is part of the path)
Zones[0].Heater.On:bool        array elements and UDT members
```

CIP is strongly typed and the controller rejects a read whose declared type does
not match, so the type has to come from somewhere. It is taken from the tag's
`dataType`, or from a `:type` suffix which wins. Unknown falls back to `REAL`,
which most process values are.

Reads are batched into multi-service requests, falling back to individual reads
when a batch fails so that one bad tag path does not blind the other nineteen.

### S7comm

Siemens S7-300, 400, 1200 and 1500, over ISO-on-TCP by rack and slot.

```
db1:0:real        a REAL at DB1.DBD0
db1:4:dint        a DINT at DB1.DBD4
db1:8.3:bool      bit 3 of DB1.DBB8
db2:20:string32   a 32-character STRING
m:10:word         merker word MW10
i:0.1:bool        input I0.1
q:2:byte          output byte QB2
```

The type is required for anything wider than a byte. The protocol cannot tell
you whether four bytes are a REAL or a DINT. That is a fact about the PLC
program, not about the wire.

Defaults to rack 0, slot 1 (S7-1200/1500). S7-300/400 are usually slot 2.
`connectType` defaults to 3 (S7 Basic) so the gateway does not occupy the PG
connection slot an engineer wants for TIA Portal.

There is no browse. An S7 CPU does not publish the layout of its data blocks. That lives in the TIA Portal project.

### MTConnect

Read-only machine tool telemetry. There is no command channel in MTConnect, and
this driver does not pretend otherwise.

Address by `dataItemId` or by name; agents are inconsistent about which is
stable, and machine documentation shows one or the other.

Two details that separate a working integration from a plausible one:
`UNAVAILABLE` is the agent explicitly saying it has no reading. It becomes bad
quality, not the text "UNAVAILABLE" and not zero. And a Condition's meaning is
its element name (`Normal`, `Warning`, `Fault`, `Unavailable`), not its
character data, which is usually empty.

`Browse` reads `/probe` and walks the component tree to any depth.

### HTTP / REST

The catch-all, for energy meters, environmental sensors, OEM controllers and the
REST side of a gateway that speaks something proprietary underneath.

```
power.kw                      nested fields
readings[0].value             array indexing
zones[name=Zone1].temp        select an array element by a field value
$.data.temperature            a leading $. is accepted
```

That third form is the one that matters: these APIs love returning an unordered
array of `{name, value}` objects, and indexing by position is a bug waiting for a
firmware update.

One request serves every tag on the device. `Browse` walks the document and
reports every scalar with the path that reaches it.

## Everything else: gateway mode

**PROFINET · EtherCAT · HART · BACnet/IP · DNP3 · FINS · MELSEC/SLMP · CANopen ·
FANUC FOCAS**

These are not spoken natively and there is no driver for them. That is a
deliberate choice, not a gap waiting to be filled with a stub.

Sites running these protocols almost always already have a gateway that
re-publishes on OPC UA or Modbus, such as a PROFINET IO controller with an OPC UA
server, a HART multiplexer with a Modbus map, a BACnet/IP to Modbus bridge.
Point a device at that endpoint and configure it as OPC UA or Modbus.

Writing nine more drivers that each duplicate what a site's existing gateway
already does would add nine more things to get subtly wrong, for protocols where
the equipment is hardest to test against. If a site genuinely has no gateway and
needs one of these natively, that is a real piece of work to schedule, not a
file to add that logs "not implemented".

**There are no placeholder drivers in this tree.** A protocol either has a
working implementation or it is in this section. The previous version of this
product had sixteen protocol files of which fifteen returned
`"not implemented"`, while the catalog advertised all sixteen. A test now
enforces that every protocol the model declares has a driver compiled in, and
vice versa.

## Adding a device

1. **Devices → Add device.** Pick the protocol, give it an address.
2. **Discover tags** where the protocol supports it: OPC UA, EtherNet/IP,
   MTConnect, MQTT (after a Sparkplug birth), HTTP. Modbus and S7comm cannot
   enumerate their own points, so declare those from the device documentation.
3. Imported tags are created **read-only**. A point the device happens to expose
   is not a point somebody has decided may be commanded. Mark tags writable one
   at a time, deliberately.
4. Set `scale` and `offset` for raw counts: `engineering = raw × scale + offset`.
5. Set a `deadband` on anything noisy. It suppresses historian writes for
   changes too small to matter, and without it a 12-bit sensor jittering in its
   last bit writes a row every scan forever.

## Quality

Every reading carries `good`, `uncertain` or `bad`.

**Bad means the value is not known. It does not mean zero.** A driver that
cannot read a point still emits a reading, marked bad, because silence is
indistinguishable from a value that has not changed, and on a trend, the
difference between "the sensor reads 0" and "the sensor stopped answering" is the
difference between a process problem and an instrument problem.

Alarm evaluation holds its previous state on a bad reading rather than
evaluating it. A sensor that fails to zero would otherwise trip every low alarm
on the unit and look like a process event.
