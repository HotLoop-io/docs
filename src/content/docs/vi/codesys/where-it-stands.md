---
title: "Hiện trạng HotLoop for CODESYS"
description: "HotLoop for CODESYS đã được chạy với những gì trên phần cứng thật, và những gì đã được xuất bản."
sidebar:
  label: "Hiện trạng"
editUrl: false
---

Trang này nói những gì đã được xuất bản và HotLoop for CODESYS đã được chạy đến đâu.

## Những gì đã ra mắt

- **Chart.** `hotloop-codesys` 0.3.8 có trong chỉ mục tại `https://hotloop.io/hotloop-codesys/`, xuất bản ngày 2026-11-19, với mọi phiên bản trước vẫn nằm bên cạnh. Nó bọc HotLoop 4.22.0. Cài 0.3.8: [ghi chú phát hành](/vi/releases/codesys-0-3-5/) nói mỗi chart đã thay đổi gì.
- **Ảnh provisioner.** `ghcr.io/hotloop-io/hotloop-provision` ở 0.3.3 kéo về được mà không cần đăng nhập, cho amd64 và arm64, và chart chạy nó.
- **Mục trong App Store.** Nó có trong App Store của EmberCORE, và EmberNet cài nó vào tenant của bạn.

## Đã chạy đến đâu

Chart trên một nút k3s với các giá trị theo dạng Store, một runtime CODESYS Control for Linux SL 4.22.0.0 thật trên cùng nút chạy một chương trình demo, và một ảnh HotLoop Edge.

- Thiết bị, các tag của nó (không cái nào ghi được), cảnh báo và màn hình xuất hiện mà không cần thao tác tay.
- Mọi giá trị đều đọc tốt và có biến động.
- Các pod quay lại sau khi xóa một pod.
- Bản cài đọc là xấu với lý do "the PLC's runtime is not answering" trong lúc runtime khởi động lại, và tự phục hồi khoảng 88 giây sau.
- Một lần đăng nhập có chữ ký từ bảng điều khiển đã đăng nhập một người với vai trò người vận hành hoặc quản trị viên, còn ứng dụng sai, tenant sai, bản hết hạn, nhà phát hành sai và bản bị can thiệp đều bị từ chối.
- Chart đã xuất bản được kết xuất từ chỉ mục trực tiếp bằng Helm.

Trình kết nối bên dưới, driver CODESYS của HotLoop core, đã được kiểm chứng trực tiếp với runtime CODESYS Control for Linux SL 4.22.0.0, cho cả đọc và ghi, và trên phần cứng không có hệ điều hành (2026-11-17). Chức năng ghi có trong trình kết nối, và sản phẩm này không bao giờ bật nó.

Tất cả những điều đó cũng đã được chạy trên phần cứng không có hệ điều hành (2026-11-17).

## Hồ sơ chưa làm được gì

Một hồ sơ tạo ra một màn hình. Nó tạo một thiết bị từ `device`, hoặc nhiều thiết bị thuộc bất kỳ giao thức nào từ `devices`, và cố ý không có cách nào đánh dấu một biến là ghi được từ hồ sơ.
