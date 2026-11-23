---
title: "core 4.20.1 リリースノート"
description: "HotLoop core 4.20.1 の内容、アップグレードで変わる点、稼働中のプラントに触れる前に読んでおくことをまとめています。"
sidebar:
  label: "4.20.1"
---

これは [4.20.0](/ja/releases/hotloop-4-20-0/) のマルチアーキテクチャビルドです。製品のコードは 4.20.0 と同じで、`/` の新しい Web UI と、設定を変更する MCP ツールです。4.20.0 は amd64 のビルドで、`stable` はすでに持っていた arm イメージを保っていました。

4.20.1 は完全なセットをビルドします。Gateway は amd64 と arm64、Edge、IoT、Edge Relay は amd64、arm64、arm/v7 です。4.19.11 以降に変わったすべてについては、[4.20.0 のノート](/ja/releases/hotloop-4-20-0/)を読んでください。

- 4 つのチャート(`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`)すべてが 4.20.1 で、これまでのすべてのバージョンがインデックスに残っています。
