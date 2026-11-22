---
title: "Палитрата с възли"
description: "Всеки тип възел, който Flow доставя, обозначен като пълен, частичен, различаващ се или само за Flow, с разликата от Node-RED записана."
---

**117 типа възли за съобщения и още 39 за диаграми на FlowLab.**

| Категория | Възли |
|---|---|
| Общи | inject, debug, complete, catch, status, link in, link out, comment, junction |
| Функция | function, switch, change, range, template, delay, trigger, exec, rbe |
| Мрежа | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail, и възлите modbus-read/getter/flex-getter/write/flex-write/server на Node-RED |
| Последователност | split, join, sort, batch |
| Парсер | csv, html, json, xml, yaml |
| Съхранение | file, file in, watch, influxdb out, postgres, postgresql |
| Табло | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template, и ui_base, ui_tab, ui_group, ui_link и ui_spacer, които подреждат страницата |
| Откриване | scan, netinfo, за инвентаризиране на OT сегмент |
| Конфигурация | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

Редът за FlowLab е различен вид възел. Той работи в раздел, който е диаграма, където възелът се изпълнява веднъж, когато всеки вход има стойност, и никога не приема съобщение. Какво е FlowLab и как работят неговите цикли, проводникът за грешки, панелът и дебъгерът, е в [FlowLab](/bg/flow/flowlab/). Един файл с поток, а значи и един набор диаграми, може да бъде изпратен към всяка инсталация на Flow, която наемател изпълнява в EmberNet, всяка проверена, а неуспялата върната: [Изпращане към станциите на наемател](/bg/flow/stations/). Две инсталации могат да споделят работата на една, с наем и преграда на всеки запис към оборудване, така че да пише само една: [Топъл резерв с наем](/bg/flow/failover/).

## Известяване на хората и Kafka

Пет възела изпращат някъде другаде това, което носи съобщението, и предават съобщението нататък: **ntfy out**, **gotify out**, **discord out** (уебхук), **discord bot out** и **kafka out**. Те използват същите настройки, с които ядрото на HotLoop изпраща своите аларми и събития, така че завод, който вече има тема в ntfy, приложение в Gotify, уебхук в Discord или Kafka клъстер, насочва Flow към същите.

- **ntfy.** Конфигурационен възел за сървър (адрес, после токен за достъп или потребителско име и парола, или нищо за сървър, който позволява на всеки да публикува), и за всеки възел тема, заглавие, приоритет (от най-нисък до най-висок, или `msg.priority`), тагове и адрес за щракване. Празна тема или заглавие взема `msg.topic` или `msg.title`. На публичен сървър темата е единствената тайна, затова се държи извън всяка грешка и състояние.
- **Gotify.** Конфигурационен възел за сървър с токена на приложението, и за всеки възел заглавие и приоритет от 0 до 10.
- **Discord уебхук.** URL адресът на уебхука е цялото удостоверение, върху възела, и никога не се показва в състояние, журнал или грешка, дори в мрежова грешка, която назовава адреса. Заглавие или цвят прави съобщението embed. Съдържанието се отрязва при 2,000 знака, а описанието на embed при 4,096, броени както ги брои Discord, и нищо в съобщението не може да споменава никого.
- **Discord бот.** Конфигурационен възел за бот с неговия токен, и за всеки възел ID на канал (или `msg.channel`). Публикува като бота и изисква ботът да е в канала с право да изпраща.
- **Kafka out.** Конфигурационен възел за клъстер (брокери, SASL PLAIN или SCRAM-SHA-256 или SCRAM-SHA-512, TLS), и за всеки възел тема и незадължителен ключ. Стойността е `msg.payload`, като текст или като JSON, когато не е текст, и съобщението се предава, след като клъстерът го е потвърдил от всяка синхронизирана реплика. Използва franz-go, клиента, който използва Kafka изходът на ядрото.

Сървър, който откаже, казва защо в грешката на възела, без нищо от изпратеното. Ограничение на честотата се изчаква веднъж, колкото каже сървърът до една минута, и после съобщението се проваля. Няма възел за Slack или Teams и няма UADP възел: HotLoop приема UADP, а Flow чете тези стойности чрез възлите на HotLoop.

Доказано срещу истински ntfy, истински Gotify и истински Redpanda: възелът публикува и сървърът се пита какво съдържа. Възлите за Discord следват документираното API на Discord за уебхукове и ботове.

`scan` обхожда CIDR диапазон и идентифицира Modbus и EtherNet/IP крайни точки, а `netinfo` докладва интерфейсите, които средата за изпълнение реално може да види, което в режим macvlan е начинът, по който потокът открива собствения си адрес в OT VLAN. Възлите Modbus TCP, S7, EtherNet/IP, OPC UA и Sparkplug B вече могат да говорят с това, което `scan` намира, и те са следващият раздел.

По един Go дескриптор за тип възел декларира неговите свойства, портове, стойности по подразбиране и помощен текст, а редакторът изгражда диалога от него, така че възел не може да излезе с диалог, който не съответства на неговата среда за изпълнение.
