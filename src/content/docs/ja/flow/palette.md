---
title: "ノードパレット"
description: "Flow が備えるすべてのノード種別を、完全、一部、相違あり、Flow 独自に分類し、Node-RED との違いを文書にしています。"
---

**メッセージ用のノード種別が 117、FlowLab ダイアグラム用がさらに 39 あります。**

| カテゴリ | ノード |
|---|---|
| 共通 | inject, debug, complete, catch, status, link in, link out, comment, junction |
| 関数 | function, switch, change, range, template, delay, trigger, exec, rbe |
| ネットワーク | ntfy out, gotify out, discord out, discord bot out, kafka out, mqtt in/out, http in, http response, http request, websocket in/out, tcp in/out, tcp request, udp in/out, modbus read/write, s7 read/write, ethernetip read/write, opcua read/write/subscribe, sparkplug in/out/command, hotloop in/state/script/recipe, mcp tool/result/client, e-mail, および Node-RED の modbus-read/getter/flex-getter/write/flex-write/server ノード |
| シーケンス | split, join, sort, batch |
| パーサー | csv, html, json, xml, yaml |
| ストレージ | file, file in, watch, influxdb out, postgres, postgresql |
| ダッシュボード | ui_text, ui_numeric, ui_button, ui_switch, ui_text_input, ui_led, ui_gauge, ui_chart, ui_template、およびページを構成する ui_base, ui_tab, ui_group, ui_link, ui_spacer |
| ディスカバー | scan, netinfo、OT セグメントの棚卸し用 |
| 設定 | hotloop-flow-ntfy, hotloop-flow-gotify, hotloop-flow-discord-bot, hotloop-flow-kafka, mqtt-broker, websocket-listener, websocket-client, influxdb, postgres, modbus, s7, ethernetip, opcua, sparkplug, hotloop, mcp-server, modbus-client, postgreSQLConfig |
| FlowLab | constant, math, compare, logic, wait, bundle, field, build array, while loop, for loop, body in, body out, serial port, serial read, serial write, parse reading, stable value, log to text file, log to TDMS file, statistics, integral, derivative, filter, read DAQ task, mqtt out, postgres out, control, indicator, chart |

FlowLab の行は別の種類のノードです。ダイアグラムであるタブ上で動作し、ノードはすべての入力に値が揃ったときに一度だけ実行され、メッセージを受け取ることはありません。FlowLab とは何か、ループ、エラーワイヤー、パネル、デバッガーがどう動くかは [FlowLab](/ja/flow/flowlab/) にあります。1 つのフローファイル、つまり 1 組のダイアグラムを、テナントが EmberNet で動かしているすべての Flow インストールにプッシュでき、それぞれが検査され、失敗したものは元に戻されます。[テナントのステーションへのプッシュ](/ja/flow/stations/)をご覧ください。2 つのインストールで 1 つの仕事を分担することもでき、機器へのすべての書き込みにリースとフェンスを設けて、書き込むのは 1 つだけにします。[リースを使うウォームスタンバイ](/ja/flow/failover/)をご覧ください。

## 人への通知と Kafka

5 つのノードが、メッセージが運ぶ内容を別の場所へ送り、メッセージはそのまま先へ渡します。**ntfy out**、**gotify out**、**discord out**(Webhook)、**discord bot out**、**kafka out** です。HotLoop コアがアラームやイベントを送るときと同じ設定を使うため、すでに ntfy のトピック、Gotify のアプリケーション、Discord の Webhook、Kafka クラスターを持っている工場は、Flow を同じものに向ければ済みます。

- **ntfy.** サーバー設定ノード(アドレス、続いてアクセストークン、またはユーザー名とパスワード。誰でも公開できるサーバーなら不要)と、ノードごとのトピック、タイトル、優先度(min から max、または `msg.priority`)、タグ、クリック先アドレスです。トピックまたはタイトルが空の場合は `msg.topic` または `msg.title` を使います。公開サーバーではトピックが唯一の秘密なので、すべてのエラーとステータスから除外されます。
- **Gotify.** アプリケーションのトークンを持つサーバー設定ノードと、ノードごとのタイトルおよび 0 から 10 の優先度です。
- **Discord Webhook.** Webhook URL が資格情報のすべてで、ノードに保持され、アドレスを示すネットワークエラーを含め、ステータス、ログ、エラーのどこにも表示されません。タイトルまたは色を指定すると、メッセージは埋め込みになります。本文は 2,000 文字、埋め込みの説明は 4,096 文字で切り詰められ、Discord と同じ方法で数えます。メッセージ内の何ものも、誰かにメンションを飛ばすことはありません。
- **Discord ボット.** トークンを持つボット設定ノードと、ノードごとのチャンネル ID(または `msg.channel`)です。ボットとして投稿し、ボットがチャンネルに参加していて送信権限を持っている必要があります。
- **Kafka out.** クラスター設定ノード(ブローカー、SASL PLAIN、SCRAM-SHA-256、SCRAM-SHA-512、TLS)と、ノードごとのトピックと任意のキーです。値は `msg.payload` で、テキストとして、テキストでない場合は JSON として送られ、クラスターがすべての同期レプリカから確認応答した後にメッセージが先へ渡されます。コアの Kafka 出力が使うクライアントである franz-go を使用します。

サーバーが拒否した場合は、その理由がノードのエラーに示され、送信した内容は含まれません。レート制限はサーバーが示す時間(最大 1 分)だけ一度待ち、その後はメッセージが失敗します。Slack ノードも Teams ノードもなく、UADP ノードもありません。HotLoop が UADP を受け取り、Flow はその値を HotLoop のノード経由で読み取ります。

本物の ntfy、本物の Gotify、本物の Redpanda に対して検証しています。ノードが発行し、サーバーに何を保持しているかを尋ねます。Discord ノードは、Webhook とボットに関する Discord の公開 API に従っています。

`scan` は CIDR 範囲を走査して Modbus と EtherNet/IP のエンドポイントを識別し、`netinfo` はランタイムが実際に見えるインターフェースを報告します。macvlan モードでは、これがフローが OT VLAN 上の自分のアドレスを見つける方法です。Modbus TCP、S7、EtherNet/IP、OPC UA、Sparkplug B のノードは、`scan` が見つけたものと通信できるようになり、それが次のセクションです。

ノード種別ごとに 1 つの Go ディスクリプターがプロパティ、ポート、既定値、ヘルプテキストを宣言し、エディターはそこからダイアログを描画するので、ノードがランタイムと食い違うダイアログを持ったまま出荷されることはありません。
