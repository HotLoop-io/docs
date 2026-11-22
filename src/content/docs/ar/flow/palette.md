---
title: "لوحة العقد"
description: "كل نوع عقدة يأتي مع Flow، موسوم بأنه كامل أو جزئي أو مختلف أو خاص بـ Flow، مع تدوين الفرق عن Node-RED."
---

**117 نوع عقدة للرسائل، و39 أخرى لمخططات FlowLab.**

| الفئة | العقد |
|---|---|
| عامة | inject, debug, complete, catch, status, link in, link out, comment, junction |
| الدالة | function, switch, change, range, template, delay, trigger, exec, rbe |
| الشبكة | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail، وعقد Node-RED التالية modbus-read/getter/flex-getter/write/flex-write/server |
| التسلسل | split, join, sort, batch |
| المحلل | csv, html, json, xml, yaml |
| التخزين | file, file in, watch, influxdb out, postgres, postgresql |
| لوحة المعلومات | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template، والعقد ui_base, ui_tab, ui_group, ui_link, ui_spacer التي تنسّق الصفحة |
| الاكتشاف | scan, netinfo، لجرد قطاع OT |
| الإعداد | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

صف FlowLab نوع مختلف من العقد. يعمل على علامة تبويب هي مخطط، حيث تعمل العقدة مرة واحدة عندما تكون لكل مدخل قيمة، ولا تستقبل رسالة أبدًا. ما هو FlowLab وكيف تعمل حلقاته وسلك الأخطاء ولوحته ومصحّح الأخطاء فيه موجود في [FlowLab](/ar/flow/flowlab/). يمكن دفع ملف تدفق واحد، ومن ثم مجموعة واحدة من المخططات، إلى كل تثبيت Flow يشغّله مستأجر في EmberNet، مع فحص كل واحد وإعادة الفاشل إلى حالته: [الدفع إلى محطات مستأجر](/ar/flow/stations/). يمكن لتثبيتين أن يتقاسما عمل تثبيت واحد، مع عقد إيجار وحاجز على كل كتابة إلى المعدات بحيث لا يكتب إلا واحد: [احتياطي دافئ بعقد إيجار](/ar/flow/failover/).

## إبلاغ الناس، وKafka

خمس عقد ترسل ما تحمله الرسالة إلى مكان آخر وتمرّر الرسالة: **ntfy out** و**gotify out** و**discord out** (webhook) و**discord bot out** و**kafka out**. وهي تأخذ الإعدادات نفسها التي ترسل بها نواة HotLoop إنذاراتها وأحداثها، فالمصنع الذي لديه موضوع ntfy أو تطبيق Gotify أو webhook في Discord أو عنقود Kafka يوجّه Flow إلى الأشياء نفسها.

- **ntfy.** عقدة إعداد خادم (العنوان، ثم رمز وصول أو اسم مستخدم وكلمة مرور، أو لا شيء لخادم يسمح لأي أحد بالنشر)، ولكل عقدة موضوع وعنوان وأولوية (من min إلى max، أو `msg.priority`) ووسوم وعنوان نقر. الموضوع أو العنوان الفارغ يأخذ `msg.topic` أو `msg.title`. على خادم عام يكون الموضوع هو السر الوحيد، لذلك يُبقى خارج كل خطأ وحالة.
- **Gotify.** عقدة إعداد خادم برمز التطبيق، ولكل عقدة عنوان وأولوية من 0 إلى 10.
- **webhook في Discord.** عنوان URL للـ webhook هو بيانات الاعتماد كلها، على العقدة، ولا يظهر أبدًا في حالة أو سجل أو خطأ، ولا حتى في خطأ شبكة يذكر العنوان. العنوان أو اللون يجعل الرسالة embed. يُقتطع المحتوى عند 2,000 حرف ووصف الـ embed عند 4,096، بالعدّ الذي يعدّ به Discord، ولا يمكن لشيء في رسالة أن يستدعي أحدًا.
- **بوت Discord.** عقدة إعداد بوت برمزه، ولكل عقدة معرّف قناة (أو `msg.channel`). ينشر بصفته البوت ويحتاج إلى أن يكون البوت في القناة مع إذن بالإرسال.
- **Kafka out.** عقدة إعداد عنقود (وسطاء، SASL PLAIN أو SCRAM-SHA-256 أو SCRAM-SHA-512، TLS)، ولكل عقدة موضوع ومفتاح اختياري. القيمة هي `msg.payload`، كنص، أو كـ JSON حين لا تكون نصًا، وتُمرَّر الرسالة بعد أن يؤكدها العنقود من كل نسخة متزامنة. يستخدم franz-go، العميل الذي يستخدمه إخراج Kafka في النواة.

الخادم الذي يرفض يذكر السبب في خطأ العقدة، دون أي شيء مما أُرسل. يُنتظر حد المعدل مرة واحدة، بالمدة التي يذكرها الخادم حتى دقيقة، وبعدها تفشل الرسالة. لا توجد عقدة Slack ولا Teams ولا عقدة UADP: يستقبل HotLoop بيانات UADP ويقرأ Flow تلك القيم عبر عقد HotLoop.

ثبتت صحته مع ntfy حقيقي وGotify حقيقي وRedpanda حقيقي: تنشر العقدة ثم يُسأل الخادم عمّا يحتفظ به. تتبع عقد Discord واجهة API الموثّقة من Discord للـ webhooks والبوتات.

يفحص `scan` نطاق CIDR ويتعرف على نقاط Modbus وEtherNet/IP، ويبلّغ `netinfo` عن الواجهات التي يستطيع وقت التشغيل رؤيتها فعلًا، وهي في وضع macvlan الطريقة التي يكتشف بها التدفق عنوانه على VLAN الخاص بـ OT. وصار بإمكان عقد Modbus TCP وS7 وEtherNet/IP وOPC UA وSparkplug B التحدث إلى ما يجده `scan`، وهي القسم التالي.

يعلن واصف Go واحد لكل نوع عقدة عن خصائصه ومنافذه وقيمه الافتراضية ونص المساعدة، ويرسم المحرر الحوار منه، فلا يمكن أن تصدر عقدة بحوار يخالف وقت تشغيلها.
