---
title: "CODESYS 0.3.1 リリースノート"
description: "HotLoop for CODESYS チャート 0.3.1:provisioner がリリース名から HotLoop の Service と Secret を見つけるので、どのリリース名でもインストールできます。"
sidebar:
  label: "0.3.1"
---

## 変更点

0.3.1 は 2026-11-05 に `{{codesysChartRepo}}` のインデックスに公開され、[0.3.2](/ja/releases/codesys-0-3-2/) までインストールすべきチャートでした。引き続き HotLoop 4.19.4 をラップし、ログインなしで取得できる provisioner 0.3.0 を実行します。

- **どのリリース名でもインストールできます。** provisioner は、HotLoop 自身のチャートが使う命名、つまりリリース名で、HotLoop の Service とその認証情報 Secret を見つけるようになりました。以前の規則は、名前に `hotloop-codesys` を含まないリリースでは別の名前を推測しており、HotLoop のポッドにはその名前がありませんでした。
- **サンプルプロファイルが正しくなりました。** `example-devices.json` は Variant を RawData の型として挙げなくなりました。そうではないからです。
- **[0.3.0](/ja/releases/codesys-0-3-0/) のすべてがそのまま残っており**、PLC には何も書き込まず、以前のチャートはすべてインデックスに残ります。

これが意味すること:リリースに好きな名前を付ければ、provisioner が話すべき相手を見つけます。

## 確認したこと

チャートはライブのインデックスから Helm でレンダリングでき、ベアメタルで実行しました(2026-11-17)。[現在の状況](/ja/codesys/where-it-stands/)に、何に対して実行したかが書いてあります。
