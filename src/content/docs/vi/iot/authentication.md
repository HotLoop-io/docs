---
title: "Xác thực và người dùng"
description: "Đăng nhập, vai trò, token và màn hình người dùng, cùng những gì một hệ thống đặt sau proxy tin cậy phải khai báo rõ để bỏ qua chúng."
---

HotLoop có đăng nhập riêng từ phiên bản 4.4.0, và mọi sản phẩm đều bắt buộc đăng nhập theo mặc định. Chạy không cần đăng nhập vẫn còn, một cách có chủ đích, dành cho hệ thống thực sự được cô lập sau bảng điều khiển và muốn nói rõ điều đó, xem [Chạy không cần đăng nhập](#chạy-không-cần-đăng-nhập), nhưng một lệnh `helm install` trần hay một unit Podman Quadlet giờ đây khởi động với yêu cầu đăng nhập.

## Tóm tắt

- **Người dùng cục bộ, mật khẩu bcrypt, phiên phía máy chủ.** Chưa có nhà cung cấp danh tính bên ngoài, xem [MCP](/vi/iot/mcp/) về vành đai bearer token riêng bảo vệ giao diện tác tử, vành đai mà cơ chế này không thay thế.
- **Ba vai trò: admin, operator, viewer.** Admin làm được mọi việc, kể cả quản lý người dùng. Operator đọc được mọi thứ, ghi tag, xác nhận báo động và kích hoạt tự động hóa. Viewer đọc được mọi thứ và không làm gì khác. Một người dùng cũng có thể được cấp danh sách quyền tường minh thay cho vai trò, cho những nhu cầu hẹp hơn.
- **Một phiên là cookie hoặc bearer token**, tùy máy khách thấy tiện hơn. Giao diện trình duyệt dùng cookie; script hoặc dịch vụ khác dùng `Authorization: Bearer <token>`.
- **Bảng điều khiển dùng chung đăng nhập bằng mã PIN hoặc thẻ** và tự đăng xuất khi không ai chạm vào, nên mọi lần ghi ở đó đều mang tên một con người. Xem [Bảng kiosk](#bảng-kiosk-mã-pin-hoặc-thẻ-và-tự-đăng-xuất-khi-nhàn-rỗi).
- **Phiên hết hạn.** `HOTLOOP_AUTH_SESSION_TTL`, mặc định 12 giờ. Không có "ghi nhớ đăng nhập", vì một phiên kéo dài hơn ca làm việc là một phiên không ai trông chừng.

## Lấy tài khoản đầu tiên

Chart tạo một tài khoản ở lần cài đặt đầu tiên và chỉ hiển thị một lần, trong phần NOTES của `helm install`:

```
helm install hotloop ./charts/hotloop \
  --namespace hotloop --create-namespace
```

Khi chạy trực tiếp tệp nhị phân, hãy tạo một mã băm và đặt hai biến:

```sh
hotloop hash-password
# Password: ********
# Confirm password: ********
# $2a$10$....................................................

export HOTLOOP_AUTH_ENABLED=true
export HOTLOOP_ADMIN_USER=admin
export HOTLOOP_ADMIN_PASSWORD_HASH='$2a$10$....................................................'
```

`hash-password` cũng nhận `-password` trực tiếp, cho script đã có sẵn mật khẩu:

```sh
hotloop hash-password -password 'something-long'
```

Tài khoản admin được tạo ra ở đây là **khởi tạo ban đầu**, không phải công tắc đặt lại. Khi nó đã tồn tại, việc đổi `HOTLOOP_ADMIN_PASSWORD_HASH` rồi khởi động lại không có tác dụng gì, `EnsureAdminUser` chỉ tạo tài khoản nếu tên người dùng đó chưa tồn tại, nên giá trị ở đây không bao giờ ghi đè được mật khẩu mà người vận hành đã đổi qua giao diện. Điều này quan trọng nhất khi nâng cấp Helm: áp dụng lại cùng một `values.yaml` không được lặng lẽ khôi phục mật khẩu của ai đó.

## Vai trò

| Vai trò | Làm được gì |
|---|---|
| **admin** | Mọi thứ: `*`. Kể cả tạo, vô hiệu hóa và xóa người dùng. |
| **operator** | Đọc mọi màn hình. Ghi tag (`POST /api/write`) và ra lệnh cho thực thể (`POST /api/services/...`), đặt helper (`helpers.write`, xem [Helper](/vi/iot/helpers/)), chạy và dừng script (`scripts.run`, xem [Script](/vi/iot/scripts/)), áp dụng recipe (`recipes.apply`, xem [Recipe](/vi/iot/recipes/)), tạo quy tắc từ blueprint và nâng cấp quy tắc đó (`blueprints.apply`, xem [Blueprint](/vi/iot/blueprints/)), xem các bảng điều khiển dành cho vai trò đó (`dashboards.read`, xem [Bảng điều khiển](/vi/iot/dashboards/)), đọc năng lượng đã dùng và chi phí (`energy.read`, xem [Năng lượng](/vi/iot/energy/); tạo đồng hồ đo hay biểu giá là `energy.write`, của admin), sắp xếp lại bảng, xác nhận/hoãn/bỏ hoãn báo động, kích hoạt tự động hóa. Không sửa được *định nghĩa* thiết bị, tag, báo động, tự động hóa, script, recipe, blueprint hay bảng điều khiển, và không quản lý được người dùng. |
| **viewer** | Đọc mọi màn hình. Không làm gì khác. |

Một người dùng có thể được cấp danh sách `permissions` tường minh thay cho vai trò, danh sách này **thay thế** hoàn toàn vai trò chứ không cộng thêm, một người dùng hoặc là "vai trò operator" hoặc là "đúng những quyền này", không bao giờ cả hai, nên chỉ có một nơi để xem ai đó làm được gì.

Chuỗi quyền có dạng `resource.action`, như `tags.write`, `alarms.ack`, hoặc ký tự đại diện cho tài nguyên, `tags.*`, hoặc ký tự đại diện toàn cục `*`.

## Bảng kiosk: mã PIN hoặc thẻ, và tự đăng xuất khi nhàn rỗi

Trên máy tính của chính bạn, bạn đã đăng nhập sẵn: bạn nhập mật khẩu một lần, và một lần ghi đi thẳng qua cổng ghi và được ghi tên bạn, như trước nay. Điều đó không thay đổi. Một bảng treo trên tường không phải máy tính của ai. Nếu nó đăng nhập là `panel-3`, nhật ký kiểm toán sẽ ghi "panel-3 đã mở van", và đó không phải là nhật ký kiểm toán. Vì vậy bảng cho một người đăng nhập bằng mã PIN hoặc thẻ, mọi lần ghi là của người đó, và bảng tự đăng xuất họ khi không ai chạm vào.

### Người vận hành thấy gì

Một bảng là một màn hình vật lý: HotLoop được mở tại `/?screen=<name>` (xem [Bảng điều khiển](/vi/iot/dashboards/#vai-trò-và-màn-hình)). Khi chưa ai đăng nhập, bảng chỉ hiện một ô, "PIN hoặc thẻ", và không có gì của nhà máy. Nhập PIN rồi nhấn Enter, hoặc quét thẻ. Bảng mở bảng điều khiển của nó, kèm người đang đăng nhập và nút **Đăng xuất** ở góc, vì phần đầu trang thường nói điều đó không có trên bảng. Khi nhấn một nút ghi, bảng hỏi xác nhận và lý do như mọi nơi khác, và lần ghi được ghi nhận cho người đó.

Sau thời hạn nhàn rỗi mà không ai chạm vào màn hình, bảng đăng xuất người đó và quay lại ô nhập PIN. Máy chủ cũng thực thi điều này chứ không chỉ trang: một phiên kiosk đã nhàn rỗi chừng đó thời gian sẽ bị xóa, và một lần ghi gửi kèm cookie của nó sau đó bị từ chối với `401`, nên đóng trang, hoặc một trang bị treo, không để ai đó vẫn đăng nhập. Nếu bảng phải dùng mật khẩu, "Dùng mật khẩu" bên dưới ô là cách đăng nhập thông thường, với 12 giờ thông thường và không có giới hạn nhàn rỗi, vì đó là đăng nhập riêng của người đó.

Những gì được tính là chạm: một lần chạm, một cú nhấp, một phím, hoặc một lần ghi. Những gì không: bảng điều khiển làm mới các con số, hoặc luồng trực tiếp, vốn vẫn chạy dù có ai ở đó hay không.

### Thiết lập

Admin cấp cho mỗi người một mã trong **Cài đặt, Người dùng**: **PIN hoặc thẻ** trên hàng của họ, nhập mã hai lần, **Đặt**. Hoặc qua API, cách mà một script cấp thẻ sẽ dùng:

```sh
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"482913"}' https://gateway/api/users/olga/pin

# Take it away (also signs them out of every panel)
curl -X DELETE -H "Authorization: Bearer $TOKEN" https://gateway/api/users/olga/pin
```

- **PIN là một thông tin xác thực.** Nó được lưu dưới dạng mã băm bcrypt với cùng chi phí như mật khẩu, không bao giờ ở dạng rõ, không bao giờ trong nhật ký hệ thống và không bao giờ trong phản hồi. Danh sách người dùng chỉ ghi `hasPin`. Một bản sao lưu giữ các mã băm này đúng như giữ mã băm mật khẩu ([Sao lưu và khôi phục](/vi/iot/backup/)).
- **Thẻ là một giá trị mà đầu đọc kiểu bàn phím gõ ra.** Không có trình điều khiển phần cứng. Một đầu đọc hoạt động như bàn phím gõ số của thẻ vào một ô duy nhất của bảng rồi nhấn Enter, tức là biểu mẫu được gửi. Vì vậy thẻ là một mã như PIN: bất cứ thứ gì đầu đọc gõ, từ 6 đến 72 ký tự và không có khoảng trắng, được đặt trên tài khoản ở cùng chỗ. Đọc từ đầu đọc không hoạt động như bàn phím thì chưa được xây dựng.
- **Một mã, một tài khoản.** Bảng tìm ra người đó chỉ bằng mã, vì đầu đọc thẻ không gõ tên người dùng, nên việc đặt một mã mà tài khoản khác đang dùng sẽ bị từ chối.
- **Mã được kiểm tra với mọi tài khoản có mã,** bằng cùng bcrypt như mật khẩu, vì mã băm có salt không thể tra cứu theo giá trị. Việc đó mất thời gian tương ứng số tài khoản có mã, tệ nhất vài giây khi có hàng chục tài khoản, và mất cùng thời gian dù mã đúng hay sai.
- **Một mã đăng nhập với vai trò của tài khoản.** Hãy đưa nó cho người có vai trò đúng với những gì họ nên có ở bảng. Một phiên kiosk là quyền của chính tài khoản và không hẹp hơn, và mã của một viewer đăng nhập một viewer, mà những lần ghi của họ cổng vẫn từ chối như mọi khi.
- **Vô hiệu hóa một tài khoản** kết thúc các phiên bảng của nó cùng với các phiên khác, và mã của tài khoản bị vô hiệu hóa không đăng nhập được. **Gỡ mã đi** sẽ đăng xuất tài khoản khỏi các bảng và để nguyên mật khẩu cùng phiên trên máy tính riêng của họ.

### Thời gian tự đăng xuất khi nhàn rỗi

Mặc định là mười lăm phút. Đủ dài để làm xong một lần chuyển ca tại bảng với tập giấy trên tay, hoặc đi bộ tới van và thấy nó chuyển động, và đủ ngắn để một bảng bị bỏ lại cuối ca không còn mang tên ai đó khi người tiếp theo bước tới. Đó là đánh giá của tôi, không phải con số mà mã nguồn hay một tiêu chuẩn quy định. Hãy đổi trong **Cài đặt, Nhà máy, Tự đăng xuất kiosk khi nhàn rỗi (giây)**, từ 10 giây đến 12 giờ, không cần triển khai lại, hoặc đặt mặc định bằng `HOTLOOP_AUTH_KIOSK_IDLE` (một khoảng thời gian, `15m`). Giá trị trong Cài đặt thắng biến môi trường. Phiên vẫn kết thúc ở `HOTLOOP_AUTH_SESSION_TTL`, như mọi phiên.

### Khóa sau khi nhập sai mật khẩu và PIN

Một mật khẩu hoặc PIN sai được tính cho **tài khoản** bị thử. Mười lần sai liên tiếp sẽ khóa tài khoản đó năm phút, và không ảnh hưởng ai khác. Nhập đúng mật khẩu hoặc PIN trước lần thứ mười thì bộ đếm bắt đầu lại, và một khóa đã hết hạn cho mười lần mới. Một tài khoản bị khóa từ chối đăng nhập dù nhập gì, đúng hay sai, với `429` cho biết phải chờ bao lâu. Khóa chỉ chặn các lần đăng nhập mới và không chặn gì khác: phiên mà tài khoản đã có vẫn tiếp tục, kể cả các yêu cầu và luồng trực tiếp, nên mười lần đoán sai của người khác không làm tắt màn hình của người vận hành trên dây chuyền. Nó áp dụng cho đăng nhập bằng mật khẩu và bằng PIN như nhau, và mỗi lần khóa đều có trong nhật ký hệ thống (danh mục `auth`).

- **Các con số đến từ đâu.** NIST SP 800-63B nói rằng bên xác minh giới hạn số lần thử thất bại liên tiếp trên một tài khoản: bản 3, mục 5.2.2, và bản 4, mục 3.2.2, đều đặt mức tối đa là 100 và nói rằng người vận hành có thể đặt thấp hơn. Bản 4 cũng cho phép bắt người xác thực chờ sau các lần thất bại. Đây chính là sự chờ đó, không phải vô hiệu hóa vĩnh viễn. Mười là một phần mười mức trần của NIST, và nhiều hơn số lần ai đó gõ nhầm vô ý. Năm phút đủ dài để mười lần đoán mỗi năm phút giữ một triệu khả năng của PIN sáu chữ số ngoài tầm với (khoảng 350 ngày để thử hết), và đủ ngắn để một người vận hành gõ nhầm mật khẩu quay lại sau một tách cà phê. Sáu ký tự là tối thiểu cho PIN theo mục 5.1.1.2 của bản 3, mức sàn cho bí mật được cấp phát, đúng như khi admin phát PIN. Mười và năm là lựa chọn của tôi trong giới hạn của NIST, không phải con số của NIST.
- **Cả hai đều là cài đặt.** **Cài đặt, Nhà máy**: "Khóa tài khoản sau chừng này lần sai mật khẩu hoặc PIN" (mặc định 10, từ 1 đến 100, và 0 để tắt) và "Tài khoản bị khóa giữ khóa bao lâu" (mặc định 5 phút, từ 10 giây đến một ngày). Các biến là `HOTLOOP_AUTH_LOCKOUT_ATTEMPTS` và `HOTLOOP_AUTH_LOCKOUT_DURATION` (một khoảng thời gian, `5m`). Cài đặt thắng biến môi trường.
- **Admin có thể mở khóa một tài khoản.** **Cài đặt, Người dùng** hiện tài khoản bị khóa là `locked` kèm nút **Mở khóa**, hoặc `DELETE /api/users/{username}/lockout`. Bộ đếm bắt đầu lại từ số không.
- **Không bao giờ khóa bảng.** Một mã sai nhập tại bảng không bao giờ bị tính cho bảng, nên lỗi của một người không chặn người kế tiếp.
- **Một mã đứng riêng không đếm được, nên bảng bị làm chậm thay vào đó.** Đầu đọc thẻ chỉ gõ thẻ, và một PIN gõ riêng không khớp tài khoản nào khi sai, nên không có tài khoản nào để tính. Tính cho bảng sẽ khóa người kế tiếp vì lỗi của người trước, mà bảng không bao giờ bị khóa. Thay vào đó, mỗi lần sai liên tiếp khiến bảng đó chờ lâu thêm nửa giây trước khi kiểm tra lần kế: 0,5 giây sau lần trượt đầu, 1 giây sau lần hai, và cứ thế, đến mức trần, mặc định 3 giây. Một lần đúng sẽ bắt đầu lại. Vì vậy người kế tiếp vào được sau tối đa mức trần, còn người đoán mò chỉ được một lần thử cho mỗi mức trần trên mỗi bảng: một triệu PIN sáu chữ số sẽ mất hơn một tháng. Các lần thử gửi cùng lúc xếp hàng và mỗi lần chờ đến lượt. Một PIN nhập kèm tên người dùng không bị làm chậm; nó thuộc về tài khoản, và khóa tài khoản như một mật khẩu sai. Thời gian chờ dài nhất là **Cài đặt, Nhà máy, Thời gian chờ dài nhất của bảng sau PIN sai (giây)**, từ 0 đến 30, với `HOTLOOP_AUTH_PANEL_DELAY_CAP` làm mặc định (một khoảng thời gian, `3s`) và 0 để tắt. Ba giây là khoảng dừng mà một công nhân gõ nhầm chịu được, và đủ chậm để có ý nghĩa với người thử mọi mã. Bước nửa giây là cố định.
- **Bảng nào là bảng nào.** Địa chỉ máy khách: bước nhảy đầu tiên của `X-Forwarded-For` khi proxy có đặt, nếu không thì địa chỉ của chính kết nối, cũng là thứ mà danh sách phiên ghi lại. Trước khi đăng nhập không biết gì tốt hơn: chưa có phiên, và một cookie do máy chủ phát ra là thứ máy khách có thể vứt đi để bắt đầu lại thời gian chờ. Vì vậy sau một proxy có đặt `X-Forwarded-For`, mỗi bảng chờ riêng. Sau proxy không đặt, mọi bảng dùng chung địa chỉ của proxy và làm chậm lẫn nhau, tối đa bằng mức trần. Và một máy khách truy cập thẳng được vào cổng có thể tự gửi `X-Forwarded-For` để né thời gian chờ. Vì thế đây là biện pháp làm chậm, còn khóa trên tài khoản mới là biện pháp kiểm soát: với kiểu đoán mò đáng lo, hãy dùng dạng có tên người dùng, hoặc giá trị thẻ dài và ngẫu nhiên.
- **Nó cho biết tài khoản tồn tại.** `429` dành cho tài khoản có thật, nên nó cho kẻ đang thử tên biết tên nào có. Khóa vốn là như vậy.

### Những gì nó không làm

- **Một mã đứng riêng không thể bị khóa.** Xem [Khóa](#khóa-sau-khi-nhập-sai-mật-khẩu-và-pin), nơi nói rõ lý do.
- **Không cảnh báo trước khi đăng xuất.** Bảng quay lại ô PIN khi hết giờ.
- **Một bảng để nguyên đăng nhập bằng mật khẩu** (cách phải chạy bảng trước đây) vẫn hoạt động như cũ và vẫn ghi dưới tài khoản đó. Đừng cho bảng dùng chung một đăng nhập operator thường trực; hãy cấp PIN cho những người ở đó.
- **Không có trình điều khiển đầu đọc, không có SSO, không có quyền theo từng bảng.**

## Quản lý người dùng

Chỉ admin. Trong giao diện là **Cài đặt, Người dùng**: mọi tài khoản cùng vai trò, đang bật hay không, và lần đăng nhập gần nhất, với Thêm người dùng, Sửa (vai trò, và tắt tài khoản), Mật khẩu mới và Xóa. Không có gì được vẽ ra cho người không có `users.manage`, hoặc khi xác thực đang tắt. Một tài khoản có quyền được liệt kê từng cái hiện là `custom` kèm số lượng, và Sửa giữ danh sách trừ khi bạn chọn một vai trò, vai trò đó sẽ thay thế danh sách. Cũng những việc ấy qua REST API:

Mật khẩu dài từ 8 đến 72 byte: 72 là giới hạn của chính bcrypt, và mật khẩu dài hơn bị từ chối kèm lý do đó. Nó hoạt động như vậy cả qua OPC UA (xem [Máy chủ OPC UA](/vi/edge/opc-ua-server/#ai-được-đăng-nhập)); ở các bản phát hành trước, một mật khẩu trên 64 byte có thể đăng nhập ở đây mà không đăng nhập được ở đó.

```sh
# List
curl -H "Authorization: Bearer $TOKEN" https://gateway/api/users

# Create
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"username":"j.smith","password":"something-long","role":"operator"}' \
  https://gateway/api/users

# Disable (does not delete; also revokes every session that account holds)
curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"role":"operator","disabled":true}' \
  https://gateway/api/users/j.smith

# Reset a password an operator forgot
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"password":"a-new-one"}' \
  https://gateway/api/users/j.smith/password
```

Có hai lần từ chối đáng biết trước khi chúng làm ai bất ngờ:

- **Bạn không thể xóa tài khoản của chính mình khi đang đăng nhập bằng nó.** Hãy chuyển sang tài khoản admin khác trước.
- **Bạn không thể vô hiệu hóa hay xóa tài khoản admin đang bật cuối cùng.** Hãy nâng một tài khoản thứ hai lên admin, hoặc để yên một tài khoản, trước khi gỡ tài khoản đầu tiên. Không có kiểm tra này, chỉ một sai sót trong lần đồng bộ người dùng bằng script là bị khóa ngoài mà không còn phiên admin nào để hoàn tác.

Bất kỳ người dùng nào đang đăng nhập cũng có thể đổi mật khẩu của chính mình mà không bị hai hạn chế trên:

```sh
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"currentPassword":"old","newPassword":"new"}' \
  https://gateway/api/auth/password
```

Đổi mật khẩu sẽ thu hồi mọi phiên mà tài khoản đó đang giữ, kể cả phiên đã gửi yêu cầu. Máy khách được kỳ vọng sẽ đăng nhập lại.

## Thông tin xác thực của thiết bị chỉ ghi

Được thêm ở 4.15.1. Trước đó, `GET /api/devices` và `GET /api/devices/{id}` trả về `config` và `address` của thiết bị đúng như đã lưu, nên mọi người dùng đã đăng nhập, kể cả viewer, đều đọc được mật khẩu broker MQTT, thông tin xác thực HTTP và MTConnect, và mọi thứ khác được lưu trong thiết bị. 4.15.0 chỉ ẩn mật khẩu OPC UA. Từ 4.15.1, thông tin xác thực của thiết bị không thể đọc lại qua API bởi bất kỳ vai trò nào, **kể cả admin**. Muốn đổi một giá trị, bạn gửi giá trị mới.

### Cái gì được coi là thông tin xác thực

| Giao thức | Bị ẩn trong cấu hình | Cũng bị ẩn |
|---|---|---|
| MQTT | `password` | thông tin người dùng và giá trị truy vấn bí mật trong địa chỉ (`mqtt://user:pass@broker`) |
| HTTP | `password`; mọi giá trị trong `headers` trừ một vài giá trị thông thường (`Accept`, `Accept-Encoding`, `Accept-Language`, `Cache-Control`, `Content-Type`, `User-Agent`); `body` và `writeBody` khi chúng nhắc đến thông tin xác thực (`password`, `token`, `apiKey` và tương tự); giá trị truy vấn trông như bí mật trong `writeUrl` | thông tin người dùng và giá trị truy vấn bí mật trong địa chỉ và trong `writeUrl` |
| MTConnect | `password`; mọi giá trị trong `headers`, với cùng các ngoại lệ | thông tin người dùng và giá trị truy vấn bí mật trong địa chỉ |
| OPC UA | `password` | thông tin người dùng trong địa chỉ cũng bị ẩn, và trình điều khiển bỏ qua nó, vì URL điểm cuối OPC UA không mang thông tin xác thực |
| Modbus, S7comm, EtherNet/IP | không tùy chọn nào của chúng là thông tin xác thực | thông tin người dùng trong địa chỉ bị ẩn và bị trình điều khiển bỏ qua, vì cùng lý do |

Đường dẫn đến một tệp khóa (`keyFile`) không phải là vật liệu khóa nên được hiển thị. Cờ như `allowInsecureCredentials` cũng vậy.

Các danh sách trên được kiểm tra trong mã. Một bài kiểm thử đọc cấu trúc tùy chọn của mọi trình điều khiển và thất bại khi một tùy chọn không nằm trong danh sách thông tin xác thực cũng không nằm trong danh sách các tùy chọn đã biết không phải thông tin xác thực (`plainConfigKeys`), khi một map các mục tự do hay một trường văn bản tự do không nằm trong danh sách thông tin xác thực, và khi một trong hai danh sách nêu tên thứ mà không trình điều khiển nào đọc. Nhờ vậy một tùy chọn mới không thể được phát hành khi chưa ai quyết định nó thuộc loại nào.

Như một tấm lưới an toàn bên dưới các danh sách, mọi khóa ở bất kỳ độ sâu nào trong cấu hình của thiết bị đều bị ẩn theo tên, ở bất kỳ giao thức nào, khi nó chứa `password`, `passwd`, `passphrase`, `pwd`, `secret`, `token`, `apikey`, `authorization`, `credential`, `private`, `bearer`, `cookie`, `basicauth`, `signature`, `jwt`, `oauth`, `sessionid`, hoặc `connectionstring`, hoặc kết thúc bằng `key`, hoặc có nguyên một từ trong số `pass`, `pw`, `pwd`, `passwd`, `auth`, `cred`, `creds`, `sig`, `signature`, `sas`, `jwt`, `otp`, `pin`, hoặc `psk`. Các từ được tách ở dấu câu và ở ranh giới chữ thường sang chữ hoa, nên `db_pass`, `smtp_pw`, `apiAuth`, và `sasToken` được tính còn `bypass`, `compass`, `passive`, `authority`, và `pinned` thì không. Chữ hoa chữ thường và dấu câu bị bỏ qua, cả những cách viết mà `encoding/json` vẫn đọc là cùng một khóa (chữ s dài thay cho s, ký hiệu Kelvin thay cho k). Quy tắc từ ngắn cố ý thô: một khóa chưa ai xem xét, như `authMode`, bị ẩn cho đến khi nó được thêm vào `plainConfigKeys`.

Một giá trị bị ẩn theo tên, và mọi thứ bên dưới một khóa như vậy, bị thay thế bất kể kiểu của nó (một số cũng bị ẩn như một chuỗi), trừ boolean, vốn không thể là thông tin xác thực. Một chuỗi mang thông tin xác thực trong văn bản của nó bị ẩn toàn bộ ở bất cứ đâu: một dòng lệnh có `--password hunter2`, một cặp `password=...` hay một chuỗi kết nối, `Authorization: Bearer ...`. Một thiết bị không có thông tin xác thực nào thì không hiện gì, nên "không có mật khẩu" và "có mật khẩu mà tôi không nhìn thấy" phân biệt được. Một cấu hình không đọc được dưới dạng JSON được hiển thị là `{}` chứ không phải nguyên dạng.

Một giá trị bị ẩn hiện là `[redacted]`. Trong một địa chỉ, nó thay mật khẩu và giữ tên người dùng (`http://svc:[redacted]@meter/api`), hoặc toàn bộ thông tin người dùng khi không có dấu hai chấm, và giá trị của mỗi tham số trông như bí mật trong truy vấn và trong phần mảnh (`?fmt=json&token=[redacted]`, `#access_token=[redacted]`). Các tham số được ngăn cách bằng `&` hoặc `;`, hoặc bằng dạng mã hóa phần trăm `%26` và `%3B`, và mỗi tham số được xét riêng, nên `?fmt=json` vẫn đọc được. Một tham số tên `code` được coi là bí mật trong địa chỉ, vì khóa Azure Functions trong `?code=`, và không nơi nào khác. Một truy vấn không đọc sạch được (chuỗi thoát phần trăm không hợp lệ, ký tự điều khiển) bị ẩn toàn bộ thay vì đoán.

### Lưu một thiết bị

`POST /api/devices` tạo thiết bị khi id là mới và thay thế khi id đã tồn tại. Không có `PUT` riêng. Với mọi thông tin xác thực trong địa chỉ và cấu hình:

| Yêu cầu gửi gì | Kết quả |
|---|---|
| Thiết bị mới với một giá trị thật | Giá trị được lưu đúng như đã cho. |
| Thiết bị mới với `[redacted]` | Bị từ chối với lỗi 400. Giá trị giữ chỗ không bao giờ được lưu làm thông tin xác thực. |
| Thiết bị đã có, `[redacted]` | Giá trị đã lưu được giữ lại. |
| Thiết bị đã có, bỏ khóa đó | Giá trị đã lưu được giữ lại. Một máy khách không biết về bí mật không thể vô tình xóa chúng. |
| Thiết bị đã có, một chuỗi hoặc số mới | Nó thay thế giá trị đã lưu. |
| Thiết bị đã có, một chuỗi rỗng hoặc `null` | Nó xóa giá trị đã lưu. Đây là cách duy nhất để gỡ một thông tin xác thực. |
| `[redacted]`, khi không có gì đã lưu để giữ | Bị từ chối với lỗi 400. |

Giá trị giữ chỗ không bao giờ được lưu, dù xuất hiện ở đâu trong cấu hình hay địa chỉ: nó được thay bằng giá trị đã lưu ở cùng vị trí, hoặc bị từ chối khi không có.

Hai chi tiết. Bên trong `headers` (một map mà các mục do người dùng chọn) thì map là đơn vị: mục nào bỏ ra sẽ bị xóa, `{}` xóa tất cả, và bỏ cả khóa `headers` thì giữ lại tất cả. Khóa được so khớp không phân biệt chữ hoa chữ thường, như cách các trình điều khiển so khớp. Và mọi thứ không phải thông tin xác thực được thay thế như trước nay: một thiết bị được lưu mà không có `config` nào giữ lại thông tin xác thực của nó và không gì khác.

Trình chỉnh sửa thiết bị trên giao diện web hiển thị cấu hình của thiết bị đúng như API trả về, kể cả các giá trị giữ chỗ, và lưu những gì nó hiển thị. Do đó, chỉnh sửa một thiết bị mà không động đến thông tin xác thực thì giữ nguyên chúng. **Để đổi một bí mật trên giao diện, hãy thay `[redacted]` trong cấu hình (hoặc trong địa chỉ) bằng giá trị mới.** Không có gì được điền sẵn bằng giá trị cũ, nên người đổi một thiết bị phải biết thông tin xác thực mới đổi được.

### Di chuyển một thiết bị không mang theo bí mật của nó

Thông tin xác thực được giữ lại sẽ được gửi đến nơi thiết bị trỏ tới. Nếu chúng được giữ khi thiết bị bị di chuyển, bất kỳ ai được phép lưu một thiết bị đều đọc được thông tin xác thực đã lưu bằng cách trỏ nó vào một bộ lắng nghe của riêng họ và để cổng kết nối trình ra. Vì vậy khi một lần lưu đổi máy chủ hoặc cổng trong địa chỉ, hay trong `writeUrl`, và sẽ giữ một thông tin xác thực đã lưu (bằng giá trị giữ chỗ hoặc bằng cách bỏ khóa), nó bị từ chối với lỗi 400 nêu tên các thông tin xác thực đó. Hãy nhập lại chúng, hoặc gửi một chuỗi rỗng để xóa. Đổi đường dẫn, lược đồ, hay bất kỳ điều gì khác về thiết bị không tính là di chuyển, và một thiết bị không có thông tin xác thực đã lưu có thể di chuyển tự do.

### Nơi thông tin xác thực không xuất hiện

Với thiết bị của mọi giao thức, có thông tin xác thực ở mọi chỗ nó có thể có, các bài kiểm thử tìm nó trong: mọi điểm cuối thiết bị (phản hồi liệt kê, lấy, tạo và cập nhật) cho viewer, operator và admin; mọi điểm cuối đọc khác; `/api/diagnostics` và `/api/status`; `/api/sites` và các máy chủ MCP đi ra mà nó liệt kê; luồng sự kiện trực tiếp; nhật ký hệ thống và kiểm toán ghi; các phản hồi lỗi; mọi công cụ và tài nguyên MCP; và nhật ký tiến trình ở mức gỡ lỗi, từ runtime và từ các trình điều khiển. Văn bản lỗi của trình điều khiển cũng như sự kiện và nhật ký của runtime được làm sạch thông tin xác thực của thiết bị, theo giá trị và theo hình dạng, vì một lỗi có thể lặp lại một địa chỉ hay phản hồi của máy chủ. Một thông tin xác thực chỉ một hai ký tự chỉ bị thay khi nó đứng riêng như một từ, vì thay ở mọi nơi sẽ làm hỏng thông điệp.

### Nơi thông tin xác thực vẫn ở dạng rõ

Chỉ ghi là về API. Cổng cần giá trị thật để kết nối, và những nơi này giữ chúng đúng như đã lưu:

- **Cơ sở dữ liệu.** Thông tin xác thực thiết bị nằm trong các cột `config` và `address`. Khi đặt `HOTLOOP_SECRET_KEY_FILE`, các giá trị có khóa trong `config` (mọi `password`, giá trị header) được mã hóa bằng một khóa giữ ngoài cơ sở dữ liệu, và một địa chỉ hay một tùy chọn có thông tin xác thực viết trong văn bản của nó (`mqtt://user:pass@host`, `?token=`) cũng vậy, được niêm phong toàn bộ. Xem [Sao lưu và khôi phục](/vi/iot/backup/#thông-tin-xác-thực-thiết-bị-và-khóa-bí-mật).
- **Bản sao lưu.** `devices.copy` trong một bản sao lưu giữ chúng, được mã hóa hoặc không đúng như cơ sở dữ liệu. Xem [Sao lưu và khôi phục](/vi/iot/backup/#bảo-vệ-các-tệp-sao-lưu).
- **Tệp thiết bị của Edge Relay.** Relay đọc một tệp JSON mang thông tin xác thực của các thiết bị của nó. Xem [Tham chiếu Edge Relay](/vi/edge-relay/reference/#thông-tin-xác-thực-trong-tệp-thiết-bị-4150).
- **Đẩy cấu hình đội thiết bị.** Một tệp thiết bị được đẩy tới relay được xuất bản lên một chủ đề MQTT, ở dạng lưu giữ, nguyên như vậy. Xem [Quản lý đội thiết bị](/vi/gateway/fleet/).

Hãy bảo vệ cơ sở dữ liệu, ổ sao lưu, tệp thiết bị của relay và broker cho tương xứng. Việc che giấu ở API không thay đổi điều nào trong số đó.

### Nếu người dùng không đáng tin có thể đã truy cập API

Trước 4.15.1, bất kỳ người dùng nào đã đăng nhập đều đọc được thông tin xác thực thiết bị đã lưu qua API. Một người vận hành mà cổng của họ từng có thể bị những người không đáng có truy cập (chẳng hạn một tài khoản viewer giao cho nhà thầu) nên đổi thông tin xác thực của các thiết bị mà nó giữ: broker MQTT, các điểm cuối HTTP và MTConnect, và các tài khoản OPC UA. Chưa có bản phát hành công khai nào kể từ 4.3.1, nên mức độ lộ giới hạn ở các hệ thống chạy bản dựng chưa phát hành.

## Nhật ký kiểm toán ghi lại những gì

Mọi lần ghi đã đi qua `write_audit` với một cột `actor`, xem cổng ghi trong README chính. Cột đó giờ lấy từ phiên, không phải từ một header, và tại một bảng kiosk thì phiên là người đã đăng nhập bằng PIN hoặc thẻ:

```
> write_tag tag=press-01/Zone1_Temp value=99 reason="testing"
```

ghi `j.smith`, tên người dùng trên phiên đã thực hiện lời gọi, chứ không phải bất cứ điều gì `X-Forwarded-User` tình cờ nói. Đăng nhập, đăng nhập kiosk, đăng xuất, đổi mật khẩu và mọi thao tác quản lý người dùng, kể cả đặt hay xóa PIN (không bao giờ ghi chính PIN), được ghi vào nhật ký hệ thống (`GET /api/events`, danh mục `auth`) vì cùng lý do mà kiểm toán ghi tồn tại: một thay đổi sáu tháng sau phải giải thích được, chứ không chỉ nhìn thấy được.

## Chạy không cần đăng nhập

Đặt `HOTLOOP_AUTH_INSECURE=true` (hoặc `auth.insecure: true` của chart) để chạy đúng như mọi phiên bản trước 4.4.0: không cần phiên, actor được ghi cho một lần ghi lấy từ `X-EmberNET-User` hoặc header proxy tương tự, và quay về `"operator"` nếu không có gì được đặt.

Đây là một lựa chọn thực tế, có thể bảo vệ được cho hệ thống mà NetworkPolicy của chính bảng điều khiển EmberNet là vành đai thật sự và không gì khác tới được pod. Nó không còn là mặc định vì điều kiện đó dễ tin là đúng mà khó kiểm chứng từ bên trong pod, toàn bộ ý nghĩa của 4.4.0 là một sai sót trong NetworkPolicy, hay một hệ thống hóa ra không nằm sau bảng điều khiển, cũng không được khiến `actor(r)` trả về thứ mà kẻ tấn công đã chọn.

`config.Validate` từ chối khởi động khi xác thực không được bật cũng không được xác nhận theo cách này, chính để "không xác thực" luôn là quyết định ai đó đưa ra có chủ đích, được viết ra trong cấu hình của chính hệ thống, chứ không phải một mặc định không ai chọn.

## Đăng nhập từ bảng điều khiển EmberNet

Một khách hàng cài HotLoop từ EmberNet App Store đi từ LAUNCH vào ứng dụng đã đăng nhập sẵn bằng chính mình, không có mật khẩu nào được phát. Máy chủ ứng dụng của bảng điều khiển đặt `X-Embernet-Assertion` lên mọi yêu cầu nó chuyển đến pod này: một token ES256, có hiệu lực khoảng một phút, ký bằng khóa riêng mà chỉ bảng điều khiển giữ. Nó nêu tên người (`email`), khách hàng, ứng dụng duy nhất mà nó được tạo ra cho (`aud`, `<tenant>/<Service name>`) và vai trò HotLoop mà khách hàng ánh xạ vai trò bảng điều khiển của người đó tới (`role`: `admin`, `operator` hoặc `viewer`).

Nó tắt trừ khi có cấu hình khóa công khai, và khi đó mọi thứ khác vẫn hoạt động như trước: tài khoản cục bộ, cookie, bearer token, bảng kiosk.

| Biến | Giá trị chart | Tác dụng |
|---|---|---|
| `HOTLOOP_AUTH_ASSERTION_PUBLIC_KEY` | `embernetSignin.publicKey` | khóa CÔNG KHAI của bảng điều khiển, PKIX PEM, ECDSA P-256. Cửa hàng điền vào khi triển khai. |
| `HOTLOOP_AUTH_ASSERTION_AUDIENCE` | suy ra từ namespace và tên release | `<tenant>/<Service name>`. Bắt buộc cùng với khóa; token tạo cho ứng dụng hay khách hàng khác bị từ chối. |
| `HOTLOOP_AUTH_ASSERTION_ISSUER` | `embernetSignin.issuer` | `embernet-dashboard` |
| `HOTLOOP_AUTH_ASSERTION_HEADER` | `embernetSignin.header` | `X-Embernet-Assertion` |

Một khẳng định hợp lệ làm gì: người đó có một người dùng ở đây lần đầu bảng điều khiển bảo lãnh cho họ (được đặt tên theo địa chỉ của họ, không có mật khẩu, nên không có gì để đoán mò), vai trò của người dùng theo đúng những gì bảng điều khiển gửi trong mỗi yêu cầu, và nhật ký kiểm toán ghi tên họ. Một khẳng định không hợp lệ làm gì: 401, và nó không được lặng lẽ gạt sang một cookie phiên tình cờ đang có. Bị từ chối là: chữ ký sai, bất kỳ thuật toán nào ngoài ES256, token hết hạn hoặc chưa có hiệu lực, token sống lâu hơn mười phút, nhà phát hành sai, đối tượng của ứng dụng hay khách hàng khác, một claim khách hàng không khớp với đối tượng, một vai trò không phải của chúng tôi, và một tên không có địa chỉ.

Một admin cục bộ giữ tiếng nói cuối cùng với người mà bảng điều khiển đã cho vào: vô hiệu hóa người dùng thì họ không vào được, và cấp cho họ danh sách quyền tường minh thì họ giữ danh sách đó. Việc ghi vẫn cần các công tắc ghi riêng của pod; một khẳng định không bao giờ mở rộng chúng. Đăng xuất khỏi một phiên mà bảng điều khiển tạo ra không kết thúc nó: quyền truy cập kết thúc ở yêu cầu kế tiếp mà bảng điều khiển ngừng ký.

## Những gì chưa được bao gồm

- **Không có OpenID Connect.** Có tài khoản cục bộ, cộng với khẳng định có chữ ký của bảng điều khiển EmberNet ở trên. Tích hợp nhà cung cấp danh tính chưa được xây dựng.
- **Không có vai trò theo khách hàng hay theo địa điểm.** Quyền của một người dùng giống nhau ở mọi nơi Gateway chạy, điều này ổn cho một nhà máy và sẽ cần cân nhắc thêm cho phần tổng hợp nhiều địa điểm trong `Sites`.
- **Không có khóa cho PIN hay thẻ nhập riêng,** chỉ cho mật khẩu và PIN kèm tên người dùng; xem [Khóa](#khóa-sau-khi-nhập-sai-mật-khẩu-và-pin). So sánh an toàn về thời gian trong `handleLogin` ngăn việc dò tên người dùng qua thời gian phản hồi. NetworkPolicy hoặc một proxy phía trước vẫn đáng có trước điểm cuối đăng nhập.
