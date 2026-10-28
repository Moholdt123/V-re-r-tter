# Familieinnlogging og personvern – Våre røtter

Oppdatert 28. oktober 2026. Denne filen beskriver oppsettet som er observert i Supabase og på GitHub, og hvordan hele familien kan komme i gang uten å publisere private opplysninger.

## Status og arkitektur

- Offentlig historisk oversikt: `index.html` på GitHub Pages. Kode og innhold her kan leses av alle.
- Privat familierom: `familie.html` på GitHub Pages. HTML/JavaScript er offentlig, men persondata og filer hentes fra Supabase bare etter godkjenning.
- Autentisering: Supabase Auth sender en engangsinnloggingslenke til brukerens e-post.
- Medlemskap: Etter bekreftet e-post oppgis visningsnavn og en **felles familiekode**. Edge Function `familie-tilgang` validerer koden på serveren og aktiverer medlemskapet.
- Autorisasjon: Supabase Row Level Security (RLS) krever `familie_medlemmer.status = 'aktiv'` for å lese private data. De registrerte filene ligger i en **privat** Storage-bøtte: `familiearkiv`.
- Invitasjonskode: Kun SHA-256-hash av den normaliserte koden lagres i `familie_invites`; klartekst-koden må **aldri** lagres i dette offentlige repositoryet eller i klientkoden.
- Den nåværende Edge Function-kilden er kopiert inn i `supabase/functions/familie-tilgang/index.ts` for versjonskontroll. Den publiseres **ikke automatisk** ved GitHub-commit.

## Før første familieinnlogging (Supabase Dashboard)

1. Åpne riktig Supabase-prosjekt → **Authentication → URL Configuration**. Sett Site URL / tillatt redirect til den publiserte adressen `https://moholdt123.github.io/V-re-r-tter/familie.html`. Bekreft at nettadressen faktisk er publisert på GitHub Pages.
2. Under **Authentication → Sign In / Providers → Email**, behold e-postbekreftelse på. Ikke skru den av for å omgå utsendelsesproblemer. Sørg for at innlogging via e-postlenke er aktivert.
3. Sett opp **Custom SMTP** før dere inviterer hele familien. Supabases innebygde e-postutsendelse er kun for utvikling og kan være begrenset til prosjektets egne teamadresser og få meldinger per time. Se <https://supabase.com/docs/guides/auth/auth-smtp>.
4. Kontroller at det finnes **én aktiv** invitasjonshash i `familie_invites`; den aktuelle familiekoden må være kjent for familieadministrator. Ikke legg koden inn i dette repoet. Dersom koden er mistet, må en ny kode genereres og hash registreres via en sikker administrativ prosess. Endre **ikke** koden uten å varsle de inviterte.
5. Sjekk at Edge Function `familie-tilgang` er aktiv og krever gyldig bruker-JWT. Ingen `service_role` / secret key skal ligge i `familie.html` eller GitHub.
6. Test en e-postlenke i vanlig nettleser: først e-post, deretter familiekode og visningsnavn. Bruk ekte, eiergodkjente testadresser og aldri legg testpassord/koder i GitHub.

## Akseptansetester før familieinvitasjoner

| Test | Forventet resultat |
| --- | --- |
| Besøker uten innlogging åpner `familie.html` | Ser kun innloggingsskjema; ingen persondata hentes |
| Bekreftet e-post uten familiekode | Ser skjerm for familiekode; har ikke tilgang til personer, historier eller filer |
| Feil familiekode | Avvises; forsøk begrenses etter gjentatte feil |
| Riktig familiekode og bekreftet e-post | `familie_medlemmer` blir `aktiv`; privat arkiv kan åpnes |
| Utlogget/ikke-godkjent bruker spør direkte mot Supabase API | RLS/grants stopper lesing av persondata og filer |
| `status='sperret'` | Skal ikke se privat innhold, selv om en tidligere innlogging fortsatt finnes |
| Aktivt medlem skriver en historie | Historien vises for familien, ikke på offentlig historisk side |
| Aktivt medlem laster opp JPG/PNG/WebP/PDF | Filen blir i privat bøtte; nedlasting krever kortvarig signert lenke |
| Innloggingslenke åpnes feil/utløpt | Vises som feil; ny lenke kan bestilles |

**Foreløpig kontroll 28.10.2026:** RLS er aktiv på familietabellene. Tabellen `familie_medlemmer` hadde **ingen aktive medlemmer**. En begrenset SQL-test som `authenticated` uten familiemedlemskap returnerte ingen private historier. End-to-end-test med aktivt familiemedlem og faktisk e-postutsendelse **gjenstår**.

## Personvern

- Ikke legg navn, fødselsdatoer, kontaktinformasjon, bilder eller historier om nålevende slektninger i `index.html`, `README.md`, issues eller et offentlig GitHub-repo.
- `noindex` eller et innloggingsskjema alene gjør ikke nettsiden privat: **RLS og privat Storage er sikkerhetsgrensen**.
- Aktive familiemedlemmer kan for øyeblikket se det felles arkivet. Familiemedlemmer bør ha samtykke/avklart grunnlag for å legge inn opplysninger om nålevende personer.
- Del ikke familiekoden offentlig. Ved mistanke om lekkasje: deaktiver den gamle hash-oppføringen, lag en ny kode og informer familien via en privat kanal.
- Følg opp at **Supabase Auth → Password Security → Leaked Password Protection** eventuelt er aktivert dersom dere senere slår på passordinnlogging; nå brukes e-postlenke.
- Forslag til videre steg: administratorfunksjon for sperring av tilgang, full medlemstest av RLS, moderering/endre historiene, og egne personvernvalg for nålevende.

## Kilder til tjenestens oppsett

- <https://supabase.com/docs/guides/auth/passwordless-login>
- <https://supabase.com/docs/guides/auth/users>
- <https://supabase.com/docs/guides/database/postgres/row-level-security>
- <https://supabase.com/docs/guides/storage/security/access-control>


## Private profiler for levende familiemedlemmer – 28. oktober 2026

I Supabase er migrasjonen \`private_living_member_profiles\` gjennomført. Tabellen
\`public.levende_profiler\` inneholder personlige selvprofiler som er knyttet til
\`auth.users.id\`. RLS tillater bare at den innloggede, aktive eieren leser,
oppretter, oppdaterer eller sletter sin egen profil. \`anon\` har ingen
tabelltilgang. Andre familiemedlemmer får ikke lese profilen, selv om de har
aktivt medlemskap.

Pilotbrukerens selvprofil er lagt direkte i denne private tabellen med
opplysninger fra familiens eksisterende, private overføringsnotat. **Ingen
personnavn eller fødselsdatoer om levende familiemedlemmer er lagt inn i
frontendkoden eller det offentlige slektstreet.** Ikke kopier profilene inn i
den delte \`personer\`-tabellen, fordi denne per nå kan leses av alle aktive
familiemedlemmer.

En ny seksjon «Min profil» i \`familie.html\` leser \`levende_profiler\`
etter innlogging, og lar eieren rette egen profil. Endringen er lagt til på
\`main\` og i dette PR-utkastet. Profilen vises **ikke** i familietreet
foreløpig. Familieforbindelser og felles synlighet krever separat, avklart
personvernløsning før flere levende personer legges inn.

Verifisert med Supabase SQL: eieren så én profil; ingen sesjon og
annen brukeridentitet så null. \`anon\` hadde null tabellrettigheter, og
fire RLS-policies var installert. Koden i den oppdaterte \`familie.html\` er
syntakssjekket, men faktisk autentisert mobilvisning av den nye
profilseksjonen må fremdeles prøves i nettleseren.


## Privat historisk slektsbro – oktober 2026

Et eget privat utkast til seks nærmeste familieforbindelser finnes i `public.familiegren_utkast`.
Tabellen `public.familiegren_historiske_koblinger` har nå fem koblinger mot
avdøde personer i det eksisterende `public.personer`-registeret. Disse kan
være `samme_person` (historisk profil = personen i den private grenen)
eller `forelder` (historisk profil er oppgitt forelder til personen i utkastet).

**Ikke hardkod levende personnavn eller disse private koblingene i offentlig
`familie.html` eller `index.html`.** Koblingstabellen inneholder UUID-er
og relasjonsnøkler, har RLS, og gir bare SELECT til et aktivt medlem når
`bruker_id = auth.uid()`. Ingen `anon`-tilgang eller write-rettigheter
til autentiserte klienter; endringer i koblingene må kvalitetssikres
administrativt. En egen seksjon i familierommet henter koblingene fra
Supabase etter innlogging, og viser knapper til eksisterende historiske
personprofiler, som i sin tur har videre slektsforbindelser.

Grunnlaget er familiens overføringsnotat og eksisterende data,
**ikke en ny primærkildekontroll**. Det er ingen registrert kobling for
farfars gren ennå. Ved endring i et privat familienavn må koblingene
gjennomgås før de kan anses som riktige. Det store delte slektstreet
viser fortsatt ingen levende personer.

Kontroll: fem historiske koblinger lagret; anonym rolle og en annen
brukeridentitet fikk null resultater; `anon` har null tabelltilgang.
Koden er syntakssjekket og mobil-CSS forbedret. Manuell test av
knapper i innlogget mobilnettleser gjenstår.
