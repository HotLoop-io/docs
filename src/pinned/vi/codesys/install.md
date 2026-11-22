---
title: "Cài đặt HotLoop for CODESYS"
description: "Cài HotLoop for CODESYS từ App Store của EmberCORE hoặc bằng Helm: nút cần gì, Secret của hồ sơ, nó tự làm gì và cách kiểm tra."
sidebar:
  label: "Cài đặt"
---

HotLoop for CODESYS là một chart Helm, `hotloop-codesys`, cài HotLoop Edge và một bộ cấp phát hồ sơ trên cùng nút với một runtime CODESYS. Chart được công bố tại `{{codesysChartRepo}}`, với {{codesys}} là mới nhất, và image của bộ cấp phát tải về không cần đăng nhập. Trên EmberNet đây là một ứng dụng App Store. Không có EmberNet thì là Helm trên k3s.

## Nút cần gì trước tiên

- **Một runtime CODESYS trên cùng nút, công bố máy chủ OPC UA của nó trên cổng 4840.** Bộ cấp phát lấy địa chỉ của chính nút từ Kubernetes và đọc `<node address>:4840`. Chart của chính runtime công bố cổng đó trên máy chủ.
- **Một Symbol Configuration trong chương trình PLC** với *Support OPC UA features* bật, liệt kê các biến bạn muốn xem, hoặc `{attribute 'symbol' := 'read'}` trên chúng trong phần khai báo. Một PLC không có Symbol Configuration trả lời bước thiết lập bằng một thông báo bảo hãy thêm một cái. Đây là thay đổi duy nhất đối với dự án PLC.
- **HotLoop {{codesysNeeds}}**, mà chart bao bọc. Trình kết nối CODESYS có từ HotLoop 4.19.4. Chart phụ thuộc vào chart `hotloop-edge` trên dòng `~{{codesysNeeds}}`.
- **Một hồ sơ.** Một Secret với một khóa. [Trang hồ sơ](/vi/codesys/profile/) có hình dạng của nó.

## Từ App Store của EmberCORE

Chart được đánh dấu cho nhân viên, nên Store liệt kê nó cho nhân viên EmberNet, họ cài lên tenant của khách hàng. Đây không phải nút mà tenant tự bấm, nên hãy hỏi người phụ trách tenant của bạn. Store ghi hồ sơ vào namespace của tenant dưới tên `<release>-profile`, chuyển nút đã chọn và các nhãn của tenant vào chart, và chuyển khóa công khai của dashboard để đăng nhập. Sau đó không còn gì phải làm.

## Với Helm

```bash
kubectl -n <namespace> create secret generic <release>-profile --from-file=profile.json
helm repo add hotloop-codesys {{codesysChartRepo}}
helm repo update
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace>
```

Đặt tên Secret là `<release>-profile`, hoặc đổi thứ chart tìm bằng `profile.existingSecret` (Secret) và `profile.key` (khóa, mặc định `profile.json`). Để ghim bản cài vào nút của runtime, đặt `nodeSelector`. Với HotLoop riêng lẻ, không có hồ sơ, để tự thiết lập bằng tay, hãy cài với `--set provisioner.enabled=false`.

## Với runtime trên mạng của nút

Một runtime cài từ chart của nó với `network.hostNetwork=true` giữ cổng 8080 của máy chủ cho WebVisu, nên trang của HotLoop không thể cũng lắng nghe trên 8080 ở đó. Chart cho trang của HotLoop lắng nghe trên 8090 bên trong pod và giữ Service trên 8080, để ô App Store và bộ cấp phát vẫn đến được nó như trước. Hãy cài với mạng máy chủ bật cho cả hai:

```bash
helm install <release> hotloop-codesys/hotloop-codesys --version {{codesys}} -n <namespace> \
  --set hotloop-edge.hostNetwork=true --set hotloop-edge.service.targetPort=8090
```

Các trình lắng nghe OPC UA PubSub của HotLoop gắn một cổng UDP một cách độc quyền, nên hai trình lắng nghe trên một cổng không thể cùng kết nối. Bộ cấp phát từ chối một hồ sơ yêu cầu điều đó và nói rõ lý do.

## Việc cài đặt làm gì

1. HotLoop Edge khởi động trên nút đó với SQLite trên bộ nhớ local-path của nút. Không có pod cơ sở dữ liệu, một replica, và chiến lược cập nhật là `Recreate`.
2. Bộ cấp phát khởi động trên cùng nút. Nó đọc hồ sơ đã gắn ở mỗi lượt, nên hồ sơ mới hơn đến được một bản cài đang chạy. Nó chờ HotLoop và runtime CODESYS của chính nút, rồi thiết lập thiết bị, các biến, các báo động và màn hình của hồ sơ.
3. Nó xem lại mỗi năm phút và giữ thiết bị đúng khi chương trình PLC thay đổi. Các biến mà hồ sơ liệt kê và PLC nay đã có sẽ được thêm, còn biến mà PLC không còn có sẽ được đọc là xấu cùng lý do của máy chủ.
4. Cả hai pod đều chịu được `node.kubernetes.io/unreachable` và `not-ready` mà không có `tolerationSeconds`, nên một nút mất control plane vẫn giữ chúng. Chart tự mang theo điều này và không phụ thuộc vào cài đặt của cụm.

Máy chủ OPC UA, broker nhúng, xuất bản từ edge và sao lưu đều tắt, vì không thứ nào được mong muốn bên cạnh một runtime. Bật một thứ qua values của `hotloop-edge` nếu bạn muốn.

## Kiểm tra

```bash
kubectl -n <namespace> logs deploy/<release>-provision
```

Một lần khởi động tốt cho biết thiết bị đã được thiết lập cùng các biến của nó, không biến nào ghi được, và các báo động cùng màn hình đã được tạo. Mở dịch vụ HotLoop, đăng nhập bằng `admin`, rồi xem Thiết bị và Bảng điều khiển. Mật khẩu admin nằm trong Secret của release, giống mọi chart HotLoop.

## Đăng nhập từ dashboard

Từ HotLoop 4.19, chart Edge đăng nhập một người từ khẳng định đã ký của dashboard EmberCORE (các values `embernetSignin`, bốn biến `HOTLOOP_AUTH_ASSERTION_*` và chú thích Service `embernet.ai/signin: assertion`). Chart này kế thừa tất cả từ subchart `hotloop-edge`, và Store chuyển khóa công khai vào đó. Bộ cấp phát dùng tài khoản admin của chart, mà đăng nhập cục bộ vẫn cho phép. Trong một cụm thử nghiệm, một khẳng định đúng đã đăng nhập một người với vai trò operator hoặc admin, còn khẳng định cho sai ứng dụng, sai tenant, đã hết hạn, từ sai nhà phát hành và khẳng định bị can thiệp đều bị từ chối.

## Đã chạy đến đâu

Nó đã chạy trên phần cứng thật (2026-11-17), và chart được dựng từ chỉ mục trực tiếp bằng Helm. [Hiện đang ở đâu](/vi/codesys/where-it-stands/).

