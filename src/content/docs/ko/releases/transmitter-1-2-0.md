---
title: "Transmitter 1.2.0 릴리스 노트"
description: "HotLoop Alarms가 릴리스에 합류합니다. PLC 자체 알람을 HotLoop이 읽는 곳에 두는 라이브러리이며, 게시자는 그대로입니다."
---

이번 릴리스는 PLC 자체 알람을 HotLoop이 읽는 곳에 두는 두 번째 라이브러리인 HotLoop Alarms를 추가하고, Transmitter를 1.1.0과 같은 게시자로 1.2.0.0으로 내놓습니다.

이것이 의미하는 바: CODESYS 프로젝트가 이미 발생시키는 알람이 HotLoop의 알람 목록에 나타나고, HotLoop에서 하나를 확인하면 PLC에서도 확인됩니다. 게시자만 쓴다면 바꿀 것이 없습니다.

## 1.1.0을 쓰는 프로젝트에서 달라지는 점

* **HotLoop Alarms 1.0.0.0, 신규.** `HotLoopAlarms-1.0.0.0.library`와 `.compiled-library`가 릴리스에 있습니다. 블록 `HLAL.FB_HLAL_Alarms`는 CODESYS 알람 관리자의 클라이언트입니다. 사이클마다 한 번 호출하면 활성, 대기, 확인된 알람을 일반 변수 표(`aAlarms`, 64행)로 복사하며, 런타임의 OPC UA 서버가 이를 다른 변수와 똑같이 내보냅니다. 표가 바뀌면 `udiChanges`가 올라가고, 들어가지 못한 활성 알람은 조용히 잃지 않고 `uiDropped`가 셉니다. 생성된 알람 커넥터 라이브러리는 필요 없고 프로젝트 자체의 Alarm Configuration만 있으면 됩니다.
* **확인이 되돌아옵니다.** 명령 변수(`uiAckGroupId`, `uiAckAlarmId`, `udiAckInternalId` 또는 `bAckAll`, 그리고 `udiAckRequest`의 새 번호)에 쓰면 블록이 알람 관리자를 통해 그 알람 또는 모든 알람을 확인합니다. HotLoop 4.23.6 이상은 블록이 담고 있는 것으로 블록을 찾아 이 모두를 대신 해 줍니다.
* **Transmitter 게시자는 바뀌지 않았습니다.** 필드 목록과 와이어 포맷은 그대로이고 `bTimestamp`도 전과 같이 동작합니다. 라이브러리는 1.2.0.0으로 다시 빌드되며 `.package`에 들어 있습니다.
* **라이선스는 HotLoop Source License Agreement 1.0입니다.** 모든 HotLoop 제품과 같습니다.

## 내가 실행한 것과 그 결과

모두 실험실에서 컨테이너 안의 CODESYS Control for Linux SL 4.22.0.0을 상대로 했습니다.

* Transmitter 라이브러리는 CODESYS 3.5.22.30에서 오류 0, 경고 0으로 빌드되며, 이를 기반으로 빌드한 예제 애플리케이션도 같습니다.
* 실험실: 게시자 둘, Variant와 RawData, 각각 메시지 114개를 디코딩, 모든 값이 PLC가 자체 OPC UA 서버로 보고하는 값과 같고, 시퀀스 번호에 빈틈이 없으며, 모든 메시지에 두 타임스탬프가 있고, `bTimestamp := FALSE`일 때 1.0.0의 바이트와 같았습니다. 독립된 OPC UA PubSub 구현이 모든 메시지의 값과 타임스탬프를 읽습니다. 128개 점검이 통과했고 실패는 없었습니다.
* HotLoop core의 UADP 구독자가 실제 런타임을 상대로 두 게시자를 읽습니다. 모든 값이 같고, 카운터 둘 모두 증가하며, key frame 62개를 받았고 거부된 것은 없습니다.
* `.package`는 `PackageManagerCLI --install`로 설치되고, 라이브러리가 System 저장소에 나타나며, 예제는 이를 기반으로 오류 0, 경고 0으로 빌드됩니다.
* HotLoop Alarms: 알람 둘의 Alarm Configuration이 있는 실제 런타임에서, PLC에서 발생한 트립이 HotLoop에 보이고, HotLoop에서 확인하면 PLC의 표가 시각과 함께 확인됨이 되고, 리셋하면 확인 대기가 되며, HotLoop에서 확정하면 PLC의 표가 비워집니다. 두 번째 알람은 반대 순서로 진행되며, 모두 확인은 활성 알람 둘을 모두 확인했습니다.
* 20 ms 태스크, 게시자 둘, 코어 넷에 고정했을 때 게시자의 비용: 사이클당 평균 약 15 us 추가, 가장 긴 사이클 144 us, 건너뛴 게시 슬롯 없음, 거부된 전송 없음. 같은 시간에 다시 빌드한 1.1.0 라이브러리는 15.2 us와 261 us였습니다.

## 실행하지 않은 것

* 실제 컨트롤러, Control for Linux SL 4.22.0.0 이외의 CODESYS 런타임, x86-64 이외의 CPU.
* 확인하고 확정을 요구하는 알람 클래스가 아닌 클래스의 HotLoop Alarms, 또는 동시에 활성 알람이 64개를 넘는 경우.
* CODESYS Installer 창에서의 `.package` 설치. PackageManagerCLI로 헤드리스 설치했습니다.
* 실시간 시계가 설정되지 않았거나 틀린 컨트롤러, 멀티캐스트, 네트워크를 잃었다가 되찾는 런타임, 두 시간 데모 창의 끝.

## 이 릴리스에 없는 것

KeepAlive와 Delta Frame, NetworkMessage당 둘 이상의 DataSetMessage, WSTRING, 필드별 상태, 1초 미만 타임스탬프, 메시지 보안, 구독자 측. [로드맵](/ko/transmitter/roadmap/)에 다음 순서가 있습니다.

## 되돌리기

1.1.0에 고정된 PLC 프로젝트는 계속 동작하며 같은 바이트를 보냅니다. HotLoop Alarms는 별도의 라이브러리이므로, 이를 추가하지 않는 프로젝트는 영향을 받지 않습니다.

## 파일

https://hotloop.io/hotloop-transmitter/1.2.0/ 에서 내려받아 같은 폴더의 `SHA256SUMS`와 대조하십시오.

```
e68cfc88e599ddcf278eb208ff500f4f78d3faf74edf12e38f308a009f478594  HotLoopAlarms-1.0.0.0.compiled-library
68f704fc5662bbc67ec097016a741065d705af01913a2746296c17f9e6991118  HotLoopAlarms-1.0.0.0.library
a404f20fc35c4a3d804aa194f29def3f8193e26e696357899d3ae5b3d44948c1  HotLoopTransmitter-1.2.0.compiled-library
05200d0279ac120fd69d2dc3eeba99d9b40cb76eba2d15d1431b94c5e8f3fc32  HotLoopTransmitter-1.2.0.library
d6b6606a5919e18d2d6d31a5529af4d76bc7058003fb26032ec1a578f78ea57d  HotLoopTransmitter-1.2.0.package
```
