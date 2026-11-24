---
title: "Τι πάει στη γραμμή"
description: "Το NetworkMessage και το DataSetMessage που στέλνει το HotLoop Transmitter, byte προς byte, με τις ενότητες των OPC 10000-14 και 10000-6 που ορίζουν το καθένα."
---

Κάθε byte παρακάτω προέρχεται από το OPC 10000-14 (Μέρος 14, PubSub) έκδοση 1.05 και το OPC 10000-6 (Μέρος 6, αντιστοιχίσεις), που διαβάστηκαν στο reference.opcfoundation.org στις 2026-10-31. Οι αριθμοί ενοτήτων είναι αυτοί που ανοίγετε όταν ένα byte φαίνεται λάθος. Τίποτα από αυτά δεν μαθεύτηκε κοιτάζοντας πακέτα άλλου κατασκευαστή.

Ένα block publisher στέλνει ένα NetworkMessage ανά διάστημα δημοσίευσης. Ένα NetworkMessage μεταφέρει ένα DataSetMessage, ένα Data Key Frame, οπότε κάθε μήνυμα περιέχει κάθε πεδίο. Από το 1.1.0 κάθε μήνυμα φέρει χρονοσφραγίδα από το ρολόι του PLC, και στο NetworkMessage και στο DataSetMessage, εκτός αν το `bTimestamp` είναι FALSE, οπότε τα bytes είναι ακριβώς του 1.0.0. Οι πίνακες δείχνουν και τα δύο: οι γραμμές που σημειώνονται ως με σφραγίδα υπάρχουν μόνο όταν η χρονοσφραγίδα είναι ενεργή.

Όλες οι τιμές πολλών bytes είναι little endian, όπως ορίζεται το δυαδικό του OPC UA· το block τις γράφει byte προς byte, οπότε η σειρά bytes του host δεν έχει σημασία.

## NetworkMessage (Μέρος 14, 7.2.4.4.2)

| Bytes | Τιμή | Σημασία |
|---|---|---|
| 1 | `F1` | UADPVersion 1 στα bits 0 έως 3. UADPFlags στα bits 4 έως 7: PublisherId (bit 4), GroupHeader (bit 5), PayloadHeader (bit 6) και ExtendedFlags1 (bit 7), όλα παρόντα |
| 1 | `21` με σφραγίδα, `01` χωρίς | ExtendedFlags1: τύπος PublisherId 001 = UInt16 στα bits 0 έως 2, Timestamp (bit 5) όταν υπάρχει σφραγίδα. Χωρίς DataSetClassId, χωρίς κεφαλίδα ασφαλείας, χωρίς PicoSeconds, χωρίς ExtendedFlags2 |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags: παρόντα τα WriterGroupId, GroupVersion, NetworkMessageNumber και SequenceNumber |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | πάντα 1, επειδή το 0 δεν είναι έγκυρο |
| 2 | SequenceNumber | μετρά τα μηνύματα που στάλθηκαν, κάνει wrap στο 65535 |
| 1 | Count | πάντα 1 (κεφαλίδα payload, 7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp, μόνο με σφραγίδα | το Timestamp του NetworkMessage (7.2.4.4.2), ένα DateTime (Μέρος 6, 5.2.2.5): ticks των 100 ns από 1601-01-01 00:00:00 UTC ως Int64. Έρχεται μετά την κεφαλίδα payload και πριν το DataSetMessage |

Επειδή το Count είναι 1, το payload δεν έχει πίνακα Sizes. Το block δεν στέλνει τμηματοποιημένα μηνύματα, μηνύματα discovery, προαγμένα πεδία ή κεφαλίδα ασφαλείας, και ένας δέκτης που απαιτεί κάποιο από αυτά δεν εξυπηρετείται από αυτήν την έκδοση.

## DataSetMessage (Μέρος 14, 7.2.4.5.4 και 7.2.4.5.5)

| Bytes | Τιμή | Σημασία |
|---|---|---|
| 1 | `69` Variant, `6B` RawData· με σφραγίδα `E9` και `EB` | DataSetFlags1: έγκυρο (bit 0), κωδικοποίηση πεδίων (bits 1 και 2: 00 Variant, 01 RawData), αριθμός ακολουθίας (bit 3), ConfigurationVersion major (bit 5) και minor (bit 6), και DataSetFlags2 (bit 7) όταν υπάρχει σφραγίδα. Η κατάσταση απουσιάζει. Χωρίς σφραγίδα απουσιάζει και το DataSetFlags2 και ο τύπος είναι ο προεπιλεγμένος, Data Key Frame |
| 1 | `10`, μόνο με σφραγίδα | DataSetFlags2: τύπος μηνύματος 0 (Data Key Frame) στα bits 0 έως 3, Timestamp (bit 4) |
| 2 | Αριθμός ακολουθίας DataSetMessage | μετρά τα μηνύματα που στάλθηκαν, κάνει wrap στο 65535 |
| 8 | Timestamp, μόνο με σφραγίδα | το Timestamp του DataSetMessage (7.2.4.5.4), το ίδιο DateTime με του NetworkMessage, μετά τον αριθμό ακολουθίας |
| 4 | ConfigurationVersion major | `udiConfigMajor` |
| 4 | ConfigurationVersion minor | `udiConfigMinor` |
| 2 | FieldCount | μόνο Variant. Παραλείπεται για RawData (7.2.4.5.5) |
| ... | τα πεδία | με τη σειρά που προστέθηκαν |

## Πολλά DataSetMessage σε ένα NetworkMessage

Μετά το `AddDataSet`, το Count του PayloadHeader είναι ο αριθμός των DataSet και απαριθμεί κάθε DataSetWriterId, και το payload ξεκινά με τον πίνακα Sizes, ένα μέγεθος UInt16 σε byte ανά DataSetMessage (7.2.4.5.3), και ακολουθούν τα DataSetMessage το ένα μετά το άλλο. Το DataSet 1 χρησιμοποιεί το δικό του writer id, αριθμό ακολουθίας και ConfigurationVersion του block· κάθε άλλο DataSet έχει το δικό του writer id, major version και αριθμό ακολουθίας DataSetMessage. Το Timestamp του NetworkMessage και κάθε DataSetMessage είναι η ίδια χρονική στιγμή. Χωρίς `AddDataSet` το μήνυμα είναι ακριβώς ό,τι ήταν, Count 1 και χωρίς Sizes.

## Delta πλαίσια και KeepAlive

Με το `bDeltaFrames`, ο τύπος του DataSetMessage στο DataSetFlags2 (bit 0 έως 3) είναι 0 για βασικό πλαίσιο, 1 για Data Delta Frame και 3 για KeepAlive, και το bit του Timestamp παραμένει όπως πριν. Ένα βασικό πλαίσιο φεύγει πρώτο και κάθε `uiKeyFrameEvery` μηνύματα. Ανάμεσά τους το block συγκρίνει τη μεταβλητή κάθε πεδίου (και την κατάστασή του) με αυτό που έφερε το τελευταίο μήνυμα: ένα delta πλαίσιο είναι το `FieldCount` των πεδίων που άλλαξαν (UInt16), και μετά για το καθένα ο `FieldIndex` με βάση το μηδέν (UInt16) και το Variant του· όταν δεν άλλαξε τίποτα, το μήνυμα είναι KeepAlive, η κεφαλίδα του DataSetMessage χωρίς payload. Ένα KeepAlive φέρει τον αριθμό ακολουθίας του επόμενου DataSetMessage και δεν τον καταναλώνει, ενώ ο αριθμός ακολουθίας του NetworkMessage το μετρά. Τα RawData DataSet στέλνουν πάντα βασικά πλαίσια.

## Η χρονοσφραγίδα

Το block διαβάζει το ρολόι πραγματικού χρόνου του PLC μία φορά ανά μήνυμα με το `SysTimeRtcHighResGet` (η βιβλιοθήκη συστήματος SysTimeRtc, που παρέχει το runtime), δηλαδή χιλιοστά του δευτερολέπτου από 1970-01-01 UTC, και γράφει `milliseconds * 10000 + 11644473600 * 10000000` ως DateTime. Και οι δύο χρονοσημάνσεις ενός μηνύματος είναι αυτή η μία τιμή. Αν το runtime δεν μπορεί να απαντήσει στην κλήση υψηλής ανάλυσης, ή το `bHighResTimestamp` είναι FALSE, διαβάζει το `SysTimeRtcGet` (ακέραια δευτερόλεπτα) και γράφει `(seconds + 11644473600) * 10000000`, όπως η 1.1.0. Από αυτό προκύπτουν δύο πράγματα:

* Η ανάλυση είναι ένα χιλιοστό του δευτερολέπτου (το `bStampHighRes` λέει ποιο ρολόι χρησιμοποίησε το τελευταίο μήνυμα). Με την επιστροφή σε ακέραια δευτερόλεπτα ο παραλήπτης βλέπει την ίδια χρονοσήμανση σε κάθε μήνυμα μέσα σε ένα δευτερόλεπτο.
* Η ώρα είναι τόσο σωστή όσο το ρολόι του PLC. Ένας ελεγκτής με μη ρυθμισμένο ρολόι σφραγίζει το μήνυμά του 1970. Όταν το ρολόι δεν μπορεί να διαβαστεί (το `diLastClockResult` δεν είναι 0), το μήνυμα φεύγει χωρίς σφραγίδα, κάτι που το Μέρος 14 επιτρέπει, αντί να μη φύγει καθόλου.

Αυξήστε το `udiConfigMajor` κάθε φορά που αλλάζει η λίστα πεδίων. Ένας δέκτης που κρατά διάταξη με κλειδί την έκδοση μπορεί τότε να αρνηθεί ένα μήνυμα φτιαγμένο για διαφορετική λίστα αντί να το αποκωδικοποιήσει λάθος.

## Πεδία, κωδικοποίηση Variant (Μέρος 6, 5.2.2.16)

Κάθε πεδίο είναι ένα byte EncodingMask και μετά η τιμή. Τα bits 0 έως 5 της μάσκας είναι το id του ενσωματωμένου τύπου (Μέρος 6, 5.1.2, πίνακας 1), και το bit 7 λέει ότι η τιμή είναι πίνακας, οπότε ένα πλήθος στοιχείων Int32 προηγείται των στοιχείων.

| Τύπος PLC | Id τύπου | Bytes τιμής |
|---|---|---|
| BOOL | 1 Boolean | 1, `00` ή `01` |
| SINT | 2 SByte | 1 |
| USINT, BYTE | 3 Byte | 1 |
| INT | 4 Int16 | 2 |
| UINT, WORD | 5 UInt16 | 2 |
| DINT | 6 Int32 | 4 |
| UDINT, DWORD | 7 UInt32 | 4 |
| LINT | 8 Int64 | 8 |
| ULINT, LWORD | 9 UInt64 | 8 |
| REAL | 10 Float | 4, IEEE 754 |
| LREAL | 11 Double | 8, IEEE 754 |
| STRING | 12 String | μήκος Int32 σε bytes, μετά UTF-8 (5.2.2.4) |
| ένα πεδίο με κατάσταση Bad ή Uncertain (`SetStatus`) | 19 StatusCode | 4, η κατάσταση UInt32, στη θέση της τιμής (μόνο Variant) |
| WSTRING | 12 String | Μήκος Int32 σε byte, μετά UTF-8 (5.2.2.4) |
| TIME | 7 UInt32 | χιλιοστά του δευτερολέπτου, έτσι αποθηκεύεται ένα TIME του CODESYS |

Ένα STRING του CODESYS κρατά ένα byte ανά χαρακτήρα. Τα bytes μέχρι `7F` είναι ASCII και φεύγουν αμετάβλητα. Τα bytes πάνω από `7F` διαβάζονται ως ISO 8859-1 και γράφονται στη μορφή UTF-8 δύο bytes. Αυτό είναι μια υπόθεση για την κωδικοσελίδα του PLC, και είναι το μοναδικό σημείο όπου το block ερμηνεύει κείμενο.

Ένα WSTRING του CODESYS είναι UTF-16 και δεν χρειάζεται καμία παραδοχή: κάθε μονάδα 16 bit γράφεται ως UTF-8 (ένα, δύο ή τρία byte), ένα σωστά σχηματισμένο ζεύγος αντικατάστασης γίνεται ο ένας χαρακτήρας των τεσσάρων byte και ένας μοναχικός αντικαταστάτης γίνεται U+FFFD, ώστε το κείμενο να είναι πάντα έγκυρο UTF-8. Στο RawData το MaxStringLength ενός `WSTRING(N)` είναι `3 * N` byte, το μέγιστο που μπορεί να καταλάβει.

## Πεδία, κωδικοποίηση RawData (Μέρος 14, 7.2.4.5.11)

Χωρίς μάσκα και χωρίς πλήθος: κάθε πεδίο είναι απλώς η τιμή του, με τη σειρά, οπότε ο δέκτης πρέπει να γνωρίζει τη διάταξη. Το Μέρος 14 λέει ότι τα πεδία "handled like a Structure DataType", άρα κάθε τιμή κωδικοποιείται όπως ένα πεδίο Structure στο Μέρος 6.

* **Οι scalars** είναι τα bytes της τιμής τους, όπως στον πίνακα Variant, χωρίς μάσκα.
* **Οι πίνακες** είναι ένα πλήθος στοιχείων Int32 και μετά τα στοιχεία (Μέρος 6, 5.2.5: "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value"). Το block στέλνει πάντα κάθε στοιχείο που του δόθηκε, οπότε το πλήθος ισούται με το δηλωμένο μέγεθος του πίνακα και δεν υπάρχει padding μετά.
* **Τα strings** είναι ένα μήκος Int32 σε bytes και τα bytes UTF-8, μετά μηδενικά bytes μέχρι το MaxStringLength, οπότε το πεδίο είναι πάντα 4 + MaxStringLength bytes (7.2.4.5.11: "the field shall be padded with bytes with value zero"). Το block χρησιμοποιεί το N του `STRING(N)` ως MaxStringLength, σε bytes. Μακρύτερο κείμενο κόβεται σε όριο χαρακτήρα, επειδή το πεδίο δεν μπορεί να μεγαλώσει. Τα μεταδεδομένα πεδίων του δέκτη πρέπει να φέρουν το ίδιο MaxStringLength και μια εγγραφή ArrayDimensions για κάθε πίνακα.

Αυτή είναι η ανάγνωση του ίδιου της στοίβας αναφοράς του OPC Foundation. Στο UA-.NETStandard (commit `fcfc84eab5c105780d7268474a47d344d100aca1`) το `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs`, γραμμές 389 έως 403, λέει ότι μια συμβολοσειρά "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding", και ότι για έναν πίνακα "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements". Το `TryReadPaddedArray` στις γραμμές 593 έως 648 το υλοποιεί, και το `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` το επιβεβαιώνει. Το `docs/PROOF.md` έχει τα υπόλοιπα.

## Μέγεθος

Το block χτίζει το μήνυμα σε buffer 1472 bytes: 1500 bytes Ethernet payload μείον 20 του IP και 8 του UDP, οπότε ένα μήνυμα δεν κατακερματίζεται ποτέ. Μια λίστα πεδίων που δεν χωράει βάζει το block σε `ConfigError` με σφάλμα `TooBig`· δεν κόβει. Ένας πίνακας REAL 250 στοιχείων σε κωδικοποίηση Variant είναι 1005 bytes, οπότε ένα μήνυμα με αυτόν τον πίνακα συν την κεφαλίδα χωράει, και δύο δεν χωράνε.
