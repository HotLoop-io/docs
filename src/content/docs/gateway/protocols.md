---
title: "Protocols: OPC UA, Modbus, MQTT, Sparkplug B"
description: "What the Gateway speaks natively, what each driver has actually been run against (Ignition 8.3.9 included), and what to do about everything else."
sidebar:
  label: "Protocols"
  order: 3
---

This page says exactly what the Gateway speaks, exactly how far each driver has been proven, and what to do about everything else. When something else disagrees with it, trust this page, and then tell us, because one of us is wrong.

The list of native protocols comes from the drivers compiled into the binary. `/api/protocols`, the Protocols screen and MCP's `describe_protocol` all read the same registry, so the catalog can't advertise a protocol the binary doesn't have. That's not a hypothetical. Before the 4.0.0 rewrite this product shipped sixteen protocol files, fifteen of them answered `"not implemented"`, and the catalog advertised all sixteen. Now a test fails the build unless every protocol the catalog lists has a driver compiled in, and every driver compiled in is in the catalog.

## Verification status

Honesty about this is the whole point of the page, so it comes before the detail. "Verified live" means real values came off a real server. A simulator or a stand-in is named as exactly that.

| Protocol | Native | Verified against | Status |
|---|---|---|---|
| Modbus TCP/RTU | yes | a real Modbus server, in-process, over TCP | **verified live** |
| OPC UA | yes | Microsoft opc-plc (.NET) and Emberburn (Python; CI runs a python-opcua stand-in for it), anonymous and unsecured; HotLoop's own OPC UA server and opc-plc, for user name and password, Sign and SignAndEncrypt; **Ignition 8.3.9**, Basic256Sha256 SignAndEncrypt with a user name | **verified live against Ignition 8.3.9 and two other independent servers; NOT verified against KEPServerEX, WinCC, Siemens or Beckhoff** |
| MQTT / Sparkplug B | yes | Eclipse Mosquitto 2.0 with crafted Tahu frames | **verified live** |
| MTConnect | yes | golden agent documents, served over HTTP | **verified live** |
| HTTP / REST | yes | real HTTP endpoints | **verified live** |
| S7comm | yes | frame-level decode and encode tests | **NOT verified against hardware** |
| EtherNet/IP | yes | address, batching and type-mapping tests | **NOT verified against hardware** |
| UniFi Network (new in 4.17.0) | yes | a real UniFi Network Application 10.6 with emulated switches, a real UniFi OS Server 5.1, and read-only against our own Cloud Gateway Ultra and Express 7 with real switches and a U5G Backup | **verified live, read-only, on real consoles and switches, WAN and failover included. PoE draw above zero not seen yet.** See [UniFi Network](/gateway/unifi/) |

**S7comm and EtherNet/IP have never talked to a physical PLC.** Their decoding is tested hard: every data type, sign extension, the two-byte S7 STRING header, byte ordering, block planning, read-modify-write for bits. Tested decoding is still not a value that came off a real controller. If you're the first to point either one at real hardware, treat it as commissioning, and check a value you already know before you trust a single screen.

**OPC UA with a user name and password, over a secured channel, is verified against Ignition 8.3.9**, in both directions: the driver reading Ignition's server, and Ignition's client reading the Gateway's own OPC UA server. It's also tested against HotLoop's own OPC UA server (built on a different library from the driver, so it isn't just agreeing with itself) and Microsoft's opc-plc. None of that is KEPServerEX, WinCC, a Siemens controller or a Beckhoff one, and each of those has its own opinions about certificates and token policies. Treat the first connection to any of them as commissioning.

## Native protocols

### OPC UA

Pick this one when a device offers a choice. It browses, it's properly secured, and it subscribes.

The driver **subscribes instead of polling**. The server sends a value when it changes, at a rate it can sustain, instead of being asked the same question every scan by a client with no idea whether anything moved. If a server refuses a subscription, the driver falls back to batched reads instead of failing the device.

It also falls back when a subscription delivers nothing at all. A server sends every node's current value in its first publish and never again until it changes, so a lost first publish means a setpoint that reads bad for as long as the session lasts. If ten publishing intervals pass (five seconds at least) with no value, the driver logs a warning, deletes the subscription, and reads the tags on every poll until the device next reconnects. The OPC UA library underneath can start its publish loop paused on a loaded host and never ask for a publish. Before 4.16.0 that meant a device stuck saying "connected", every tag bad, nothing reconnecting, until somebody restarted the Gateway.

**Address the nodes by namespace URI.** This matters more than it looks:

```
nsu=http://opcua.edge.server;s=Zone1_Temperature    good
ns=3;s=Zone1_Temperature                            works until it doesn't
```

A namespace *index* is assigned in whatever order the server happens to load its namespaces. Add a namespace, upgrade the firmware, and index 3 quietly becomes something else. Every reading is then wrong, with no error anywhere. The URI is part of the model and doesn't move, which is exactly why `Browse` returns the URI form.

A bare string is refused as an address. The library would happily read `Temperature` as `ns=0;s=Temperature`, so a typo parses cleanly into a node that doesn't exist and the tag reads bad forever. Requiring an explicit form surfaces the mistake when you save it.

**Discover tags declares each tag as the type the server says the node holds.** Boolean is `bool`. The integer types keep their width (`int16`, `uint16`, `int32`, `uint32`, `int64`, `uint64`; SByte and Byte take the next size up). Float and Double are `float`. String, DateTime, LocalizedText and the other types the driver reads as text are `string`. A type the server won't name, or one with no better name (an enumeration, a structure), stays `float`. Before 4.16.0 every discovered tag was `float`, and the Gateway's own OPC UA server publishes a tag as the type it's declared, so a text tag reached Ignition as `Bad_TypeMismatch`. Tags imported before the fix keep the type they were imported with, so go declare your text tags `string` by hand.

The security, identity and certificate options are under [OPC UA: security and credentials](#opc-ua-security-and-credentials). The rest are `subscribe`, `publishIntervalMs`, `samplingIntervalMs`, `queueSize`, `sessionTimeoutMs`, `browseMaxNodes` and `browseRoot`. An option name the driver doesn't know is an error that lists the ones it does, not a setting silently ignored, because a typo in `securityMode` would otherwise connect with no security at all and look exactly like a working device.

### OPC UA: security and credentials

Until 4.15.0 the driver could only make an anonymous, unsecured connection, and not even that to a server that follows the specification: it never asked which identity token policies a server offered, so it sent an empty policy id, which a compliant server refuses. HotLoop's own OPC UA server refused it. Now the driver discovers the server's endpoints, picks one that matches the device, and echoes the policy id that endpoint listed.

#### Device options

| Option | Default | What it does |
|---|---|---|
| `securityMode` | `None` | `None`, `Sign`, or `SignAndEncrypt`. Left out with a `securityPolicy` other than `None`, it's `SignAndEncrypt`. |
| `securityPolicy` | the best the server offers for the mode | `None`, `Basic256Sha256`, `Aes128_Sha256_RsaOaep`, or `Aes256_Sha256_RsaPss`. `Basic128Rsa15` and `Basic256` are refused. |
| `username`, `password` | anonymous | User name authentication. |
| `allowInsecureCredentials` | `false` | Lets a password go out over an unsecured channel (`securityMode` `None`), or when nothing encrypts it. |
| `certFile`, `keyFile` | generated | This client's application certificate and its RSA key, for a secured mode. Set both or neither. |
| `pkiDir` | `HOTLOOP_OPCUA_CLIENT_PKI_DIR` (`/data/opcua-client-pki`) | Where the generated certificate and the `trusted/` and `rejected/` stores live. |
| `serverCertThumbprints` | none | SHA-1 (40 hex digits) or SHA-256 (64) thumbprints of server certificates to trust without a file in `trusted/`. Colons and spaces are ignored. |
| `insecureSkipVerify` | `false` | Accept any server certificate. |

A device with none of these set is what it always was: anonymous, over an unsecured channel.

#### How the driver picks an endpoint

It asks the server for its endpoints over an unsecured channel, which the specification requires servers to allow for discovery and which carries nothing secret. It keeps the endpoints whose mode and policy match the device, and among those the token policy for the device's identity. The identity token then carries the policy id that endpoint listed, never an empty one.

- **It never picks `Basic128Rsa15` or `Basic256`.** Both are deprecated by the OPC Foundation. That holds when one has the highest security level on the list, and when one is the only thing a server offers, in which case the connection fails with an error that says so.
- **With no policy named, it prefers `Basic256Sha256`, then `Aes128_Sha256_RsaOaep`, then `Aes256_Sha256_RsaPss`**, ordered by how widely each works, not by strength. `Aes256_Sha256_RsaPss` fails against opc-plc (the underlying library can't open a channel with it, and a bare client with none of our code fails the same way), so it's only used when a device names it.
- **If nothing matches, the error lists what the server does offer**, policy and token policy id for each endpoint, so you can fix the configuration from the message alone.

#### Certificates, both ways

Any secured mode needs an application certificate. Name a `certFile` and `keyFile` and they're used after checks (RSA, at least 2048 bits, not expired). Otherwise a self-signed one is generated on first use and kept in the PKI directory (RSA-2048, five years) and isn't regenerated on a routine start, so a server that was told to trust it isn't told again. It's replaced, with a warning, only if it can't be read, is too weak, or has under 30 days left.

That directory has to be writable and survive a restart. In the chart that's `opcuaClient.persistence.enabled`, off by default because it adds a volume to an existing install. **Turn it on before you add a secured OPC UA device.** Without it, a secured device reports an error naming what to set, instead of connecting with certificates that vanish at the next restart and leave you re-approving trust on both ends.

**The driver doesn't accept whatever certificate a server presents.** For a secured mode, or a password encrypted to the server's key, it trusts a certificate only if it's pinned in `serverCertThumbprints` or is the exact certificate in `trusted/`. Anything else is saved to `rejected/<thumbprint>.der` and the connection fails, before any credential is sent, with a message that names the file, the thumbprint and how to approve it. Check that thumbprint against the server's own display (that comparison is the whole trust decision), then move the file into `trusted/`. The next connection attempt picks it up, no restart.

- Trust is by exact certificate, not by chain. Trusting a CA, and revocation, aren't supported.
- An expired certificate an operator approved stays trusted, with a warning on each connect. Refusing one somebody approved on purpose would only push them toward `insecureSkipVerify`.
- `rejected/` holds at most 256 files, so a server presenting a new certificate on every connection can't fill the disk.
- `insecureSkipVerify` turns the check off. Anybody in the path can then impersonate the server and read what's sent to it, password included. It's off by default and warns on every connect.

The server has to trust the client too. When a server hangs up while the secure channel is opening, which is how many of them turn away a certificate they don't trust, the error names this client's certificate file and thumbprint so you know what to look for on the server.

#### Credentials

A password is refused, before it's sent, unless the channel is secured and something encrypts the password:

| Channel | The server's user name token policy | Result |
|---|---|---|
| `SignAndEncrypt` | encrypts the password (the usual case) | connects |
| `SignAndEncrypt` | doesn't | connects: the encrypted channel carries it, and the log says so |
| `Sign` | encrypts the password | connects |
| `Sign` | doesn't | **refused** unless `allowInsecureCredentials`. `Sign` authenticates messages but doesn't hide them. |
| `None` | encrypts the password | **refused** unless `allowInsecureCredentials` |
| `None` | doesn't | **refused** unless `allowInsecureCredentials` |

**A user name over `securityMode` `None` is refused even when the token policy encrypts the password.** On an unsecured channel, the certificate the password gets encrypted to comes from a server reply nothing authenticates. The tests put a party in the middle, substitute its own certificate, and recover the password. Encryption whose key an attacker picks isn't protection against that attacker. The error says so and names the fix, `securityMode` `SignAndEncrypt`. Anonymous sessions aren't affected. Measured on the wire through a recording proxy, `SignAndEncrypt` shows no password, no user name, and no node ids or values. `Sign` hides the password (when the token policy encrypts it) and shows everything else.

The password is write-only everywhere: `[redacted]` in every API response to every role (since 4.15.1), and absent from the driver's logs, its errors, MCP output, the live event stream and the system log. The tests search all of them for it.

A wrong password is a clear error in one attempt, and then the runtime waits **ten minutes** (jittered between five and ten) before trying again, instead of its usual reconnect backoff. Two reasons. A server that locks an account after a few failures turns fast retries into an outage for everyone sharing that account. And each refused login can leave a created-but-never-activated session on the server: against HotLoop's own server, a device retrying a wrong password every few seconds filled the default limit of twenty sessions, and then the server refused every other client with `BadTooManySessions`. The OPC UA library's own reconnect is off for the same reason. It was measured retrying a changed password about twenty times in twelve seconds.

**Not verified, or not supported:** KEPServerEX, WinCC, Siemens, Beckhoff and every production server other than Ignition. X.509 and issued-token user authentication. Elliptic-curve policies, and servers that refuse discovery on an unsecured channel. And a silently dead connection, where the network path drops without either end seeing it close: a device on such a link keeps its last values until the operating system gives up on the connection. The Emberburn interop tests ran against a python-opcua server standing in for Emberburn, because Emberburn itself wasn't available, so the new endpoint selection hasn't been run against Emberburn proper.

### Ignition 8.3

Verified against **Ignition 8.3.9**, in Inductive Automation's own container image: HotLoop's driver as the client, Ignition's OPC UA server on the other end, `Basic256Sha256` with `SignAndEncrypt`, signed in with a user name and password. Browse found Ignition's tags under `nsu=urn:inductiveautomation:ignition:opcua:tags`, and the `[System]/Gateway` clock, CPU, memory and uptime tags imported and read with good quality, pushed by subscription.

A stock 8.3 gateway stops you four times before HotLoop gets a word in:

1. **Its OPC UA server listens on localhost only.** Out of the box it binds port 62541 to `localhost`, so a HotLoop anywhere else gets connection refused and nothing more. In the Gateway's OPC UA server settings, set Bind Addresses to `0.0.0.0`. We also added the host name HotLoop dials to Endpoint Addresses; whether that's needed wasn't tested.
2. **Tags aren't on OPC UA by default.** Turn on Expose Tag Providers, or all a browse finds is the server's own diagnostics and device folders.
3. **Certificates, both ways.** HotLoop refuses Ignition's certificate until you approve it, as above. Ignition refuses HotLoop's until you trust it in the Gateway's OPC UA server certificates. On disk that's moving it from `data/config/local/com.inductiveautomation.opcua/server/security/pki/rejected/certs` to `.../trusted/certs`, no restart. **Ignition doesn't name that file by the SHA-1 thumbprint HotLoop logs.** Open the certificate and compare fingerprints. A file name that doesn't match isn't a sign of an impostor.
4. **The OPC UA login is `opcuauser` / `password`** in the `opcua-module` user source, on every fresh install. Change it before anything real connects.

Only what 8.3's server offers out of the box was exercised in this direction: `Basic256Sha256` and `SignAndEncrypt`.

**The other direction is verified too: Ignition 8.3.9's OPC UA client reads HotLoop's own OPC UA server**, signed in as a HotLoop viewer, over every policy and mode Ignition offers, with a write refused as `Bad_NotWritable`. It flushed out two real bugs, both fixed in 4.16.0: the server minted a new certificate every time its container was recreated, which broke Ignition's trust after every upgrade, and Discover tags called every tag a float.

HotLoop's Sparkplug edge node and the Edge Relay against Ignition's MQTT Engine are next, and not done.

### Modbus TCP/RTU

The 1979 workhorse. PLCs, VFDs, power meters, RTUs, and the fallback of every gateway that has nothing better.

```
holding:100:float32:CDAB    a float across registers 100-101, word-swapped
holding:40:bit3             bit 3 of register 40
holding:200:string16        16 characters from register 200
input:12:int16              a signed input register
coil:5                      a single coil
```

**Word order** is the setting people get wrong, and a float read with the wrong order isn't obviously wrong on a screen. It's a plausible number that isn't the truth. All four permutations are supported by the names vendor manuals print: `ABCD`, `CDAB`, `BADC`, `DCBA`. Set a device default with `byteOrder` and override per tag with the fourth address field.

**Addressing** is raw and zero-based. If your drawings use the traditional 40001-style numbering, set `oneBased: true` and copy the numbers straight off the drawings. Getting this wrong by one is the oldest Modbus bug there is.

Reads are merged into blocks: adjacent and near-adjacent registers become one request. `maxGap` is how many unused registers are worth reading to avoid a second round trip (default 8), and `maxBlock` caps a single request (default 120, protocol ceiling 125).

Writing a single bit of a holding register is a read-modify-write, because Modbus has no atomic bit-set there. The other fifteen bits are preserved.

**A device that goes silent goes down within its timeout.** One that refuses or closes the connection is down by its next poll. One that just stops answering (a pulled cable, a hung PLC, a switch that rebooted) keeps its socket open, so it's judged by its timeout instead: its entities read `unavailable` within one poll interval plus twice the device's timeout, plus at most a second. Before 4.16.0, a device with more than one block sat at "degraded" on its last values until TCP gave up: about a quarter of an hour for a pulled cable, and never for a hung PLC whose network stack still acknowledges. The timeout is your knob. A device on a 20 second timeout can look fine for 20 to 40 seconds after it dies, so don't set it longer than the device needs to answer.

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

As a primary host the driver does the things the specification asks for and most integrations skip:

- It publishes a retained `STATE` birth with a matching will, so edge nodes see the host drop instead of inferring it from a timeout. Sparkplug 3.0 form (`spBv1.0/STATE/<host>` carrying JSON) by default; set `legacyState` for the pre-3.0 `ONLINE`/`OFFLINE` string.
- It tracks each node's rolling sequence number and asks a node to rebirth when it skips, because a gap means messages were missed and the alias table can't be trusted anymore.
- It requests rebirth after its own reconnect. A host that was away has no idea what changed while it was gone.
- It matches `NDEATH` to `NBIRTH` by `bdSeq`, so a death certificate left over from a previous session can't kill the current one.

Message ordering is enforced. Delivering Sparkplug messages concurrently reorders them, which makes a healthy node look like it's dropping messages and provokes a rebirth storm.

### EtherNet/IP (CIP)

Allen-Bradley ControlLogix, CompactLogix and Micro820. Tags have names, so the controller can be asked what it holds.

```
Temperature                    type from the tag's declared dataType
Speed:dint                     an explicit type wins
Program:MainProgram.Speed      a program-scoped tag (the colon is part of the path)
Zones[0].Heater.On:bool        array elements and UDT members
```

CIP is strongly typed, and the controller rejects a read whose declared type doesn't match, so the type has to come from somewhere. It's taken from the tag's `dataType`, or from a `:type` suffix, which wins. Unknown falls back to `REAL`, which most process values are.

Reads are batched into multi-service requests, falling back to individual reads when a batch fails, so one bad tag path doesn't blind the other nineteen.

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

The type is required for anything wider than a byte. The protocol can't tell you whether four bytes are a REAL or a DINT. That's a fact about the PLC program, not about the wire.

It defaults to rack 0, slot 1 (S7-1200/1500). S7-300/400 are usually slot 2. `connectType` defaults to 3 (S7 Basic), so the Gateway doesn't take the PG connection slot an engineer wants for TIA Portal.

There's no browse. An S7 CPU doesn't publish the layout of its data blocks. That lives in the TIA Portal project.

### MTConnect

Read-only machine tool telemetry. MTConnect has no command channel, and this driver doesn't pretend otherwise.

Address by `dataItemId` or by name. Agents are inconsistent about which one is stable, and machine documentation shows one or the other.

Two details separate a working integration from a plausible one. `UNAVAILABLE` is the agent explicitly saying it has no reading, so it becomes bad quality, not the text "UNAVAILABLE" and not zero. And a Condition's meaning is its element name (`Normal`, `Warning`, `Fault`, `Unavailable`), not its character data, which is usually empty.

`Browse` reads `/probe` and walks the component tree to any depth.

### HTTP / REST

The catch-all, for energy meters, environmental sensors, OEM controllers, and the REST side of a gateway that speaks something proprietary underneath.

```
power.kw                      nested fields
readings[0].value             array indexing
zones[name=Zone1].temp        select an array element by a field value
$.data.temperature            a leading $. is accepted
```

The third form is the one that matters. These APIs love returning an unordered array of `{name, value}` objects, and indexing by position is a bug waiting for a firmware update.

One request serves every tag on the device. `Browse` walks the document and reports every scalar with the path that reaches it.

### UniFi Network

**New in 4.17.0.**

The plant network, as a device: one site on one UniFi console, its switches, every switch port, PoE draw, the WAN links, the site's health and its clients, as read-only tags that create themselves as gear is adopted. When a PLC goes quiet, the first question is whether it's the PLC or the switch port it's plugged into, and until now the answer lived in an app on somebody's phone. One login per console, the certificate pinned, the password encrypted in the database, and it never writes to the console. Its first real read of our own Cloud Gateway got fooled: it called a 5G backup up that had been dead for two days, because it trusted the WAN block's stale `up` the same way the console's summary did. The health checks knew, and the driver reads those now. Everything about it, including the two client alarms not yet proven on real gear, is on [UniFi Network](/gateway/unifi/).

## Everything else: gateway mode

**PROFINET, EtherCAT, HART, BACnet/IP, DNP3, FINS, MELSEC/SLMP, CANopen, FANUC FOCAS**

None of these are spoken natively, and there's no driver for them. That's a deliberate choice, not a gap waiting to be filled with a stub.

Sites running these almost always already have a gateway that republishes on OPC UA or Modbus: a PROFINET IO controller with an OPC UA server, a HART multiplexer with a Modbus map, a BACnet/IP to Modbus bridge. Point a device at that endpoint, configure it as OPC UA or Modbus, and move on.

Writing nine more drivers that each duplicate what a site's existing gateway already does would add nine more things to get subtly wrong, for the protocols whose equipment is hardest to test against. If a site genuinely has no gateway and needs one of these natively, that's real work to schedule, not a file that logs "not implemented".

**There are no placeholder drivers in this tree.** A protocol either has a working implementation or it's in this section.

## Device credentials

A device's `config` and `address` are where a driver finds what it logs in with. Every one of these is write-only through the API (since 4.15.1): it shows as `[redacted]` to every role, admin included; a save that sends the placeholder or leaves the key out keeps the stored value; and a new string replaces it.

| Protocol | Credentials in the configuration | Credentials in the address |
|---|---|---|
| OPC UA | `password` (with `username`) | none: user information in the address is hidden, and the driver ignores it |
| MQTT / Sparkplug B | `password` (with `username`) | `mqtt://user:pass@host`, which the client uses |
| HTTP / REST | `password` (with `username`, sent as basic auth); every value in `headers` except plain ones such as `Accept` and `Content-Type`, which is where an API key or `Authorization` header goes; `body` and `writeBody` if they mention a credential | `http://user:pass@host` and `?api_key=` style query values, in the address and in `writeUrl` |
| MTConnect | `password` (with `username`); every value in `headers`, with the same exceptions | `http://user:pass@host` and query values |
| UniFi Network | `password` (with `username`), only ever stored encrypted: without a key, the device can't be saved | none: the address is the console's `https://` URL |
| Modbus, S7comm, EtherNet/IP | none | none: user information in the address is hidden, and the driver ignores it |

Any other option whose name looks like a credential (it contains `password`, `token`, `secret`, `apikey`, `authorization`, `private` or `passphrase`, ends in `key`, or has a whole word such as `pass`, `pw`, `auth`, `cred` or `sig`, among others) is hidden too, in any protocol. So an option added to a driver later is hidden until somebody decides it shouldn't be. A test walks every driver's options and fails until each is on the list of credentials or the list of options known not to be.

**Encrypted at rest, since 4.17.0.** With `HOTLOOP_SECRET_KEY_FILE` set, every credential in the configuration column above is encrypted in the database with a key that lives outside it, so a dump or a backup holds ciphertext. The drivers never see the difference. The chart sets it up on its own: it generates the key into `<release>-secret-key` on first install, keeps it across upgrades, and keeps it through a `helm uninstall`. Lose that key and every stored device password has to be typed in again, so back the Secret up somewhere other than next to your backups. [Install](/gateway/install/#back-up-the-key-before-you-need-it) has what that means for a restore.

A credential written into a URL (`mqtt://user:pass@host`) or into free text is hidden from every screen but stays in the clear in the database. Use the `password` option. And protect the database and the backup volume like they hold the keys to the plant anyway, because the day somebody puts a password in a URL, they do.

:::caution[Still on 4.16.0? These are in the clear]
4.16.0 stores every one of these credentials in the clear, in the database and in every backup. [Upgrading to 4.17.0](/gateway/upgrading/#upgrading-from-4160) seals them at the first start, and from then on the key's Secret is part of your data.
:::

## Adding a device

1. **Devices, then Add device.** Pick the protocol and give it an address.
2. **Discover tags** where the protocol can list its own points: OPC UA, EtherNet/IP, MTConnect, MQTT (after a Sparkplug birth), HTTP. Modbus and S7comm can't, so declare those from the device's documentation.
3. Imported tags are created **read-only**. A point the device happens to expose isn't a point somebody has decided may be commanded. Mark tags writable one at a time, deliberately. [The write gate](/gateway/write-gate/) has the rest of what stands between a tag and a write.
4. Set `scale` and `offset` for raw counts: `engineering = raw × scale + offset`.
5. Set a `deadband` on anything noisy. It keeps changes too small to matter out of the historian. Without one, a 12-bit sensor jittering in its last bit writes a row every scan until the disk fills.

## Quality

Every reading carries `good`, `uncertain` or `bad`.

**Bad means the value is not known. It does not mean zero.** A driver that can't read a point still emits a reading, marked bad, because silence looks exactly like a value that hasn't changed. On a trend, the difference between "the sensor reads 0" and "the sensor stopped answering" is the difference between a process problem and an instrument problem, and you really want to know which one you're sending a tech out for.

Alarm evaluation holds its previous state on a bad reading instead of evaluating it. A sensor that fails to zero would otherwise trip every low alarm on the unit and look like a process event.
