---
title: "Utgivelsesnotater HotLoop for CODESYS 0.3.7"
description: "Chart 0.3.7 for HotLoop for CODESYS: omslutter HotLoop 4.22.0 og kjører provisioner 0.3.2."
sidebar:
  label: "0.3.7"
---

## Hva som er endret

0.3.7 er i indeksen `{{codesysChartRepo}}`, publisert 2026-11-19.

- **Det omslutter HotLoop 4.22.0,** som gir hver OPC UA PubSub-enhet på samme adresse og port en delt socket, så to lyttere kan sitte på én UDP-port.
- **Provisioneren tar to lyttere på én port.** Provisioner 0.3.2 avviser ikke lenger en profil som legger to `opcua-pubsub`-enheter på én port.

Hva det betyr for deg: en profil med flere PubSub-utgivere på én port installeres og leses.

## Hva som ble sjekket

En ny installasjon med en profil av runtimens egen enhet, to PubSub-lyttere på samme UDP-port, en alarm og et skjermbilde, ved siden av en ekte CODESYS Control for Linux SL 4.22.0.0-runtime som kjører Transmitter-biblioteket: alt ble laget uten håndarbeid, PLS-ens variabler leste bra, alarmen utløstes på PLS-ens egen verdi, og begge lyttere leste tilkoblet. Mot en ekte utgiver i begge kodinger leste hvert av de 32 feltene bra og lik PLS-en. Begge podene slettet og runtime startet på nytt: HotLoop kom tilbake av seg selv med sine tre enheter.
