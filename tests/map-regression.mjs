// Run: node tests/map-regression.mjs. Synthetic data only; no API requests.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class Element {
 constructor(tag='div') {this.tag=tag;this.children=[];this.attrs={};this.style={};this.events={};this.value='';this.clientWidth=390;this.clientHeight=640;this.scrollLeft=0;this.scrollTop=0;this.dataset={};this.hidden=false;const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,on)=>{if(on??!classes.has(x))classes.add(x);else classes.delete(x)}};}
 setAttribute(k,v){this.attrs[k]=String(v)}
 getAttribute(k){return this.attrs[k]??null}
 append(...nodes){for(const n of nodes){if(n.parent)n.parent.children=n.parent.children.filter(c=>c!==n);n.parent=this;this.children.push(n)}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 querySelectorAll(selector){const all=this.children.flatMap(c=>[c,...c.querySelectorAll(selector)]);return all.filter(c=>selector==='svg'?c.tag==='svg':selector==='path[data-from]'?c.tag==='path'&&c.attrs['data-from']:false)}
 querySelector(s){return this.querySelectorAll(s)[0]||null}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn)}
 focus(){} scrollIntoView(){} setPointerCapture(){}
 getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight}}
}
function load(file){
 const html=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
 let code=html.match(/<script(?: type="module")?>([\s\S]*?)<\/script>/)[1];
 code=code.replace(/^import .*;$/m,'').replace(/^const db=createClient.*;$/m,'const db=mockDB;');
 if(file==='familiekode.html')code=code.slice(0,code.lastIndexOf('(async()=>{'));
 else code=code.slice(0,code.lastIndexOf('db.auth.onAuthStateChange'));
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id)};
 const frames=new Map();let nextFrame=0;
 const context=vm.createContext({console,URLSearchParams,Date,Map,Set,Math,Number,String,Boolean,JSON,Array,Promise,
  document:{getElementById:get,createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),createDocumentFragment:()=>new Element(),querySelectorAll:()=>[],body:new Element(),addEventListener(){}},
  window:{addEventListener(){},matchMedia:()=>({matches:true})},location:{hash:'',assign(){},replace(){}},
  localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null},mockDB:{},
  requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame},cancelAnimationFrame:id=>frames.delete(id)});
 vm.runInContext(code,context,{filename:file});
 return {get,html,context,run:s=>vm.runInContext(s,context),flush(){for(let i=0;frames.size&&i<10;i++){const work=[...frames.values()];frames.clear();work.forEach(f=>f())}}};
}
for(const file of ['familiekode.html','slektskart.html']){
 const app=load(file),{get,run}=app;
 const historical=Array.from({length:92},(_,i)=>({id:String(i),navn:'Historisk test '+i,fodt_ar:1700+i}));
 app.context.history=historical;
 run('rebuildGraph(history,[])');
 if(file==='familiekode.html')run('visitorName="Testbesøkende";openWholeHistoricalMap()');
 else run('focused="h:0";mode="archive";render();setImmersive(true)');
 app.flush();
 assert.equal(run('lastMapLayout.ids.size'),92,'archive renders every node without a selected root');
 assert.ok(run('chart.scale')>=.85,file+' opens at readable zoom');
 assert.ok(get('treePort').querySelector('svg').attrs.width>390,'explicit SVG extent');
 const coords=run('lastMapLayout.loc.get("h:0")');
 const scale=run('chart.scale'),w=run('lastMapLayout.nodeW'),h=run('lastMapLayout.nodeH');
 assert.ok(coords.x*scale+w*scale>get('treePort').scrollLeft,'start node in viewport horizontally');
 assert.ok(coords.y*scale+h*scale>get('treePort').scrollTop,'start node in viewport vertically');
 get('treePort').scrollLeft=1200;get('treePort').scrollTop=3000;
 const before=run('chart.scale');get('treePort').clientHeight=520;
 run('preserveViewport()');app.flush();
 assert.equal(run('chart.scale'),before,'keyboard/rotation does not fit whole tree');
 assert.equal(get('treePort').scrollTop,3060,'preserve centre on resize');
 run('setZoom(.00001)');assert.equal(run('chart.scale'),.35,'cannot collapse to dot');
 run('setZoom(NaN)');assert.equal(run('chart.scale'),.35,'reject nonfinite zoom');
 get('treePort').clientWidth=0;run('focusReadable("h:0");fit()');
 assert.equal(run('chart.scale'),.35,'ignore hidden dimensions');
 get('treePort').clientWidth=390;run('focusReadable("h:0")');
 assert.ok(run('chart.scale')>=.85,'recover from hidden viewport');
 const touch=(x,y)=>({clientX:x,clientY:y});
 for(const fn of get('treePort').events.touchstart)fn({touches:[touch(100,100),touch(200,100)]});
 for(const fn of get('treePort').events.touchmove)fn({touches:[touch(80,100),touch(220,100)],preventDefault(){}});
 assert.ok(run('chart.scale')>1.1,'two-finger pinch increases zoom');
 for(const fn of get('treePort').events.touchend)fn({touches:[touch(80,100)]});
 assert.equal(run('pinch'),null);assert.equal(run('drag.x'),80,'pan continues after pinch');
 assert.ok(!app.html.includes('resize",()=>{if(people.size)fit()'),'no automatic overview on resize');
 console.log('PASS',file,'initial framing, hidden viewport, resize, zoom, pinch');
}
const personal=load('slektskart.html');
personal.run(`rebuildGraph([{id:'ancestor',navn:'Avdød test'}],[],{navn:'Bekreftet konto'},[],[],[],[], 'account',[],[{barn_bruker_id:'account',forelder_rolle:'mor',forelder_bruker_id:'no-consent'}]);focused=mine;mode='family';render();setImmersive(true)`);
personal.flush();
assert.equal(personal.run('mine'),'me');
assert.ok(personal.run('!people.has("v:no-consent")'),'no name or person node without consent');
assert.ok(personal.run('!reachable(mine,"ancestors").has("h:ancestor")'),'no guessed historical relationship');
assert.equal(personal.run('generationLimit'),'2','fullscreen retains parent/grandparent filter');
personal.run('setPersonalSearch(true)');assert.equal(personal.get('personalSidebar').hidden,false);
personal.run('setPersonalSearch(false)');assert.equal(personal.get('personalSidebar').hidden,true);
console.log('PASS personal account anchor, consent, no inferred links, sidebar');
const guest=load('familiekode.html');
guest.run(`rebuildGraph([{id:'a',navn:'Test Moholdt'}],[]);visitorName='Kristian Moholdt'`);
assert.equal(guest.run('mine'),null,'typed name grants no identity');
assert.equal(guest.run('historicalNameClue(visitorName).id'),'h:a','historical suggestion only');
console.log('PASS guest name is a suggestion, never authenticated identity');

// Exercise the real asynchronous start flow with missing own profile and denied access.
for(const status of ['aktiv','venter','signed-out']){
 const app=load('slektskart.html'),tables=[];
 app.context.mockDB.auth={getUser:async()=>({data:{user:status==='signed-out'?null:{id:'verified-account'}},error:null})};
 app.context.mockDB.from=table=>{
  tables.push(table);
  const q={select(){return q},eq(){return q},order(){return q},maybeSingle(){return q},
   then(resolve,reject){return Promise.resolve({data:table==='familie_medlemmer'?{status,rolle:'medlem',visningsnavn:'Bekreftet medlem'}:table==='levende_profiler'?null:[],error:null}).then(resolve,reject)}};
  return q;
 };
 await app.run('start()');app.flush();
 if(status==='aktiv'){
  assert.equal(app.run('mine'),'me');
  assert.equal(app.run('people.get(mine).name'),'Bekreftet medlem','use verified account, not entered visitor name');
  assert.equal(app.run('focused'), 'me');
  assert.equal(app.run('immersive'),true);
  assert.equal(app.run('generationLimit'),'2');
 }else{
  assert.equal(app.run('people.size'),0);
  assert.ok(tables.every(t=>t==='familie_medlemmer'),'no genealogy requests before active membership');
 }
}
console.log('PASS authenticated start without profile; inactive/signed-out access denied');

const relatives=load('slektskart.html');
relatives.run(`rebuildGraph([],[],{navn:'Testkonto'},[],[],[
 {node_key:'sibling',navn:'Secret sibling',livsstatus:'levende',forelder1_key:'p:mor',forelder2_key:'p:far'},
 {node_key:'aunt',navn:'Secret aunt',livsstatus:'ukjent',forelder1_key:'p:farmor',forelder2_key:'p:farfar'},
 {node_key:'cousin',navn:'Secret cousin',livsstatus:'ukjent',forelder1_key:'x:aunt',kilde:'USIKKER: Test source'},
],[],'test-account');focused=mine;mode='family';render()`);
for(const id of ['x:sibling','x:aunt','x:cousin']){
 assert.ok(relatives.run(`lastMapLayout.ids.has('${id}')`),'collateral relative visible in start map');
 assert.equal(relatives.run(`people.get('${id}').name`),'Privat familiemedlem');
}
assert.equal(relatives.run('lastMapLayout.loc.get("me").y'),relatives.run('lastMapLayout.loc.get("x:sibling").y'));
const positions=relatives.run('[...lastMapLayout.loc.values()]');
for(let i=0;i<positions.length;i++)for(let j=0;j<i;j++)assert.ok(positions[i].y!==positions[j].y||Math.abs(positions[i].x-positions[j].x)>=194,'no overlapping cards');
assert.ok(relatives.run('links.some(l=>l.to==="x:cousin"&&l.confidence==="usikker")'));
console.log('PASS siblings, aunts and cousins in family view; names hidden; no card overlaps; uncertain source marked');
