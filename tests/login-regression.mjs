import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync(new URL('../supabase/functions/familie-medlemsforesporsel/index.ts',import.meta.url),'utf8');
const code=stripTypeScriptTypes(source.replace(/^import .*;\n/gm,'').replace('export async function','async function').split('Deno.serve')[0]);
const context=vm.createContext({Response});vm.runInContext(code,context);
async function request({member=null,user={id:'verified-id',email_confirmed_at:'today'},body={name:'Test Person',status:'aktiv',rolle:'administrator',bruker_id:'someone-else'},token=true}={}){
 const writes=[];
 const db={auth:{getUser:async()=>({data:{user}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:member})})}),insert:async row=>{writes.push(row);return {error:null}}})};
 const req=new Request('https://example.test',{method:'POST',headers:token?{Authorization:'Bearer test'}:{},body:JSON.stringify(body)});
 const response=await context.handleRequest(req,db);return {status:response.status,body:await response.json(),writes};
}
let result=await request();assert.equal(result.status,200);assert.equal(result.writes[0].status,'venter');assert.equal(result.writes[0].rolle,'medlem');assert.equal(result.writes[0].bruker_id,'verified-id');
for(const status of ['aktiv','venter','sperret']){result=await request({member:{status}});assert.equal(result.writes.length,0);assert.equal(result.status,status==='sperret'?403:200);}
for(const user of [null,{id:'x',is_anonymous:true},{id:'x'}])assert.equal((await request({user})).status,401);
assert.equal((await request({token:false})).status,401);
assert.equal((await request({body:{name:' '}})).status,400);
console.log('PASS verified identity only, pending membership, no privilege injection, blocked account and repeat request handling');
const html=fs.readFileSync(new URL('../familie.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/m,'');
new vm.Script(script);
const state=script.slice(script.indexOf('async function updateState(){'),script.indexOf('$("emailForm").addEventListener'));
// Extract just updateState, before Google setup.
const updateCode=state.split('// Google is offered')[0];
async function route(member,choice,hash=''){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id)};
 let destination=null;
 const ctx=vm.createContext({URLSearchParams,user:null,profile:null,db:{auth:{getSession:async()=>({data:{session:{user:{id:'me',email:'test@example.test'}}}})},from:table=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:table==='familie_medlemmer'?member:choice})})})})},location:{hash,search:'',replace:v=>destination=v},$:get,show(){},hide(){},notice(){}});
 vm.runInContext(updateCode,ctx);await ctx.updateState();return {destination,elements};
}
assert.equal((await route({status:'aktiv'},{bruker_id:'me'})).destination,'./slektskart.html');
assert.equal((await route({status:'venter'},null)).destination,null);
assert.equal((await route({status:'sperret'},null)).destination,null);
assert.equal((await route(null,null)).destination,null);
assert.ok(!html.includes('id="familyCode"'));
assert.ok(html.includes('settings.external?.google!==true'));
assert.ok(!html.match(/id="shareLivingToggle"[^>]*checked/));
console.log('PASS saved login routes to tree, waiting/blocked users stay outside, Google gated, consent not preselected');

const initCode=script.slice(script.indexOf('async function initializeFamilyPage(){'),script.indexOf('initializeFamilyPage().catch'));
for(const role of ['administrator','medlem']){
 let isolated=false,updated=false,redirect=null;
 const events=[];
 const actualDB={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{rolle:role,status:'aktiv'}})})})})};
 const ctx=vm.createContext({URLSearchParams,db:actualDB,URL:'https://example.test',PUBLIC_KEY:'public',location:{search:'?preview=guest',replace:p=>redirect=p},document:{addEventListener:(...args)=>events.push(args)},createClient:(url,key,options)=>{assert.equal(options.auth.persistSession,false);assert.equal(options.auth.detectSessionInUrl,false);assert.equal(options.auth.autoRefreshToken,false);isolated=true;return {}},updateState:async()=>updated=true,notice(){}});
 vm.runInContext(initCode,ctx);await ctx.initializeFamilyPage();
 assert.equal(isolated,role==='administrator');assert.equal(updated,role==='administrator');
 if(role==='administrator'){
  const submit=events.find(x=>x[0]==='submit');assert.equal(submit[2],true);
  let prevented=false,stopped=false;submit[1]({preventDefault:()=>prevented=true,stopImmediatePropagation:()=>stopped=true});assert.ok(prevented&&stopped);
 }else assert.equal(redirect,'./familie.html');
}
console.log('PASS guest preview uses isolated auth, blocks submissions, requires active administrator');
