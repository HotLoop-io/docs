---
title: "Ghi chú phát hành: HotLoop Cascade 0.1.2"
description: "HotLoop Cascade 0.1.2 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "0.1.2"
---

## Đây là gì

0.1.2 chỉ là bản sửa lỗi build, không có gì khác. Mã nguồn giống 0.1.1, và mọi thứ bạn chạy cũng vậy: chart, các unit Quadlet, cài đặt, cơ sở dữ liệu.

Cascade giờ được build và phát hành hoàn toàn trên Podman, và image chứa đúng amd64 và arm64.

## Nâng cấp từ 0.1.1

Không cần làm gì. `helm upgrade` lên 0.1.2, hoặc để `:stable` di chuyển các unit Quadlet. Không có migration, không có cài đặt mới, và khóa cùng quy trình của bạn vẫn ở nguyên chỗ cũ.
