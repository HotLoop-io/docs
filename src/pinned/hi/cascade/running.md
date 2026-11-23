---
title: "Cascade को चलाना"
description: "Cascade को Podman Quadlet या k3s पर Helm से चलाएं, SQLite या Postgres पर, उस हेल्थ चेक के साथ जिसे यूनिट और चार्ट के प्रोब इस्तेमाल करते हैं।"
---

Podman होस्ट पर `deploy/quadlet` में systemd यूनिट होती हैं। एक फ़ाइल और एक वॉल्यूम SQLite पर Cascade है; `deploy/quadlet/postgres` सर्वर, एक वर्कर और PostgreSQL है, जो अपने अलग नेटवर्क पर होते हैं। दोनों बूट पर शुरू होते हैं, विफल होने पर फिर शुरू होते हैं और रीड-ओनली, नॉनरूट तथा हर capability हटाकर चलते हैं। इसका README पूरी प्रक्रिया समझाता है।

किसी संस्करण को हाथ से खींचने के लिए:

```sh
podman pull ghcr.io/hotloop-io/hotloop-cascade:1.5.1
```

यूनिट `:stable` का अनुसरण करती हैं और Podman का ऑटो-अपडेट टाइमर उन्हें आगे बढ़ाता है।

k3s पर `charts/hotloop-cascade` Helm चार्ट है:

```sh
helm install cascade oci://ghcr.io/hotloop-io/charts/hotloop-cascade --version 1.5.1
```

चार्ट पर वे लेबल लगे होते हैं जिन्हें EmberNet डैशबोर्ड पढ़ता है, Service पर और एडिटर परोसने वाले पॉड पर, इसलिए App Store से डिप्लॉय किया गया Cascade Running Apps में LAUNCH बटन के साथ दिखता है। `gui.appName`, `gui.port` और `gui.displayName` बदलने से जो दिखता है वह बदल जाता है।

यह वॉल्यूम के साथ SQLite पर एक पॉड है। PostgreSQL के साथ `--set split=true` (चार्ट जो चलाता है उसके लिए `--set postgresql.enabled=true`, या आपके अपने के लिए `externalDatabase.existingSecret`) इसे API, वेबहुक और वर्कर पॉड में बांट देता है, जिन्हें आप अलग-अलग स्केल करते हैं। सहेजे गए क्रेडेंशियल को सील करने वाली कुंजी पहली इंस्टॉलेशन पर बनती है और रिलीज़ अनइंस्टॉल करने पर भी रखी जाती है, क्योंकि रिलीज़ के साथ चली जाने वाली कुंजी रखे गए डेटाबेस के हर क्रेडेंशियल को भी साथ ले जाती है। इसका बैकअप रखें।

`hotloop-cascade healthcheck` चल रहे सर्वर के अपने हेल्थ एंडपॉइंट से पूछता है और 0 या 1 के साथ बंद होता है। Quadlet यूनिट और चार्ट के प्रोब दोनों उसके पीछे के एंडपॉइंट इस्तेमाल करते हैं।
