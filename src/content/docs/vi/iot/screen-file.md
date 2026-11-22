---
title: "Tệp màn hình"
description: "Xuất một bảng điều khiển ra tệp và nhập vào bản cài đặt khác, với mọi tag, thiết bị và script mà nó nêu được liệt kê và có ánh xạ cho các tên khác nhau."
---

Một màn hình là của khách hàng, và nó di chuyển dưới dạng một tệp. Xuất một bảng điều khiển từ một bản cài đặt, nhập vào bản khác, và không có gì của nó nằm trong mã của HotLoop: không phải bố cục, không phải tên tag, không phải văn bản. Cùng một tệp chạy được trong HotLoop IoT, Edge và Gateway, vì chúng chạy một bộ bảng điều khiển chung ([Bảng điều khiển](/vi/iot/dashboards/)).

Edge Relay không có giao diện và không có màn hình. Bảng điều khiển của Flow là một phần của các flow của nó, vốn có phần Nhập và Xuất riêng. Với HotLoop for CODESYS, các màn hình là của Edge.

## Cách dùng

Trên màn hình Bảng điều khiển, **Xuất** (cạnh Sửa, cho bảng điều khiển đang hiển thị) lưu `<id>.hotloop-screen.json`. **Nhập** (trên thanh cạnh Bảng điều khiển mới) đọc một tệp, cho bạn biết nó cần gì và ở đây thiếu gì, để bạn ánh xạ từng tag, thiết bị, thực thể, script hoặc công thức còn thiếu tới một cái đang có, kiểm tra lại và lưu nó. Việc nhập cần `dashboards.write`, nên đó là việc của quản trị viên. Việc xuất cần `dashboards.read` và bảng điều khiển phải là một cái bạn được cung cấp.

Qua API là [`GET /api/dashboards/{id}/export`](/vi/iot/api/#get-apidashboardsidexport) và [`POST /api/dashboards/import`](/vi/iot/api/#post-apidashboardsimport), chính là những gì màn hình gọi. Một lần nhập không bao giờ lưu thứ mà việc dựng cùng bảng điều khiển đó sẽ từ chối.

## Tệp

JSON UTF-8, tối đa 4 MiB.

```json
{
  "format": "hotloop-screen",
  "formatVersion": 1,
  "exported": { "product": "edge", "version": "4.22.1", "at": "2026-11-19T16:00:00Z" },
  "screen": {
    "id": "line-2",
    "name": "Line 2",
    "kind": "cards",
    "roles": ["operator", "admin"],
    "homeFor": ["operator"],
    "screens": ["line-2-panel"],
    "position": 1,
    "cards": [
      { "id": "temp", "type": "gauge", "title": "Zone 1", "w": 3, "h": 3, "config": { "tag": "press-01/Zone1_Temp" } }
    ]
  },
  "requires": {
    "tags": [ { "key": "press-01/Zone1_Temp", "dataType": "float", "unit": "C", "writable": false } ],
    "entities": [], "scripts": [], "recipes": [], "devices": [], "equipment": []
  }
}
```

**`format` và `formatVersion`.** `format` luôn là `hotloop-screen`. `formatVersion` là một số nguyên bắt đầu từ 1. Một HotLoop đọc phiên bản của chính nó và các phiên bản cũ hơn, và từ chối phiên bản mới hơn bằng cách nêu tệp là phiên bản nào và nó đọc được phiên bản nào. Một trường được thêm vào tệp là một phiên bản mới, vì trình đọc từ chối một trường nó không biết: một trường bị bỏ mà không nói gì còn tệ hơn một lời từ chối. Đây là phiên bản 1.

**`exported`.** Sản phẩm và phiên bản nào đã ghi nó, và khi nào. Dành cho người đọc tệp. Không có gì được quyết định từ đó: các loại thẻ quyết định liệu một HotLoop có hiển thị được màn hình hay không, và một loại thẻ không biết bị từ chối kèm tên.

**`screen`.** Bảng điều khiển như API bảng điều khiển lưu giữ, không có sổ sách riêng của bản cài đặt (`version`, `updatedBy`, `createdAt`, `updatedAt`). `description` được bỏ khi trống. Các thẻ theo thứ tự đọc, mỗi thẻ có kích thước (`w` trên 12 cột, `h` tính theo hàng) và `config` của nó, đúng như [Bảng điều khiển](/vi/iot/dashboards/#the-cards) mô tả từng loại. Bố cục chính là vậy: một dòng chảy các thẻ, không bao giờ là tọa độ điểm ảnh. Một thẻ biểu tượng đặt các biểu tượng của nó theo điểm ảnh trên trang riêng của nó, bên trong config của nó.

**Tài nguyên nằm bên trong.** Một mặt bằng trên thẻ bản đồ và nền của thẻ biểu tượng là các data URL PNG base64 trong `config` của thẻ, nên một tệp là toàn bộ màn hình, và gửi nó cũng là gửi cả hình ảnh. Giới hạn là của bảng điều khiển: 700 KB mỗi hình và 2 MiB mỗi màn hình.

**`requires`.** Những gì màn hình cần từ bản cài đặt nơi nó đến, tính từ các thẻ: mọi tag nó đọc (với kiểu và đơn vị nó có ở nơi được xuất, và liệu một nút hay giá trị đặt có ghi vào nó không) và các id thực thể, script, công thức, thiết bị và thiết bị máy móc mà các thẻ nêu. Nó dành cho con người và cho các công cụ muốn xem trước khi nhập. Việc nhập tính lại từ các thẻ và không bao giờ tin khối này. Khi kiểu của một tag trong tệp khác với tag nơi nó đến, đó là một cảnh báo.

**Bảng treo tường không được xuất.** Nó là các đồng hồ đo được ghim của một bản cài đặt, không phải một bố cục. Xuất nó cho ra `400`, và một tệp có `kind` là `wall` bị từ chối.

**Phân công.** `roles`, `homeFor`, `screens` và `position` nằm trong tệp để một màn hình trở lại như lúc đi. Chúng cũng là phần gắn chặt nhất với một bản cài đặt: tên của một panel thuộc về một bảng điều khiển trên một bản cài đặt, và một vai trò có một màn hình chủ. Việc nhập áp dụng chúng, và nói rõ (`assignment`) khi bản cài đặt này đã dành tên màn hình đó hoặc màn hình chủ của vai trò đó cho một bảng điều khiển khác. **Bỏ qua các phân công** bỏ `screens` và `homeFor` và giữ `roles`.

## Nhập

Các bước kiểm tra chạy theo thứ tự này, và không có gì được lưu cho đến khi tất cả đều qua:

1. **Tệp.** JSON, đúng `format`, một phiên bản mà bản dựng này đọc được, không có trường nào nó không biết, loại `cards`.
2. **Thay đổi của bạn đối với nó.** Một id hoặc tên mới, không có phân công, và **ánh xạ**: `tags` (khóa đầy đủ sang khóa đầy đủ, như tệp nêu tên tag hoặc như nó đọc được sau khi thiết bị đã chuyển), `devices` (id sang id; cũng chuyển phần thiết bị của mọi tag mà ánh xạ `tags` không nêu, nên chuyển một màn hình từ PLC này sang PLC khác chỉ là một mục), `entities`, `scripts`, `recipes` và `equipment` (id là các số chỉ có nghĩa ở nơi chúng được tạo, nên chúng được ánh xạ từng cái một). Chú giải của một xu hướng đi cùng tag của nó. Một mục ánh xạ mà không thẻ nào dùng là một cảnh báo, vì một ánh xạ không làm gì chính là cách một màn hình cuối cùng vẫn trỏ vào cái cũ.
3. **Các quy tắc riêng của bảng điều khiển.** Id, tên, config của mọi thẻ, kích thước, giới hạn byte, ở dạng được lưu.
4. **Mọi thứ các thẻ nêu, không sót.** Mỗi tag, thực thể, script, công thức, thiết bị và id thiết bị máy móc còn thiếu đều được liệt kê, không chỉ cái đầu tiên, nên một lượt cho biết cần ánh xạ gì. Một nút hay giá trị đặt trên tag không ghi được là `writable`. Giá trị nút hoặc giới hạn giá trị đặt nằm ngoài phạm vi của tag, và một vai trò không tồn tại, là `screen`.
5. **Id và các phân công.** Một id đã có người dùng là `exists`, trừ khi bạn yêu cầu **thay thế**, tức là lưu đè lên bảng điều khiển đó ở phiên bản hiện tại của nó (nên một lần lưu được thực hiện trong lúc bạn đang xem là `409`, không phải ghi đè).

Chạy thử thực hiện tất cả những điều này và không lưu gì. Lần nhập được ghi lại như một sự kiện `config` trên bảng điều khiển: ai, từ sản phẩm và phiên bản nào, bao nhiêu thẻ.

## Chuyển một màn hình

Xuất trên bản cài đặt thứ nhất. Trên bản thứ hai, hãy bảo đảm các thiết bị và tag mà màn hình đọc đã tồn tại (chúng mang các địa chỉ thuộc về nhà máy, nên tệp màn hình không mang theo). Nhập. Nếu tên tag khác nhau, hãy ánh xạ chúng trong hộp thoại, hoặc ánh xạ thiết bị nếu chỉ có thiết bị khác. Màn hình mở ra trên bản cài đặt thứ hai đúng như nó đã ở trên bản thứ nhất.

## Một trực quan hóa CODESYS

Cùng việc nhập đó đọc một trực quan hóa CODESYS (bản xuất gốc của IDE) và tạo màn hình từ đó, nói rõ những gì nó bỏ qua: [Nhập màn hình CODESYS](/vi/iot/codesys-screen-import/).

## Những gì không có trong phiên bản 1

Các thiết bị và tag mà một màn hình đọc (địa chỉ của chúng là của nhà máy, không phải của màn hình), bảng treo tường, nhiều màn hình trong một tệp, và chữ ký trên tệp. Một tệp là JSON thuần: hãy đọc nó trước khi nhập một tệp mà người khác gửi cho bạn.
