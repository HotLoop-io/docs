---
title: "API на HotLoop Transmitter"
description: "Всеки вход, изход и метод на функционалния блок публикуващ блок на HotLoop Transmitter."
---

Всичко е в пространството от имена `HLTX`. Блокът е `HLTX.FB_HLTX_Publisher`.

## Входове

| Вход | Тип | По подразбиране | Значение |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE отваря сокета и започва публикуване. FALSE го затваря и връща блока в `Disabled`, което изчиства и `ConfigError` |
| `sDestination` | STRING(15) | `127.0.0.1` | IPv4 адрес с точки: unicast хост или multicast група от 224.0.0.0 до 239.255.255.255 |
| `uiPort` | UINT | 4840 | UDP порт на местоназначението. 4840 е регистрираният от OPC UA |
| `sLocalAddress` | STRING(15) | празно | само за multicast: адресът на интерфейса, от който се изпраща. Празно оставя избора на операционната система |
| `usiMulticastTTL` | USINT | 1 | multicast time to live |
| `uiPublisherId` | UINT | 1 | PublisherId, изпращан като UInt16 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | време между съобщенията. Минимум T#1MS. Блокът може да изпраща само на цикъл, така че реалната честота е интервалът, закръглен нагоре до цяло число цикли на задачата, която го вика |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` или `RawData`. Сменете го, докато блокът е изключен |
| `udiGroupVersion` | UDINT | 1 | GroupVersion в заглавката на групата |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | ConfigurationVersion на DataSet. Увеличавайте major винаги когато списъкът с полета се променя |
| `bTimestamp` | BOOL | TRUE | поставя печат с часовника на PLC върху всяко съобщение, в NetworkMessage и в DataSetMessage (до милисекунда, вж. `WIRE-FORMAT.md`). FALSE изпраща байтовете от 1.0.0, с 17 байта по-къси |
| `bDeltaFrames` | BOOL | FALSE | Само кодиране Variant. Изпраща Data Delta Frame (само променените полета, всяко с индекса си) между ключовите кадри и KeepAlive, когато нищо не се е променило. FALSE изпраща пълен ключов кадър всеки път, който чете всеки абонат. Абонат, който отхвърля делта кадрите, показва промяната при следващия ключов кадър |
| `uiKeyFrameEvery` | UINT | 10 | с `bDeltaFrames`: пълен ключов кадър на всеки толкова съобщения, така че абонат, който се е включил по-късно, да има пълната картина в този интервал |
| `bHighResTimestamp` | BOOL | TRUE | поставя печат с времето в милисекунди на часовника, когато средата за изпълнение го има. FALSE поставя цели секунди, както правеше 1.1.0 |
| `tRetry` | TIME | T#2S | колко да се изчака, преди сокетът да се отвори отново след десет поредни неуспешни изпращания |

## Изходи

| Изход | Тип | Значение |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`, `Running`, `Backoff` (изчаква повторно отваряне на сокета) или `ConfigError` (вижте `eError`; нищо не се изпраща) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | TRUE, докато излизат съобщения |
| `udiSent` | UDINT | съобщения, предадени на мрежата |
| `udiSendErrors` | UDINT | изпращания, които операционната система е отказала или съкратила |
| `udiSkipped` | UDINT | пропуснати слотове за публикуване, защото задачата е закъсняла |
| `uiMessageSize` | UINT | байтове в последното съобщение |
| `diLastSocketResult` | UDINT | последният код за грешка от runtime при извикване на сокет, 0 е наред |
| `diLastClockResult` | UDINT | последният резултат от четенето на часовника на PLC за времева марка, 0 е наред. Когато не е 0, съобщението излиза без марка |
| `bDeltaActive` | BOOL | TRUE докато се използват делта кадри: `bDeltaFrames` е включен, DataSet е Variant и полетата се побират в 4096-байтовото копие на предишните стойности |
| `udiDeltaSent`, `udiKeepAliveSent` | UDINT | изпратени Data Delta Frames и KeepAlive съобщения |
| `bStampHighRes` | BOOL | TRUE, когато печатът на последното съобщение е носел времето в милисекунди на часовника, FALSE, когато е паднал до цели секунди или е излязъл без печат |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | микросекунди, прекарани в последното извикване на блока, и най-дългото от разрешаването или от `Clear()` |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | най-дългото време за изграждане на едно съобщение и в самото извикване за изпращане, от разрешаването или от `Clear()` |

## Методи

Добавяйте полетата веднъж, преди първото извикване, в реда, в който приемникът трябва да ги чете. Всеки метод връща TRUE, когато полето е прието. До 128 полета.

| Метод | Добавя |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | един скалар. `pValue` е `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | един STRING. `uiMaxLen` е N в `STRING(N)` |
| `AddWString(pValue, uiMaxLen)` | един WSTRING, изпратен като UTF-8. `uiMaxLen` е N в `WSTRING(N)` |
| `AddDataSet(uiWriterId, udiConfigMajor)` | започва друг DataSet в същия NetworkMessage: полетата, добавени след това, принадлежат на него. Във всеки интервал на публикуване един NetworkMessage носи по един DataSetMessage на DataSet, така че няколко writer-а споделят една дейтаграма. До 8 DataSet-а; делта кадрите са изключени, когато има повече от един |
| `SetStatus(pStatus)` | дава статус на последно добавеното поле. `pStatus` е `ADR` на UDINT, който държи OPC UA StatusCode. Докато не е 0, полето излиза като този StatusCode вместо със стойността си (кодиране Variant), а получателят го чете като лошо качество. 0 изпраща стойността. RawData няма статус, така че RawData публикуващият продължава да изпраща стойността |
| `AddArray(pFirst, eType, uiCount)` | масив от `uiCount` елемента от всеки тип освен STRING и WSTRING. `pFirst` е `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | общата форма, която останалите викат |
| `Clear()` | забравя списъка с полета и максималното време за извикване |

Блокът пази адресите, които му давате, затова след онлайн промяна, която премества променливи, извикайте `Clear()` и добавете полетата отново. WORD, DWORD и LWORD влизат като UINT, UDINT и ULINT чрез метода със същия размер.

## Как се вика

Викайте инстанцията веднъж на цикъл от една задача. Не викайте една инстанция от две задачи. Няколко публикуващи блока в една програма са наред и всеки има собствен сокет; дайте на всеки собствени writer group id и dataset writer id.
