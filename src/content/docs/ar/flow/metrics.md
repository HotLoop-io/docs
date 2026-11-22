---
title: "مقاييس Flow"
description: "مقاييس Prometheus التي يعرضها Flow لكل عقدة، ليظهر السلك المتراكم أو صندوق الوارد الممتلئ في رسم بياني قبل أن يظهر كانقطاع."
---

Prometheus على `/metrics`، لكل عقدة، مع وسمي `node` و`type` على كل ما هو لكل عقدة. لا توجد حاوية مصدِّرة جانبية، لأن صندوق الحافة لا يتسع لواحدة، ولا ينبغي أن تحتاج إلى حاوية ثانية لتعرف أن صندوق الوارد ممتلئ.

| المقياس | النوع | ما الذي يخبرك به |
|---|---|---|
| `hotloop_flow_build_info` | gauge | دائمًا 1. يوجد الإصدار في الوسم. |
| `hotloop_flow_uptime_seconds` | gauge | الثواني منذ بدء وقت التشغيل. |
| `hotloop_flow_nodes_running` | gauge | نسخ العقد قيد التشغيل حاليًا. |
| `hotloop_flow_node_messages_received_total` | counter | الرسائل المسلَّمة إلى عقدة. |
| `hotloop_flow_node_messages_sent_total` | counter | الرسائل التي أصدرتها عقدة. |
| `hotloop_flow_node_errors_total` | counter | الأخطاء التي أثارتها عقدة. |
| `hotloop_flow_node_schema_mismatches_total` | counter | الرسائل التي خالفت مخطط JSON عند عقدة: على منفذ الإدخال أو على منفذ إخراج أو في عقدة `json`. ذهبت كل منها إلى عقدة Catch مع مسار كل حقل خاطئ. |
| `hotloop_flow_node_messages_dropped_total` | counter | الرسائل التي أُهملت لأن صندوق وارد كان ممتلئًا. |
| `hotloop_flow_node_sends_blocked_total` | counter | مرات انتظر فيها مرسِل توفر مكان. ضغط عكسي مستمر، وهو الإشارة الحقيقية إلى أن تدفقًا لا يستطيع المواكبة. |
| `hotloop_flow_node_queue_length` | gauge | الرسائل المنتظرة الآن. |
| `hotloop_flow_node_queue_capacity` | gauge | الموضع الذي تبدأ عنده سياسة الفيض بالتطبيق. |
| `hotloop_flow_node_queue_high_water` | gauge | أعمق مستوى بلغه صندوق الوارد هذا على الإطلاق. |
| `hotloop_flow_goroutines` | gauge | تقريبًا واحدة لكل عقدة إضافة إلى الإدخال والإخراج الذي تحتفظ به كل منها. |
| `hotloop_flow_memory_heap_bytes` | gauge | الكومة المخصصة حاليًا. |
| `hotloop_flow_memory_sys_bytes` | gauge | البايتات المأخوذة من نظام التشغيل. |
| `hotloop_flow_gc_cycles_total` | counter | دورات GC المكتملة. |
| `hotloop_flow_git_mirror_behind_deployments` | gauge | عمليات النشر التي لا يملكها المستودع البعيد لمرآة git بعد. فقط مع وجود مرآة. |
| `hotloop_flow_git_mirror_push_failures_total` | counter | عمليات الدفع إلى المرآة التي فشلت وستُعاد محاولتها. |
| `hotloop_flow_git_mirror_pushes_total` | counter | عمليات الدفع إلى المرآة التي نجحت. |
| `hotloop_flow_durable_wire_depth` | gauge | الرسائل المنتظرة على سلك دائم، على القرص. الوسم `wire`. |
| `hotloop_flow_durable_wire_bytes` | gauge | الحصة المحتسبة على الرسائل المنتظرة في ذلك السلك. |
| `hotloop_flow_durable_wire_delivered_total` | counter | الرسائل التي سلّمها السلك وقبلها الهدف. |
| `hotloop_flow_durable_wire_retries_total` | counter | مرات أعاد فيها السلك إرسال رسالة لأن هدفها رفضها. الهدف المتوقف يرفع هذا الرقم. |
| `hotloop_flow_durable_wire_given_up_total` | counter | الرسائل التي توقف السلك عن إعادة محاولتها لأن `ew_durable_attempts` الخاص بالعقدة نفد. ذهبت كل منها إلى التدفق كخطأ مرفق به الرسالة. |
| `hotloop_flow_durable_wire_dropped_total` | counter | الرسائل التي رفضتها سياسة الحصة أو أخرجتها، والطوابير التي أُفرغت حين لم يعد السلك دائمًا. |
| `hotloop_flow_durable_bytes`, `hotloop_flow_durable_max_bytes` | gauge | الحصة التي تستخدمها كل الأسلاك الدائمة معًا، والحصة نفسها. |
| `hotloop_flow_context_flushes_total`, `hotloop_flow_context_rows_written_total` | counter | المعاملات التي كتبت السياق، والصفوف التي غيّرتها فعلًا. |
| `hotloop_flow_context_flush_failures_total` | counter | عمليات تفريغ السياق التي فشلت. تُحفظ التغييرات وتُعاد المحاولة. ينبغي أن يكون صفرًا. |
| `hotloop_flow_audit_write_failures_total` | counter | مدخلات التدقيق التي تعذّرت كتابتها. ينبغي أن يبقى صفرًا إلى الأبد. |
| `hotloop_flow_traces_kept` | gauge | آثار الرسائل في المخزن المؤقت الآن. |
| `hotloop_flow_trace_bytes` | gauge | تقريبًا ما تشغله. محدودة بـ `trace.maxBytes`. |
| `hotloop_flow_traces_started_total` | counter | آثار الرسائل التي بدأت. |
| `hotloop_flow_traces_forgotten_total` | counter | الآثار التي أُخرجت لإفساح المجال. |
| `hotloop_flow_traces_skipped_total` | counter | الرسائل التي لم تُتتبَّع لأن `trace.perSecond` بلغ حده. |
| `hotloop_flow_trace_hops_dropped_total` | counter | القفزات التي لم تُدوَّن: كان أثرها ممتلئًا أو منسيًا بالفعل. |
| `hotloop_flow_otlp_spans_exported_total` | counter | الـ spans التي قبلها مجمّع OpenTelemetry. فقط مع وجود نقطة نهاية. |
| `hotloop_flow_otlp_spans_dropped_total` | counter | الـ spans التي أُهملت لأن طابور التصدير كان ممتلئًا. |
| `hotloop_flow_otlp_spans_failed_total` | counter | الـ spans التي لم يقبلها المجمّع بعد إعادة المحاولة. أي قيمة فوق الصفر تعني أنه لا يستلمها. |

المقياس الذي ينبغي أن تضبط عليه تنبيهًا هو `hotloop_flow_node_queue_high_water` مقابل `hotloop_flow_node_queue_capacity`. مستوى الذروة هو الإنذار المبكر بأن تدفقًا يقترب من سقفه، وهو يصل قبل أن يُهمل أي شيء وقبل أن يستيقظ أحد بوقت طويل. وهذا التنبيه هو السبب الكامل لبنائنا صندوق الوارد المحدود. لا يمكنك أن تُبلغ عن مدى قربك من حدٍّ غير موجود، لذلك كان لا بد أن يوجد الحد أولًا.
