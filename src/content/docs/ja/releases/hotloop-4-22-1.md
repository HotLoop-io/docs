---
title: "core 4.22.1 リリースノート"
description: "HotLoop core 4.22.1 の内容、アップグレードで変わる点、稼働中のプラントに触れる前に読んでおくことをまとめています。"
sidebar:
  label: "4.22.1"
---

これは [4.22.0](/ja/releases/hotloop-4-22-0/) のマルチアーキテクチャビルドです。製品のコードは 4.22.0 と同じで、画面いっぱいに広がるパネルページ、Alarms 画面の Import from CODESYS、共有される OPC UA PubSub ソケット、HotLoop Free Use License 1.0 です。4.22.0 は amd64 のビルドで、`stable` はすでに持っていた arm イメージを保っていました。

4.22.1 は完全なセットをビルドします。Gateway は amd64 と arm64、Edge、IoT、Edge Relay は amd64、arm64、arm/v7 です。4.21.1 以降に変わったすべてについては、[4.22.0 のノート](/ja/releases/hotloop-4-22-0/)を読んでください。

- 4 つのチャート(`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`)すべてが 4.22.1 で、これまでのすべてのバージョンがインデックスに残っています。
