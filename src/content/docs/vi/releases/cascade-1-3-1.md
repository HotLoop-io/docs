---
title: "Ghi chú phát hành: HotLoop Cascade 1.3.1"
description: "HotLoop Cascade 1.3.1 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.3.1"
---

## Đây là gì

1.3.1 là 1.3.0 cộng thêm image arm64. Mã nguồn là của 1.3.0, chart chỉ đổi phiên bản của nó, và mọi cài đặt, route, màn hình và công cụ đều là những gì 1.3.0 có.

## Vì sao là một bản riêng

Đa kiến trúc ra ở một lần chạy riêng. 1.3.0 chỉ build amd64, lên sản xuất và được đọc là stable ở đó, và đây là lần nâng phiên bản nhỏ build cả hai. Từ đây `stable`, `latest`, `1.3`, `1` và `1.3.1` đều liệt kê amd64 và arm64.

## Nâng cấp, và quay lại

Không có migration. `helm upgrade` lên 1.3.1, hoặc để `:stable` di chuyển các unit Quadlet. Máy arm64 đã kéo image arm64 mà 1.2.1 phát hành giờ nhận image của 1.3.1, với trình soạn thảo ở 14 ngôn ngữ. Đặt lại 1.3.0 hoặc 1.2.1 là an toàn, vì không có gì trong cơ sở dữ liệu thay đổi.
