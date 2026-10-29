import {createClient} from "npm:@supabase/supabase-js@2.57.0";

// Authentication is verified here; membership is always pending, never self-approved.
export async function handleRequest(req: Request, db: any) {
 const origin=req.headers.get("Origin");
 const headers={"Access-Control-Allow-Origin":"https://moholdt123.github.io","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
 const reply=(status: number, body: unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&origin!=="https://moholdt123.github.io")return reply(403,{error:"Ukjent nettsted."});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply(405,{error:"Ugyldig metode."});
 const token=req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
 if(!token)return reply(401,{error:"Logg inn først."});
 try{
  const {data:{user},error}=await db.auth.getUser(token);
  if(error||!user||user.is_anonymous||!user.email_confirmed_at)return reply(401,{error:"Bekreft innloggingen først."});
  let body;
  try{body=await req.json();}catch{return reply(400,{error:"Ugyldig forespørsel."});}
  const name=typeof body?.name==="string"?body.name.trim().replace(/\s+/g," "):"";
  if(name.length<2||name.length>100)return reply(400,{error:"Skriv navnet ditt (2–100 tegn)."});
  const {data:member,error:lookupError}=await db.from("familie_medlemmer").select("status").eq("bruker_id",user.id).maybeSingle();
  if(lookupError)throw lookupError;
  if(member?.status==="sperret")return reply(403,{error:"Kontakt familieadministrator."});
  if(member)return reply(200,{ok:true,status:member.status});
  const {error:saveError}=await db.from("familie_medlemmer").insert({bruker_id:user.id,visningsnavn:name,rolle:"medlem",status:"venter"});
  if(saveError){if(saveError.code==="23505")return reply(200,{ok:true,status:"venter"});throw saveError;}
  return reply(200,{ok:true,status:"venter"});
 }catch{return reply(503,{error:"Kunne ikke lagre forespørselen. Prøv igjen."});}
}
Deno.serve((req: Request)=>{
 const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
 return handleRequest(req,db);
});
