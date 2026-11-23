---
title: "Flow 2.9.0 リリースノート"
description: "HotLoop Flow 2.9.0 の内容、アップグレード時の変更点、稼働中のプラントに触れる前に読むべきこと。"
sidebar:
  label: "2.9.0"
---

HotLoop Flow 2.9.0は、実際の工場の移行に向けて、ネイティブのコネクターノードを追加します。工場のフローが頼るNode-REDのノード、Modbus、ダッシュボード、PostgreSQL、メールに加えて、その周りの関数ノードが呼び出す`Buffer`と`setInterval`も動かします。それらを使うNode-REDの機器から取り込んだフローは、そのまま読み込み、実行、保存できます。また、1つのポートが機械ごとに1つのVLANを運ぶ機器で、すべてのVLANが同じサブネットと同じ機器アドレスを持っていても、1つのFlowで機械ごとにタブを持てます。

## 新機能

- **Node-REDのModbus。** `modbus-client`、`modbus-read`、`modbus-getter`、`modbus-flex-getter`、`modbus-write`、`modbus-flex-write`、`modbus-server`、そして受け身の`modbustcp-server`。出力はコミュニティのノードが送るものと同じです。`msg.payload`は値のリスト、`msg.responseBuffer`は`{data, buffer}`、`msg.input`で、エラーは2番目の出力から出ます。
- **ダッシュボード。** `ui_base`、`ui_tab`、`ui_group`、`ui_link`、`ui_spacer`、`ui_text`、`ui_numeric`、`ui_button`、`ui_switch`、`ui_text_input`、`ui_led`、`ui_gauge`、`ui_chart`、`ui_template`を、バイナリから`/ui`で提供し、工場の外から取得するものはありません。オペレーターがページで行った操作は、ノードからメッセージとして出ます。`ui_template`は、工場で使われるAngularJS風のサブセットを実行します。`{{ }}`、`ng-click`、`ng-class`、`ng-init`、`ng-show`、`ng-hide`、`ng-if`、`ng-bind`、`scope.$watch`、`scope.send`。
- **PostgreSQL。** `postgreSQLConfig`と`postgresql`。接続は最初のクエリで開くので、まだ起動していないデータベースがフローを止めることはありません。
- **メール。** SMTPで送る`e-mail`出力ノード。STARTTLS、証明書スイッチ、XOAUTH2に対応します。
- **関数ノードの`Buffer`、`setInterval`、`setTimeout`。** タイマーはノードの時計で動き、すべてのコールバックのCPU制限はメッセージと同じで、フローが止まるか再デプロイされると、すべてのタイマーが解除されます。
- **すべてのクライアントにネットワークインターフェース。** ノード、タブ、クライアント設定が、接続をバインドするインターフェース(`SO_BINDTODEVICE`)を指定できるので、乾燥機14のタブはVLAN 14の`192.168.1.5`だけに届きます。タブでは、そのタブの環境変数`FLOW_NETWORK_INTERFACE`で指定し、タブ内のすべてのクライアントノードが引き継ぎます。Modbus、PostgreSQL、メール、TCPリクエスト、UDP出力、HTTPリクエストの各ノードにあります。

READMEに新しいセクションが加わり、`docs/node-red-types.md`は何が動き、どこが違うかを説明し、`docs/compatibility.md`はレジストリから再生成されます。

## 変更点

- 関数ノードでは`Buffer`、`setTimeout`、`setInterval`をあえて使えなくしていて、2つのテストがそれを固定していました。工場の関数が使うので、今は使えます。サンドボックスのそれ以外は変わっていません。`require`も`process`もNodeの標準ライブラリも、引き続きありません。
- フックを設定しないと、アップストリームと同じように動作します。何が変わったかは NOTICE と `HOTLOOP_PATCH.txt` に書かれています。
- 理由は、実際の工場の移行に向けたNode-REDのネイティブなコネクターノードです。

## 新しい設定

- `HOTLOOP_FLOW_UI_PATH`、既定値 `/ui`: ダッシュボードを提供する場所。
- `FLOW_NETWORK_INTERFACE`、タブ、サブフロー、またはプロセスの環境変数: そのタブのクライアントがバインドするインターフェース。既定では空で、これまでどおりホストが選びます。
- 各クライアントノードと設定に**ネットワークインターフェース**フィールド。
- チャートの値 `bindToInterface.netRaw`、既定値 `false`。ソケットをインターフェースにバインドするのに、Linux 5.7 以降では capability は不要です。古いカーネルでは `CAP_NET_RAW` が必要で、これを `true` にすると、その capability だけが Pod に追加され、ほかには何も加わりません。VLAN インターフェースを見るには、Pod にホストのネットワーク(`network.mode: host`)も必要です。

## アップグレード

イメージとチャートの2.9.0への`helm upgrade`を1回実行するか、Quadletユニットのタグを新しいものにします。初回起動では何も起こらず、移行するものもなく、新しいタイプを使っていなかったフローはこれまでどおり動きます。これらのタイプをすでに含むフロー(取り込んだNode-REDファイル)は、以前はそれぞれを未知のノードタイプとして報告していましたが、今は起動します。

## NOTICEとライセンスの変更

NOTICEにModbusライブラリの項目が加わりました。これは今は修正済みのコピーです。イメージに新しいサードパーティのモジュールはありません。

イメージ: `ghcr.io/hotloop-io/hotloop-flow:2.9.0`、まずlinux/amd64で、arm64は2.9.1で続きます。チャート: `https://hotloop.io/hotloop-flow/`。このタグのREADMEに残りが写真つきであります: https://github.com/HotLoop-io/hotloop-flow/blob/v2.9.0/README.md
