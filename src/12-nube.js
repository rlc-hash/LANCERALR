/* ==================== Nube: datos compartidos entre dispositivos (Supabase) ==================== */
/* Cada navegador guarda su copia; con la nube conectada, todos escriben y leen del mismo lugar. */
const NUBE = Object.assign({url:"",key:"",on:false,lastS:0,dev:Math.random().toString(36).slice(2,8),estado:"off",err:"",at:0,every:5000}, store.get("alr_nube_v1")||{});
const NH = {}, NTOMB = [];
let nbusy=false, ndeb=null;
const COLS = {ord:"folio", cli:"id", fac:"id", via:"id", rem:"folio"};
const NUBE_SQL = `create table if not exists alr_items(
  id text primary key, kind text not null, data jsonb not null,
  u bigint not null default 0, s bigint not null default 0);
create index if not exists alr_items_s on alr_items(s);
create or replace function alr_touch() returns trigger language plpgsql as $$
begin new.s := (extract(epoch from clock_timestamp())*1000000)::bigint; return new; end $$;
drop trigger if exists alr_touch on alr_items;
create trigger alr_touch before insert or update on alr_items for each row execute function alr_touch();
create table if not exists alr_seq(k text primary key, v bigint not null);
create or replace function next_seq(p_k text, p_start bigint) returns bigint language plpgsql as $$
declare r bigint; begin
  insert into alr_seq(k,v) values (p_k,p_start)
  on conflict (k) do update set v = alr_seq.v + 1 returning v into r;
  return r; end $$;
alter table alr_items enable row level security;
alter table alr_seq enable row level security;
create policy "alr_items_todo" on alr_items for all using (true) with check (true);
create policy "alr_seq_todo" on alr_seq for all using (true) with check (true);`;

function nubeSave(){ store.set("alr_nube_v1",{url:NUBE.url,key:NUBE.key,on:NUBE.on,lastS:NUBE.lastS,dev:NUBE.dev}); }
function nubeOn(){ return !!(NUBE.on && NUBE.url && NUBE.key); }
function nubeBase(){ return NUBE.url.replace(/\/+$/,"")+"/rest/v1"; }
function nubeHdr(extra){ return {apikey:NUBE.key, Authorization:"Bearer "+NUBE.key, "Content-Type":"application/json", ...(extra||{})}; }
function hashStr(s){ let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return h+":"+s.length; }
function dataHash(d){ return hashStr(JSON.stringify(d,(k,v)=>k==="_u"?undefined:v)); }
function saveLocalOnly(){ store.set(KEY_DB,DB); store.set(KEY_CFG,CFG); }
function b64u(s){ return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function unb64u(s){ s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4) s+="="; return decodeURIComponent(escape(atob(s))); }

function nubeLocal(){
  const out=[];
  Object.entries(COLS).forEach(([k,f])=>DB[k].forEach(x=>out.push({id:k+":"+x[f],kind:k,data:x})));
  out.push({id:"cal",kind:"cal",data:DB.cal}); out.push({id:"cfg",kind:"cfg",data:CFG}); out.push({id:"seq",kind:"seq",data:DB.seq});
  DB.log.slice(0,120).forEach(l=>{ if(!l.id) l.id=Math.random().toString(36).slice(2,8); out.push({id:"log:"+l.at+l.id,kind:"log",data:l}); });
  return out;
}
function normOrd(o){
  o.totals=calc(o.dest,o.items,o.seguro);
  if(!o.sc||o.sc.length!==o.totals.piezas) o.sc="0".repeat(o.totals.piezas);
  if(!o.inc) o.inc=[]; if(!o.firmas) o.firmas={}; if(!o.notif) o.notif={}; if(!o.pr) o.pr={}; if(!o.seguro) o.seguro={on:false,valor:0}; if(!o.rec) o.rec={on:false};
}
function nubeApply(row){
  const d=row.data||{}, id=row.id, ix=id.indexOf(":"), kind=ix<0?id:id.slice(0,ix), key=ix<0?null:id.slice(ix+1), rem=+d._u||0;
  if(kind==="seq"){ let ch=false; Object.entries(d).forEach(([k,v])=>{ if(k!=="_u"&&typeof v==="number"&&v>(DB.seq[k]||0)){ DB.seq[k]=v; ch=true; } }); NH.seq=dataHash(DB.seq); return ch; }
  if(kind==="cal"){ if(rem>(+DB.cal._u||0)){ DB.cal=d; if(!DB.cal.bloq) DB.cal.bloq={}; NH.cal=dataHash(d); return true; } return false; }
  if(kind==="cfg"){ if(rem>(+CFG._u||0)){ const base=DEFAULT_CFG(); CFG=Object.assign(base,d); CFG.steps=base.steps; NH.cfg=dataHash(CFG); return true; } return false; }
  if(kind==="log"){ if(!DB.log.some(l=>l.at===d.at&&l.id===d.id)){ DB.log.push(d); DB.log.sort((a,b)=>b.at-a.at); if(DB.log.length>600) DB.log.length=600; NH[id]=dataHash(d); return true; } return false; }
  const arr=DB[kind]; if(!arr||!COLS[kind]) return false;
  const f=COLS[kind], i=arr.findIndex(x=>String(x[f])===key);
  if(d._del){ if(i>=0&&rem>(+arr[i]._u||0)){ arr.splice(i,1); NH[id]="del"; return true; } return false; }
  if(i<0) arr.push(d); else { if(rem<=(+arr[i]._u||0)) return false; arr[i]=d; }
  if(kind==="ord"){ normOrd(d); DB.ord.sort((a,b)=>b.createdAt-a.createdAt); }
  NH[id]=dataHash(d); return true;
}
async function nubePull(full){
  const r=await fetch(`${nubeBase()}/alr_items?s=gt.${full?0:NUBE.lastS}&order=s.asc&limit=3000`,{headers:nubeHdr()});
  if(!r.ok) throw new Error("La nube respondió "+r.status+(r.status===401||r.status===403?" (revisa la llave)":r.status===404?" (¿ya corriste el SQL?)":""));
  const rows=await r.json(); let changed=false, maxS=NUBE.lastS;
  rows.forEach(row=>{ if(row.s>maxS) maxS=row.s; if(nubeApply(row)) changed=true; });
  NUBE.lastS=maxS; nubeSave(); if(changed) saveLocalOnly();
  return changed;
}
async function nubeSend(){
  const dirty=[]; nubeLocal().forEach(it=>{ const h=dataHash(it.data); if(NH[it.id]!==h) dirty.push({it,h}); });
  if(!dirty.length && !NTOMB.length) return 0;
  const now=Date.now(); dirty.forEach(({it})=>{ it.data._u=now; });
  const rows=dirty.map(({it})=>({id:it.id,kind:it.kind,data:it.data,u:now})).concat(NTOMB.map(t=>({id:t.id,kind:t.kind,data:{_del:true,_u:now},u:now})));
  for(let i=0;i<rows.length;i+=80){
    const r=await fetch(`${nubeBase()}/alr_items?on_conflict=id`,{method:"POST",headers:nubeHdr({Prefer:"resolution=merge-duplicates,return=minimal"}),body:JSON.stringify(rows.slice(i,i+80))});
    if(!r.ok) throw new Error("No se pudo guardar en la nube ("+r.status+")");
  }
  dirty.forEach(({it,h})=>{ NH[it.id]=h; }); NTOMB.forEach(t=>{ NH[t.id]="del"; }); NTOMB.length=0; saveLocalOnly();
  return rows.length;
}
function nubeTomb(kind,key){ if(nubeOn()) NTOMB.push({id:kind+":"+key,kind}); }
function nubePush(){ if(!nubeOn()) return; clearTimeout(ndeb); ndeb=setTimeout(nubeSync,600); }
async function nubeSync(){
  if(!nubeOn()||nbusy) return; nbusy=true;
  try{ const ch=await nubePull(); await nubeSend(); NUBE.estado="ok"; NUBE.err=""; NUBE.at=Date.now(); if(ch) nubeRefreshUI(); }
  catch(e){ NUBE.estado="err"; NUBE.err=String(e&&e.message||e); }
  finally{ nbusy=false; nubeBadge(); }
}
function nubeRefreshUI(){
  const a=document.activeElement, typing=a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName);
  if(S.modals.length||S.drawer||typing||S.scan.cam){ toast("Hay cambios nuevos de otros usuarios. Se verán al cerrar esta ventana."); return; }
  render();
}
function nubeBadge(){
  const el=$("#cloudpill"); if(!el) return;
  if(!nubeOn()){ el.style.display="none"; return; }
  el.style.display=""; el.className="pill keep "+(NUBE.estado==="ok"?"ok":"bad"); el.textContent=NUBE.estado==="ok"?"☁ En línea":"☁ Sin conexión";
  el.title=NUBE.err||("Última sincronización: "+fdate(NUBE.at));
}
function nubeSeqRemoto(k,start){
  try{ const x=new XMLHttpRequest(); x.open("POST",nubeBase()+"/rpc/next_seq",false);
    Object.entries(nubeHdr()).forEach(([a,b])=>x.setRequestHeader(a,b)); x.send(JSON.stringify({p_k:k,p_start:start}));
    if(x.status>=200&&x.status<300){ const v=JSON.parse(x.responseText); if(typeof v==="number") return v; } }catch(e){}
  return null;
}
async function nubeConectar(url,key){
  Object.assign(NUBE,{url:url.trim().replace(/\/+$/,""),key:key.trim(),on:true,lastS:0,estado:"off",err:""}); nubeSave();
  const r=await fetch(`${nubeBase()}/alr_items?select=id&limit=1`,{headers:nubeHdr()});
  if(!r.ok){ NUBE.on=false; nubeSave(); throw new Error("No se pudo conectar ("+r.status+"). "+(r.status===404?"Corre primero el SQL en Supabase.":"Revisa la dirección y la llave.")); }
  const rows=await r.json(); return rows.length===0 ? "vacia" : "con-datos";
}
async function nubeSubirTodo(){
  Object.keys(NH).forEach(k=>delete NH[k]); const n=await nubeSend();
  const seq=Object.entries(DB.seq).filter(([k,v])=>typeof v==="number").map(([k,v])=>({k,v}));
  if(seq.length){ const r=await fetch(`${nubeBase()}/alr_seq?on_conflict=k`,{method:"POST",headers:nubeHdr({Prefer:"resolution=merge-duplicates,return=minimal"}),body:JSON.stringify(seq)}); if(!r.ok) throw new Error("No se pudieron subir los folios ("+r.status+")"); }
  await nubePull(true); NUBE.estado="ok"; NUBE.at=Date.now(); nubeBadge(); return n;
}
async function nubeBajarTodo(){
  DB.ord=[]; DB.cli=[]; DB.fac=[]; DB.via=[]; DB.rem=[]; DB.log=[]; NUBE.lastS=0; Object.keys(NH).forEach(k=>delete NH[k]);
  DB.cal={bloq:{}}; DB.seq={}; CFG._u=0;
  await nubePull(true); NUBE.estado="ok"; NUBE.at=Date.now(); saveLocalOnly(); nubeBadge();
}
function nubeDesconectar(){ NUBE.on=false; NUBE.estado="off"; nubeSave(); nubeBadge(); }
function nubeLink(){ return `${qrBase()}#nube.${b64u(JSON.stringify({u:NUBE.url,k:NUBE.key}))}`; }
function nubeLoop(){ Promise.resolve(nubeSync()).finally(()=>setTimeout(nubeLoop,NUBE.every||5000)); }
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) nubeSync(); });
window.addEventListener("online",()=>nubeSync());
setTimeout(nubeLoop,1500);

/* ---- pantalla de configuración ---- */
function nubeConfigHTML(){
  const on=nubeOn(), st=on?(NUBE.estado==="ok"?`<span class="pill ok">☁ En línea</span> <span class="xs mut">última sincronización ${fdate(NUBE.at)}</span>`:`<span class="pill bad">☁ Sin conexión</span> <span class="xs">${esc(NUBE.err)}</span>`):`<span class="pill">Sin conectar</span>`;
  return `<div class="note info sm" style="margin-bottom:14px">Hoy cada navegador guarda <b>su propia copia</b> de los datos; por eso dos usuarios ven números distintos. Al conectar la nube, todos leen y escriben en el mismo lugar y los pedidos, el calendario y las cajas quedan vinculados entre dispositivos.</div>
  <div style="margin-bottom:14px">${st}</div>
  <div class="row2"><div><label for="nb-u">Dirección del proyecto (Supabase)</label><input id="nb-u" value="${esc(NUBE.url)}" placeholder="https://xxxxxxxx.supabase.co" autocomplete="off"></div>
  <div><label for="nb-k">Llave pública (anon key)</label><input id="nb-k" value="${esc(NUBE.key)}" placeholder="eyJhbGciOi…" autocomplete="off"></div></div>
  <div class="chips" style="margin-top:12px"><button class="btn" data-act="nubeconn">${on?"Reconectar":"Probar y conectar"}</button>
    ${on?`<button class="btn sec" data-act="nubesync">Sincronizar ahora</button><button class="btn sec" data-act="nubelink">Copiar enlace para mis compañeros</button><button class="btn sec" data-act="nubedown">Bajar datos de la nube</button><button class="btn sec" data-act="nubeup">Subir mis datos a la nube</button><button class="btn ghost" style="color:var(--bad)" data-act="nubeoff">Desconectar</button>`:""}</div>
  <h3 style="margin:22px 0 8px">Preparar Supabase (una sola vez)</h3>
  <ol class="sm" style="margin:0 0 10px 18px;padding:0"><li>Crea un proyecto gratis en supabase.com.</li><li>Entra a <b>SQL Editor</b>, pega el texto de abajo y ejecútalo (<b>Run</b>).</li><li>En <b>Project Settings → API</b> copia la <b>Project URL</b> y la llave <b>anon public</b>, y pégalas arriba.</li><li>Presiona <b>Probar y conectar</b>. Después usa <b>Copiar enlace para mis compañeros</b>: quien lo abra queda conectado.</li></ol>
  <textarea id="nb-sql" rows="9" readonly style="font:12px/1.4 ui-monospace,Menlo,monospace">${esc(NUBE_SQL)}</textarea>
  <div class="chips" style="margin-top:8px"><button class="btn sec sm" data-act="copyfield" data-arg="nb-sql">Copiar SQL</button></div>
  <div class="note sm" style="margin-top:14px">Esta conexión es de demostración: cualquiera con el enlace puede leer y escribir los datos. Para producción se agregan usuarios con contraseña y permisos por perfil.</div>`;
}
