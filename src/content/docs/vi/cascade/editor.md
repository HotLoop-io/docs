---
title: "Trình soạn thảo của Cascade"
description: "Trình soạn thảo nằm trong tệp nhị phân Cascade: thư mục, canvas có Chạy tới đây, các lần chạy vẽ từng bước, thông tin đăng nhập, dự án, người dùng, kiểm toán."
---

Trình soạn thảo được tích hợp sẵn trong tệp nhị phân, nên không có gì khác phải chạy và nó không tải gì từ bất cứ đâu: mở địa chỉ mà máy chủ đang lắng nghe rồi đăng nhập. Đó là một ứng dụng Astro với các island Svelte, được dựng thành tệp tĩnh khi xây dựng image, cùng màu sắc và phông chữ với mọi màn hình HotLoop khác, sáng hoặc tối theo hệ thống của bạn cho đến khi bạn chọn.

![Các quy trình, trong thư mục](/synced/cascade/docs/screenshots/workflows.png)

Các quy trình nằm trong dự án, và quy trình của một dự án nằm trong các thư mục lồng nhau sâu bao nhiêu tùy nhà máy của bạn: khu vực, dây chuyền, cell. Một quy trình được chuyển giữa các thư mục ngay từ hàng của nó.

![Canvas, một bước đang được chọn và phần cài đặt của nó bên cạnh](/synced/cascade/docs/screenshots/editor.png)
![Cũng màn hình đó, ở chế độ tối](/synced/cascade/docs/screenshots/editor-dark.png)

Canvas vẫn ở chỗ cũ: kéo từ đầu ra sang đầu vào, di chuyển một bước, `Ctrl+S` để lưu, `Delete` để gỡ một bước. Chạy tới đây chạy những gì đang có trên màn hình, chưa lưu, tới bước bạn đã chọn và hiện kết quả nó đưa ra dưới dạng bảng, các trường hoặc JSON, và bạn có thể ghim kết quả đó để bước ấy ngừng chạy trong lúc bạn xây các bước sau. Mọi trường đều nhận một biểu thức và cho thấy nó ra kết quả gì với lần chạy thử gần nhất. Lưu đè lên bản của người khác sẽ được báo cho biết, chứ không được cho qua.

![Một lần chạy lỗi, được vẽ lại đúng như nó đã chạy](/synced/cascade/docs/screenshots/run.png)

Một lần chạy được vẽ cùng kết quả của từng bước. Hãy thử lại từ bước bị lỗi, từ một bước bất kỳ, hoặc gỡ lỗi nó trong trình soạn thảo với các thay đổi: những bước trước bước bạn chạy lại giữ nguyên những gì chúng đã làm, nên một thao tác ghi đã xảy ra sẽ không xảy ra hai lần. Một người có thể để lại biểu tượng thích hoặc không thích, một ghi chú và thẻ trên một lần chạy sau khi nó xong, và danh sách lần chạy tìm các lần chạy theo những thứ đó.

![Các lần chạy, cùng những gì mọi người nói về chúng](/synced/cascade/docs/screenshots/executions.png)
![Thống kê bảy ngày gần nhất](/synced/cascade/docs/screenshots/insights.png)
![Vai trò](/synced/cascade/docs/screenshots/roles.png)
![Chính sách che dữ liệu](/synced/cascade/docs/screenshots/redaction.png)

Phần còn lại của công việc quản trị nằm trong Cài đặt: vai trò và ai nắm giữ chúng, chính sách che dữ liệu (một quy trình chọn một chính sách trong phần cài đặt của nó, từ trình soạn thảo), nhà cung cấp bí mật bên ngoài, chuyển tiếp nhật ký, cùng đăng nhập và SCIM. Chủ sở hữu hoặc quản trị viên thay đổi các mục này; những người khác chỉ đọc những gì họ được phép, không bao giờ được hiện một nút mà máy chủ sẽ từ chối, và máy chủ vẫn từ chối nó.

Có bốn màn hình nằm cạnh các quy trình. Thông tin đăng nhập được tạo, mở, sửa, chia sẻ với dự án khác và xóa ngay trong dự án của chúng; một trường bí mật chỉ nhập một lần và màn hình chỉ cho biết nó đã được đặt. Dự án cho biết ai ở trong từng dự án và với vai trò gì, cùng các khóa tài khoản dịch vụ mà một tích hợp thường trực dùng để đăng nhập. Tài khoản của bạn (địa chỉ trên thanh trên cùng) tạo và thu hồi khóa API của bạn, là thứ mà REST API và máy chủ MCP dùng để đăng nhập, và đổi mật khẩu của bạn. Với chủ sở hữu và quản trị viên, Cài đặt có các cài đặt chung (yếu tố thứ hai, quy trình xử lý lỗi), Người dùng tạo người dùng và tắt họ, còn nhật ký kiểm toán được đọc, lọc và kiểm tra xem có bị can thiệp hay không tại đó. Đăng nhập vẫn là chính trình soạn thảo, ở `/login`, và giữ đăng nhập một lần (SSO), đăng nhập qua thư mục, passkey và mã khôi phục.

![Thông tin đăng nhập, bí mật không bao giờ hiển thị](/synced/cascade/docs/screenshots/credentials.png)
![Dự án và ai ở trong một dự án](/synced/cascade/docs/screenshots/projects.png)
![Nhật ký kiểm toán và phép kiểm tra rằng nó còn nguyên vẹn](/synced/cascade/docs/screenshots/audit.png)
![Tài khoản của bạn và các khóa API của nó](/synced/cascade/docs/screenshots/account.png)

Điều này có nghĩa với bạn: mọi thứ Cascade làm được, bạn đều làm được từ màn hình này, trên một máy trong nhà máy không có internet, mà không cần một dòng curl nào.

Trình soạn thảo nói ngôn ngữ của người đang đứng trước nó. Bộ chọn trên thanh trên cùng (và trên trang đăng nhập) liệt kê từng ngôn ngữ bằng chính tên của nó, nhớ lựa chọn trong trình duyệt đó và lần đầu sẽ bắt đầu bằng ngôn ngữ của trình duyệt bạn. Tiêu đề các bước và phần trợ giúp của chúng, loại thông tin đăng nhập, các nút, những lời từ chối mà máy chủ gửi, ngày tháng, số và khoảng thời gian đều hiện bằng ngôn ngữ bạn đã chọn, và tiếng Ả Rập chạy từ phải sang trái, còn canvas quy trình vẫn được vẽ từ trái sang phải như với mọi người. Một ngôn ngữ chỉ được cung cấp khi có đủ từng từ của nó: `web/src/i18n/check.mjs` làm bản dựng thất bại khi thiếu một dòng, một chỗ giữ chỗ hoặc một dạng số nhiều, còn `web/scripts/i18n-scan.mjs` làm nó thất bại với văn bản gõ thẳng vào màn hình. Các từ nằm trong `web/src/i18n/locales/<language>/`, và một loại bước hay lời từ chối mà máy chủ có thêm sẽ được một bài kiểm thử Go đối chiếu với chúng. Đầu ra riêng của một lần chạy, và bất cứ điều gì một chương trình do một bước gọi đã nói, được hiển thị đúng như đã ghi lại.

Điều này có nghĩa với bạn: người vận hành đọc màn hình bằng ngôn ngữ của chính họ, và một màn hình mới không thể ra mắt với một dòng tiếng Anh mà không ai dịch.
