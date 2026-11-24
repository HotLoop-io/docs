---
title: "core 4.24.3 リリースノート"
description: "HotLoop core 4.24.3 の内容、アップグレードで変わる点、稼働中のプラントに触れる前に読んでおくことをまとめています。"
sidebar:
  label: "4.24.3"
---

4.24.3 は [4.24.2](/ja/releases/hotloop-4-24-2/) のすべてを、私たちがビルドするすべてのボードに届けます。あらゆる世代の Shelly、ONVIF カメラ、Firmata 経由の Arduino、任意の長さの OPC UA パスワード、低速回線の先で空になる転送キュー、コミットを示す `--version`、起動する標準の HotLoop Edge インストールです。

Gateway は amd64 と arm64 で、Edge、IoT、Edge Relay は amd64、arm64、arm/v7 で動くので、同じリリースでサーバー、Pi、古い ARM ゲートウェイをカバーできます。4.24.0 以降の新機能は [4.24.2 のノート](/ja/releases/hotloop-4-24-2/)をご覧ください。

- 4 つのチャート（`hotloop`、`hotloop-iot`、`hotloop-edge`、`hotloop-edge-relay`）はすべて 4.24.3 で、以前のバージョンもすべてインデックスに残っています。
- いつもどおりにアップグレードしてください。4.24.3 のチャートへの `helm upgrade`、または Quadlet ユニットの新しいタグです。移行は不要です。
