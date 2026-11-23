---
title: "منتجات HotLoop: ثمانية في خمسة مسارات"
description: "ثمانية منتجات في خمسة مسارات للإصدارات: ما في كل منتج أساسي، وقاعدة البيانات التي يشغّلها، وطريقة تثبيتها، وكيف ينتقل الموقع إلى منتج أكبر."
---

HotLoop ثمانية منتجات لأرض المصنع: أربعة تنمو مع الموقع (IoT وEdge وGateway وEdge Relay)، إضافة إلى Flow لربط المنطق، وCascade لسير العمل، وHotLoop for CODESYS لشاشة وحدة PLC نفسها، وTransmitter لإخراج قيم وحدة PLC إلى الشبكة.

تصدر هذه المنتجات في خمسة مسارات للإصدارات. **HotLoop core** هو IoT وEdge وGateway وEdge Relay: أربعة منتجات، وشيفرة واحدة، ووسم واحد. كل إصدار من core يطرح الأربعة معًا برقم إصدار واحد، ولكل منها صورته ومخطط Helm الخاص به ووحدات Podman Quadlet الخاصة به. اختر ما يناسب الجهاز. كل منتج يتحدث كل البروتوكولات التي يملكها HotLoop، فلا تحتاج أبدًا إلى الانتقال إلى منتج أكبر لمجرد قراءة وحدة PLC على طاولتك. الميزات هي ما يفصل بين المنتجات. أما البروتوكولات فلا.

أما **Flow** و**Cascade** و**HotLoop for CODESYS** و**Transmitter** فلكل منها مساره وإصداراته، لذلك لا يحرّك إصدار Flow الـ core أبدًا، والعكس صحيح. كل ما تحت الجدول يخص الـ core. وهذه نقطة البداية لكل منتج من المنتجات الثمانية:

| المنتج | مسار الإصدار | التوثيق | التثبيت | ملاحظات الإصدار | خارطة الطريق |
|---|---|---|---|---|---|
| **HotLoop IoT** | HotLoop core | <a href="/ar/iot/overview/">التوثيق</a> | <a href="/ar/iot/install/">التثبيت</a> | <a href="/ar/releases/#hotloop-core">الملاحظات</a> | <a href="/ar/roadmap/">خارطة الطريق</a> |
| **HotLoop Edge** | HotLoop core | <a href="/ar/edge/overview/">التوثيق</a> | <a href="/ar/edge/install/">التثبيت</a> | <a href="/ar/releases/#hotloop-core">الملاحظات</a> | <a href="/ar/roadmap/">خارطة الطريق</a> |
| **HotLoop Gateway** | HotLoop core | <a href="/ar/gateway/overview/">التوثيق</a> | <a href="/ar/gateway/install/">التثبيت</a> | <a href="/ar/releases/#hotloop-core">الملاحظات</a> | <a href="/ar/roadmap/">خارطة الطريق</a> |
| **HotLoop Edge Relay** | HotLoop core | <a href="/ar/edge-relay/overview/">التوثيق</a> | <a href="/ar/edge-relay/install/">التثبيت</a> | <a href="/ar/releases/#hotloop-core">الملاحظات</a> | <a href="/ar/roadmap/">خارطة الطريق</a> |
| **HotLoop Flow** | Flow | <a href="/ar/flow/overview/">التوثيق</a> | <a href="/ar/flow/install/">التثبيت</a> | <a href="/ar/releases/#hotloop-flow">الملاحظات</a> | <a href="/ar/flow/roadmap/">خارطة الطريق</a> |
| **HotLoop Cascade** | Cascade | <a href="/ar/cascade/overview/">التوثيق</a> | <a href="/ar/cascade/running/">التثبيت</a> | <a href="/ar/releases/#hotloop-cascade">الملاحظات</a> | <a href="/ar/cascade/roadmap/">خارطة الطريق</a> |
| **HotLoop for CODESYS** | HotLoop for CODESYS | <a href="/ar/codesys/overview/">التوثيق</a> | <a href="/ar/codesys/install/">التثبيت</a> | <a href="/ar/releases/codesys-0-3-10/">الملاحظات</a> | <a href="/ar/codesys/roadmap/">خارطة الطريق</a> |
| **HotLoop Transmitter** | Transmitter | <a href="/ar/transmitter/overview/">التوثيق</a> | <a href="/ar/transmitter/install/">التثبيت</a> | <a href="/ar/releases/transmitter-1-2-0/">الملاحظات</a> | <a href="/ar/transmitter/roadmap/">خارطة الطريق</a> |

يقارن الجدول التالي بين منتجات الـ core الأربعة.

| <span class="sr-only">التفاصيل</span> | HotLoop IoT | HotLoop Edge | HotLoop Gateway | HotLoop Edge Relay |
|---|---|---|---|---|
| ما الغرض منه | أساس الأتمتة. جهاز Pi أو NUC أو صندوق في خزانة | صندوق عند الآلة، يواصل العمل حتى لو انقطع الاتصال الصاعد | عقل الموقع | يستعلم ويمرّر ويصمد. بلا قاعدة بيانات وبلا واجهة |
| الكيانات والأتمتة والمساعدات والسكربتات والوصفات والقوالب ولوحات المعلومات وسجل الأحداث والإشعارات وMCP وMQTT مع الاكتشاف وإنذارات ISA-18.2 والنسخ الاحتياطية وكل برنامج تشغيل | نعم | نعم | نعم | برامج التشغيل فقط |
| خادم OPC UA، ونشر Sparkplug عند الحافة مع التخزين ثم التمرير | | نعم | نعم | النشر فقط |
| أسطول الأجهزة، ومواقع متعددة، وتقارير مجدولة | | | نعم | |
| الصورة | `ghcr.io/hotloop-io/hotloop-iot` | `ghcr.io/hotloop-io/hotloop-edge` | `ghcr.io/hotloop-io/hotloop` | `ghcr.io/hotloop-io/hotloop-edge-relay` |
| المخطط | `hotloop-iot` | `hotloop-edge` | `hotloop` | `hotloop-edge-relay` |
| وحدات Quadlet | `deploy/quadlet/iot/` | `deploy/quadlet/edge/` | `deploy/quadlet/gateway/` | `deploy/quadlet/edge-relay.container` |
| وحدات Quadlet على SQLite | `deploy/quadlet/iot/sqlite/` | `deploy/quadlet/edge/sqlite/` | `deploy/quadlet/gateway/sqlite/` | لا يوجد |
| `database.type` في المخطط | `postgresql` (افتراضي)، `sqlite` | `timescaledb` (افتراضي)، `postgresql`، `sqlite` | `timescaledb` (افتراضي)، `postgresql`، `sqlite` | لا يوجد |
| المعماريات | amd64, arm64, arm/v7 | amd64, arm64, arm/v7 | amd64, arm64 | amd64, arm64, arm/v7 |
| قاعدة البيانات التي يشغّلها المخطط وQuadlet | PostgreSQL 17 | TimescaleDB | TimescaleDB | لا يوجد |
| السجل المحفوظ افتراضيًا | 30 يومًا | 90 يومًا | 90 يومًا | لا يوجد |
| قواعد البيانات التي يعمل عليها الملف التنفيذي | SQLite أو Postgres | SQLite أو Postgres أو TimescaleDB | SQLite أو Postgres أو TimescaleDB | لا يوجد |

قاعدة البيانات إعداد وليست صورة: يضع `HOTLOOP_DB_TYPE=sqlite` و`HOTLOOP_DB_PATH` أيًّا من الثلاثة على ملف SQLite دون أي حاوية لقاعدة البيانات (DEPLOYMENT.md، "SQLite"). تقبل المخططات الاختيار نفسه بصيغة `database.type`، وتقبله وحدات Quadlet بصيغة الأدلة `sqlite/`، ولا يقدّم كل منتج إلا قواعد البيانات المذكورة في الجدول أعلاه: طلب `timescaledb` من مخطط IoT يُفشل التثبيت. الانتقال من قاعدة بيانات إلى أخرى نسخة احتياطية ثم استعادة (BACKUP.md).

احتفظ Gateway بالأسماء التي صدر بها حتى 4.17.0: الصورة `ghcr.io/hotloop-io/hotloop` والمخطط `hotloop`. ولا يحتاج من يشغّله إلى تغيير أي شيء.

## ما في المنتج هو ما في الملف التنفيذي

المنتج بناء وليس إعدادًا. `-tags hotloop_iot` يبني IoT، و`-tags hotloop_edge` يبني Edge، وبلا وسم يُبنى Gateway. ما لا يملكه المنتج ليس معطّلًا، بل غير موجود: خادم OPC UA ليس في صورة IoT أصلًا، فلا يستطيع أي متغير بيئة ولا ملف قيم ولا يوم سيئ تشغيله.

ولذلك يجيب المنتج الأصغر عمّا لا يملكه بدل أن يتظاهر:

- **الـ API** تحتفظ بكل مسار في كل منتج. المسار الخاص بميزة لا يملكها هذا المنتج يردّ بـ `404` ويذكر المنتج الذي يملكها: `{"error":"scheduled reports are part of HotLoop Gateway; this is HotLoop IoT","product":"iot","feature":"reports"}`. ويذكر `GET /api/status` الحقلين `product` و`features`، فيسأل السكربت بدل أن يتلمّس طريقه.
- **إعداد خاص بـ Gateway** على IoT أو Edge (مثل `HOTLOOP_REPORTS_ENABLED=true` المنقول من ملف قيم قديم) يعطي تحذيرًا عند التشغيل وفي شاشة الإعدادات، ويواصل HotLoop العمل. يُبقي HotLoop المصنع شغّالًا رغم تقرير لا يستطيع إنتاجه، ويضمن التحذير أن يراه أحد.
- **المخططات** لا تحتوي هذا الإعداد أصلًا. لا يملك `charts/hotloop-iot` أي كتلة `reports` أو `opcuaServer` أو `edgePublish`، ولا يملك `hotloop-edge` كتلة `reports`. وإذا ضبطتَ أحدها رغم ذلك فلن ينتج شيئًا.
- **`hotloop --product`** يطبع `iot` أو `edge` أو `gateway`. ولا يزال `--version` يطبع الإصدار فقط، لأن السكربتات تحلّله.

## أيّها تختار

- **جهاز Pi، أو مقابس ذكية، أو بضعة مستشعرات، أو وسيط MQTT مليء بأجهزة Tasmota وZigbee2MQTT، أو وحدة PLC واحدة على طاولة:** IoT. وهو أصغر صورة (نحو 29 ميغابايت على arm)، وصورة PostgreSQL العادية سدس صورة TimescaleDB، وهذا هو الرقم المهم على بطاقة SD.
- **صندوق مثبّت بجانب خط إنتاج، يغذّي نظام SCADA عبر OPC UA أو ينشر إلى الأعلى عبر Sparkplug ويتحمل انقطاع الاتصال الصاعد:** Edge.
- **الموقع: كل الخطوط، وتقارير تُرسل بالبريد حسب جدول، ومُمرِّرات حافة تبلّغ، وأكثر من موقع على شاشة واحدة:** Gateway.
- **صندوق يكتفي بالاستعلام والتمرير، دون قاعدة بيانات تحتاج إلى رعاية:** Edge Relay. راجع [مرجع Edge Relay](/ar/edge-relay/reference/).

## الأحجام

الصورة هي الملف التنفيذي مضافًا إليه نحو 3 ميغابايت من الأساس.

| <span class="sr-only">التفاصيل</span> | صورة / ملف تنفيذي لـ amd64 | صورة / ملف تنفيذي لـ arm64 | صورة / ملف تنفيذي لـ arm/v7 |
|---|---|---|---|
| IoT | 31.2 / 28.0 MB | 29.1 / 26.0 MB | 29.2 / 26.0 MB |
| Edge | 36.5 / 33.3 MB | 34.2 / 31.0 MB | 34.3 / 31.1 MB |
| Gateway | 37.1 / 33.9 MB | 34.8 / 31.6 MB | غير مبني |
| Edge Relay | 15.7 / 12.5 MB | 14.9 / 11.7 MB | 15.1 / 11.9 MB |

هذه الأحجام على القرص. دون أجهزة يستهلك HotLoop نحو 10 ميغابايت من RSS وPostgreSQL نحو 12 ميغابايت، وهذا هو الحد الأدنى لا الرقم الفعلي: ما يستهلكه المنتج مع أجهزة يستعلم عنها يعتمد على الأجهزة.

## التثبيت

### Helm

مستودع واحد، وفيه المخططات الأربعة:

```sh
helm repo add hotloop https://hotloop.io/hotloop/

helm install hotloop hotloop/hotloop-iot  --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop-edge --namespace hotloop --create-namespace
helm install hotloop hotloop/hotloop      --namespace hotloop --create-namespace
```

سمِّ الإصدار `hotloop` أيًّا كان المنتج. فاسم الإصدار هو ما تُسمّى به وحدة تخزين قاعدة البيانات وSecrets وService، والاحتفاظ به هو ما يتيح للموقع أن ينتقل لاحقًا إلى منتج أكبر (انظر أدناه).

في EmberNet، لكل منتج بطاقته الخاصة في App Store: "HotLoop IoT" و"HotLoop Edge" و"HotLoop Gateway" و"HotLoop Edge Relay". ينشر النشر من المتجر وسوم المستأجر الخاصة بلوحة المعلومات في كل ما يولّده المخطط، ويعرضها Running Apps بالأسماء `HotLoop-IoT` و`HotLoop-Edge` و`HotLoop-Gateway` و`HotLoop-Edge-Relay`.

### Podman Quadlet

لجهاز ليس ضمن عنقود. يحتوي كل دليل منتج تحت `deploy/quadlet/` على خمس وحدات: `hotloop.network` و`hotloop.container` (التطبيق) و`hotloop-db.container` (قاعدة بياناته، بالصورة والإصدار نفسيهما اللذين يشغّلهما مخططه) و`hotloop-db.volume` و`hotloop-data.volume`. خطوات التثبيت في ترويسة كل `hotloop.container`، وباقي التفاصيل في [Podman Quadlet](/ar/install/quadlet/).

تحتاج إلى Podman 5.0 أو أحدث. يأتي Raspberry Pi OS Bookworm بالإصدار 4.3 الذي لا يدعم Quadlet إطلاقًا، لذا يحتاج Pi إلى Raspberry Pi OS Trixie أو أحدث. يتبع التطبيق `:stable` ويحرّكه التحديث التلقائي في Podman، بينما تبقى قاعدة البيانات مثبّتة: يشرح [README الخاص بـ Quadlet](/ar/install/auto-update/) الكيفية والسبب. وأيًّا كانت طريقة التثبيت، ضع قاعدة البيانات على قرص SSD عبر USB لا على بطاقة SD. فالسجل يكتب طوال اليوم كل يوم، وبطاقات SD تموت من ذلك بالتحديد.

## نقل موقع إلى منتج أكبر

الانتقال من IoT إلى Edge إلى Gateway يُبقي كل جهاز ووسم وكيان وأتمتة وإنذار ومستخدم وكل ساعة من السجل. يشغّل كل منتج كل عمليات الترحيل، فتكون قاعدة البيانات بالشكل نفسه في الثلاثة، ويبدأ المنتج الأكبر وميزاته الإضافية فارغة.

- **Quadlet:** أسماء الوحدات ووحدات التخزين والأسرار هي نفسها في كل دليل منتج. انسخ `hotloop.container` و`hotloop-db.container` من المنتج الأكبر فوق ملفاتك، ثم نفّذ `systemctl daemon-reload` وأعد التشغيل.
- **Helm:** `helm upgrade hotloop hotloop/hotloop-edge` (أو `hotloop/hotloop`) على الإصدار نفسه. تختار المخططات الثلاثة حاوياتها بالوسوم نفسها وتسمّي StatefulSet ووحدة تخزين قاعدة البيانات بالطريقة نفسها، فالترقية مسموحة وتبقى وحدة التخزين مرتبطة.

خذ نسخة احتياطية أولًا (`POST /api/backup`، راجع [النسخ الاحتياطي والاستعادة](/ar/iot/backup/)) وانسخها خارج الجهاز. جُرّب هذا الانتقال على Quadlet، من IoT إلى Edge إلى Gateway على وحدة تخزين واحدة لقاعدة البيانات مع الجهاز نفسه حاضرًا في كل خطوة، مع بدء دليل PostgreSQL الخاص بـ IoT تحت صورة TimescaleDB الخاصة بـ Gateway، وكذلك بصيغة `helm upgrade` على عنقود حقيقي. وحيث لا يحتوي دليل IoT العادي على إضافة TimescaleDB، يبقى السجل في أقسام أصلية بعد ذلك الانتقال، ويتطلب الجدول الفائق نسخة احتياطية واستعادة إلى TimescaleDB جديدة. العودة إلى منتج أصغر ليست خطوة تُجرى على جهاز يهمّك.

## كيف تصدر

يُصدر وسم `v` واحد المنتجات الأربعة كلها، فيتشارك IoT وEdge وGateway وEdge Relay الإصدار نفسه دائمًا. وقبل بناء أي شيء، يُتحقق من أن إصدار كل مخطط وصورته يطابقان الوسم، وأن كل وحدة تطبيق في Quadlet تتبع `:stable` مع فحص صحة، وأن كل وحدة قاعدة بيانات تطابق مخططها ولا تُحدَّث تلقائيًا أبدًا. تُولَّد مخططات IoT وEdge من مخطط Gateway، فيصل إصلاح أحدها إلى الثلاثة.
