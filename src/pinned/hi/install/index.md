---
title: "HotLoop इंस्टॉल करें"
description: "हर HotLoop उत्पाद कैसे इंस्टॉल होता है: k3s या Kubernetes पर Helm, या बॉक्स पर Podman Quadlet, जो stable टैग का पालन करता है और खुद अपडेट होता है।"
sidebar:
  label: "इंस्टॉलेशन"
---

HotLoop उत्पाद को असल में चलाने के दो तरीके हैं: k3s या किसी भी Kubernetes पर Helm, या ऐसे बॉक्स पर Podman के साथ Quadlet जो क्लस्टर में नहीं है। न Docker, न Compose, और न ऐसे शेल से अकेला `podman run` जो सत्र के साथ मर जाता है। आज़माने के लिए सादा `podman run` ठीक है, और Flow का पृष्ठ यही कहता है, पर वह इंस्टॉलेशन नहीं है।

## रास्ता चुनें

| आपके पास | उपयोग करें | पृष्ठ |
|---|---|---|
| k3s या Kubernetes क्लस्टर | Helm | [k3s और Helm](/hi/install/helm/) |
| Pi, NUC या छोटा औद्योगिक PC, बिना क्लस्टर के | Podman Quadlet | [Podman Quadlet](/hi/install/quadlet/) |
| दोनों में से कोई, और आप जानना चाहते हैं कि अपडेट कैसे व्यवहार करते हैं | | [:stable का स्वचालित अपडेट](/hi/install/auto-update/) |

## आज आप क्या इंस्टॉल कर सकते हैं

| उत्पाद | नवीनतम रिलीज़ | Helm | Quadlet | यहां से शुरू करें |
|---|---|---|---|---|
| [HotLoop IoT](/hi/iot/overview/) | {{hotloop}} | हां | हां | [IoT इंस्टॉल करें](/hi/iot/install/) |
| [HotLoop Edge](/hi/edge/overview/) | {{hotloop}} | हां | हां | [Edge इंस्टॉल करें](/hi/edge/install/) |
| [HotLoop Gateway](/hi/gateway/overview/) | {{hotloop}} | हां | हां | [Gateway इंस्टॉल करें](/hi/gateway/install/) |
| [HotLoop Edge Relay](/hi/edge-relay/overview/) | {{hotloop}} | हां | हां | [Edge Relay इंस्टॉल करें](/hi/edge-relay/install/) |
| [HotLoop Flow](/hi/flow/overview/) | {{flow}} | हां | हां | [Flow इंस्टॉल करें](/hi/flow/install/) |
| [HotLoop Cascade](/hi/cascade/overview/) | {{cascade}} | हां, लॉगिन की ज़रूरत नहीं | हां, लॉगिन की ज़रूरत नहीं, देखें [Podman Quadlet के साथ Cascade](/hi/cascade/quadlet/) | [Cascade चलाना](/hi/cascade/running/) |
| [HotLoop for CODESYS](/hi/codesys/overview/) | {{codesys}} | हां, या EmberCORE App Store | नहीं | [HotLoop for CODESYS इंस्टॉल करें](/hi/codesys/install/) |
| [HotLoop Transmitter](/hi/transmitter/overview/) | 1.1.0 | नहीं, यह एक CODESYS लाइब्रेरी है | नहीं, यह एक CODESYS लाइब्रेरी है | [Transmitter इंस्टॉल करें](/hi/transmitter/install/) |

HotLoop IoT, Edge, Gateway और Edge Relay एक ही टैग से, एक साथ निकलते हैं, इसलिए इनका संस्करण संख्या एक है। Flow, Cascade, HotLoop for CODESYS और Transmitter की अपनी है। IoT, Edge और Gateway की Quadlet यूनिट को Podman 5.0 या नया चाहिए, और रिले की यूनिट Podman 4.9.3 पर चलाई गई थी। Raspberry Pi OS Bookworm के साथ 4.3 आता है, जिसमें Quadlet है ही नहीं, इसलिए Pi को Trixie या नया चाहिए।

## इसे असली प्लांट पर लगाने से पहले

- [राइट गेट](/hi/gateway/write-gate/) पढ़ें। यह हर उत्पाद में एक जैसा है, और इसी कारण कुछ भी ऐसी मशीन को नहीं चलाता जिसे आपने आर्म नहीं किया।
- अगर Pi है, तो डेटाबेस SD कार्ड पर नहीं, USB SSD पर रखें। इतिहास रोज़ पूरे दिन लिखता है, और SD कार्ड ठीक इसी से मरते हैं।
- डिवाइस पासवर्ड कुंजी का बैकअप लें। यह न डेटाबेस में है न बैकअप में, इसलिए यह आपके डेटा का हिस्सा है। कैसे, यह [बैकअप](/hi/iot/backup/) बताता है।
- किसी साइट को ऊपर के उत्पाद पर ले जाने या रिलीज़ के पार अपग्रेड करने से पहले बैकअप लें, और उसे बॉक्स से बाहर कॉपी करें।
