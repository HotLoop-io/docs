---
title: "Migration chỉ thêm vào"
description: "Vì sao một migration không bao giờ xóa, đổi tên hay đổi kiểu thứ gì, để bản cập nhật hỏng có thể quay về bản phát hành trước mà không mất một dòng nào."
---

Một migration thêm vào. Nó không bao giờ xóa, đổi tên hay đổi kiểu bất cứ thứ gì, không bao giờ siết chặt một cột hay ràng buộc mà bản phát hành trước ghi qua, và không bao giờ xóa dữ liệu. Đó là toàn bộ quy tắc, và một bài kiểm thử làm bản dựng thất bại khi một migration vi phạm nó.

## Vì sao

Mỗi hộp theo dõi `:stable` và tính năng tự cập nhật của Podman di chuyển nó. Khi một bản phát hành migrate cơ sở dữ liệu rồi không qua được kiểm tra sức khỏe, bản cập nhật được hoàn tác, và bản phát hành trước khởi động trên lược đồ mà bản mới để lại. Một migration không thể hoàn tác cùng với nó. Vì vậy bản phát hành trước phải chạy được trên lược đồ mới, và cách duy nhất để cam kết điều đó là lược đồ mới chứa mọi thứ lược đồ cũ có, cùng hình dạng, chấp nhận cùng các lần ghi.

Thêm một cột và bản phát hành cũ không bao giờ nhìn tới nó. Xóa một cột và truy vấn đầu tiên của bản phát hành cũ là một lỗi, ở một nhà máy, lúc ba giờ sáng, không còn gì để quay về.

Helm chart có cùng vấn đề: `helm rollback` đặt lại image cũ và để cơ sở dữ liệu ở nơi bản mới đã chuyển nó tới.

## Những thay đổi trông như cần nhiều hơn

Bạn không thể xóa, nên một thay đổi có vẻ cần xóa được thực hiện bằng cách thêm vào rồi để yên thứ cũ.

- **Đổi tên một cột.** Thêm cột mới với giá trị mặc định. Bản phát hành mới đọc cột mới và ghi vào cả hai. Cột cũ ở lại, không dùng, mãi mãi.
- **Đổi kiểu.** Tương tự: một cột mới với kiểu mới, bản phát hành mới ghi vào cả hai, cột cũ ở lại.
- **Một cột nay phải là NOT NULL.** Thực thi nó trong ứng dụng. Nếu thật sự cần một ràng buộc, nó được đặt trên một bảng mới.
- **Ngừng dùng một bảng.** Ngừng sử dụng nó. Nó ở lại.
- **Dọn dữ liệu cũ.** Ứng dụng làm việc đó khi chạy (tính năng lưu giữ đã làm vậy), không phải một migration.

Các cột chết tốn vài byte. Một migration không thể hoàn tác trong khi bản phát hành chứa nó có thể hoàn tác sẽ tốn cả một nhà máy.

## Lớp bảo vệ: ứng dụng từ chối một lược đồ mà nó không thể tin cậy

Thêm vào chỉ an toàn trong một bản phát hành, không phải mãi mãi. Một bản phát hành chỉ được chứng minh trên lược đồ ngay sau nó, nên ứng dụng đếm xem cơ sở dữ liệu đi trước bao xa.

`schema_migrations` ghi lại, bên cạnh mỗi migration, bản phát hành nào đã áp dụng nó (`app_version`). Khi khởi động, trước khi chạm vào bất cứ thứ gì, ứng dụng so sánh các migration trong cơ sở dữ liệu với những cái được tích hợp sẵn trong nó:

| Cơ sở dữ liệu có | Điều xảy ra |
|---|---|
| Không có gì mà bản phát hành này không biết | Khởi động |
| Migration từ một bản phát hành mới hơn | Khởi động, kèm cảnh báo nêu tên cả hai phiên bản. Đây là một bản cập nhật đã bị hoàn tác. Nó không migrate gì cả, và bản phát hành mới hơn thấy lược đồ của mình đã có sẵn khi quay lại |
| Migration từ hai bản phát hành mới hơn trở lên | Từ chối khởi động, nêu tên bản phát hành này, migration mới nhất mà nó biết, migration mới nhất trong cơ sở dữ liệu và các bản phát hành đã ghi chúng |

Thông báo từ chối như sau:

```
refusing to start: this database's schema is more than one release ahead of
HotLoop 4.18.10. 0022_x.sql is the newest migration this release knows, and the
database has 2 it does not (up to 0024_z.sql), written by 4.19.0 and 4.20.0.
Only the release right after this one is known to work on that schema. Start
HotLoop 4.20.0 or newer against this database (an update to :stable gets
there), or restore a backup taken by HotLoop 4.18.10 or earlier
```

Trên một hộp theo dõi `:stable`, bản cập nhật tiếp theo sẽ sửa được, vì `:stable` chuyển sang bản phát hành mới nhất, bản biết mọi migration. Khi đó unit nằm ở trạng thái "activating". Đó là cố ý: một hộp ngừng hoạt động và nói rõ lý do tốt hơn một hộp đang chạy mà sai.

Lớp bảo vệ chạy dù lúc khởi động có migrate hay không (`HOTLOOP_DB_MIGRATE`), và khi khôi phục, vốn mở cơ sở dữ liệu theo cùng cách. Một cơ sở dữ liệu từ trước khi có lớp bảo vệ không có cột `app_version` và không thể chứa migration mới hơn bản phát hành đang đọc nó, nên nó khởi động; cột được thêm vào ở lần khởi động đầu tiên của một bản phát hành có lớp bảo vệ.

## Chứng minh cho một bản phát hành thật

Trước khi một bản phát hành ra mắt, bản phát hành trước được khởi động trên cơ sở dữ liệu mà bản mới đã migrate và buộc phải đăng nhập, đọc thiết bị và tag, ghi qua cổng và đọc lịch sử. Nếu nó không làm được, bản phát hành không ra mắt.
