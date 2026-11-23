---
title: "Ghi chú phát hành: HotLoop Cascade 1.4.1"
description: "HotLoop Cascade 1.4.1 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.4.1"
---

## Đây là gì

1.4.1 sửa một điều trên trang Cài đặt và dọn các thư mục ngôn ngữ. Công cụ chạy, định dạng tệp, REST API, máy chủ MCP và mọi màn hình khác vẫn như ở 1.4.0.

## Trang Cài đặt giữ lại những gì bạn đã đổi

Mỗi lần Lưu trên trang Cài đặt được trả lời bằng các cài đặt như máy chủ đang có. Nếu bạn đổi một trường sau khi bấm Lưu và trước khi câu trả lời đó quay về, câu trả lời đặt trường về giá trị bạn vừa rời khỏi, không có thông báo nào. Một quản trị viên lưu rồi đổi ngay trường kế tiếp có thể mất thay đổi đó.

Giờ một trường còn giữ nguyên thứ đã gửi sẽ nhận giá trị của máy chủ, còn một trường bạn đã sửa từ đó thì giữ chỉnh sửa của bạn. Một bài kiểm tra trình duyệt giữ câu trả lời lại một giây rưỡi và đổi một trường ở giữa. Trên trang của 1.4.0 nó thất bại (hiện giá trị đầu ở chỗ đã đặt giá trị thứ hai), còn trên trang này nó qua.

## Các thư mục ngôn ngữ

Các danh sách `_review.json` trong mỗi thư mục ngôn ngữ đã bị gỡ, cùng với bước kiểm tra build đọc chúng. Không gì khác đọc chúng, và không có kế hoạch nhờ người bản ngữ xem lại. Các bản dịch là những gì 1.4.0 đã phát hành.

## Chỉ amd64, và vì sao

Bản phát hành này chỉ build cho amd64. Đa kiến trúc ra ở một lần chạy riêng, nên bản sau bản này là một lần nâng phiên bản nhỏ build cả hai. `stable`, `latest`, `1.4` và `1` liệt kê image amd64 mới bên cạnh image arm64 mà chúng đã trỏ tới.

## Nâng cấp, và quay lại

Không có migration: lược đồ là của 1.4.0. `helm upgrade` lên 1.4.1, hoặc để `:stable` di chuyển các unit Quadlet. Đặt lại 1.4.0 là an toàn, vì không có gì trong cơ sở dữ liệu thay đổi.
