---
title: "Инсталиране на HotLoop Transmitter"
description: "Инсталирайте библиотеката в хранилището за библиотеки на CODESYS, добавете я към проект и вижте какво да направите, когато блокът съобщи грешка."
---

Нужна ви е среда за разработка CODESYS 3.5 SP22 или по-нова и runtime, чиято цел има компонентите SysSocket и SysTimeRtc, които runtime средите CODESYS Control за Linux SL имат (вторият е нов в 1.1.0, заради времевата марка).

## От CODESYS Installer

От 1.1.0 изданието има и `HotLoopTransmitter-1.2.0.package` на адрес https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.package. Инсталирайте го с CODESYS Installer (в IDE: Tools, CODESYS Installer) или без прозорец с неговия команден ред, `PackageManagerCLI.exe --profile="<your profile>" --install=<file>.package --targetProfiles="<your profile>"`. Installer поставя библиотеката в хранилището за библиотеки на този профил, под компанията HotLoop, и вие преминавате към стъпка 3 по-долу. Пакетът е същата библиотека като файла `.library`, в ZIP, който Installer чете, така че двата пътя дават една и съща библиотека.

## От файла на библиотеката

1. Изтеглете `HotLoopTransmitter-1.2.0.library` от https://hotloop.io/hotloop-transmitter/1.2.0/HotLoopTransmitter-1.2.0.library и го проверете със `SHA256SUMS` в същата папка (`sha256sum -c SHA256SUMS`).
2. В IDE на CODESYS: Tools, Library Repository, Install, изберете файла. Вече е в хранилището под компанията HotLoop.
3. В проекта си отворете Library Manager на приложението, Add Library и изберете HotLoop Transmitter. SysSocket, SysTimeRtc и техните интерфейсни библиотеки идват с нея като зависимости и не изискват нищо от вас.
4. Декларирайте `HLTX.FB_HLTX_Publisher`, добавете полетата си и го викайте на всеки цикъл (README има примера).
5. Заредете в контролера. Местоназначението трябва да е достъпно от мрежата на контролера; за multicast суичовете в мрежата трябва да пренасят групата.

Файлът `.compiled-library` е същата библиотека без изходния код. Инсталирайте него, ако не искате Structured Text да се вижда в Library Manager. Намира се в същата папка като `HotLoopTransmitter-1.2.0.compiled-library`.

За да проверите какво пристига, върши работа всеки UDP слушател на порта на местоназначението. Малка програма на Go, която слуша на порт или се присъединява към multicast група и отпечатва всяка датаграма като ред JSON с нейния шестнадесетичен вид, върши добра работа.

## HotLoop Alarms

От 1.2.0 версията включва и `HotLoopAlarms-1.0.0.0.library` и `HotLoopAlarms-1.0.0.0.compiled-library`, библиотеката за собствените аварии на PLC, в същата папка. Инсталирайте която и да е от двете по същия начин като библиотеката на Transmitter и я добавете към Library Manager на приложението. Проектът изисква Alarm Configuration, а HotLoop 4.23.6 и по-нови чете блока.

## Ако блокът съобщи грешка

| `eError` | Значение | Какво да направите |
|---|---|---|
| `NoFields` | не е добавено поле | извикайте метод `Add` преди да разрешите |
| `BadInterval` | `tPublishingInterval` е под 1 ms | задайте го |
| `BadAddress` | `sDestination` не е IPv4 адрес с точки | поправете го |
| `SocketCreate`, `SocketOption` | runtime отказа извикване на сокет; `diLastSocketResult` съдържа кода му | блокът опитва отново сам след `tRetry` |
| `TooBig` | полетата не се побират в 1472 байта | публикувайте по-малко или използвайте два публикуващи блока с различни writer id |
| `BadField` | запазен адрес е изчистен | `Clear()` и добавете полетата отново |
