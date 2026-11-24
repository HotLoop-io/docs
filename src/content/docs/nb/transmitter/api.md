---
title: "API for HotLoop Transmitter"
description: "Hver inngang, utgang og metode på publisher-funksjonsblokken i HotLoop Transmitter."
---

Alt ligger i navnerommet `HLTX`. Blokken er `HLTX.FB_HLTX_Publisher`.

## Innganger

| Inngang | Type | Standard | Betydning |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE åpner socketen og begynner å publisere. FALSE lukker den og setter blokken tilbake til `Disabled`, som også fjerner en `ConfigError` |
| `sDestination` | STRING(15) | `127.0.0.1` | IPv4-adresse med punktum: en unicast-vert, eller en multicast-gruppe fra 224.0.0.0 til 239.255.255.255 |
| `uiPort` | UINT | 4840 | UDP-målport. 4840 er den OPC UA har registrert |
| `sLocalAddress` | STRING(15) | tom | bare multicast: adressen til grensesnittet det sendes fra. Tom lar operativsystemet velge |
| `usiMulticastTTL` | USINT | 1 | multicast time to live |
| `uiPublisherId` | UINT | 1 | PublisherId, sendt som UInt16 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | tid mellom meldinger. Minimum T#1MS. Blokken kan bare sende i en syklus, så den reelle raten er intervallet rundet opp til et helt antall sykluser av oppgaven som kaller den |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` eller `RawData`. Endre den mens blokken er deaktivert |
| `udiGroupVersion` | UDINT | 1 | GroupVersion i gruppehodet |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | ConfigurationVersion for DataSet. Øk major hver gang feltlisten endres |
| `bTimestamp` | BOOL | TRUE | stempler hver melding med PLS-klokken, i NetworkMessage og DataSetMessage (på millisekundet, se `WIRE-FORMAT.md`). FALSE sender byte-ene fra 1.0.0, 17 byte kortere |
| `bDeltaFrames` | BOOL | FALSE | Bare Variant-koding. Sender en Data Delta Frame (bare feltene som endret seg, hvert med sin indeks) mellom nøkkelrammer, og en KeepAlive når ingenting endret seg. FALSE sender en full nøkkelramme hver gang, som alle abonnenter leser. En abonnent som forkaster deltarammer viser en endring ved neste nøkkelramme |
| `uiKeyFrameEvery` | UINT | 10 | med `bDeltaFrames`: en full nøkkelramme for hver så mange meldinger, slik at en abonnent som kom til senere har hele bildet innen den tiden |
| `bHighResTimestamp` | BOOL | TRUE | stempler med klokkens millisekundtid når runtime har den. FALSE stempler hele sekunder, slik 1.1.0 gjorde |
| `tRetry` | TIME | T#2S | hvor lenge det ventes før socketen åpnes på nytt etter ti mislykkede sendinger på rad |

## Utganger

| Utgang | Type | Betydning |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`, `Running`, `Backoff` (venter på å åpne socketen på nytt) eller `ConfigError` (se `eError`; ingenting sendes) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | TRUE mens meldinger går ut |
| `udiSent` | UDINT | meldinger overlevert til nettverket |
| `udiSendErrors` | UDINT | sendinger operativsystemet avviste eller avbrøt |
| `udiSkipped` | UDINT | publiseringsspor som ble gått glipp av fordi oppgaven kom for sent |
| `uiMessageSize` | UINT | byte i den siste meldingen |
| `diLastSocketResult` | UDINT | den siste feilkoden fra kjøretiden for et socketkall, 0 er i orden |
| `diLastClockResult` | UDINT | det siste resultatet av å lese PLS-klokken for et tidsstempel, 0 er i orden. Når det ikke er 0, går meldingen ut uten stempel |
| `bDeltaActive` | BOOL | TRUE mens deltarammer er i bruk: `bDeltaFrames` er på, DataSet er Variant og feltene får plass i kopien på 4096 byte av forrige verdier |
| `udiDeltaSent`, `udiKeepAliveSent` | UDINT | sendte Data Delta Frames og KeepAlive-meldinger |
| `bStampHighRes` | BOOL | TRUE når tidsstempelet på siste melding hadde klokkens millisekundtid, FALSE når det falt tilbake til hele sekunder eller gikk uten stempel |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | mikrosekunder brukt i det siste kallet til blokken, og det lengste siden aktivering eller `Clear()` |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | den lengste tiden brukt på å bygge én melding, og i selve sendekallet, siden aktivering eller `Clear()` |

## Metoder

Legg til feltene én gang, før det første kallet, i den rekkefølgen en mottaker skal lese dem. Hver metode returnerer TRUE når feltet ble godtatt. Opptil 128 felt.

| Metode | Legger til |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | en skalar. `pValue` er `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | en STRING. `uiMaxLen` er N-en i `STRING(N)` |
| `AddWString(pValue, uiMaxLen)` | én WSTRING, sendt som UTF-8. `uiMaxLen` er N i `WSTRING(N)` |
| `AddDataSet(uiWriterId, udiConfigMajor)` | starter et nytt DataSet i samme NetworkMessage: feltene som legges til etterpå hører til det. Hvert publiseringsintervall bærer én NetworkMessage da én DataSetMessage per DataSet, slik at flere writere deler et datagram. Opptil 8 DataSet; deltarammer er av når det er mer enn ett |
| `SetStatus(pStatus)` | gir feltet som ble lagt til sist en status. `pStatus` er `ADR` av en UDINT med en OPC UA StatusCode. Så lenge den ikke er 0, går feltet ut som den StatusCode i stedet for verdien (Variant-koding), og en mottaker leser det som dårlig kvalitet. 0 sender verdien. RawData har ingen status, så en RawData-publisher sender fortsatt verdien |
| `AddArray(pFirst, eType, uiCount)` | en array med `uiCount` elementer av alle typer unntatt STRING og WSTRING. `pFirst` er `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | den generelle formen de andre kaller |
| `Clear()` | glemmer feltlisten og den lengste kalletiden |

Blokken beholder adressene du gir den, så etter en online-endring som flytter variabler må du kalle `Clear()` og legge til feltene på nytt. WORD, DWORD og LWORD går inn som UINT, UDINT og ULINT gjennom metoden av samme størrelse.

## Å kalle den

Kall instansen én gang per syklus fra én oppgave. Ikke kall én instans fra to oppgaver. Flere publishere i ett program er greit, og hver har sin egen socket; gi hver sin egen writer group id og dataset writer id.
