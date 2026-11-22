---
title: "Η παλέτα κόμβων"
description: "Κάθε τύπος κόμβου που περιλαμβάνει το Flow, χαρακτηρισμένος πλήρης, μερικός, αποκλίνων ή μόνο του Flow, με τη διαφορά από το Node-RED γραμμένη."
---

**117 τύποι κόμβων για μηνύματα και άλλοι 39 για διαγράμματα FlowLab.**

| Κατηγορία | Κόμβοι |
|---|---|
| Κοινοί | inject, debug, complete, catch, status, link in, link out, comment, junction |
| Συνάρτηση | function, switch, change, range, template, delay, trigger, exec, rbe |
| Δίκτυο | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail, και οι κόμβοι modbus-read/getter/flex-getter/write/flex-write/server του Node-RED |
| Ακολουθία | split, join, sort, batch |
| Αναλυτής | csv, html, json, xml, yaml |
| Αποθήκευση | file, file in, watch, influxdb out, postgres, postgresql |
| Πίνακας ελέγχου | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template, και οι ui_base, ui_tab, ui_group, ui_link και ui_spacer που διαμορφώνουν τη σελίδα |
| Ανακάλυψη | scan, netinfo, για την καταγραφή ενός τμήματος OT |
| Ρυθμίσεις | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

Η γραμμή του FlowLab είναι ένα διαφορετικό είδος κόμβου. Τρέχει σε μια καρτέλα που είναι διάγραμμα, όπου ένας κόμβος εκτελείται μία φορά όταν κάθε είσοδος έχει τιμή, και δεν δέχεται ποτέ μήνυμα. Τι είναι το FlowLab και πώς λειτουργούν οι βρόχοι, το καλώδιο σφάλματος, ο πίνακας και ο εντοπιστής σφαλμάτων του βρίσκεται στο [FlowLab](/el/flow/flowlab/). Ένα αρχείο ροής, και άρα ένα σύνολο διαγραμμάτων, μπορεί να σταλεί σε κάθε εγκατάσταση Flow που τρέχει ένας μισθωτής στο EmberNet, καθεμία ελεγμένη και όποια αποτύχει επαναφερμένη: [Αποστολή στους σταθμούς ενός μισθωτή](/el/flow/stations/). Δύο εγκαταστάσεις μπορούν να μοιραστούν τη δουλειά μίας, με μίσθωση και φράγμα σε κάθε εγγραφή στον εξοπλισμό ώστε να γράφει μόνο μία: [Ζεστή εφεδρεία με μίσθωση](/el/flow/failover/).

## Ενημέρωση ανθρώπων, και Kafka

Πέντε κόμβοι στέλνουν κάπου αλλού ό,τι μεταφέρει ένα μήνυμα και προωθούν το μήνυμα: **ntfy out**, **gotify out**, **discord out** (ένα webhook), **discord bot out** και **kafka out**. Παίρνουν τις ίδιες ρυθμίσεις με τις οποίες ο πυρήνας του HotLoop στέλνει τους συναγερμούς και τα συμβάντα του, ώστε ένα εργοστάσιο που έχει ήδη ένα θέμα ntfy, μια εφαρμογή Gotify, ένα webhook Discord ή μια συστάδα Kafka να στρέφει το Flow στα ίδια.

- **ntfy.** Ένας κόμβος ρύθμισης διακομιστή (διεύθυνση, μετά ένα διακριτικό πρόσβασης ή όνομα χρήστη και κωδικός, ή τίποτα για διακομιστή που αφήνει οποιονδήποτε να δημοσιεύει), και ανά κόμβο ένα θέμα, ένας τίτλος, μια προτεραιότητα (από ελάχιστη έως μέγιστη, ή `msg.priority`), ετικέτες και μια διεύθυνση κλικ. Ένα κενό θέμα ή τίτλος παίρνει το `msg.topic` ή το `msg.title`. Σε δημόσιο διακομιστή το θέμα είναι το μόνο μυστικό που υπάρχει, γι' αυτό μένει έξω από κάθε σφάλμα και κατάσταση.
- **Gotify.** Ένας κόμβος ρύθμισης διακομιστή με το διακριτικό της εφαρμογής, και ανά κόμβο ένας τίτλος και μια προτεραιότητα από 0 έως 10.
- **Webhook Discord.** Η διεύθυνση URL του webhook είναι ολόκληρο το διαπιστευτήριο, στον κόμβο, και δεν εμφανίζεται ποτέ σε κατάσταση, αρχείο καταγραφής ή σφάλμα, ούτε καν σε σφάλμα δικτύου που κατονομάζει τη διεύθυνση. Ένας τίτλος ή ένα χρώμα κάνει το μήνυμα embed. Το περιεχόμενο κόβεται στους 2,000 χαρακτήρες και η περιγραφή ενός embed στους 4,096, μετρημένοι όπως τους μετρά το Discord, και τίποτα σε ένα μήνυμα δεν μπορεί να κάνει ping σε κανέναν.
- **Bot Discord.** Ένας κόμβος ρύθμισης bot με το διακριτικό του, και ανά κόμβο ένα αναγνωριστικό καναλιού (ή `msg.channel`). Δημοσιεύει ως το bot και απαιτεί το bot να είναι στο κανάλι με άδεια αποστολής.
- **Kafka out.** Ένας κόμβος ρύθμισης συστάδας (brokers, SASL PLAIN ή SCRAM-SHA-256 ή SCRAM-SHA-512, TLS), και ανά κόμβο ένα θέμα και ένα προαιρετικό κλειδί. Η τιμή είναι το `msg.payload`, ως κείμενο, ή ως JSON όταν δεν είναι κείμενο, και το μήνυμα προωθείται όταν η συστάδα το έχει επιβεβαιώσει από κάθε συγχρονισμένο αντίγραφο. Χρησιμοποιεί το franz-go, τον πελάτη που χρησιμοποιεί η έξοδος Kafka του πυρήνα.

Ένας διακομιστής που αρνείται λέει γιατί στο σφάλμα του κόμβου, χωρίς τίποτα από όσα στάλθηκαν. Ένα όριο ρυθμού περιμένεται μία φορά, όσο λέει ο διακομιστής έως ένα λεπτό, και μετά το μήνυμα αποτυγχάνει. Δεν υπάρχει κόμβος Slack ή Teams και δεν υπάρχει κόμβος UADP: το HotLoop δέχεται UADP και το Flow διαβάζει αυτές τις τιμές μέσω των κόμβων του HotLoop.

Αποδείχθηκε με ένα πραγματικό ntfy, ένα πραγματικό Gotify και ένα πραγματικό Redpanda: ο κόμβος δημοσιεύει και ο διακομιστής ερωτάται τι περιέχει. Οι κόμβοι Discord ακολουθούν το τεκμηριωμένο API του Discord για webhooks και bots.

Το `scan` σαρώνει μια περιοχή CIDR και αναγνωρίζει σημεία Modbus και EtherNet/IP, και το `netinfo` αναφέρει τις διεπαφές που ο χρόνος εκτέλεσης μπορεί πραγματικά να δει, που σε λειτουργία macvlan είναι ο τρόπος με τον οποίο μια ροή ανακαλύπτει τη δική της διεύθυνση στο VLAN OT. Οι κόμβοι Modbus TCP, S7, EtherNet/IP, OPC UA και Sparkplug B μπορούν τώρα να μιλούν με ό,τι βρίσκει το `scan`, και είναι η επόμενη ενότητα.

Ένας περιγραφέας Go ανά τύπο κόμβου δηλώνει τις ιδιότητες, τις θύρες, τις προεπιλογές και το κείμενο βοήθειάς του, και ο επεξεργαστής αποδίδει το παράθυρο διαλόγου από αυτόν, ώστε ένας κόμβος να μη μπορεί να κυκλοφορήσει με παράθυρο που διαφωνεί με τον χρόνο εκτέλεσής του.
