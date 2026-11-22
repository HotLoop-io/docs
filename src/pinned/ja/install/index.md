---
title: "HotLoop のインストール"
description: "すべての HotLoop 製品のインストール方法:k3s などの Kubernetes 上の Helm、または機器上の Podman Quadlet。stable タグに追従して自動で更新される機器。"
sidebar:
  label: "インストール"
---

HotLoop 製品を本番で動かす方法は 2 つです。k3s など任意の Kubernetes 上で Helm を使うか、クラスターにない機器で Podman と Quadlet を使います。Docker も Compose も使いません。セッションと一緒に消えるシェルからの単発の `podman run` もだめです。試すだけなら素の `podman run` でも構わず、Flow のページにもそう書いてありますが、それはインストールではありません。

## 方法を選ぶ

| 環境 | 使うもの | ページ |
|---|---|---|
| k3s または Kubernetes クラスター | Helm | [k3s と Helm](/ja/install/helm/) |
| クラスターのない Pi、NUC、または小型の産業用 PC | Podman Quadlet | [Podman Quadlet](/ja/install/quadlet/) |
| どちらでも、アップデートの挙動を知りたい場合 | | [:stable の自動アップデート](/ja/install/auto-update/) |

## 今日インストールできるもの

| 製品 | 最新リリース | Helm | Quadlet | はじめに |
|---|---|---|---|---|
| [HotLoop IoT](/ja/iot/overview/) | {{hotloop}} | 可 | 可 | [IoT をインストール](/ja/iot/install/) |
| [HotLoop Edge](/ja/edge/overview/) | {{hotloop}} | 可 | 可 | [Edge をインストール](/ja/edge/install/) |
| [HotLoop Gateway](/ja/gateway/overview/) | {{hotloop}} | 可 | 可 | [Gateway をインストール](/ja/gateway/install/) |
| [HotLoop Edge Relay](/ja/edge-relay/overview/) | {{hotloop}} | 可 | 可 | [Edge Relay をインストール](/ja/edge-relay/install/) |
| [HotLoop Flow](/ja/flow/overview/) | {{flow}} | 可 | 可 | [Flow をインストール](/ja/flow/install/) |
| [HotLoop Cascade](/ja/cascade/overview/) | {{cascade}} | 可、ログイン不要 | 可、ログイン不要, 参照: [Podman Quadlet での Cascade](/ja/cascade/quadlet/) | [Cascade を実行](/ja/cascade/running/) |
| [HotLoop for CODESYS](/ja/codesys/overview/) | {{codesys}} | 可、または EmberCORE App Store | 不可 | [HotLoop for CODESYS をインストール](/ja/codesys/install/) |
| [HotLoop Transmitter](/ja/transmitter/overview/) | 1.1.0 | 不可、CODESYS ライブラリです | 不可、CODESYS ライブラリです | [Transmitter をインストール](/ja/transmitter/install/) |

HotLoop IoT、Edge、Gateway、Edge Relay は 1 つのタグから同時に出るため、同じバージョン番号を共有します。Flow、Cascade、HotLoop for CODESYS、Transmitter はそれぞれ独自のバージョンです。IoT、Edge、Gateway の Quadlet ユニットには Podman 5.0 以降が必要で、リレーのユニットは Podman 4.9.3 で動作確認しました。Raspberry Pi OS Bookworm には Quadlet が全くない 4.3 が入っているので、Pi には Trixie 以降が必要です。

## 実際の工場に入れる前に

- [書き込みゲート](/ja/gateway/write-gate/)を読んでください。どの製品でも同じで、あなたが許可していない機械を何も動かせない理由です。
- Pi の場合、データベースは SD カードではなく USB SSD に置いてください。履歴は毎日一日中書き込まれ、SD カードはまさにそれで壊れます。
- デバイスパスワードのキーをバックアップしてください。データベースにもバックアップにも入っていないので、データの一部です。方法は[バックアップ](/ja/iot/backup/)にあります。
- サイトを上位の製品に上げる前や、リリースをまたいでアップグレードする前にバックアップを取り、機器の外にコピーしてください。
