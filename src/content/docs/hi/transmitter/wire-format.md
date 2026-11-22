---
title: "तार पर क्या जाता है"
description: "HotLoop Transmitter जो NetworkMessage और DataSetMessage भेजता है, बाइट दर बाइट, उन OPC 10000-14 और 10000-6 अनुभागों के साथ जो हर एक को परिभाषित करते हैं।"
---

नीचे का हर बाइट OPC 10000-14 (भाग 14, PubSub) संस्करण 1.05 और OPC 10000-6 (भाग 6, मैपिंग) से है, जिन्हें reference.opcfoundation.org पर 2026-10-31 को पढ़ा गया। जब कोई बाइट गलत लगे तो वही अनुभाग संख्याएँ खोलनी हैं। यहाँ कुछ भी किसी और विक्रेता के पैकेट देखकर नहीं सीखा गया।

एक पब्लिशर ब्लॉक हर प्रकाशन अंतराल पर एक NetworkMessage भेजता है। एक NetworkMessage में एक DataSetMessage होता है, एक Data Key Frame, इसलिए हर संदेश में हर फ़ील्ड होता है। 1.1.0 से हर संदेश में PLC की घड़ी का टाइमस्टैम्प होता है, NetworkMessage और DataSetMessage दोनों में, जब तक `bTimestamp` FALSE न हो, जिस स्थिति में बाइट ठीक 1.0.0 वाले होते हैं। तालिकाएँ दोनों दिखाती हैं: "मुहर वाली" चिह्नित पंक्तियाँ तभी होती हैं जब टाइमस्टैम्प चालू हो।

सभी बहु-बाइट मान little endian हैं, जैसा OPC UA binary परिभाषित करता है; ब्लॉक उन्हें बाइट दर बाइट लिखता है, इसलिए होस्ट का बाइट क्रम मायने नहीं रखता।

## NetworkMessage (भाग 14, 7.2.4.4.2)

| बाइट | मान | अर्थ |
|---|---|---|
| 1 | `F1` | बिट 0 से 3 में UADPVersion 1। बिट 4 से 7 में UADPFlags: PublisherId (बिट 4), GroupHeader (बिट 5), PayloadHeader (बिट 6) और ExtendedFlags1 (बिट 7), सब मौजूद |
| 1 | मुहर वाला `21`, बिना मुहर `01` | ExtendedFlags1: बिट 0 से 2 में PublisherId प्रकार 001 = UInt16, मुहर होने पर Timestamp (बिट 5)। कोई DataSetClassId नहीं, कोई सुरक्षा हेडर नहीं, कोई PicoSeconds नहीं, कोई ExtendedFlags2 नहीं |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags: WriterGroupId, GroupVersion, NetworkMessageNumber और SequenceNumber मौजूद |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | हमेशा 1, क्योंकि 0 अमान्य है |
| 2 | SequenceNumber | भेजे गए संदेश गिनता है, 65535 के बाद लौट जाता है |
| 1 | Count | हमेशा 1 (पेलोड हेडर, 7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp, केवल मुहर वाला | NetworkMessage का Timestamp (7.2.4.4.2), एक DateTime (भाग 6, 5.2.2.5): 1601-01-01 00:00:00 UTC से 100 ns टिक Int64 के रूप में। यह पेलोड हेडर के बाद और DataSetMessage से पहले आता है |

क्योंकि Count 1 है, पेलोड में Sizes ऐरे नहीं होता। ब्लॉक टुकड़ों में बँटे संदेश, डिस्कवरी संदेश, पदोन्नत फ़ील्ड या सुरक्षा हेडर नहीं भेजता, और जो रिसीवर इनमें से किसी की माँग करे उसे यह संस्करण सेवा नहीं देता।

## DataSetMessage (भाग 14, 7.2.4.5.4 और 7.2.4.5.5)

| बाइट | मान | अर्थ |
|---|---|---|
| 1 | `69` Variant, `6B` RawData; मुहर वाले `E9` और `EB` | DataSetFlags1: वैध (बिट 0), फ़ील्ड एन्कोडिंग (बिट 1 और 2: 00 Variant, 01 RawData), अनुक्रम संख्या (बिट 3), ConfigurationVersion major (बिट 5) और minor (बिट 6), और मुहर होने पर DataSetFlags2 (बिट 7)। Status अनुपस्थित है। बिना मुहर के DataSetFlags2 भी अनुपस्थित है और प्रकार डिफ़ॉल्ट है, यानी Data Key Frame |
| 1 | `10`, केवल मुहर वाला | DataSetFlags2: बिट 0 से 3 में संदेश प्रकार 0 (Data Key Frame), बिट 4 में Timestamp |
| 2 | DataSetMessage अनुक्रम संख्या | भेजे गए संदेश गिनता है, 65535 के बाद लौट जाता है |
| 8 | Timestamp, केवल मुहर वाला | DataSetMessage का Timestamp (7.2.4.5.4), NetworkMessage वाला ही DateTime, अनुक्रम संख्या के बाद |
| 4 | ConfigurationVersion major | `udiConfigMajor` |
| 4 | ConfigurationVersion minor | `udiConfigMinor` |
| 2 | FieldCount | केवल Variant। RawData के लिए छोड़ा जाता है (7.2.4.5.5) |
| ... | फ़ील्ड | जिस क्रम में जोड़े गए |

## टाइमस्टैम्प

ब्लॉक हर संदेश पर `SysTimeRtcGet` (SysTimeRtc सिस्टम लाइब्रेरी, जो रनटाइम देता है) से PLC की रियल-टाइम घड़ी एक बार पढ़ता है, जो 1970-01-01 UTC से पूरे सेकंड देती है, और `(seconds + 11644473600) * 10000000` को DateTime के रूप में लिखता है। संदेश के दोनों टाइमस्टैम्प यही एक मान हैं। इससे दो बातें निकलती हैं:

* रिज़ॉल्यूशन एक सेकंड है। रिसीवर को एक सेकंड के भीतर हर संदेश पर वही टाइमस्टैम्प दिखता है, और वह संदेश बनने के क्षण से एक सेकंड तक पीछे हो सकता है। एक सेकंड से छोटे स्टैम्प रोडमैप पर हैं।
* समय उतना ही सही है जितनी PLC की घड़ी। जिस कंट्रोलर की घड़ी सेट नहीं है वह अपने संदेश पर 1970 की मुहर लगाता है। जब घड़ी पढ़ी नहीं जा सकती (`diLastClockResult` 0 नहीं है) तो संदेश बिल्कुल न जाने के बजाय बिना मुहर के जाता है, जिसे भाग 14 अनुमति देता है।

जब भी फ़ील्ड सूची बदले, `udiConfigMajor` बढ़ाएँ। तब जो रिसीवर संस्करण के आधार पर लेआउट रखता है, वह किसी दूसरी सूची के लिए बने संदेश को गलत डिकोड करने के बजाय अस्वीकार कर सकता है।

## फ़ील्ड, Variant एन्कोडिंग (भाग 6, 5.2.2.16)

हर फ़ील्ड एक EncodingMask बाइट है, फिर मान। मास्क के बिट 0 से 5 अंतर्निहित प्रकार का id हैं (भाग 6, 5.1.2, तालिका 1), और बिट 7 बताता है कि मान ऐरे है, जिस स्थिति में तत्वों से पहले एक Int32 तत्व-संख्या आती है।

| PLC प्रकार | प्रकार id | मान के बाइट |
|---|---|---|
| BOOL | 1 Boolean | 1, `00` या `01` |
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
| STRING | 12 String | बाइट में Int32 लंबाई, फिर UTF-8 (5.2.2.4) |
| TIME | 7 UInt32 | मिलीसेकंड, CODESYS का TIME इसी तरह रखा जाता है |

CODESYS का STRING हर अक्षर के लिए एक बाइट रखता है। `7F` तक के बाइट ASCII हैं और बिना बदले जाते हैं। `7F` से ऊपर के बाइट ISO 8859-1 के रूप में पढ़े जाते हैं और उनके दो बाइट वाले UTF-8 रूप में लिखे जाते हैं। यह PLC के कोड पेज के बारे में एक मान्यता है, और यही एकमात्र जगह है जहाँ ब्लॉक पाठ की व्याख्या करता है।

## फ़ील्ड, RawData एन्कोडिंग (भाग 14, 7.2.4.5.11)

कोई मास्क नहीं और कोई गिनती नहीं: हर फ़ील्ड क्रम से बस उसका मान है, इसलिए रिसीवर को लेआउट पता होना चाहिए। भाग 14 कहता है कि फ़ील्ड "handled like a Structure DataType" हैं, इसलिए हर मान वैसे ही एन्कोड होता है जैसे भाग 6 में Structure का फ़ील्ड।

* **स्केलर** उनके मान के बाइट हैं, जैसे Variant तालिका में, बिना मास्क के।
* **ऐरे** एक Int32 तत्व-संख्या और फिर तत्व हैं (भाग 6, 5.2.5: "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value")। ब्लॉक हमेशा हर वह तत्व भेजता है जो उसे दिया गया, इसलिए संख्या ऐरे के घोषित आकार के बराबर है और उसके बाद कोई पैडिंग नहीं है।
* **स्ट्रिंग** बाइट में Int32 लंबाई और UTF-8 बाइट हैं, फिर MaxStringLength तक शून्य बाइट, इसलिए फ़ील्ड हमेशा 4 + MaxStringLength बाइट का है (7.2.4.5.11: "the field shall be padded with bytes with value zero")। ब्लॉक `STRING(N)` के N को बाइट में MaxStringLength के रूप में लेता है। इससे लंबा पाठ अक्षर की सीमा पर काट दिया जाता है, क्योंकि फ़ील्ड बढ़ नहीं सकता। रिसीवर के फ़ील्ड मेटाडेटा में वही MaxStringLength और हर ऐरे के लिए एक ArrayDimensions प्रविष्टि होनी चाहिए।

यह OPC Foundation के अपने संदर्भ स्टैक की व्याख्या है। UA-.NETStandard (commit `fcfc84eab5c105780d7268474a47d344d100aca1`) में `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs` की पंक्तियाँ 389 से 403 कहती हैं कि स्ट्रिंग "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding" है, और ऐरे के लिए "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements"। पंक्तियाँ 593 से 648 में `TryReadPaddedArray` इसे लागू करता है, और `tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` इसे सिद्ध करता है। बाक़ी [प्रमाण पेज](/hi/transmitter/proof/) पर है।

## आकार

ब्लॉक संदेश को 1472 बाइट के बफ़र में बनाता है: 1500 बाइट का Ethernet पेलोड घटाकर IP के 20 और UDP के 8, इसलिए कोई संदेश कभी फ़्रैगमेंट नहीं होता। जो फ़ील्ड सूची नहीं समाती वह ब्लॉक को त्रुटि `TooBig` के साथ `ConfigError` में डाल देती है; वह काटता नहीं। Variant एन्कोडिंग में 250 तत्वों का REAL ऐरे 1005 बाइट का है, इसलिए उस ऐरे और हेडर वाला एक संदेश समा जाता है, और दो नहीं समाते।
