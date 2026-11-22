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
| `bTimestamp` | BOOL | TRUE | слага върху всяко съобщение марка от часовника на PLC, в NetworkMessage и в DataSetMessage (цели секунди, вижте [Какво върви по кабела](/bg/transmitter/wire-format/)). FALSE изпраща байтовете от 1.0.0, с 17 байта по-къси |
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
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | микросекунди, прекарани в последното извикване на блока, и най-дългото от разрешаването или от `Clear()` |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | най-дългото време за изграждане на едно съобщение и в самото извикване за изпращане, от разрешаването или от `Clear()` |

## Методи

Добавяйте полетата веднъж, преди първото извикване, в реда, в който приемникът трябва да ги чете. Всеки метод връща TRUE, когато полето е прието. До 128 полета.

| Метод | Добавя |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | един скалар. `pValue` е `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | един STRING. `uiMaxLen` е N в `STRING(N)` |
| `AddArray(pFirst, eType, uiCount)` | масив от `uiCount` елемента от всеки тип освен STRING. `pFirst` е `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | общата форма, която останалите викат |
| `Clear()` | забравя списъка с полета и максималното време за извикване |

Блокът пази адресите, които му давате, затова след онлайн промяна, която премества променливи, извикайте `Clear()` и добавете полетата отново. WORD, DWORD и LWORD влизат като UINT, UDINT и ULINT чрез метода със същия размер.

## Как се вика

Викайте инстанцията веднъж на цикъл от една задача. Не викайте една инстанция от две задачи. Няколко публикуващи блока в една програма са наред и всеки има собствен сокет; дайте на всеки собствени writer group id и dataset writer id.
