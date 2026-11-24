---
title: "HotLoop Transmitter 1.3.0"
description: "Millisecond timestamps, WSTRING fields, a status per field, several DataSets in one NetworkMessage, and delta frames with KeepAlive, off by default."
---

HotLoop Transmitter puts your PLC's values on the network as OPC UA PubSub, from a library you drop into the CODESYS project. 1.3.0 adds timestamps to the millisecond, WSTRING fields, a status on a field so a bad value goes out as bad, several DataSets in one NetworkMessage, and Data Delta Frames with KeepAlive messages. It is library 1.3.0.0, and HotLoop Alarms 1.0.0.0 comes with it unchanged.

What that means for you: a PLC project that already uses 1.2.0 sends the same bytes as before, with one visible difference, the timestamp now has milliseconds. Everything else is something you switch on with a call or an input.

## What's new

* **Timestamps to the millisecond.** Both the NetworkMessage and the DataSetMessage are stamped with the clock's milliseconds, so a subscriber sees when each message was built instead of the second it fell in. `bStampHighRes` tells you which clock the last message used.
* **WSTRING fields.** `AddWString(ADR(wName), N)` publishes a `WSTRING(N)` as an OPC UA String, in Variant and in RawData. The text goes out as UTF-8: a character above U+FFFF, which is a surrogate pair in the PLC, goes out as one four byte character, and an unpaired surrogate goes out as U+FFFD, so what a subscriber reads is always valid text. In RawData the field's MaxStringLength is `3 * N` bytes.
* **A status on a field.** After you add a field, `SetStatus(ADR(udiStatus))` ties it to a UDINT that holds an OPC UA StatusCode. While that variable is not 0 the field goes out as the StatusCode instead of its value, and a subscriber reads it as bad quality. Set it back to 0 and the value goes out again. A RawData publisher keeps sending the value, because RawData has no way to carry a status.
* **Several DataSets in one NetworkMessage.** `AddDataSet(uiWriterId, udiConfigMajor)` starts another DataSet in the same block: the fields you add after it belong to it. Each publishing interval one NetworkMessage carries one DataSetMessage per DataSet, with the Sizes array Part 14 asks for, so more than one writer shares a datagram. Up to 8 DataSets. If you never call it, the message is the one 1.2.0 sent.
* **Data Delta Frames and KeepAlive.** A steady dataset no longer has to send every field every interval. With delta frames on, a publisher sends a full key frame first and every `uiKeyFrameEvery` messages, a Data Delta Frame with only the fields that changed in between, and a KeepAlive when nothing changed. `bDeltaActive`, `udiDeltaSent` and `udiKeepAliveSent` show what it is doing.

## What changed for a project that uses 1.2.0

* Your field list and your wire format did not change. The only difference on the wire is the millisecond part of the timestamp.
* HotLoop Alarms 1.0.0.0 is in the release, unchanged.

## Settings and defaults

* `bHighResTimestamp` is `TRUE`: stamp with the clock's milliseconds. Set it to `FALSE` to stamp whole seconds, exactly as 1.2.0 did. If the runtime cannot give milliseconds, the block stamps whole seconds on its own.
* `bDeltaFrames` is `FALSE`. Delta frames are a setting you turn on for a publisher, not something the block does unasked, so every subscriber you have keeps reading full key frames. To turn it on for a writer, set `bDeltaFrames := TRUE` on that publisher and, if you want a different key frame spacing, `uiKeyFrameEvery` (10 unless you set it). Each publisher decides for itself, so one writer can send deltas while the others do not. A subscriber that discards delta frames shows a change at the next key frame, so turn it on for subscribers that read them. It applies to Variant publishers with one DataSet; a RawData publisher, or a block with more than one DataSet, sends key frames.
* `AddDataSet`, `AddWString` and `SetStatus` are calls you make once at start, like the other `Add` calls. Without them nothing changes.

## Upgrade

Install `HotLoopTransmitter-1.3.0.library` (or open the `.package` with the CODESYS Installer), change the library version in your project's Library Manager to 1.3.0.0, and compile. Nothing in your code has to change. Add the new calls when you want what they do.

## Rolling back

A project pinned to 1.2.0 keeps working and sends the same bytes it did, with whole second timestamps. HotLoop Alarms is a separate library and is not affected.

## Not in this release

Message security, chunked NetworkMessages, the subscriber side, and MQTT transport.

## Files

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
5be90a88e9e0aae1de421628fb6ca8e810dda96b4562566df345d451ecd859cf  HotLoopTransmitter-1.3.0.compiled-library
0410b98578fd55775a97b27023a0b5f30111cac0587120894354d9edca1248fc  HotLoopTransmitter-1.3.0.library
3e791358e6dc628a2d2aae760e0c49c89f1c4490f0637b65864c335fcbb3e9a0  HotLoopTransmitter-1.3.0.package
```
