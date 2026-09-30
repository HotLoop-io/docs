---
title: "UniFi Network: the plant network as tags"
description: "A read-only UniFi driver: switches, ports, PoE, WAN failover and clients as tags, with a pinned certificate, one login per console, and an OT watch."
sidebar:
  label: "UniFi"
---

A PLC goes quiet at 2 a.m. and the first question is always the same: is it the PLC, or the switch port it's plugged into? Until now the answer lived in the UniFi app on somebody's phone, and that somebody was asleep. So HotLoop reads the UniFi console itself: every adopted switch, every port, PoE draw, the WAN links, which WAN is carrying traffic, and the site's health, as ordinary tags. Alarms, trends, entities, automations, the OPC UA server and MCP all work on your network without knowing UniFi exists.

**The whole driver is read-only.** Nothing in HotLoop writes to a controller yet: not a PoE mode, not a port, not a setting. The driver's Write refuses, and the account it logs in with can be View Only.

:::note[New in 4.17.0]
UniFi is new in 4.17.0, and 4.16.0 doesn't have it. [Upgrade](/gateway/upgrading/) first. What 4.17.0 ships is the Network driver (U1) plus clients and the OT watch (U2), both read-only: nothing in 4.17.0 writes to a console. U2's real cable pull and a phone joining SCADA haven't been done on real gear yet; [What's verified](#whats-verified) has exactly where it stands. The rest of the UniFi plan is further down, marked as not built.
:::

## Its first real read got fooled

On 2026-09-28 the driver's first read on real gear went against the house Cloud Gateway Ultra. Its U5G Backup, the 5G failover, had been dead since 2026-09-26 23:54 EDT: no power, no link on its switch port. The console's WAN block still said `up: true`, with a stale 80% 5G signal.

HotLoop's first real read called the backup up, because it trusted the WAN block's stale `up` the same way the console's summary did. The gateway's own health checks (`last_wan_interfaces`, then `last_wan_status`) knew it was dead. The driver reads those now, so a dead backup reads down, and `TestUniFiADeadBackupWANReadsDown` holds it to the CGU's exact fields. That's the failure a plant has to see: failover quietly gone for two days and counting, with the gateway's own summary looking healthy. You want to find that out from a tag, not the night the fiber gets cut.

## Adding a console

One HotLoop device is **one site on one console**. A Cloud Gateway and the Express behind it are two consoles, so two devices with two logins, because each console has its own local accounts.

1. **Make a local account on the console.** Settings, Admins & Users, Add Admin, tick **Restrict to Local Access Only**, role **View Only**. A Ubiquiti cloud account can't log in from anything but the app: it needs MFA, and the console answers a script with `403`. We call ours `hotloop-ro`.
2. **Add the device.** Devices screen, **Add device** (or `POST /api/devices`; either takes `devices.write`, so an admin). Protocol `unifi`, and the options below go in the protocol configuration JSON, like `{"username": "hotloop-ro", "password": "..."}`. The address is `https://host` for a console running UniFi OS (Cloud Gateway, Dream Machine, UniFi OS Server) or `https://host:8443` for the self-hosted Network Application. A 15 s poll is about right; the driver never reads a console more than once every 10 s whatever you set, and serves the last read in between.
3. **Save without a fingerprint.** The first connect fails, on purpose, and the error hands you the fingerprint of the certificate the console presented.
4. **Check it's your console**, paste it into `certFingerprint`, save. The tags create themselves on the next poll.

To check the fingerprint yourself, it's the SHA-256 of the certificate's public key:

```sh
openssl s_client -connect host:443 </dev/null \
  | openssl x509 -pubkey -noout \
  | openssl pkey -pubin -outform der \
  | sha256sum
```

| Option | Default | What it does |
|---|---|---|
| `site` | `default` | The site's short name, the one in the console's URLs. `default` is the first site on every console |
| `username`, `password` | required | The local account. The password is write-only through the API and encrypted in the database |
| `certFingerprint` | none | SHA-256 of the console certificate's public key, as hex. Colons, spaces and upper case are fine |
| `caFile` | none | Trust a CA instead of a pin, for consoles with real certificates |
| `insecureSkipVerify` | `false` | Trust any certificate. For a bench, never a plant. Ignored when a pin or a CA is set |
| `clientTimeoutSec` | `90` | How long after the console last saw a client it still counts as on the network. Floor 30 |

### Why the certificate is pinned

Consoles ship self-signed certificates, and the lazy answer is to skip verification. That's fine for reading a meter. It's not fine for a login that can see the whole plant network. A pinned console that presents a different certificate is refused during the TLS handshake, **before the username or password is sent**, and the error names both fingerprints and tells you straight: if you didn't replace or reset the console, something else is answering at that address. The pin is on the public key, so a console that re-issues its certificate on the same key keeps working. There's no silent "trust on first use". The one moment trusting a certificate means anything is when a person is looking at it, so that's the moment it happens.

### The password never sits in the clear

A console login reaches the whole plant network, so HotLoop won't store one unencrypted. The password is sealed with a key that lives outside the database, `HOTLOOP_SECRET_KEY_FILE`, and a dump or a backup holds only ciphertext. The chart generates that key on install and keeps it across upgrades and uninstalls, in the `<release>-secret-key` Secret. Off the chart, make one with `hotloop gen-secret-key` and point the variable at it. **Without a key, a UniFi device refuses to save.** Back the key up somewhere the database backups aren't, because a key stored next to its backups protects nothing.

## Logins: once, and not again unless it has to

Logging in on every check got our own Cloud Gateway to answer `429` and lock the account out. Twice. So:

- **One session per console per process.** Every poll, and every site on the console, rides the same login. Two devices for two sites on one console with the same account are one session.
- **It logs in again only when the console says the session is gone** (`401`), one caller at a time, and **never more than once a minute**, whatever happens. A session that dies twice inside a minute reads bad until the minute is up. That's the trade we want.
- **A refused login isn't retried.** A wrong password, a cloud account, or a `429` lockout waits at least five minutes, longer if the console's `Retry-After` says so, and the device's error says which it was. Switching the device off and on doesn't buy another try: the process remembers.
- **It logs out** when the last device using a console stops, so restarts don't pile sessions up on the console.
- **A process started with `--mcp-stdio` never logs in.** The Gateway beside it already holds the session, and a second login from the same box is exactly what earns the `429`.

## What comes in as tags

Every tag is made by the driver, read-only, and named from MAC addresses and port numbers, never display names, so renaming a switch in the UniFi app breaks nothing. `<mac>` is the device's MAC in lower case without separators, `<nn>` the port number in two digits.

| Tag | Type | What it is |
|---|---|---|
| `d.<mac>.state` | text | `connected`, `disconnected`, `pending`, `upgrading`, `provisioning`, `heartbeat_missed`, `adopting`, ... |
| `d.<mac>.online` | bool, connectivity | Connected to the console |
| `d.<mac>.uptime_s`, `.cpu_pct`, `.mem_pct` | int s, float % | Uptime, CPU and memory |
| `d.<mac>.temp_c` | float, °C | Temperature, on devices with a sensor |
| `d.<mac>.clients`, `.fw` | int, text | Clients connected through it, firmware version |
| `d.<mac>.wan<N>.up` | bool, connectivity | WAN N is **alive** by the gateway's own health checks, not merely configured. A console that reports neither check reads bad, never up |
| `d.<mac>.wan<N>.latency_ms` | float, ms | Its latency, good only while the WAN is alive |
| `d.<mac>.wan<N>.availability_pct` | float, % | Availability over the gateway's own window (a day), when it reports one |
| `d.<mac>.wan.active` | text | Which WAN carries traffic: the uplink's if it's alive, else the first live one, `none` if none is |
| `d.<mac>.wan.failover` | bool, problem | Traffic is on anything but the first WAN: the plant is on the backup |
| `p.<mac>.<nn>.up` | bool, connectivity | Port link |
| `p.<mac>.<nn>.speed_mbps` | int, Mbit/s | Link speed; 0, good, on a port with no link |
| `p.<mac>.<nn>.rx_bps`, `.tx_bps`, `.errors` | float bit/s, int | Traffic, and receive plus transmit errors |
| `p.<mac>.<nn>.poe_w`, `.poe_mode` | float W, text | PoE draw on ports that can supply it; mode `auto`, `off`, `pasv24`, `passthrough` |
| `site.<subsystem>.status` | text | The site's health: `wan`, `www`, `lan`, `wlan`, `vpn` |
| `site.www.latency_ms`, `site.network_version` | float ms, text | Internet latency when reported; the Network version the console runs |

Device classes carry through to entities, so a port's link comes out as a connectivity binary sensor and its PoE draw as a power sensor without anybody setting them. Put an alarm on `d.<mac>.wan.failover` and you know the plant is on the backup before the data bill does.

**Tags add themselves and never go away on their own.** A switch adopted next week shows up as tags on the next poll, on the same session, with no restart. An unplugged switch reads `online` 0 and its ports go bad quality, so an alarm on it says so instead of vanishing with it. Deleting its tags is a person's call. A tag somebody switched off stays off; the driver doesn't get a vote. Only adopted devices get tags, and a point the console doesn't report reads bad, never a made-up zero. The [Edge Relay](/edge-relay/overview/) can poll a console too. It reads the tags its device file declares and adds none, because it has nowhere to keep them, and it gets no OT lists.

## Clients and the OT watch

Two jobs, both read-only. **Where is it plugged in:** link a HotLoop device to its client once, and when it goes quiet its drawer says which switch and port it's on and whether that link is up, before anybody opens the UniFi app. **What's on the SCADA network:** mark a network OT, accept what belongs on it, and anything else that shows up raises an alarm naming it. Somebody plugs a laptop into the SCADA switch at 2 a.m., you know at 2 a.m. Where this stands: proven against the lab controller and read-only on both house consoles, and not called done until two things happen with somebody at the rack, a real cable pull and a phone joining SCADA. The verified section below has the detail.

**Nothing keys by IP**, because the console's client list lags. The house notes caught it showing addresses machines had left hours earlier, and the lab controller kept a client listed for over a minute after its switch reported the cable pulled. So a client is its MAC. And a client is online when the console saw it within `clientTimeoutSec` (90 s) **and**, if it's wired, its switch port has a link. The port is the fast half: pull the cable and the port reads down on the next read, while the list is still catching up.

### Linking a device

Open a device's drawer. On a plant with a UniFi console, the **Network** section proposes whatever client a console lists at the device's IP, and an admin clicks **Link**. No IP to go on? Type the MAC, pick the console, **Link by MAC**. From then on the MAC is the key and the IP is only ever the console's opinion. The drawer then reads like this, from the driver's last read:

```
on USW Lite 8 PoE port 5, link down; the console last saw it 25s ago; off the network: its switch port 5 has no link
```

The link gives the client `c.<mac>.*` tags on the console's device, so the port's state trends next to the Modbus values that stopped, and an alarm, **"PLC-07 off the network"**, priority 1, on `c.<mac>.online`, with a 120 s on-delay so a PLC rebooting doesn't page anybody. **Unlink** takes the alarm away with it, unless the client is still watched from a known list.

### OT networks and the known list

There's no screen for this yet; it's the API. Mark a network OT with `PUT /api/unifi/{id}/networks/{network}` and `{"ot": true}`, then accept what's on it: everything as it is right now in one call (`POST .../accept-all`), or one device at a time. Marking it creates an alarm named for the network, like **"Unknown device on SCADA"**, priority 1, on `n.<network>.unknown`, raised the moment one stranger is online. `n.<network>.unknown_last` names the newest: its MAC, what it calls itself, its IP, and the switch port or SSID it came in on.

A known device can be **watched** (`"watch": true`) and gets the same tags and the same off-the-network alarm as a linked one. A PLC is watched. A maintenance laptop that's allowed on but comes and goes is known and not watched, or it pages somebody every time it leaves.

These are ordinary alarm definitions: shelve them, acknowledge them, send them to Discord, edit their delay. Take the watch, the link or the OT mark away and HotLoop removes the alarm it made, so a tag nobody reads any more doesn't hold an alarm open. An alarm an admin wrote by hand is never touched.

The record is HotLoop's, in its own tables (`unifi_networks`, `unifi_known`, `unifi_links`, all in backups), never the console's. A change reaches the running driver on its next read, on the session it already has. It doesn't restart the device, because a restart logs out and the once-a-minute login budget would then lock it out for a minute.

| Tag | Type | What it is |
|---|---|---|
| `n.<network>.clients` | int | Clients on the network now, online by the test above. Every LAN network gets one |
| `n.<network>.unknown` | int | On an OT network: online clients not on its known list |
| `n.<network>.unknown_last` | text | The newest of them, in words. Empty when there are none |
| `c.<mac>.online` | bool, connectivity | A watched or linked client is on the network |
| `c.<mac>.ip` | text | Its IP, as the console last saw it. Bad, saying so, when the console has none |
| `c.<mac>.sw_mac`, `.sw_port` | text, int | The switch and port a wired client is on. Kept after the cable comes out: where it *was* is the point |
| `c.<mac>.port_up` | bool, connectivity | That port's link. Bad when the switch itself has dropped off the console, because then nobody knows |
| `c.<mac>.last_seen_s` | int, s | Seconds since the console last saw it |

`<network>` is the console's ID for the network, so renaming SCADA in the app breaks nothing. A network marked OT that the console has since deleted reads bad with that reason, never a quiet zero. Only watched and linked clients get `c.*` tags, so a guest network churning 300 phones doesn't make 300 tag sets.

## Routes, MCP and permissions

None of these asks the console anything. They read the driver's last read, so a screen left open, or an agent asking in a loop, costs the console nothing and can't be what earns the `429`. They answer `503` until the device has been read once, and always in an `--mcp-stdio` process, which never logs in. None of them writes to a console.

| Method | Path | Permission |
|---|---|---|
| `GET` | `/api/devices/{id}/network` | `devices.read` |
| `PUT`, `DELETE` | `/api/devices/{id}/network` | `devices.write` |
| `GET` | `/api/unifi/{id}/networks`, `/api/unifi/{id}/known`, `/api/unifi/{id}/clients` | `devices.read` |
| `PUT` | `/api/unifi/{id}/networks/{network}` | `devices.write` |
| `POST` | `/api/unifi/{id}/networks/{network}/accept-all` | `devices.write` |
| `PUT`, `DELETE` | `/api/unifi/{id}/networks/{network}/known/{mac}` | `devices.write` |

Everybody can see the network: every role holds `devices.read` and `tags.read`. Adding a console, linking, marking a network OT and accepting devices change what the plant is configured to be, so they take `devices.write`, which only an admin holds. Acknowledging and shelving the alarms is `alarms.ack`, like any alarm, which operators hold. `PUT .../known/{mac}` on a network never marked OT is a `400`, and so is marking a WAN.

Over [MCP](/gateway/mcp/), `find_network_client` answers the first question about a quiet PLC. Give it `deviceId` and it follows that device's confirmed link; give it `query` (a MAC, an IP or part of a name) and it searches every console HotLoop reads. It's read-only, so it needs nothing beyond the MCP token. Ask the Gateway's endpoint, not an `--mcp-stdio` process, which has no console read to answer from.

## What's verified

**Against a real UniFi Network Application (10.6)** in the Podman lab and in CI, with an emulated USG, two USW-Lite-8-PoE and a Flex Mini adopted over the real inform protocol ([unifi-emu](https://github.com/jamesbraid/unifi-emu), MIT), as a View Only account: the one session, a killed session coming back with exactly one new login, the once-a-minute limit, a wrong password refused and not retried, the certificate pin (unpinned, mismatched, right), two sites on one login, tags creating themselves, device classes on the entities, a switch adopted while HotLoop runs showing up without a restart, and an unplugged switch reading offline with its ports bad. A `429` lockout with `Retry-After` is proven against a stand-in only, because no lab console locks an account out.

**Against a real UniFi OS Server (5.1, Network 10.6)** in the Podman lab, not in CI (it needs systemd, host cgroups and a 2 GB image): the UniFi OS login, the `TOKEN` cookie and CSRF token, the Network API under `/proxy/network`, a logout that really ends the session, and a wrong password answered `403`.

**Clients and the OT watch, against the lab controller.** The emulator's switches report every port up and nothing learned, so a test switch adds what a real one reports: each port's MAC table and its link. The controller is real; the "devices" on its ports are MAC addresses in a switch's report, not machines on a wire. Proven there: the client tags, a pulled cable reading `port_up` 0 and `online` 0 on the next read while the console still lists the client, an OT network naming a laptop that isn't on its list and clearing when it's accepted, a deleted network reading bad, both alarms raising through the real alarm engine, linking by IP proposal in a real browser, the API, `find_network_client`, and the record surviving a backup and restore.

**On real gear, read-only, as `hotloop-ro`, nothing written.** The house Cloud Gateway Ultra (two USW-Lite-8-PoE and the U5G Backup behind it) and an Express 7, both UniFi OS on Network 10.6.106, certificates pinned.

- 2026-09-28: one login per console every run, 159 points on the CGU's site and 60 on the Express's. WAN1 alive on both (about 20 ms, 99.86% availability over the day on the CGU), active WAN right, failover off, and the dead 5G backup above. PoE read 0 W everywhere, which is true: the one port allowed PoE has the dead U5G on it. Empty ports read 0 Mbit/s, good (the first read called that missing data on all 11 down ports; fixed). A disconnected device reads `disconnected`, with its uptime and client count bad as stale.
- 2026-09-29, clients: thirteen reads ten seconds apart, still one login per console. View Only reads everything the client work needs. Every wired client landed on the switch and port the rack diagram says, seven on the CGU and two on the Express; twelve wireless clients carried their SSIDs. The oldest `last_seen` of any client across 26 reads was 22 s wired and 28 s wireless, so the 90 s timeout won't flap a watched PLC. A network marked OT for the run named its newest stranger with MAC, name, IP, switch and port. A phone with no IP read online with its `ip` tag bad. And a stale IP showed up live, which is why nothing keys by IP.

**Not verified yet, and not claimed:**

- **A real cable pull** on a watched device, and **a phone joining SCADA** after it's marked OT. Both need somebody at the rack, and the clients and OT watch aren't called done until they happen. The lab proves both against the real controller; the house hasn't yet.
- **Real PoE draw above zero, and a power-cycle.** Nothing in the house draws PoE right now; that waits for the PoE test device.
- **Temperature.** No device on either console, and no emulated one, reports a sensor.
- **A 24 hour soak** against the CGU.

## Not built yet

In order, and none of it is in 4.17.0:

- **Screens and the topology map.** An overview with a WAN strip that goes amber when the site is on the 5G backup, a topology map laid out the same way every time so nothing jiggles on a wall board, switch faceplates, clients, networks and WiFi, two consoles stitched into one picture.
- **Events.** The controller's events websocket, so a switch dropping off shows in seconds and lands in the [logbook](/gateway/logbook/). Polling stays the truth; a dead websocket costs speed, never correctness.
- **Writes, through the [write gate](/gateway/write-gate/).** Locate LED first, because it's zero risk and proves the whole write path on real gear. Then, once that's proven on the lab controller and one empty port: PoE mode, port power-cycle (15 minute cooldown per port, because a rule cycling a PLC every two minutes is how you cook a power supply), WLAN on and off, client block, and disabling the port an unknown device showed up on. HotLoop won't cycle an uplink or the port powering the 5G backup, no matter who asks.
- **Self-healing.** A built-in blueprint: device silent for N minutes, cycle its port once, then alarm. Once, not forever.
- **Protect, Access and SmartPower PDUs.** Cameras as entities with detections as triggers, door events in the logbook with unlock behind the gate, outlet power and switching. Each one merges after it's run against real gear on the bench, not before.

## What it will never do

**Network configuration: VLANs, firewall rules, DHCP, static IPs, SSIDs.** We've already watched a switch lose its controller over one static IP change. That's what the UniFi app is for. **Firmware upgrades**, for the same reason, plus a failed gateway upgrade is an outage. HotLoop does the handful of things an operator needs at 2 a.m., and it leaves your network design the hell alone.

UniFi is a trademark of Ubiquiti Inc. HotLoop isn't affiliated with or endorsed by Ubiquiti; this is an independent integration that talks to your own console on your own network.
