---
title: "Installare HotLoop Transmitter"
description: "Installi la libreria nel repository delle librerie CODESYS, la aggiunga a un progetto e scopra cosa fare quando il blocco segnala un errore."
---

Serve un sistema di sviluppo CODESYS 3.5 SP22 o successivo, e un runtime il cui target abbia i componenti SysSocket e SysTimeRtc, che i runtime CODESYS Control per Linux SL includono (il secondo è nuovo dalla 1.1.0, per il timestamp).

## Dal CODESYS Installer

Dalla 1.1.0 la release comprende anche `HotLoopTransmitter-1.2.0.package`, all'indirizzo https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.package. Si installa con il CODESYS Installer (nell'IDE: Tools, CODESYS Installer), oppure senza finestra con la sua riga di comando, `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`. L'Installer mette la libreria nel repository delle librerie di quel profilo, sotto l'azienda HotLoop, e si passa al punto 3 qui sotto. Il pacchetto è la stessa libreria del file `.library`, in uno ZIP che l'Installer legge, quindi le due strade danno la stessa libreria.

## Dal file della libreria

1. Scarichi `HotLoopTransmitter-1.2.0.library` da https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.library e lo verifichi con `SHA256SUMS` nella stessa cartella (`sha256sum -c SHA256SUMS`).
2. Nell'IDE CODESYS: Tools, Library Repository, Install, e scelga il file. Ora è nel repository sotto l'azienda HotLoop.
3. Nel progetto apra il Library Manager dell'applicazione, Add Library, e scelga HotLoop Transmitter. SysSocket, SysTimeRtc e le loro librerie di interfaccia arrivano con essa come dipendenze e non richiedono nulla da lei.
4. Dichiari un `HLTX.FB_HLTX_Publisher`, aggiunga i campi e lo chiami a ogni ciclo (il README ha l'esempio).
5. Scarichi sul controllore. La destinazione deve essere raggiungibile dalla rete del controllore; per il multicast gli switch della rete devono trasportare il gruppo.

Il file `.compiled-library` è la stessa libreria senza i sorgenti. Installi quello se non vuole che il Structured Text sia visibile nel Library Manager. Si trova nella stessa cartella, come `HotLoopTransmitter-1.2.0.compiled-library`.

Per controllare cosa arriva, va bene qualsiasi ascoltatore UDP sulla porta di destinazione. Un piccolo programma Go che ascolta su una porta o si unisce a un gruppo multicast e stampa ogni datagramma come una riga di JSON con il suo esadecimale funziona bene.

## HotLoop Alarms

Dalla 1.2.0 la versione include anche `HotLoopAlarms-1.0.0.0.library` e `HotLoopAlarms-1.0.0.0.compiled-library`, la libreria per gli allarmi propri di un PLC, nella stessa cartella. Installi l'una o l'altra come la libreria Transmitter e la aggiunga al Library Manager dell'applicazione. Il progetto richiede una Alarm Configuration, e HotLoop 4.23.6 e successivi legge il blocco.

## Se il blocco segnala un errore

| `eError` | Significato | Cosa fare |
|---|---|---|
| `NoFields` | non è stato aggiunto alcun campo | chiami un metodo `Add` prima di abilitare |
| `BadInterval` | `tPublishingInterval` è inferiore a 1 ms | lo imposti |
| `BadAddress` | `sDestination` non è un indirizzo IPv4 puntato | lo corregga |
| `SocketCreate`, `SocketOption` | il runtime ha rifiutato una chiamata di socket; `diLastSocketResult` ne ha il codice | il blocco riprova da solo dopo `tRetry` |
| `TooBig` | i campi non stanno in 1472 byte | ne pubblichi meno, o usi due publisher con writer id diversi |
| `BadField` | un indirizzo memorizzato è stato cancellato | `Clear()` e aggiunga di nuovo i campi |
