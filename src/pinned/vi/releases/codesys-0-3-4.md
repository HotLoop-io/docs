---
title: "Ghi chú phát hành HotLoop for CODESYS 0.3.4"
description: "Chart 0.3.4 của HotLoop for CODESYS: bao bọc HotLoop 4.20.1, bản phát hành mang các image đa kiến trúc."
sidebar:
  label: "0.3.4"
---

## Có gì thay đổi

0.3.4 có trong chỉ mục `{{codesysChartRepo}}`, công bố ngày 2026-11-16.

- **Nó bao bọc HotLoop 4.20.1,** bản phát hành mang các image arm mà các tester tải về. Provisioner vẫn ở 0.3.1.

Điều này có nghĩa với bạn: một nút arm64 tải image arm của HotLoop cùng chart, và không gì khác dịch chuyển.

## Đã kiểm tra những gì

Nâng cấp từ 0.3.3 với hồ sơ áp dụng cho 0.3.4, cạnh runtime CODESYS Control for Linux SL 4.22.0.0: một pod mới trên 4.20.1 chạy lên, thiết bị và 44 tag của nó vẫn còn và không tag nào ghi được, trang trả lời, và nhật ký HotLoop không có cảnh báo hay lỗi. Với runtime trên mạng của nút, provisioner đến được nó ở 4840 và runtime từ chối nó như một người dùng ẩn danh, đúng như runtime đó được thiết lập, nên thiết bị riêng của nó vẫn ở trạng thái chờ còn thiết bị lắng nghe và các tag của nó được tạo. Nó đã được chạy trên máy thật (2026-11-17).
