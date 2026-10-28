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


## Interaktivt slektskart (kun innloggede)

Slektskartet ligger på `slektskart.html` og er lenket fra `familie.html`.
Forsiden `index.html` inneholder ingen slektsnavn eller gamle `PEOPLE`-data.

- Supabase Auth og et aktivt medlemskap kreves **før** historiske og private slektsdata hentes.
- Kartet kan søkes etter navn og viser «Hele slekta mi», «Forfedre», «Etterkommere» og «Alle registrerte».
- Dra/scroll for å flytte, knip for å zoome eller bruk +, − og «Vis alt».
- Historiske personer kan åpnes i `familie.html#person=<uuid>`; private slektsledd peker mot den brukerbeskyttede familiegrenen.
- Levendes profiler, familienavn i den private grenen og historiske private koblinger ligger i egne RLS-beskyttede tabeller og hentes ikke inn i statiske GitHub-filer.
- «Hele slekta mi» viser slektskoblinger som faktisk finnes. Tanter, onkler, søskenbarn og kusiner **dukker ikke opp automatisk** før de er lagt inn og eventuelle rettigheter er avklart.
- Eksisterende historiske slektskoblinger kan være merket `usikker` og skal ikke fremstilles som dokumenterte.

**Gjenstående personvernarbeid:** Det offentlige repositoryets tidligere Git-historikk og eventuelle gamle, indekserte kopier kan fortsatt inneholde historiske personopplysninger. Dette er ikke ryddet opp i ved å endre forsiden; flytting/privatisering av repository og vertskap må vurderes separat.


## Slektskapsbetegnelser i kartet

Slektskartet regner nå ut slektskapsavstand **fra brukerens egen private profil** ved å følge registrerte forelder–barn-koblinger bakover:
- Foreldre, besteforeldre, oldeforeldre, tippoldeforeldre og flere `tipp-` for eldre generasjoner.
- For avdøde historiske personer brukes valgfri `public.personer.kjonn` (`mann` eller `kvinne`). Uten registrert opplysning brukes nøytral form, som `tippoldeforelder`, aldri et gjetning fra navnet.
- Bekreftede private roller (mor, far, mormor, morfar, farmor, farfar) gir presis betegnelse og kan også angi rollen til en allerede registrert historisk person som er markert `samme_person`.
- For sidegrener vises ikke en feilaktig direkte-forfar-betegnelse. Der vises felles stamforelder hvis det finnes registrert grunnlag; ellers manglende kobling.
- Korteste registrerte slektsvei brukes for å telle generasjoner. Usikre ledd oppgis særskilt. Dette verifiserer ikke familieopplysningene mot primærkilder.
- Administratoren kan nå velge historisk kjønn i `admin.html` for personer der dette er sikkert kjent; ingen av de 79 historiske personene ble automatisk klassifisert ved innføring av feltet.

Testet med syntetiske slektsdata fra foreldre til åtte tipp-generasjoner, sidegrener og etterkommere. Manuell visuell mobilsesjon er ikke utført etter denne endringen.
