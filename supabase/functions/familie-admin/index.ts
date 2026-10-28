import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.0";

const allowedOrigin="https://moholdt123.github.io";
const cors=(origin:string|null)=>({
 "Access-Control-Allow-Origin":allowedOrigin,
 "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
 "Access-Control-Allow-Methods":"POST, OPTIONS",
 "Content-Type":"application/json; charset=utf-8",
 "Cache-Control":"no-store",
 "Vary":"Origin"
});
const send=(code:number,value:Record<string,unknown>,origin:string|null)=>
 new Response(JSON.stringify(value),{status:code,headers:cors(origin)});
const uuid=(s:unknown):s is string=>typeof s==="string"&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(s);
const trim=(v:unknown,max=250)=>typeof v==="string"?v.trim().slice(0,max+1):"";
const year=(v:unknown):number|null=>{
 if(v===null||v===undefined||v==="")return null;
 const x=Number(v);
 return Number.isSafeInteger(x)&&x>=1000&&x<=2026?x:NaN;
};
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("Origin");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=="POST")return send(405,{error:"Metoden er ikke tillatt."},origin);
 if(origin&&origin!==allowedOrigin)return send(403,{error:"Ukjent nettsted."},origin);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!key)return send(503,{error:"Serveren er ikke klar."},origin);
 const token=req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return send(401,{error:"Du må logge inn som administrator."},origin);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:userError}=await db.auth.getUser(token);
 if(userError||!user||user.is_anonymous)return send(401,{error:"Innloggingen må bekreftes på nytt."},origin);
 const {data:admin,error:adminError}=await db.from("familie_medlemmer").select("rolle,status")
  .eq("bruker_id",user.id).maybeSingle();
 if(adminError)return send(503,{error:"Kunne ikke kontrollere administratortilgang."},origin);
 if(admin?.rolle!=="administrator"||admin?.status!=="aktiv")return send(403,{error:"Bare en godkjent familieadministrator har tilgang."},origin);
 let body:Record<string,unknown>;
 try{const data=await req.json();if(!data||Array.isArray(data)||typeof data!=="object")throw Error("bad");body=data}
 catch{return send(400,{error:"Ugyldig forespørsel."},origin)}
 const log=async(action:string,target:string,desc:string)=>{
  await db.from("admin_endringslogg").insert({
   administrator:user.id,handling:action,maal:target,beskrivelse:desc.slice(0,400)
  });
 };
 try{
  if(body.action==="dashboard"){
   const [members,persons,connections,stories,files,history]=await Promise.all([
    db.from("familie_medlemmer").select("bruker_id,visningsnavn,rolle,status,opprettet").order("opprettet",{ascending:true}).limit(200),
    db.from("personer").select("id,navn,fodt_ar,dod_ar,kort_biografi,kildehenvisning,kjonn,lever").eq("lever",false).order("navn").limit(1500),
    db.from("slektsforbindelser").select("id,fra_person,til_person,type,sikkerhet,kildehenvisning").eq("type","forelder_barn").limit(5000),
    db.from("historier").select("id,person_id,tittel,signatur,opprettet").order("opprettet",{ascending:false}).limit(30),
    db.from("arkivfiler").select("id,person_id,filnavn,beskrivelse,opprettet").order("opprettet",{ascending:false}).limit(30),
    db.from("admin_endringslogg").select("handling,beskrivelse,opprettet").order("opprettet",{ascending:false}).limit(15)
   ]);
   const error=[members,persons,connections,stories,files,history].find(x=>x.error)?.error;
   if(error)return send(503,{error:"Kunne ikke hente administratoroversikten."},origin);
   return send(200,{ok:true,
    members:members.data,persons:persons.data,connections:connections.data,
    stories:stories.data,files:files.data,changes:history.data},origin);
  }
  if(body.action==="member_status"){
   if(!uuid(body.member_id)||!["aktiv","sperret","venter"].includes(String(body.status)))
    return send(400,{error:"Ugyldig medlemsvalg."},origin);
   if(body.member_id===user.id)return send(403,{error:"Du kan ikke sperre din egen administratorkonto."},origin);
   const {data:member,error:memberError}=await db.from("familie_medlemmer")
     .select("bruker_id,rolle,status").eq("bruker_id",body.member_id).maybeSingle();
   if(memberError||!member)return send(404,{error:"Fant ikke medlemmet."},origin);
   if(member.rolle!=="medlem")return send(403,{error:"Andre administratorer kan ikke endres her."},origin);
   const {data:updated,error}=await db.from("familie_medlemmer")
     .update({status:body.status}).eq("bruker_id",body.member_id).eq("rolle","medlem")
     .select("bruker_id,status").single();
   if(error||!updated)return send(503,{error:"Kunne ikke endre medlemmets tilgang."},origin);
   await log("medlem_status",updated.bruker_id,"Ny status: "+updated.status);
   return send(200,{ok:true,message:"Tilgangen er oppdatert."},origin);
  }
  if(body.action==="save_person"){
   const id=body.person_id;
   if(id!==undefined&&id!==null&&!uuid(id))return send(400,{error:"Ugyldig person-id."},origin);
   const name=trim(body.navn,250),born=year(body.fodt_ar),died=year(body.dod_ar);
   const bio=trim(body.kort_biografi,3500),source=trim(body.kildehenvisning,1200);
   const gender=body.kjonn===null||body.kjonn===undefined||body.kjonn===""?null:body.kjonn;
   if(name.length<3||name.length>250||Number.isNaN(born)||Number.isNaN(died)||
      (born!==null&&died!==null&&died<born)||
      bio.length>3500||source.length>1200||(gender!==null&&!["mann","kvinne"].includes(String(gender))))
    return send(400,{error:"Sjekk navn, årstall og opplysningene."},origin);
   const values={navn:name,fodt_ar:born,dod_ar:died,kjonn:gender,
    kort_biografi:bio||null,kildehenvisning:source||null,oppdatert:new Date().toISOString()};
   if(id){
    const {data:old,error:lookupError}=await db.from("personer")
      .select("id,lever").eq("id",id).maybeSingle();
    if(lookupError||!old||old.lever!==false)return send(403,{error:"Denne funksjonen kan bare endre avdøde personer."},origin);
    const {data:updated,error}=await db.from("personer").update(values).eq("id",id).eq("lever",false).select("id").single();
    if(error||!updated)return send(503,{error:"Kunne ikke lagre endringen."},origin);
    await log("person_endret",updated.id,"Historisk person oppdatert");
    return send(200,{ok:true,message:"Den historiske personen er oppdatert.",person_id:updated.id},origin);
   }
   if(died===null||source.length<6||body.confirm_deceased!==true)
    return send(400,{error:"Nye personer må være avdøde, ha dødsår og en kildehenvisning."},origin);
   const {data:added,error}=await db.from("personer")
     .insert({...values,lever:false,opprettet_av:user.id}).select("id").single();
   if(error||!added)return send(503,{error:"Kunne ikke opprette personen."},origin);
   await log("person_ny",added.id,"Avdød historisk person lagt til");
   return send(200,{ok:true,message:"Personen er lagt til i den historiske slekten.",person_id:added.id},origin);
  }
  if(body.action==="connection_add"){
   if(!uuid(body.parent_id)||!uuid(body.child_id)||body.parent_id===body.child_id)
    return send(400,{error:"Velg to forskjellige personer."},origin);
   const certainty=["familieopplysning","usikker"].includes(String(body.sikkerhet))?
      String(body.sikkerhet):"usikker";
   const citation=trim(body.kildehenvisning,1000);
   if(citation.length>1000)return send(400,{error:"Kildehenvisningen er for lang."},origin);
   const {data:nodes,error:nodeError}=await db.from("personer").select("id,lever")
      .in("id",[body.parent_id,body.child_id]);
   if(nodeError||nodes?.length!==2||nodes.some(p=>p.lever!==false))
    return send(403,{error:"Bare avdøde personer kan kobles i den historiske oversikten."},origin);
   const {data:existing,error:connectionsError}=await db.from("slektsforbindelser")
     .select("fra_person,til_person,type").eq("type","forelder_barn").limit(10000);
   if(connectionsError||!existing)return send(503,{error:"Kunne ikke kontrollere eksisterende familieforbindelser."},origin);
   if(existing.some(l=>l.fra_person===body.parent_id&&l.til_person===body.child_id))
    return send(409,{error:"Denne forbindelsen finnes allerede."},origin);
   const queue=[body.child_id],visited=new Set<string>();
   for(let i=0;i<queue.length;i++){
    const current=queue[i] as string;
    if(current===body.parent_id)return send(409,{error:"Denne forbindelsen ville laget en sirkel i slektstreet."},origin);
    if(visited.has(current))continue;
    visited.add(current);
    for(const l of existing)if(l.fra_person===current&&!visited.has(l.til_person))queue.push(l.til_person);
   }
   const {data:added,error}=await db.from("slektsforbindelser").insert({
     fra_person:body.parent_id,til_person:body.child_id,type:"forelder_barn",
     sikkerhet:certainty,kildehenvisning:citation||null
   }).select("id").single();
   if(error||!added)return send(503,{error:"Kunne ikke lagre familieforbindelsen."},origin);
   await log("slekt_koblet",added.id,"Historisk forelder/barn-forbindelse lagt til");
   return send(200,{ok:true,message:"Familieforbindelsen er lagret."},origin);
  }
  if(body.action==="connection_remove"){
   if(!uuid(body.connection_id)||body.confirm!==true)
    return send(400,{error:"Du må bekrefte hvilken forbindelsen som skal fjernes."},origin);
   const {data:removed,error}=await db.from("slektsforbindelser")
     .delete().eq("id",body.connection_id).eq("type","forelder_barn").select("id").maybeSingle();
   if(error||!removed)return send(404,{error:"Fant ikke forbindelsen."},origin);
   await log("slekt_fjernet",removed.id,"Historisk slektsforbindelse fjernet");
   return send(200,{ok:true,message:"Familieforbindelsen er fjernet."},origin);
  }
  return send(400,{error:"Ukjent administratorhandling."},origin);
 }catch(error){
   console.error("Admin action failed",error instanceof Error?error.message:String(error));
   return send(503,{error:"En feil oppstod. Ingen endring er bekreftet."},origin);
 }
});
