---
title: "알람 알림"
description: "ntfy, Gotify, Discord, 웹훅, 이메일. 휴대폰에서 확인을 누르면 알람이 확인 처리되며, 서명되고 한 번만 쓸 수 있습니다."
---

알람 알림은 4.10.0부터 새벽 3시에 알람이 발생하면 휴대폰으로 알려 줍니다. 알람이 **발생**하면 HotLoop은 설정되어 켜져 있는 채널 중 알람이 우선순위 기준에 해당하는 모든 채널로 알림을 보냅니다. 4.23.6부터 Helm 차트에서 켜져 있으며(`HOTLOOP_NOTIFY_ENABLED`), 채널을 대상과 함께 켜기 전에는 아무것도 보내지 않습니다. 알릴 사람이 없는 배포에는 여기서 설정할 것이 없습니다.

## 왜 "발생"만 알리는가

`alarm.Engine.OnTransition`은 ISA-18.2의 모든 전환(발생, 해제, 확인, 보류, 보류 해제)에서 호출됩니다. 이 패키지는 모두 듣지만 단 하나에만 반응합니다. 전환마다 알리면 운영자가 자기 알람을 확인할 때, 알람이 저절로 해제될 때, 누군가 한 교대 동안 보류할 때마다 휴대폰이 울리게 됩니다. 깜빡이는 알람이 알람을 무시하도록 가르치는 것처럼, 사람들이 알림을 읽지 않고 넘기도록 훈련시키게 됩니다. "발생"은 "화면을 보고 있지 않을 수도 있는 사람이 필요한 일이 생겼다"는 뜻의 유일한 이벤트이고, 이 패키지가 존재하는 이유가 바로 그것입니다.

알림이 가는 다른 경우는 에스컬레이션 하나뿐입니다. 알람이 발생했는데 아무도 확인하지 않았고, 정책이 다음 사람에게 알리라고 하는 경우입니다. 여전히 누군가 필요한 같은 알람을 다른 사람에게 다시 알리는 것이지 새로운 이벤트가 아닙니다. "에스컬레이션"을 참고하십시오.

보류 해제처럼 보이지만 실제로는 발생인 경우가 하나 있습니다. 알람이 보류된 동안 조건이 성립하면 아무도 통보받지 못한 상태이므로, 보류가 끝날 때(시간 만료 또는 수동 해제) 엔진은 보류 해제를 기록한 뒤 발생을 기록하고, 이 발생이 알림을 보냅니다. 보류될 때 이미 알람 상태였고 계속 그 상태인 알람은 미확인으로 돌아오지만 다시 알리지 않습니다. 처음에 이미 알렸기 때문입니다.

## 채널

여섯 가지이며 이것이 전체 목록입니다(하지 않는 것과 그 이유는 [HotLoop 로드맵](/ko/roadmap/)의 "알림"을 참고하십시오). 어느 것도 벤더 SDK나 유료 계정이 필요하지 않으며, 이는 이 프로젝트의 기본 방침과 같습니다. 클라우드 연동은 운영자가 설정하는 선택적 아웃바운드 연결이며, 앱이 실행되려면 반드시 필요한 것이 아닙니다.

- **ntfy**: 휴대폰 푸시이며, 알람을 HotLoop으로 바로 확인 처리하는 **확인** 버튼이 있습니다. 무료이고, 서버를 인터넷 없이 플랜트 네트워크에서 운영할 수 있습니다. "ntfy 설정"을 참고하십시오.
- **Gotify**: 휴대폰 푸시입니다. 무료이고 자체 호스팅이며 인터넷 없이 동작합니다. 버튼과 iPhone 앱이 없으므로 양방향이 아닌 호출기입니다. "Gotify 설정"을 참고하십시오.
- **Discord 웹훅**: 우선순위별로 색을 입힌 Discord 채널의 임베드이며 태그, 값, 한계값, 구역, 라인이 표시됩니다. URL을 붙여넣으면 동작합니다. 위험 알람은 역할을 호출할 수 있습니다. 버튼은 없습니다. "Discord"를 참고하십시오.
- **Discord 봇**: 같은 메시지에 알람에 작용하고 누른 사람을 기록하는 **확인**과 **보류** 버튼이 붙습니다. 버튼 누름은 HotLoop이 Discord로 여는 연결을 통해 돌아오므로 플랜트에 공개 주소가 필요하지 않습니다. "Discord"를 참고하십시오.

- **웹훅**: HotLoop 고유의 JSON 본문(`alarmId`, `name`, `priority`, `priorityLabel`, `message`, `deviceId`, `tagName`, `raisedAt`, `event`, 값은 `raised`이며 에스컬레이션이면 `escalated`)을 설정한 URL로 POST합니다. 보내는 JSON을 그대로 받는 것이면 무엇과도 동작합니다. 작은 HTTP 리스너 뒤의 자체 스크립트, Node-RED, n8n, 워크플로 도구의 "아무 웹훅이나 받는" 트리거 등입니다. (ntfy 토픽을 가리키면 호출은 되지만 원본 JSON이 텍스트로 나오므로, 위의 ntfy 채널을 대신 사용하십시오.) 요약("속도 제한과 요약" 참고)은 `event`가 `summary`이고 그 안의 모든 알람 이름을 담은 `alarms` 목록이 있습니다. 본문을 자기만의 형식으로 요구하는 서비스에는 동작하지 않습니다. Discord는 `content`나 `embeds`가 없어서 400으로 답합니다. Slack, Teams, Google Chat은 자기 텍스트 필드를 요구합니다. Pushover는 `token`, `user`, `message` 필드를, PagerDuty Events API는 `routing_key`, `event_action`, `payload`를 요구합니다. 웹훅을 이런 곳으로 향하게 하면 모든 호출이 실패합니다. Discord에는 Discord가 기대하는 본문을 만들어 주는 전용 채널이 있으니 그것을 사용하십시오.
- **SMTP 이메일**: 운영자가 이미 가진 릴레이(사내 메일 서버, 트랜잭션 메일 업체의 SMTP 엔드포인트, 자체 릴레이)를 통해 보냅니다. API 키도 벤더 라이브러리도 필요 없이 `net/smtp`와 직접 만든 일반 텍스트 메시지만 씁니다. 많은 휴대폰이 이메일을 이미 푸시 알림으로 보여 주고, 많은 호출 도구가 이메일-SMS 브리지 주소를 "연락 수단"으로 받으므로, 이 채널 하나만으로도 유료 의존성 없이 "휴대폰 호출"의 상당 부분을 해결합니다.

## 알람이 가는 곳: 설정

모든 채널은 기본으로 켜져 있으며 보낼 곳이 생길 때까지 대기합니다. 대상이 없는 켜진 채널은 HotLoop의 시작을 막지 않고, 기다리며 그 사실을 알립니다. 관리자는 설정의 "알람과 측정값이 가는 곳"에서 각 채널의 대상을 지정합니다. 웹훅 URL, 이메일 릴레이와 수신자, ntfy 서버와 토픽, Gotify 서버와 토큰, Discord 웹훅 URL, Discord 봇의 토큰과 채널, 엣지 퍼블리셔의 브로커와 Sparkplug 그룹입니다. 각 항목은 지금 무엇을 하고 있는지(전송 중, 대상을 기다리는 중, 꺼짐)와 무엇이 빠졌는지를 보여 줍니다.

- 알람 채널은 설정을 저장하는 순간 적용됩니다. 디스패처가 그 자리에서 다시 만들어지고, 이전 채널이 붙잡고 있던 것이 먼저 나가며, Discord 봇의 연결은 새 연결을 열기 전에 닫힙니다. 그러면 **테스트 전송**(`POST /api/notify/test`)이 방금 저장한 채널에 도달합니다.
- 엣지 퍼블리셔는 큐 파일과 Sparkplug 노드를 소유하므로, 대상은 HotLoop이 시작할 때 읽습니다. 화면에는 "Saved, applies when HotLoop restarts"라고 표시됩니다.
- 거기에 저장한 값이 차트나 환경 변수보다 우선하며, 차트나 환경 변수는 초기값만 줍니다. 비워 둔 값은 저장된 값을 유지하고, 지우기는 그 값을 제거합니다. 시크릿(웹훅 URL, ntfy 토픽, 토큰, 비밀번호)은 다시 표시되지 않고 설정 여부만 표시되며, HotLoop에 비밀 키가 있으면 데이터베이스에 봉인되어 저장됩니다.
- 대상은 저장하기 전에 시작할 때 환경을 검사하는 것과 같은 방식으로 검사되며, 잘못된 대상은 무엇이 잘못되었는지(값은 절대 아님)를 알려 주며 거부됩니다.
- 채널별 스위치는 그 채널을 완전히 끕니다. 꺼짐은 채널도 전송도 없다는 뜻입니다.
- `GET /api/destinations`와 `PUT /api/destinations/{kind}`가 라우트이며, PUT에는 `settings.write`가 필요합니다. [HTTP API](/ko/iot/api/)를 참조하십시오.

## 웹훅 URL은 절대 출력되지 않습니다

많은 수신처에서 URL이 곧 비밀번호입니다. Discord는 토큰을 경로(`/api/webhooks/{id}/{token}`)에 넣고, ntfy는 `?auth=`로, Google Chat은 `?key=`와 `?token=`으로 받습니다. URL을 가진 사람은 누구나 채널에 글을 올릴 수 있습니다. 그래서 전송이 실패하면 오류에는 스킴과 호스트만 표시되고 그 밖에는 아무것도 나오지 않습니다.

```
webhook request to https://discord.com failed: context deadline exceeded
webhook https://ntfy.example.com returned 401 Unauthorized
```

로그, 감사 이벤트, `POST /api/notify/test` 응답에서 같은 문구입니다. 어느 수신처가 고장 났는지는 호스트만으로 충분히 알 수 있으며, 경로와 쿼리는 프로세스 밖으로 나가지 않습니다. 시작 시 검증에 실패한 URL도 그 오류에 다시 표시되지 않습니다. URL을 확인해야 한다면 설정한 곳의 `HOTLOOP_NOTIFY_WEBHOOK_URL`을 보십시오.

## ntfy 설정

[ntfy](https://ntfy.sh)는 발행/구독 방식의 푸시 서버입니다. HotLoop이 알람마다 토픽에 발행하고, 휴대폰의 ntfy 앱이 그 토픽을 구독합니다.

1. 서버를 운영하거나 ntfy.sh를 사용합니다. 플랜트 네트워크에서는 자체 서버(`binwiederhier/ntfy`, 컨테이너 하나)를 운영하고 잠가 두십시오. `auth-default-access: deny-all`을 설정하고, 토픽에 쓸 수 있는 HotLoop용 사용자와 읽을 수 있는 사람별 사용자를 만듭니다. ntfy.sh나 누구나 접근할 수 있는 서버에서는 **토픽 이름이 곧 비밀번호**입니다. 이름을 추측한 사람은 누구든 알람을 읽습니다. 길고 무작위로 만드십시오.
2. HotLoop에 액세스 토큰(`ntfy token add hotloop`)이나 그 사용자의 사용자 이름과 비밀번호를 줍니다.
3. `HOTLOOP_PUBLIC_URL`을 휴대폰이 HotLoop에 접속하는 주소로 설정합니다. 예를 들어 `https://hotloop.plant.example`입니다. 설정하지 않으면 알림은 도착하지만 확인 버튼과 탭하여 열기가 없습니다. 휴대폰이 그 어느 쪽도 보낼 곳이 없기 때문입니다.
4. 설정하고 다시 시작합니다.

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_ENABLED=true
HOTLOOP_NOTIFY_NTFY_URL=https://ntfy.plant.example
HOTLOOP_NOTIFY_NTFY_TOPIC=boiler-house-alarms
HOTLOOP_NOTIFY_NTFY_TOKEN=tk_...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

5. `POST /api/notify/test`는 테스트 알림을 보냅니다. 확인할 알람이 뒤에 없으므로 확인 버튼이 없습니다.

URL은 서버만 가리킵니다. 토픽은 URL이 아니라 별도 설정에 넣습니다. 그래야 HotLoop이 어느 부분이 비밀인지 알고 모든 오류, 로그 줄, 감사 이벤트에서 빼 둘 수 있습니다.

도착하는 내용은 다음과 같습니다.

| <span class="sr-only">상세</span> | <span class="sr-only">상세</span> |
|---|---|
| 제목 | 알람 이름 |
| 본문 | 알람 메시지, 우선순위, 발생 위치(`device/tag`), 발생 시각 |
| 우선순위 | 위험 5(최대. Android에서는 허용하면 방해 금지 모드를 뚫을 수 있습니다), 높음 4, 보통 3, 낮음 2 |
| 태그 | 심각도별 이모지와 단어로 된 우선순위이며, 휴대폰 목록을 훑어볼 수 있게 합니다 |
| 탭 | `HOTLOOP_PUBLIC_URL`이 설정되어 있으면 HotLoop 알람 목록을 엽니다 |
| 버튼 | `HOTLOOP_PUBLIC_URL`이 설정되어 있으면 **확인**. "확인 링크"를 참고하십시오 |

### iPhone 관련 주의

Android는 인터넷 없이도 동작합니다. ntfy 앱이 서버와 자체 연결을 유지하며 플랜트 Wi-Fi로 모든 메시지를 즉시 받습니다.

iPhone은 그렇지 않습니다. Apple은 자사 서버(APNs)를 통한 푸시만 허용하고, APNs와 통신할 수 있는 것은 ntfy.sh뿐입니다. 자체 호스팅 서버는 `upstream-base-url: https://ntfy.sh`로 설정해야 하며, 그러면 폴링 요청(메시지 내용 없이 "이 토픽에 무언가 도착했다"는 것뿐)을 ntfy.sh로 전달하고, ntfy.sh가 휴대폰을 깨우면 휴대폰이 당신의 서버에서 메시지를 가져옵니다. 따라서 인터넷이 없는 플랜트에서는 자체 호스팅 ntfy로 iPhone이 즉시 알림을 받지 못합니다. 앱을 열어야 보입니다. 직원이 iPhone을 쓰고 플랜트가 인터넷과 분리되어 있다면 ntfy는 호출기가 될 수 없습니다. 릴레이를 통한 이메일이나, 플랜트가 닿을 수 있다면 Discord가 호출기입니다. Gotify는 iPhone 앱이 전혀 없습니다.

확인 버튼은 휴대폰에서 `HOTLOOP_PUBLIC_URL`로 보내는 요청이므로 휴대폰이 그 주소에 닿아야 합니다. 플랜트 Wi-Fi이거나 사용하는 VPN을 통해서입니다. 두 플랫폼에서 똑같이 동작합니다.

## Gotify 설정

[Gotify](https://gotify.net)는 Android 앱이 있는 작은 자체 호스팅 푸시 서버입니다. 인터넷이 필요 없고 어디에도 계정이 필요 없습니다.

1. `gotify/server`를 실행하고 웹 UI에 로그인합니다.
2. **Apps**에서 HotLoop이라는 애플리케이션을 만들고 토큰을 복사합니다.
3. 설정하고 다시 시작합니다.

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_ENABLED=true
HOTLOOP_NOTIFY_GOTIFY_URL=https://gotify.plant.example
HOTLOOP_NOTIFY_GOTIFY_TOKEN=A...
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

토큰은 `X-Gotify-Key` 헤더에 넣고, URL의 `?token=`으로는 절대 넣지 않습니다. 그러면 모든 프록시의 액세스 로그에 남게 됩니다.

우선순위는 Android 앱이 처리하는 방식에 맞춰 매핑됩니다. 위험 10과 높음 8은 중요도가 높음(소리와 헤드업 팝업), 보통 5는 소리가 있는 일반 알림, 낮음 2는 무음입니다. 메시지는 Markdown이며(알람 이름은 굵게, 세부 정보는 목록으로, 알람 자체의 텍스트는 이스케이프되어 별표가 들어간 이름도 그 이름 그대로 읽힙니다), `HOTLOOP_PUBLIC_URL`이 설정되어 있으면 탭했을 때 HotLoop 알람 목록이 열립니다.

**확인 기능 없음.** Gotify 알림에는 액션 버튼이 없으므로 확인 버튼을 달 방법이 없으며, 단순 GET으로 확인 처리하는 링크로 흉내 내지도 않습니다. 링크 미리보기와 보안 스캐너는 스스로 링크를 열기 때문이고, 알람은 로봇이 확인해서는 안 됩니다. HotLoop에서 확인하십시오. **iPhone 앱도 없습니다.**

## Discord

두 가지 방법이 있습니다. 웹훅은 호출기입니다. URL을 붙여넣으면 채널에 알람이 옵니다. 봇은 양방향입니다. 같은 메시지에 **확인**과 **보류** 버튼이 붙고, 감사 기록에 누가 눌렀는지가 남습니다. 둘 다 플랜트가 인터넷으로 Discord에 닿아야 합니다(`discord.com`으로의 아웃바운드 HTTPS, 봇은 `*.discord.gg`로의 WebSocket). 어느 쪽도 Discord가 플랜트에 닿을 필요는 없습니다.

### 도착하는 내용

| <span class="sr-only">상세</span> | <span class="sr-only">상세</span> |
|---|---|
| 텍스트 | `[Critical] Boiler Trip`이며 휴대폰 푸시 알림에 표시되는 내용입니다. 위험 알람에는 앞에 설정된 역할 호출이 붙습니다 |
| 임베드 제목 | 같은 내용이며, `HOTLOOP_PUBLIC_URL`이 설정되어 있으면 HotLoop 알람 목록으로 연결됩니다 |
| 색상 | 위험은 빨강, 높음은 주황, 보통은 노랑, 낮음은 파랑 |
| 설명 | 알람 메시지 |
| 필드 | 태그(`device/tag`), 값(알람을 발생시킨 측정값), 한계값(정의에서 가져온 `hi 90`), 구역 / 라인(장치에서 가져옴), 발생(읽는 사람 각자의 시간대로) |
| 푸터 | `HotLoop | <HOTLOOP_PLANT_NAME>`이며, 여러 플랜트가 있는 서버에서 구분할 수 있게 합니다(플랜트 이름이 없으면 `HotLoop`만) |
| 버튼(봇만) | 확인, 1시간 보류, HotLoop에서 열기 |

알람이 한꺼번에 몰리면 다른 채널과 마찬가지로 요약이 됩니다. 처음 다섯 개는 그대로 나가고, 이어서 나머지를 나열하는 메시지 하나가 나갑니다. 들어가는 만큼의 이름과 나머지 개수를 표시하므로 개수는 잘리지 않습니다.

Discord는 너무 긴 메시지(텍스트 2000자, 제목 256자, 설명 4096자, 필드 25개, 전체 6000자)를 거부하며, 거부된 메시지는 나가지 않은 호출입니다. 그래서 HotLoop은 문자 경계에서 자르고 잘린 곳에 `...`를 붙입니다.

### 실수로 호출되는 사람은 없습니다

모든 메시지는 `allowed_mentions: {"parse": []}`와 함께 나갑니다. 이것이 없으면 Discord는 텍스트에 언급된 대상을 모두 호출하므로, 누군가 "@everyone tank overflow"라고 이름 붙인 알람이 서버 전체를 깨울 수 있습니다. 이것이 있으면 텍스트의 어떤 것도 아무도 호출하지 않습니다. 유일한 예외는 위험 알람용으로 설정한 역할(`..._CRITICAL_ROLE`)이며, 허용되는 유일한 호출로 명시되고 위험 알람이거나 위험 알람이 포함된 요약일 때만 해당합니다. 테스트 알림은 절대 호출하지 않습니다. 알람 자체의 텍스트도 Markdown 이스케이프되므로 `*`가 들어간 이름은 그 이름 그대로 읽히고, 이름 안의 `<@&role>`은 사용되지 않고 표시만 됩니다.

호출이 동작하려면 역할이 멘션 가능해야 합니다. 서버의 역할 설정에서 **Allow anyone to @mention this role**을 켜거나, 봇에 **Mention @everyone, @here, and All Roles** 권한을 주십시오.

### Discord의 속도 제한과 차단

Discord는 "너무 빠름"을 429로 답하면서 얼마나 기다릴지를 본문(`retry_after`, 밀리초 단위)과 `X-RateLimit-Reset-After`로 알려 줍니다. HotLoop은 재시도 전에 그만큼 기다리며, 평소의 3회 시도와 30초 안에서 처리합니다("재시도" 참고). Discord가 거부하기 전에 한도가 소진되었다고 알리면(`X-RateLimit-Remaining: 0`) 다음 전송은 429를 받는 대신 초기화를 기다립니다.

Discord는 10분 동안 거부된 요청(401, 403, 429)이 10,000건 쌓인 주소를 차단하며, 차단되면 그 주소의 모든 Discord 연동이 함께 막힙니다. 그래서 Discord가 **401, 403, 404**(잘못되었거나 삭제된 웹훅, 잘못된 봇 토큰, 봇이 볼 수 없는 채널)로 답하면 HotLoop은 그 한 번의 요청 뒤에 **해당 채널을 끕니다**. 한 번 로그를 남기고, 이후의 모든 알람은 요청 없이 거부되며(그리고 "보내지 않음"으로 감사 기록에 남아 "누가 통보받았는가"에 계속 답할 수 있습니다), 이유와 시각이 함께 `GET /api/diagnostics`의 `notify.channels` 아래에 표시됩니다.

```json
{"channel": "discord-webhook", "broken": true,
 "reason": "discord webhook https://discord.com returned 404 Not Found: Unknown Webhook (Discord error 10015)",
 "since": "2026-09-27T03:00:01Z"}
```

설정을 고치고 HotLoop을 다시 시작하십시오. 500이나 무응답은 아무것도 끄지 않으며 다른 채널과 같이 재시도됩니다.

### 웹훅 설정

1. Discord에서 채널 설정(톱니바퀴), **Integrations**, **Webhooks**, **New Webhook**을 엽니다. 이름을 HotLoop으로 합니다. **Copy Webhook URL**.
2. 선택 사항: 위험 알람에 호출할 역할. **Developer Mode**(User Settings, Advanced)를 켠 다음 Server Settings, Roles에서 역할을 우클릭하고 **Copy Role ID**를 선택합니다. 이름이 아니라 숫자입니다.
3. 설정하고 다시 시작합니다.

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1234.../AbCd...
HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE=123456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

4. `POST /api/notify/test`는 테스트 메시지를 보냅니다.

**URL 전체가 비밀번호입니다.** URL을 가진 사람은 누구나 웹훅으로서 채널에 글을 올릴 수 있습니다. HotLoop은 이를 절대 출력하지 않습니다. 로그, 오류, 감사 이벤트, API 응답 어디에도 나오지 않으며, 시작 시 검증에 실패한 URL도 그 오류에 다시 표시되지 않습니다. Helm 차트에서는 Secret에 들어갑니다. 유출되면 Discord에서 웹훅을 삭제하고 새로 만드십시오.

웹훅은 동작하는 버튼을 담을 수 없으므로 여기에는 확인이 없습니다. 제목은 HotLoop의 알람 목록으로 연결됩니다. 버튼이 필요하면 봇을 사용하십시오.

### 봇 설정

1. [Discord 개발자 포털](https://discord.com/developers/applications)에서 **New Application**을 눌러 이름을 HotLoop으로 합니다. General Information 페이지의 **Application ID**가 초대 링크에 필요합니다.
2. **Bot** 탭에서 **Reset Token**을 누르고 복사합니다. Discord는 한 번만 보여 줍니다. 이것이 `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN`입니다. 같은 페이지에서 **Public Bot**을 꺼서 본인 외에는 서버에 추가하지 못하게 하고, **Privileged Gateway Intents** 세 개는 모두 꺼 두십시오. HotLoop은 Discord에 이벤트를 전혀 요청하지 않으며(intents 0), 버튼 누름은 그래도 도착합니다.
3. 필요한 최소 권한인 View Channels, Send Messages, Embed Links(권한 `19456`)와 `bot` 외의 스코프 없이 서버에 초대합니다.

```
https://discord.com/oauth2/authorize?client_id=<APPLICATION ID>&scope=bot&permissions=19456
```

   위험 알람 역할이 멘션 불가능하고 그렇게 바꾸고 싶지 않을 때만 **Mention @everyone, @here, and All Roles**(`permissions=150528`)를 추가하십시오. 버튼을 누른 뒤 자기 메시지를 수정하는 데는 권한이 필요 없습니다. 누름 자체를 통해 처리됩니다.
4. 채널: Developer Mode를 켠 상태에서 채널을 우클릭하고 **Copy Channel ID**를 선택합니다. 채널이 비공개라면 봇의 역할을 추가하십시오.
5. 버튼을 누를 수 있는 역할. 역할을 하나 만들고(예: "Alarm ack") Discord에서 확인할 수 있는 사람에게 부여한 뒤 그 id를 복사합니다. 보류는 알람을 한 시간 동안 목록에서 빼므로 별도 설정이 있으며, 같은 역할이어도 되고 더 좁은 역할이어도 됩니다.
6. 설정하고 다시 시작합니다.

```
HOTLOOP_NOTIFY_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED=true
HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN=MTIz...
HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL=223456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES=323456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES=423456789012345678
HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE=323456789012345678
HOTLOOP_PUBLIC_URL=https://hotloop.plant.example
```

7. 로그에 `connected to the Discord Gateway; Discord buttons work`가 나오고, `GET /api/diagnostics`의 `discord` 채널 아래에 `"gateway": {"connected": true}`가 표시됩니다. `POST /api/notify/test`는 테스트 메시지를 게시합니다(뒤에 알람이 없으므로 버튼은 없습니다).

**역할을 설정하기 전에는 아무도 아무것도 누를 수 없습니다.** `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES`나 `_SHELVE_ROLES`가 비어 있으면 그 버튼은 누르는 족족 거부되고, 누른 사람은 어느 설정이 비어 있는지 안내받으며, HotLoop은 시작할 때도 이를 알립니다.

```
WARN NOBODY can acknowledge alarms from Discord, because HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES is empty...
```

이것은 의도된 것입니다. 서버의 누구나 누를 수 있는 버튼은 기본값으로 내놓을 것이 아닙니다. 서버에는 사람이 모이기 마련입니다.

**누가 눌렀는지.** Discord에서의 확인은 `discord:<username>#<user id>`로 기록되며(Discord 사용자 이름은 바뀔 수 있지만 id는 바뀌지 않으므로 id를 사용합니다), 메모는 "acknowledged from Discord by alice (1010...)"입니다. HotLoop 사용자 이름으로 기록하려면 매핑하십시오. `HOTLOOP_NOTIFY_DISCORD_BOT_USERS=101010101010101010=alice,202020202020202020=bob`. 매핑은 행위자의 이름만 정합니다. HotLoop 사용자의 권한은 확인하지 않으며, 누가 누를 수 있는지는 Discord 역할이 결정합니다.

**보류**는 `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE` 동안 보류하며 기본값은 한 시간, 모든 보류와 마찬가지로 최대 24시간입니다. 메뉴가 아닌 고정 시간입니다. 새벽 3시에는 정해진 한 가지를 하는 버튼 하나가 드롭다운보다 낫습니다. 정상으로 돌아온 알람(보류하면 다음에 발생시키는 원인이 가려집니다)과 이미 보류된 알람은 거부합니다.

누른 뒤에는 메시지에 누가 언제 무엇을 했는지가 표시되고 두 버튼이 회색이 되어, 다음에 채널을 보는 사람이 처리되었음을 알 수 있습니다. 거부된 누름에는 누른 사람에게만 이유가 답변되며 시스템 로그에 기록됩니다.

### 버튼 누름은 어떻게 승인되는가

ntfy의 확인 링크와 같은 구조에("확인 링크" 참고) 누른 사람에 대한 Discord 자체의 확인이 더해집니다.

- **버튼은 서명되어 있습니다.** 각 버튼은 확인 링크와 같은 비밀로 서명된 토큰을 가지며, 그 동작(확인 또는 보류, 서명에 포함되므로 하나를 다른 하나로 재사용할 수 없습니다), 그 알람, 그 발생 시각에 한정됩니다. Discord는 버튼에 데이터 100자를 허용하고 알람 id는 64자까지 될 수 있으므로, 같은 주장을 압축한 형태입니다. 발생 시각 8바이트, 만료 4바이트, 96비트 HMAC입니다. 위조하려면 96비트를 추측해야 하고, 추측마다 올바른 역할로 서버 안에서 Discord 버튼을 한 번 눌러야 합니다.
- **누른 사람이 지정한 역할을 가지고 있습니다.** Discord는 누름과 함께 누른 사람의 역할을 봇 자체의 인증된 연결로 알려 줍니다. 서버에서 역할을 줄 수 있는 사람은 이 역할도 줄 수 있으므로, 이 역할들은 그 자체가 권한이라고 보고 다루십시오.
- **그 발생이 여전히 현재 것입니다.** 엔진은 자체 잠금 아래에서 알람의 현재 발생이 버튼에 있는 발생과 같은지 확인합니다. 어제의 메시지로 오늘의 트립을 확인할 수 없습니다.
- **한 번만.** 어떤 알림(ntfy 또는 Discord)이든 한 발생에 대한 첫 동작은 기록되고 이후 모든 동작은 거부됩니다. 두 사람이 동시에 누르면 한 사람이 처리되고 다른 사람은 그 사실을 안내받습니다.
- **만료됩니다.** `HOTLOOP_NOTIFY_ACK_TTL`(12시간)이 지나면 버튼이 동작하지 않으므로 HotLoop에서 처리하십시오.

봇 토큰은 봇 전체의 자격 증명입니다. 로그에 남지 않고, 오류에 나오지 않으며, API 응답에도 나오지 않습니다. Helm 차트에서는 Secret에 들어갑니다. Discord가 봇에 응답하도록 15분 동안 주는 각 누름의 인터랙션 토큰도 마찬가지입니다. 봇 토큰이 유출되면 개발자 포털에서 재설정하십시오.

### Gateway 연결

누름은 Discord Gateway, 즉 HotLoop이 Discord로 열어 유지하는 WebSocket을 통해 도착합니다. 클라이언트는 HotLoop 자체 구현이며 [gorilla/websocket](https://github.com/gorilla/websocket)(v1.5.3, 고정. 이 모듈의 의존성 그래프에 이미 있었고 작으며 Go에서 가장 많이 쓰이는 WebSocket 라이브러리입니다) 위에 만들어졌습니다. discordgo 같은 Discord 라이브러리는 쓰지 않았습니다. 필요한 이벤트 하나를 위해 REST, 음성, 상태 캐시까지 갖춘 Discord SDK 전체를 들이는 셈이고, 이 프로젝트는 벤더 SDK를 들이지 않습니다. 클라이언트는 다음과 같이 동작합니다.

- intents 0으로 식별하므로 Discord는 버튼 누름 외에는 아무것도 보내지 않습니다.
- Discord가 알려 주는 간격으로 하트비트를 보내고, 하트비트 요청에 즉시 답하며, 확인되지 않은 하트비트는 끊어진 연결로 간주합니다.
- 연결이 끊기거나 Reconnect(op 7) 또는 재개 가능한 Invalid Session(op 9)이 오면 세션을 재개하므로, 재연결 중에 이루어진 누름은 유실되지 않고 재생됩니다. 재개할 수 없는 세션은 1초에서 5초 기다린 뒤 새로 시작합니다.
- 5초에 한 번만 식별하며, Discord가 그날의 세션 시작 횟수를 모두 소진했다고 알리면 초기화될 때까지 하지 않습니다.
- 1초에서 시작해 1분까지 두 배로 늘어나는 백오프로 재연결합니다.
- 토큰이나 intents가 거부되면 영구히 멈추고, 채널을 끄고 `/api/diagnostics`에 표시하며 계속 재연결하지 않습니다.

Discord는 봇에 누름에 응답할 시간을 3초 주므로 HotLoop이 가장 먼저 하는 일은 "받았다"(지연 업데이트)라고 답하는 것이고, 그다음 작업을 합니다. 이 응답은 HotLoop 레플리카 두 개가 한 번의 누름에 모두 동작하는 것을 막기도 합니다. 둘 다 누름을 받지만 Discord는 첫 응답을 받아들이고 두 번째를 거부하며, 거부된 레플리카는 멈춥니다. MCP 도우미(`--mcp-stdio`)로 실행될 때 HotLoop은 Gateway 연결을 전혀 열지 않으며, 실제 인스턴스가 누름을 처리합니다.

## 속도 제한과 요약

정전 후 전압 강하나 PLC 재부팅으로 1초에 알람 40개가 발생합니다. 알람마다 하나씩 보내면 Discord 웹훅의 IP가 차단되고, ntfy의 IP별 제한에 걸리며, 받는 휴대폰에서는 중요한 알람 하나가 중요하지 않은 39개에 묻힙니다. 그래서 모든 채널에는 예산, 즉 토큰 버킷이 있습니다. 한 번에 나갈 수 있는 버스트가 있고, 이후 보충 주기마다 하나씩 나갑니다.

| 채널 | 기본 버스트 | 이후 매 |
|---|---|---|
| ntfy | 10 | 5 s (ntfy.sh 자체 제한인 60 이하, 이후 IP당 5 s에 하나) |
| Gotify | 10 | 5 s |
| 웹훅 | 10 | 5 s |
| SMTP | 5 | 12 s |
| Discord 웹훅 | 5 | 2 s (Discord는 웹훅에 2 s당 약 5건, 채널에 분당 30개 메시지를 허용합니다) |
| Discord 봇 | 5 | 2 s |

`HOTLOOP_NOTIFY_<CHANNEL>_BURST`와 `HOTLOOP_NOTIFY_<CHANNEL>_REFILL`로 채널별로 바꿀 수 있습니다(`WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK`, `DISCORD_BOT`).

예산이 허용하는 만큼은 즉시 그대로 나갑니다. 허용하지 않는 것은 보류되고, 다음 전송 시점이 되면 보류된 것 전부가 **하나의** 요약으로 나갑니다.

```
7 more alarms raised in the last 12 s:
- [High] Line 3 Stopped
- [Critical] Boiler Trip
...
```

알람은 하나도 빠지지 않습니다. 요약에는 최대 25개의 알람 이름이 모두 들어가고 나머지는 개수로 표시됩니다("...and 13 more"). 요약의 심각도는 그 안에서 가장 심각한 알람과 같고, 그 감사 이벤트에는 요약이 대신한 모든 알람 id가 나열됩니다. 요약 하나가 확인할 단일 알람이 없으므로 확인 버튼이 없습니다. 보류된 알람이 하나뿐이면 버튼까지 포함해 그 알람 그대로 나갑니다. 알람이 보류되기 시작하면 예산이 돌아와도 새 알람은 같은 묶음에 합류하므로, 요약이 그 안의 어떤 알람보다 나중에 발생한 알람 뒤에 도착하는 일은 없습니다. 종료할 때는 아직 보류된 것이 예산을 넘겨 즉시 나갑니다. 이때의 선택은 전송이 한 번 더 나가는 것과 아무도 통보받지 못하는 알람이 생기는 것 사이이기 때문입니다.

예산은 채널별이므로 SMTP 릴레이가 줄을 서는 폭주가 ntfy를 막지 않으며, 각 채널의 하한도 그대로 적용됩니다. 낮음 알람은 높음 이상으로 설정된 채널의 요약에 들어가지 않습니다.

## 재시도

429, 5xx 또는 무응답(거부, 끊김, 시간 초과)을 받은 전송은 처음부터 30초 안에 최대 3회까지 재시도됩니다. 수신처가 기다릴 시간을 알려 주면(`Retry-After`, 초 또는 날짜) 그만큼 기다리고, 아니면 1초, 그다음 2초 기다립니다. 남은 30초보다 오래 기다리라고 요구하는 수신처는 기다리지 않고, 그 사유와 함께 즉시 실패로 보고합니다. 30초가 지나도 나가지 않은 호출은 알람이 그대로 있는 채로 몇 분씩 조용히 재시도하는 것보다, 로그와 감사 기록에 실패로 남기는 편이 낫습니다.

그 밖의 4xx(잘못된 토큰, 사용자가 쓸 수 없는 토픽, 잘못된 요청)는 재시도하지 않습니다. 누군가 설정을 고칠 때까지 답은 항상 같고, Discord는 이미 거부한 요청을 계속 보내는 IP를 차단하기 때문입니다.

`POST /api/notify/test`는 채널당 정확히 한 번만 시도합니다. 테스트는 채널이 지금 무엇을 하는지 묻는 것이며, 재시도는 불안정한 수신처를 멀쩡해 보이게 만듭니다.

## 확인 링크

ntfy 알림의 확인 버튼은 `HOTLOOP_PUBLIC_URL`의 `POST /api/notify/ack/{token}`로 보내는 요청입니다. 새벽 3시에 이것을 누르는 사람은 어디에도 로그인되어 있지 않으므로 **토큰이 곧 인증의 전부**입니다. 토큰이 위조 불가능하고, 범위가 좁고, 한 번만 쓸 수 있고, 수명이 짧아야만 성립하며, 각각이 강제됩니다.

- **위조 불가.** 토큰은 주장(어느 알람인지, 언제 발생했는지, 어느 채널인지, 링크가 언제 만료되는지)과 서버 비밀로 계산한 그 HMAC-SHA256입니다. 한 바이트라도 바꾸거나 다른 키로 서명하면 거부됩니다. 비밀은 설정했다면 `HOTLOOP_NOTIFY_ACK_SECRET`입니다(32자 이상, `openssl rand -hex 32`). 설정하지 않으면 HotLoop이 처음 필요할 때 무작위 32바이트를 생성해 데이터베이스(`settings` 테이블, 키 `notify.ackSecret`)에 보관하므로 재시작 후에도 링크가 계속 동작하고 모든 레플리카가 같은 값을 씁니다. 설정 화면이나 어떤 API 응답에도 표시되지 않습니다. 데이터베이스의 다른 모든 것과 마찬가지로 데이터베이스 백업에 들어 있습니다. 그것이 문제라면 Kubernetes Secret에서 변수를 설정하면(차트의 `notify.ackSecret.existingSecret`) 데이터베이스에 닿지 않습니다. 비밀을 바꾸면 이미 보낸 모든 링크가 무효화되며, 이것이 모든 링크를 한꺼번에 폐기하는 방법이기도 합니다.
- **범위가 좁음.** 주장은 알람 하나와 **그 알람이 발생한 시각**을 지정합니다. 같은 알람의 어제 트립에서 온 버튼으로, 아직 아무도 보지 못한 오늘의 트립을 확인할 수 없습니다. 엔진이 확인과 같은 잠금 아래에서 알람의 현재 발생이 주장에 있는 것인지 확인합니다(`alarm.Engine.AckOccurrence`). 링크는 확인만 할 수 있습니다. 보류, 해제, 태그 쓰기, 읽기는 할 수 없으므로, 유출된 링크로 일어날 수 있는 최악은 버튼을 누르는 것과 정확히 같은 일입니다.
- **한 번만 사용.** 한 발생에 대한 링크의 첫 사용은 데이터베이스(`notify_ack_links`)에 기록되고 이후 모든 사용은 거부됩니다. 새로 발생하지 않았는데 알람을 다시 확인해야 하는 경우(알람 상태에서 보류되었다가 해제되어 미확인으로 돌아온 경우)에도 같습니다. 이를 위해서는 알람 자체의 상태로는 부족하며 기록이 필요합니다.
- **수명이 짧음.** 기본적으로 전송 12시간 뒤에 만료됩니다(`HOTLOOP_NOTIFY_ACK_TTL`, 최대 168h). "출근하면 볼게요"에는 충분히 길고, 알림 스크린샷이 상시 자격 증명이 되지 않을 만큼은 짧습니다.

성공한 누름은 알람 엔진을 통한 일반적인 ISA-18.2 확인이며, 알람 화면에서의 확인과 똑같이 감사됩니다. 알람 이벤트와, 행위자 `notify:ntfy` 및 메모 "acknowledged from the ntfy notification"이 있는 시스템 로그 항목입니다. ntfy의 HTTP 액션은 어느 휴대폰이 눌렀는지 알려 주지 않으므로 덧붙일 사람 이름이 없습니다. 여러 사람이 토픽을 공유하면 감사 기록에는 누가 아니라 휴대폰이 했다고 남습니다. Discord 봇은 사용자를 알기 때문에 그것을 기록합니다("Discord" 참고).

모든 거부는 무엇이 잘못되었는지와 함께 응답되고 시스템 로그에 `notify:<channel>`로(어느 채널이 보냈는지 알 수 없을 만큼 손상된 토큰이면 `notify:ack-link`로) 기록됩니다. 조용히 아무 일도 하지 않은 버튼은 아무도 누르지 않은 버튼과 구별되지 않기 때문입니다.

| 응답 | 이유 |
|---|---|
| 403 | 위조되었거나 변경되었거나 다른 비밀로 서명됨 |
| 410 | 진짜이지만 만료됨 |
| 409 | 이미 사용되었거나, 그 뒤 알람이 다시 발생했거나, 확인할 것이 남아 있지 않음 |
| 404 | 알람이 더 이상 없거나 확인 링크가 꺼져 있음 |

토큰 자체는 로그에 남지 않고, 감사 이벤트에 들어가지 않으며, 어떤 API도 반환하지 않습니다. 유효한 동안은 자격 증명이기 때문입니다. 토큰은 ntfy 메시지에 들어 있을 수밖에 없으므로 ntfy 토픽을 읽을 수 있는 사람은 누구나 버튼을 누를 수 있습니다. 토픽을 잠그십시오.

엔드포인트는 `Access-Control-Allow-Origin: *`로 응답하여, 자체 출처에서 누르는 ntfy 웹 앱에서도 버튼이 동작합니다. 이것은 아무것도 노출하지 않습니다. 이 경로의 어떤 것도 쿠키나 세션을 읽지 않습니다.

## 에스컬레이션

알람을 N분 동안 아무도 확인하지 않으면 다음 사람이 받습니다. 첫 알림은 알람이 하한을 충족하는 모든 채널로 전과 똑같이 나갑니다. 에스컬레이션은 그 뒤에도 알람이 확인되지 않은 채 남아 있을 때 일어나는 일입니다. 아무도 들고 있지 않은 휴대폰으로 간 알림이 바로 이 기능이 막으려는 실패입니다. 새벽 3시에 당직자는 자고 있고, 알람은 그 사람을 기다려서는 안 됩니다.

**Settings, Alarm escalation**에서 설정하거나 API(`GET`과 `PUT /api/notify/escalation`)로 설정합니다. 사람들의 ntfy 토픽을 담고 있고 누구를 깨울지 결정하므로 관리자 전용입니다. HotLoop이 시작할 때 환경에서 읽는 채널과 달리, 정책은 직접 편집하는 데이터이며 저장하면 바로 적용됩니다. 사용할 수 있는 채널은 배포에 이미 설정된 채널입니다. 네 가지에 웹훅과 이메일을 더한 목록에 새로 추가되는 것은 없습니다.

### 정책

| 필드 | <span class="sr-only">상세</span> |
|---|---|
| `enabled` | 켜기 전에는 꺼져 있습니다. 꺼진 정책은 아무것도 에스컬레이션하지 않습니다 |
| `minPriority` | 에스컬레이션되는 가장 낮은 심각도의 알람: `critical`, `high`, `medium`, `low`. 기본값은 `high`. 한 시간 동안 방치된 보통 알람은 작업 지시이지 새벽 3시의 전화가 아닙니다 |
| `contacts` | 사람들. 각각 `name`과 `ntfyTopic`, `emails` 또는 둘 다를 가집니다. 최대 50명 |
| `steps` | 최대 10개. 각각 `afterMinutes`(1에서 1440)와 알릴 대상을 가집니다. 이름으로 지정한 `contacts`, 이름으로 지정한 `channels`, 또는 둘 다 |
| `repeatEveryMinutes`, `repeatTimes` | 마지막 단계 뒤에 이 간격으로 이 횟수만큼 더 다시 보냅니다(최대 20). 둘 다 0이면 반복하지 않습니다 |

**사람**은 자기만의 알림을 받습니다. 그 사람의 `ntfyTopic`은 이 HotLoop이 이미 발행하는 ntfy 서버의 토픽이며 같은 로그인을 쓰므로, 그 사람의 휴대폰은 자기만의 토픽을 구독합니다. `emails`는 HotLoop이 이미 가진 SMTP 릴레이를 통해 나갑니다. 토픽이 있는 사람은 ntfy가 설정되어 있어야 하고 주소가 있는 사람은 이메일이 설정되어 있어야 하며, 그렇지 않으면 정책은 그 사유와 함께 거부됩니다. 누구나 접근할 수 있는 서버에서 토픽은 비밀번호이므로 길고 무작위로 만드십시오. API는 토픽을 관리자에게만 보여 주며, 로그북, 시스템 로그, 오류에는 절대 나오지 않습니다.

단계의 **채널**은 배포에 이미 있는 것(`ntfy`, `gotify`, `smtp`, `webhook`, `discord-webhook`, `discord`) 중 하나이며 그 채널에 있는 모든 사람에게 닿습니다. 공유 Discord 채널, 팀이 함께 쓰는 Gotify 앱, 호출 서비스로 들어가는 웹훅 등입니다. 단계가 이 HotLoop에 설정되지 않은 채널을 지정하면 정책은 거부되며, 답변에는 설정된 채널의 목록이 나옵니다.

### 언제 나가는가

단계는 직전 단계로부터 `afterMinutes` 뒤에 도래하며, 첫 단계는 알람이 발생한 시점으로부터 `afterMinutes` 뒤입니다. 마지막 전송이 끝난 시점이 아니라 발생 시점부터의 합이므로, 느린 릴레이나 재시작이 작성한 일정을 늘리지 않습니다. 5분과 10분 단계에 15분 간격으로 두 번 반복하면 다음과 같습니다.

```
 0 min  alarm raised: the first page, as always
 5 min  step 1
15 min  step 2
30 min  step 2 again (repeat 1)
45 min  step 2 again (repeat 2), and that is the last
```

### 무엇이 멈추는가

체인은 한 알람의 한 발생에 대한 것이며, 다음 중 하나가 일어나면 이유를 적은 행을 남기고 멈춥니다.

- **누군가 확인했습니다.** 어디서든 가능합니다. 알람 화면, ntfy나 Discord의 확인 버튼, API, 자동화 모두 알람 엔진으로 귀결되며, 각 단계가 나가기 전에 에스컬레이터가 엔진에 이 발생이 아직 미확인인지 묻습니다. 늦게 도착한 훅이 이미 누군가 응답한 알람을 호출하게 할 수는 없습니다.
- **정상으로 돌아왔습니다.** 알람은 누군가 확인해야 하는 상태로 알람 목록에 남아 있지만, 저절로 해결된 일로 아무도 깨우지 않습니다. 이것은 의도적으로 내린 결정이며, 다르게 하고 싶다면 하한이나 단계를 바꾸십시오.
- **보류되었습니다.**
- **다시 트립했습니다.** 새로운 발생이며 자체 발생 시점부터 세는 자체 체인을 가집니다. 어제의 체인이 오늘의 알람을 호출하는 일은 없습니다.

1단계 도래 전에 누군가 응답한 알람은 에스컬레이션 기록에 흔적을 전혀 남기지 않으며, 이것이 시스템이 제대로 작동한 것입니다.

### 도착하는 내용

에스컬레이션은 제목을 바꾸고 한 줄을 더한 알람 자체의 알림입니다.

```
NOT ACKNOWLEDGED 15 min: Boiler Trip
Nobody has acknowledged this alarm in 15 minutes (step 2 of 4). boiler/Pressure hi 90 (now 95)
```

알람의 우선순위를 유지하므로 위험 알람은 Android에서 여전히 최대 우선순위입니다. ntfy와 Discord에서 첫 알림과 같은 서명된 확인 버튼을 가지므로("확인 링크" 참고), 호출받은 사람은 통보받은 그 자리에서 확인할 수 있습니다. Gotify와 이메일에는 버튼이 없습니다. 웹훅은 `event`가 `escalated`로 설정된 평소의 HotLoop JSON을 받습니다.

공유 채널은 다른 채널과 같이 속도가 조절되므로("속도 제한과 요약" 참고), 알람 40개가 미확인으로 남는 정전 후 전압 강하는 40건의 호출과 차단이 아니라 요약 하나, "40 alarms nobody has acknowledged"로 에스컬레이션됩니다. 개인의 알림은 별도의 전송입니다.

### 감사 기록

모든 에스컬레이션은 알람 자체의 기록에 한 행으로 남으며, [로그북](/ko/iot/logbook/)이 이를 읽으므로 추가 설정 없이 거기에 나타납니다. 알람 아래에 행위자 `escalation`으로 분류됩니다.

```
alarm Boiler Trip escalated: boiler/Pressure hi 90 (now 95) (note: step 1 of 2: nobody acknowledged it in 5 min; notified Ana (email), Ana (ntfy))
alarm Boiler Trip escalation-ended: boiler/Pressure hi 90 (now 95) (note: escalation stopped after 1 sent: acknowledged by notify:ntfy)
```

`GET /api/alarms/events`와 로그북의 `alarm` 종류는 같은 행을 `escalated`와 `escalation-ended` 유형으로 담고 있습니다. 아무에게도 닿지 못한 단계는 대문자(`NOBODY WAS REACHED`)로 그렇게 표시하고 그 뒤에 각 실패를 붙이며, 체인은 그래도 다음 단계로 계속 진행합니다. 죽은 릴레이 하나가 다른 경로로 나가는 호출을 멈춰서는 안 됩니다. 정책 저장은 토픽 없이 시스템 로그에 남습니다.

### 재시작과 실행 위치

체인은 메모리에 있으므로 새벽 3시의 재시작이 진행 중인 체인을 잃게 해서는 안 됩니다. HotLoop은 시작할 때 아직 미확인인 모든 알람을 살펴보고, 그 발생에 대해 감사 행이 몇 단계가 나갔다고 기록하는지 읽어 거기서부터 이어갑니다. 1단계를 다시 보내지 않고 2단계를 건너뛰지도 않습니다. HotLoop이 내려가 있는 동안 도래한 단계는 복구 직후 몇 초 안에 나갑니다. 프로세스가 종료될 때 진행 중이던 단계는 두 번 나갈 수 있으며, 알람에 대해서는 이쪽으로 틀리는 것이 맞는 방향입니다.

저장된 정책은 저장한 뒤에 발생한 알람에 적용됩니다. 재시작하면 언제 발생했든 아직 미확인인 모든 알람을 이어받습니다.

Gateway가 실행합니다. `--mcp-stdio` 도우미는 하지 않으므로 한 알람이 두 프로세스에서 에스컬레이션되는 일은 없습니다.

## SMTP 채널의 TLS

릴레이가 확장을 알리면 아래 어느 설정과도 관계없이 채널은 STARTTLS로 TLS로 자동 전환됩니다. 선택하는 동작이 아닙니다. Go의 `net/smtp.PlainAuth`는 이미 TLS가 아닌 연결(또는 이름이 말 그대로 `localhost`인 서버)로 사용자 이름과 비밀번호를 보내기를 거부하며, 인증을 요구하는 거의 모든 실제 업체, 즉 Gmail, SendGrid, Mailgun, 통신사 릴레이는 거기에 이르려면 587번 포트의 STARTTLS 또는 465번 포트의 암시적 TLS(아래 참고)를 요구합니다. 인증을 설정하지 않은, 격리된 네트워크에서 접근 가능한 릴레이는 STARTTLS를 아예 제공하지 않을 수 있으며, 이 채널은 그 경우 STARTTLS를 요구하지 않습니다.

`HOTLOOP_NOTIFY_SMTP_TLS`는 전환을 켜는 것이 아니라 전환이 *없는* 경우를 하드 실패로 만듭니다. 설정되어 있는데 릴레이가 STARTTLS를 알리지 않으면 `Send`는 `AUTH`를 시도하기 전에 거부하며, 우연히 `localhost`로 닿는 릴레이에 평문으로 조용히 인증하지 않습니다. `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY`는 전환 시 인증서 검증을 건너뜁니다. `HOTLOOP_EDGE_PUBLISH_TLS_SKIP_VERIFY`와 `HOTLOOP_FLEET_TLS_SKIP_VERIFY`가 각자의 MQTT 연결에 이미 제공하는 것과 같은 우회 수단으로, 자체 서명 인증서를 제시하는 릴레이를 위한 것입니다.

### 암시적 TLS, 465번 포트

465번 포트의 릴레이는 평문 인사와 전환이 아니라 첫 바이트부터 연결 전체가 TLS이기를 기대합니다(RFC 8314). HotLoop은 예전에 전환만 지원해서, 465번 포트에서는 TLS 핸드셰이크를 기다리는 릴레이에 평문을 보내 전송이 실패했습니다. 이제 **465번 포트는 암시적 TLS**이고 다른 모든 포트는 이전처럼 STARTTLS이며, 만질 설정은 없습니다.

```
HOTLOOP_NOTIFY_SMTP_PORT=465
```

릴레이가 자체 포트에서 암시적 TLS를 쓰거나 465번에서 STARTTLS를 쓴다면 `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS`에 `true` 또는 `false`로 지정하며, 이 값이 포트보다 우선합니다. Helm 차트에서는 `extraEnv` 아래에 설정하십시오. 그 밖의 것은 두 방식 모두 같습니다. 사용자 이름과 비밀번호는 암호화된 연결로 나가고, `HOTLOOP_NOTIFY_SMTP_TLS`는 그것으로 충족되며(요구할 것이 없습니다), `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY`는 그 핸드셰이크의 인증서 검사를 건너뜁니다. 끄지 않는 한 릴레이의 인증서는 검사됩니다. 예약 보고서도 같은 릴레이 설정을 쓰므로 같은 규칙이 적용됩니다.

핸드셰이크가 실패하면 오류가 그렇게 알리고 `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS=false`를 언급하며, 평문으로 시작하는 릴레이에 필요한 것이 이것입니다.

TLS 전용 리스너를 가진 실제 SMTP 서버 라이브러리와, 고정된 랩 버전 v1.31.2로 `--smtp-require-tls`를 켜고 실행한 Mailpit에 대해 검증했습니다. 상용 업체의 465번 엔드포인트에 대해서는 검증하지 않았습니다.

## 예약 보고서와 공유하는 하나의 SMTP 경로

4.14.0부터 알람 채널은 첨부 파일을 선택적으로 붙여 수신자 목록에 메시지 하나를 보내는 범용 함수 `notify.SendMessage`로 전송합니다. 예약 보고서([예약 보고서](/ko/gateway/reports/) 참고)는 CSV와 HTML 파일을 같은 함수와 같은 릴레이 설정(`HOTLOOP_NOTIFY_SMTP_HOST`, `_PORT`, `_USERNAME`, `_PASSWORD`, `_FROM`, `_TLS`, `_TLS_SKIP_VERIFY`)으로 보내므로, 연결하고, STARTTLS로 전환하고, 인증하고, 헤더에 들어갈 수 있는 내용을 결정하는 곳이 한 군데입니다. 릴레이만 공유됩니다. `HOTLOOP_NOTIFY_ENABLED`, `HOTLOOP_NOTIFY_SMTP_ENABLED`, `HOTLOOP_NOTIFY_SMTP_TO`는 알람에 대한 것이며, 보고서용으로 설정한 릴레이가 알람 채널을 켜지는 않습니다.

알람 이메일의 동작 두 가지가 바뀌었으며, 둘 다 안전한 쪽입니다. 발신자와 모든 수신자는 연결하기 전에 일반 주소로 검증되며, 이전에는 잘못된 주소가 릴레이에서 실패했습니다. 그리고 ASCII가 아닌 문자가 들어간 제목은 원시 UTF-8이 아니라 RFC 2047 인코딩 워드로 전송됩니다. 제어 문자가 들어간 알람 이름은 거부되지 않고 공백으로 바뀝니다. 알람 이름이 무엇이든 호출은 나가야 하기 때문입니다.

## 우선순위 하한

각 채널에는 자체 `MinPriority`가 있으며, 이는 그 채널이 여전히 반응하는 가장 낮은 알람 우선순위입니다. `model.AlarmPriority`는 1(위험, 가장 심각)에서 4(낮음)까지이므로 "높음 이상"은 `MinPriority = 2`입니다. 알람 자신의 우선순위 번호가 하한 이하이면 채널의 하한을 충족합니다. 위험 전용으로 설정한 웹훅과 보통 이상으로 설정한 SMTP 릴레이는 같은 알람 엔진을 지켜보면서 전혀 다른 알람 집합에 반응할 수 있으며, 서로 일치할 필요는 없습니다.

## 하지 않는 것

**채널의 실시간 재로드가 아닙니다.** 채널은 `EdgePublishConfig`와 `FleetConfig`처럼 프로세스 시작 시 설정에서 한 번만 읽습니다. `HOTLOOP_NOTIFY_*`를 바꾸면 적용하려면 재시작이 필요하며, 이 MVP에는 실행 중에 채널을 추가하거나 제거하는 API가 없습니다. 에스컬레이션 정책은 예외입니다. 다음에 누구에게 언제 알릴지는 직접 편집하는 데이터이며 저장하면 바로 적용됩니다("에스컬레이션" 참고).

**전용 테이블이 아닙니다.** 성공이든 실패든 모든 알림 시도는 `runtime.Manager.Event`를 통해 기록됩니다. 모든 알람과 플릿 동작이 이미 기록되는 것과 같은 범용 감사 이벤트 메커니즘입니다. 이 정도 규모의 기능을 위해 전용 `notifications` 테이블을 만들 필요는 없었으며, 시스템 로그가 이미 "알림이 전송되었고 동작했는가"에 답합니다.

**내구성 있는 큐가 아닙니다.** 재시도는 제한되어 있으며(3회, 30초, "재시도" 참고) 보류된 알람은 요약이 나갈 때까지 메모리에 있습니다. 계속 실패하는 호출은 로그와 감사 기록에 남고 디스패처는 다음으로 넘어갑니다. 아무도 확인하지 않아 계속 발생 상태인 알람은 호출이 도착했는지와 관계없이 알람 화면과 `alarm_events`에 그대로 보입니다. 알림은 알람 시스템 위의 편의 기능이며 대체물이 아닙니다.

## 설정

| 변수 | 기본값 | <span class="sr-only">상세</span> |
|---|---|---|
| `HOTLOOP_NOTIFY_ENABLED` | `false` | 이것을 설정하기 전에는 기능이 꺼져 있습니다 |
| `HOTLOOP_NOTIFY_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_WEBHOOK_URL` | n/a | 웹훅 채널을 켜면 필수. `http://` 또는 `https://`여야 합니다 |
| `HOTLOOP_NOTIFY_WEBHOOK_MIN_PRIORITY` | `high` | `critical`, `high`, `medium`, `low` 또는 `1`-`4` |
| `HOTLOOP_NOTIFY_SMTP_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_SMTP_HOST` | n/a | SMTP 채널을 켜면 필수 |
| `HOTLOOP_NOTIFY_SMTP_PORT` | `25` | |
| `HOTLOOP_NOTIFY_SMTP_USERNAME` / `_PASSWORD` | n/a | 선택. 익명 릴레이라면 둘 다 생략합니다 |
| `HOTLOOP_NOTIFY_SMTP_FROM` | n/a | SMTP 채널을 켜면 필수 |
| `HOTLOOP_NOTIFY_SMTP_TO` | n/a | SMTP 채널을 켜면 필수. 쉼표로 구분한 주소 |
| `HOTLOOP_NOTIFY_SMTP_TLS` | `false` | 릴레이가 STARTTLS를 제공하도록 요구합니다. 위의 "SMTP 채널의 TLS"를 참고하십시오. STARTTLS는 이 설정과 관계없이 제공되면 자동으로 사용됩니다 |
| `HOTLOOP_NOTIFY_SMTP_TLS_SKIP_VERIFY` | `false` | STARTTLS 전환 시 또는 암시적 TLS 핸드셰이크 시 인증서 검증을 건너뜁니다. 배포별 선택 사항이며 기본으로 설정하지 마십시오 |
| `HOTLOOP_NOTIFY_SMTP_IMPLICIT_TLS` | 465번 포트면 `true`, 그 외 `false` | STARTTLS 대신 첫 바이트부터 TLS. "암시적 TLS, 465번 포트"를 참고하십시오. 포트를 무시하려면 설정합니다 |
| `HOTLOOP_NOTIFY_SMTP_MIN_PRIORITY` | `high` | 웹훅과 같은 값 |
| `HOTLOOP_NOTIFY_NTFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_NTFY_URL` | none | 필수. 서버만, `https://ntfy.example.com`, 경로 없이 |
| `HOTLOOP_NOTIFY_NTFY_TOPIC` | none | 필수. 영문자, 숫자, `-`, `_` 1자에서 64자. 공개 서버에서는 비밀번호입니다 |
| `HOTLOOP_NOTIFY_NTFY_TOKEN` | none | ntfy 액세스 토큰(`tk_...`)이며 bearer 토큰으로 전송됩니다 |
| `HOTLOOP_NOTIFY_NTFY_USERNAME` / `_PASSWORD` | none | 토큰 대신 기본 인증. 둘 다는 불가 |
| `HOTLOOP_NOTIFY_NTFY_ACK` | `true` | 모든 알람에 확인 버튼을 붙입니다(`HOTLOOP_PUBLIC_URL` 필요) |
| `HOTLOOP_NOTIFY_NTFY_MIN_PRIORITY` | `high` | 웹훅과 같은 값 |
| `HOTLOOP_NOTIFY_GOTIFY_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_GOTIFY_URL` | none | 필수. `https://gotify.example.com` |
| `HOTLOOP_NOTIFY_GOTIFY_TOKEN` | none | 필수. Gotify가 HotLoop용으로 준 애플리케이션 토큰 |
| `HOTLOOP_NOTIFY_GOTIFY_MIN_PRIORITY` | `high` | 웹훅과 같은 값 |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_URL` | none | 필수. Discord의 Copy Webhook URL이 주는 URL. 전체가 비밀번호입니다 |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_CRITICAL_ROLE` | none | 위험 알람에 호출할 역할 id |
| `HOTLOOP_NOTIFY_DISCORD_WEBHOOK_MIN_PRIORITY` | `high` | 웹훅과 같은 값 |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ENABLED` | `false` | |
| `HOTLOOP_NOTIFY_DISCORD_BOT_TOKEN` | none | 필수. 봇의 토큰만, 앞에 `Bot `을 붙이지 않고 |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CHANNEL` | none | 필수. 게시할 채널 id |
| `HOTLOOP_NOTIFY_DISCORD_BOT_ACK_ROLES` | none | 구성원이 확인을 누를 수 있는 역할 id를 쉼표로 구분. **비어 있으면 아무도 없음** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE_ROLES` | none | 보류에 대해 같음. **비어 있으면 아무도 없음** |
| `HOTLOOP_NOTIFY_DISCORD_BOT_USERS` | none | 쉼표로 구분한 `discordUserId=hotloopUser`: 동작을 HotLoop 이름으로 기록할 사람 |
| `HOTLOOP_NOTIFY_DISCORD_BOT_SHELVE` | `1h` | 보류가 보류하는 시간. 최대 `24h` |
| `HOTLOOP_NOTIFY_DISCORD_BOT_CRITICAL_ROLE` | none | 위험 알람에 호출할 역할 id |
| `HOTLOOP_NOTIFY_DISCORD_BOT_MIN_PRIORITY` | `high` | 웹훅과 같은 값 |
| `HOTLOOP_NOTIFY_DISCORD_API_URL` | `https://discord.com/api/v10` | 봇의 요청을 프록시로 보낼 때만 |
| `HOTLOOP_NOTIFY_<CHANNEL>_BURST` / `_REFILL` | 채널별 | 속도 제한. "속도 제한과 요약" 참고. `<CHANNEL>`은 `WEBHOOK`, `SMTP`, `NTFY`, `GOTIFY`, `DISCORD_WEBHOOK`, `DISCORD_BOT` 중 하나입니다 |
| `HOTLOOP_PUBLIC_URL` | none | 휴대폰이 HotLoop에 접속하는 주소(기본 경로 포함). 탭하여 열기와 확인 버튼에 필요합니다 |
| `HOTLOOP_NOTIFY_ACK_SECRET` | 생성됨 | 확인 링크에 서명합니다. 32자 이상. 설정하지 않으면 한 번 생성되어 데이터베이스에 보관됩니다 |
| `HOTLOOP_NOTIFY_ACK_TTL` | `12h` | 확인 링크가 동작하는 시간. 최대 `168h` |

Helm 차트에서는 `notify.ntfy`, `notify.gotify`, `notify.discordWebhook`, `notify.discordBot`, `notify.ackSecret`, `notify.ackTtl`, 그리고 최상위 `publicUrl` 아래에 있습니다. 토큰, 비밀번호, Discord 웹훅 URL은 차트가 관리하는 Secret에 들어가며, `existingSecret`으로 직접 만든 Secret을 지정할 수도 있습니다.

## API

| 경로 | 권한 | <span class="sr-only">상세</span> |
|---|---|---|
| `POST /api/notify/test` | `notify.test` | 설정된 모든 채널로 합성 테스트 알림을 지금 바로 보냅니다 |
| `POST /api/notify/ack/{token}` | 없음. 토큰이 인증입니다 | 토큰이 발급된 알람 발생을 확인합니다. "확인 링크"를 참고하십시오 |
| `GET /api/notify/escalation` | `notify.escalation` | 에스컬레이션 정책, 단계가 지정할 수 있는 채널, 지금 열려 있는 체인. "에스컬레이션"을 참고하십시오 |
| `PUT /api/notify/escalation` | `notify.escalation` | 정책 전체를 교체합니다. 단계가 아무도 지정하지 않거나 설정되지 않은 채널을 지정하면 사유와 함께 거부됩니다 |
| `GET /api/diagnostics` | `status.read` | `notify.channels` 아래의 각 채널 상태: Discord가 거부했는지(이유와 시점 포함), Discord 봇의 Gateway 연결 |

`notify.escalation`도 같은 방식으로 관리자 전용입니다. 정책에 사람들의 ntfy 토픽이 들어 있으므로 정책을 읽는 데도 필요합니다.

`notify.test`는 관리자 전용이며, 관리자 역할이 이미 가진 와일드카드로 부여되고 운영자 역할의 권한 목록에는 의도적으로 추가하지 않았습니다. 실제 외부 메시지를 보내고 호출 업체나 SMTP 릴레이가 허용하는 할당량을 소모하는 일은 읽기보다는 `fleet.restart`와 `fleet.config`(이것들도 관리자 전용이며 "지금 바깥 세계에 무언가를 한다")에 더 가까우며, 이 앱이 이미 그 둘에 적용하는 것과 같은 제한입니다.

응답은 요청에 대한 하나의 성공 또는 실패가 아니라 각 채널의 결과를 알려 줍니다.

```json
{
  "results": [
    {"channel": "webhook", "success": true},
    {"channel": "smtp", "success": false, "error": "dial smtp server mail.example.com:587: i/o timeout"}
  ]
}
```

## 검증된 것과 검증되지 않은 것

HotLoop은 실제 장비와 실제 서버에 대해 실행되었으며, 2026-11-17에는 베어메탈에서 실행되었습니다.
