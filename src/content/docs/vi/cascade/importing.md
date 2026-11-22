---
title: "Đưa một quy trình vào"
description: "Nhập một quy trình có sẵn vào Cascade: những gì được chuyển sang và những gì công cụ nhập báo là không chuyển được."
---

`hotloop-cascade workflows convert export.json -o workflow.yaml --report report.json` chuyển đổi một quy trình được xuất dưới dạng JSON từ công cụ khác. Nó chuyển sang những gì nó chắc chắn: các bước nó biết và các lần đọc trường trong phần cài đặt của chúng. Mọi thứ còn lại sang ở trạng thái tắt, kèm cài đặt gốc trong ghi chú, và báo cáo liệt kê từng mục cùng lý do. Nó không bao giờ biến một biểu thức JavaScript thành một phỏng đoán về ý nghĩa của nó, và không bao giờ mang theo thông tin đăng nhập, vì bản xuất không có chúng: báo cáo cho biết ô nào cần loại nào. Sau đó `workflows import workflow.yaml` sẽ nhập nó vào.
