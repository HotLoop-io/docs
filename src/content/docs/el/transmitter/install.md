---
title: "Εγκατάσταση του HotLoop Transmitter"
description: "Εγκαταστήστε τη βιβλιοθήκη στο αποθετήριο βιβλιοθηκών του CODESYS, προσθέστε την σε ένα έργο και δείτε τι να κάνετε όταν το block αναφέρει σφάλμα."
---

Χρειάζεστε σύστημα ανάπτυξης CODESYS 3.5 SP22 ή νεότερο, και ένα runtime του οποίου ο στόχος έχει τα components SysSocket και SysTimeRtc, που τα έχουν τα runtimes CODESYS Control για Linux SL (το δεύτερο είναι νέο στο 1.1.0, για τη χρονοσφραγίδα).

## Από το CODESYS Installer

Από το 1.1.0 η έκδοση έχει και το `HotLoopTransmitter-1.1.0.package`, στη διεύθυνση https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.package. Εγκαταστήστε το με το CODESYS Installer (στο IDE: Tools, CODESYS Installer), ή χωρίς παράθυρο με τη γραμμή εντολών του, `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`. Ο Installer βάζει τη βιβλιοθήκη στο αποθετήριο βιβλιοθηκών αυτού του προφίλ, κάτω από την εταιρεία HotLoop, και συνεχίζετε στο βήμα 3 παρακάτω. Το πακέτο είναι η ίδια βιβλιοθήκη με το αρχείο `.library`, σε ένα ZIP που διαβάζει ο Installer, οπότε οι δύο διαδρομές δίνουν την ίδια βιβλιοθήκη.

## Από το αρχείο της βιβλιοθήκης

1. Κατεβάστε το `HotLoopTransmitter-1.1.0.library` από https://hotloop.io/hotloop-transmitter/1.1.0/HotLoopTransmitter-1.1.0.library και ελέγξτε το με το `SHA256SUMS` στον ίδιο φάκελο (`sha256sum -c SHA256SUMS`).
2. Στο IDE του CODESYS: Tools, Library Repository, Install, επιλέξτε το αρχείο. Είναι πλέον στο αποθετήριο κάτω από την εταιρεία HotLoop.
3. Στο έργο σας ανοίξτε το Library Manager της εφαρμογής, Add Library, και επιλέξτε HotLoop Transmitter. Τα SysSocket, SysTimeRtc και οι βιβλιοθήκες διεπαφής τους έρχονται μαζί ως εξαρτήσεις και δεν χρειάζονται τίποτα από εσάς.
4. Δηλώστε ένα `HLTX.FB_HLTX_Publisher`, προσθέστε τα πεδία σας και καλέστε το σε κάθε κύκλο (το README έχει το παράδειγμα).
5. Κατεβάστε στον ελεγκτή. Ο προορισμός πρέπει να είναι προσβάσιμος από το δίκτυο του ελεγκτή· για multicast οι switches του δικτύου πρέπει να μεταφέρουν την ομάδα.

Το αρχείο `.compiled-library` είναι η ίδια βιβλιοθήκη χωρίς τον πηγαίο κώδικα. Εγκαταστήστε αυτό αν δεν θέλετε να φαίνεται το Structured Text στο Library Manager. Βρίσκεται στον ίδιο φάκελο, ως `HotLoopTransmitter-1.1.0.compiled-library`.

Για να ελέγξετε τι φτάνει, κάθε UDP listener στη θύρα προορισμού κάνει τη δουλειά. Ένα μικρό πρόγραμμα Go που ακούει σε μια θύρα ή μπαίνει σε ομάδα multicast και τυπώνει κάθε datagram ως γραμμή JSON με το δεκαεξαδικό του δουλεύει καλά.

## Αν το block αναφέρει σφάλμα

| `eError` | Σημασία | Τι να κάνετε |
|---|---|---|
| `NoFields` | δεν προστέθηκε κανένα πεδίο | καλέστε μια μέθοδο `Add` πριν την ενεργοποίηση |
| `BadInterval` | το `tPublishingInterval` είναι κάτω από 1 ms | ορίστε το |
| `BadAddress` | το `sDestination` δεν είναι διεύθυνση IPv4 με τελείες | διορθώστε το |
| `SocketCreate`, `SocketOption` | το runtime απέρριψε κλήση socket· το `diLastSocketResult` έχει τον κωδικό της | το block ξαναδοκιμάζει μόνο του μετά το `tRetry` |
| `TooBig` | τα πεδία δεν χωρούν σε 1472 bytes | δημοσιεύστε λιγότερα, ή χρησιμοποιήστε δύο publishers με διαφορετικά writer id |
| `BadField` | μια αποθηκευμένη διεύθυνση καθαρίστηκε | `Clear()` και προσθέστε ξανά τα πεδία |
