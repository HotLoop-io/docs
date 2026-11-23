---
title: "Tham chiếu Edge Relay"
description: "Nút Sparkplug B không giao diện, thăm dò rồi chuyển tiếp: nó làm gì, mọi cài đặt, hàng đợi trên đĩa, cấu hình đội thiết bị và cách triển khai."
---

Từ 4.6.0, Edge Relay là tệp nhị phân thứ hai và chạy độc lập: một nút biên Sparkplug B thăm dò rồi chuyển tiếp, không có cơ sở dữ liệu, không có giao diện web, không có xác thực và không có đường ghi. Nó được tạo ra để chạy trên Pi hoặc một PC công nghiệp nhỏ ở biên, chuyển tiếp mọi thứ nó đọc được tới một Gateway đầy đủ chạy ở nơi có cơ sở dữ liệu thực sự, qua cùng bộ xuất bản Sparkplug B mà 4.5.0 đã thêm vào.

Ghi chú của chính 4.5.0 đã nói thẳng điều này: Edge Publish tồn tại như một tính năng có thể bật bên trong tiến trình Gateway đầy đủ, "chưa phải phiên bản Edge Relay nhẹ hơn chạy độc lập." Đây chính là phiên bản đó.

## Nó không phải là gì

**Không phải một Gateway nhỏ hơn với ít tùy chọn hơn.** Đây là một tệp nhị phân khác với tập phụ thuộc nhỏ hơn nhiều. Nó không có cơ sở dữ liệu, giao diện web, xác thực, máy chủ hay máy khách MCP, công cụ tự động hóa và sổ đăng ký thực thể.

**Không thể phục vụ giao diện, nhận lệnh ghi hay trả lời một lệnh gọi công cụ MCP.** Cả ba đều cần thứ mà tệp nhị phân này cố ý không có: một danh tính đã xác thực để ghi nhận hành động. Edge Relay không quyết định gì và không xác nhận lại gì cho con người; nó chỉ đọc và chuyển tiếp.

**Không được cấu hình qua cơ sở dữ liệu và không có API cấu hình riêng.** Thiết bị và tag đến từ một tệp JSON cục bộ được đọc khi khởi động, hoặc từ một tệp mà Gateway đẩy qua broker, được áp dụng ngay (xem [Đẩy cấu hình](#đẩy-cấu-hình-480)). Không có gì trên Relay lắng nghe cấu hình mới: đường vào duy nhất là kết nối broker mà nó đã chủ động mở ra ngoài.

## Các phần khớp nhau thế nào

Bên trong, nó dùng lại chính bộ máy thăm dò của Gateway, không viết lại: cùng worker, cùng mã kết nối lại/lùi thời gian và vòng lặp thăm dò đã chạy thực tế như một phần của Gateway, chạy ở đây không đổi. Điểm khác là *cấu hình và lịch sử đi đâu*.

Mọi thứ sau bước thăm dò, gồm trình điều khiển, bus tag, bộ xuất bản Sparkplug, hàng đợi chuyển tiếp trên đĩa, đều là chính mã mà Gateway dùng khi `HOTLOOP_EDGE_PUBLISH_ENABLED` được đặt. Xem trang Edge Publish để biết bộ xuất bản đó thực sự làm gì: Birth, số thứ tự, đệm qua sự cố mất kết nối, phát lại khi kết nối lại. Không điều nào trong đó thay đổi ở đây; tệp nhị phân này chỉ là một cách khác để đến cùng lệnh gọi `Offer()`.

## Tệp thiết bị

```json
{
  "devices": [
    {
      "id": "press-01",
      "name": "Press 1",
      "protocol": "opcua",
      "address": "opc.tcp://press-01.local:4840",
      "enabled": true,
      "pollIntervalMs": 1000
    }
  ],
  "tags": [
    {
      "deviceId": "press-01",
      "name": "Zone1_Temp",
      "address": "ns=2;s=Zone1.Temp",
      "dataType": "float",
      "enabled": true
    }
  ]
}
```

Tag nhận mọi thứ mà tag của Gateway có, kể cả `noData`: danh sách các giá trị thô có nghĩa là "không có phép đo" (0x8005 của một bộ ghi), mỗi giá trị kèm một lý do, để một kênh chết hiện là lỗi trên Relay và trong luồng Sparkplug thay vì là một con số. Xem [Giá trị không có dữ liệu](/vi/iot/protocols/#giá-trị-không-có-dữ-liệu).

Cả bảy trình điều khiển giao thức của Gateway đều được biên dịch sẵn: OPC UA, Modbus, MQTT/Sparkplug B, EtherNet/IP, S7comm, MTConnect và HTTP. Định dạng tệp thiết bị không có phần nào dành riêng cho Edge Relay.

### Khám phá (4.18.10)

Relay có thể lắng nghe một broker MQTT để tìm các thiết bị tự công bố, giống như Gateway (xem [Khám phá MQTT](/vi/iot/mqtt-discovery/)), rồi đọc và chuyển tiếp những gì nghe được. Hãy khai báo các broker trong tệp thiết bị:

```json
{
  "devices": [],
  "tags": [],
  "discovery": [
    {
      "id": "yard",
      "broker": "10.0.0.5:1883",
      "username": "hotloop",
      "password": "...",
      "prefix": "homeassistant",
      "listenOnly": true,
      "tasmota": true,
      "shelly": true
    }
  ]
}
```

`id` gồm 1 đến 63 chữ thường, chữ số và `-`, và không được là `embedded`. `broker`, `username`, `password`, `useTls` và `insecureSkipVerify` là những giá trị mà mục Cài đặt, MQTT của Gateway nhận, được kiểm tra bằng cùng một mã. `prefix` mặc định là `homeassistant`, còn `tasmota` và `shelly` mặc định bật. Một tệp không khai báo broker nào sẽ không thay đổi gì về cách Relay chạy.

Những gì nghe được trở thành thiết bị và tag, do cùng mã mà Gateway chạy tạo ra (định dạng `homeassistant/`, định dạng riêng của Tasmota, trạng thái của Shelly), và được thăm dò rồi chuyển tiếp qua Sparkplug như bất kỳ thiết bị nào khác. Id của thiết bị được tạo từ id của broker và danh tính mà thiết bị tự khai, luôn giống nhau (`disc-<identity>-<hash>`), nên một Relay khởi động lại vẫn đặt tên metric như cũ. Thiết bị xuất hiện sau vài giây kể từ khi công bố, thiết bị bị rút lại sẽ rời khỏi Birth của nút trong một lần Rebirth, và cả hai đều không làm mất phiên Sparkplug hay hàng đợi chuyển tiếp. Một tệp được đẩy xuống có thêm hoặc bớt broker cũng được áp dụng ngay.

**Không gì mà nó khám phá được có thể được kích hoạt để ghi.** Không phải vì một bước kiểm tra nói vậy. Mọi tag mà khám phá tạo ra đều chỉ đọc, như trên Gateway; mọi thiết bị nó tạo ra đều chưa được chấp nhận; trên Relay không có ai để chấp nhận; và Relay hoàn toàn không có đường ghi, nên một lệnh tới điểm được khám phá, hay tới bất kỳ điểm nào, đều bị từ chối trước khi đến gần thiết bị. Bài kiểm tra cho điều này yêu cầu một Relay đã cho phép ghi bật một máy bơm được khám phá, rồi kiểm tra rằng chủ đề lệnh của máy bơm vẫn im lặng.

Một thiết bị mà bạn có thể ra lệnh đến Relay theo chiều ngược lại: bạn chấp nhận nó trên Gateway, kích hoạt các điểm bạn định dùng, rồi đẩy tệp xuống. Khi tệp có một thiết bị mà Relay cũng nghe thấy (cùng id broker, hoặc cùng địa chỉ và cùng danh tính), tệp sẽ thắng và bản sao được khám phá không được tạo, nên một thiết bị không bao giờ bị chuyển tiếp hai lần.

`listenOnly` bật trừ khi bạn tắt nó, và khi đó Relay không phát hành gì tới broker đó: không phải thông điệp birth khiến bộ xuất bản công bố lại, không phải `status_update` của Shelly, cũng không phải truy vấn nguồn của Tasmota. Một thiết bị chỉ lên tiếng khi có thay đổi sẽ hiện là không rõ cho đến khi nó lên tiếng. Tắt đi thì chỉ những thứ đó được gửi, tới các chủ đề mà DISCOVERY.md nêu.

Relay không giữ lại gì về những gì nó nghe được. Cấu hình `homeassistant/` và Tasmota được giữ retained trên broker và quay lại khi nó khởi động; Shelly báo trạng thái mỗi khi có gì thay đổi, nên một thiết bị im lặng từ khi Relay khởi động sẽ không xuất hiện cho đến khi nó lên tiếng. Điều đó, cùng với việc không có cơ sở dữ liệu để nhớ một thiết bị đã chấp nhận, là điểm khác với Gateway.

`/status` cho biết, dưới `discovery`, với từng broker: có đang lắng nghe và kết nối không, đã nhận, bỏ và từ chối bao nhiêu thông điệp, có bao nhiêu sự cố, cùng số thiết bị và tag mà khám phá đã tạo. Nó không cho biết broker ở đâu, hay sự cố xảy ra trên chủ đề nào.

### Thông tin xác thực trong tệp thiết bị (4.15.0)

Trình điều khiển OPC UA của Relay là của Gateway, nên một thiết bị có thể mang `username` và `password` OPC UA (cùng các tùy chọn bảo mật trong [Giao thức và trình điều khiển](/vi/iot/protocols/#opc-ua-bảo-mật-và-thông-tin-xác-thực)) trong khối `config` của nó, và thiết bị của bất kỳ giao thức nào khác cũng vậy (mật khẩu MQTT và HTTP, tiêu đề HTTP, thông tin xác thực trong địa chỉ). Những giá trị này nằm trong tệp thiết bị dưới dạng văn bản thuần, và Relay không có API nào để che chúng (việc che trong API được thêm vào Gateway ở 4.15.1 không áp dụng cho nó; xem [Xác thực và người dùng](/vi/iot/authentication/#nơi-thông-tin-xác-thực-vẫn-ở-dạng-rõ)), nên nơi đặt tệp rất quan trọng:

- **Trong biểu đồ Helm, hãy dùng `devicesSecret`.** Các thiết bị đặt trong giá trị `devices` và `tags` của biểu đồ được kết xuất thành một ConfigMap, mà bất kỳ ai được phép đọc ConfigMap trong không gian tên đều đọc được, và chúng cũng được lưu trong bản ghi phát hành Helm. Với các thiết bị có thông tin xác thực, hãy đặt cả tệp thiết bị vào một Secret dưới khóa `devices.json` và khai tên nó trong `devicesSecret`; Secret được gắn thay cho ConfigMap, và ConfigMap khi đó không được tạo.
- **Một tệp thiết bị được đẩy xuống cũng mang chúng.** Một tệp được đẩy bằng `POST /api/fleet/{id}/config` được phát hành, ở dạng retained, lên một chủ đề MQTT, nên broker phải dùng TLS và hạn chế ai được đọc `hotloop/edge-relay-config/#`, nếu không bất kỳ ai đăng ký được đều đọc được mọi thông tin xác thực trong đó. Relay ghi tệp được đẩy xuống với chế độ `0600`, trên ổ dữ liệu của nó (`/data/pushed-devices.json` trong biểu đồ và trong đơn vị Quadlet), nên nó cũng nằm trên PVC chứ không phải trong một Secret.
- **Một thiết bị OPC UA được bảo mật giữ một chứng chỉ và một kho tin cậy.** Chúng nằm dưới `/data/opcua-client-pki` (`HOTLOOP_OPCUA_CLIENT_PKI_DIR`), trên cùng ổ lưu trữ bền vững với hàng đợi chuyển tiếp. Khi tắt lưu trữ bền vững của biểu đồ, đó là một emptyDir, nên mỗi Pod mới tạo một chứng chỉ mới và mọi máy chủ được bảo mật phải tin cậy lại (xem "Tắt lưu trữ bền vững" bên dưới); một thiết bị ẩn danh trên kênh không bảo mật thì không bận tâm. Phê duyệt chứng chỉ của máy chủ là thao tác giống như trên Gateway, từ `rejected/` sang `trusted/`, thực hiện trên ổ của Relay.

## Lệnh từ xa (4.7.0)

Hai lệnh Sparkplug NCMD, cả hai đều qua cùng kết nối mà Relay này đã chủ động mở ra ngoài, không cần kết nối đi vào:

- **Khởi động lại** (`Node Control/Reboot`), từ 4.7.0: Relay tự phát hành NDEATH êm thấm rồi thoát, dựa vào bộ giám sát của nó (`Restart=always` của đơn vị Quadlet, hoặc `restartPolicy: Always` mặc định của Deployment) để đưa nó chạy lại.

- **Cập nhật** (`Node Control/Update`): một người vận hành phê duyệt bản cập nhật image mà một Relay đang giữ lại chờ. Nó chỉ có tác dụng với Relay được đặt để giữ cập nhật; xem [Cập nhật một Relay](#cập-nhật-một-relay).

Phía Relay không có gì quyết định ai được gửi các lệnh này; xem trang quản lý đội thiết bị để biết trình quản lý đội thiết bị phía Gateway gửi chúng, và yêu cầu ACL của broker, vốn là ranh giới cấp quyền thực sự.

## Cập nhật một Relay

Một Relay không được Gateway cập nhật. Không thể: Gateway không có cách nào vào máy đó, và Relay không thể tự thay container của mình, nên "cập nhật từ xa" có nghĩa khác nhau với hai cách cài đặt, và trang này nói rõ từng cách, vì một lời hứa mà nền tảng không giữ được còn tệ hơn không hứa.

**Quy tắc là quy tắc mà mọi máy HotLoop đều theo: bám `:stable`, không bao giờ ghim.** Một Relay bị ghim ở `4.17.0` cũ đúng bằng ngày có người cài nó, và không ai nhớ quay lại sàn nhà máy để nâng nó lên. Vì vậy image mà một Relay theo là `ghcr.io/hotloop-io/hotloop-edge-relay:stable`, và mỗi bản phát hành di chuyển thẻ đó. Khác nhau ở chỗ ai khởi động lại Relay lên image đó.

### Quadlet (một Pi hoặc PC công nghiệp nhỏ): tự cập nhật

Đơn vị trong [`deploy/quadlet`](/vi/install/quadlet/) theo `:stable` và mang nhãn mà tính năng tự cập nhật của Podman tìm. Hãy bật bộ hẹn giờ một lần cho mỗi máy:

```sh
sudo systemctl enable --now podman-auto-update.timer
```

Khi bộ hẹn giờ chạy, Podman kéo `:stable`, và nếu digest thay đổi thì khởi động lại đơn vị trên image mới. Ba điều khiến việc để yên là an toàn, và cả ba đều được chứng minh bằng cách chạy thật, không phải bằng cách đọc:

- **Một Relay không thể trở lại sẽ được đưa về như cũ.** Đơn vị có một kiểm tra sức khỏe (`/edge-relay --healthcheck`, vì image không có shell hay curl để chạy một cái) và báo cho systemd rằng nó chưa chạy cho đến khi kiểm tra đó qua. Nếu image mới không bao giờ qua, Podman đưa image trước đó trở lại dưới `:stable` và khởi động nó. Một bản phát hành không khởi động được chỉ tốn vài phút trên một máy, không phải một Relay nằm chết mãi. Trên Podman 4.9 (Ubuntu 24.04), riêng `Notify=healthy` không làm được điều này: nó bị đọc thành `true` thông thường, Relay được coi là đã chạy ngay khi container của nó khởi động, và Podman báo cập nhật thành công trong khi Relay đã chết. Vì lý do đó đơn vị đặt `--sdnotify=healthy` một cách tường minh.
- **Gateway thấy mọi bản cập nhật.** Một Relay đưa phiên bản của nó và digest của image vào mọi Birth. Danh sách đội thiết bị của Gateway hiển thị cả hai cho từng Relay, và ghi một dòng vào nhật ký hệ thống khi một trong hai thay đổi: trước đó là gì, bây giờ là gì, và cả hai digest. Đó là dấu vết kiểm toán, và nó bao gồm bản cập nhật do bất kỳ nguyên nhân nào, kể cả một người vận hành trực tiếp trên máy.
- **Bản cập nhật không đụng đến dữ liệu.** Hàng đợi chuyển tiếp và tệp thiết bị được đẩy xuống nằm trên ổ dữ liệu, thứ mà image mới không động tới. Thứ mất đi là việc thăm dò trong lúc Relay khởi động lại, nhiều nhất vài giây.

Digest mà một Relay báo là những gì `podman image inspect --format '{{.Digest}}'` in ra trên máy đó, chính là thứ mà tự cập nhật theo dõi. Podman có thể biết một image qua nhiều digest (chúng được liệt kê dưới `RepoDigests`) khi một registry lưu định dạng manifest khác với định dạng mà nó làm việc, vì vậy hãy so sánh theo cùng một cách trên mọi Relay, không phải so với tiêu đề của một registry.

### Quadlet, giữ cập nhật cho đến khi người vận hành phê duyệt (tùy chọn)

Một số địa điểm muốn tự quyết định khi nào: một Relay trên dây chuyền không được phép gián đoạn trong ca làm việc. Đó là `edge-relay-hold.conf`, một drop-in của systemd, và nó không bao giờ là mặc định. Khi dùng nó, Relay báo `"updateMode": "approve"`, bộ hẹn giờ tắt, và không có gì cập nhật cho đến khi một quản trị viên gửi `POST /api/fleet/{id}/update` từ Gateway. Khi đó Relay thoát với mã trạng thái 75, systemd khởi động lại nó trên image đang có, và một tác vụ riêng chờ nó khỏe rồi chạy `podman auto-update`: image mới nếu có, với cùng cơ chế quay lui, và một Relay bị gián đoạn vô ích nếu không có. Đã được chứng minh với một bản cập nhật thật được giữ 30 giây trong khi Relay chạy không bị ảnh hưởng, rồi được áp dụng khi phê duyệt.

Hãy biết cái giá của nó. Bộ hẹn giờ phải tắt cho cả máy, vì tự cập nhật của Podman tác động lên mọi container có nhãn và không thể bảo bỏ qua một cái; một máy phải chạy nó cho việc khác thì không thể giữ Relay này. Và Gateway không thể cho bạn biết có một bản cập nhật đang chờ, chỉ biết mỗi Relay đang chạy gì lúc này, nên hãy so sánh danh sách đội thiết bị với những gì `:stable` hiện có trước khi bạn phê duyệt. Một phê duyệt không mang image: Relay chỉ có thể được bảo cập nhật lên những gì đơn vị của chính nó theo.

### Helm: bạn tự chạy `helm upgrade`

Một Pod không thể tự thay thế, và một Deployment là việc của Helm thay đổi, nên biểu đồ không có cập nhật từ xa. `image.tag` của biểu đồ mặc định là `appVersion`, tức bản phát hành, vì vậy:

```sh
helm repo update
helm upgrade edge-relay hotloop/hotloop-edge-relay --reuse-values
```

sẽ cuốn chiếu Pod lên bản phát hành mới. Chiến lược của biểu đồ dừng Pod cũ trước khi khởi động Pod mới (`maxSurge: 0`, vì hàng đợi chuyển tiếp là một tệp một người ghi trên một ổ), nên có một khoảng trống trong lúc nó khởi động. Gateway vẫn thấy phiên bản mới trong Birth kế tiếp của Relay và ghi lại thay đổi. Dưới Helm, một Relay không báo digest của image (một container không thể thấy digest của chính nó, và Kubernetes không đưa xuống), chỉ báo phiên bản. `Node Control/Update` không làm gì ở đây và Relay nói vậy trong nhật ký của nó; Helm chính là sự phê duyệt.

### Những gì không có ở đây, và vì sao

- **Image có chữ ký và danh sách digest được phép.** Gateway không thể thực thi cả hai trên một máy mà nó không có cách nào vào, và một kiểm tra mà Relay tự chạy là kiểm tra mà một Relay bị xâm nhập sẽ bỏ qua. Podman có thể xác minh chữ ký khi kéo về (`policy.json`), đó là nơi hiệu quả; ở đây không thiết lập chính sách đó cho bạn, và `:stable` được tin cậy như bất kỳ thẻ nào.
- **Triển khai theo giai đoạn.** Mọi Relay trên một máy theo cùng một thẻ bằng bộ hẹn giờ riêng, nên một đội thiết bị cập nhật trong khoảng trải của bộ hẹn giờ chứ không theo từng đợt, và cơ chế quay lui ở trên là thứ giới hạn một bản phát hành xấu. Để chia giai đoạn có chủ ý, hãy giữ các địa điểm cần chờ bằng drop-in giữ cập nhật và phê duyệt chúng theo thứ tự bạn muốn.

## Đẩy cấu hình (4.8.0)

Một tệp thiết bị mới có thể được đẩy trên một chủ đề MQTT riêng, thông thường (không phải Sparkplug), ở dạng retained. Xem mục "Đẩy cấu hình" của trang quản lý đội thiết bị để biết phía Gateway. Cho đến 4.17, một lần đẩy chỉ chuẩn bị sẵn tệp và Relay tiếp tục thăm dò danh sách cũ cho đến khi có gì đó khởi động lại nó. Điều đó khiến mọi thay đổi về những gì một Relay thăm dò thành một lần khởi động lại Relay, phiên broker của nó và mọi phiên thiết bị mà nó giữ, trên một máy vốn được cho là nằm đó hàng tháng mà không ai đụng tới. Giờ một lần đẩy được áp dụng ngay khi nó đến.

- Đẩy khi Relay này **đang chạy**: các byte được kiểm tra bằng cùng quy tắc mà `LoadDeviceFile` áp dụng khi khởi động, lưu vào `HOTLOOP_EDGE_RELAY_PUSHED_FILE` (hoặc ghi đè lên `HOTLOOP_EDGE_RELAY_DEVICES_FILE` khi biến đó chưa đặt; xem bên dưới), và áp dụng ngay. Lưu trước là có chủ ý: một danh sách đã chạy nhưng chưa bao giờ được lưu sẽ lặng lẽ quay về cái cũ ở lần khởi động sau.
- **Một lần đẩy sai bị từ chối và danh sách cũ tiếp tục chạy.** Một tệp không phân tích được, không qua được kiểm tra (một thiết bị trùng, một tag trên thiết bị chưa ai khai báo, một giao thức không rõ) hoặc không lưu được thì không thay đổi gì: không phải các thiết bị đang chạy, không phải tệp trên đĩa. Nhật ký nói lý do, và `/status` dưới `config.rejected` cũng vậy, là nơi màn hình đội thiết bị của Gateway lấy thông tin.
- Đẩy khi Relay này **ngoại tuyến**: không có gì ở đó để nhận cho đến lần khởi động tiếp theo, lúc đó Relay cho một lần đẩy retained vài giây để đến *trước khi* nó nạp tệp thiết bị cục bộ, nên nó khởi động thẳng vào tệp đó. Một lần đẩy đến sau vài giây ấy được áp dụng ngay như bất kỳ lần nào khác.
- Broker trả lại lần đẩy retained ở mỗi lần kết nối lại. Relay biết tệp đang chạy qua sha256 của nó, nên cùng các byte đến lần nữa không thay đổi gì.

### Áp dụng trực tiếp giữ lại gì và đổi gì

Relay tính xem giữa tệp đang chạy và tệp mới có gì thay đổi, từng thiết bị một, và chỉ đụng tới phần đó:

- **Một thiết bị không đổi giữ nguyên phiên của nó.** Cùng kết nối TCP tới PLC, cùng đăng ký OPC UA, không có khoảng trống trong các giá trị đọc.
- **Một thiết bị đã đổi** (địa chỉ, giao thức, chu kỳ thăm dò, thời gian chờ, khối config hoặc các tag) được kết nối lại với định nghĩa mới.
- **Một thiết bị mới** được kết nối và bắt đầu thăm dò.
- **Một thiết bị bị gỡ** (hoặc giờ là `"enabled": false`) bị ngắt kết nối.
- **Phiên Sparkplug vẫn giữ.** Không có NDEATH, không kết nối lại, cùng bdSeq, và hàng đợi chuyển tiếp không bị đụng tới. Một lần nạp lại trong lúc broker gặp sự cố để mọi giá trị đọc đã đệm nằm trong hàng đợi; chúng được xả khi broker trở lại, giống như khi không nạp lại.

Trên đường truyền, theo Sparkplug B. Relay là một nút biên và mỗi tag là một metric của nút tên `device/tag`, nên cái thay đổi là tập metric của nút, và Sparkplug cho một nút đúng một cách để thay đổi nó: một NBIRTH mới, thay thế toàn bộ cái cuối cùng. Vì vậy:

- **Các metric đã biến mất** (một thiết bị bị gỡ, một tag bị gỡ hoặc bị tắt) được gửi thêm một lần trong một NDATA với giá trị null, rồi nút làm Rebirth mà không có chúng: cùng phiên, cùng bdSeq, seq về 0, cùng kiểu Rebirth như khi nhận `Node Control/Rebirth`. Có null là vì một host được phép giữ giá trị cuối của một metric mà Birth mới bỏ ra, và chính host Sparkplug của Gateway làm đúng như vậy. Không có null, một van bạn đã gỡ khỏi Relay sẽ nằm mãi ở giá trị đọc tốt cuối cùng, trông như khỏe mạnh.
- **Các metric mới** đi vào một Birth ở lần thăm dò đầu tiên của thiết bị, giống như mọi metric khi khởi động. Một Birth không bao giờ nêu tên một metric khi chưa có giá trị đọc đứng sau nó.
- **Các giá trị đọc của một tag bị gỡ còn trong hàng đợi chuyển tiếp** bị bỏ khi hàng đợi xả, kèm một dòng nhật ký đếm chúng. Birth của nút không còn mang metric đó, và Sparkplug không có cách hợp lệ nào để gửi một metric mà nó không mang, nên gửi sẽ có nghĩa là một bí danh mà không host nào từng được báo.

Sửa tay tệp thiết bị cục bộ vẫn cần khởi động lại: Relay đọc nó khi khởi động và khi một lần đẩy bị xóa, và không theo dõi nó. Với biểu đồ, đó cũng chính là điều một `helm upgrade` thay đổi `devices` làm.

### Tệp được đẩy nằm ở đâu, và tệp nào thắng

Cả hai cách cài đặt được hỗ trợ đều gắn tệp thiết bị cục bộ ở chế độ chỉ đọc: biểu đồ từ một ConfigMap (hoặc Secret), đơn vị Quadlet bằng bind `:ro`, và cả hai trên hệ thống tệp gốc chỉ đọc. Cho đến 4.16.0, Relay ghi một lần đẩy ngay cạnh tệp đó, nên trên cả hai cách cài đặt, mỗi lần đẩy đều chết với

```
a pushed config was rejected; keeping the current one and continuing to run
error="write /etc/edge-relay/devices.json.tmp: open /etc/edge-relay/devices.json.tmp: read-only file system"
```

và Relay tiếp tục thăm dò danh sách cũ. Gateway báo `config pushed`, việc khởi động lại đã qua, và không có gì thay đổi. Điều đó đã được sửa bằng cách cho lần đẩy một chỗ ở riêng:

- **`HOTLOOP_EDGE_RELAY_PUSHED_FILE`** là nơi một lần đẩy được ghi. Biểu đồ đặt nó thành `/data/pushed-devices.json` trên PVC (`pushedDevicesFile` trong values.yaml), và đơn vị Quadlet đặt cùng đường dẫn đó trên ổ dữ liệu có tên của nó. Cả hai đều tồn tại lâu hơn container, và PVC tồn tại lâu hơn một lần lên lịch lại. Phần cuối cùng đó là có chủ ý: một emptyDir cũng ghi được, nhưng nó mất ngay khi Pod di chuyển, và một Relay lặng lẽ quay về danh sách thiết bị cũ sau khi rút nút là cùng một lỗi mặc áo khác.
- **Tệp được đẩy thắng.** Khi khởi động, Relay nạp tệp được đẩy nếu nó tồn tại, và tệp cục bộ chỉ khi nó không tồn tại. Điều đó đúng sau một lần khởi động lại, sau một lần lên lịch lại, sau khi broker mất lần đẩy retained (một lần khởi động lại Mosquitto không có lưu trữ bền vững), và sau một `helm upgrade` thay đổi `devices` hoặc `tags`. Lần đẩy là thay đổi mới hơn, có chủ ý, và broker sẽ trả lại bản retained ngay ở lần khởi động tiếp theo, nên để tệp cục bộ thắng chỉ kéo dài một lần khởi động lại. Những dòng đầu của nhật ký cho biết nó khởi động từ tệp nào: `booting from the pushed device file; the local one is ignored until the push is cleared`
- **Quay lại tệp cục bộ** (`devices` của biểu đồ, hoặc `/etc/edge-relay/devices.json` trong Quadlet) là `DELETE /api/fleet/{id}/config` trên Gateway. Lệnh xóa xóa lần đẩy retained trên broker, nên không lần khởi động nào sau đó áp dụng nó, và một Relay đang kết nối vào lúc đó sẽ nạp tệp cục bộ của nó, xóa tệp được đẩy của nó, ghi nhật ký `the config push was cleared; the local device file takes over`, và áp dụng ngay tệp cục bộ, cùng cách một lần đẩy được áp dụng. Nếu tệp cục bộ không nạp được, Relay giữ tệp được đẩy đang chạy và trên đĩa và nói vậy trong nhật ký và trong `/status`: xóa nó trước sẽ để lại một Relay khởi động vào một tệp hỏng ở lần khởi động lại kế tiếp. Hãy sửa tệp cục bộ rồi gửi lại lệnh xóa. Hãy làm khi Relay đang **trực tuyến**. Một lệnh xóa không được giữ retained, nên một Relay đã ngoại tuyến vào lúc đó không bao giờ nghe thấy và giữ tệp được đẩy của nó; hãy cho nó chạy lên rồi gửi lại lệnh xóa. Lặp lại là an toàn.
- Một tệp được đẩy tồn tại nhưng không nạp được (lỗi đĩa, hoặc một bản phát hành sau có quy tắc nghiêm hơn) được ghi nhật ký là lỗi và Relay khởi động từ tệp cục bộ thay vì nằm chết vì nó.
- Khi `HOTLOOP_EDGE_RELAY_PUSHED_FILE` chưa đặt, một lần đẩy ghi đè lên chính `HOTLOOP_EDGE_RELAY_DEVICES_FILE`, đó là hành vi của 4.8.0. Điều đó chỉ dùng được cho một tệp nhị phân trần có tệp thiết bị ghi được, và khi đó không có bản sao riêng để một lệnh xóa bỏ đi.

Nếu một lần đẩy "không có tác dụng", hãy xem nhật ký của Relay trước tiên. Hoặc nó cho biết đã khởi động từ tệp nào, hoặc nó cho biết vì sao lần đẩy bị từ chối.

## Giao diện HTTP

Hai endpoint, cả hai đều không xác thực, cả hai đều chỉ đọc:

- `GET /healthz`, tiến trình đang chạy. Không hơn. Một thiết bị bị ngắt kết nối không có nghĩa là tiến trình này không khỏe.
- `GET /status`, một ảnh chụp nhanh: số thiết bị theo trạng thái kết nối, số tag, độ sâu hiện tại của hàng đợi chuyển tiếp, danh sách giao thức đã biên dịch sẵn, và `uplink`: broker có đang kết nối không, có đang phát lại không, và hàng đợi chuyển tiếp đang giữ gì, nặng bao nhiêu trên đĩa và đã bỏ bao nhiêu ở giới hạn (xem trang Edge Publish, "Khi đường lên bị mất"). Không có giá trị tag, không có địa chỉ thiết bị, không có cấu hình; đây là một bề mặt giám sát, không phải bản sao nhỏ hơn của bảng điều khiển Gateway. `version`, `imageDigest` và `updateMode` cho biết đó là bản dựng nào và nó có giữ cập nhật không. Nó cũng cho biết tệp thiết bị nào đang chạy, dưới `config`: `source` (`local` hoặc `pushed`), `path`, `digest` sha256 của nó, `appliedAt`, và `rejected`, tệp cuối cùng mà Relay từ chối và vì sao, cho đến khi một lần đẩy sau đó được áp dụng. Là digest, không phải tệp: Gateway có thể đối chiếu nó với những gì nó đã đẩy mà địa chỉ và thông tin xác thực trong tệp không bị đưa ra qua một cổng không xác thực. Với một broker `discovery` trong tệp, nó cũng cho biết, dưới `discovery`, từng broker đang ra sao và nó đã tìm thấy bao nhiêu thiết bị (xem [Khám phá](#khám-phá-41810)).

Cố ý không có xác thực phía trước cả hai: một Edge Relay không có cơ sở dữ liệu người dùng, không có kho phiên và không có hệ thống danh tính để xây dựng chúng, và thêm một token dùng chung duy nhất sẽ chỉ là màn trình diễn chứ không phải bảo mật, cho hai endpoint không để lộ gì nhạy cảm. Hãy chạy nó phía sau bất kỳ vành đai mạng nào mà chính thiết bị đang nằm sau, cùng kỳ vọng mà chế độ `auth.insecure` của chính Gateway đã ghi nhận cho một triển khai phía sau một proxy đáng tin cậy.

## Cấu hình

| Biến | Mặc định | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `HOTLOOP_EDGE_RELAY_DEVICES_FILE` | không có | Bắt buộc. Đường dẫn tới tệp thiết bị ở trên |
| `HOTLOOP_EDGE_RELAY_PUSHED_FILE` | chưa đặt | Nơi giữ tệp thiết bị được đẩy, và nó thắng tệp ở trên khi còn tồn tại. Phải ghi được và bền vững; biểu đồ và đơn vị Quadlet dùng `/data/pushed-devices.json`. Xem [Tệp được đẩy nằm ở đâu](#tệp-được-đẩy-nằm-ở-đâu-và-tệp-nào-thắng) |
| `HOTLOOP_EDGE_RELAY_LISTEN_ADDR` | `:8081` | Máy chủ `/healthz` và `/status` |
| `HOTLOOP_EDGE_RELAY_UPDATE_MODE` | `auto` | `auto` để việc cập nhật cho bộ giám sát và bỏ qua phê duyệt từ Gateway; `approve` giữ cập nhật cho đến khi có phê duyệt. Xem [Cập nhật một Relay](#cập-nhật-một-relay) |
| `HOTLOOP_IMAGE_DIGEST` | chưa đặt | Digest của image mà Relay này chạy từ đó, như bộ giám sát của nó biết. Đơn vị Quadlet đặt nó trước mỗi lần khởi động. Được báo trong `/status` và mọi Birth; để trống cũng được |
| `HOTLOOP_LOG_LEVEL` | `info` | |
| `HOTLOOP_POLL_INTERVAL` | `5s` | Chu kỳ thăm dò mặc định; `pollIntervalMs` riêng của thiết bị sẽ ghi đè |
| `HOTLOOP_MIN_POLL_INTERVAL` | `100ms` | Mức sàn áp dụng cho mọi thiết bị, bất kể cài đặt riêng của nó |
| `HOTLOOP_POLL_TIMEOUT` | `10s` | Thời gian chờ mặc định cho mỗi lần thăm dò; `timeoutMs` riêng của thiết bị sẽ ghi đè |
| `HOTLOOP_MAX_CONCURRENT_POLLS` | `32` | Số thiết bị có thể đang thăm dò cùng lúc |
| `HOTLOOP_RECONNECT_MIN` / `HOTLOOP_RECONNECT_MAX` | `1s` / `60s` | Giới hạn lùi thời gian giữa các lần thử kết nối lại, có xáo trộn ngẫu nhiên |
| `HOTLOOP_RING_SIZE` | `120` | Số mẫu giữ cho mỗi tag phục vụ chẩn đoán gần với `/status` |
| `HOTLOOP_OPCUA_CLIENT_PKI_DIR` | `/data/opcua-client-pki` | Chứng chỉ của trình điều khiển OPC UA và các kho `trusted/` và `rejected/` của nó; `pkiDir` riêng của thiết bị sẽ ghi đè. Chỉ một thiết bị OPC UA được bảo mật mới dùng đến |

Tên biến và giá trị mặc định giống hệt `RuntimeConfig` của chính Gateway; xem mục "Thăm dò" của nó trong trang k3s và Helm để có cùng các cài đặt được biểu diễn dưới dạng giá trị Helm, vì cả hai tệp nhị phân nạp cấu hình này qua cùng một hàm `config.LoadRuntimeConfig()`, không phải hai bản sao có thể lệch nhau.

Cộng với mọi biến `HOTLOOP_EDGE_PUBLISH_*` mà trang Edge Publish ghi, với một khác biệt: `HOTLOOP_EDGE_PUBLISH_ENABLED` bị bỏ qua và việc chuyển tiếp luôn bật, vì xuất bản những gì nó đọc là toàn bộ mục đích của tệp nhị phân này, không phải một tính năng tùy chọn như trên Gateway.

## Những gì đã được xác minh và chưa được xác minh

HotLoop đã được chạy với thiết bị thật và máy chủ thật, và trên phần cứng thật vào 2026-11-17.

## Triển khai

Hai cách được hỗ trợ, cả hai đều là container, không có `podman run` trần chạy từ một shell chết cùng phiên, và không có Docker:

- **`charts/hotloop-edge-relay`**, một biểu đồ Helm cho k3s, tách riêng khỏi biểu đồ của chính Gateway (`charts/hotloop`), vì một Edge Relay thực sự là một sản phẩm khác, thường chạy trong một cụm khác, nhỏ hơn cụm có Gateway mà nó chuyển tiếp tới. Thiết bị và tag được khai báo trong `values.yaml` và kết xuất thành một ConfigMap; hàng đợi chuyển tiếp nằm trên một PVC nhỏ (xem "Tắt lưu trữ bền vững" bên dưới trước khi bạn tắt nó).
- **`deploy/quadlet`**, một đơn vị Podman Quadlet cho một Pi hoặc PC công nghiệp nhỏ hoàn toàn không thuộc cụm k3s nào. Quadlet biến container thành một dịch vụ systemd thực thụ: khởi động khi bật máy, khởi động lại khi lỗi, ghi nhật ký vào journald; xem README của chính thư mục đó để biết các bước cài đặt.

Cả hai dùng cùng một image và cùng các biến môi trường đã ghi ở trên.

Mỗi bản phát hành đều xuất bản cả hai, từ 4.16.0. Image là `ghcr.io/hotloop-io/hotloop-edge-relay`, gắn thẻ với phiên bản phát hành (cộng `major.minor`, `major`, `latest` và `stable`; đơn vị Quadlet theo `stable`, xem [Cập nhật một Relay](#cập-nhật-một-relay)). Nó có amd64 và arm64, và arm 32 bit (arm/v7) từ bản phát hành đầu tiên sau 4.17.0, vì một Pi 3 hoặc bản cài Pi OS 32 bit chính là loại máy mà một Relay thường nằm trên. Biểu đồ nằm trong cùng kho Helm với biểu đồ của Gateway:

```sh
helm repo add hotloop https://hotloop.io/hotloop/
helm install edge-relay hotloop/hotloop-edge-relay \
  --namespace hotloop --create-namespace \
  --set edgePublish.broker=tcp://gateway.example.local:1883 \
  --set edgePublish.group=Plant1
```

### Tắt lưu trữ bền vững

`persistence.enabled=false` cho bạn một Relay chạy không có PVC, và đúng như vậy. Trên 4.16.0 nó thậm chí không chạy: không có gì được gắn tại `/data`, gốc là chỉ đọc, và Relay chết khi khởi động với `open forward queue at /data/forward.db: no such file or directory`. Giờ `/data` là một emptyDir, bị giới hạn ở `persistence.size`, và mọi thứ Relay ghi đều nằm ở đó.

Một emptyDir sống bao lâu thì Pod sống bấy lâu. Container khởi động lại trong cùng Pod thì vẫn giữ. Một Pod mới thì không, và bạn có Pod mới khi rút nút, khi nút chết, khi bị trục xuất, khi `kubectl delete pod`, và ở mọi `helm upgrade` cuốn chiếu Deployment. Mỗi lần, bạn mất:

- **Hàng đợi chuyển tiếp.** Mọi giá trị đọc được đệm lúc broker hỏng đều mất, và phía Gateway không có gì cho biết nó đang thiếu.
- **Tệp thiết bị được đẩy.** Relay khởi động lại từ `devices` của biểu đồ mà không phàn nàn, cho đến khi Gateway đẩy lại hoặc broker phát lại một lần đẩy retained. Đó chính là lỗi mà PVC sinh ra để ngăn, và tắt nó là chọn lại lỗi đó.
- **Chứng chỉ máy khách OPC UA và kho tin cậy.** Mọi máy chủ được bảo mật phải tin cậy chứng chỉ mới, và người vận hành phải phê duyệt lại chứng chỉ của từng máy chủ.

Làm đầy giới hạn, điều mà một hàng đợi đặt không giới hạn (`queueMaxBytes: 0`; mặc định là 64 MiB) sẽ gây ra trong một sự cố đủ dài, khiến Pod bị trục xuất và mất cả ba cùng lúc. Vậy vẫn tốt hơn là làm đầy đĩa của nút đè lên mọi thứ khác trên đó. Ghi chú cài đặt in một cảnh báo khi lưu trữ bền vững bị tắt. Dùng thử thì không sao. Với một Relay mà các giá trị đọc quan trọng, hãy cấp cho nó PVC.

### Từ EmberNet App Store

Cửa hàng liệt kê Relay là HotLoop Edge Relay, mỗi nút một cái. Một lần triển khai từ cửa hàng đưa cho biểu đồ ba thứ: tên hiển thị (tên bản phát hành), một bộ chọn nút và các nhãn của tenant. Nó không có biểu mẫu để hỏi thêm gì khác, và Relay không thể chạy nếu thiếu broker và một nhóm Sparkplug. Vì vậy một lần triển khai Relay từ cửa hàng dừng ở bước kết xuất, có chủ ý, với một lỗi trong nhật ký của tác vụ helm-install nêu rõ còn thiếu gì và in ra đúng lệnh để sửa.

Chúng tôi không đặt broker mặc định, vì không có broker nào đúng cho nhà máy của bất kỳ ai, và một Relay trỏ tới một địa chỉ bịa ra sẽ trông như đã triển khai trong khi nó không chuyển tiếp gì. Nó cũng không thể ngồi chờ một tệp thiết bị được đẩy: một lần đẩy đến qua kết nối broker mà nó chưa có.

Cách sửa là đặt hai giá trị vào những gì cửa hàng đã ghi, và việc cài đặt tự thử lại:

```sh
# a node on the local cluster: add them under spec.valuesContent
kubectl -n default edit helmchart hotloop-edge-relay-<node>

# a tenant on its own cluster (Fleet): add them under spec.helm.values
kubectl -n fleet-default edit helmop hotloop-edge-relay-<node>
```

```yaml
edgePublish:
  broker: tcp://<gateway-or-broker>:1883
  group: <sparkplug group id>
```

Khi đã chạy, nó hiện trong Running Apps dưới tên mà cửa hàng đặt, với biểu tượng HotLoop, trong phạm vi tenant đã triển khai nó, và không có nút LAUNCH. Phần cuối đó là có chủ ý: biểu đồ gắn nhãn `embernet.ai/gui-type: none`, vì `/healthz` và `/status` dành cho một probe và lệnh curl của người vận hành, không phải một trang trong iframe.

Relay và Gateway dùng chung một số phiên bản. Một bản phát hành sẽ không bắt đầu trừ khi cả hai biểu đồ mang phiên bản của thẻ và đơn vị Quadlet của Relay theo `:stable`, nên Relay nhận phiên bản mới ở mọi bản phát hành dù mã của chính nó có đổi hay không. Đó là có chủ ý: một con số để hỏi, và không có biểu đồ Relay nào trỏ tới một image Relay mà không ai đã đẩy. Đơn vị Quadlet từng ghim số phiên bản phát hành, ngược hẳn với cách một máy tự cập nhật hoạt động.
