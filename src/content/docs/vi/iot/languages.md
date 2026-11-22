---
title: "Ngôn ngữ của giao diện web"
description: "Giao diện web có tiếng Anh và mười ba ngôn ngữ nữa, tiếng Ả Rập bố trí từ phải sang trái, chọn trên thanh trên cùng hoặc ở thẻ đăng nhập."
---

Giao diện web của HotLoop IoT, Edge và Gateway (và của HotLoop for CODESYS, chạy giao diện Edge) có tiếng Anh và 13 ngôn ngữ nữa: tiếng Tây Ban Nha (es), tiếng Pháp (fr), tiếng Ý (it), tiếng Đức (de), tiếng Na Uy Bokmål (nb), tiếng Bulgaria (bg), tiếng Hy Lạp (el), tiếng Hàn (ko), tiếng Nhật (ja), tiếng Việt (vi), tiếng Hindi (hi), tiếng Trung giản thể (zh-Hans) và tiếng Ả Rập (ar, bố trí từ phải sang trái).

Chọn một ngôn ngữ trong ô ngôn ngữ ở thanh trên cùng, hoặc ở thẻ đăng nhập. Lựa chọn được lưu trong trình duyệt này. Nếu chưa chọn gì, trang dùng ngôn ngữ đầu tiên trong danh sách của trình duyệt mà HotLoop có, và dùng tiếng Anh nếu không có ngôn ngữ nào khớp. Một ngôn ngữ chỉ xuất hiện trong danh sách chọn khi tệp của nó đã đầy đủ.

Những gì đi theo ngôn ngữ: mọi từ trên mọi màn hình, thứ tự và dấu của số (dấu phẩy thập phân trong tiếng Đức, Pháp và Tây Ban Nha), ngày và giờ (đồng hồ 24 giờ), các dạng số nhiều (tiếng Ả Rập có sáu) và chiều của trang. Tên sản phẩm và giao thức (HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi) giữ nguyên như đã viết. Các giá trị từ nhà máy, như tên tag, tên thiết bị, thông báo báo động do ai đó gõ và nội dung lỗi do máy chủ gửi về, được hiển thị đúng như vậy.

## Cách hoạt động

* [i18next](https://www.i18next.com/) 27 tra thông báo, điền `{{name}}` và chọn dạng số nhiều. Nó hỏi `Intl.PluralRules` của chính trình duyệt, nên quy tắc số nhiều là của Unicode CLDR. Số và ngày dùng `Intl.NumberFormat` và `Intl.DateTimeFormat` thông qua `web/src/lib/format.ts`.
* Các thông báo nằm trong `web/src/i18n/locales/<language>.json`, dạng phẳng, mỗi thông báo một khóa. `en.json` là nguồn. Mọi tệp khác có đúng các khóa của nó.
* Trong mẫu hoặc script, hãy viết `tl('area.key')` hoặc `tl('area.key', { name })`. Một thông báo có số đếm có một khóa cho mỗi dạng số nhiều (`key_one`, `key_other`, và `key_few`, `key_many`, `key_two`, `key_zero` ở những ngôn ngữ có chúng) và được gọi bằng chính khóa đó cùng với `count`: `tl('overview.tags_count', { count: n })`.
* Tiếng Anh là một phần của trang. Ngôn ngữ khác là một tệp riêng, được tải khi có người chọn.
* `web/src/i18n/index.svelte.ts` giữ ngôn ngữ; đổi ngôn ngữ sẽ vẽ lại mọi màn hình. Một từ được giữ trong hằng số ở đầu tệp `.ts` chỉ được đọc một lần khi tệp tải và không được dịch: hãy viết nó dưới dạng getter (`get label() { return tl('x.y'); }`) hoặc giữ khóa và gọi `tl()` ở nơi nó được vẽ.
* Trang đặt `<html lang dir>`. CSS dùng các thuộc tính logic (`margin-inline-start`, `inset-inline-end`, `text-align: start`), nên bố cục tự đảo chiều cho tiếng Ả Rập.

## Thêm hoặc đổi một từ

1. Thêm thông báo vào `en.json` và viết nó trong mã bằng `tl()`.
2. Thêm nó vào mọi tệp ngôn ngữ khác, do người đọc được ngôn ngữ đó viết, theo bộ thuật ngữ chung trong codex (`work/notes/i18n/glossary/`). Câu ngắn, dễ hiểu. Tên sản phẩm và giao thức giữ tiếng Anh.
3. Chạy `cd web && npm run check:i18n`. Nó báo lỗi khi một tệp ngôn ngữ thiếu khóa, có `{{placeholder}}` khác với tiếng Anh hoặc thiếu một dạng số nhiều mà ngôn ngữ đó cần; khi có khóa không được dùng; và khi tiếng Anh được viết trong mẫu hoặc trong mã mà không qua `tl()`. Nó chạy trước mỗi `npm run build` và trong `npm run typecheck`, nên bộ kiểm thử đầy đủ và bản dựng phát hành dừng lại ở đó. Tiếng Anh cần giữ lại (một tên, một ví dụ mã) được đưa vào `web/i18n/allow.json` kèm lý do.

Đặt `HOTLOOP_TEST_BROWSER_GALLERY` và `HOTLOOP_TEST_BROWSER_ARTIFACTS` để giữ một ảnh chụp màn hình cho từng màn hình.

## Những gì không được dịch

* Văn bản do máy chủ gửi: thông báo lỗi từ API, thông báo và báo động, và CLI. Giao diện hiển thị chúng đúng như khi chúng đến.
* Tài liệu, tên của máy chủ OPC UA, MQTT broker và các giá trị của Helm chart.
