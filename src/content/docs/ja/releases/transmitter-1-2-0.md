---
title: "Transmitter 1.2.0 リリースノート"
description: "HotLoop Alarms がリリースに加わります。PLC 自身のアラームを HotLoop が読む場所に置くライブラリで、パブリッシャーは変わりません。"
---

このリリースは、PLC 自身のアラームを HotLoop が読む場所に置く 2 つ目のライブラリ HotLoop Alarms を追加し、Transmitter を 1.1.0 と同じパブリッシャーのまま 1.2.0.0 として出荷します。

これが意味すること:CODESYS プロジェクトがすでに発生させているアラームが HotLoop のアラーム一覧に表示され、HotLoop で 1 つを確認すると PLC でも確認されます。パブリッシャーだけを使う場合、変更するものはありません。

## 1.1.0 を使うプロジェクトでの変更点

* **HotLoop Alarms 1.0.0.0、新規。** `HotLoopAlarms-1.0.0.0.library` と `.compiled-library` がリリースに含まれます。ブロック `HLAL.FB_HLAL_Alarms` は CODESYS アラームマネージャーのクライアントです。サイクルごとに 1 回呼び出すと、アクティブ、待機中、確認済みのアラームを単純な変数の表(`aAlarms`、64 行)にコピーし、ランタイムの OPC UA サーバーがほかの変数と同じようにエクスポートします。表が変わると `udiChanges` が増え、収まらなかったアクティブなアラームは黙って失われずに `uiDropped` が数えます。生成されるアラームコネクターライブラリは不要で、プロジェクト自身の Alarm Configuration だけが必要です。
* **確認が戻ってきます。** コマンド変数(`uiAckGroupId`、`uiAckAlarmId`、`udiAckInternalId` または `bAckAll`、続いて `udiAckRequest` の新しい番号)に書き込むと、ブロックがアラームマネージャー経由でそのアラーム、またはすべてを確認します。HotLoop 4.23.6 以降は、ブロックの内容からブロックを見つけ、これをすべて代わりに行います。
* **Transmitter のパブリッシャーは変わっていません。** フィールド一覧とワイヤーフォーマットは動かず、`bTimestamp` も従来どおり動作します。ライブラリは 1.2.0.0 として再ビルドされ、`.package` に含まれます。
* **ライセンスは HotLoop Source License Agreement 1.0 です。** すべての HotLoop 製品と同じです。

## 実行したことと結果

すべてラボで、コンテナ内の CODESYS Control for Linux SL 4.22.0.0 に対して行いました。

* Transmitter ライブラリは CODESYS 3.5.22.30 でエラー 0、警告 0 でビルドでき、それに対してビルドしたサンプルアプリケーションも同じです。
* ラボ:パブリッシャー 2 つ、Variant と RawData、それぞれ 114 メッセージをデコード、すべての値が PLC が自身の OPC UA サーバーで報告する値と一致し、シーケンス番号に欠けはなく、すべてのメッセージに両方のタイムスタンプがあり、`bTimestamp := FALSE` では 1.0.0 のバイトと同じでした。独立した OPC UA PubSub 実装が、すべてのメッセージの値とタイムスタンプを読みます。128 件のチェックが通り、失敗はありませんでした。
* HotLoop core の UADP サブスクライバーが、稼働中のランタイムに対して両方のパブリッシャーを読みます。すべての値が一致し、カウンターは両方とも進み、key frame を 62 個受信して拒否されたものはありません。
* `.package` は `PackageManagerCLI --install` でインストールでき、ライブラリが System リポジトリに現れ、サンプルはそれに対してエラー 0、警告 0 でビルドできます。
* HotLoop Alarms:2 つのアラームの Alarm Configuration を持つ実ランタイムで、PLC でのトリップが HotLoop に表示され、HotLoop での確認で PLC の表が時刻つきの確認済みになり、リセットで確定待ちになり、HotLoop での確定で PLC の表が空になります。2 つ目のアラームは逆の順で進み、すべて確認はアクティブな 2 つのアラームを両方確認しました。
* 20 ms タスク、パブリッシャー 2 つ、4 コアに固定した場合のパブリッシャーのコスト:1 サイクルあたり平均約 15 us の追加、最長サイクルは 144 us で、公開スロットの飛ばしも拒否された送信もありませんでした。同じ時間帯に再ビルドした 1.1.0 ライブラリは 15.2 us と 261 us でした。

## 実行しなかったこと

* 実機のコントローラー、Control for Linux SL 4.22.0.0 以外の CODESYS ランタイム、x86-64 以外の CPU。
* 確認して確定を求めるもの以外のアラームクラスでの HotLoop Alarms、または同時に 64 を超えるアクティブなアラームがある場合。
* CODESYS Installer のウィンドウでの `.package`。PackageManagerCLI でヘッドレスにインストールしました。
* リアルタイムクロックが未設定または誤っているコントローラー、マルチキャスト、ネットワークを失って取り戻すランタイム、2 時間のデモ枠の終わり。

## このリリースに含まれないもの

KeepAlive と Delta Frame、1 つの NetworkMessage に複数の DataSetMessage、WSTRING、フィールドごとのステータス、1 秒未満のタイムスタンプ、メッセージのセキュリティ、サブスクライバー側。次に来るものは[ロードマップ](/ja/transmitter/roadmap/)に書いてあります。

## 元に戻す

1.1.0 に固定した PLC プロジェクトは動作を続け、同じバイトを送ります。HotLoop Alarms は別のライブラリなので、追加しないプロジェクトは影響を受けません。

## ファイル

https://hotloop.io/hotloop-transmitter/1.2.0/ からダウンロードし、同じフォルダーの `SHA256SUMS` と照合してください。

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
a404f20fc35c4a3d804aa194f29def3f8193e26e696357899d3ae5b3d44948c1  HotLoopTransmitter-1.2.0.compiled-library
05200d0279ac120fd69d2dc3eeba99d9b40cb76eba2d15d1431b94c5e8f3fc32  HotLoopTransmitter-1.2.0.library
d6b6606a5919e18d2d6d31a5529af4d76bc7058003fb26032ec1a578f78ea57d  HotLoopTransmitter-1.2.0.package
```
