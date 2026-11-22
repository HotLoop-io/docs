---
title: "HotLoop Flow 편집기"
description: "밝은 테마와 어두운 테마의 Flow 편집기: 디버그 도크와 런타임 표가 있는 캔버스, 배포 전 검토, 추적한 메시지, 로그인 화면입니다."
---

편집기는 시스템 설정을 따라 밝게 또는 어둡게 표시되며, 아래의 그림은 모두 두 가지로 보여 드리고 밝은 쪽이 먼저입니다. 아래 그림은 모두 `web/shots/screenshots.sh`에서 만들어지며, 이 스크립트가 실제 바이너리와 실제 브라우저를 실행하므로 편집기가 바뀌면 다시 촬영되어 목업으로 어긋날 수 없습니다. 캔버스 위의 현장은 배포 두 건이 이어진 오븐 라인입니다.

## 배선하고, 실행하고, 지켜보기

![오븐 라인의 편집기: 캔버스, 배포 이력, 디버그 및 런타임 패널](/synced/flow/docs/screenshots/editor.png)
![같은 화면, 어두운 테마](/synced/flow/docs/screenshots/editor-dark.png)

캔버스는 지금 돌고 있는 것입니다. 그 아래의 디버그 도크는 디버그 노드가 보는 내용을 출력하고, 옆의 Runtime 표는 모든 노드에 들어가고 나온 것을 세며 큐가 얼마나 찼는지 막대로 보여 줍니다. 라인이 이상하게 동작하면 로그를 뒤지는 대신 화면에서 읽습니다.

## 라인에 닿기 전에 검토하기

![변경된 노드 하나와 메모 상자가 있는 검토 패널, 그 노드가 윤곽선으로 표시된 캔버스 옆](/synced/flow/docs/screenshots/review.png)
![같은 화면, 어두운 테마](/synced/flow/docs/screenshots/review-dark.png)

배포를 눌러도 곧바로 배포되지 않습니다. 변경 사항을 캔버스에 그리고, 말로 풀어 쓰고, 메모를 요청합니다. 메모는 이름과 함께 이력에 남으므로, 새벽 2시에 연락을 받는 사람도 무엇이 왜 바뀌었는지 볼 수 있습니다.

## 메시지를 따라 배선을 내려가기

![각 노드가 쓴 시간과 함께 캔버스 전체에 불이 들어온 추적 메시지, 아래의 디버그 도크](/synced/flow/docs/screenshots/debug.png)
![같은 화면, 어두운 테마](/synced/flow/docs/screenshots/debug-dark.png)

디버그 줄에서 Trace를 누르면 그 메시지가 지나간 경로가 캔버스 위에 한 홉씩 밝아지고, 각 노드가 메시지에 한 일과 걸린 시간이 함께 표시됩니다. 같은 패널에서 그것을 테스트로 만들거나 초안에 재생할 수 있습니다.

## 로그인

![로그인 카드](/synced/flow/docs/screenshots/signin.png)
![같은 화면, 어두운 테마](/synced/flow/docs/screenshots/signin-dark.png)

![대시보드가 사용자를 로그인시키는데 이 페이지를 다른 방법으로 열었을 때 런타임이 보여 주는 안내](/synced/flow/docs/screenshots/dashboard-signin.png)
![같은 화면, 어두운 테마](/synced/flow/docs/screenshots/dashboard-signin-dark.png)

잠기지 않은 상태로는 시작하지 않으므로, 누구나 처음 보는 것은 로그인입니다. EmberCORE 대시보드가 사용자를 로그인시키는 경우, 다른 방법으로 연 런타임은 두 번째 비밀번호를 묻는 대신 대시보드를 통해 들어오라고 안내합니다.
