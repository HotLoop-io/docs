---
title: "Transmitter の API"
description: "HotLoop Transmitter パブリッシャーファンクションブロックのすべての入力、出力、メソッド。"
---

すべて `HLTX` 名前空間にあります。ブロックは `HLTX.FB_HLTX_Publisher` です。

## 入力

| 入力 | 型 | 既定値 | 意味 |
|---|---|---|---|
| `bEnable` | BOOL | FALSE | TRUE でソケットを開いて発行を開始します。FALSE で閉じ、ブロックを `Disabled` に戻し、`ConfigError` も解除します |
| `sDestination` | STRING(15) | `127.0.0.1` | ドット区切りの IPv4 アドレス: ユニキャストのホスト、または 224.0.0.0 から 239.255.255.255 のマルチキャストグループ |
| `uiPort` | UINT | 4840 | 宛先の UDP ポート。4840 は OPC UA が登録しているポートです |
| `sLocalAddress` | STRING(15) | 空 | マルチキャストのみ: 送信に使うインターフェースのアドレス。空なら OS が選びます |
| `usiMulticastTTL` | USINT | 1 | マルチキャストの time to live |
| `uiPublisherId` | UINT | 1 | PublisherId。UInt16 として送信 |
| `uiWriterGroupId` | UINT | 1 | WriterGroupId |
| `uiDataSetWriterId` | UINT | 1 | DataSetWriterId |
| `tPublishingInterval` | TIME | T#100MS | メッセージの間隔。最小 T#1MS。ブロックはサイクルでしか送信できないため、実際の周期は、呼び出すタスクのサイクルの整数倍に切り上げた値になります |
| `eEncoding` | `E_HLTX_Encoding` | `Variant` | `Variant` または `RawData`。無効の間に変更してください |
| `udiGroupVersion` | UDINT | 1 | グループヘッダーの GroupVersion |
| `udiConfigMajor`, `udiConfigMinor` | UDINT | 1, 0 | DataSet の ConfigurationVersion。フィールドリストを変えるたびに major を上げてください |
| `bTimestamp` | BOOL | TRUE | すべてのメッセージに、NetworkMessage と DataSetMessage で PLC の時計のタイムスタンプを付けます (整数秒、[ワイヤー上の内容](/ja/transmitter/wire-format/)を参照)。FALSE なら 1.0.0 と同じバイトを送り、17 バイト短くなります |
| `tRetry` | TIME | T#2S | 連続 10 回の送信に失敗したあと、ソケットを開き直すまでの待ち時間 |

## 出力

| 出力 | 型 | 意味 |
|---|---|---|
| `eState` | `E_HLTX_State` | `Disabled`、`Running`、`Backoff` (ソケットの再オープン待ち)、`ConfigError` (`eError` を参照、何も送信しない) |
| `eError` | `E_HLTX_Error` | `None`, `NoFields`, `BadInterval`, `BadAddress`, `SocketCreate`, `SocketOption`, `TooBig`, `BadField` |
| `bActive` | BOOL | メッセージが出ている間は TRUE |
| `udiSent` | UDINT | ネットワークに渡したメッセージ数 |
| `udiSendErrors` | UDINT | OS が拒否した、または途中で切った送信の数 |
| `udiSkipped` | UDINT | タスクが遅れて逃した発行スロットの数 |
| `uiMessageSize` | UINT | 直前のメッセージのバイト数 |
| `diLastSocketResult` | UDINT | ソケット呼び出しで最後に返ったランタイムのエラーコード。0 は正常 |
| `diLastClockResult` | UDINT | タイムスタンプのために PLC の時計を読んだ最後の結果。0 は正常。0 でないときは、タイムスタンプなしでメッセージが出ます |
| `udiLastCallUs`, `udiMaxCallUs` | UDINT | ブロックの直近の呼び出しで費やしたマイクロ秒と、有効化または `Clear()` 以降で最長の値 |
| `udiMaxEncodeUs`, `udiMaxSendUs` | UDINT | 有効化または `Clear()` 以降で、メッセージ 1 つの組み立てに費やした最長時間と、送信呼び出し自体に費やした最長時間 |

## メソッド

フィールドは最初の呼び出しの前に一度、受信側が読むべき順序で追加します。各メソッドは、フィールドが受け付けられると TRUE を返します。最大 128 フィールドです。

| メソッド | 追加するもの |
|---|---|
| `AddBool(pValue)`, `AddSInt`, `AddUSInt`, `AddInt`, `AddUInt`, `AddDInt`, `AddUDInt`, `AddLInt`, `AddULInt`, `AddReal`, `AddLReal`, `AddTime` | スカラー 1 つ。`pValue` は `ADR(variable)` |
| `AddString(pValue, uiMaxLen)` | STRING 1 つ。`uiMaxLen` は `STRING(N)` の N |
| `AddArray(pFirst, eType, uiCount)` | STRING 以外の任意の型の `uiCount` 要素の配列。`pFirst` は `ADR(array[first])` |
| `AddField(pData, eType, uiCount, uiMaxLen)` | 他のメソッドが呼び出す汎用の形 |
| `Clear()` | フィールドリストと最大呼び出し時間を忘れる |

ブロックは渡されたアドレスを保持するので、変数を移動させるオンライン変更のあとは、`Clear()` を呼んでフィールドを追加し直してください。WORD、DWORD、LWORD は同じサイズのメソッドを通して UINT、UDINT、ULINT として入ります。

## 呼び出し方

インスタンスは 1 つのタスクから、サイクルごとに 1 回呼び出します。1 つのインスタンスを 2 つのタスクから呼び出さないでください。1 つのプログラムに複数のパブリッシャーがあっても問題なく、それぞれが自分のソケットを持ちます。それぞれに固有の writer group id と dataset writer id を与えてください。
