---
title: "웹 인터페이스 언어"
description: "웹 인터페이스는 영어와 13개 언어를 지원하며 아랍어는 오른쪽에서 왼쪽으로 배치되고, 상단 바나 로그인 카드에서 고릅니다."
---

HotLoop IoT, Edge, Gateway(그리고 Edge UI를 실행하는 HotLoop for CODESYS)의 웹 인터페이스는 영어와 13개 언어로 제공됩니다. 스페인어(es), 프랑스어(fr), 이탈리아어(it), 독일어(de), 노르웨이어 보크몰(nb), 불가리아어(bg), 그리스어(el), 한국어(ko), 일본어(ja), 베트남어(vi), 힌디어(hi), 중국어 간체(zh-Hans), 아랍어(ar, 오른쪽에서 왼쪽으로 배치)입니다.

상단 바의 언어 상자나 로그인 카드에서 하나를 고릅니다. 선택은 이 브라우저에 저장됩니다. 아무것도 고르지 않으면 페이지는 브라우저 언어 중 HotLoop이 가진 첫 번째 언어를 쓰고, 맞는 것이 없으면 영어를 씁니다. 언어는 파일이 완성되었을 때만 선택 목록에 나타납니다.

언어를 따라 바뀌는 것은 모든 화면의 모든 단어, 숫자의 순서와 기호(독일어, 프랑스어, 스페인어는 소수점에 쉼표), 날짜와 시각(24시간제), 복수형(아랍어는 여섯 가지), 페이지의 방향입니다. 제품과 프로토콜 이름(HotLoop, Modbus, OPC UA, MQTT, Sparkplug, CODESYS, UniFi)은 쓰인 그대로 둡니다. 태그 이름, 장치 이름, 누군가 입력한 알람 메시지, 서버가 돌려보낸 오류 문구 같은 공장의 값은 있는 그대로 표시됩니다.

## 동작 방식

* [i18next](https://www.i18next.com/) 27이 메시지를 찾고 `{{name}}`을 채우고 복수형을 고릅니다. 브라우저 자체의 `Intl.PluralRules`에 물으므로 복수형 규칙은 Unicode CLDR의 것입니다. 숫자와 날짜는 `web/src/lib/format.ts`를 통해 `Intl.NumberFormat`과 `Intl.DateTimeFormat`을 씁니다.
* 메시지는 `web/src/i18n/locales/<language>.json`에 평평한 구조로, 메시지마다 키 하나씩 들어 있습니다. `en.json`이 원본입니다. 다른 모든 파일은 정확히 같은 키를 가집니다.
* 템플릿이나 스크립트에서는 `tl('area.key')` 또는 `tl('area.key', { name })`로 씁니다. 개수가 있는 메시지는 복수형마다 키가 하나씩 있고(`key_one`, `key_other`, 그리고 언어에 따라 `key_few`, `key_many`, `key_two`, `key_zero`) `count`와 함께 키 이름만으로 요청합니다. `tl('overview.tags_count', { count: n })`가 그 예입니다.
* 영어는 페이지의 일부입니다. 다른 언어는 별도 파일이며 누군가 고를 때 가져옵니다.
* `web/src/i18n/index.svelte.ts`가 언어를 보관하며, 언어를 바꾸면 모든 화면이 다시 그려집니다. `.ts` 파일 맨 위의 상수에 담긴 단어는 파일이 로드될 때 한 번만 읽히고 번역되지 않습니다. getter(`get label() { return tl('x.y'); }`)로 쓰거나, 키를 보관해 두었다가 그려지는 곳에서 `tl()`을 호출하십시오.
* 페이지는 `<html lang dir>`를 설정합니다. CSS는 논리 속성(`margin-inline-start`, `inset-inline-end`, `text-align: start`)을 쓰므로, 아랍어에서는 레이아웃이 저절로 뒤집힙니다.

## 단어 추가와 변경

1. `en.json`에 메시지를 추가하고 코드에서 `tl()`로 씁니다.
2. 그 언어를 읽는 사람이 작성해 다른 모든 언어 파일에 추가하고, codex의 공용 용어집(`work/notes/i18n/glossary/`)을 따릅니다. 짧고 쉬운 문장으로 씁니다. 제품과 프로토콜 이름은 영어로 둡니다.
3. `cd web && npm run check:i18n`을 실행합니다. 언어 파일에 키가 없거나, 영어와 `{{placeholder}}`가 다르거나, 그 언어에 필요한 복수형이 없으면 실패하고, 키를 쓰지 않을 때, 그리고 `tl()`을 거치지 않고 영어가 템플릿이나 코드에 쓰여 있을 때도 실패합니다. 모든 `npm run build` 전과 `npm run typecheck`에서 실행되므로 전체 스위트와 릴리스 빌드가 여기서 멈춥니다. 남겨 두어야 하는 영어(이름, 코드 예시)는 이유와 함께 `web/i18n/allow.json`에 넣습니다.

`HOTLOOP_TEST_BROWSER_GALLERY`와 `HOTLOOP_TEST_BROWSER_ARTIFACTS`를 설정하면 각각의 스크린샷을 보관합니다.

## 번역되지 않는 것

* 서버가 보내는 텍스트: API의 오류 메시지, 알림과 알람 메시지, CLI. UI는 도착한 그대로 보여 줍니다.
* 문서, OPC UA 서버의 이름, MQTT 브로커, Helm 차트 값.
