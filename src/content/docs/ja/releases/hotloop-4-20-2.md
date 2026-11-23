---
title: "core 4.20.2 リリースノート"
description: "HotLoop core 4.20.2 の内容、アップグレードで変わる点、稼働中のプラントに触れる前に読んでおくことをまとめています。"
sidebar:
  label: "4.20.2"
---

[4.20.1](/ja/releases/hotloop-4-20-1/) の上の 2 つの修正と、ライセンスです。これは EmberNet Source License 1.0(`LicenseRef-EmberNet-Source-1.0`)のもとでの最初のコアリリースで、LICENSE、NOTICE、README、チャートのアノテーション、イメージのラベルのすべてにそう書かれています。

- **バッチにタグが 2 つ以上ある EtherNet/IP。** ドライバーはライブラリの `ReadMulti` にバッチを求めていましたが、これはタグ付きフィールドの struct か map を受け取り、普通のタグ名を渡すと、1 バイトも出ないうちに reflect で panic します。そのため、バッチにタグが 2 つ以上ある EtherNet/IP デバイスは、ポーリングで panic しました(バッチは既定で 20 です)。どのテストもサーバーに対してバッチを置いたことがなかったため、テストでは誰も気づきませんでした。今は、テストがプロセス内で EtherNet/IP サーバーと S7 サーバーを動かし、ドライバーが TCP でそれらを読み、バッチは `ReadList` を通ります。ソケットが開いたまま黙るコントローラーは、意図したとおり、ポーリング 1 回とそのタイムアウト以内にダウンし、タグごとに再度問い合わせられることはなくなり、タグ 1 つにつきタイムアウト 1 回分ポーリングを止めていたことはなくなりました。S7comm と EtherNet/IP は、まだ物理 PLC では検証されていません。
- **`version` は 1 つの単語です。** `podman run ghcr.io/hotloop-io/hotloop:4.20.1 version` は、設定を読む前に処理されていたのが `--version` だけだったため、「database password is not set」で終了していました。`version` は今は空の環境でもバージョンを表示します。Gateway、Edge、IoT と Edge Relay のすべてが対象です。

- マイグレーション、新しい secret、API の変更はありません。通常の `helm upgrade` か Quadlet の自動更新で取り込まれます。
- 4 つのチャート(`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`)すべてが 4.20.2 で、これまでのすべてのバージョンがインデックスに残っています。
- このビルドは amd64 のみで、`stable` は持っている arm イメージを保ちます。次のリリースは、arm イメージをビルドする小さなバージョンアップです。
