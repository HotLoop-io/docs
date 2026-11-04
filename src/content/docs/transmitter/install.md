---
title: "Install HotLoop Transmitter"
description: "Install the library into the CODESYS library repository, add it to a project, and what to do when the block reports an error."
---

You need a CODESYS development system, 3.5 SP22 or later, and a runtime whose target has the SysSocket and SysTimeRtc components,
which the CODESYS Control runtimes for Linux SL have (the second one is new in 1.1.0, for the timestamp).

## From the CODESYS Installer

Since 1.1.0 the release also has `HotLoopTransmitter-1.1.0.package`, at https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.package. Install it with the Package Manager of the IDE (Tools, Package Manager), or with no window using `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"` with no window). The Installer puts the library into that profile's library repository under the company HotLoop, and you go to step 3 below. The package is the same library as the `.library` file, in a ZIP the Installer reads, so the two routes give the same library.

## From the library file

1. Download `HotLoopTransmitter-1.1.0.library` from https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.library, and check it against `SHA256SUMS` in the same folder (`sha256sum -c SHA256SUMS`).
2. In the CODESYS IDE: Tools, Library Repository, Install, pick the file. It is now in the repository under the
   company HotLoop.
3. In your project, open the Library Manager of the application, Add Library, and pick HotLoop Transmitter.
   SysSocket, SysTimeRtc and their interface libraries come with it as dependencies and need nothing from you.
4. Declare a `HLTX.FB_HLTX_Publisher`, add your fields, call it every cycle (README has the example).
5. Download to the controller. The destination must be reachable from the controller's network; for multicast the
   network's switches must carry the group.

The `.compiled-library` file is the same library without its source. Install that one instead if you do not want the
Structured Text visible in the Library Manager. It is in the same folder, as `HotLoopTransmitter-1.1.0.compiled-library`.

To check what arrives, any UDP listener on the destination port works. The lab used a small Go program that listens on a port or joins a
multicast group and prints each datagram as a line of JSON with its hex.

## If the block reports an error

| `eError` | Meaning | Do |
|---|---|---|
| `NoFields` | no field was added | call an `Add` method before enabling |
| `BadInterval` | `tPublishingInterval` is under 1 ms | set it |
| `BadAddress` | `sDestination` is not a dotted IPv4 address | fix it |
| `SocketCreate`, `SocketOption` | the runtime refused a socket call; `diLastSocketResult` has its code | the block retries by itself after `tRetry` |
| `TooBig` | the fields do not fit in 1472 bytes | publish fewer, or use two publishers with different writer ids |
| `BadField` | a stored address was cleared | `Clear()` and add the fields again |
