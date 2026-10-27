-- Våre røtter: Databasestruktur – STEG 1
-- Inneholder kun tabeller og sikkerhetsinnstillinger, ingen persondata.
-- Kjør i en NY Supabase-database via SQL Editor.
-- STEG 2 må sette opp innlogging, invitasjonskode og TESTE RLS før data legges inn.

begin;

-- Medlemskap er knyttet til innloggingstjenesten (auth.users).
create table if not exists public.familie_medlemmer (
  bruker_id uuid primary key references auth.users(id) on delete cascade,
  visningsnavn text not null check (char_length(visningsnavn) between 1 and 150),
  rolle text not null default 'medlem' check (rolle in ('medlem', 'administrator')),
  status text not null default 'venter' check (status in ('venter', 'aktiv', 'sperret')),
  opprettet timestamptz not null default now()
);

-- Personer: ingen data legges inn av denne migrasjonen.
-- En person kan ha usikker fødselsdato, og levende er standardverdi.
create table if not exists public.personer (
  id uuid primary key default gen_random_uuid(),
  navn text not null check (char_length(navn) between 1 and 250),
  lever boolean not null default true,
  fodt_dato date,
  dod_dato date,
  fodt_ar smallint,
  dod_ar smallint,
  kort_biografi text,
  kildehenvisning text,
  opprettet_av uuid references auth.users(id) on delete set null,
  opprettet timestamptz not null default now(),
  oppdatert timestamptz not null default now(),
  constraint dato_rekkefolge check (fodt_dato is null or dod_dato is null or dod_dato >= fodt_dato)
);

-- Koblingene registreres uttrykkelig i stedet for å anta slektskap.
-- Ved forelder_barn betyr fra_person forelderen og til_person barnet.
create table if not exists public.slektsforbindelser (
  id uuid primary key default gen_random_uuid(),
  fra_person uuid not null references public.personer(id) on delete cascade,
  til_person uuid not null references public.personer(id) on delete cascade,
  type text not null check (type in ('forelder_barn', 'partner', 'sosken', 'annen')),
  beskrivelse text,
  kildehenvisning text,
  sikkerhet text not null default 'usikker' check (sikkerhet in ('dokumentert', 'familieopplysning', 'usikker')),
  opprettet timestamptz not null default now(),
  constraint ulike_personer check (fra_person <> til_person),
  constraint unik_forbindelse unique (fra_person, til_person, type)
);

-- Familiehistorier kan knyttes til personer og dateres omtrentlig.
create table if not exists public.historier (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.personer(id) on delete cascade,
  skrevet_av uuid references auth.users(id) on delete set null,
  tittel text not null check (char_length(tittel) between 1 and 250),
  innhold text not null check (char_length(innhold) > 0),
  hendelsesdato date,
  hendelsesar smallint,
  kategori text not null default 'minne' check (kategori in ('minne', 'avisutklipp', 'brev', 'hendelse', 'annet')),
  kildehenvisning text,
  opprettet timestamptz not null default now(),
  oppdatert timestamptz not null default now()
);

-- Bilder, dokumenter og avisutklipp. Filinnholdet skal lagres i PRIVAT Storage-bøtte.
create table if not exists public.arkivfiler (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.personer(id) on delete set null,
  historie_id uuid references public.historier(id) on delete set null,
  lastet_opp_av uuid references auth.users(id) on delete set null,
  lagringssti text not null unique,
  filnavn text,
  beskrivelse text,
  kilde_eller_fotograf text,
  opprettet timestamptz not null default now(),
  constraint knyttet_til_noe check (person_id is not null or historie_id is not null)
);

create index if not exists slektsforbindelser_fra_idx on public.slektsforbindelser(fra_person);
create index if not exists slektsforbindelser_til_idx on public.slektsforbindelser(til_person);
create index if not exists historier_person_idx on public.historier(person_id);
create index if not exists arkivfiler_person_idx on public.arkivfiler(person_id);
create index if not exists arkivfiler_historie_idx on public.arkivfiler(historie_id);

-- SIKKERHET: ingen anonyme ELLER innloggede klienter får tilgang før
-- medlemskontroll og eksplisitte, testede policies opprettes i steg 2.
alter table public.familie_medlemmer enable row level security;
alter table public.personer enable row level security;
alter table public.slektsforbindelser enable row level security;
alter table public.historier enable row level security;
alter table public.arkivfiler enable row level security;

revoke all on public.familie_medlemmer from anon, authenticated;
revoke all on public.personer from anon, authenticated;
revoke all on public.slektsforbindelser from anon, authenticated;
revoke all on public.historier from anon, authenticated;
revoke all on public.arkivfiler from anon, authenticated;

-- Storage-bøtten er privat. Ingen lesing eller opplasting tillates
-- via nettleseren før tilgangsregler for godkjente medlemmer er testet.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'familiearkiv',
  'familiearkiv',
  false,
  15728640,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

commit;
