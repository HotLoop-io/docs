---
title: "Transmitter 1.3.0 リリースノート"
description: "ミリ秒のタイムスタンプ、WSTRING フィールド、フィールドごとのステータス、1 つの NetworkMessage に複数の DataSet、KeepAlive 付きデルタフレーム(既定でオフ)。"
---

HotLoop Transmitter は、CODESYS プロジェクトに入れるライブラリから、PLC の値を OPC UA PubSub としてネットワークに出します。1.3.0 では、ミリ秒単位のタイムスタンプ、WSTRING フィールド、不良な値が不良として出るようにするフィールドごとのステータス、1 つの NetworkMessage 内の複数の DataSet、そして KeepAlive メッセージ付きの Data Delta Frame が加わります。ライブラリは 1.3.0.0 で、HotLoop Alarms 1.0.0.0 は変更なしで付属します。

これが意味すること: すでに 1.2.0 を使っている PLC プロジェクトは、以前と同じバイト列を送ります。目に見える違いは 1 つ、タイムスタンプにミリ秒が付くことです。ほかはすべて、呼び出しか入力で有効にするものです。

## 新機能

* **ミリ秒単位のタイムスタンプ。** NetworkMessage と DataSetMessage の両方が時計のミリ秒を持つので、サブスクライバーは各メッセージが属する秒ではなく、作られた時刻を見られます。`bStampHighRes` は直近のメッセージがどちらの時計を使ったかを示します。
* **WSTRING フィールド。** `AddWString(ADR(wName), N)` は `WSTRING(N)` を OPC UA String として、Variant と RawData で公開します。テキストは UTF-8 で出ます。PLC ではサロゲートペアである U+FFFF より上の文字は 4 バイトの 1 文字として、対のないサロゲートは U+FFFD として出るので、サブスクライバーが読むのは常に有効なテキストです。RawData ではフィールドの MaxStringLength は `3 * N` バイトです。
* **フィールドごとのステータス。** フィールドを追加したら、`SetStatus(ADR(udiStatus))` で OPC UA StatusCode を保持する UDINT に結びつけます。その変数が 0 でない間、フィールドは値の代わりに StatusCode として出て、サブスクライバーは不良品質として読みます。0 に戻せば再び値が出ます。RawData にはステータスを運ぶ手段がないので、RawData パブリッシャーは値を送り続けます。
* **1 つの NetworkMessage 内の複数の DataSet。** `AddDataSet(uiWriterId, udiConfigMajor)` は同じブロック内にもう 1 つ DataSet を始めます。以降に追加するフィールドはその DataSet に属します。パブリッシュ間隔ごとに 1 つの NetworkMessage が DataSet ごとに 1 つの DataSetMessage を、Part 14 が求める Sizes 配列と共に運び、複数の writer が 1 つのデータグラムを共有します。DataSet は最大 8 個です。一度も呼ばなければ、メッセージは 1.2.0 が送っていたものと同じです。
* **Data Delta Frame と KeepAlive。** 安定したデータセットは、もう毎周期すべてのフィールドを送る必要はありません。デルタフレームをオンにすると、パブリッシャーはまず完全なキーフレームを送り、以降 `uiKeyFrameEvery` メッセージごとにキーフレームを、その間は変化したフィールドだけの Data Delta Frame を、何も変わらなければ KeepAlive を送ります。`bDeltaActive`、`udiDeltaSent`、`udiKeepAliveSent` で状況が分かります。

## 1.2.0 を使うプロジェクトでの変更点

* フィールドリストとワイヤフォーマットは変わっていません。ワイヤ上の違いは、タイムスタンプのミリ秒の部分だけです。
* HotLoop Alarms 1.0.0.0 は変更なしでリリースに含まれます。

## 設定と既定値

* `bHighResTimestamp` は `TRUE` です。時計のミリ秒でスタンプします。`FALSE` にすると 1.2.0 とまったく同じ整数秒でスタンプします。ランタイムがミリ秒を返せない場合、ブロックは自動的に整数秒でスタンプします。
* `bDeltaFrames` は `FALSE` です。デルタフレームはパブリッシャーでオンにする設定であり、ブロックが勝手にするものではないので、お持ちのすべてのサブスクライバーはこれまでどおり完全なキーフレームを読みます。ある writer でオンにするには、そのパブリッシャーに `bDeltaFrames := TRUE` を設定し、キーフレームの間隔を変えたければ `uiKeyFrameEvery`(設定しなければ 10)を設定します。各パブリッシャーが自分で決めるので、ある writer がデルタを送り、ほかは送らない、ということもできます。デルタフレームを捨てるサブスクライバーは次のキーフレームで変化を見ることになるため、デルタフレームを読むサブスクライバー向けにオンにしてください。DataSet が 1 つの Variant パブリッシャーに適用され、RawData パブリッシャーや DataSet が 2 つ以上のブロックはキーフレームを送ります。
* `AddDataSet`、`AddWString`、`SetStatus` は、ほかの `Add` 呼び出しと同じく、起動時に 1 回行う呼び出しです。これらがなければ何も変わりません。

## アップグレード

`HotLoopTransmitter-1.3.0.library` をインストールし(または CODESYS Installer で `.package` を開き)、プロジェクトの Library Manager でライブラリのバージョンを 1.3.0.0 に変えてコンパイルします。コードを変える必要はありません。新しい呼び出しは、その機能が必要になったときに加えてください。

## 元に戻す

1.2.0 に固定したプロジェクトはそのまま動き、以前と同じバイト列を整数秒のタイムスタンプで送ります。HotLoop Alarms は別のライブラリで、影響を受けません。

## このリリースに含まれないもの

メッセージセキュリティ、分割された NetworkMessage、サブスクライバー側、MQTT トランスポート。

## ファイル

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
5be90a88e9e0aae1de421628fb6ca8e810dda96b4562566df345d451ecd859cf  HotLoopTransmitter-1.3.0.compiled-library
0410b98578fd55775a97b27023a0b5f30111cac0587120894354d9edca1248fc  HotLoopTransmitter-1.3.0.library
3e791358e6dc628a2d2aae760e0c49c89f1c4490f0637b65864c335fcbb3e9a0  HotLoopTransmitter-1.3.0.package
```
