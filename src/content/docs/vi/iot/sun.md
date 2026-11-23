---
title: "Mặt trời"
description: "Giờ mặt trời mọc, lặn, rạng đông, hoàng hôn và vị trí mặt trời tính ngay trên hộp từ vĩ độ và kinh độ, không cần dịch vụ thời tiết hay internet."
---

Cho HotLoop biết nhà máy ở đâu và nó biết mặt trời ở đâu. Mặt trời mọc, mặt trời lặn, rạng đông, hoàng hôn, buổi trưa mặt trời, độ cao và hướng của mặt trời, tất cả được tính ngay trên hộp từ một vĩ độ và một kinh độ. Không dịch vụ thời tiết, không khóa API, không internet. Một địa điểm mất đường truyền lên từ ba tuần trước vẫn bật đèn sân khi trời tối, và đó là toàn bộ lý do việc này không phải là một cuộc gọi tới đám mây của người khác.

## Thiết lập

Hai biến, tính bằng độ thập phân, bắc và đông là số dương:

| Biến | Ví dụ | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `HOTLOOP_SITE_LATITUDE` | `41.4993` | bắc là dương |
| `HOTLOOP_SITE_LONGITUDE` | `-81.6944` | đông là dương, nên toàn bộ châu Mỹ là số âm |

Trong chart chúng là `plant.latitude` và `plant.longitude`. Cả hai hoặc không cái nào. Một nửa vị trí, một con số nằm ngoài hành tinh, hoặc `41°29'58"N` sẽ làm HotLoop dừng khi khởi động và nêu tên biến, vì giờ mặt trời mọc tính từ một lỗi gõ sẽ lệch hàng giờ mà trên màn hình vẫn trông hoàn toàn hợp lý. Lấy các con số từ bất kỳ bản đồ nào: bấm chuột phải, sao chép tọa độ.

Nếu bỏ trống, sẽ không có thực thể mặt trời, và một quy tắc có trigger mặt trời sẽ không được kích hoạt (nhật ký hệ thống cho biết cần đặt hai biến nào). Màn hình Cài đặt hiển thị cả hai, chỉ để đọc. Mặt trời mọc là thứ mà các quy tắc chạy theo, nên nó chỉ đổi qua một lần triển khai đã được xem xét.

## Các thực thể

| Thực thể | Trạng thái | <span class="sr-only">Chi tiết</span> |
|---|---|---|
| `binary_sensor.sun_up` | `on` từ lúc mặt trời mọc đến lúc lặn | thuộc tính `next_dawn`, `next_sunrise`, `next_noon`, `next_sunset`, `next_dusk`, theo múi giờ của địa điểm |
| `sensor.sun_elevation` | số độ trên đường chân trời, âm khi ở dưới | độ nguyên |
| `sensor.sun_azimuth` | số độ theo chiều kim đồng hồ từ hướng bắc thật, 90 là hướng đông | độ nguyên |

Chúng thuộc nền tảng `sun`, chỉ đọc và không nhận dịch vụ nào. `sun_up` được tính chính xác, nên nó đổi đúng giây mà các trigger mặt trời mọc và lặn chạy, không dựa vào độ cao đã làm tròn.

Độ cao và phương vị là độ nguyên có chủ ý. Mặt trời di chuyển khoảng một phần tư độ mỗi phút. Ở mức một phần mười độ, cứ 24 giây sẽ có một trạng thái mới, một dòng nhật ký và một điểm lịch sử, cả ngày, mỗi ngày, cho từng cảm biến, chỉ để có độ chính xác mà không ai dùng để tự động hóa. Một quy tắc cần «mặt trời cao hơn 10 độ» có được điều đó theo từng độ.

Dưới mặt trời nửa đêm hay trong đêm địa cực, lần mặt trời lặn hoặc mọc kế tiếp có thể còn vài tuần, và thuộc tính cho biết khi nào. Nếu trong một năm không có lần nào, nó ghi `none within a year` thay vì lặng lẽ bị bỏ qua.

## Trigger

```json
{"type": "sun", "event": "sunset", "offsetSec": -1800}
```

`dawn`, `sunrise`, `noon`, `sunset` hoặc `dusk`, dời đi theo `offsetSec` (âm là trước, tối đa sáu giờ mỗi chiều). Xem [Tự động hóa](/vi/iot/automations/#trình-kích-hoạt-theo-mặt-trời). `binary_sensor.sun_up` cũng dùng được với trigger `state` thông thường, và với `states['binary_sensor.sun_up'] == 'off'` trong một điều kiện, cho trường hợp «chỉ sau khi trời tối».

## Ý nghĩa của các con số

- **Mặt trời mọc và lặn** là lúc mép trên của mặt trời chạm đường chân trời, với mức hiệu chỉnh chuẩn cho việc không khí bẻ cong ánh sáng: tâm ở dưới đường chân trời 0,833 độ. Đó là điều mọi niên giám và mọi chiếc điện thoại gọi là mặt trời mọc.
- **Rạng đông và hoàng hôn** là chạng vạng dân dụng, tâm ở dưới 6 độ. Đây là mốc mà chiếu sáng ngoài trời được viết theo: sau hoàng hôn dân dụng cần có đèn để làm việc bên ngoài.
- **Buổi trưa mặt trời** là lúc mặt trời đúng hướng nam (đúng hướng bắc, ở phía nam xích đạo) và ở điểm cao nhất. Hiếm khi đó là 12:00 trên đồng hồ; ở rìa phía tây của một múi giờ vào mùa hè, nó muộn hơn một giờ chiều khá nhiều.
- **Độ cao** là chỗ mặt trời trông thấy, đã hiệu chỉnh khúc xạ. Phương vị tính từ hướng bắc thật, không phải bắc từ.

Lưu ý về đường chân trời phẳng: các giá trị này dành cho đường chân trời ngang mực nước biển. Một nhà máy trong thung lũng mất mặt trời sau sườn núi trước lúc lặn, và HotLoop không biết về sườn núi. Hãy đặt một độ lệch cho trigger.

## Làm sao chúng tôi biết là đúng

Phép tính là của NOAA: các phương trình đằng sau máy tính mặt trời của Global Monitoring Laboratory (gml.noaa.gov/grad/solcalc), vốn là của *Astronomical Algorithms* do Jean Meeus viết. Được chuyển nguyên vẹn, kể cả chỗ lạ (buổi trưa mặt trời của NOAA đọc phương trình thời gian quanh nửa đêm UT thay vì buổi trưa, chênh vài giây, và được giữ nguyên để chúng tôi khớp NOAA đến từng giây).

Bài kiểm tra đọc cả 4.380 ô mặt trời mọc và lặn, giữ mọi thời điểm cắt trong phút mà NOAA in ra cộng thêm hai giây, và mỗi một trong 2.190 buổi trưa trong vòng một giây. Khoảng 97 phần trăm làm tròn ra đúng cùng một phút; phần còn lại cách mốc nửa phút khoảng một giây, tức là hai máy tính bất đồng ở chữ số cuối, không phải về mặt trời. Mọi ngày NOAA nói không có mặt trời mọc hay không có mặt trời lặn, HotLoop cũng nói y như vậy.

NOAA không công bố bảng chạng vạng, nên rạng đông và hoàng hôn được kiểm theo định nghĩa của chúng: vào lúc HotLoop nói là hoàng hôn, cùng phép tính vị trí đó đặt tâm mặt trời thấp hơn 6 độ, chính xác đến một phần năm mươi độ.

NOAA nói phương pháp của họ tốt đến khoảng một phút giữa hai vòng cực và kém đi về phía hai cực, nơi mặt trời lướt sát đường chân trời và một sai số nhỏ về độ cao là vài phút trên đồng hồ. Utqiagvik vượt qua cùng ngưỡng như mọi nơi khác. Ở chính hai cực, phương pháp từng ngày có thể bỏ lỡ lần mặt trời mọc duy nhất trong năm; nếu bạn vận hành một nhà máy ở Nam Cực, hãy đặt một lịch.
