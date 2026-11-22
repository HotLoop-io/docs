---
title: "ワイヤー上の内容"
description: "HotLoop Transmitter が送る NetworkMessage と DataSetMessage をバイト単位で、それぞれを定める OPC 10000-14 と 10000-6 の節とともに説明します。"
---

以下のすべてのバイトは、2026-10-31 に reference.opcfoundation.org で読んだ OPC 10000-14 (パート 14、PubSub) バージョン 1.05 と OPC 10000-6 (パート 6、マッピング) に基づいています。バイトがおかしく見えたときに開く先が、節番号です。ほかのベンダーのパケットを見て知ったことは、ここには何もありません。

パブリッシャーブロック 1 つが、発行間隔ごとに NetworkMessage 1 つを送ります。NetworkMessage は DataSetMessage 1 つ、つまり Data Key Frame を運ぶので、すべてのメッセージにすべてのフィールドが入ります。1.1.0 以降は、`bTimestamp` が FALSE でない限り、すべてのメッセージが NetworkMessage と DataSetMessage の両方に PLC の時計のタイムスタンプを持ちます。FALSE のときのバイトは 1.0.0 とまったく同じです。表は両方を示し、「タイムスタンプあり」と記した行はタイムスタンプがオンのときだけ存在します。

複数バイトの値はすべてリトルエンディアンです。OPC UA バイナリがそう定義しています。ブロックは 1 バイトずつ書くので、ホストのバイト順は関係ありません。

## NetworkMessage (パート 14、7.2.4.4.2)

| バイト | 値 | 意味 |
|---|---|---|
| 1 | `F1` | ビット 0 から 3 に UADPVersion 1。ビット 4 から 7 に UADPFlags: PublisherId (ビット 4)、GroupHeader (ビット 5)、PayloadHeader (ビット 6)、ExtendedFlags1 (ビット 7) がすべて存在 |
| 1 | タイムスタンプありは `21`、なしは `01` | ExtendedFlags1: ビット 0 から 2 に PublisherId の型 001 = UInt16、タイムスタンプありなら Timestamp (ビット 5)。DataSetClassId、セキュリティヘッダー、PicoSeconds、ExtendedFlags2 はなし |
| 2 | PublisherId | `uiPublisherId` |
| 1 | `0F` | GroupFlags: WriterGroupId、GroupVersion、NetworkMessageNumber、SequenceNumber が存在 |
| 2 | WriterGroupId | `uiWriterGroupId` |
| 4 | GroupVersion | `udiGroupVersion` |
| 2 | NetworkMessageNumber | 常に 1。0 は無効なため |
| 2 | SequenceNumber | 送信したメッセージ数を数え、65535 の次は 0 に戻る |
| 1 | Count | 常に 1 (ペイロードヘッダー、7.2.4.5.2) |
| 2 | DataSetWriterId | `uiDataSetWriterId` |
| 8 | Timestamp、タイムスタンプありのみ | NetworkMessage の Timestamp (7.2.4.4.2)、DateTime (パート 6、5.2.2.5): 1601-01-01 00:00:00 UTC からの 100 ns ティックを Int64 で。ペイロードヘッダーの後、DataSetMessage の前に来る |

Count が 1 なので、ペイロードに Sizes 配列はありません。ブロックは、分割メッセージ、ディスカバリーメッセージ、昇格フィールド、セキュリティヘッダーを送りません。これらのいずれかを必要とする受信側には、このバージョンは対応しません。

## DataSetMessage (パート 14、7.2.4.5.4 と 7.2.4.5.5)

| バイト | 値 | 意味 |
|---|---|---|
| 1 | `69` Variant、`6B` RawData。タイムスタンプありは `E9` と `EB` | DataSetFlags1: 有効 (ビット 0)、フィールドエンコーディング (ビット 1 と 2: 00 Variant、01 RawData)、シーケンス番号 (ビット 3)、ConfigurationVersion の major (ビット 5) と minor (ビット 6)、タイムスタンプありなら DataSetFlags2 (ビット 7)。Status はなし。タイムスタンプなしでは DataSetFlags2 もなく、型は既定の Data Key Frame |
| 1 | `10`、タイムスタンプありのみ | DataSetFlags2: ビット 0 から 3 にメッセージ種別 0 (Data Key Frame)、ビット 4 に Timestamp |
| 2 | DataSetMessage のシーケンス番号 | 送信したメッセージ数を数え、65535 の次は 0 に戻る |
| 8 | Timestamp、タイムスタンプありのみ | DataSetMessage の Timestamp (7.2.4.5.4)。NetworkMessage のものと同じ DateTime で、シーケンス番号の後に来る |
| 4 | ConfigurationVersion の major | `udiConfigMajor` |
| 4 | ConfigurationVersion の minor | `udiConfigMinor` |
| 2 | FieldCount | Variant のみ。RawData では省略 (7.2.4.5.5) |
| ... | フィールド | 追加した順 |

## タイムスタンプ

ブロックはメッセージごとに 1 回、`SysTimeRtcGet` (ランタイムが提供する SysTimeRtc システムライブラリ) で PLC のリアルタイムクロックを読みます。これは 1970-01-01 UTC からの整数秒で、ブロックは `(seconds + 11644473600) * 10000000` を DateTime として書きます。メッセージ内の 2 つのタイムスタンプは、この同じ値です。ここから 2 つのことが言えます。

* 分解能は 1 秒です。受信側は、同じ 1 秒の間は全メッセージで同じタイムスタンプを見ることになり、メッセージを組み立てた瞬間より最大 1 秒遅れます。1 秒未満のタイムスタンプはロードマップにあります。
* 時刻は PLC の時計の正確さまでです。時計が未設定のコントローラは、メッセージに 1970 年を付けます。時計を読めない場合 (`diLastClockResult` が 0 でない場合)、メッセージを出さないのではなく、パート 14 が認めているとおりタイムスタンプなしで出します。

フィールドリストを変えるたびに `udiConfigMajor` を上げてください。バージョンをキーにレイアウトを保持している受信側は、別のリスト用に作られたメッセージを誤ってデコードするのではなく、拒否できます。

## フィールド、Variant エンコーディング (パート 6、5.2.2.16)

各フィールドは EncodingMask バイト 1 つと、それに続く値です。マスクのビット 0 から 5 は組み込み型の id (パート 6、5.1.2、表 1)、ビット 7 は値が配列であることを示し、その場合は要素の前に Int32 の要素数が来ます。

| PLC の型 | 型 id | 値のバイト |
|---|---|---|
| BOOL | 1 Boolean | 1、`00` または `01` |
| SINT | 2 SByte | 1 |
| USINT, BYTE | 3 Byte | 1 |
| INT | 4 Int16 | 2 |
| UINT, WORD | 5 UInt16 | 2 |
| DINT | 6 Int32 | 4 |
| UDINT, DWORD | 7 UInt32 | 4 |
| LINT | 8 Int64 | 8 |
| ULINT, LWORD | 9 UInt64 | 8 |
| REAL | 10 Float | 4、IEEE 754 |
| LREAL | 11 Double | 8、IEEE 754 |
| STRING | 12 String | バイト単位の Int32 長、続いて UTF-8 (5.2.2.4) |
| TIME | 7 UInt32 | ミリ秒。CODESYS の TIME はこう保持されます |

CODESYS の STRING は 1 文字 1 バイトです。`7F` までのバイトは ASCII でそのまま出ます。`7F` を超えるバイトは ISO 8859-1 として読み、2 バイトの UTF-8 形式で書きます。これは PLC のコードページについての仮定で、ブロックがテキストを解釈する唯一の箇所です。

## フィールド、RawData エンコーディング (パート 14、7.2.4.5.11)

マスクも数もありません。各フィールドは順番に並んだ値そのものなので、受信側はレイアウトを知っている必要があります。パート 14 はフィールドを "handled like a Structure DataType" とするので、各値はパート 6 で Structure のフィールドをエンコードするのと同じ方法でエンコードされます。

* **スカラー**は、Variant の表と同じ値のバイトで、マスクはありません。
* **配列**は Int32 の要素数と、それに続く要素です (パート 6、5.2.5: "One dimensional Arrays are encoded as a sequence of elements preceded by the number of elements encoded as an Int32 value")。ブロックは渡された要素を常にすべて送るので、数は配列の宣言サイズと等しく、後ろにパディングはありません。
* **文字列**はバイト単位の Int32 長と UTF-8 のバイト列、続いて MaxStringLength までのゼロバイトなので、フィールドは常に 4 + MaxStringLength バイトです (7.2.4.5.11: "the field shall be padded with bytes with value zero")。ブロックは `STRING(N)` の N をバイト単位の MaxStringLength として使います。それより長いテキストは、フィールドが伸びられないため文字の境界で切り詰められます。受信側のフィールドメタデータには、同じ MaxStringLength と、配列ごとの ArrayDimensions エントリが必要です。

これは OPC Foundation 自身の参照スタックでの解釈です。UA-.NETStandard (コミット `fcfc84eab5c105780d7268474a47d344d100aca1`) の `src/Opc.Ua.PubSub/Encoding/Uadp/UadpBinaryReader.cs` の 389 行から 403 行は、文字列を "read like a Structure field (Int32 length prefix and value) from a fixed-size 4 + MaxStringLength byte block whose remainder is zero padding" と述べ、配列については "the array's Part 6 length (or dimensions) prefix gives the actual element count and the block is padded to product(arrayDimensions) elements" と述べています。593 行から 648 行の `TryReadPaddedArray` がそれを実装し、`tests/Opc.Ua.PubSub.Tests/Encoding/Uadp/UadpRawDataPaddingTests.cs` がそれを検証しています。残りは[検証のページ](/ja/transmitter/proof/)にあります。

## サイズ

ブロックは 1472 バイトのバッファにメッセージを組み立てます。イーサネットのペイロード 1500 バイトから IP の 20 バイトと UDP の 8 バイトを引いた値で、メッセージが断片化することはありません。収まらないフィールドリストは、ブロックをエラー `TooBig` で `ConfigError` にし、切り詰めはしません。Variant エンコーディングで 250 要素の REAL 配列は 1005 バイトなので、その配列とヘッダーのメッセージは収まり、2 つは収まりません。
