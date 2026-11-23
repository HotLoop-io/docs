---
title: "Dây có kiểu"
description: "Đặt JSON Schema lên nút json và kiểm tra thông điệp trên dây: hình dạng sai sẽ đến nút Catch, nút này nêu tên từng trường sai."
---

Một thông điệp sai hình dạng là sự cố chúng tôi ít muốn gặp nhất trên một dây chuyền đang chạy. Nhiệt độ đến dưới dạng chuỗi `"hot"`, thiếu `id`, một con số ở chỗ lẽ ra là danh sách: không có gì sập, luồng vẫn chạy, và một thứ ở phía sau lặng lẽ làm sai. Flow đưa JSON Schema vào giải quyết vấn đề đó qua ba bước.

## Schema trên nút `json`

Cho nút `json` một schema trong phần cài đặt và mọi giá trị nó xử lý đều được kiểm tra theo schema đó. Giá trị khớp thì đi tiếp. Giá trị không khớp thì đến một nút Catch, không đi tiếp xuống dây, và lỗi nêu tên từng trường sai:

```
does not match the schema: payload.temp: got string, want number; payload.id: missing property "id"
```

`msg.schemaError` mang cùng nội dung đó dưới dạng danh sách các đối tượng `{path, keyword, message}`, dành cho nút Catch muốn định tuyến theo nó. Đường dẫn được đọc theo cách nút Change viết chúng: `payload.sensors[2].temp`.

Nếu nút không có schema trong cài đặt và một thông điệp mang `msg.schema`, nút sẽ kiểm tra theo schema đó, giống như nút `json` của Node-RED. Thông điệp vượt qua sẽ bị bỏ `msg.schema`. Thông điệp không đạt vẫn giữ nó. Schema trong cài đặt được ưu tiên khi có cả hai.

- Schema là JSON Schema draft 2020-12 trừ khi nó nêu một bản nháp khác bằng `$schema`. Các bản nháp 4, 6, 7 và 2019-09 đều được chấp nhận.
- Schema không hợp lệ trong cài đặt làm việc triển khai thất bại kèm lý do của bộ kiểm tra. `msg.schema` không hợp lệ là một lỗi trên thông điệp đó.
- Schema là tự đủ. `$ref` tới một URL khác hay một tệp bị từ chối, không được tải về, nên một hộp edge không có đường ra vẫn hoạt động như mọi hộp khác.
- `format` được kiểm tra với các định dạng mà bộ kiểm tra biết và bị bỏ qua với phần còn lại, giống hầu hết các bộ kiểm tra.
- Một luồng không có schema ở bất cứ đâu hoạt động y hệt như trước.

Mọi thứ khác trong Flow cần kiểm tra một giá trị theo schema đều dùng cùng một gói.

## Schema trên các cổng

Bất kỳ nút nào cũng có thể khai báo nó nhận gì và mỗi cổng đầu ra hứa gì. Hai khóa tùy chọn trên nút, cả hai nằm trong tệp luồng, cả hai bị mọi công cụ khác đọc tệp đó bỏ qua, nên một luồng mang chúng vẫn đi và về từng byte một:

```json
{"id":"sensor","type":"function","outputs":2,"wires":[["limit"],[]],
 "ew_outSchemas":[{"type":"object","properties":{"payload":{"type":"object",
   "required":["temp"],"properties":{"temp":{"type":"number"}}}}}, null]},
{"id":"limit","type":"switch","wires":[[],[]],
 "ew_inSchema":{"type":"object","required":["topic"]}}
```

`ew_inSchema` là thứ nút nhận. `ew_outSchemas` là một danh sách với một schema hoặc `null` cho mỗi cổng đầu ra. Một schema mô tả toàn bộ thông điệp, nên payload là `properties.payload`. Các khóa bắt đầu bằng dấu gạch dưới, `_msgid` và phần sổ sách nội bộ còn lại của runtime, bị loại khỏi những gì nó thấy, nên một schema đóng không phải nêu tên chúng. Chúng là JSON Schema như của nút `json`, và cùng một gói kiểm tra chúng.

**Một sự không khớp mà trình chỉnh sửa nhìn thấy được sẽ bị từ chối khi triển khai.** Khi cả hai đầu của một dây khai báo schema và không thông điệp nào có thể thỏa mãn cả hai, việc triển khai bị từ chối trước khi ghi một byte nào, giống như cổng kiểm thử: mã 422, không có gì được khởi động lại, không có gì được lưu, và một bản ghi trong nhật ký kiểm toán là `deploy.refused` với lý do `typed wires`.

```
the deploy was refused because of 1 typed wire problem, and the flows already running are untouched; junction "sensor" (sensor) output 1 -> "limit" (limit): payload.temp: the sender sends string and the receiver takes number
```

Nó chỉ từ chối những gì nó có thể chứng minh. Kiểu khác nhau trên cùng một trường, một giá trị nằm ngoài `enum` hoặc phạm vi của đầu kia, một trường mà bên nhận yêu cầu còn schema đóng của bên gửi loại trừ, một trường mà bên gửi luôn gửi còn schema đóng của bên nhận từ chối. Bên gửi chỉ đơn giản là không nhắc đến một trường mà bên nhận yêu cầu thì không bị từ chối, vì thông điệp rất có thể mang nó, và một schema dùng `$ref`, `allOf`, `anyOf`, `oneOf`, `not` hoặc `if` không bị nghi ngờ ở phần đó. Việc từ chối sai làm đình trệ một lần triển khai vô ích, còn những gì nó không chứng minh được vẫn bị bắt khi chạy. Một schema không biên dịch được, hoặc một `ew_outSchemas` dài hơn số đầu ra của nút, bị từ chối theo cách tương tự. Việc quay lui không bị kiểm tra, vì cùng lý do chúng không bị bài kiểm thử chặn.

**Giá trị literal của nút Inject được tính là một kiểu.** Một Inject không có schema riêng, nhưng những gì nó chắc chắn đặt ra có giá trị ngang một schema. Khi một Inject được nối thẳng tới một nút có `ew_inSchema`, payload literal và mọi thuộc tính literal khác mà nó đặt sẽ được kiểm tra theo schema đó khi triển khai, và một literal mà bên nhận không bao giờ nhận được sẽ bị từ chối theo cách tương tự, với cùng mã 422 và cùng `deploy.refused` trong nhật ký kiểm toán:

```
inject "reading" (i1) output 1 -> "limit" (l1): payload: the inject sets "hot", which the receiver does not take: got string, want number
```

Chỉ literal được kiểm tra: một chuỗi, một số, một giá trị boolean hoặc JSON. Dấu thời gian, biến môi trường, ngữ cảnh luồng hay toàn cục, thuộc tính khác của thông điệp, JSONata, buffer hay biểu thức chính quy thì chưa biết cho đến khi nút kích hoạt, nên bị bỏ qua, không bao giờ đoán. Một thuộc tính bắt buộc mà Inject không đặt cũng không phải xung đột, vì một giá trị không tĩnh có thể đặt nó. Chỉ dây từ Inject tới nút được xét: một literal đi qua nút khác trước thì được để cho bước kiểm tra khi chạy. Trình chỉnh sửa vẽ cùng xung đột đó trên dây ấy.

**Cái nó không thấy sẽ đi tới một nút Catch và một chỉ số.** Một thông điệp đến một nút và vi phạm `ew_inSchema` của nút đó sẽ không bao giờ tới nút. Một thông điệp rời một cổng và vi phạm schema của cổng đó bị chặn ở bên gửi và không bao giờ được giao. Dù trường hợp nào, nó được nêu như một lỗi từ nút đã giữ schema, và nút Catch nhận nó cùng đường dẫn của từng trường sai trong `msg.error.message` và dưới dạng danh sách trong `msg.error.violations`, mỗi mục là `{path, keyword, message}`:

```
the message does not match the schema of output 1: payload.temp: got string, want number
```

`hotloop_flow_node_schema_mismatches_total` đếm chúng theo từng nút, và cũng đếm các sự không khớp của nút `json`. Một nút không có schema tốn một lần kiểm tra nil, và một luồng không có schema nào hoạt động y hệt như trước.

## Kiểu trên các dây, trong trình chỉnh sửa

Một dây có kiểu ở một trong hai đầu thì mang kiểu đó. Trình chỉnh sửa ghi kiểu lên dây, ở giữa đường cong: kiểu của bên gửi, bằng vài ký tự (`payload {temp: number}`), và toàn bộ câu chuyện khi bạn rê chuột lên dây.

- **Cả hai đầu khai báo kiểu và khớp nhau:** viền xanh lá, kiểu của bên gửi.
- **Chỉ một đầu khai báo:** nét đứt và mờ, để bạn thấy dây nào vẫn chưa có kiểu.
- **Cả hai khai báo và không bao giờ khớp nhau:** dây và nhãn của nó chuyển sang đỏ và cho biết trường nào, `≠ payload.temp`, còn chú giải có lý do của runtime. Việc triển khai sẽ từ chối nó, và giờ bạn thấy được trước khi bấm Deploy.

Màu đỏ không phải do trình chỉnh sửa đoán. Nó hỏi runtime, `POST /flows/types`, chạy đúng phép kiểm tra mà việc triển khai dùng để từ chối, nên canvas và việc triển khai không thể mâu thuẫn nhau. Trình chỉnh sửa chỉ hỏi khi có thứ gì đó trên canvas có schema, ngay sau lần chỉnh sửa cuối cùng. Một luồng không có schema thì không gọi gì và không vẽ thêm gì.

Đặt các kiểu trong hộp thoại của nút, dưới **Types**: một schema đầu vào và một schema cho mỗi cổng đầu ra. Để trống nghĩa là không có kiểu, và một nút bạn chưa từng gán kiểu sẽ không có thêm các khóa. Viết thứ không phải JSON, hoặc không phải một đối tượng, sẽ bị từ chối trong hộp thoại.
