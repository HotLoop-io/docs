---
title: "Transmitter ロードマップ"
description: "HotLoop Transmitter がすでに実現していること、次に来るもの、そして意図的に予定していないもの。"
---

現在パッケージに入っているもの、次に来るもの、意図的に予定していないものです。ある項目が「リリース済み」に移るのは、実際の 4.22.0.0 ランタイムで動かし、受信側が読み取ったあとだけです。

## 1.1.0 でリリース

* DataSetMessage と NetworkMessage のタイムスタンプを PLC のリアルタイムクロックから取得。既定でオン、`bTimestamp` でオフにできます。
* ライブラリを CODESYS の `.package` として提供し、CODESYS Installer でインストールします。

## 1.0.0 でリリース

* パブリッシャーブロック `FB_HLTX_Publisher` 1 つ。発行間隔ごとに NetworkMessage 1 つ、DataSetMessage 1 つ、Data Key Frame、UDP 上の UADP を SysSocket 上の Structured Text で実現。
* Variant と RawData のフィールドエンコーディング。
* BOOL、SINT、USINT、INT、UINT、DINT、UDINT、LINT、ULINT、REAL、LREAL、STRING、TIME のフィールドと、STRING を除くすべての配列。両方のエンコーディングに対応。
* ユニキャストとマルチキャストの宛先、publisher id、writer group id、dataset writer id、発行間隔、グループバージョン、構成バージョン。すべてブロックの入力で設定します。
* ノンブロッキング送信、呼び出しごとの上限付きコスト、送信数・拒否数・スキップ数のカウンター、そしてアプリケーションをフォールトさせないエラー状態。

## 次の予定

* 1 秒未満のタイムスタンプ。1.1.0 のスタンプはリアルタイムクロックの整数秒です。
* 1 つの NetworkMessage に複数の DataSetMessage (Sizes 配列) を入れ、1 つのデータグラムで複数の writer を運べるようにします。
* ほとんど変化しないデータセットのバイト数を減らす Data Delta Frame と KeepAlive メッセージ。
* WSTRING フィールド。
* フィールドごとのステータス。Bad の値を Bad として送れるようにします。

## 予定していないもの

* メッセージのセキュリティ (署名と暗号化)。ブロックは、工場がすでに信頼しているネットワーク上で平文で送ります。
* 分割された NetworkMessage。1500 バイトのフレームに収まらないメッセージは、分割せず拒否します。
* サブスクライバー側。HotLoop core が UADP を購読し、このライブラリは発行します。
* MQTT トランスポート。UDP は、CODESYS ランタイムが追加のライブラリなしで使える方式です。
