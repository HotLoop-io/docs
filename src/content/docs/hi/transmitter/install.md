---
title: "HotLoop Transmitter इंस्टॉल करें"
description: "लाइब्रेरी को CODESYS लाइब्रेरी रिपॉज़िटरी में इंस्टॉल करें, प्रोजेक्ट में जोड़ें, और ब्लॉक त्रुटि बताए तो क्या करें, यह जानें।"
---

आपको CODESYS डेवलपमेंट सिस्टम 3.5 SP22 या नया चाहिए, और ऐसा रनटाइम जिसके टारगेट में SysSocket और SysTimeRtc कंपोनेंट हों। Linux SL के CODESYS Control रनटाइम में दोनों होते हैं (दूसरा टाइमस्टैम्प के लिए 1.1.0 में नया है)।

## CODESYS Installer से

1.1.0 से रिलीज़ में `HotLoopTransmitter-1.3.0.package` भी है, https://hotloop.io/hotloop-transmitter/1.3.0/HotLoopTransmitter-1.3.0.package. पर। इसे CODESYS Installer से इंस्टॉल करें (IDE में: Tools, CODESYS Installer), या बिना विंडो के उसकी कमांड लाइन से, `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`। Installer लाइब्रेरी को उस प्रोफ़ाइल की लाइब्रेरी रिपॉज़िटरी में HotLoop कंपनी के तहत रख देता है, और आप नीचे चरण 3 पर जाते हैं। पैकेज वही लाइब्रेरी है जो `.library` फ़ाइल है, एक ZIP में जिसे Installer पढ़ता है, इसलिए दोनों रास्तों से एक ही लाइब्रेरी मिलती है।

## लाइब्रेरी फ़ाइल से

1. https://hotloop.io/hotloop-transmitter/1.3.0/HotLoopTransmitter-1.3.0.library से `HotLoopTransmitter-1.3.0.library` डाउनलोड करें, और उसी फ़ोल्डर की `SHA256SUMS` से जाँचें (`sha256sum -c SHA256SUMS`)।
2. CODESYS IDE में: Tools, Library Repository, Install, फ़ाइल चुनें। अब यह रिपॉज़िटरी में HotLoop कंपनी के तहत है।
3. अपने प्रोजेक्ट में एप्लिकेशन का Library Manager खोलें, Add Library, और HotLoop Transmitter चुनें। SysSocket, SysTimeRtc और उनकी इंटरफ़ेस लाइब्रेरी निर्भरता के रूप में साथ आती हैं और आपसे कुछ नहीं माँगतीं।
4. एक `HLTX.FB_HLTX_Publisher` घोषित करें, अपने फ़ील्ड जोड़ें, और हर चक्र में उसे कॉल करें (उदाहरण README में है)।
5. कंट्रोलर पर डाउनलोड करें। गंतव्य कंट्रोलर के नेटवर्क से पहुँच में होना चाहिए; multicast के लिए नेटवर्क के स्विच को वह समूह आगे ले जाना होगा।

`.compiled-library` फ़ाइल वही लाइब्रेरी है, बिना स्रोत के। अगर आप नहीं चाहते कि Structured Text Library Manager में दिखे, तो यह वाली इंस्टॉल करें। यह उसी फ़ोल्डर में `HotLoopTransmitter-1.3.0.compiled-library` नाम से है।

क्या पहुँच रहा है यह जाँचने के लिए गंतव्य पोर्ट पर कोई भी UDP लिसनर चलेगा। एक छोटा Go प्रोग्राम जो किसी पोर्ट पर सुनता है या multicast समूह से जुड़ता है और हर डेटाग्राम को उसके हेक्स के साथ JSON की एक पंक्ति के रूप में छापता है, अच्छा काम करता है।

## HotLoop Alarms

1.2.0 से रिलीज़ में उसी फ़ोल्डर में `HotLoopAlarms-1.0.0.0.library` और `HotLoopAlarms-1.0.0.0.compiled-library` भी हैं, जो PLC के अपने अलार्म की लाइब्रेरी है। इनमें से किसी एक को Transmitter लाइब्रेरी की तरह इंस्टॉल करें और एप्लिकेशन के Library Manager में जोड़ें। प्रोजेक्ट को एक Alarm Configuration चाहिए, और HotLoop 4.23.6 और बाद के संस्करण ब्लॉक को पढ़ते हैं।

## अगर ब्लॉक त्रुटि बताए

| `eError` | अर्थ | क्या करें |
|---|---|---|
| `NoFields` | कोई फ़ील्ड नहीं जोड़ा गया | सक्षम करने से पहले कोई `Add` मेथड कॉल करें |
| `BadInterval` | `tPublishingInterval` 1 ms से कम है | इसे सेट करें |
| `BadAddress` | `sDestination` बिंदुओं वाला IPv4 पता नहीं है | इसे ठीक करें |
| `SocketCreate`, `SocketOption` | रनटाइम ने सॉकेट कॉल अस्वीकार की; `diLastSocketResult` में उसका कोड है | `tRetry` के बाद ब्लॉक खुद फिर कोशिश करता है |
| `TooBig` | फ़ील्ड 1472 बाइट में नहीं समाते | कम प्रकाशित करें, या अलग writer id वाले दो पब्लिशर इस्तेमाल करें |
| `BadField` | सहेजा हुआ पता मिट गया | `Clear()` करें और फ़ील्ड फिर जोड़ें |
