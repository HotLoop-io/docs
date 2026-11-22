---
title: "Cascade को बिल्ड करना"
description: "Cascade का बाइनरी और इमेज बिल्ड करें, और वह डेटाबेस चुनें जिस पर Cascade चलता है।"
---

आपको Go और Podman चाहिए। `make build` Cascade का बाइनरी बनाता है, और `make image` Podman से कंटेनर इमेज बनाता है। एडिटर बाइनरी के अंदर ही शामिल है, इसलिए साथ में कुछ और इंस्टॉल नहीं करना पड़ता।

डेटाबेस एक सेटिंग है। `HOTLOOP_CASCADE_DATABASE` का मान `sqlite:<path>` (डिफ़ॉल्ट, `HOTLOOP_CASCADE_DATA_DIR` के अंदर) या कोई `postgres://` URL होता है।

Docker नहीं और Compose नहीं। Cascade, Podman (Quadlet के साथ) और k3s (Helm के साथ) के लिए उपलब्ध है।