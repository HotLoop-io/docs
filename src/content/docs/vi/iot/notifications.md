---
title: "Thông báo báo động"
description: "ntfy, Gotify, Discord, webhook và email. Nhấn Xác nhận trên điện thoại là báo động được xác nhận, có chữ ký và chỉ dùng một lần."
---

Thông báo báo động, từ bản 4.10.0, gọi điện thoại khi có báo động phát sinh lúc 03:00. Khi một báo động **phát sinh**, HotLoop gửi thông báo qua mọi kênh đã cấu hình và đang bật mà báo động đạt ngưỡng ưu tiên của kênh đó. Mặc định tắt (`HOTLOOP_NOTIFY_ENABLED`): một hệ thống không có ai để gọi thì không có gì để cấu hình ở đây.

## Vì sao chỉ "phát sinh"

`alarm.Engine.OnTransition` kích hoạt ở mọi chuyển trạng thái theo ISA-18.2: phát sinh, trở lại bình thường, xác nhận, hoãn, bỏ hoãn. Gói này lắng nghe tất cả nhưng chỉ hành động với đúng một loại. Nếu báo ở mọi chuyển trạng thái, điện thoại của người vận hành sẽ rung khi họ xác nhận báo động của chính mình, khi báo động tự trở lại bình thường, khi ai đó hoãn nó cho một ca làm việc. Điều đó dạy mọi người gạt thông báo đi mà không đọc, giống như một báo động chập chờn dạy họ phớt lờ báo động. "Phát sinh" là sự kiện duy nhất có nghĩa "có việc cần một người có thể đang không nhìn màn hình", và đó chính là lý do gói này tồn tại.

Thông báo khác duy nhất là leo thang: báo động đã phát sinh, chưa ai xác nhận, và chính sách yêu cầu báo cho người kế tiếp. Đó là cùng một báo động vẫn cần có người xử lý, nhắc lại cho một người khác, không phải một sự kiện mới. Xem "Leo thang".

Có một trường hợp trông như bỏ hoãn nhưng thực chất là phát sinh. Nếu điều kiện xuất hiện trong lúc báo động đang bị hoãn thì chưa ai được báo, vì vậy khi hết hoãn (hết thời gian hoặc bỏ hoãn thủ công), bộ máy ghi nhận việc bỏ hoãn rồi ghi nhận một lần phát sinh, và lần phát sinh đó sẽ gửi thông báo. Một báo động đã ở trạng thái báo động khi bị hoãn và vẫn còn như vậy sẽ quay lại ở trạng thái chưa xác nhận nhưng không báo lại: nó đã báo lần đầu rồi.

## Các kênh

Có sáu kênh, và đó là toàn bộ danh sách (xem "Thông báo" trong [lộ trình HotLoop](/vi/roadmap/) để biết những gì chúng tôi không làm và vì sao). Không kênh nào cần SDK của nhà cung cấp hay tài khoản trả phí, đúng với kế hoạch của dự án: tích hợp đám mây là các kết nối đi ra tùy chọn do người vận hành cấu hình, không bao giờ là thứ ứng dụng này bắt buộc phải có để chạy.

- **ntfy**: thông báo đẩy tới điện thoại, kèm nút **Xác nhận** xác nhận báo động ngay trong HotLoop. Miễn phí, và bạn có thể chạy máy chủ trong mạng nhà máy mà không cần internet. Xem "Thiết lập ntfy".
- **Gotify**: thông báo đẩy tới điện thoại. Miễn phí, tự lưu trữ, chạy được khi không có internet. Không có nút bấm và không có ứng dụng iPhone, nên đó là một máy nhắn tin chứ không phải kênh hai chiều. Xem "Thiết lập Gotify".
- **Discord webhook**: một embed trong kênh Discord, tô màu theo mức ưu tiên, kèm tag, giá trị, giới hạn, khu vực và dây chuyền. Dán một URL là chạy. Báo động nghiêm trọng có thể nhắc một vai trò. Không có nút bấm. Xem "Discord".
- **Discord bot**: cùng nội dung đó, kèm các nút **Xác nhận** và **Hoãn** tác động lên báo động và ghi lại ai đã nhấn. Các lần nhấn quay về qua kết nối HotLoop tự mở tới Discord, nên nhà máy không cần địa chỉ công khai. Xem "Discord".

- **Webhook**: một yêu cầu POST với nội dung JSON riêng của HotLoop (`alarmId`, `name`, `priority`, `priorityLabel`, `message`, `deviceId`, `tagName`, `raisedAt`, `event`, có giá trị `raised`, hoặc `escalated` khi leo thang) tới một URL đã cấu hình. Nó chạy với bất cứ thứ gì nhận JSON mà bạn gửi: script của riêng bạn đứng sau một bộ lắng nghe HTTP nhỏ, Node-RED, n8n, hoặc một trigger "nhận mọi webhook" trong công cụ quy trình. (Nếu trỏ tới một chủ đề ntfy thì vẫn báo được, nhưng JSON thô thành nội dung văn bản; hãy dùng kênh ntfy ở trên thay thế.) Một bản tóm tắt (xem "Giới hạn tốc độ và bản tóm tắt") có `event` là `summary` và một danh sách `alarms` nêu tên từng báo động trong đó. Nó không chạy với các dịch vụ muốn nội dung theo định dạng riêng của họ. Discord trả lời 400 vì không có `content` hoặc `embeds`. Slack, Teams và Google Chat muốn một trường văn bản riêng. Pushover muốn các trường `token`, `user` và `message`, còn Events API của PagerDuty muốn `routing_key`, `event_action` và `payload`. Trỏ webhook vào một trong số đó thì mọi thông báo đều thất bại. Discord có các kênh riêng tạo đúng nội dung Discord mong đợi; hãy dùng các kênh đó.
- **Email qua SMTP**: gửi qua bất kỳ máy chủ chuyển tiếp nào người vận hành đã có (máy chủ thư của doanh nghiệp, điểm cuối SMTP của nhà cung cấp email giao dịch, máy chủ chuyển tiếp tự lưu trữ). Không cần khóa API, không cần thư viện của nhà cung cấp: chỉ `net/smtp` và một thư văn bản thuần dựng tay. Nhiều điện thoại đã tự hiển thị email như thông báo đẩy, và nhiều công cụ nhắn gọi chấp nhận địa chỉ cầu nối email sang SMS làm "cách liên lạc", nên riêng kênh này đã phủ một phần đáng kể nhu cầu "gọi điện thoại" mà không cần phụ thuộc trả phí nào.

## URL webhook không bao giờ được in ra

Với nhiều bên nhận, URL chính là mật khẩu. Discord đặt token trong đường dẫn (`/api/webhooks/{id}/{token}`), ntfy nhận nó dưới dạng `?auth=`, Google Chat dưới dạng `?key=` và `?token=`. Ai có URL đều có thể đăng vào kênh của bạn. Vì vậy khi gửi lỗi, thông báo lỗi chỉ nêu giao thức và máy chủ, không có gì khác:

```
webhook request to https://discord.com failed: context deadline exceeded
webhook https://ntfy.example.com returned 401 Unauthorized
```

Đó là cùng một dòng chữ trong nhật ký, trong sự kiện kiểm toán và trong phản hồi của `POST /api/notify/test`. Máy chủ là đủ để biết bên nhận nào gặp sự cố; đường dẫn và chuỗi truy vấn không bao giờ rời khỏi tiến trình. Một URL không qua được bước kiểm tra khi khởi động cũng không bị lặp lại trong lỗi đó. Nếu cần xem URL, hãy xem `HOTLOOP_NOTIFY_WEBHOOK_URL` ở nơi bạn đã đặt nó.

## Thiết lập ntfy

[ntfy](https://ntfy.sh) là máy chủ thông báo đẩy theo mô hình đăng và đăng ký. HotLoop đăng từng báo động lên một chủ đề; ứng dụng ntfy trên điện thoại đăng ký chủ đề đó.

1. Chạy một máy chủ, hoặc dùng ntfy.sh. Trong mạng nhà máy, hãy chạy máy chủ riêng (`binwiederhier/ntfy`, một container) và khóa chặt: đặt `auth-default-access: deny-all`, tạo một người dùng cho HotLoop được ghi vào chủ đề, và mỗi người một tài khoản được đọc. Trên ntfy.sh, hoặc bất kỳ máy chủ nào ai cũng truy cập được, **tên chủ đề chính là mật khẩu**: ai đoán ra sẽ đọc được báo động của bạn. Hãy đặt tên dài và ngẫu nhiên.
2. Cấp cho HotLoop một token truy cập (`ntfy token add hotloop`) hoặc tên người dùng và mật khẩu của người dùng đó.
3. Đặt `HOTLOOP_PUBLIC_URL` thành địa chỉ mà điện thoại dùng để truy cập HotLoop, ví dụ `https://hotloop.plant.example`. Nếu không có, thông báo vẫn đến nhưng không có nút Xác nhận và không thể chạm để mở, vì điện thoại không có nơi nào để gửi hai thứ đó.
4. Cấu hình và khởi động lại:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_URL=https://ntfy.plant.example
HOTLOOP_NOTIFY_NTFY_TOPIC=boiler-house-alarms
HOTLOOP_NOTIFY_NTFY_TOKEN=tk_...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

5. `POST /api/notify/test` gửi một thông báo thử. Nó không có nút Xác nhận, vì không có báo động nào phía sau để xác nhận.

URL chỉ là máy chủ. Chủ đề nằm trong một cài đặt riêng, không bao giờ nằm trong URL: nhờ vậy HotLoop biết phần nào là bí mật và giữ nó ngoài mọi lỗi, dòng nhật ký và sự kiện kiểm toán.

Nội dung nhận được:

| <span class="sr-only">Details</span> | <span class="sr-only">Details</span> |
|---|---|
| Tiêu đề | Tên của báo động |
| Nội dung | Thông điệp của báo động, mức ưu tiên, nơi phát sinh (`device/tag`) và thời điểm phát sinh |
| Ưu tiên | Nghiêm trọng 5 (tối đa: trên Android có thể vượt qua chế độ không làm phiền nếu bạn cho phép), Cao 4, Trung bình 3, Thấp 2 |
| Nhãn | Một emoji theo mức nghiêm trọng và mức ưu tiên bằng chữ, để dễ lướt danh sách trên điện thoại |
| Chạm | Mở danh sách báo động của HotLoop, khi đã đặt `HOTLOOP_PUBLIC_URL` |
| Nút | **Xác nhận**, khi đã đặt `HOTLOOP_PUBLIC_URL`. Xem "Liên kết xác nhận" |

### Lưu ý về iPhone

Android chạy được mà không cần internet: ứng dụng ntfy giữ kết nối riêng tới máy chủ của bạn và nhận mọi tin nhắn ngay lập tức qua Wi-Fi nhà máy.

iPhone thì không. Apple chỉ cho phép thông báo đẩy đi qua máy chủ của chính họ (APNs), và chỉ ntfy.sh mới nói chuyện được với APNs. Một máy chủ tự lưu trữ phải được cấu hình `upstream-base-url: https://ntfy.sh`, khi đó nó chuyển tiếp một yêu cầu thăm dò (không có nội dung tin nhắn, chỉ "có gì đó vừa đến chủ đề này") tới ntfy.sh, ntfy.sh đánh thức điện thoại, rồi điện thoại lấy tin nhắn từ máy chủ của bạn. Vì vậy ở nhà máy không có internet, iPhone không nhận được thông báo tức thì từ ntfy tự lưu trữ. Họ chỉ thấy khi mở ứng dụng. Nếu nhân viên dùng iPhone và nhà máy bị cách ly khỏi internet, ntfy không phải máy nhắn tin của bạn; email qua máy chủ chuyển tiếp mới phải, hoặc Discord nếu nhà máy truy cập được. Gotify hoàn toàn không có ứng dụng iPhone.

Nút Xác nhận là một yêu cầu từ điện thoại tới `HOTLOOP_PUBLIC_URL`, nên điện thoại phải truy cập được địa chỉ đó: qua Wi-Fi nhà máy, hoặc qua VPN bạn đang dùng. Nó chạy giống nhau trên cả hai nền tảng.

## Thiết lập Gotify

[Gotify](https://gotify.net) là một máy chủ thông báo đẩy nhỏ, tự lưu trữ, có ứng dụng Android. Không cần internet, không cần tài khoản ở đâu cả.

1. Chạy `gotify/server` và đăng nhập vào giao diện web của nó.
2. Trong **Apps**, tạo một ứng dụng tên HotLoop. Sao chép token của nó.
3. Cấu hình và khởi động lại:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_URL=https://gotify.plant.example
HOTLOOP_NOTIFY_GOTIFY_TOKEN=A...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

Token được đặt trong header `X-Gotify-Key`, không bao giờ là `?token=` trong URL, vì như vậy nó sẽ nằm trong nhật ký truy cập của mọi proxy.

Mức ưu tiên được ánh xạ theo cách ứng dụng Android xử lý: Nghiêm trọng 10 và Cao 8 là mức quan trọng cao (có âm thanh và cửa sổ nổi), Trung bình 5 là thông báo thường có âm thanh, Thấp 2 là im lặng. Tin nhắn là Markdown (tên báo động in đậm, chi tiết dạng danh sách, văn bản của chính báo động được thoát ký tự để tên có dấu sao vẫn đọc đúng là tên đó), và chạm vào sẽ mở danh sách báo động của HotLoop khi đã đặt `HOTLOOP_PUBLIC_URL`.

**Không xác nhận được.** Thông báo Gotify không có nút hành động, nên không có cách nào đặt nút Xác nhận lên đó, và chúng tôi sẽ không giả lập bằng một liên kết xác nhận chỉ với GET thường: trình xem trước liên kết và bộ quét bảo mật tự mở liên kết, và một báo động không bao giờ được để robot xác nhận. Hãy xác nhận trong HotLoop. **Cũng không có ứng dụng iPhone.**

## Discord

Có hai cách. Webhook là máy nhắn tin: dán một URL, nhận báo động trong một kênh. Bot là kênh hai chiều: cùng các tin nhắn đó kèm nút **Xác nhận** và **Hoãn**, và vết kiểm toán ghi rõ ai đã nhấn. Cả hai đều cần nhà máy truy cập được Discord qua internet (HTTPS đi ra tới `discord.com`, và với bot là một WebSocket tới `*.discord.gg`). Cả hai đều không cần Discord truy cập được nhà máy.

### Nội dung nhận được

| <span class="sr-only">Details</span> | <span class="sr-only">Details</span> |
|---|---|
| Văn bản | `[Critical] Boiler Trip`, đó là nội dung thông báo đẩy trên điện thoại hiển thị. Với báo động nghiêm trọng, phía trước có thêm lời nhắc vai trò đã cấu hình |
| Tiêu đề embed | Giống như trên, liên kết tới danh sách báo động của HotLoop khi đã đặt `HOTLOOP_PUBLIC_URL` |
| Màu | Nghiêm trọng màu đỏ, Cao màu cam, Trung bình màu vàng, Thấp màu xanh dương |
| Mô tả | Thông điệp của báo động |
| Trường | Tag (`device/tag`), Giá trị (số đo gây ra báo động), Giới hạn (`hi 90`, lấy từ định nghĩa), Khu vực / Dây chuyền (lấy từ thiết bị), Phát sinh (theo múi giờ của từng người đọc) |
| Chân trang | `HotLoop | <HOTLOOP_PLANT_NAME>`, để máy chủ có nhiều nhà máy phân biệt được từng nhà máy (chỉ `HotLoop` khi chưa đặt tên nhà máy) |
| Nút (chỉ bot) | Xác nhận, Hoãn 1 giờ, Mở trong HotLoop |

Một đợt báo động dồn dập sẽ thành bản tóm tắt, giống mọi kênh khác: năm cái đầu được gửi đi, sau đó một tin nhắn liệt kê phần còn lại, với số tên vừa đủ chỗ và số lượng các báo động còn lại, nên con số không bao giờ bị cắt.

Discord từ chối tin nhắn quá dài (2000 ký tự văn bản, 256 tiêu đề, 4096 mô tả, 25 trường, tổng 6000), và một tin nhắn bị từ chối là một thông báo không đi được. Vì vậy HotLoop cắt cho vừa, tại ranh giới ký tự, kèm `...` ở chỗ cắt.

### Không ai bị nhắc nhầm

Mọi tin nhắn đều gửi đi kèm `allowed_mentions: {"parse": []}`. Nếu thiếu nó, Discord nhắc bất cứ ai mà văn bản nhắc đến, nên một báo động có ai đó đặt tên "@everyone tank overflow" sẽ đánh thức cả máy chủ. Với nó, không có gì trong văn bản nhắc đến ai. Ngoại lệ duy nhất là vai trò bạn cấu hình cho mức Nghiêm trọng (`..._CRITICAL_ROLE`), được nêu rõ là lời nhắc duy nhất được phép, và chỉ khi báo động Nghiêm trọng hoặc bản tóm tắt có báo động Nghiêm trọng trong đó. Thông báo thử không bao giờ nhắc ai. Văn bản của chính báo động cũng được thoát ký tự Markdown, nên một tên có `*` vẫn đọc đúng là tên đó, và `<@&role>` trong tên chỉ được hiển thị chứ không được dùng.

Để lời nhắc hoạt động, vai trò phải cho phép nhắc đến: trong cài đặt vai trò của máy chủ, bật **Allow anyone to @mention this role**, hoặc cấp cho bot quyền **Mention @everyone, @here, and All Roles**.

### Giới hạn tốc độ và lệnh cấm của Discord

Discord trả lời "quá nhanh" bằng mã 429 và cho biết cần chờ bao lâu, trong nội dung (`retry_after`, chính xác đến mili giây) và trong `X-RateLimit-Reset-After`. HotLoop chờ đúng khoảng đó trước khi thử lại, trong phạm vi ba lần thử và 30 giây thông thường (xem "Thử lại"). Khi Discord báo hạn mức đã hết trước khi từ chối (`X-RateLimit-Remaining: 0`), lần gửi tiếp theo chờ đặt lại thay vì chịu một mã 429.

Discord cấm địa chỉ của bất kỳ thứ gì tích lũy 10.000 yêu cầu bị từ chối (401, 403, 429) trong mười phút, và lệnh cấm kéo theo mọi tích hợp Discord trên địa chỉ đó. Vì vậy khi Discord trả lời **401, 403 hoặc 404** (webhook sai hoặc đã xóa, token bot sai, kênh mà bot không thấy), HotLoop **tắt kênh đó** sau đúng một yêu cầu ấy. Nó ghi nhật ký một lần, mọi báo động sau đó bị từ chối mà không gửi yêu cầu (và được ghi kiểm toán là chưa gửi, để câu hỏi "có ai được báo chưa" vẫn có câu trả lời), và nó hiện trong `GET /api/diagnostics` dưới `notify.channels`, kèm lý do và thời điểm:

```json
{"channel": "discord-webhook", "broken": true,
 "reason": "discord webhook https://discord.com returned 404 Not Found: Unknown Webhook (Discord error 10015)",
 "since": "2026-09-27T03:00:01Z"}
```

Sửa cài đặt rồi khởi động lại HotLoop. Lỗi 500 hoặc không có phản hồi không tắt gì cả; chúng được thử lại như ở mọi kênh khác.

### Thiết lập webhook

1. Trong Discord, mở cài đặt của kênh (biểu tượng bánh răng), **Integrations**, **Webhooks**, **New Webhook**. Đặt tên là HotLoop. **Copy Webhook URL**.
2. Tùy chọn: một vai trò để nhắc khi có báo động Nghiêm trọng. Bật **Developer Mode** (User Settings, Advanced), rồi nhấp chuột phải vào vai trò trong Server Settings, Roles, và chọn **Copy Role ID**. Đó là một con số, không phải tên.
3. Cấu hình và khởi động lại:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234.../AbCd...
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE=123456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

4. `POST /api/notify/test` gửi một tin nhắn thử.

**Toàn bộ URL là mật khẩu.** Ai có nó đều có thể đăng vào kênh của bạn dưới danh nghĩa webhook. HotLoop không bao giờ in nó ra: không trong nhật ký, không trong lỗi, không trong sự kiện kiểm toán, không trong phản hồi API, và một URL không qua được bước kiểm tra khi khởi động cũng không bị lặp lại trong lỗi đó. Trong Helm chart, nó nằm trong một Secret. Nếu bị lộ, hãy xóa webhook trong Discord và tạo cái mới.

Một webhook không thể mang nút bấm có tác dụng, nên ở đây không có Xác nhận. Tiêu đề liên kết tới danh sách báo động trong HotLoop. Muốn có nút bấm, hãy dùng bot.

### Thiết lập bot

1. Vào [cổng nhà phát triển Discord](https://discord.com/developers/applications), **New Application**, đặt tên là HotLoop. **Application ID** trên trang General Information là thứ liên kết mời cần có.
2. Thẻ **Bot**: **Reset Token** rồi sao chép. Discord chỉ hiện một lần. Đó là `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN`. Trên cùng trang đó, tắt **Public Bot** để không ai ngoài bạn thêm được nó vào máy chủ, và để cả ba **Privileged Gateway Intents** ở trạng thái tắt. HotLoop không yêu cầu Discord gửi sự kiện nào (intents 0); các lần nhấn nút vẫn đến bình thường.
3. Mời nó vào máy chủ của bạn với quyền tối thiểu cần thiết, View Channels, Send Messages và Embed Links (quyền `19456`), và không có phạm vi nào khác ngoài `bot`:

```
https://discord.com/oauth2/authorize?client_id=<APPLICATION ID>&scope=bot&permissions=19456
```

   Chỉ thêm **Mention @everyone, @here, and All Roles** (`permissions=150528`) nếu vai trò Nghiêm trọng không cho phép nhắc đến và bạn không muốn đổi điều đó. Việc sửa tin nhắn của chính nó sau khi nhấn không cần quyền; việc đó đi qua chính lần nhấn.
4. Kênh: khi đã bật Developer Mode, nhấp chuột phải vào kênh, **Copy Channel ID**. Nếu kênh ở chế độ riêng tư, hãy thêm vai trò của bot vào đó.
5. Các vai trò được phép nhấn nút. Tạo một vai trò (ví dụ "Alarm ack"), gán cho những người được phép xác nhận từ Discord, và sao chép id của nó. Hoãn đưa một báo động ra khỏi danh sách trong một giờ, nên nó có cài đặt riêng; có thể dùng cùng vai trò hoặc một vai trò hẹp hơn.
6. Cấu hình và khởi động lại:

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN=MTIz...
HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL=223456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES=323456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES=423456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE=323456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

7. Nhật ký ghi `connected to the Discord Gateway; Discord buttons work`, và `GET /api/diagnostics` hiện `"gateway": {"connected": true}` dưới kênh `discord`. `POST /api/notify/test` đăng một tin nhắn thử (không có nút, vì không có báo động nào phía sau).

**Cho đến khi bạn đặt các vai trò, không ai nhấn được gì.** Khi `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` hoặc `_SHELVE_ROLES` để trống, mọi lần nhấn nút đó đều bị từ chối, người nhấn được cho biết cài đặt nào đang trống, và HotLoop cũng thông báo điều đó khi khởi động:

```
WARN NOBODY can acknowledge alarms from Discord, because HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES is empty...
```

Điều này là có chủ ý. Một nút mà ai trong máy chủ cũng nhấn được không phải là mặc định nên giao ra: máy chủ thì lúc nào cũng tích tụ thêm người.

**Ai đã nhấn.** Một lần xác nhận từ Discord được ghi dưới `discord:<username>#<user id>` (dùng id vì tên người dùng Discord có thể đổi còn id thì không), kèm ghi chú "acknowledged from Discord by alice (1010...)". Để ghi dưới người dùng HotLoop, hãy ánh xạ họ: `HOTLOOP_NOTIFY_DISCORD_BOT_USERS=101010101010101010=alice,202020202020202020=bob`. Việc ánh xạ chỉ đặt tên cho người thực hiện. Nó không kiểm tra quyền của người dùng HotLoop: vai trò Discord quyết định ai được nhấn.

**Hoãn** hoãn trong thời gian `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE`, mặc định một giờ, tối đa 24 giờ như mọi lần hoãn. Đó là một khoảng cố định, không phải menu: lúc 03:00, một nút làm một việc đã biết tốt hơn một danh sách thả xuống. Nó từ chối báo động đã trở lại bình thường (hoãn nó sẽ che mất thứ gây ra nó lần sau) và báo động đã bị hoãn.

Sau mỗi lần nhấn, tin nhắn cho biết ai đã làm gì và khi nào, và cả hai nút chuyển sang màu xám, để người tiếp theo xem kênh thấy việc đã được xử lý. Một lần nhấn bị từ chối chỉ được trả lời cho người đã nhấn, kèm lý do, và được ghi vào nhật ký hệ thống.

### Một lần nhấn được cho phép như thế nào

Cùng cơ chế với liên kết Xác nhận của ntfy (xem "Liên kết xác nhận"), cộng thêm lời xác nhận của chính Discord về người nhấn:

- **Nút được ký.** Mỗi nút mang một token được ký bằng cùng khóa bí mật với các liên kết xác nhận, cho hành động đó (xác nhận hoặc hoãn, được ký vào trong, để hành động này không thể dùng lại làm hành động kia), cho báo động đó, phát sinh vào đúng thời điểm đó. Discord cho phép mỗi nút 100 ký tự dữ liệu và id báo động có thể dài 64, nên đây là dạng gọn của cùng một khẳng định: 8 byte thời điểm phát sinh, 4 byte hạn dùng và một HMAC 96 bit. Giả mạo nó nghĩa là đoán 96 bit, mỗi lần đoán là một lần nhấn trên Discord, từ bên trong máy chủ với đúng vai trò.
- **Người nhấn giữ một vai trò bạn đã chỉ định.** Discord báo cho bot các vai trò của người nhấn cùng với lần nhấn, qua kết nối đã xác thực của chính bot. Ai có thể cấp vai trò trong máy chủ của bạn đều có thể cấp vai trò này, vì vậy hãy xem các vai trò đó như chính quyền hạn mà chúng là.
- **Lần phát sinh vẫn còn hiện hành.** Bộ máy kiểm tra, dưới khóa của chính nó, rằng lần phát sinh hiện tại của báo động đúng là lần ghi trên nút. Tin nhắn hôm qua không thể xác nhận lần ngắt hôm nay.
- **Một lần.** Hành động đầu tiên trên một lần phát sinh từ bất kỳ thông báo nào (ntfy hoặc Discord) được ghi lại và mọi hành động sau đều bị từ chối. Hai người nhấn cùng lúc: một người thắng, người kia được báo.
- **Có hạn.** Sau `HOTLOOP_NOTIFY_ACK_TTL` (12 giờ), các nút ngừng hoạt động; hãy xử lý trong HotLoop.

Token của bot là thông tin xác thực cho toàn bộ bot. Nó không bao giờ được ghi nhật ký, không bao giờ nằm trong lỗi, không bao giờ nằm trong phản hồi API; trong Helm chart, nó nằm trong một Secret. Token tương tác của từng lần nhấn cũng vậy, thứ mà Discord cấp cho bot mười lăm phút để trả lời. Nếu token bot bị lộ, hãy đặt lại nó trong cổng nhà phát triển.

### Kết nối Gateway

Các lần nhấn đến qua Discord Gateway, một WebSocket mà HotLoop mở tới Discord và giữ mở. Trình khách là của riêng HotLoop, dựa trên [gorilla/websocket](https://github.com/gorilla/websocket) (v1.5.3, cố định phiên bản; nó đã có sẵn trong đồ thị phụ thuộc của module này, nhỏ gọn và là thư viện WebSocket được dùng nhiều nhất trong Go). Chúng tôi không dùng một thư viện Discord như discordgo: đó là cả một SDK Discord (REST, thoại, bộ nhớ đệm trạng thái) chỉ để dùng một sự kiện cần thiết, và dự án này không mang theo SDK của nhà cung cấp. Trình khách này:

- nhận diện với intents 0, nên Discord không gửi gì ngoài các lần nhấn nút;
- gửi heartbeat theo khoảng thời gian Discord đưa ra, trả lời ngay một yêu cầu heartbeat, và coi một heartbeat không được xác nhận là kết nối đã chết;
- tiếp tục phiên sau khi bị ngắt, một Reconnect (op 7) hoặc một Invalid Session có thể tiếp tục (op 9), nên một lần nhấn xảy ra trong lúc kết nối lại được phát lại thay vì bị mất; một phiên không thể tiếp tục chờ từ một đến năm giây rồi bắt đầu phiên mới;
- nhận diện tối đa một lần mỗi năm giây, và hoàn toàn không làm vậy khi Discord báo số lần bắt đầu phiên trong ngày đã hết, cho đến khi được đặt lại;
- kết nối lại với thời gian chờ tăng gấp đôi từ một giây đến một phút;
- dừng hẳn khi token hoặc intents bị từ chối, tắt kênh và hiển thị trong `/api/diagnostics`, thay vì kết nối lại mãi mãi.

Discord cho bot ba giây để trả lời một lần nhấn, nên việc đầu tiên HotLoop làm là trả lời "đã nhận" (một cập nhật hoãn), rồi mới làm việc. Câu trả lời đó cũng là thứ ngăn hai bản sao HotLoop cùng hành động trên một lần nhấn: cả hai đều nhận được nó, Discord chấp nhận câu trả lời đầu và từ chối câu thứ hai, và bản sao bị từ chối sẽ dừng lại. Khi chạy như một trình trợ giúp MCP (`--mcp-stdio`), HotLoop hoàn toàn không mở kết nối Gateway; bản chính xử lý các lần nhấn.

## Giới hạn tốc độ và bản tóm tắt

Một lần sụt điện hay khởi động lại PLC làm bốn mươi báo động phát sinh trong một giây. Gửi một tin cho mỗi báo động sẽ khiến IP của webhook Discord bị cấm, chạm giới hạn theo IP của ntfy, và chôn một báo động quan trọng dưới ba mươi chín báo động không quan trọng trên chiếc điện thoại nhận chúng. Vì vậy mỗi kênh có một ngân sách, một thùng token: một loạt có thể đi ra cùng lúc, rồi cứ mỗi lần nạp lại thì thêm một.

| Kênh | Loạt mặc định | Sau đó cứ mỗi |
|---|---|---|
| ntfy | 10 | 5 s (dưới giới hạn riêng của ntfy.sh là 60, rồi một mỗi 5 s, theo IP) |
| Gotify | 10 | 5 s |
| Webhook | 10 | 5 s |
| SMTP | 5 | 12 s |
| Discord webhook | 5 | 2 s (Discord cho phép một webhook khoảng 5 yêu cầu mỗi 2 s, và một kênh 30 tin nhắn mỗi phút) |
| Discord bot | 5 | 2 s |

Thay đổi theo từng kênh bằng `HOTLOOP_NOTIFY_<CHANNEL>_BURST` và `HOTLOOP_NOTIFY_<CHANNEL>_REFILL` (`WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK`, `DISCORD_BOT`).

Phần ngân sách cho phép sẽ đi ngay lập tức. Phần không cho phép được giữ lại, và khi đến lượt gửi tiếp theo, mọi thứ bị giữ sẽ đi thành **một** bản tóm tắt:

```
7 more alarms raised in the last 12 s:
- [High] Line 3 Stopped
- [Critical] Boiler Trip
...
```

Không báo động nào bị bỏ sót: bản tóm tắt nêu tên từng báo động, tối đa 25, và đếm phần còn lại ("...and 13 more"). Nó nghiêm trọng bằng báo động nghiêm trọng nhất trong đó, và sự kiện kiểm toán của nó liệt kê mọi id báo động mà nó đại diện. Nó không có nút Xác nhận, vì không có một báo động đơn lẻ nào để nó xác nhận. Nếu chỉ có một báo động bị giữ, nó đi như chính báo động đó, kèm cả nút bấm. Khi đã có báo động bị giữ, các báo động mới gia nhập cùng nhóm ngay cả khi ngân sách đã quay lại, để một bản tóm tắt không bao giờ đến sau một báo động phát sinh muộn hơn tất cả những gì trong nó. Khi tắt máy, mọi thứ còn đang giữ được gửi ngay, vượt ngân sách: khi đó lựa chọn là giữa một lần gửi thừa và những báo động mà không ai được báo.

Ngân sách tính theo từng kênh, nên một đợt dồn dập khiến máy chủ chuyển tiếp SMTP xếp hàng không làm ntfy chậm lại, và ngưỡng của mỗi kênh vẫn được áp dụng: một báo động mức Thấp không bao giờ vào bản tóm tắt của kênh đặt ở mức Cao trở lên.

## Thử lại

Một lần gửi nhận mã 429, 5xx hoặc không có phản hồi (bị từ chối, bị ngắt, hết thời gian) sẽ được thử lại, tối đa ba lần tổng cộng, tất cả trong vòng 30 giây kể từ lần đầu. Khi bên nhận cho biết cần chờ bao lâu (`Retry-After`, tính bằng giây hoặc dưới dạng ngày giờ), chúng tôi chờ đúng khoảng đó; nếu không thì một giây, rồi hai giây. Bên nhận đòi chờ lâu hơn 30 giây còn lại sẽ không được chờ: lỗi được báo ngay, kèm lý do đó. Sau 30 giây, một thông báo chưa đi được nên được báo là thất bại, trong nhật ký và vết kiểm toán, hơn là lặng lẽ thử lại hàng phút trong khi báo động vẫn còn đó.

Mọi mã 4xx khác (token sai, chủ đề người dùng không ghi được, yêu cầu sai định dạng) không bao giờ được thử lại. Câu trả lời sẽ giống nhau mỗi lần cho đến khi ai đó sửa cấu hình, và Discord cấm một IP cứ gửi những yêu cầu đã bị từ chối.

`POST /api/notify/test` chỉ thử đúng một lần cho mỗi kênh. Một lần thử hỏi kênh đang làm gì ngay lúc này, và thử lại sẽ khiến bên nhận chập chờn trông như bình thường.

## Liên kết xác nhận

Nút Xác nhận trên thông báo ntfy là một yêu cầu tới `POST /api/notify/ack/{token}` trên `HOTLOOP_PUBLIC_URL`. Người nhấn nó lúc 03:00 không đăng nhập vào đâu cả, nên **token chính là toàn bộ sự cho phép**. Điều đó chỉ đúng nếu token không thể giả mạo, phạm vi hẹp, dùng một lần và sống ngắn, và từng điều đó đều được thực thi:

- **Không thể giả mạo.** Token là một khẳng định (báo động nào, phát sinh khi nào, kênh nào, liên kết hết hạn khi nào) cộng với HMAC-SHA256 của nó bằng một khóa bí mật của máy chủ. Đổi một byte, hoặc ký bằng khóa khác, là bị từ chối. Khóa bí mật là `HOTLOOP_NOTIFY_ACK_SECRET` nếu bạn đặt (ít nhất 32 ký tự; `openssl rand -hex 32`). Nếu không, HotLoop tạo 32 byte ngẫu nhiên lần đầu cần đến và giữ trong cơ sở dữ liệu của nó (bảng `settings`, khóa `notify.ackSecret`), nên các liên kết vẫn hoạt động sau khi khởi động lại và mọi bản sao đều thống nhất. Nó không bao giờ hiện trên màn hình cài đặt hay trong bất kỳ phản hồi API nào. Nó có trong bản sao lưu cơ sở dữ liệu, như mọi thứ khác trong cơ sở dữ liệu; nếu đó là vấn đề với bạn, hãy đặt biến từ một Kubernetes Secret (`notify.ackSecret.existingSecret` trong chart), và nó không bao giờ chạm vào cơ sở dữ liệu. Đổi khóa bí mật làm mọi liên kết đã gửi mất hiệu lực, đó cũng là cách thu hồi tất cả cùng một lúc.
- **Phạm vi hẹp.** Khẳng định nêu một báo động **và thời điểm nó phát sinh**. Một nút từ lần ngắt hôm qua của cùng báo động không thể xác nhận lần ngắt hôm nay mà chưa ai nhìn thấy: bộ máy kiểm tra, dưới cùng khóa với việc xác nhận, rằng lần phát sinh hiện tại của báo động đúng là lần trong khẳng định (`alarm.Engine.AckOccurrence`). Liên kết chỉ có thể xác nhận và không làm gì khác. Nó không thể hoãn, đặt lại, ghi tag hay đọc bất cứ thứ gì, nên điều tệ nhất một liên kết bị lộ có thể làm đúng là điều mà việc nhấn nút sẽ làm.
- **Dùng một lần.** Lần đầu dùng một liên kết cho một lần phát sinh được ghi vào cơ sở dữ liệu (`notify_ack_links`), và mọi lần dùng sau đều bị từ chối, ngay cả khi báo động cần được xác nhận lại mà không phát sinh mới (bị hoãn khi còn đang báo động rồi bỏ hoãn thì quay lại ở trạng thái chưa xác nhận). Trạng thái của chính báo động là không đủ cho việc này; cần có bản ghi.
- **Sống ngắn.** Nó hết hạn, mặc định 12 giờ sau khi gửi (`HOTLOOP_NOTIFY_ACK_TTL`, tối đa 168h). Đủ lâu cho "tôi sẽ xem khi đến nơi", đủ ngắn để ảnh chụp màn hình một thông báo không trở thành một thông tin xác thực tồn tại mãi.

Một lần nhấn thành công là một lần xác nhận ISA-18.2 thông thường qua bộ máy báo động, được kiểm toán y hệt một lần xác nhận từ màn hình báo động: một sự kiện báo động và một mục nhật ký hệ thống với người thực hiện `notify:ntfy` và ghi chú "acknowledged from the ntfy notification". Các hành động HTTP của ntfy không cho biết điện thoại nào đã nhấn nút, nên không có tên người nào để thêm vào. Khi nhiều người dùng chung một chủ đề, vết kiểm toán ghi rằng chiếc điện thoại đã làm, không phải ai. Bot Discord biết người dùng và ghi lại điều đó (xem "Discord").

Mọi lần từ chối đều được trả lời kèm điều gì đã sai và được ghi vào nhật ký hệ thống dưới `notify:<channel>` (hoặc `notify:ack-link` cho token hỏng đến mức không cho biết kênh nào đã gửi), vì một nút lặng lẽ không làm gì thì không thể phân biệt với một nút chưa ai nhấn:

| Phản hồi | Lý do |
|---|---|
| 403 | Bị giả mạo, bị sửa, hoặc được ký bằng khóa bí mật khác |
| 410 | Thật nhưng đã hết hạn |
| 409 | Đã dùng, hoặc báo động đã phát sinh lại từ đó, hoặc không còn gì để xác nhận |
| 404 | Báo động không còn tồn tại, hoặc liên kết xác nhận đã tắt |

Bản thân token không bao giờ được ghi nhật ký, không bao giờ đưa vào sự kiện kiểm toán và không bao giờ được API nào trả về: khi còn hiệu lực, nó là một thông tin xác thực. Nó có nằm trong tin nhắn ntfy, điều đó là không tránh khỏi, nên ai đọc được chủ đề ntfy của bạn đều có thể nhấn nút. Hãy khóa chặt chủ đề.

Điểm cuối trả lời với `Access-Control-Allow-Origin: *` để nút cũng hoạt động từ ứng dụng web ntfy, nơi nhấn nút từ nguồn gốc riêng của nó. Điều đó không để lộ gì: không có gì trên tuyến này đọc cookie hay phiên.

## Leo thang

Không ai xác nhận báo động trong N phút, nên người tiếp theo nhận được nó. Thông báo đầu tiên đi ra y như mọi khi, tới mọi kênh mà báo động đạt ngưỡng. Leo thang là điều xảy ra sau đó, nếu báo động vẫn nằm đó chưa được xác nhận. Một thông báo đến chiếc điện thoại không ai cầm là thất bại mà tính năng này tồn tại để chặn: lúc 03:00 người trực đang ngủ, và báo động không nên chờ họ.

Bạn thiết lập nó trong **Settings, Alarm escalation**, hoặc qua API (`GET` và `PUT /api/notify/escalation`). Chỉ dành cho quản trị viên, vì nó chứa chủ đề ntfy của mọi người và quyết định ai bị đánh thức. Khác với các kênh được đọc từ môi trường khi HotLoop khởi động, chính sách là dữ liệu bạn chỉnh sửa và có hiệu lực khi bạn lưu. Các kênh nó có thể dùng là những kênh mà hệ thống đã cấu hình. Không có gì mới được thêm vào danh sách bốn kênh, cộng với webhook và email.

### Chính sách

| Trường | <span class="sr-only">Details</span> |
|---|---|
| `enabled` | Tắt cho đến khi bạn bật. Một chính sách đang tắt không leo thang gì |
| `minPriority` | Báo động nhẹ nhất vẫn leo thang: `critical`, `high`, `medium` hoặc `low`. Mặc định `high`. Một báo động Trung bình nằm đó cả giờ là một lệnh công việc, không phải cuộc gọi lúc 03:00 |
| `contacts` | Những người liên hệ. Mỗi người có một `name`, và một `ntfyTopic`, `emails`, hoặc cả hai. Tối đa 50 |
| `steps` | Tối đa 10. Mỗi bước có `afterMinutes` (1 đến 1440) và người cần báo: `contacts` theo tên, `channels` theo tên, hoặc cả hai |
| `repeatEveryMinutes`, `repeatTimes` | Sau bước cuối, gửi lại với tần suất này, thêm tối đa số lần này (tối đa 20). Cả hai bằng không là không lặp |

Một **người** nhận thông báo riêng của mình. `ntfyTopic` của họ là một chủ đề trên máy chủ ntfy mà HotLoop này đã đăng lên, dùng cùng thông tin đăng nhập, nên điện thoại của họ đăng ký một chủ đề chỉ của riêng họ. `emails` của họ đi qua máy chủ chuyển tiếp SMTP mà HotLoop đã có. Người có chủ đề cần ntfy được cấu hình, người có địa chỉ cần email được cấu hình, và chính sách bị từ chối kèm điều đó nếu chưa có. Trên máy chủ ai cũng truy cập được, chủ đề là mật khẩu: hãy đặt dài và ngẫu nhiên. API chỉ hiển thị chủ đề cho quản trị viên và không ai khác, và chúng không bao giờ nằm trong sổ nhật ký, nhật ký hệ thống hay lỗi.

Một **kênh** trong một bước là một trong các kênh của hệ thống (`ntfy`, `gotify`, `smtp`, `webhook`, `discord-webhook`, `discord`) và tới được bất kỳ ai đang ở trên đó: kênh Discord dùng chung, ứng dụng Gotify mà cả tổ dùng chung, một webhook dẫn vào thứ gì đó gọi người. Chính sách bị từ chối nếu một bước nêu tên kênh mà HotLoop này chưa cấu hình, và câu trả lời liệt kê những kênh nó có.

### Khi nào thông báo đi

Một bước đến hạn `afterMinutes` sau bước trước nó, và bước đầu tiên `afterMinutes` sau khi báo động phát sinh. Đó là một tổng tính từ lúc phát sinh, không phải từ khi lần gửi cuối kết thúc, nên một máy chủ chuyển tiếp chậm hay một lần khởi động lại không kéo dài lịch bạn đã viết. Với các bước 5 và 10 phút và lặp lại 15 phút, hai lần:

```
 0 min  alarm raised: the first page, as always
 5 min  step 1
15 min  step 2
30 min  step 2 again (repeat 1)
45 min  step 2 again (repeat 2), and that is the last
```

### Điều gì làm nó dừng

Chuỗi dành cho một lần phát sinh của một báo động, và nó dừng, kèm một dòng ghi lý do, khi bất kỳ điều nào sau đây xảy ra:

- **Ai đó xác nhận nó.** Từ bất kỳ đâu: màn hình báo động, nút Xác nhận trên ntfy hoặc Discord, API, một tự động hóa. Tất cả đều kết thúc ở bộ máy báo động, và trước khi mỗi bước đi ra, bộ leo thang hỏi bộ máy xem lần phát sinh này còn chưa xác nhận không. Một hook đến muộn không thể khiến nó báo một báo động mà ai đó đã xử lý.
- **Nó trở lại bình thường.** Báo động vẫn còn trong danh sách báo động chờ người xác nhận, nhưng không ai bị đánh thức vì thứ đã tự hết. Đó là quyết định chúng tôi cố ý đưa ra; hãy đổi ngưỡng hoặc các bước nếu bạn muốn khác.
- **Nó bị hoãn.**
- **Nó ngắt lần nữa.** Đó là một lần phát sinh mới với chuỗi riêng, tính từ lần phát sinh của chính nó. Chuỗi hôm qua không bao giờ báo cho báo động hôm nay.

Một báo động được ai đó xử lý trước khi bước 1 đến hạn không để lại dấu vết nào trong vết leo thang, nghĩa là hệ thống đang làm đúng việc của nó.

### Nội dung nhận được

Một lần leo thang là chính thông báo của báo động với tiêu đề được đổi và thêm một dòng:

```
NOT ACKNOWLEDGED 15 min: Boiler Trip
Nobody has acknowledged this alarm in 15 minutes (step 2 of 4). boiler/Pressure hi 90 (now 95)
```

Nó giữ mức ưu tiên của báo động, nên báo động Nghiêm trọng vẫn là ưu tiên tối đa trên Android. Nó mang cùng nút Xác nhận có chữ ký như thông báo đầu tiên trên ntfy và Discord (xem "Liên kết xác nhận"), để người bị đánh thức có thể xác nhận ngay từ nơi họ được báo. Gotify và email không có nút. Một webhook nhận JSON thông thường của HotLoop với `event` đặt là `escalated`.

Một kênh dùng chung được điều tiết như mọi kênh khác (xem "Giới hạn tốc độ và bản tóm tắt"), nên một lần sụt điện khiến bốn mươi báo động chưa được xác nhận sẽ leo thang thành một bản tóm tắt, "40 alarms nobody has acknowledged", không phải bốn mươi thông báo và một lệnh cấm. Thông báo riêng của một người là một lần gửi riêng.

### Vết kiểm toán

Mỗi lần leo thang là một dòng trong vết riêng của báo động, thứ mà [sổ nhật ký](/vi/iot/logbook/) đọc, nên nó hiện ở đó mà không cần thiết lập thêm, xếp dưới báo động với người thực hiện `escalation`:

```
alarm Boiler Trip escalated: boiler/Pressure hi 90 (now 95) (note: step 1 of 2: nobody acknowledged it in 5 min; notified Ana (email), Ana (ntfy))
alarm Boiler Trip escalation-ended: boiler/Pressure hi 90 (now 95) (note: escalation stopped after 1 sent: acknowledged by notify:ntfy)
```

`GET /api/alarms/events` và loại `alarm` của sổ nhật ký mang cùng các dòng đó với kiểu `escalated` và `escalation-ended`. Một bước không tới được ai sẽ ghi rõ bằng chữ in hoa (`NOBODY WAS REACHED`) kèm từng lỗi theo sau, và chuỗi vẫn tiếp tục sang bước kế tiếp: một máy chủ chuyển tiếp hỏng không nên chặn thông báo đi bằng đường khác. Việc lưu chính sách có trong nhật ký hệ thống nhưng không có các chủ đề.

### Khởi động lại, và nơi nó chạy

Các chuỗi nằm trong bộ nhớ, nên một lần khởi động lại lúc 03:00 giữa chừng một chuỗi không được phép làm mất nó. Khi HotLoop khởi động, nó xem mọi báo động còn chưa xác nhận, đọc các dòng kiểm toán cho biết đã đi bao nhiêu bước cho lần phát sinh đó, và tiếp tục từ đó: nó không gửi lại bước 1 và không bỏ qua bước 2. Một bước đến hạn trong lúc HotLoop ngừng chạy sẽ đi trong vài giây đầu sau khi nó quay lại. Một bước đang dở khi tiến trình bị kết thúc có thể đi hai lần, đó là hướng sai đúng đắn với một báo động.

Một chính sách đã lưu áp dụng cho các báo động phát sinh sau khi bạn lưu. Một lần khởi động lại tiếp nhận mọi báo động còn chưa xác nhận, dù phát sinh lúc nào.

Gateway chạy nó. Một trình trợ giúp `--mcp-stdio` thì không, nên một báo động không bao giờ bị hai tiến trình cùng leo thang.

## TLS trên kênh SMTP

Kênh tự động nâng lên TLS qua STARTTLS bất cứ khi nào máy chủ chuyển tiếp công bố phần mở rộng đó, bất kể cài đặt nào bên dưới. Đây không phải hành vi tùy chọn: `net/smtp.PlainAuth` của chính Go từ chối gửi tên người dùng và mật khẩu qua kết nối chưa phải TLS (hoặc tới máy chủ tên đúng là `localhost`), và hầu như mọi nhà cung cấp thật sự yêu cầu xác thực, Gmail, SendGrid, Mailgun, máy chủ chuyển tiếp của nhà mạng, đều yêu cầu STARTTLS trên cổng 587 hoặc TLS ngầm định trên 465 (xem bên dưới) để đến được đó. Một máy chủ chuyển tiếp không cấu hình xác thực, truy cập được trên mạng cô lập, có thể hoàn toàn không cung cấp STARTTLS, và kênh này không bắt buộc nó trong trường hợp đó.

`HOTLOOP_NOTIFY_SMTP_TLS` không bật việc nâng cấp, nó biến việc *thiếu* nâng cấp thành một lỗi cứng: nếu được đặt và máy chủ chuyển tiếp không công bố STARTTLS, `Send` từ chối trước khi thử `AUTH`, thay vì lặng lẽ xác thực ở dạng văn bản thuần với một máy chủ chuyển tiếp tình cờ truy cập được là `localhost`. `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` bỏ qua việc kiểm tra chứng chỉ khi nâng cấp, cùng lối thoát mà `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY` và `HOTLOOP_FLEET_TLS_SKIP_VERIFY` đã cung cấp cho các kết nối MQTT của chúng, dành cho máy chủ chuyển tiếp dùng chứng chỉ tự ký.

### TLS ngầm định, cổng 465

Một máy chủ chuyển tiếp trên cổng 465 mong đợi toàn bộ kết nối là TLS từ byte đầu tiên (RFC 8314), không phải lời chào văn bản thuần rồi mới nâng cấp. HotLoop trước đây chỉ làm việc nâng cấp, nên trên 465 điều đầu tiên nó nói là văn bản thuần với một máy chủ đang chờ bắt tay TLS và lần gửi chết ngay. Giờ **cổng 465 là TLS ngầm định** và mọi cổng khác vẫn là STARTTLS như trước, không có cài đặt nào phải chạm tới:

```
HOTLOOP_NOTIFY_SMTP_PORT=465
```

Nếu một máy chủ chuyển tiếp dùng TLS ngầm định trên cổng riêng, hoặc dùng STARTTLS trên 465, `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` cho biết là loại nào, `true` hoặc `false`, và ưu tiên hơn cổng. Trong Helm chart, đặt nó dưới `extraEnv`. Mọi thứ khác đều giống nhau ở cả hai: tên người dùng và mật khẩu đi qua kết nối đã mã hóa, `HOTLOOP_NOTIFY_SMTP_TLS` được thỏa mãn bởi nó (không có gì để bắt buộc), và `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` bỏ qua việc kiểm tra chứng chỉ trong lần bắt tay của nó. Chứng chỉ của máy chủ chuyển tiếp được kiểm tra trừ khi bạn tắt. Báo cáo định kỳ dùng cùng cài đặt máy chủ chuyển tiếp và do đó cùng quy tắc.

Nếu bắt tay thất bại, lỗi nói rõ điều đó và nêu `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS=false`, đó là thứ một máy chủ chuyển tiếp bắt đầu bằng văn bản thuần cần.

Đã được chứng minh với một thư viện máy chủ SMTP thật có bộ lắng nghe chỉ TLS, và với Mailpit chạy bằng `--smtp-require-tls`, phiên bản cố định của phòng thí nghiệm v1.31.2. Chưa được kiểm chứng với điểm cuối 465 của một nhà cung cấp thương mại.

## Một đường SMTP, dùng chung với báo cáo định kỳ

Từ 4.14.0, kênh báo động gửi qua `notify.SendMessage`, một hàm tổng quát gửi một tin nhắn, có thể kèm tệp đính kèm, tới một danh sách người nhận. Báo cáo định kỳ (xem [Báo cáo định kỳ](/vi/gateway/reports/)) gửi các tệp CSV và HTML qua cùng hàm đó và cùng cài đặt máy chủ chuyển tiếp (`HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY`), nên có một nơi duy nhất thực hiện kết nối, nâng cấp bằng STARTTLS, xác thực và quyết định header được chứa gì. Chỉ máy chủ chuyển tiếp là dùng chung: `HOTLOOP_NOTIFY_ENABLED`, `HOTLOOP_NOTIFY_SMTP_ENABLED` và `HOTLOOP_NOTIFY_SMTP_TO` là dành cho báo động, và một máy chủ chuyển tiếp được cấu hình cho báo cáo không bật kênh báo động.

Hai hành vi của email báo động đã thay đổi, cả hai theo hướng an toàn hơn. Người gửi và mọi người nhận giờ được kiểm tra là địa chỉ hợp lệ trước khi kết nối, trong khi trước đây địa chỉ sai định dạng thất bại ở máy chủ chuyển tiếp. Và một tiêu đề có ký tự không thuộc ASCII được gửi dưới dạng từ mã hóa RFC 2047 thay vì UTF-8 thô. Tên báo động chứa ký tự điều khiển được đổi thành khoảng trắng thay vì bị từ chối, vì một thông báo phải đi ra dù báo động tên gì.

## Ngưỡng ưu tiên

Mỗi kênh có `MinPriority` riêng, mức ưu tiên báo động nhẹ nhất mà nó vẫn kích hoạt. `model.AlarmPriority` chạy từ 1 (Nghiêm trọng, nặng nhất) đến 4 (Thấp), nên "Cao trở lên" là `MinPriority = 2`: một báo động đạt ngưỡng của kênh khi số ưu tiên của chính nó nhỏ hơn hoặc bằng ngưỡng. Một webhook cấu hình chỉ cho Nghiêm trọng và một máy chủ chuyển tiếp SMTP cấu hình cho Trung bình trở lên có thể cùng theo dõi một bộ máy báo động và kích hoạt cho những tập báo động hoàn toàn khác nhau, không có gì buộc chúng phải giống nhau.

## Những gì nó không phải

**Không phải nạp lại kênh trực tiếp.** Các kênh được đọc một lần, từ cấu hình, khi tiến trình khởi động, giống `EdgePublishConfig` và `FleetConfig`. Đổi `HOTLOOP_NOTIFY_*` cần khởi động lại mới có hiệu lực, không có API để thêm hay bớt kênh khi đang chạy trong bản MVP này. Chính sách leo thang là ngoại lệ: ai được báo tiếp theo và khi nào là dữ liệu bạn chỉnh sửa và có hiệu lực khi bạn lưu (xem "Leo thang").

**Không phải một bảng riêng.** Mọi lần thử thông báo, thành công hay thất bại, được ghi qua `runtime.Manager.Event`, cùng cơ chế sự kiện kiểm toán tổng quát mà mọi báo động và thao tác đội thiết bị đã ghi qua. Không cần phát minh một bảng `notifications` riêng cho một tính năng cỡ này; nhật ký hệ thống đã trả lời được câu "thông báo có được gửi không, và có chạy được không".

**Không phải một hàng đợi bền vững.** Việc thử lại có giới hạn (ba lần, 30 giây, xem "Thử lại") và các báo động bị giữ nằm trong bộ nhớ cho đến khi bản tóm tắt của chúng đi ra. Một thông báo vẫn thất bại được ghi nhật ký và kiểm toán rồi bộ điều phối chuyển sang việc khác. Một báo động vẫn còn phát sinh vì không ai xác nhận vẫn hiện trên màn hình báo động và trong `alarm_events` bất kể thông báo có bao giờ đến hay không: thông báo là một tiện ích đặt trên hệ thống báo động, không thay thế nó.

## Cấu hình

| Biến | Mặc định | <span class="sr-only">Details</span> |
|---|---|---|
| `HOTLOOP_NOTIFY_ENABLED` | `false` | Tính năng tắt cho đến khi đặt biến này |
| `HOTLOOP_NOTIFY_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_WEBHOOK_URL` | n/a | Bắt buộc khi bật kênh webhook. Phải là `http://` hoặc `https://` |
| `HOTLOOP_NOTIFY_WEBHOOK_MIN_PRIORITY` | `high` | `critical`, `high`, `medium`, `low`, hoặc `1`-`4` |
| `HOTLOOP_NOTIFY_SMTP_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_SMTP_HOST` | n/a | Bắt buộc khi bật kênh SMTP |
| `HOTLOOP_NOTIFY_SMTP_PORT` | `25` | |
| `HOTLOOP_NOTIFY_SMTP_USERNAME` / `_PASSWORD` | n/a | Tùy chọn. Bỏ cả hai nếu là máy chủ chuyển tiếp ẩn danh |
| `HOTLOOP_NOTIFY_SMTP_FROM` | n/a | Bắt buộc khi bật kênh SMTP |
| `HOTLOOP_NOTIFY_SMTP_TO` | n/a | Bắt buộc khi bật kênh SMTP. Các địa chỉ cách nhau bằng dấu phẩy |
| `HOTLOOP_NOTIFY_SMTP_TLS` | `false` | Yêu cầu máy chủ chuyển tiếp cung cấp STARTTLS; xem "TLS trên kênh SMTP" ở trên, STARTTLS được dùng tự động bất cứ khi nào được cung cấp, bất kể cài đặt này |
| `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` | `false` | Bỏ qua kiểm tra chứng chỉ khi nâng cấp STARTTLS, hoặc khi bắt tay TLS ngầm định. Tùy chọn theo từng hệ thống; không bao giờ đặt mặc định |
| `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` | `true` trên cổng 465, còn lại `false` | TLS từ byte đầu tiên thay vì STARTTLS; xem "TLS ngầm định, cổng 465". Đặt nó để ghi đè theo cổng |
| `HOTLOOP_NOTIFY_SMTP_MIN_PRIORITY` | `high` | Cùng các giá trị như của webhook |
| `HOTLOOP_NOTIFY_NTFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_NTFY_URL` | none | Bắt buộc. Chỉ máy chủ, `https://ntfy.example.com`, không có đường dẫn |
| `HOTLOOP_NOTIFY_NTFY_TOPIC` | none | Bắt buộc. 1 đến 64 chữ cái, chữ số, `-` và `_`. Trên máy chủ công khai nó là mật khẩu |
| `HOTLOOP_NOTIFY_NTFY_TOKEN` | none | Một token truy cập ntfy (`tk_...`), gửi dưới dạng bearer token |
| `HOTLOOP_NOTIFY_NTFY_USERNAME` / `_PASSWORD` | none | Xác thực Basic thay cho token. Không dùng cả hai |
| `HOTLOOP_NOTIFY_NTFY_ACK` | `true` | Đặt nút Xác nhận lên mọi báo động (cần `HOTLOOP_PUBLIC_URL`) |
| `HOTLOOP_NOTIFY_NTFY_MIN_PRIORITY` | `high` | Cùng các giá trị như của webhook |
| `HOTLOOP_NOTIFY_GOTIFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_GOTIFY_URL` | none | Bắt buộc. `https://gotify.example.com` |
| `HOTLOOP_NOTIFY_GOTIFY_TOKEN` | none | Bắt buộc. Token ứng dụng mà Gotify cấp cho HotLoop |
| `HOTLOOP_NOTIFY_GOTIFY_MIN_PRIORITY` | `high` | Cùng các giá trị như của webhook |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL` | none | Bắt buộc. URL mà Copy Webhook URL của Discord cấp. Toàn bộ nó là mật khẩu |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE` | none | Id của một vai trò để nhắc khi có báo động Nghiêm trọng |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_MIN_PRIORITY` | `high` | Cùng các giá trị như của webhook |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN` | none | Bắt buộc. Token của bot, riêng nó, không có `Bot ` phía trước |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL` | none | Bắt buộc. Id của kênh để đăng |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` | none | Các id vai trò cách nhau bằng dấu phẩy mà thành viên được nhấn Xác nhận. **Để trống nghĩa là không ai** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES` | none | Tương tự cho Hoãn. **Để trống nghĩa là không ai** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_USERS` | none | `discordUserId=hotloopUser`, cách nhau bằng dấu phẩy: hành động của ai được ghi dưới tên HotLoop của họ |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE` | `1h` | Hoãn trong bao lâu. Tối đa `24h` |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE` | none | Id của một vai trò để nhắc khi có báo động Nghiêm trọng |
| `HOTLOOP_NOTIFY_DISCORD_BOT_MIN_PRIORITY` | `high` | Cùng các giá trị như của webhook |
| `HOTLOOP_NOTIFY_DISCORD_API_URL` | `https://discord.com/api/v10` | Chỉ để gửi yêu cầu của bot qua proxy |
| `HOTLOOP_NOTIFY_<CHANNEL>_BURST` / `_REFILL` | theo từng kênh | Giới hạn tốc độ; xem "Giới hạn tốc độ và bản tóm tắt". `<CHANNEL>` là `WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK` hoặc `DISCORD_BOT` |
| `HOTLOOP_PUBLIC_URL` | none | Địa chỉ mà điện thoại dùng để truy cập HotLoop, gồm cả đường dẫn gốc. Cần cho việc chạm để mở và nút Xác nhận |
| `HOTLOOP_NOTIFY_ACK_SECRET` | tự tạo | Ký các liên kết xác nhận. Ít nhất 32 ký tự. Không đặt: được tạo một lần và giữ trong cơ sở dữ liệu |
| `HOTLOOP_NOTIFY_ACK_TTL` | `12h` | Liên kết xác nhận hoạt động trong bao lâu. Tối đa `168h` |

Trong Helm chart, chúng nằm dưới `notify.ntfy`, `notify.gotify`, `notify.discordWebhook`, `notify.discordBot`, `notify.ackSecret`, `notify.ackTtl` và `publicUrl` ở cấp cao nhất. Token, mật khẩu và URL webhook Discord nằm trong một Secret do chart quản lý, hoặc chỉ định Secret của riêng bạn bằng `existingSecret`.

## API

| Tuyến | Quyền | <span class="sr-only">Details</span> |
|---|---|---|
| `POST /api/notify/test` | `notify.test` | Gửi một thông báo thử giả lập qua mọi kênh đã cấu hình ngay lập tức |
| `POST /api/notify/ack/{token}` | không; token là sự cho phép | Xác nhận lần phát sinh của báo động mà token được cấp cho. Xem "Liên kết xác nhận" |
| `GET /api/notify/escalation` | `notify.escalation` | Chính sách leo thang, các kênh mà một bước có thể nêu tên, và các chuỗi đang mở ngay lúc này. Xem "Leo thang" |
| `PUT /api/notify/escalation` | `notify.escalation` | Thay toàn bộ chính sách. Bị từ chối kèm lý do nếu một bước không nêu ai hoặc nêu một kênh chưa được cấu hình |
| `GET /api/diagnostics` | `status.read` | Dưới `notify.channels`, tình trạng của từng kênh: Discord có từ chối nó không (và vì sao, từ khi nào), và kết nối Gateway của bot Discord |

`notify.escalation` cũng chỉ dành cho quản trị viên theo cách tương tự. Đọc chính sách cũng cần quyền này, vì nó chứa chủ đề ntfy của mọi người.

`notify.test` chỉ dành cho quản trị viên, được cấp bởi ký tự đại diện mà vai trò quản trị viên đã có và cố ý không thêm vào danh sách quyền của vai trò người vận hành, vì gửi một tin nhắn thật ra bên ngoài và tiêu tốn hạn mức mà nhà cung cấp nhắn gọi hay máy chủ chuyển tiếp SMTP cho phép thì gần với `fleet.restart` và `fleet.config` (cũng chỉ dành cho quản trị viên, cũng là "làm gì đó với thế giới bên ngoài ngay bây giờ") hơn là một thao tác đọc, cùng cách thu hẹp mà ứng dụng này đã áp dụng cho hai quyền đó.

Phản hồi báo cáo kết quả của từng kênh thay vì một kết quả đạt hay hỏng chung cho cả yêu cầu:

```json
{
  "results": [
    {"channel": "webhook", "success": true},
    {"channel": "smtp", "success": false, "error": "dial smtp server mail.example.com:587: i/o timeout"}
  ]
}
```

## Những gì đã và chưa được kiểm chứng

HotLoop đã được chạy với thiết bị thật và máy chủ thật, và trên bare metal vào 2026-11-17.
