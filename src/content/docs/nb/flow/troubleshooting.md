---
title: "Når Flow nekter å starte"
description: "Oppstartsfeilene Flow gir med vilje, hva hver av dem betyr og løsningen på én linje."
---

Utenom de vanlige konfigurasjonsfeilene (en skrivefeil i YAML, en port utenfor området) nekter den å starte av fem grunner, alle med vilje. Hver av dem skriver ut løsningen i stedet for en stakksporing, fordi den som leser den ser på en CrashLoopBackOff og ikke trenger Go-stiene mine.

| Avvisning | Løsning |
|---|---|
| Autentisering er slått av | Sett opp en bruker. Eller, hvis nettverket virkelig er isolert og du har bestemt deg for å ta ansvaret, sett `HOTLOOP_FLOW_INSECURE=true` i miljøet. `auth.enabled: false` i filen er ikke nok alene. (Til og med 2.0.4 gjorde variabelen ingenting, og du fikk denne avvisningen uansett. Rettet i 2.0.5.) |
| Autentisering er på uten brukere | Sett `auth.users`, eller `HOTLOOP_FLOW_ADMIN_USER` og `HOTLOOP_FLOW_ADMIN_PASSWORD_HASH`. |
| En `passwordHash` som ikke er bcrypt | Kjør `hotloop-flow hash-password`. Denne sjekken finnes for at et passord i klartekst aldri ved et uhell skal havne i en ConfigMap. |
| Ingen legitimasjonshemmelighet | Sett `HOTLOOP_FLOW_CREDENTIAL_SECRET`. Eller `HOTLOOP_FLOW_ALLOW_PLAINTEXT_CREDENTIALS=true` hvis denne instansen ikke holder noen hemmeligheter i det hele tatt. |
| `discovery` eller `exec` slått på med tom tillatelsesliste | List opp hva som er tillatt, eller slå funksjonen av. En tom tillatelsesliste lest tillatende er nøyaktig slik en smal egenskap blir til et shell. |

Det den *ikke* nekter å starte for, er én dårlig node. En flyt med én ødelagt node kjører alle de andre nodene og logger feilen, fordi å ta ned en linje på grunn av én skrivefeil i én dialog er verre enn å kjøre 40 noder av 41 og si fra om det. Det samme gjelder en exec-tillatelsesliste som nevner noe som ikke er i `PATH` ennå: den advarer ved oppstart og løser det opp på nytt når en flyt bruker det, siden en init-container eller et montert volum legitimt kan bringe det inn etter oppstart.

Hvis flytfilen ikke lar seg tolke, prøver den sikkerhetskopiene, nyeste først, beholder den ødelagte filen ved siden av som `.corrupt` og logger nøyaktig hvilken sikkerhetskopi den falt tilbake til. Hvis ingen av dem lar seg tolke heller, stopper den der, i stedet for å komme opp tom og se frisk ut mens alle flytene dine er borte. Og en utrulling skriver flytfilen *før* den stopper den gamle kjøretiden, så hvis lagringen feiler, fortsetter de forrige flytene å kjøre i stedet for at linjen går ned på grunn av en dårlig lagring. Den rekkefølgen er ikke den åpenbare, den er ikke tilfeldig, og en test feiler hvis noen bytter den.
