---
title: "Move a CODESYS WebVisu screen to HotLoop"
description: "Export a CODESYS visualization from the IDE and import it into HotLoop as a screen on the same PLC variables, listing every element it could not place."
sidebar:
  label: "WebVisu to HotLoop"
---

Your operators already have a CODESYS screen. This is how to run it in HotLoop, outside the runtime, on the same PLC variables.

## Before you start

HotLoop has to read the PLC. [HotLoop for CODESYS](/codesys/overview/) does that through the runtime's own OPC UA server, with nothing installed in CODESYS. The PLC publishes the variables with a Symbol Configuration in the IDE, and the screen reads them by the names the programmer gave them.

## 1. Export from the IDE

Select the visualization in the project tree and use **Project, Export**, which writes a `.export` file. Do not use **Export PLCopenXML**, which has no visualization in it, and HotLoop says so if you pick it. A TwinCAT `.TcVIS` file goes through the same converter.

## 2. Read the file

On the Dashboards screen choose **Import**, pick the `.export` file, and press **Read the file**. Before anything is saved it tells you:

- the visualization it found, and asks which if the file holds several,
- every tag the screen reads that this install does not have,
- **worth a look**: every element it could not put on the screen, with the reason.

## 3. Map the variables

The variables arrive as `plc/<GVL>.<variable>`. Map the device `plc` to the HotLoop device the PLC is on and every tag moves at once, or map them one by one.

## 4. Import

Nothing is saved until nothing is in the way. A button or a setpoint on a tag that is not marked writable is refused, the same as a build, so the screen never has a control the write gate would turn down.

## What you get

Readouts, labels, lamps, switches, buttons, meters, and the pipes and vessels behind them come across, with each element in its pixel place and the screen drawn as one scaled picture, so it holds its shape on a wall panel and on a phone. Invisible and toggle color variables become rules on the symbols. [Import a CODESYS screen](/iot/codesys-screen-import/) has the full table and the list of what does not come across, said one line each in the import and never dropped quietly.

## Then

Open the screen, check the readouts against the plant, and put the setpoint and button cards where your operators expect them. From here an imported screen and a hand-built one are the same: it exports as a [screen file](/iot/screen-file/), versions with every save, and goes to another install the same way.
