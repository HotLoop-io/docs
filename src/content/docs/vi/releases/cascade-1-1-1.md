---
title: "Ghi chú phát hành: HotLoop Cascade 1.1.1"
description: "HotLoop Cascade 1.1.1 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.1.1"
---

## Đây là gì

1.1.1 là 1.1.0 cộng thêm image arm64 và một nhãn. Mã nguồn là của 1.1.0, chart chỉ đổi phiên bản của nó, và mọi cài đặt, route và màn hình đều là những gì 1.1.0 có.

Nhãn là `org.opencontainers.image.version`. Image chưa từng mang nhãn này, nên đọc cấu hình của image không thấy phiên bản nào. Giờ nó ghi phiên bản của bản phát hành, lấy từ cùng build argument mà phiên bản của tệp nhị phân lấy.

## Vì sao là một bản riêng

Đa kiến trúc ra ở một lần chạy riêng. 1.1.0 chỉ build amd64, lên sản xuất và được đọc là stable ở đó, và đây là lần nâng phiên bản nhỏ build cả hai. Từ đây `stable`, `latest`, `1.1`, `1` và `1.1.1` đều liệt kê amd64 và arm64.

## Nâng cấp, và quay lại

Không có migration. `helm upgrade` lên 1.1.1, hoặc để `:stable` di chuyển các unit Quadlet. Máy arm64 đã kéo image arm64 mà 1.0.2 phát hành giờ nhận image của 1.1.1. Đặt lại 1.1.0 hoặc 1.0.2 là an toàn, vì không có gì trong cơ sở dữ liệu thay đổi.
