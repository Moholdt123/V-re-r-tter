-- The source mapping is private. Only the explicit, audience-filtered RPC is public.
create table if not exists public.tree_projection_nodes (
 id uuid primary key default gen_random_uuid(),
 namespace text not null, source_key text not null,
 owner_id uuid, historical_id uuid references public.personer(id),
 matched_user_id uuid references auth.users(id),
 unique(namespace,source_key)
);
create table if not exists public.tree_projection_edges (
 parent_id uuid references public.tree_projection_nodes(id),
 child_id uuid references public.tree_projection_nodes(id),
 confidence text not null default 'familieopplysning',
 primary key(parent_id,child_id),check(parent_id<>child_id)
);
alter table public.tree_projection_nodes enable row level security;
alter table public.tree_projection_edges enable row level security;
revoke all on public.tree_projection_nodes,public.tree_projection_edges from public,anon,authenticated;

insert into public.tree_projection_nodes(namespace,source_key,historical_id)
select 'history','h:'||id,id from public.personer on conflict do nothing;
insert into public.tree_projection_nodes(namespace,source_key,owner_id,matched_user_id)
select m.bruker_id::text,'me',m.bruker_id,m.bruker_id from public.familie_medlemmer m
where m.rolle='administrator' and m.status='aktiv' on conflict do nothing;
insert into public.tree_projection_nodes(namespace,source_key,owner_id)
select u.bruker_id::text,'p:'||u.relasjon,u.bruker_id from public.familiegren_utkast u
join public.familie_medlemmer m using(bruker_id) where m.rolle='administrator' and m.status='aktiv'
and not exists(select 1 from public.familiegren_historiske_koblinger b where b.bruker_id=u.bruker_id and b.relasjon=u.relasjon and b.kobling='samme_person') on conflict do nothing;
insert into public.tree_projection_nodes(namespace,source_key,owner_id)
select p.bruker_id::text,'x:'||p.node_key,p.bruker_id from public.private_slekt_sidegrener p
join public.familie_medlemmer m using(bruker_id) where m.rolle='administrator' and m.status='aktiv' on conflict do nothing;

-- Resolve private role aliases to existing historical people, never duplicate them.
create temporary table tree_import_keys as
select namespace,source_key,id from public.tree_projection_nodes
union all
select b.bruker_id::text,'p:'||b.relasjon,n.id from public.familiegren_historiske_koblinger b
join public.tree_projection_nodes n on n.historical_id=b.historisk_person_id
where b.kobling='samme_person';
insert into public.tree_projection_edges(parent_id,child_id,confidence)
select p.id,c.id,coalesce(r.sikkerhet,'familieopplysning') from public.slektsforbindelser r
join public.tree_projection_nodes p on p.historical_id=r.fra_person
join public.tree_projection_nodes c on c.historical_id=r.til_person
where r.type='forelder_barn' and p.id<>c.id on conflict do nothing;
insert into public.tree_projection_edges(parent_id,child_id)
select p.id,c.id from public.familie_medlemmer m
cross join (values ('p:mor','me'),('p:far','me'),('p:mormor','p:mor'),('p:morfar','p:mor'),('p:farmor','p:far'),('p:farfar','p:far')) v(parent,child)
join tree_import_keys p on p.namespace=m.bruker_id::text and p.source_key=v.parent
join tree_import_keys c on c.namespace=m.bruker_id::text and c.source_key=v.child
where m.rolle='administrator' and m.status='aktiv' and p.id<>c.id on conflict do nothing;
insert into public.tree_projection_edges(parent_id,child_id)
select p.id,c.id from public.familiegren_historiske_koblinger b
join public.tree_projection_nodes p on p.historical_id=b.historisk_person_id
join tree_import_keys c on c.namespace=b.bruker_id::text and c.source_key='p:'||b.relasjon
where b.kobling='forelder' and p.id<>c.id on conflict do nothing;
insert into public.tree_projection_edges(parent_id,child_id,confidence)
select p.id,c.id,case when s.kilde like '%USIKKER:%' then 'usikker' else 'familieopplysning' end
from public.private_slekt_sidegrener s cross join lateral (values(s.forelder1_key),(s.forelder2_key)) v(k)
join tree_import_keys p on p.source_key=v.k and p.namespace=case when v.k like 'h:%' then 'history' else s.bruker_id::text end
join tree_import_keys c on c.namespace=s.bruker_id::text and c.source_key='x:'||s.node_key
where p.id<>c.id on conflict do nothing;
drop table tree_import_keys;

create schema if not exists tree_internal;
revoke all on schema tree_internal from public;
grant usage on schema tree_internal to anon,authenticated;
create or replace function tree_internal.project_family_tree(view_mode text default 'auto') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); member_role text; audience text:='guest'; result jsonb;
begin
 select rolle into member_role from public.familie_medlemmer where bruker_id=uid and status='aktiv';
 if member_role is not null and view_mode<>'guest' then
  audience:=case when member_role='administrator' and view_mode<>'member' then 'admin' else 'member' end;
 end if;
 with source as (
  select n.id,n.historical_id,n.owner_id,n.matched_user_id,
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
  'is_self',coalesce(is_self,false))) from filtered),'[]'::jsonb),
  'edges',coalesce((select jsonb_agg(jsonb_build_object('from','g:'||parent_id,'to','g:'||child_id,'confidence',confidence)) from public.tree_projection_edges),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function tree_internal.project_family_tree(text) from public;
grant execute on function tree_internal.project_family_tree(text) to anon,authenticated;
create or replace function public.get_family_tree(view_mode text default 'auto') returns jsonb
language sql stable security invoker set search_path='' as $body$
 select tree_internal.project_family_tree(view_mode);
$body$;
revoke all on function public.get_family_tree(text) from public;
grant execute on function public.get_family_tree(text) to anon,authenticated;
