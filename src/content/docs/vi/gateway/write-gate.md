---
title: "Cổng ghi: ghi an toàn xuống thiết bị"
description: "Mọi lệnh ghi, từ màn hình, API, quy tắc, script, công thức hay tác nhân, đều đi qua một hàm. Hàm kiểm tra gì theo thứ tự nào và các từ chối trả lời ra sao."
sidebar:
  label: "Cổng ghi"
---

Hệ thống này có thể làm máy móc chuyển động. Vì vậy dưới đây là chính xác những gì nằm giữa một yêu cầu và một thiết bị, theo đúng thứ tự mã chạy.

Mọi giá trị đi tới thiết bị đều qua **một hàm duy nhất không thể đi vòng**: một cú nhấp trên màn hình, `POST /api/write`, một lệnh gọi dịch vụ thực thể, một tự động hóa, một script, một công thức, một tác nhân qua MCP. Chính sách nằm ở đó và chỉ ở đó, vì một phép kiểm tra sao chép ra sáu nơi là phép kiểm tra mà ai đó quên thêm vào nơi thứ bảy, và nơi thứ bảy luôn là nơi ghi xuống chiếc máy ép đang chạy. Một bài kiểm thử làm bản dựng thất bại nếu có bất kỳ thứ gì trong runtime chạm tới thao tác ghi của thiết bị mà không qua cổng, và nó chứng minh mình có thể thất bại bằng cách cài bốn kiểu đi vòng vào một bản sao của gói rồi bắt được từng kiểu.

Muốn tự cảm nhận thay vì đọc? [hotloop.io có một bản tương tác](https://hotloop.io/gateway/#the-gate). Bật tắt các công tắc, gửi một giá trị đặt và xem chính xác nó bị chặn ở đâu.

## Các bước kiểm tra, theo thứ tự

1. **Bên gọi được phép ghi.** Bước này diễn ra ở cửa của API, trước cổng. Người dùng đã đăng nhập cần `values.write` để gọi `POST /api/write`: vận hành viên và quản trị viên có, người xem thì không, và nếu thiếu thì API trả 403. Cửa của tác nhân là bearer token MCP, nếu thiếu thì nhận 401 và thậm chí không thấy danh sách công cụ. Dù thế nào, cổng cũng không hề hay biết, nên nó không nằm trong nhật ký kiểm toán ghi. (Lệnh gọi dịch vụ thực thể hoạt động khác, [bên dưới](#mọi-cửa-cùng-một-cổng).)
2. **Ghi đang bật.** `safety.allowWrites`, công tắc tổng. Mặc định tắt từ 4.4.0.
3. **Ghi của tác nhân đang bật.** `safety.allowMcpWrites`, chỉ được kiểm tra khi yêu cầu đến qua MCP. Nó thu hẹp công tắc tổng và không bao giờ vượt qua được nó: khi ghi bật mà cái này tắt, vận hành viên có thể ra lệnh cho tag còn tác nhân thì không. Nếu bật nó khi `safety.allowWrites` tắt, Gateway từ chối khởi động, thay vì để bạn đoán cái nào thắng.
4. **Tag đã được kích hoạt.** Mọi tag chỉ đọc cho đến khi ai đó đánh dấu `writable`, từng cái một và có chủ ý. Nhập duyệt 4.000 tag không kích hoạt tag nào. Tag không tồn tại cũng bị từ chối ở đây.
5. **Giá trị nằm trong khoảng.** Khi tag có một khoảng và giá trị là số, giá trị nằm ngoài khoảng sẽ **bị từ chối, không bao giờ bị cắt ngọn**. Người gõ 500 cho tag tối đa 400 đã mắc lỗi và cần biết điều đó. Âm thầm gửi 400 là làm điều không ai yêu cầu, và họ không bao giờ biết.
6. **Kiểm tra riêng của bên gọi đạt.** Thực thể bổ sung những gì chỉ nó biết: bước nhảy và khoảng hẹp hơn của một số, mẫu và độ dài của văn bản, các lựa chọn, đầu ra của một vòng điều khiển bị từ chối trừ khi vòng đang ở chế độ thủ công, thực thể bị tắt hoặc xóa giữa lúc gọi. Bước này chạy bên trong cổng, sau chính sách và khoảng của tag để vận hành viên luôn nghe về tag trước, và trước dòng kiểm toán để từ chối của thực thể được ghi y như từ chối của tag. Nó chỉ có thể từ chối. Nó không thể đổi giá trị hay cho qua thứ mà cổng sẽ chặn.
7. **Thiết bị đang chạy.** HotLoop có một worker đang chạy cho nó. Thiết bị bị tắt, hoặc chưa từng khởi động, bị từ chối bằng `the device is not connected` thay vì ném một giá trị vào hư không.

**Chỉ khi đó dòng kiểm toán mới được mở, và chỉ khi đó giá trị mới đi ra.** Nếu dòng không ghi được, lệnh ghi hoàn toàn không được gửi. Một lệnh ghi không kiểm toán được là lệnh mà sau này không ai giải trình được, và với thiết bị chuyển động thì đó không phải cái giá đáng đổi. Dòng được hoàn tất bằng kết quả và độ trễ trong một ngữ cảnh tách khỏi yêu cầu, nên lệnh ghi hết thời gian hoặc bị hủy vẫn ghi lại điều đã xảy ra.

Mọi từ chối từ bước 2 trở đi đều được kiểm toán như một từ chối: một dòng có người thực hiện, nguồn, giá trị được yêu cầu, giá trị lẽ ra bị thay thế và `refused:` kèm lý do, cộng một cảnh báo trong nhật ký hệ thống. Ai cứ liên tục cố ra lệnh cho tag mà họ không được phép thì sẽ vô hình nếu không được ghi lại, và kỹ sư cần tìm thấy điều đó về sau. Bước 1 không nằm trong kiểm toán ghi, vì cổng chưa từng thấy nó.

### Vì sao theo thứ tự đó

Chính sách chạy trước khi dòng kiểm toán mở, nên một từ chối được ghi là từ chối chứ không phải một lần thử tình cờ thất bại. Dòng kiểm toán mở trước khi giá trị chạm tới dây, nên một lệnh ghi bị treo, hoặc kéo sập cả tiến trình, vẫn để lại bằng chứng rằng nó đã được thử. Trên sàn nhà máy, "chúng tôi không biết lệnh đó đã đi ra chưa" là câu trả lời tệ nhất.

### Một điều bước 7 không bắt được

Bước 7 hỏi thiết bị có worker hay không, không hỏi phiên của nó có đang hoạt động đúng lúc này hay không. Một thiết bị vừa rớt mạng và đang kết nối lại vẫn qua được. Dòng kiểm toán mở, driver không có phiên, và lệnh ghi thất bại với `the device is not connected`, được ghi là một lần thử thất bại chứ không phải từ chối. Dù sao cũng không có gì tới được thiết bị. [Chạy thử](#hỏi-trước-khi-gửi-chạy-thử) kiểm tra cả phiên, và nói rõ điều đó ngay từ đầu.

## Mỗi từ chối trả lời gì

Mã trạng thái cho biết vấn đề thuộc về ai, vì vận hành viên đọc nó như vậy.

| Điều đã xảy ra | Lỗi nói rằng | HTTP |
|---|---|---|
| Không có quyền, ở cửa | `<user> does not have the "values.write" permission` | 403 |
| Ghi đang tắt | `writes are disabled on this deployment` | 403 |
| Ghi của tác nhân đang tắt | `writes from MCP clients are disabled on this deployment` | 403 |
| Tag chưa được kích hoạt | `this tag is not marked writable` | 403 |
| Thực thể bị tắt | `the entity is disabled` | 403 |
| Tag không tồn tại | tag đó và `not found` | 404 |
| Thực thể biến mất giữa lúc gọi, hoặc không ở trạng thái cho phép (một vòng không ở chế độ thủ công) | điều đã thay đổi | 409 |
| Giá trị nằm ngoài khoảng của tag | `value is outside the tag's configured range` | 422 |
| Thực thể không chấp nhận giá trị (bước nhảy, mẫu, lựa chọn, khoảng riêng) | `the value is not one this entity accepts` và lý do | 422 |
| Thiết bị không được kết nối | `the device is not connected` | 503 |
| Thiết bị đã trả lời và nói không | chính lời của thiết bị | 502 |
| Lệnh ghi không kiểm toán được, hoặc bất cứ điều gì khác mà API không xếp loại được | `internal error (ref …)`, kèm chi tiết trong nhật ký máy chủ dưới mã tham chiếu đó | 500 |

Mọi thứ API không xếp loại được đều là 500. Trước đây nó là 400, nghĩa là sự cố cơ sở dữ liệu báo cho vận hành viên rằng họ đã gõ sai, và họ đi tìm một lỗi gõ không hề có.

Qua MCP không có mã trạng thái. Một từ chối trả về dưới dạng kết quả công cụ được đánh dấu `isError`, bằng chính lời của cổng:

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
write refused: press-01/Zone1_Temp: this tag is not marked writable
```

Đó là một câu trả lời, không phải lỗi truyền tải. Lệnh gọi đã được hiểu và cố ý từ chối, và thử lại sẽ nhận cùng một câu trả lời.

## Hỏi trước khi gửi: chạy thử

Cổng có điểm vào thứ hai chỉ hỏi mà không làm. Nó chạy cùng các bước kiểm tra, theo cùng thứ tự, và đưa cùng nội dung lỗi khi từ chối. Nó không mở dòng kiểm toán, không phát sự kiện, không đếm gì và không bao giờ chạm tới thiết bị. Nó còn đi xa hơn lệnh ghi thật một bước: thiết bị có worker chạy nhưng phiên đã mất sẽ được báo là không kết nối, thay vì "việc này sẽ đi ra".

Lấy nó ở đâu:

- **Lệnh gọi dịch vụ thực thể**: `POST /api/services/{domain}/{service}?dry_run=true`. Trả 200 kèm phán quyết: mỗi lệnh ghi nó sẽ thực hiện là `would_write`, hoặc lệnh đầu tiên sẽ bị từ chối là `not_sent`, kèm lý do nguyên văn. Một yêu cầu thậm chí không thể lập kế hoạch (không có thực thể đó, dịch vụ mà miền không nhận, dữ liệu sai) trả về cùng trạng thái như lệnh gọi thật. `dry_run` chỉ nhận `true` hoặc `false`, còn `yes` là 400, vì đoán sai hướng sẽ biến một câu hỏi thành một mệnh lệnh.
- **Dấu nhắc lệnh** hỏi ngay khi bạn gõ và hiện "Would be refused: ..." trước khi ai đó xác nhận.
- **Script**, mới trong 4.17.0: `POST /api/scripts/{id}/run?dry_run=true`, **Check first** trong ngăn chạy, hoặc `run_script` của MCP với `dryRun`. Mỗi bước được đi qua đối chiếu với nhà máy ở trạng thái hiện tại, và lệnh ghi đầu tiên sẽ bị từ chối kết thúc lượt đi bằng lời của cổng. Xem [Script](/vi/iot/scripts/).
- **Công thức**, mới trong 4.17.0: mọi mục tiêu đều qua các bước kiểm tra này trước khi giá trị đầu tiên đi ra, và một giá trị xấu làm cả công thức bị từ chối mà không ghi gì. `POST /api/recipes/{id}/validate` và `validate_recipe` của MCP hỏi mà không áp dụng. Xem [Công thức](/vi/iot/recipes/).
- **Blueprints**, mới trong 4.17.0: **Check first** cho thấy quy tắc sẽ làm gì nếu kích hoạt ngay bây giờ, mọi lệnh ghi đều qua các bước kiểm tra này, trước khi quy tắc tồn tại. Xem [Blueprints](/vi/iot/blueprints/).

Một lần chạy thử sạch là lời khuyên, không phải lời hứa. Cổng vẫn quyết định ở lệnh ghi thật, vì thiết bị có thể rớt, hoặc ai đó có thể vô hiệu hóa một tag, giữa câu hỏi và lệnh của bạn.

:::caution[Vẫn dùng 4.16.0? Dấu nhắc có thể nuốt mất một lệnh Set]
Ở 4.16.0, phán quyết chạy thử hiện ra khoảng một phần tư giây sau khi bạn ngừng gõ, đúng lúc chuột đang di tới Set, và dấu nhắc nở ra hoặc co lại bên dưới nó. Set dịch khoảng 30px, nên cú nhấp rơi vào khoảng trống, hoặc vào nền và đóng dấu nhắc. Vận hành viên thấy nó đóng, tưởng giá trị đặt đã đi ra, và không có gì được ghi. Đã sửa trong 4.17.0: phán quyết nằm cạnh các nút và không có gì dịch chuyển. Cho đến khi bạn [nâng cấp](/vi/gateway/upgrading/), hãy kiểm tra giá trị thực sự đã đổi sau khi bấm Set.
:::

## Mọi cửa, cùng một cổng

- **Các màn hình và `POST /api/write`.** Người thực hiện là tên người dùng đã đăng nhập, không phải một header ai cũng đặt được.
- **Dịch vụ thực thể**, `POST /api/services/{domain}/{service}`. `switch.turn_on` trên `switch.press_01_pump` là một lệnh ghi tag qua cổng này, được kiểm toán theo thực thể với entity_id, dịch vụ và một mã cuộc gọi. Một lần bấm nút là hai lệnh ghi dưới cùng một mã cuộc gọi. Người dùng không có `values.write` ở đây không bị chặn ở cửa: quyền còn thiếu được chuyển cho cổng như kiểm tra riêng của bên gọi, nên một lệnh gọi thực thể bị từ chối được kiểm toán theo thực thể, kèm giá trị được yêu cầu, như mọi từ chối khác, và vẫn trả 403.
- **Tự động hóa** ghi dưới tên `automation:<rule-id>`. Một quy tắc không có nhiều đặc quyền hơn một con người. Xem [Tự động hóa](/vi/iot/automations/).
- **Script**, mới trong 4.17.0, ghi dưới tên `script:<id>` và giữ nguồn của người khởi chạy, nên một script do tác nhân kích hoạt va vào công tắc tác nhân y như `write_tag` của chính tác nhân đó.
- **Công thức**, mới trong 4.17.0, ghi mọi mục tiêu dưới cùng một mã cuộc gọi, nên `GET /api/writes?call=<id>` là toàn bộ lần áp dụng trong dấu vết kiểm toán.
- **Tác nhân** ghi dưới tên `mcp:<client name>`. `write_tag` và `call_service` qua các bước kiểm tra giống vận hành viên, và cả hai từ chối chạy nếu không nêu lý do, lý do này được ghi vào nhật ký hệ thống cạnh lệnh ghi. Một dòng kiểm toán mà sáu tháng sau không ai giải thích được chỉ là một dấu thời gian với lương tâm cắn rứt. `trigger_automation` từ chối hoàn toàn khi ghi của tác nhân đang tắt, `run_script` và `apply_recipe` cũng vậy, vì một quy tắc, script hay công thức có thể ra lệnh cho thiết bị và nếu không sẽ là đường đi vòng qua công tắc. Xem [Model Context Protocol](/vi/iot/mcp/).

## Vì sao ghi mặc định tắt

Trước 4.4.0, `safety.allowWrites` và `safety.allowMcpWrites` mặc định là `true`. Giờ chúng là `false`. Một tag luôn chỉ đọc cho đến khi được kích hoạt, nhưng một bản cài mới không nên chỉ cách một cờ `writable` là đã ra lệnh được cho thiết bị trước khi có ai xem qua.

Trên cổng, `safety.confirmWrites` (mặc định bật) khiến màn hình xin xác nhận trước khi gửi bất cứ thứ gì. Đó là một lời nhắc trong trình duyệt, không phải một phép kiểm tra trong cổng, và là thiết lập an toàn duy nhất bạn đổi được từ màn hình Cài đặt. `safety.allowWrites` và `safety.allowMcpWrites` chỉ đọc ở đó là cố ý: quyền điều khiển tổng về việc tiến trình này có ra lệnh được cho thiết bị hay không không nên nằm sau chính phiên trình duyệt đang phát lệnh ghi.

## Bật ghi, một cách có chủ ý

1. Thêm thiết bị và khám phá tag của nó nơi giao thức có thể liệt kê. Modbus và S7comm không thể tự liệt kê các điểm của mình, nên hãy khai báo chúng từ tài liệu của thiết bị.
2. Đánh dấu tag là ghi được từng cái một, và chỉ những cái bạn muốn.
3. Đặt `safety.allowWrites: true` trong tệp giá trị của bạn và chạy `helm upgrade`. Cho đến khi bạn làm vậy, không bước nào trong bước 1 và 2 có thể làm một van chuyển động.
4. Chỉ khi các tác nhân cũng cần ra lệnh cho thiết bị, hãy đặt `safety.allowMcpWrites: true`.

## Những gì nó không làm

Ứng dụng không thể ép buộc mọi thứ, và nói ra thì tốt hơn là để bạn tự cho là có.

- **Nó không phải khóa liên động.** Một ngắt bảo vệ con người hoặc nhà máy thuộc về PLC, đấu dây cứng ở nơi cần thiết, không thuộc về thứ gì chạy trên mạng.
- **Nó không giám sát broker của bạn.** Nếu bạn đẩy lệnh nút tới edge relay qua MQTT, kiểm soát truy cập của chính broker phải giới hạn ai được phát hành chúng ở thông tin xác thực của Gateway.
- **Máy chủ OPC UA hoàn toàn không thể ghi.** Nó chỉ đọc, không có bộ xử lý ghi và không có thiết lập nào thêm vào, nên SCADA đọc nó không thể ra lệnh gì qua nó.
