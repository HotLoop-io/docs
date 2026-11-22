---
title: "Luồng con trong HotLoop Flow"
description: "Gói một tập nút thành một nút dùng lại được với thuộc tính riêng, và xem luồng con chia sẻ gì với luồng bao quanh nó."
---

Mỗi thể hiện có bản sao riêng của các nút trong mẫu, ngữ cảnh luồng riêng và các thuộc tính đã được xác định riêng. Cùng một mẫu hiển thị `4.2 bar` ở một thể hiện và `4.2 kPa` ở thể hiện kế tiếp, được kiểm chứng từ đầu đến cuối qua một lần triển khai thật chứ không chỉ khẳng định trong kiểm thử đơn vị.

Việc mở rộng tạo ra một **đồ thị riêng** thay vì viết lại các luồng đã phân tích, và đó là toàn bộ quyết định thiết kế. Tệp luồng không bao giờ bị chạm vào, nên vòng đi về giống hệt từng byte vẫn đúng, và đồ thị đã mở rộng là một đồ thị bình thường, vì vậy bộ lập lịch, định tuyến Catch, chỉ số và các sự kiện trạng thái của trình soạn thảo đều hoạt động bên trong luồng con mà không có trường hợp đặc biệt nào.

Lồng nhau vẫn chạy được. Một lỗi không ai bắt bên trong luồng con sẽ đi ra tới nút Catch trên tab gọi, vì nếu không thì luồng con chỉ là nơi lỗi biến mất. Một nút cấu hình khai báo bên trong mẫu được **chia sẻ** bởi mọi thể hiện thay vì bị sao chép, vì một broker MQTT trong luồng con là tác giả đang nói "hãy chia sẻ cái này", và sao chép nó sẽ mở một kết nối cho mỗi thể hiện tới thứ gần như chắc chắn đang đếm chúng.
