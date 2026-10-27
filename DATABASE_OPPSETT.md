# Våre røtter – database (steg 1)

Dette er **bare struktur**, ikke slektsdata. Denne mappen kan ligge i et offentlig GitHub-repository uten å publisere navn, fødselsdatoer, bilder, passord eller nøkler.

## Gjør dette

1. Opprett/logg inn på https://supabase.com/dashboard.
2. Velg **New project** og et passende prosjektnavn, f.eks. `vare-rotter-familie`. Sett et sterkt databasepassord i Supabase (ikke send passordet i chatten).
3. Når prosjektet er klart, åpne **SQL Editor**, lag en ny spørring og lim inn innholdet i `supabase/migrations/20261027_000001_initial_private_schema.sql`. Trykk **Run**.
4. Kontroller under **Table Editor** at fem tabeller finnes: `familie_medlemmer`, `personer`, `slektsforbindelser`, `historier` og `arkivfiler`. Under **Storage** skal den private bøtten `familiearkiv` finnes.
5. **Ikke legg inn familieopplysninger ennå**. Ingen innloggede brukere får tilgang i denne fasen. Vi skal deretter konfigurere invitasjonskode, e-postinnlogging og testede tilgangsregler.

## Kritiske sikkerhetsregler

- Ingen familieslektninger eller familiebilder i det offentlige GitHub-repositoryet.
- Aldri legg databasepassord, `service_role`-nøkkel eller Supabase secret key i GitHub eller nettsidens HTML.
- RLS er slått på og tilgang trukket tilbake fra både `anon` og `authenticated`. Før vi legger inn persondata må nye RLS-policies testes for **godkjent medlem / ikke medlem / sperret medlem**, også for filer i Storage.
- Den gamle offentlige GitHub Pages-siden er **fortsatt offentlig**. Ikke tro at innloggingsbeskyttelse er aktiv før den er implementert og testet.
- Et felles familiepassord uten serversjekk er ikke tilstrekkelig. Invitasjonskode skal kontrolleres på serversiden og kunne endres ved lekkasje.

Neste utviklingstrinn er autentisering og medlemskap; dette er ikke en ferdig databaseforbindelse eller funksjonell nettportal ennå.
