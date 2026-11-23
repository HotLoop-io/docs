---
title: "Flow 2.7.1 リリースノート"
description: "HotLoop Flow 2.7.1 の内容、アップグレード時の変更点、稼働中のプラントに触れる前に読むべきこと。"
sidebar:
  label: "2.7.1"
---

HotLoop Flow 2.7.1は、2.7.0にarm64イメージを加えただけで、ほかはありません。2.7.0は、先に本番に届いて安定版として表示されるようamd64のみで出ましたが、今回は両方をビルドする小さな続きのリリースです。コード、チャート、設定、お使いのフローは変わりません。

## 変更点

- イメージが再び linux/amd64 と linux/arm64 の両方でビルドされます。`2.7.1`、`2.7`、`2` のタグは両方を持ちます。
- READMEとインストールページは2.7.1を示し、2.7.0より前と同じようにamd64とarm64を案内しています。

## 新しい設定

ありません。

## アップグレード

2.7.1 のイメージとチャートへの単純な `helm upgrade`、または Quadlet ユニットの新しいタグです。arm64 で、2.7.0 が amd64 のみだった間 2.6.0 にとどまっていたなら、これが FlowLab へ移るときです。2.7.0 のノートで、それが何で、まだ何ではないかを読んでください。初回起動で起きることはなく、移行も不要です。

イメージ: `ghcr.io/hotloop-io/hotloop-flow:2.7.1`、linux/amd64およびlinux/arm64。Chart: `https://hotloop.io/hotloop-flow/`。このタグのREADMEに残りが図つきであります: https://github.com/HotLoop-io/hotloop-flow/blob/v2.7.1/README.md
