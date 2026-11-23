---
title: "CODESYS 0.3.8 发布说明"
description: "HotLoop for CODESYS chart 0.3.8:它运行的 provisioner 镜像是 0.3.3,为 amd64 和 arm64 构建。"
sidebar:
  label: "0.3.8"
---

## 变更内容

0.3.8 在索引 `{{codesysChartRepo}}` 中,发布于 2026-11-19。

- **它运行 provisioner 0.3.3,** 这是第一个为 amd64 和 arm64 构建的 provisioner 镜像,所以该 chart 可以安装在 arm64 节点上。
- **其他都没变。** 模板、值以及它封装的 HotLoop(4.22.0)都与 [0.3.7](/zh-hans/releases/codesys-0-3-7/) 相同。

这对您意味着什么:请安装这个。在 amd64 节点上没有任何不同。

## 检查了什么

已发布 chart 的值读取 provisioner 0.3.3 和 HotLoop 4.22.0,0.3.3 镜像的索引列出了 amd64 和 arm64。由于只有镜像标签变了,这个版本没有在集群上重新安装该 chart。
