---
title: "core 4.21.1 リリースノート"
description: "HotLoop core 4.21.1 の内容、アップグレードで変わる点、稼働中のプラントに触れる前に読んでおくことをまとめています。"
sidebar:
  label: "4.21.1"
---

これは [4.21.0](/ja/releases/hotloop-4-21-0/) のマルチアーキテクチャビルドです。製品のコードは 4.21.0 と同じで、OPC UA サーバーの X.509 サインイン、72 バイトのパスワード、既定でオフの非推奨セキュリティポリシー、広がった CODESYS アラームインポートです。4.21.0 は amd64 のビルドで、`stable` はすでに持っていた arm イメージを保っていました。

4.21.1 は完全なセットをビルドします。Gateway は amd64 と arm64、Edge、IoT、Edge Relay は amd64、arm64、arm/v7 です。`Basic128Rsa15` と `Basic256` がアップグレードでもオフになることを含め、4.20.2 以降に変わったすべてについては、[4.21.0 のノート](/ja/releases/hotloop-4-21-0/)を読んでください。

- 4 つのチャート(`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`)すべてが 4.21.1 で、これまでのすべてのバージョンがインデックスに残っています。
