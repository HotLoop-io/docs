---
title: "Ghi chú phát hành: HotLoop Cascade 1.4.0-rc.1"
description: "HotLoop Cascade 1.4.0-rc.1 có gì, điều gì thay đổi khi nâng cấp và nên đọc gì trước khi động vào một nhà máy đang chạy."
sidebar:
  label: "1.4.0-rc.1"
---

Đây là bản ứng viên của 1.4.0. Nó không di chuyển thẻ `stable`, `latest`, `1.4` hay `1` nào và không có trong chỉ mục App Store, nên không gì kéo nó theo mặc định. Đó là mã mà 1.4.0 sẽ phát hành, được kéo về và chạy trên một máy chủ Podman thật trước thẻ thật, và 1.4.0 sẽ là mã này chỉ với chuỗi phiên bản được đổi. Hãy đọc ghi chú của 1.4.0 để biết nó gồm những gì.

## Đây là gì

1.4.0 giúp một bản cài đặt Cascade dễ vận hành lâu dài hơn: máy chủ chờ cơ sở dữ liệu thay vì sập, các lần chạy đã xong có thể được giữ trong một số ngày và dọn cùng tệp của chúng, chủ sở hữu có thể giới hạn tần suất một khóa API gọi, và cả phiên bản có thể sao lưu rồi khôi phục. Nó cũng khép lại bài kiểm tra quy mô duy nhất mà lộ trình còn để mở. Công cụ chạy, định dạng tệp quy trình, REST API, máy chủ MCP (83 công cụ) và 14 ngôn ngữ vẫn như ở 1.3.0.

## Chờ cơ sở dữ liệu

Trong bản cài đặt tách (các pod máy chủ, worker và webhook trên PostgreSQL), các pod từng khởi động trước khi tên cơ sở dữ liệu được phân giải và khởi động lại hai ba lần trước khi sẵn sàng. 1.2.1 và 1.3.0 cũng vậy. Một máy chủ, worker hoặc webhook không kết nối được cơ sở dữ liệu giờ ghi điều đó vào nhật ký ("waiting for the database", kèm thời gian đã chờ) và thử lại tối đa năm phút, rồi kết nối khi cơ sở dữ liệu trả lời. Mật khẩu sai, địa chỉ sai định dạng hoặc cơ sở dữ liệu không tồn tại vẫn làm nó dừng ngay, vì chờ không sửa được những lỗi đó. Startup probe của chart chờ lâu bằng chương trình. Một bản cài đặt tách mới trên k3s thật không có lần khởi động lại nào, trong cả ba lần chạy bài kiểm tra chart.

## Giữ các lần chạy đã xong

Cài đặt có một trường mới, Giữ các lần chạy đã xong trong (ngày), và `PATCH /api/v1/settings` nhận `retentionDays`. Mặc định tắt (0), và mọi lần chạy được giữ như mọi khi. Đặt một số và mỗi giờ một lần một nút chính xóa các lần chạy thành công, thất bại và bị hủy đã kết thúc lâu hơn số đó, cùng dữ liệu các bước của chúng. Một lần chạy đang chạy không bao giờ bị đụng đến, và một lần chạy có cha đang chạy cũng vậy. Mỗi đợt ghi `execution.pruned` vào nhật ký kiểm toán, và đổi cài đặt ghi `instance.retention`.

Cùng lượt chạy hằng giờ đó giờ cũng dọn kho blob, dù bật giữ hay không: các đầu ra quá lớn cho cơ sở dữ liệu và các tệp đính kèm không còn lần chạy nào trỏ tới. Một tệp do hai lần chạy dùng chung nằm lại cho đến khi lần chạy cuối cùng biến mất, và chỉ những tệp được ghi hơn 24 giờ trước mới được xét, nên một tệp mà một bước vừa lưu sẽ không bao giờ bị xóa. Điều này cũng mới đối với các lần chạy bạn xóa tay; trước đây một lần chạy bị xóa để lại các đầu ra lớn của nó trên đĩa mãi mãi. Một lượt không đọc được thứ nó cần sẽ không xóa gì, và mỗi lượt ghi `blobs.collected` vào nhật ký kiểm toán.

## Giới hạn cho từng khóa API

Cài đặt có một trường mới, Số yêu cầu API mỗi khóa mỗi phút, và `PATCH /api/v1/settings` nhận `apiRateLimit`. Mặc định tắt. Đặt một số và mỗi khóa API, cùng mỗi tác tử đăng nhập qua MCP bằng một khóa, được gửi chừng đó yêu cầu mỗi phút. Một lệnh gọi vượt giới hạn nhận 429 kèm `Retry-After`. Mỗi khóa có bộ đếm riêng, và người đăng nhập vào trình soạn thảo không bị giới hạn. Bộ đếm là của từng tiến trình, nên với ba nút chính một khóa có thể gọi gấp ba lần con số đó. Thay đổi nó ghi `instance.api_rate_limit` vào nhật ký kiểm toán.

## Sao lưu và khôi phục

`hotloop-cascade backup DIR` ghi một thư mục mới chứa bản sao nhất quán của cơ sở dữ liệu SQLite lấy khi máy chủ đang chạy, tệp khóa niêm phong mọi thông tin đăng nhập đã lưu, các tệp blob và một `manifest.json` chứa hash của chúng. `hotloop-cascade restore DIR` đưa chúng về chỗ cũ, sau khi kiểm tra từng tệp với manifest, và từ chối ghi đè cơ sở dữ liệu hoặc một khóa khác trừ khi bạn nói `--replace`. Với PostgreSQL, bản sao lưu chứa khóa, blob và manifest, rồi in lệnh `pg_dump` cho phần của cơ sở dữ liệu; khôi phục in lệnh `pg_restore`. Các blob lưu trong S3 hoặc Azure không được sao chép. `docs/GOVERNANCE.md` có chi tiết.

## Các bài kiểm tra đứng sau

- Bài kiểm tra quy mô mà lộ trình đặt ra đã xong. Hai nút chính trên một PostgreSQL chạy một quy trình kích hoạt mỗi phút trong một giờ trong khi một nút bị kill bằng SIGKILL ở ranh giới khung giờ, bảy lần liên tiếp và để ngừng khoảng 25 giây mỗi lần: 61 lần chạy cho 61 khung phút, không lần nào bị sót, không lần nào bị lặp.
- Máy chủ OAuth của bộ kiểm thử (Hydra) giờ chạy trên Postgres. Trước đây nó lỗi khi chạy song song, sau đó qua, và lỗi lại khi thay đổi bị hoàn lại. Không mã Cascade nào kiểm tra token.
- Bài kiểm tra chart giờ lỗi nếu một pod khởi động lại lúc cài đặt.
- Hai thông báo từ chối cài đặt mới được dịch trong mọi ngôn ngữ, và phần trợ giúp cài đặt nói rằng các đầu ra lớn đi cùng các lần chạy của chúng.

## Chỉ amd64, và vì sao

Bản phát hành này chỉ build cho amd64. Đa kiến trúc ra ở một lần chạy riêng, nên bản sau bản này là một lần nâng phiên bản nhỏ build cả hai. `stable`, `latest`, `1.4` và `1` liệt kê image amd64 mới bên cạnh image arm64 mà chúng đã trỏ tới.

## Nâng cấp, và quay lại

Không có migration: lược đồ là của 1.3.0. `helm upgrade` lên 1.4.0, hoặc để `:stable` di chuyển các unit Quadlet. Đặt lại 1.3.1 là an toàn, vì không có gì trong cơ sở dữ liệu thay đổi. Điều rollback không thể hoàn tác là một lần dọn: các lần chạy mà việc giữ đã xóa là mất, và các blob mà lượt dọn hằng giờ đã gỡ cũng vậy. Việc giữ tắt cho đến khi bạn bật, nên hãy sao lưu trước; việc dọn blob chạy mà không cần nó.
