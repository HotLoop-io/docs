---
title: "Đẩy tới các trạm của một tenant"
description: "Một tệp luồng và các sơ đồ FlowLab của nó tới mọi bản cài Flow của tenant, từng trạm một, kiểm tra sau mỗi trạm và hoàn tác trạm nào hỏng."
---

Một tenant trong EmberNet có thể chạy nhiều bản cài HotLoop Flow, mỗi nhà máy hoặc dây chuyền một bản. Chúng tôi gọi mỗi bản là một trạm. Trang này nói về việc đặt một tệp luồng, và do đó một bộ sơ đồ FlowLab, lên tất cả các trạm, kiểm tra từng trạm và đưa một trạm về trạng thái cũ nếu nó hỏng.

Tóm tắt: `hotloop-flow stations push -tenant acme -file flows.json` đẩy tới các trạm mà EmberNet hiển thị là đang chạy cho `acme`, từng trạm một. Nếu sau đó một trạm không ổn, trạm đó quay về những gì nó có và việc đẩy dừng lại. Nếu tệp sẽ khởi động lại một logger đang chạy, sẽ không có gì xảy ra cho đến khi bạn nói rằng được phép.

## Các trạm đến từ đâu

Không ai gõ vào một trạm. Danh sách là những gì bảng điều khiển EmberNet hiển thị là đang chạy cho tenant, cùng danh sách với trang Running Apps của nó: mọi ứng dụng có nhãn `hotloop-flow` đang chạy và thuộc về tenant. Trạm được truy cập qua địa chỉ Flux khi bảng điều khiển báo có địa chỉ đó, và qua địa chỉ cluster nếu không, nên hãy chạy việc đẩy từ nơi phân giải được địa chỉ này.

Tenant luôn được nêu tên, và một lần đẩy luôn chỉ dành cho đúng tenant đó. Bảng điều khiển được hỏi bằng token bảng điều khiển của bạn và giới hạn bạn trong các tenant bạn được xem, và chúng tôi kiểm tra lại câu trả lời: một dòng đến cho tenant khác bị loại bỏ và được đếm, không bao giờ được dùng. Tenant không có Flow nào đang chạy sẽ trả lời bằng một lỗi.

## Lệnh

```bash
hotloop-flow stations list -tenant acme
hotloop-flow stations push -tenant acme -file flows.json -note "new line 3 logger"
```

Địa chỉ bảng điều khiển lấy từ `-dashboard` hoặc `HOTLOOP_FLOW_DASHBOARD_URL`, và token của nó từ `-dashboard-token-file` hoặc `HOTLOOP_FLOW_DASHBOARD_TOKEN`. Token mà các trạm chấp nhận lấy từ `-token-file` hoặc `HOTLOOP_FLOW_TOKEN`, như với `hotloop-flow deploy`. Tạo nó bằng `hotloop-flow token`, và cấp cho mỗi trạm token đó dưới dạng token API có `flows.read`, `flows.write` và `status.read` (token triển khai thông thường chỉ có hai quyền đầu): bước kiểm tra cần đọc các sơ đồ của từng trạm, và token triển khai thông thường không làm được. Các trạm của một tenant dùng cùng một token.

| Cờ | Chức năng |
|---|---|
| `-dry-run` | Lập kế hoạch cho mọi trạm và không thay đổi trạm nào. Hiển thị những gì đang chạy, mỗi trạm sẽ khởi động lại gì và những trạm nào không lập kế hoạch được. |
| `-confirm-restart` | Bạn đồng ý rằng các logger đang chạy có thể bị khởi động lại bởi lần đẩy này. |
| `-window 02:00-04:00` | Các giờ mà việc khởi động lại đã được đồng ý trước, trong `-window-zone` (tên IANA, UTC nếu bỏ trống). Một lần đẩy trong khung giờ này sẽ tiến hành. Khung có thể qua nửa đêm, `22:00-02:00`. |
| `-settle 5s` | Thời gian các sơ đồ của một trạm có để khởi động trước khi bước kiểm tra coi chúng là không chạy. |
| `-json` | Báo cáo dưới dạng JSON. |

Mã thoát 0 là mọi trạm đã xong. 3 là một trạm hỏng và việc đẩy đã dừng. 4 là việc đẩy đang chờ bạn đồng ý các lần khởi động lại. 5 là các trạm bị bỏ qua vì không trả lời hoặc không lập kế hoạch được.

## Một lần đẩy làm gì

Trước hết nó lập kế hoạch cho mọi trạm mà không thay đổi trạm nào. Với mỗi trạm, nó đọc tệp luồng đang chạy và bản sửa đổi, tìm bản ghi triển khai mà trạm có thể quay về, liệt kê các sơ đồ và tính xem tệp sẽ khởi động lại logger nào đang chạy. Sau đó, nếu không có gì cần một lời đồng ý, nó đi từng trạm một theo thứ tự tên.

1. **Triển khai** tệp với bản sửa đổi mà kế hoạch đã thấy, nhờ vậy một lần triển khai ai đó làm ở giữa sẽ bị từ chối thay vì bị ghi đè. Chỉ phần đã thay đổi mới khởi động lại. Thông tin xác thực không bao giờ di chuyển: mỗi trạm giữ mật khẩu riêng, và việc ghi của một thiết bị đo vẫn tắt cho đến khi ai đó ở trạm đó bật lên.
2. **Kiểm tra.** Trạm phải trả lời bằng bản sửa đổi mà mọi trạm đều phải có. Bản sửa đổi được lấy từ nội dung tệp, nên cùng một tệp là cùng một bản sửa đổi ở mọi nơi, và việc đẩy nói nó là gì trước khi bắt đầu. Mọi sơ đồ trong tệp tự khởi động phải có trên trạm, không có vấn đề, và đang chạy hoặc đã xong trong thời gian ổn định. Một nút không khởi động cũng làm bước kiểm tra thất bại.
3. **Trạm không qua bước kiểm tra sẽ quay lại.** Nó được hoàn tác về lần triển khai trước đó, như một lần triển khai riêng, và được kiểm tra là đã trở lại bản sửa đổi cũ. Việc đẩy dừng ở đó.

Báo cáo cho biết điều gì đã xảy ra với từng trạm:

| Trạng thái | Ý nghĩa |
|---|---|
| `done` | Đã triển khai và qua bước kiểm tra. |
| `unchanged` | Đã ở bản sửa đổi này, và các sơ đồ của nó đúng như yêu cầu. |
| `failed` | Chưa triển khai (trạm từ chối, hoặc ai đó đã triển khai ở giữa), hoặc đã ở bản sửa đổi này và chưa ổn. Không có gì bị thay đổi. |
| `reverted` | Không qua bước kiểm tra và đã trở về bản sửa đổi nó từng có. |
| `revert-failed` | Không qua bước kiểm tra và không thể hoàn tác. Trạm này cần một con người. |
| `skipped` | Không bị đụng tới. Nó không trả lời, hoặc không có bản ghi triển khai của bản sửa đổi đang chạy, nên một lần đẩy thất bại không thể được hoàn tác ở đó. Hãy triển khai tới nó một lần bằng tay, hoặc sửa đường liên kết, rồi đẩy lại. |
| `not-started` | Việc đẩy đã dừng trước trạm này. Nó vẫn như cũ. |
| `planned` | Câu trả lời của một lần chạy thử. |

Các trạm bị bỏ qua không làm việc đẩy dừng lại. Một lần đẩy có thể lặp lại: một trạm đã ở bản sửa đổi là `unchanged`, nên lần đẩy thứ hai chỉ hoàn tất những gì lần đầu chưa làm.

## Khởi động lại

Một sơ đồ tự khởi động là một logger. Triển khai một sơ đồ đã thay đổi sẽ khởi động lại nó, và một sơ đồ bị gỡ sẽ dừng. Một lần đẩy sẽ làm vậy với một logger đang chạy sẽ dừng trước khi đụng tới bất cứ thứ gì, và báo cáo nêu tên từng trạm và từng logger. Sau đó một trong ba điều cho phép nó tiếp tục:

- bạn trả lời có ở dấu nhắc, khi lệnh được chạy trong terminal;
- bạn truyền `-confirm-restart`;
- thời điểm nằm trong khung giờ bạn đã cho bằng `-window`.

Không gì khởi động lại nếu thiếu một trong số đó. Một sơ đồ không thay đổi giữ nguyên lượt chạy của nó, và một sơ đồ mới thì chỉ khởi động.

## Từ một instance, và cho một tác nhân

Một instance có thể đẩy tới các trạm của tenant của chính nó qua API quản trị, cũng là thứ các công cụ MCP `list_stations` và `push_to_stations` dùng. Đặt cả bốn mục sau, trong tệp cấu hình dưới `stations:` hoặc qua biến môi trường, và các tuyến `GET /stations` và `POST /stations/push` sẽ xuất hiện. Không có chúng thì các tuyến này không tồn tại.

| Cài đặt | Biến môi trường | Là gì |
|---|---|---|
| `stations.dashboardUrl` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_URL` | Bảng điều khiển EmberNet biết các bản cài của tenant. |
| `stations.tenant` | `HOTLOOP_FLOW_STATIONS_TENANT` | Tenant duy nhất mà instance này đẩy cho. Một yêu cầu không thể nêu tên tenant khác. |
| `stations.dashboardTokenFile` | `HOTLOOP_FLOW_STATIONS_DASHBOARD_TOKEN_FILE` | Một tệp chứa token bảng điều khiển. |
| `stations.deployTokenFile` | `HOTLOOP_FLOW_STATIONS_DEPLOY_TOKEN_FILE` | Một tệp chứa token triển khai mà các trạm chấp nhận. |

Trong chart chúng là `stations.dashboardUrl`, `stations.tenant`, `stations.dashboardTokenSecret` và `stations.deployTokenSecret`, mỗi Secret chứa một token và được gắn như một tệp; với Podman và Quadlet chúng là bốn biến môi trường và hai secret được gắn trong [Triển khai Flow](/vi/flow/deploying/). Đặt cả bốn hoặc không đặt cái nào: một lần render chart với một số trong đó bị từ chối, và một lần khởi động với một số trong đó cũng vậy.

`POST /stations/push` cần `flows.write` và nhận `{flows, note, confirmRestart, window, windowZone, dryRun}`. Bỏ `flows` thì nó đẩy những gì instance này đang chạy. Nó trả lời bằng cùng báo cáo, thêm `ok`, và một lần đẩy nằm trong nhật ký kiểm toán là `stations.push`. `GET /stations` cần `flows.read`. Một lần đẩy đang chờ một lời đồng ý trả lời với `needsConfirm` là true và chưa thay đổi gì: hãy gửi lại với `confirmRestart` hoặc một khung giờ.

## Những gì chưa được chứng minh

Dạng của danh sách bảng điều khiển được đọc từ bảng điều khiển đang chạy cho một tenant thật. Nó chưa được đẩy tới các trạm của một tenant qua Flux, nên việc địa chỉ mà bảng điều khiển cung cấp có truy cập được từ nơi bạn chạy lệnh đẩy hay không là việc bạn tự kiểm tra bằng `stations list` và `-dry-run`.
