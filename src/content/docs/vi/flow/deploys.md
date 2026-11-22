---
title: "Mỗi lần triển khai là một bản ghi"
description: "Ai, khi nào, vì sao và từng byte của mỗi lần triển khai, so sánh từng nút trong API, CLI và git, với bản khôi phục giữ nguyên thông tin xác thực."
---

"Cái gì đã đổi, ai đã đổi, hãy trả nó về" là câu đầu tiên ai cũng hỏi sau khi một dây chuyền dừng. Ba tệp `.bak` không trả lời được câu nào. Chúng không biết ai, chúng bị ghi đè sau ba lần lưu, và tệp bạn cần luôn là tệp thứ tư.

Vì vậy mỗi lần triển khai ghi một bản ghi bất biến dưới `data/deployments/`: ai đã triển khai (theo token của họ, không bao giờ theo điều máy khách tự nhận), từ đâu, khi nào, ghi chú họ để lại, bản sửa đổi mà nó thay thế, tệp luồng từng byte một, và thông tin xác thực đúng như lúc sau khi triển khai, được mã hóa y hệt tệp thông tin xác thực. Bản ghi chỉ được thêm vào. Nhật ký giữ 100 bản gần nhất theo mặc định (`history.retain`, và 0 giữ tất cả), và không bao giờ cắt bản mới nhất, vì bản mới nhất là bản đang chạy.

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:1880/deployments/42/flows > flows-42.json
```

Ghi chú đi cùng lần triển khai, dưới dạng `"note"` trong tài liệu được bọc (`{"rev": ..., "flows": [...], "note": "..."}`) hoặc dưới dạng header `HotLoop-Flow-Deployment-Note`. Dạng tài liệu tồn tại vì trình duyệt không đặt gì ngoài Latin-1 vào header, mà mọi người viết ghi chú bằng ngôn ngữ của mình.

Nó làm hai việc mà bạn chỉ nhận ra là thiếu sau khi bị cắn:

- **Chỉnh sửa thủ công bị phát hiện.** Nếu tệp luồng trên đĩa không phải thứ cuối cùng nhật ký đã ghi, vì ai đó đã sửa nó trong lúc tiến trình đang dừng, thì lúc khởi động sẽ ghi lại nó như một mục `baseline` nói rõ điều đó. Cũng vậy ở lần khởi động đầu tiên khi đã có sẵn tệp luồng. Nếu không, một chỉnh sửa thủ công lặng lẽ trở thành quá khứ không ai ghi lại.
- **Nhật ký không ghi được không làm dừng dây chuyền.** Lúc đó tệp luồng đã được lưu, nên từ chối lần triển khai sẽ để đĩa và các luồng đang chạy bất đồng cho tới lần khởi động lại sau. Lần triển khai vẫn tiếp tục, và cả phản hồi lẫn nhật ký đều nói bằng lời rằng lần này không có bản ghi.

API không bao giờ đưa ra thông tin xác thực trong một bản ghi, dù đã mã hóa hay chưa. Chúng được giữ cho một việc, đặt chúng trở lại, và một endpoint lịch sử không phải là cách để mang chúng đi.

## Phần khác biệt đọc như một buổi review

Diff từng dòng của một tệp luồng thì trung thực nhưng vô dụng. Kéo một nút hai mươi pixel là một thay đổi. Đổi một ngưỡng cũng là một thay đổi. Người review không thể biết cái nào sắp làm dừng một máy ép. Vì vậy Flow so sánh từng nút:

```
1 changed, 2 moved

Tab "Line 3" (t1)
  ~ switch "Pressure check" (sw1)
      rules[1].v: "7.5" -> "8.0"
      wire added: port 1 -> change "set alarm" (alarm1)

Moved on the canvas only
  mqtt in "press 01" (in1)
  debug "ok" (ok1)
```

Thêm, bớt và thay đổi, từng thuộc tính với giá trị cũ và mới, đường nối nào đã chuyển theo cổng ra, và **bố cục tách khỏi logic**: di chuyển, đổi kích thước hay ẩn một nhãn là "đã di chuyển trên canvas", không bao giờ là thay đổi, nên một lần dọn dẹp đọc ra là dọn dẹp. Thông tin xác thực đọc là "đã đặt" hoặc "đã đổi", không bao giờ kèm giá trị. Chỉnh sửa bên trong một subflow hiện ra trên subflow, và kéo một cổng của nó cũng là bố cục.

Cùng một câu trả lời ở mọi nơi, từ một gói của engine:

- `GET /deployments/{from}/diff/{to}` so sánh hai lần triển khai.
- `POST /flows/diff` so sánh thứ đang chạy với một tài liệu chưa ai triển khai, đó là thứ bạn xem trước khi nhấn triển khai.
- `hotloop-flow diff old.json new.json` trên dòng lệnh. `-json` cho chương trình. Thoát với mã 1 khi có điều gì khác biệt, như `diff`.
- **Bên trong git.** Đặt nó làm driver diff của git cho tệp luồng, và `git diff`, `git log -p` và `git show` in ra diff theo ngữ nghĩa thay vì một khối JSON:

  ```bash
  git config diff.hotloop-flow.command 'hotloop-flow diff'
  echo 'flows.json diff=hotloop-flow' >> .gitattributes
  ```

  Hoặc dùng như difftool: `git config difftool.hotloop-flow.cmd 'hotloop-flow diff "$LOCAL" "$REMOTE"'`, rồi `git difftool -t hotloop-flow`.

Một luồng được so sánh với chính nó thì hoàn toàn không có thay đổi, với mọi tài liệu mà trình phân tích chấp nhận.

## Đặt nó trở lại

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "HotLoop-Flow-Deployment-Rev: $CURRENT_REV" \
  -d '{"note":"42 broke the label printer"}' \
  http://localhost:1880/deployments/41/rollback
```

Một lần khôi phục triển khai lại một bản ghi cũ **như một bản ghi mới**. Lịch sử vẫn chỉ được thêm vào: lần triển khai 41 không bị chạm tới, và lần khôi phục là một mục riêng ghi "khôi phục về lần triển khai 41", ai đã làm và vì sao. Tệp luồng quay lại từng byte một, nên nó là cùng một bản sửa đổi như lúc đó.

**Thông tin xác thực cũng quay lại.** Mỗi bản ghi mang chúng đúng như lúc đó, nên một nút bạn đã xóa trở lại cùng mật khẩu broker của nó, thay vì trở lại rồi không đăng nhập được. Điều này được kiểm thử với một Mosquitto thật từ chối khách ẩn danh: xóa bên đăng ký, triển khai, khôi phục, và nó đăng nhập lại và thông điệp chảy.

Nó từ chối theo ba cách, trước khi có gì được ghi. Một `HotLoop-Flow-Deployment-Rev` đã cũ nhận cùng mã 409 mà một lần triển khai sẽ nhận, vì một lần khôi phục chạy đua với lần triển khai của người khác vẫn là một cuộc đua. Một lần triển khai đã bị chính sách lưu giữ xóa là 404. Và một bản ghi mà thông tin xác thực không giải mã được bằng bí mật thông tin xác thực hiện tại là 422, vì những luồng không đăng nhập được vào đâu cả là một lần khôi phục chỉ trông như đã thành công.

## Trong trình soạn thảo

**Deploy không triển khai.** Nó mở một buổi review: diff của engine so với thứ đang chạy, vẽ trên canvas và liệt kê bằng lời, kèm một ô cho ghi chú. Xanh lá là thêm, hổ phách là thay đổi, xanh dương là chỉ di chuyển, và những bóng ma đỏ nằm ở chỗ các nút và đường nối bị bỏ từng ở. Một tab có thay đổi sẽ có một chấm. Nút Deploy thứ hai mới là nút triển khai, và ghi chú đi vào nhật ký. Sửa bất cứ gì khi buổi review đang mở thì nó đóng lại, vì review của thứ bạn đã đổi từ sau đó là lời nói dối về thứ bạn sắp đẩy lên.

**Bảng lịch sử** liệt kê mỗi lần triển khai với ai, khi nào và ghi chú. *Changes* mở lần triển khai đó trên một canvas chỉ đọc với phần nó đã đổi được vẽ lên, đè lên bản làm việc của bạn, bản này vẫn y như bạn để lại. *Roll back* hỏi vì sao, cảnh báo nếu bạn sắp bỏ những chỉnh sửa chưa lưu, rồi triển khai nó.

**Xung đột khi triển khai cho thấy người kia đã làm gì.** Trước đây đó là một `confirm()` của trình duyệt hỏi bạn ghi đè bản của họ hay mất bản của bạn mà không nói bản của họ là gì. Giờ nó nói ai đã triển khai, khi nào, ghi chú của họ và thay đổi của họ từng nút, rồi cho bạn tải bản của họ, ghi đè bằng bản của bạn, hoặc tiếp tục chỉnh sửa.

**Sao chép, cắt và dán hoạt động như bạn mong đợi, và chúng nói bằng tệp luồng.** Chọn các nút, Ctrl+C, và thứ trong clipboard của bạn là cùng JSON mà mọi công cụ luồng khác đọc, nên bạn có thể dán vào một cuộc trò chuyện, một ticket hay một máy khác. Dán đặt nó tại chỗ con trỏ của bạn, với id mới mỗi lần, nên dán hai lần cho hai bản sao và không bao giờ đụng độ. Một đường nối tới thứ bạn không sao chép bị cắt thay vì chỉ vào hư không, và một nút cấu hình mà các nút dùng đi kèm theo. Nếu nút cấu hình đó đã có trong luồng bạn đang dán vào, bản sao dùng chung nó thay vì mở kết nối thứ hai tới thứ có đếm số kết nối. Thông tin xác thực không bao giờ vào clipboard. Một mật khẩu trong bộ đệm dán là cách nó kết thúc trong một báo cáo lỗi.

**Import và Export** làm điều tương tự cho một vùng chọn, một luồng, hoặc tất cả, với một ô để sao chép, nút Download và bộ chọn tệp khi nhập. Rác nhận được một lý do ("id a xuất hiện hai lần", "mục 1 không có id") và hộp thoại vẫn mở. Một loại nút mà runtime này không có sẽ vào với màu xám và nét đứt, và phần nhập cho bạn biết là loại nào, vì một nút bị bỏ lặng lẽ còn tệ hơn một nút ồn ào.

Một màn hình là một phần của tệp đó. Bảng điều khiển mà một luồng vẽ (`ui_tab`, `ui_group` và các widget) là các nút trong luồng, nên màn hình của khách hàng đi cùng luồng của họ qua Export và Import, và không cái nào nằm trong chính HotLoop Flow.

**Subflow được chỉnh sửa trên canvas riêng.** Nhấn *+ subflow* và nó mở ra cùng các cổng vào và ra. Nối chúng với các nút bên trong như mọi thứ khác. *Subflow properties* đặt tên, màu, số đầu ra và các thuộc tính mà một thể hiện có thể đặt. Các thể hiện trên luồng đi theo khi hình dạng thay đổi, và bảng chọn liệt kê mọi subflow để bạn thả một cái vào. Nhấp đúp vào một thể hiện để đặt cho nó tên riêng và giá trị riêng cho từng thuộc tính. Một subflow không thể đặt bên trong chính nó hay bên trong một subflow chứa nó, và một cái còn đang dùng không thể bị xóa. Trình soạn thảo nói vậy thay vì để lần triển khai tiếp theo phát hiện ra.

**Từ vùng chọn thành subflow.** Chọn các nút và nhấn *Selection to subflow*. Chúng chuyển vào một subflow riêng và một thể hiện thế chỗ. Mọi đường nối từng cắt ngang biên của vùng chọn trở thành một cổng: lối vào duy nhất là đầu vào của subflow, và mỗi đầu ra của một nút được chọn từng đi nơi khác là một đầu ra của subflow, nên luồng vẫn làm đúng như trước. Một subflow có một đầu vào, nên nếu vùng chọn được nối vào hai nút khác nhau thì nó báo vậy và không đổi gì, vì cấp cho cả hai từ cả hai sẽ là một luồng khác. Chọn một nhóm và nó đi cùng mọi thứ trong đó. Một nút cấu hình thuộc về luồng và chỉ vùng chọn dùng sẽ vào subflow cùng nó, cùng với thứ nó trỏ tới. Một nút mà thứ ở lại cũng dùng thì trở thành toàn cục, để hai đầu tiếp tục dùng chung một kết nối, vì một kết nối broker thứ hai trên một máy có đếm số kết nối là kiểu bất ngờ chúng tôi không phát hành. Các biến môi trường mà những nút được chuyển đọc (kiểu env, dạng `${NAME}` hoặc `$(NAME)` trong một chuỗi, hoặc `env.get`) và luồng đã khai báo trở thành thuộc tính của subflow chuyển tiếp về luồng, nên giá trị vẫn đến từ nơi nó vốn đến và thể hiện có thể ghi đè. Ctrl+Z hoàn tác tất cả.

**Luồng.** Nhấp đúp vào một tab, hoặc nhấn *Flow properties*, để đổi tên hay xóa nó. Xóa sẽ hỏi, mang theo mọi nút trên luồng, và cắt các đường nối và liên kết mà luồng khác có tới nó để tệp không chỉ vào hư không. Nó cũng gỡ các nút đã xóa khỏi mọi phạm vi Catch, Status hay Complete có nêu tên chúng. Một Catch hay Status bị xóa hết danh sách sẽ giữ id cuối cùng, vì danh sách rỗng nghĩa là cả luồng và chúng tôi sẽ không lén chuyển một nút từ theo dõi một thứ sang theo dõi mọi thứ sau lưng bạn. Ctrl+Z đem nó trở lại cho đến khi bạn triển khai. Luồng cuối cùng không thể xóa, vì một runtime không có luồng thì không có chỗ đặt nút.

**Nút cấu hình** nằm trong bảng chọn dưới *configuration*. Chúng không nằm trên canvas nào, nên bạn nhấp đúp vào loại, điền hộp thoại, và nó được thêm vào danh sách dưới *configuration in use*, nơi nhấp đúp sẽ sửa còn dấu chéo sẽ xóa. Một cái mà nút còn dùng sẽ không xóa được, và cho biết bao nhiêu nút đang dùng. Đó là nơi "Add one from the palette first" trong hộp thoại của một nút đưa bạn tới.

**Xóa một đường nối.** Alt và nhấp. Nhấp thường không làm gì, nên lướt qua một đường nối khi chọn không thể làm hỏng một luồng. Ctrl+Z đặt nó lại.

**Đường nối bền vững.** Nhấp đúp vào một đường nối. Đánh dấu *Durable* và nó được vẽ đậm hơn và màu xanh dương, và nút mà nó đi ra nhận `ew_durable` trong tệp. Dấu nằm trên cặp nút, nên nó có hiệu lực với mọi đường nối giữa chúng. Đó là nối dây tới runtime, nên đánh dấu một đường không bao giờ khởi động lại nút.

**Nhóm.** Ctrl+G bọc vùng chọn, Ctrl+Shift+G tháo ra. Nhấp đúp vào thanh tiêu đề để đặt tên và màu. Kéo một nhóm và mọi thứ trong đó đi theo. Kéo một nút vào một nhóm và nó gia nhập, kéo ra và nó rời đi. Nhóm có thể lồng nhau. Xóa một nhóm sẽ xóa những gì trong đó, và Ctrl+Z đặt lại tất cả.

**Tìm kiếm** (Ctrl+F, hoặc nút) nhìn vào mọi luồng và subflow cùng lúc: tên, loại, id và mọi thiết lập, kể cả một dòng giữa thân hàm. Một kết quả đưa bạn tới đúng tab với nút được chọn và nằm giữa khung nhìn. Các nút cấu hình cũng hiện ra, và kết quả của chúng mở hộp thoại của chúng, vì chúng không có chỗ trên canvas.

**Lọc gỡ lỗi.** Thu hẹp thanh bên về một luồng, các nút bạn đã chọn, một từ, hoặc chỉ các lỗi. Nó áp dụng cho những gì đã có trong nhật ký, không chỉ những gì đến sau, nên thu hẹp không bao giờ làm dòng bạn đang xem biến mất.

Tất cả những điều đó được nhấp qua trong một trình duyệt thật ở mỗi pull request, với tệp nhị phân thật có trình soạn thảo nhúng sẵn. Điều đó gồm mọi hộp thoại nút mà runtime cung cấp: danh sách lấy từ `GET /nodes`, nên một nút được thêm vào tháng sau sẽ có trong bài kiểm thử tháng sau mà không ai cần nhớ để thêm. Khi viết các bài kiểm thử đó, chúng tôi tìm ra hai thứ chưa bao giờ hoạt động trong Chromium: nhấp đúp vào một nút để mở hộp thoại của nó, và kéo một đường nối lên một nút. Canvas giữ con trỏ trong suốt lúc kéo, nên mục tiêu của sự kiện luôn là canvas và một đường nối thả lên trên một nút không bao giờ tìm thấy nút. Cả hai đều đáng xấu hổ như mọi lỗi có thể có trong một trình soạn thảo trực quan. Cả hai đã được sửa.

## Luồng như mã

Kho mã là nơi các luồng được review, nên kho mã nên có thể triển khai chúng. Giữ tệp luồng trong git, thiết lập driver diff ở trên để pull request đọc như một buổi review, và để lần merge triển khai nó:

```bash
hotloop-flow export -o flows.json          # the live file, byte for byte, to commit
hotloop-flow deploy -file flows.json -note "PR #12: line 3 pressure check"
```

`deploy` in diff so với thứ đang chạy, cùng văn bản như mọi nơi khác, rồi triển khai dựa trên bản sửa đổi mà diff đó được tạo từ. Nếu ai đó triển khai xen giữa, đó là một 409 và một pipeline đỏ, không phải một lần ghi đè lặng lẽ. `-expect-rev` ghim nó vào bản sửa đổi mà một kế hoạch đã review được tạo, và `-dry-run` in diff và không triển khai gì. Một tệp không có gì để đổi thì không triển khai gì và không thêm gì vào lịch sử, nên một lần merge không đụng tới luồng không làm rác nhật ký. Một nút không khởi động được vẫn được triển khai và vẫn làm tác vụ thất bại, vì phần còn lại của luồng đang chạy và ai đó cần xem xét. `export -deployment 41` lấy bất kỳ lần triển khai nào ra khỏi lịch sử.

**Một pipeline không bao giờ giữ mật khẩu quản trị.** Nó nhận một API token:

```bash
hotloop-flow token -name ci
```

in một token, một lần, cho kho bí mật của pipeline, cùng hash để đưa cho runtime: `HOTLOOP_FLOW_DEPLOY_TOKEN_HASH` cho token triển khai, hoặc `auth.tokens` trong tệp cấu hình cho mọi loại khác. Runtime chỉ giữ hash, giống như mật khẩu. Token triển khai có thể đọc các luồng và triển khai, gồm cả khôi phục, và không gì khác: không thiết lập, không inject, không trình soạn thảo. Cả hai lệnh đọc token từ `HOTLOOP_FLOW_TOKEN` (hoặc `-token-file`) và thể hiện từ `HOTLOOP_FLOW_URL` (hoặc `-url`), không bao giờ để token trên dòng lệnh, nơi nó sẽ rơi vào danh sách tiến trình và mọi nhật ký pipeline in lại lệnh. Lịch sử hiển thị token là người triển khai, `token:ci`, cùng ghi chú mà pipeline truyền.

Thông tin xác thực không bao giờ đi theo cách này. Chúng không nằm trong tệp luồng, nên một lần triển khai từ git giữ mọi mật khẩu broker đúng chỗ cũ.

## Một bản sao git, nếu bạn muốn

Nhật ký triển khai nằm trên máy. Một kho mã là nơi mọi người khác đã xem sẵn: có giao diện web, blame, bản sao lưu và những người biết đọc nó. Trỏ Flow vào một kho và mỗi lần triển khai trở thành một commit của tệp luồng trên một nhánh mà chỉ Flow ghi vào, **với tác giả là người đã triển khai nó**, vào lúc họ triển khai, với ghi chú của họ làm thông điệp:

```yaml
history:
  git:
    url: https://git.plant.example/line3/flows.git
    branch: main              # one nobody else pushes to
    path: flows.json
    emailDomain: plant.example  # dana deploys, the commit is from dana@plant.example
```

Mật khẩu là một token truy cập từ máy chủ git, và nó đi vào `HOTLOOP_FLOW_GIT_PASSWORD` từ một Secret, không bao giờ vào tệp (`HOTLOOP_FLOW_GIT_URL` và `HOTLOOP_FLOW_GIT_USERNAME` cũng dùng được). Một URL có mật khẩu bên trong bị từ chối lúc khởi động, nên URL luôn có thể được ghi nhật ký. Chỉ `http://` và `https://`: image không có tệp nhị phân git cho `file://` và không có khóa cho `ssh://`, và một bản sao thất bại ở mỗi lần push còn tệ hơn một bản sao từ chối khởi động. Các lần khôi phục và đường cơ sở lúc khởi động nói rõ chúng là gì trong commit, và mỗi commit mang một trailer `Flow-Deployment: N`, nhờ đó một tiến trình khởi động lại, hay một tiến trình có bản clone bị xóa, tiếp tục đúng chỗ mà kho mã nói nó đã tới, không trùng lặp.

**Nó không bao giờ giữ chân một lần triển khai.** Việc push diễn ra trên goroutine riêng. Một máy chủ git ngừng, chậm hay từ chối push không làm lần triển khai mất gì: các commit chờ trong một bản clone cục bộ dưới `data/git-mirror` và đi ra ở lần push thành công tiếp theo, thử lại mỗi phút. `GET /deployments` cho biết bản sao đã tới đâu và lỗi gần nhất, và `hotloop_flow_git_mirror_behind_deployments` là con số để đặt cảnh báo. Đã kiểm thử với chính máy chủ smart-HTTP của git phía sau xác thực cơ bản: ba lần triển khai tạo ba commit của ba tác giả, một lần push mà máy chủ từ chối sẽ chờ và bắt kịp khi nó thôi từ chối, và một lần triển khai với máy chủ git mất mười giây để nói không vẫn trở về trong vài mili giây.

Đó là Go thuần (go-git), nên tệp nhị phân vẫn tĩnh. Nó tốn khoảng 3.8 MB tệp nhị phân, vì thế nó được đo chứ không giả định. Tệp nhị phân là 48,083,106 byte trước các danh mục.
