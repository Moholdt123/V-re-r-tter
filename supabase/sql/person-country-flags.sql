-- Applied and verified 2026-11-07. Existing access rules retained.
ALTER TABLE public.personer ADD COLUMN IF NOT EXISTS landtilknytninger jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(landtilknytninger)='array');
COMMENT ON COLUMN public.personer.landtilknytninger IS 'Kildebelagte landtilknytninger: kode (ISO alpha-2), type (fodt/bosted/utvandret/statsborgerskap), kilde, sikkerhet. Tom liste betyr ukjent. Ikke utled statsborgerskap av bosted.';
CREATE OR REPLACE FUNCTION tree_internal.project_family_tree(view_mode text DEFAULT 'auto'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 uid uuid:=auth.uid(); member_role text; audience text:='guest'; result jsonb;
begin
 select rolle into member_role from public.familie_medlemmer where bruker_id=uid and status='aktiv';
 if member_role is not null and view_mode<>'guest' then
  audience:=case when member_role='administrator' and view_mode<>'member' then 'admin' else 'member' end;
 end if;
 with source as (
  select n.id,n.historical_id,n.owner_id,n.matched_user_id,h.landtilknytninger,
   coalesce(h.navn,s.navn,r.navn,lp.navn,m.visningsnavn) as full_name,
   coalesce(h.fodt_ar,s.fodt_ar) as born,coalesce(h.dod_ar,s.dod_ar) as died,
   coalesce(h.lever=false,s.livsstatus='avdod',false) as deceased,
   case when consent.synlig_for_familien and cm.status='aktiv' then consent.navn end as consent_name,
   n.matched_user_id=uid and audience<>'guest' and view_mode<>'member' as is_self
  from public.tree_projection_nodes n
  left join public.personer h on h.id=n.historical_id
  left join public.private_slekt_sidegrener s on s.bruker_id=n.owner_id and 'x:'||s.node_key=n.source_key
  left join public.familiegren_utkast r on r.bruker_id=n.owner_id and 'p:'||r.relasjon=n.source_key
  left join public.levende_profiler lp on lp.bruker_id=n.matched_user_id
  left join public.familie_medlemmer m on m.bruker_id=n.matched_user_id
  left join public.familie_synlige_profiler consent on consent.bruker_id=n.matched_user_id
  left join public.familie_medlemmer cm on cm.bruker_id=consent.bruker_id
 ), filtered as (
  select *,case
   when audience='admin' or is_self then full_name
   when audience='member' and consent_name is not null then consent_name
   when deceased and (audience<>'guest' or born < extract(year from current_date)::int-100) then full_name
   else null end as visible_name from source
 )
 select jsonb_build_object('audience',audience,'nodes',coalesce((select jsonb_agg(jsonb_build_object(
  'id','g:'||id,'name',coalesce(visible_name,'Privat familiemedlem'),
  'kind',case when is_self then 'self' when visible_name is null then 'anonymous' when historical_id is not null then 'historical' else 'private' end,
  'born',case when visible_name is not null and (deceased or audience='admin') then born end,
  'died',case when visible_name is not null and deceased then died end,
  'countries',case when visible_name is not null and deceased then coalesce(landtilknytninger,'[]'::jsonb) else '[]'::jsonb end,
  'is_self',coalesce(is_self,false))) from filtered),'[]'::jsonb),
  'edges',coalesce((select jsonb_agg(jsonb_build_object('from','g:'||parent_id,'to','g:'||child_id,'confidence',confidence)) from public.tree_projection_edges),'[]'::jsonb)) into result;
 return result;
end $function$


BEGIN;
INSERT INTO personer (legacy_id,navn,fodt_ar,fodt_dato,kjonn,kort_biografi,kildehenvisning,lever,landtilknytninger) VALUES ('kristian-thomassen-johnsrud-1873','Kristian Thomassen Johnsrud',1873,'1873-12-14','mann','Gårdsarbeider, født i Norderhov. Far til Anna og Kari ifølge folketellingen 1920.','https://www.digitalarkivet.no/census/person/pf01073776001273',false,'[{"kode":"NO","type":"fodt","kilde":"https://www.digitalarkivet.no/census/person/pf01073776001273","sikkerhet":"dokumentert"}]'::jsonb) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO personer (legacy_id,navn,fodt_ar,fodt_dato,kjonn,kort_biografi,kildehenvisning,lever,landtilknytninger) VALUES ('orlaug-thomassen-johnsrud-1881','Orlaug Thomassen Johnsrud',1881,'1881-12-01','kvinne','Født i Gol, Hallingdal. Mor i husstanden på Granmoen 1920. Pikenavn ikke kontrollert.','https://www.digitalarkivet.no/census/person/pf01073776001273',false,'[{"kode":"NO","type":"fodt","kilde":"https://www.digitalarkivet.no/census/person/pf01073776001273","sikkerhet":"dokumentert"}]'::jsonb) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO personer (legacy_id,navn,fodt_ar,fodt_dato,kjonn,kort_biografi,kildehenvisning,lever,landtilknytninger) VALUES ('kari-johnsrud-upton-1918','Kari Johnsrud Upton',1918,'1918-03-01','kvinne','Kari Johnsrud er registrert på Granmoen i 1920. Familien identifiserer henne som Kari Upton i Stratton, Ontario, Canada. Drev J.F. Upton-stasjonen og solgte i 1988. Identiteten på tvers av landene støttes av familieopplysning; fødsels- eller vigselsdokument i Canada gjenstår. Opplyst avdød av familien; dødsdato ukjent.','https://www.digitalarkivet.no/census/person/pf01073776001273',false,'[{"kode":"NO","type":"fodt","kilde":"https://www.digitalarkivet.no/census/person/pf01073776001273","sikkerhet":"dokumentert"},{"kode":"CA","type":"bosted","kilde":"https://fftimes.com/features/obituaries/shawn-james-mcdonald/","sikkerhet":"familieopplysning"}]'::jsonb) ON CONFLICT (legacy_id) DO NOTHING;
INSERT INTO slektsforbindelser (fra_person,til_person,type,sikkerhet,kildehenvisning) SELECT p.id,c.id,'forelder_barn','dokumentert','https://www.digitalarkivet.no/census/person/pf01073776001273' FROM personer p,personer c WHERE p.legacy_id='kristian-thomassen-johnsrud-1873' AND c.legacy_id='anna_jonsrud' ON CONFLICT DO NOTHING;
INSERT INTO slektsforbindelser (fra_person,til_person,type,sikkerhet,kildehenvisning) SELECT p.id,c.id,'forelder_barn','dokumentert','https://www.digitalarkivet.no/census/person/pf01073776001273' FROM personer p,personer c WHERE p.legacy_id='kristian-thomassen-johnsrud-1873' AND c.legacy_id='kari-johnsrud-upton-1918' ON CONFLICT DO NOTHING;
INSERT INTO slektsforbindelser (fra_person,til_person,type,sikkerhet,kildehenvisning) SELECT p.id,c.id,'forelder_barn','dokumentert','https://www.digitalarkivet.no/census/person/pf01073776001273' FROM personer p,personer c WHERE p.legacy_id='orlaug-thomassen-johnsrud-1881' AND c.legacy_id='anna_jonsrud' ON CONFLICT DO NOTHING;
INSERT INTO slektsforbindelser (fra_person,til_person,type,sikkerhet,kildehenvisning) SELECT p.id,c.id,'forelder_barn','dokumentert','https://www.digitalarkivet.no/census/person/pf01073776001273' FROM personer p,personer c WHERE p.legacy_id='orlaug-thomassen-johnsrud-1881' AND c.legacy_id='kari-johnsrud-upton-1918' ON CONFLICT DO NOTHING;
UPDATE personer SET landtilknytninger='[{"kode":"NO","type":"fodt","kilde":"https://www.digitalarkivet.no/census/person/pf01073776001273","sikkerhet":"dokumentert"}]'::jsonb WHERE legacy_id IN ('anna_jonsrud') AND landtilknytninger='[]'::jsonb;
UPDATE personer SET landtilknytninger='[{"kode":"NO","type":"fodt","kilde":"https://www.digitalarkivet.no/census/person/pf01073830007867","sikkerhet":"dokumentert"}]'::jsonb WHERE legacy_id IN ('sigbjorn-herman-nilsen-1902','anna-sofie-nilsen-1880','gustav-adolf-nilsen-1879') AND landtilknytninger='[]'::jsonb;
UPDATE personer SET landtilknytninger='[{"kode":"NO","type":"fodt","kilde":"https://www.digitalarkivet.no/census/person/pf01036479001616","sikkerhet":"dokumentert"}]'::jsonb WHERE legacy_id IN ('ester-otilie-bommen-1909','olaf-andersen-bommen-1879','ingeborg-bommen-1873') AND landtilknytninger='[]'::jsonb;
INSERT INTO tree_projection_nodes(namespace,source_key,historical_id) SELECT 'history','h:'||id,id FROM personer ON CONFLICT(namespace,source_key) DO NOTHING;
INSERT INTO tree_projection_edges(parent_id,child_id,confidence) SELECT p.id,c.id,s.sikkerhet FROM slektsforbindelser s JOIN tree_projection_nodes p ON p.historical_id=s.fra_person JOIN tree_projection_nodes c ON c.historical_id=s.til_person WHERE s.type='forelder_barn' ON CONFLICT DO NOTHING;
COMMIT;