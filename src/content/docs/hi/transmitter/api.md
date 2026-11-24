---
title: "HotLoop Transmitter API संदर्भ"
description: "HotLoop Transmitter पब्लिशर फ़ंक्शन ब्लॉक का हर इनपुट, आउटपुट और मेथड।"
---

सब कुछ `HLTX` नेमस्पेस में है। ब्लॉक `HLTX.FB_HLTX_Publisher` है।

## इनपुट

| इनपुट | प्रकार | डिफ़ॉल्ट | अर्थ |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE सॉकेट खोलता है और प्रकाशन शुरू करता है। FALSE उसे बंद करता है और ब्लॉक को `Disabled` में लौटा देता है, जिससे `ConfigError` भी साफ़ हो जाता है |
| `sDestination` | STRING(15) | `127.0.0.1` | बिंदुओं वाला IPv4 पता: एक unicast होस्ट, या 224.0.0.0 से 239.255.255.255 तक का multicast समूह |
| `uiPort` | UINT | 4840 | गंतव्य UDP पोर्ट। 4840 वह है जो OPC UA ने दर्ज कराया है |
| `sLocalAddress` | STRING(15) | खाली | केवल multicast: जिस इंटरफ़ेस से भेजना है उसका पता। खाली छोड़ने पर OS चुनता है |
| `usiMulticastTTL` | USINT | 1 | multicast time to live |
| `uiPublisherId` | UINT | 1 | PublisherId, UInt16 के रूप में भेजा जाता है |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | संदेशों के बीच का समय। न्यूनतम T#1MS। ब्लॉक केवल किसी चक्र में भेज सकता है, इसलिए असली दर वह अंतराल है जिसे इसे कॉल करने वाले टास्क के चक्रों की पूर्ण संख्या तक ऊपर पूरा किया गया हो |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` या `RawData`। इसे तब बदलें जब ब्लॉक अक्षम हो |
| `udiGroupVersion` | UDINT | 1 | समूह हेडर में GroupVersion |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | DataSet का ConfigurationVersion। जब भी फ़ील्ड सूची बदले, major बढ़ाएँ |
| `bTimestamp` | BOOL | TRUE | हर संदेश पर PLC घड़ी का टाइमस्टैम्प लगाता है, NetworkMessage और DataSetMessage दोनों में (मिलीसेकंड तक, देखें `WIRE-FORMAT.md`)। FALSE 1.0.0 के बाइट भेजता है, 17 बाइट छोटे |
| `bDeltaFrames` | BOOL | FALSE | केवल Variant एन्कोडिंग। की फ़्रेमों के बीच एक Data Delta Frame भेजता है (केवल बदले फ़ील्ड, हर एक अपने इंडेक्स के साथ), और कुछ न बदलने पर KeepAlive। FALSE हर बार पूरा की फ़्रेम भेजता है, जिसे हर सब्सक्राइबर पढ़ता है। जो सब्सक्राइबर डेल्टा फ़्रेम छोड़ देता है उसे बदलाव अगले की फ़्रेम पर दिखता है |
| `uiKeyFrameEvery` | UINT | 10 | `bDeltaFrames` के साथ: इतने संदेशों पर एक पूरा की फ़्रेम, ताकि देर से जुड़े सब्सक्राइबर को उसी अवधि में पूरी तस्वीर मिल जाए |
| `bHighResTimestamp` | BOOL | TRUE | रनटाइम के पास होने पर घड़ी के मिलीसेकंड समय से स्टैम्प लगाता है। FALSE पूरे सेकंड का स्टैम्प लगाता है, जैसा 1.1.0 करता था |
| `tRetry` | TIME | T#2S | लगातार दस बार भेजना विफल होने के बाद सॉकेट दोबारा खोलने से पहले कितना रुकना है |

## आउटपुट

| आउटपुट | प्रकार | अर्थ |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`, `Running`, `Backoff` (सॉकेट दोबारा खुलने का इंतज़ार) या `ConfigError` (देखें `eError`; कुछ नहीं भेजा जाता) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | जब तक संदेश जा रहे हैं TRUE |
| `udiSent` | UDINT | नेटवर्क को सौंपे गए संदेश |
| `udiSendErrors` | UDINT | वे भेजना जिन्हें OS ने अस्वीकार किया या बीच में काट दिया |
| `udiSkipped` | UDINT | टास्क के देर से चलने के कारण छूटे प्रकाशन स्लॉट |
| `uiMessageSize` | UINT | आख़िरी संदेश के बाइट |
| `diLastSocketResult` | UDINT | सॉकेट कॉल से आया आख़िरी रनटाइम त्रुटि कोड, 0 ठीक है |
| `diLastClockResult` | UDINT | टाइमस्टैम्प के लिए PLC घड़ी पढ़ने का आख़िरी नतीजा, 0 ठीक है। 0 न हो तो संदेश बिना मुहर के जाता है |
| `bDeltaActive` | BOOL | डेल्टा फ़्रेम उपयोग में होने पर TRUE: `bDeltaFrames` चालू है, DataSet Variant है और फ़ील्ड पिछले मानों की 4096 बाइट की प्रति में समा जाते हैं |
| `udiDeltaSent`, `udiKeepAliveSent` | UDINT | भेजे गए Data Delta Frame और KeepAlive संदेश |
| `bStampHighRes` | BOOL | TRUE जब अंतिम संदेश के टाइमस्टैम्प में घड़ी का मिलीसेकंड समय था, FALSE जब वह पूरे सेकंड पर लौट गया या बिना स्टैम्प के गया |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | ब्लॉक की आख़िरी कॉल में लगे माइक्रोसेकंड, और सक्षम करने या `Clear()` के बाद से सबसे लंबा |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | सक्षम करने या `Clear()` के बाद से, एक संदेश बनाने में और भेजने की कॉल में ही लगा सबसे लंबा समय |

## मेथड

फ़ील्ड एक बार, पहली कॉल से पहले, उसी क्रम में जोड़ें जिसमें रिसीवर को उन्हें पढ़ना है। हर मेथड फ़ील्ड स्वीकार होने पर TRUE लौटाता है। अधिकतम 128 फ़ील्ड।

| मेथड | जोड़ता है |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | एक स्केलर। `pValue` है `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | एक STRING। `uiMaxLen` `STRING(N)` का N है |
| `AddWString(pValue, uiMaxLen)` | एक WSTRING, UTF-8 के रूप में भेजा जाता है। `uiMaxLen`, `WSTRING(N)` का N है |
| `AddDataSet(uiWriterId, udiConfigMajor)` | उसी NetworkMessage में एक और DataSet शुरू करता है: इसके बाद जोड़े गए फ़ील्ड उसी के होते हैं। हर प्रकाशन अंतराल पर एक NetworkMessage प्रति DataSet एक DataSetMessage ले जाता है, इसलिए कई writer एक डेटाग्राम साझा करते हैं। अधिकतम 8 DataSet; एक से अधिक होने पर डेल्टा फ़्रेम बंद रहते हैं |
| `SetStatus(pStatus)` | अंतिम जोड़े गए फ़ील्ड को स्टेटस देता है। `pStatus` एक UDINT का `ADR` है जिसमें OPC UA StatusCode है। जब तक वह 0 नहीं है, फ़ील्ड मान की जगह वही StatusCode बनकर जाता है (Variant एन्कोडिंग), और रिसीवर उसे खराब गुणवत्ता के रूप में पढ़ता है। 0 मान भेजता है। RawData में स्टेटस नहीं होता, इसलिए RawData पब्लिशर मान भेजता रहता है |
| `AddArray(pFirst, eType, uiCount)` | STRING और WSTRING को छोड़कर किसी भी प्रकार के `uiCount` तत्वों का ऐरे। `pFirst` है `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | सामान्य रूप, जिसे बाक़ी कॉल करते हैं |
| `Clear()` | फ़ील्ड सूची और अधिकतम कॉल समय भुला देता है |

ब्लॉक आपके दिए पते रखता है, इसलिए वेरिएबल हटाने वाले ऑनलाइन बदलाव के बाद `Clear()` कॉल करें और फ़ील्ड फिर से जोड़ें। WORD, DWORD और LWORD उसी आकार के मेथड से UINT, UDINT और ULINT के रूप में जाते हैं।

## इसे कैसे कॉल करें

इंस्टेंस को एक टास्क से हर चक्र में एक बार कॉल करें। एक इंस्टेंस को दो टास्क से कॉल न करें। एक प्रोग्राम में कई पब्लिशर ठीक हैं और हर एक का अपना सॉकेट है; हर एक को अपना writer group id और dataset writer id दें।
