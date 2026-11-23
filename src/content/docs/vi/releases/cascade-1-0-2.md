---
title: "Ghi chú phát hành: HotLoop Cascade 1.0.2"
description: "HotLoop Cascade 1.0.2 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.0.2"
---

## Đây là gì

1.0.2 cho phép một quy trình ký và xác minh mà không có bí mật nào nằm trong dữ liệu của mục, và cho phép một biểu mẫu công khai trên website khác gọi webhook từ trình duyệt. Ngoài ra không có gì thay đổi so với 1.0.1.

## Có gì mới trong bước Code

- **Hàm mật mã.** `sha256(text)`, `hmacSHA256(key, text)`, `randomHex(bytes)`, `base64Encode(text)`, `base64Decode(text)` và `safeEqual(a, b)`. Chúng được tính bằng Go, nên kết quả là của thư viện chuẩn, và script vẫn không có `require`, không có mạng và không có tệp.
- **Một thông tin đăng nhập cho bước.** Bước Code có một ô thông tin đăng nhập `secret`. Hãy gán cho nó thông tin đăng nhập `HMAC key` (một loại thông tin đăng nhập tích hợp mới có một trường bí mật duy nhất, `key`) và script đọc nó dưới dạng `credential.key`. Khóa nằm trong kho như mọi bí mật khác, và kho che nó khỏi mọi thứ lần chạy lưu lại, kể cả khi script trả nó về. Một bước không có thông tin đăng nhập thấy một đối tượng `credential` rỗng.

Lý do: một biểu mẫu công khai kiểm tra bằng chứng công việc bằng HMAC. Trước đây, cách duy nhất để làm việc đó trong quy trình là đặt khóa vào một mục hoặc một biến, và cả hai đều rơi vào các lần chạy đã lưu hoặc văn bản thuần. Giờ khóa là một thông tin đăng nhập và lần chạy đã lưu chỉ có chữ ký.

## Có gì mới trên webhook

- **`corsOrigins`.** Một trigger webhook nhận danh sách các origin web (`https://example.com`, hoặc `*`) mà trang của chúng được phép gọi nó từ trình duyệt. Cascade tự trả lời yêu cầu preflight của trình duyệt, không bắt đầu một lần chạy, và thêm `Access-Control-Allow-Origin` vào phản hồi cho origin có trong danh sách. Một webhook không liệt kê origin nào hoạt động y như trước: không có header CORS, nên trang trình duyệt không đọc được phản hồi. Mỗi mục phải là một origin, không có đường dẫn.

## Nâng cấp, và quay lại

Không có migration. `helm upgrade` lên 1.0.2, hoặc để `:stable` di chuyển các unit Quadlet. Các quy trình không bao giờ dùng hàm mới hoạt động y như trước, nên đặt lại 1.0.1 là an toàn với chúng; một quy trình gọi hàm mới sẽ lỗi trên 1.0.1 vì hàm chưa được định nghĩa. Sao lưu trước bất kỳ lần cập nhật nào vẫn là thói quen tốt.
