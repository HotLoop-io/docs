---
title: "CODESYS 0.3.2 リリースノート"
description: "HotLoop for CODESYS チャート 0.3.2:HotLoop 4.19.11 をラップし、HotLoop はポート 8090 を使ってノードのネットワーク上のランタイムの隣で動きます。"
sidebar:
  label: "0.3.2"
---

## 変更点

0.3.2 は 2026-11-15 に `{{codesysChartRepo}}` のインデックスに公開され、実行する provisioner イメージはログインなしで取得できます。PLC には何も書き込みません。

- **HotLoop 4.19.11 をラップし、**provisioner 0.3.1 を実行します。
- **HotLoop のページはポッド内で 8090 で待ち受けます。** ノードのネットワーク上のランタイムがホストポート 8080 を使っており、スケジューラーは HotLoop のページをその隣に置くのを拒みました。Service は 8080 のままなので、App Store のタイルと provisioner は従来どおり HotLoop に届きます。8080 でポッドと直接通信していたものは 8090 に移ります。
- **provisioner は、OPC UA PubSub リスナー 2 つを 1 つの UDP ポートに置くプロファイルを拒否します。** HotLoop はポートを排他的にバインドするので、2 つ目のデバイスは「address already in use」で接続中のままになっていました。今は provisioner が最初にそう伝えます。
- **以前のチャートはすべてインデックスに残ります。**

これが意味すること:ノード自身のネットワーク上の CODESYS ランタイムと HotLoop が、1 つのノードで並んで動きます。

## 確認したこと

チャートはライブのインデックスから Helm でレンダリングでき、ベアメタルで実行しました(2026-11-17)。[現在の状況](/ja/codesys/where-it-stands/)に、何に対して実行したかが書いてあります。
