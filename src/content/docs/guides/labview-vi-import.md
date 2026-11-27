---
title: "Import a LabVIEW VI into FlowLab"
description: "Import a LabVIEW .vi into FlowLab: the front panel names, the block diagram with its wires, constants, loops and case structures, and what it lists as not read."
sidebar:
  label: "LabVIEW VI import"
---

You have LabVIEW programs and FlowLab runs the same kind of test bench. Import the VI and FlowLab opens it, tells you what is in it, and tells you what it could not take, so you start from the VI's own wiring and not from a blank page.

## Import a VI

In the Flow editor, choose **Import** and pick the `.vi` file. The dialog lists what did not come across, and nothing is added until you press **Import**. Reading a VI saves and deploys nothing.

Over the admin API it is `POST /flows/import-vi` with the file's name and the VI as base64, and an agent has it as the `import_vi` tool.

## What comes across

- The VI's description and the version of LabVIEW that saved it.
- The names on the front panel, in the order the file holds them.
- The block diagram, as a FlowLab diagram tab with the VI's own wires: constants with their values read by type, each front panel terminal as a control or an indicator, calls of other VIs by name, loops and case structures, and the diagram inside each structure as a tab of its own.
- Free labels and comments on the diagram.

The result arrives as flows, with a comment on the first that says all of this, so an imported VI is never mistaken for a diagram you drew.

## What you finish by hand

LabVIEW numbers its primitives, and the table of what each number does belongs to LabVIEW and is not in the file. A primitive arrives as a named LabVIEW node, wired where it was, and a diagram that holds one does not run until you replace it with the FlowLab node that does the same job. The error list names each one. A diagram that ran with a guess in that place would give numbers that are wrong while they look right, and on a test bench that is the worst answer.

The dialog also says, every time, that these are not read: the settings inside nodes, the front panel controls' defaults, ranges, and formats, the front panel layout, and the contents of the VIs it calls. Each called VI is another file, so import it too.

## How far it has been proven

The reader was run over all 425 VIs of the MIT-licensed NI icon editor, saved by LabVIEW. The number of wires it reads equals the number of signals the independent pylabview reader finds in the same file on every one, with no wire missing a source or an owner and no VI refused. [FlowLab](/flow/flowlab/) has the rest of the diagram model, and the [Flow quick start](/flow/quick-start/) gets you a runtime to import into.
