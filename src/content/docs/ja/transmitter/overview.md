---
title: "HotLoop Transmitter の概要"
description: "SysSocket UDP 上の Structured Text で書かれた CODESYS ライブラリ。他のライブラリや設定ツールなしで PLC の値を OPC UA PubSub (UADP) で発行します。"
---

HotLoop Transmitter は、CODESYS プロジェクトに組み込むライブラリから、OPC UA 仕様のパート 14 が定める方法のとおりに PLC の値を OPC UA PubSub としてネットワークに送り出します。計装ループでいうトランスミッターと同じ役目です。プロセス値を線路に乗せ、ほかの機器が読めるようにする部分です。

`SysSocket` UDP 上の Structured Text で書かれており、ほかのライブラリも追加ライセンスも設定ツールも要りません。ライブラリを追加し、サイクルごとにファンクションブロックを 1 回呼ぶだけで、発行間隔ごとに UADP NetworkMessage がユニキャストアドレスまたはマルチキャストグループへ出ていきます。

つまり、PubSub ライブラリを持たない PLC でも、数行の Structured Text で、OPC UA PubSub を購読するあらゆるもの、HotLoop 自体も含めてデータを供給できます。各メッセージには PLC の時計によるタイムスタンプが付きます。`bTimestamp` で切ることもできます。

## Go ではなく Structured Text な理由

HotLoop の新しいツールは、確かな理由がない限りすべて Go で書きます。これがその確かな理由です。このライブラリは PLC 自身のスキャンの中、IEC 61131-3 ランタイムの中で、プログラマーがプロジェクトから参照するライブラリとして動く必要があります。CODESYS ランタイムが実行するのは Go ではなく Structured Text です。ライブラリの周りのテストやツール(キャプチャツール、検証ツール)は Go です。

## 使い方

1. `HotLoopTransmitter-1.1.0.library` を CODESYS のライブラリリポジトリにインストールするか (Tools, Library Repository, Install)、CODESYS Installer で `HotLoopTransmitter-1.1.0.package` をインストールし、プロジェクトの Library Manager に追加します。ダウンロードと詳細は[インストールのページ](/ja/transmitter/install/)にあります。
2. パブリッシャーを宣言し、発行したい変数を起動時に一度だけ追加して、毎サイクル呼び出します。

```iecst
PROGRAM PLC_PRG
VAR
    pub : HLTX.FB_HLTX_Publisher;
    bInit : BOOL;
END_VAR

IF NOT bInit THEN
    bInit := TRUE;
    pub.sDestination := '239.0.0.22';        // a unicast host or a multicast group
    pub.uiPort := 4840;
    pub.uiPublisherId := 1;
    pub.uiWriterGroupId := 1;
    pub.uiDataSetWriterId := 1;
    pub.tPublishingInterval := T#100MS;
    pub.AddReal(ADR(GVL.rTemperature));
    pub.AddBool(ADR(GVL.bRunning));
    pub.AddArray(ADR(GVL.aValues), HLTX.E_HLTX_Type.REAL_T, 250);
END_IF
pub.bEnable := TRUE;
pub();
```

[API のページ](/ja/transmitter/api/)には、すべての入力、出力、メソッドが載っています。[ワイヤーフォーマットのページ](/ja/transmitter/wire-format/)は、パケットをバイト単位で示し、各バイトを定める仕様の節も挙げています。

## スキャンに対してすること、しないこと

* ブロックしません。ソケットはノンブロッキングで、メッセージは固定バッファの中で組み立てます。
* 呼び出しのコストはメッセージ 1 つを組み立てるコストで、メッセージが出るサイクルでだけ発生します。パブリッシャー 2 つ、タイムスタンプありの 20 ms タスクで測ると、1 サイクルあたり平均約 9.6 us の増加、送信するサイクルで 10 から 100 us、実行中で最長のサイクルは 81 us でした。負荷の高いホストでは、1 回の送信が数ミリ秒に伸びたことがあります。測定値とその限界は[タイミングのページ](/ja/transmitter/timing/)にあります。
* ソケットエラー、不正なアドレス、大きすぎるフィールドリストでアプリケーションがフォールトすることはありません。ブロックは `eState` と `eError` を報告し、失敗を数え、プログラムはスキャンを続けます。
* フラグメント化しません。メッセージは最大 1472 バイトです。収まらないフィールドリストの場合、ブロックは `ConfigError` になり、何も送りません。

## テスト環境

CODESYS Control for Linux SL 4.22.0.0 ランタイム、およびベアメタル (2026-11-17)。何を実行し何を読み戻したかは、[タイミングのページ](/ja/transmitter/timing/)と[検証のページ](/ja/transmitter/proof/)をご覧ください。

工場で使いますか。[ビジネスでの HotLoop の利用](/ja/business/)で、ライセンスと連絡方法を説明しています。

## ライセンス

すべての HotLoop 製品と同じ HotLoop Source License Agreement 1.0 です。無料で使え、ソースは公開されていますが、OSI の定義によるオープンソースではありません。第 5 条により、ライブラリを自社の PLC プロジェクトに組み込み、コンパイル済みの成果物を納品または販売できます。ライブラリそのものは対象外です。全文は[ライセンスのページ](https://hotloop.io/license/)にあります。
