# Våre røtter 🌳

Dette prosjektet utvikles nå som **et privat slektstre og minnebok for inviterte familiemedlemmer**. HTML/JavaScript kan være offentlig tilgjengelig, men private data må beskyttes av Supabase Auth, Row Level Security og privat Storage.

## Nettsiden

Når GitHub Pages er aktivert, åpnes siden på:

**https://moholdt123.github.io/V-re-r-tter/**

Forsiden skal bare vise en velkomsttekst og lenke til innlogging. Ingen personslektsdata skal ligge direkte i den publiserte HTML-en.

## Privat familierom

Familierommet: **https://moholdt123.github.io/V-re-r-tter/familie.html**

E-postinnlogging med invitasjonskode er utviklet. Før bruk for hele familien må e-postutsending (SMTP), redirect-adresse og tilgangstester bekreftes. Les [innloggings- og personvernveiledningen](INNLOGGING_OG_PERSONVERN.md). Den private Edge Function-kilden ligger i `supabase/functions/familie-tilgang/index.ts`. Ikke legg inn private data eller familiekoden i GitHub.

## Publiser på GitHub Pages

1. Åpne **Settings → Pages** for dette prosjektet.
2. Under **Build and deployment**, velg **Deploy from a branch**.
3. Velg branch **main**, mappe **/ (root)**, og trykk **Save**.
4. Åpne lenken over når GitHub bekrefter at nettsiden er publisert.

## Personvern og kilder

Målet er at ingen slektsopplysninger skal ligge i den publiserte forsiden. Tidligere versjoner av det offentlige repositoryet kan fortsatt inneholde historiske persondata i Git-historikken. Ikke last opp den komplette private ZIP-filen til dette prosjektet. GitHub Pages og alt som legges i dette offentlige repoet kan leses av alle, også personer utenfor Facebook-gruppen.

Flere eldre slektsforbindelser stammer fra familiens slektshefter og fortellinger. Usikre forbindelser skal fortsatt merkes tydelig i det private slektsarkivet.

## Oppdatering

Nye slektsopplysninger skal legges i den beskyttede databasen, **ikke** i `index.html` eller andre offentlige filer. GitHub Pages publiserer bare brukergrensesnittet.

> **Viktig:** Å fjerne persondata fra dagens `index.html` fjerner ikke gamle data fra Git-historikk, søkemotorers hurtiglagre eller tidligere kopier. Offentlig GitHub-repository må vurderes separat. Skal alle historiske slektsdata også holdes private, må vi vurdere nytt privat repository og eventuell flytting til sikker hosting. En offentlig forside og GitHub-kode kan ikke alene gi fortrolighet.
