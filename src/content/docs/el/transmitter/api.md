---
title: "API του HotLoop Transmitter"
description: "Κάθε είσοδος, έξοδος και μέθοδος του function block publisher του HotLoop Transmitter."
---

Όλα βρίσκονται στο namespace `HLTX`. Το block είναι το `HLTX.FB_HLTX_Publisher`.

## Είσοδοι

| Είσοδος | Τύπος | Προεπιλογή | Σημασία |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE ανοίγει το socket και ξεκινά τη δημοσίευση. FALSE το κλείνει και επιστρέφει το block σε `Disabled`, που καθαρίζει και ένα `ConfigError` |
| `sDestination` | STRING(15) | `127.0.0.1` | διεύθυνση IPv4 με τελείες: ένας host unicast, ή μια ομάδα multicast από 224.0.0.0 έως 239.255.255.255 |
| `uiPort` | UINT | 4840 | θύρα UDP προορισμού. Η 4840 είναι αυτή που καταχωρεί το OPC UA |
| `sLocalAddress` | STRING(15) | κενό | μόνο multicast: η διεύθυνση της διεπαφής από την οποία θα γίνεται η αποστολή. Κενό αφήνει το λειτουργικό σύστημα να επιλέξει |
| `usiMulticastTTL` | USINT | 1 | multicast time to live |
| `uiPublisherId` | UINT | 1 | PublisherId, στέλνεται ως UInt16 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | χρόνος μεταξύ μηνυμάτων. Ελάχιστο T#1MS. Το block μπορεί να στείλει μόνο σε έναν κύκλο, οπότε ο πραγματικός ρυθμός είναι το διάστημα στρογγυλεμένο προς τα πάνω σε ακέραιο αριθμό κύκλων του task που το καλεί |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` ή `RawData`. Αλλάξτε το όσο το block είναι απενεργοποιημένο |
| `udiGroupVersion` | UDINT | 1 | GroupVersion στην κεφαλίδα ομάδας |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | ConfigurationVersion του DataSet. Αυξήστε το major κάθε φορά που αλλάζει η λίστα πεδίων |
| `bTimestamp` | BOOL | TRUE | σφραγίζει κάθε μήνυμα με το ρολόι του PLC, στο NetworkMessage και στο DataSetMessage (ολόκληρα δευτερόλεπτα, δείτε [Τι πάει στη γραμμή](/el/transmitter/wire-format/)). FALSE στέλνει τα bytes του 1.0.0, 17 bytes συντομότερα |
| `tRetry` | TIME | T#2S | πόσο θα περιμένει πριν ξανανοίξει το socket μετά από δέκα συνεχόμενες αποτυχημένες αποστολές |

## Έξοδοι

| Έξοδος | Τύπος | Σημασία |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`, `Running`, `Backoff` (αναμονή για το επανάνοιγμα του socket) ή `ConfigError` (δείτε `eError`· δεν στέλνεται τίποτα) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | TRUE όσο φεύγουν μηνύματα |
| `udiSent` | UDINT | μηνύματα που παραδόθηκαν στο δίκτυο |
| `udiSendErrors` | UDINT | αποστολές που το λειτουργικό σύστημα απέρριψε ή έκοψε |
| `udiSkipped` | UDINT | θέσεις δημοσίευσης που χάθηκαν επειδή το task άργησε |
| `uiMessageSize` | UINT | bytes του τελευταίου μηνύματος |
| `diLastSocketResult` | UDINT | ο τελευταίος κωδικός σφάλματος του runtime από κλήση socket, το 0 είναι εντάξει |
| `diLastClockResult` | UDINT | το τελευταίο αποτέλεσμα ανάγνωσης του ρολογιού του PLC για χρονοσφραγίδα, το 0 είναι εντάξει. Όταν δεν είναι 0 το μήνυμα φεύγει χωρίς σφραγίδα |
| `diLastClockResult` | UDINT | το τελευταίο αποτέλεσμα ανάγνωσης του ρολογιού του PLC για χρονοσφραγίδα, το 0 είναι εντάξει. Όταν δεν είναι 0 το μήνυμα φεύγει χωρίς σφραγίδα |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | μικροδευτερόλεπτα που δαπανήθηκαν στην τελευταία κλήση του block, και το μεγαλύτερο από την ενεργοποίηση ή το `Clear()` |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | ο μεγαλύτερος χρόνος για την κατασκευή ενός μηνύματος και μέσα στην ίδια την κλήση αποστολής, από την ενεργοποίηση ή το `Clear()` |

## Μέθοδοι

Προσθέστε τα πεδία μία φορά, πριν από την πρώτη κλήση, με τη σειρά που πρέπει να τα διαβάσει ένας δέκτης. Κάθε μέθοδος επιστρέφει TRUE όταν το πεδίο έγινε δεκτό. Έως 128 πεδία.

| Μέθοδος | Προσθέτει |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | έναν scalar. Το `pValue` είναι `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | ένα STRING. Το `uiMaxLen` είναι το N του `STRING(N)` |
| `AddArray(pFirst, eType, uiCount)` | έναν πίνακα `uiCount` στοιχείων οποιουδήποτε τύπου εκτός από STRING. Το `pFirst` είναι `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | τη γενική μορφή που καλούν οι άλλες |
| `Clear()` | ξεχνά τη λίστα πεδίων και τον μέγιστο χρόνο κλήσης |

Το block κρατά τις διευθύνσεις που του δίνετε, οπότε μετά από online αλλαγή που μετακινεί μεταβλητές, καλέστε `Clear()` και προσθέστε ξανά τα πεδία. Τα WORD, DWORD και LWORD μπαίνουν ως UINT, UDINT και ULINT μέσω της μεθόδου ίδιου μεγέθους.

## Πώς καλείται

Καλέστε την παρουσία μία φορά ανά κύκλο από ένα task. Μην καλείτε μία παρουσία από δύο tasks. Αρκετοί publishers σε ένα πρόγραμμα είναι εντάξει και ο καθένας έχει το δικό του socket· δώστε στον καθένα δικό του writer group id και dataset writer id.
