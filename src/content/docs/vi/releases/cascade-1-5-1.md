---
title: "Ghi chú phát hành: HotLoop Cascade 1.5.1"
description: "HotLoop Cascade 1.5.1 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.5.1"
---

## Đây là gì

1.5.1 là 1.5.0 cộng thêm image arm64. Mã nguồn là của 1.5.0, chart chỉ đổi phiên bản của nó, và mọi cài đặt, route, màn hình và công cụ đều là những gì 1.5.0 có, kể cả việc chủ sở hữu xóa một người.

## Vì sao là một bản riêng

Đa kiến trúc ra ở một lần chạy riêng. 1.5.0 chỉ build amd64, và đây là lần nâng phiên bản nhỏ build cả hai. Từ đây `stable`, `latest`, `1.5`, `1` và `1.5.1` đều liệt kê amd64 và arm64.

## Nâng cấp, và quay lại

Không có migration. `helm upgrade` lên 1.5.1, hoặc để `:stable` di chuyển các unit Quadlet. Máy arm64 đã kéo image arm64 mà 1.4.2 phát hành giờ nhận image của 1.5.1. Đặt lại 1.5.0 hoặc 1.4.2 là an toàn, vì không có gì trong cơ sở dữ liệu thay đổi.
