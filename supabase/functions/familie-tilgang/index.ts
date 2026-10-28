import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const allowedOrigin = "https://moholdt123.github.io";
const headers = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin === allowedOrigin ? allowedOrigin : allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
});
const reply = (status: number, obj: Record<string, unknown>, origin: string | null) =>
  new Response(JSON.stringify(obj), { status, headers: headers(origin) });
const normalize = (value: string) => value.toLowerCase().replace(/[\s-]/g, "").trim();
const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
function equalHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, {status:204,headers:headers(origin)});
  if (req.method !== "POST") return reply(405,{error:"Metoden er ikke tillatt."},origin);
  if (origin && origin !== allowedOrigin) return reply(403,{error:"Ukjent nettsted."},origin);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return reply(503,{error:"Serveren mangler konfigurasjon."},origin);
  const bearer = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return reply(401,{error:"Logg inn med e-post først."},origin);
  const supa = createClient(url, serviceKey, {auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:userError} = await supa.auth.getUser(bearer);
  if (userError || !user || user.is_anonymous) return reply(401,{error:"Innloggingen må bekreftes."},origin);
  const {data:old,error:oldError}=await supa.from("familie_medlemmer").select("status,rolle").eq("bruker_id",user.id).maybeSingle();
  if(oldError) return reply(503,{error:"Kunne ikke kontrollere medlemskap."},origin);
  if(old?.status==="sperret") return reply(403,{error:"Tilgangen er sperret. Kontakt familieadministrator."},origin);
  if(old?.status==="aktiv") return reply(200,{ok:true,alreadyMember:true},origin);
  let body:unknown;
  try {body=await req.json()} catch {return reply(400,{error:"Ugyldig forespørsel."},origin)}
  if(!body || typeof body!=="object") return reply(400,{error:"Ugyldig forespørsel."},origin);
  const raw=body as Record<string,unknown>;
  const code=typeof raw.code==="string"?normalize(raw.code):"";
  const name=typeof raw.name==="string"?raw.name.trim().replace(/\s+/g," "):"";
  if(!/^[0-9a-f]{20}$/.test(code)||name.length<2||name.length>100)
    return reply(400,{error:"Skriv navnet ditt og den gyldige familiekoden."},origin);

  const now=Date.now(),hourMs=60*60*1000;
  const {data:attempt,error:attemptError}=await supa.from("familie_invite_attempts").select("failures,window_start").eq("bruker_id",user.id).maybeSingle();
  if(attemptError) return reply(503,{error:"Kunne ikke kontrollere forsøk."},origin);
  const inWindow=attempt && now-Date.parse(attempt.window_start)<hourMs;
  if(inWindow && attempt.failures>=6) return reply(429,{error:"For mange forsøk. Prøv igjen om en time."},origin);
  const {data:invites,error:inviteError}=await supa.from("familie_invites").select("code_hash").eq("enabled",true);
  if(inviteError || !invites) return reply(503,{error:"Invitasjonskoden kunne ikke kontrolleres."},origin);
  const candidate=toHex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code)));
  const valid=invites.some((row)=>equalHash(row.code_hash,candidate));
  if(!valid){
    await supa.from("familie_invite_attempts").upsert({
      bruker_id:user.id, failures:inWindow?attempt.failures+1:1, window_start:inWindow?attempt.window_start:new Date().toISOString()
    },{onConflict:"bruker_id"});
    return reply(403,{error:"Familiekoden stemmer ikke."},origin);
  }
  const {error:joinError}=await supa.from("familie_medlemmer").upsert({
    bruker_id:user.id,visningsnavn:name,rolle:"medlem",status:"aktiv"
  },{onConflict:"bruker_id"});
  if(joinError) return reply(503,{error:"Kunne ikke aktivere medlemskap."},origin);
  await supa.from("familie_invite_attempts").delete().eq("bruker_id",user.id);
  return reply(200,{ok:true,member:true},origin);
});
