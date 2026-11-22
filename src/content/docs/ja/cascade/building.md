---
title: "Cascadeのビルド"
description: "Cascadeのバイナリとイメージをビルドし、Cascadeが動作するデータベースを選びます。"
---

GoとPodmanが必要です。`make build`でCascadeのバイナリを、`make image`でPodmanによるコンテナイメージをビルドします。エディターはバイナリに組み込まれているため、別途インストールするものはありません。

データベースは設定で決まります。`HOTLOOP_CASCADE_DATABASE`には`sqlite:<path>`（既定。`HOTLOOP_CASCADE_DATA_DIR`の下に作られます）または`postgres://`のURLを指定します。

DockerもComposeも使いません。CascadeはPodman（Quadlet使用）とk3s（Helm使用）向けに提供されます。