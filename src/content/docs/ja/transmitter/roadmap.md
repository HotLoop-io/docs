---
title: "Transmitter ロードマップ"
description: "HotLoop Transmitter がすでに実現していること、次に来るもの、そして意図的に予定していないもの。"
---

現在パッケージに入っているもの、次に来るもの、意図的に予定していないものです。ある項目が「リリース済み」に移るのは、実際の 4.22.0.0 ランタイムで動かし、受信側が読み取ったあとだけです。

## 1.3.0 でリリース

* 時計の高分解能時刻によるミリ秒単位のタイムスタンプ。`bHighResTimestamp` で整数秒に戻せます。
* Variant と RawData で UTF-8 として送られる WSTRING フィールド(`AddWString`)。
* フィールドごとのステータス。Bad の値を Bad として送れます(`SetStatus`)。
* Sizes 配列を使い、1 つの NetworkMessage に複数の DataSetMessage を載せることで、1 つのデータグラムが複数の writer を運べます(`AddDataSet`)。
* ほとんど変化しないデータセットのバイト数を減らす Data Delta Frame と KeepAlive メッセージ。設定(`bDeltaFrames`)で、既定はオフです。

## 1.2.0 でリリース

* HotLoop Alarms (`alarms/`) は、CODESYS アラームマネージャの有効、待機、確認済みのアラームを単純な変数に読み込み、HotLoop が書き戻す確認応答を実行するライブラリです。実際の 4.22.0.0 ランタイムで実行し、HotLoop のアラーム一覧がこれを読みました。

## 1.1.0 でリリース

* DataSetMessage と NetworkMessage のタイムスタンプを PLC のリアルタイムクロックから取得。既定でオン、`bTimestamp` でオフにできます。
* ライブラリを CODESYS の `.package` として提供し、CODESYS Installer でインストールします。

## 1.0.0 でリリース

* パブリッシャーブロック `FB_HLTX_Publisher` 1 つ。発行間隔ごとに NetworkMessage 1 つ、DataSetMessage 1 つ、Data Key Frame、UDP 上の UADP を SysSocket 上の Structured Text で実現。
* Variant と RawData のフィールドエンコーディング。
* BOOL、SINT、USINT、INT、UINT、DINT、UDINT、LINT、ULINT、REAL、LREAL、STRING、TIME のフィールドと、STRING を除くすべての配列。両方のエンコーディングに対応。
* ユニキャストとマルチキャストの宛先、publisher id、writer group id、dataset writer id、発行間隔、グループバージョン、構成バージョン。すべてブロックの入力で設定します。
* ノンブロッキング送信、呼び出しごとの上限付きコスト、送信数・拒否数・スキップ数のカウンター、そしてアプリケーションをフォールトさせないエラー状態。

## 予定していないもの

* メッセージのセキュリティ (署名と暗号化)。ブロックは、工場がすでに信頼しているネットワーク上で平文で送ります。
* 分割された NetworkMessage。1500 バイトのフレームに収まらないメッセージは、分割せず拒否します。
* サブスクライバー側。HotLoop core が UADP を購読し、このライブラリは発行します。
* MQTT トランスポート。UDP は、CODESYS ランタイムが追加のライブラリなしで使える方式です。
