/* ==================== Escáner QR ==================== */
let camStream=null, camTimer=null, lastCode="", lastAt=0;
const SCAN_MODES = [
  {k:"auto",     t:"Automático",         s:"Cada escaneo avanza la caja al siguiente paso"},
  {k:"recibida", t:"Recibir en almacén", s:"Llega la paquetería"},
  {k:"cargada",  t:"Cargar a unidad",    s:"Se sube al camión"},
  {k:"llegada",  t:"Llegada a plaza",    s:"Se descarga en destino"},
  {k:"entregada",t:"Entrega",            s:"Se entrega al cliente"}
];
function scanOrders(){ return DB.ord.filter(o=>!o.cancelado&&stIdx(o)>=1&&o.status!=="entregado"); }
function scanFeedHTML(){
  const f=S.scan.feed;
  if(!f.length) return `<div class="mut sm">Aún no hay escaneos. Escanea una etiqueta, escribe el código o usa "Simular siguiente caja".</div>`;
  return f.slice(0,14).map(r=>`<div class="it ${r.kind}" ${r.o?`data-act="open" data-arg="${esc(r.o.folio)}" style="cursor:pointer" title="Ver envío completo"`:""}><span>${r.ok?"✓":r.kind==="warn"?"!":"✕"}</span><div style="min-width:0"><div>${esc(r.msg)}</div><div class="xs" style="opacity:.85">${r.dim?`<b>${esc(r.dim)}</b> · `:""}${fdate(r.at)}${r.o?` · toca para ver el envío`:""}</div></div></div>`).join("");
}
function scanReconHTML(){
  const auto = S.scan.mode==="auto";
  const st=auto?null:STAGES.find(s=>s.k===S.scan.mode);
  const o=S.scan.ord?ordOf(S.scan.ord):null;
  let h="";
  if((S.scan.mode==="cargada"||auto) && S.scan.via){ const v=viaOf(S.scan.via); if(v&&["abierto","cargando"].includes(v.status)){ const f=viajeFaltantes(v), cg=viajeCargadas(v); const tot=v.ords.reduce((s,fo)=>s+(ordOf(fo)?ordOf(fo).sc.length:0),0);
    h+=`<div class="note ${f?"info":"ok"} sm" style="margin-bottom:12px"><b>${esc(v.id)} · ${esc(v.unidad)}</b> → ${esc(dest(v.dest).name)}: ${cg} cajas cargadas${tot?` de ${tot} asignadas`:""}${f?` · faltan ${f}`:" · carga completa ✓"}</div>`; } }
  if(!o) return h+`<div class="mut sm">Elige un pedido (o escanea una caja) para ver la conciliación de sus cajas.</div>`;
  const n=o.sc.length, c=stageCounts(o), done=auto?n-c[0]:atLeast(o,st.i), falt=faltantesTxt(o,auto?1:st.i);
  const etiqueta = auto?"recibidas en almacén":st.t;
  return h+`<div class="h2" style="margin-bottom:6px">${esc(o.folio)} <span class="pill ${done===n?"ok":"warn"}">${done} de ${n} · ${esc(etiqueta)}</span></div>
    <div class="mut sm" style="margin-bottom:8px">${esc(o.sol.empresa||o.sol.nombre)} → ${esc(o.dst.nombre)} (${esc(dest(o.dest).name)})</div>
    ${boxProgress(o,false)}
    ${done===n?`<div class="note ok sm" style="margin-top:10px">Conciliación completa: entraron las ${n} cajas ✓</div>`:`<div class="note sm" style="margin-top:10px"><b>Faltan ${n-done} cajas:</b> ${esc(falt)}</div>`}
    ${n<=400?`<div class="boxes">${Array.from({length:n},(_,k)=>`<i class="s${o.sc[k]}" title="Caja ${k+1}"></i>`).join("")}</div>`:""}
    <div class="chips noprint" style="margin-top:10px"><button class="btn sec sm" data-act="open" data-arg="${esc(o.folio)}">Ver envío completo</button></div>`;
}
function refreshScan(){ const a=$("#scan-feed"); if(a) a.innerHTML=scanFeedHTML(); const b=$("#scan-recon"); if(b) b.innerHTML=scanReconHTML(); }
function submitScan(code){
  const g=String(code).match(/#g\.([A-Za-z0-9-]+)\s*$/); if(g){ beep(true); guiaPendiente(g[1]); return; }
  const res = doScan(code, S.scan.mode, {via:S.scan.via});
  S.scan.feed.unshift({...res, at:Date.now()}); if(S.scan.feed.length>40) S.scan.feed.pop();
  if(res.o && res.kind!=="bad" && !S.scan.ord) S.scan.ord=res.o.folio;
  if(res.o && res.ok) S.scan.ord=res.o.folio;
  S.scanResult=null; const rc=$("#scan-result"); if(rc) rc.remove();
  beep(res.ok); refreshScan();
  if(S.mod!=="scan") toast(res.msg+(res.dim?` · ${res.dim}`:""), res.ok?"":"bad");
  const sel=$("#sc-ord"); if(sel && S.scan.ord) sel.value=S.scan.ord;
}
function nextSimStage(o, mode){
  if(mode!=="auto"){ const st=STAGES.find(s=>s.k===mode); for(let i=1;i<=o.sc.length;i++) if(boxStage(o,i)===st.i-1) return st.i-1; return -1; }
  const have=new Set(); for(let i=1;i<=o.sc.length;i++) have.add(boxStage(o,i));
  for(const c of [0,1,3,4]) if(have.has(c)) return c;
  return -1;
}
function simulateNext(){
  const o=S.scan.ord?ordOf(S.scan.ord):null; if(!o){ toast("Elige primero un pedido","bad"); return; }
  const s0=nextSimStage(o,S.scan.mode); if(s0<0){ toast(S.scan.mode==="auto"?`No hay cajas de ${o.folio} que puedan avanzar ahora (¿falta registrar la salida del viaje?)`:`Todas las cajas de ${o.folio} ya tienen ese paso`); return; }
  for(let i=1;i<=o.sc.length;i++) if(boxStage(o,i)===s0){ submitScan(boxCode(o.folio,i,o.sc.length)); return; }
}
function simulateAll(){
  const o=S.scan.ord?ordOf(S.scan.ord):null; if(!o){ toast("Elige primero un pedido","bad"); return; }
  const s0=nextSimStage(o,S.scan.mode); if(s0<0){ toast(`No hay cajas de ${o.folio} que puedan avanzar ahora`); return; }
  let k=0, last=null;
  for(let i=1;i<=o.sc.length;i++) if(boxStage(o,i)===s0){ const r=doScan(boxCode(o.folio,i,o.sc.length),S.scan.mode,{via:S.scan.via}); if(!r.ok){ S.scan.feed.unshift({...r,at:Date.now()}); beep(false); refreshScan(); return; } k++; last=r; }
  S.scan.feed.unshift({ok:true,kind:"ok",o,msg:`${k} caja${k===1?"":"s"} de ${o.folio}: ${last?last.stage.t:""}`,at:Date.now()}); beep(true); refreshScan();
}
async function camStart(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ toast("Este navegador no permite usar la cámara aquí","bad"); return; }
  try{ camStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}}); }
  catch(e){ toast(SANDBOX?"La cámara solo funciona al abrir el sistema en su propia página web.":"No se pudo abrir la cámara: permiso denegado.","bad"); return; }
  S.scan.cam=true; render();
  const det = ("BarcodeDetector" in window) ? new BarcodeDetector({formats:["qr_code"]}) : null;
  const cv=document.createElement("canvas"), cx=cv.getContext("2d",{willReadFrequently:true});
  clearInterval(camTimer);
  camTimer = setInterval(async()=>{
    const v=$("#cam"); if(!v||v.readyState<2) return; let code=null;
    try{ if(det){ const r=await det.detect(v); if(r.length) code=r[0].rawValue; }
         else if(window.jsQR){ cv.width=v.videoWidth; cv.height=v.videoHeight; cx.drawImage(v,0,0); const im=cx.getImageData(0,0,cv.width,cv.height); const r=jsQR(im.data,im.width,im.height); if(r) code=r.data; } }catch(e){}
    if(code && (code!==lastCode || Date.now()-lastAt>2500)){ lastCode=code; lastAt=Date.now(); submitScan(code); }
  },250);
}
function camStop(){ clearInterval(camTimer); camTimer=null; if(camStream) camStream.getTracks().forEach(t=>t.stop()); camStream=null; S.scan.cam=false; }
function attachCam(){ const v=$("#cam"); if(v&&camStream){ v.srcObject=camStream; v.play().catch(()=>{}); } }

function scanResultCard(r){
  const o=r.o, n=o?o.sc.length:0, c=o?stageCounts(o):null;
  return `<div class="card" id="scan-result" style="margin-bottom:16px;border:3px solid ${r.ok?"var(--ok)":r.kind==="warn"?"#e0a21b":"var(--bad)"}">
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div class="ok-big" style="margin:0;background:${r.ok?"var(--ok)":r.kind==="warn"?"#e0a21b":"var(--bad)"}">${r.ok?"✓":r.kind==="warn"?"!":"✕"}</div>
    <div style="flex:1;min-width:220px"><div style="font-size:20px;font-weight:800">${esc(r.msg)}</div>${r.dim?`<div style="margin-top:4px"><b>${esc(r.dim)}</b> <span class="mut sm">(mídela: no debe excederse)</span></div>`:""}${o?`<div class="mut">${esc(o.sol.empresa||o.sol.nombre)} → ${esc(o.dst.nombre)} (${esc(dest(o.dest).name)})</div>`:""}</div></div>
    ${o?`<div style="margin-top:14px">${boxProgress(o,true)}</div><div class="chips noprint" style="margin-top:12px"><button class="btn" data-act="scanagain">Escanear otra caja</button><button class="btn sec" data-act="open" data-arg="${esc(o.folio)}">Ver envío completo</button></div>`:`<div class="chips noprint" style="margin-top:12px"><button class="btn" data-act="scanagain">Escanear otra caja</button></div>`}</div>`;
}
function modScan(){
  const m=S.scan, vias=DB.via.filter(v=>["abierto","cargando"].includes(v.status));
  if(m.mode==="cargada" && !m.via && vias.length) m.via=vias[0].id;
  const rs=S.scanResult;
  const ords=scanOrders();
  return `${ptitle("Escáner QR",`<span class="mut sm">Lector de mano, cámara del teléfono o simulación</span>`)}
  ${rs?scanResultCard(rs):""}
  <div class="grid g2">
    <div class="scanbox">
      <div class="mode">${SCAN_MODES.map(x=>`<button data-act="smode" data-arg="${x.k}" class="${m.mode===x.k?"on":""}">${esc(x.t)}<small>${esc(x.s)}</small></button>`).join("")}</div>
      ${m.mode==="cargada"||m.mode==="auto"?`<div style="margin-bottom:12px"><label for="sc-via" style="color:#cfd8ea">${m.mode==="auto"?"Unidad para la carga (si no eliges, se usa el viaje abierto al destino de la caja)":"Unidad / viaje"}</label><select id="sc-via" data-ch="svia">${vias.length?vias.map(v=>`<option value="${v.id}" ${m.via===v.id?"selected":""}>${esc(v.id)} · ${esc(v.unidad)} → ${esc(dest(v.dest).name)} (${esc(VIA_ST[v.status])})</option>`).join(""):`<option value="">${m.mode==="auto"?"Automática":"No hay viajes abiertos — crea uno en Viajes"}</option>`}</select></div>`:""}
      <form data-form="scan"><label for="scan-in" style="color:#cfd8ea">Código de la caja</label>
        <div style="display:flex;gap:8px"><input id="scan-in" placeholder="Código de la caja" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="btn">Registrar</button></div></form>
      <div class="chips" style="margin-top:12px">
        <button class="btn sec sm" data-act="${m.cam?"camoff":"camon"}">${m.cam?"Apagar cámara":"Escanear con cámara"}</button>
        <button class="btn sec sm" data-act="simnext">Simular siguiente caja</button>
        <button class="btn sec sm" data-act="simall">Simular todas</button>
      </div>
      ${m.cam?`<div style="margin-top:12px"><video id="cam" class="cam" playsinline muted autoplay></video></div>`:""}
      <div style="margin-top:12px"><label for="sc-ord" style="color:#cfd8ea">Pedido a conciliar</label>
        <select id="sc-ord" data-ch="sord"><option value="">— elige —</option>${ords.map(o=>`<option value="${esc(o.folio)}" ${m.ord===o.folio?"selected":""}>${esc(o.folio)} · ${esc(o.sol.empresa||o.sol.nombre)} · ${o.totals.piezas} cajas → ${esc(dest(o.dest).name)}</option>`).join("")}</select></div>
    </div>
    <div>
      <div class="card"><div class="h2">Conciliación</div><div id="scan-recon">${scanReconHTML()}</div></div>
      <div class="card"><div class="h2">Últimos escaneos</div><div class="feed" id="scan-feed">${scanFeedHTML()}</div></div>
    </div>
  </div>
  <div class="note info sm" style="margin-top:16px"><b>Cómo se usa en la operación:</b> el cliente imprime las etiquetas QR y las pega en cada caja. Al llegar a la paquetería se escanea "Recibir"; al subir al camión, "Cargar a unidad"; al salir, un botón en <b>Viajes</b> pasa todas las cajas a "En ruta"; al llegar, "Llegada a plaza"; y al entregar, "Entrega". Cada paso actualiza el seguimiento del cliente y avisa si falta alguna caja.</div>`;
}

/* ==================== Viajes y unidades ==================== */
function viajeBoxes(v){ let n=0; v.ords.forEach(fo=>{ const o=ordOf(fo); if(o) n+=o.sc.length; }); return n; }
function modViajes(){
  const lista = DB.via.filter(v=> S.vtab==="activos" ? !["cerrado"].includes(v.status) : v.status==="cerrado");
  return `${ptitle("Viajes y unidades")}
  <div class="card noprint" style="margin-bottom:16px"><div class="h2">Nuevo viaje</div>
    <form data-form="newvia"><div class="row4">
      <div><label for="nv-u">Unidad</label><input id="nv-u" placeholder="Unidad 214"></div>
      <div><label for="nv-p">Placas</label><input id="nv-p" placeholder="NL-48-221"></div>
      <div><label for="nv-o">Operador</label><input id="nv-o" placeholder="Nombre"></div>
      <div><label for="nv-d">Destino</label><select id="nv-d">${CFG.destinos.map(d=>`<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select></div>
      <div><label for="nv-t">Tipo de unidad</label><select id="nv-t">${Object.entries(CFG.camiones).map(([k,t])=>`<option value="${k}">${esc(t.t)} · ${t.m3} m³ · ${num(t.kg,0)} kg</option>`).join("")}</select></div></div>
      <button class="btn sm" style="margin-top:12px">Crear viaje</button></form></div>
  <div class="subtabs"><button class="${S.vtab==="activos"?"on":""}" data-act="vtab" data-arg="activos">Activos</button><button class="${S.vtab==="cerrados"?"on":""}" data-act="vtab" data-arg="cerrados">Cerrados</button></div>
  <div class="grid g2">${lista.map(viajeCard).join("")||`<div class="card mut">No hay viajes en esta lista.</div>`}</div>`;
}
function viajeCard(v){
  const f=viajeFaltantes(v), cg=viajeCargadas(v), tot=viajeBoxes(v);
  const stc = {abierto:"",cargando:"warn",en_ruta:"red",llegado:"ok",cerrado:"dark"}[v.status];
  const elig = DB.ord.filter(o=>!o.cancelado&&o.dest===v.dest&&stIdx(o)>=1&&o.status!=="entregado"&&!v.ords.includes(o.folio)&&(!o.viaje||["cerrado","llegado"].includes((viaOf(o.viaje)||{}).status)));
  return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><h3>${esc(v.id)} · ${esc(v.unidad)} <span class="pill">${esc(viajeCap(v).t)}</span></h3><div class="sm mut">${esc(v.placas)} · ${esc(v.operador)} → <b>${esc(dest(v.dest).name)}</b></div></div><span class="pill ${stc}">${esc(VIA_ST[v.status])}</span></div>
    <div style="margin:12px 0 4px">${viajeOccHTML(v)}</div><div class="row3" style="margin:12px 0"><div style="background:var(--soft);padding:8px;border-radius:10px"><div class="xs mut">Cajas asignadas</div><b class="mono">${tot}</b></div><div style="background:var(--soft);padding:8px;border-radius:10px"><div class="xs mut">Cargadas</div><b class="mono">${tot-f}</b></div><div style="background:var(--soft);padding:8px;border-radius:10px"><div class="xs mut">Faltan</div><b class="mono" style="color:${f?"var(--bad)":"var(--ok)"}">${f}</b></div></div>
    ${v.ords.map(fo=>{ const o=ordOf(fo); if(!o) return ""; const c=stageCounts(o), cgo=c[2]+c[3]+c[4]+c[5]; return `<div class="sm" style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--line);cursor:pointer" data-act="open" data-arg="${esc(o.folio)}"><span><b>${esc(o.folio)}</b> · ${esc(o.sol.empresa||o.sol.nombre)}</span><span class="mono">${cgo}/${o.sc.length}</span></div>`; }).join("")||`<div class="mut sm">Sin pedidos asignados.</div>`}
    <div class="chips noprint" style="margin-top:12px">
      ${["abierto","cargando"].includes(v.status)?`<button class="btn sm" data-act="viacargar" data-arg="${v.id}">Escanear carga</button><button class="btn dark sm" data-act="viasalida" data-arg="${v.id}">Registrar salida</button>`:""}
      ${v.status==="en_ruta"?`<button class="btn sm" data-act="vialleg" data-arg="${v.id}">Registrar llegada</button>`:""}
      ${v.status==="llegado"?`<button class="btn sm" data-act="viacerrar" data-arg="${v.id}">Cerrar viaje</button>`:""}
      <button class="btn sec sm" data-act="doc" data-arg="mani|${v.id}">Manifiesto</button></div>
    ${["abierto","cargando"].includes(v.status)&&elig.length?`<div class="noprint" style="margin-top:12px;display:flex;gap:8px"><select id="va-${v.id}">${elig.map(o=>`<option value="${esc(o.folio)}">${esc(o.folio)} · ${o.totals.piezas} cajas · ${esc(o.sol.empresa||o.sol.nombre)}</option>`).join("")}</select><button class="btn sec sm" data-act="viaadd" data-arg="${v.id}">Agregar</button></div>`:""}
    ${v.salidaAt?`<div class="xs mut" style="margin-top:8px">Salida ${fdate(v.salidaAt)}${v.llegadaAt?` · Llegada ${fdate(v.llegadaAt)}`:""}</div>`:""}</div>`;
}

/* ==================== Almacén ==================== */
function modAlmacen(){
  const act = DB.ord.filter(o=>!o.cancelado&&stIdx(o)>=1&&o.status!=="entregado");
  const m3b = o => o.totals.m3/o.sc.length;
  const by = (stg)=>CFG.destinos.map(d=>{ let n=0,m3=0,os=[]; act.filter(o=>o.dest===d.id).forEach(o=>{ const c=stageCounts(o); if(c[stg]){ n+=c[stg]; m3+=c[stg]*m3b(o); os.push([o,c[stg]]); } }); return {d,n,m3,os}; }).filter(g=>g.n);
  const blk=(title,sub,g,go)=>`<div class="card"><div class="h2">${title} <span class="mut sm" style="font-weight:500">${sub}</span></div>${g.length?g.map(x=>`<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><b>→ ${esc(x.d.name)}</b><span class="mono sm"><b>${x.n}</b> cajas · <b>${num(x.m3,2)}</b> m³</span></div>
    ${x.os.map(([o,c])=>`<div class="sm" style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--line);cursor:pointer" data-act="open" data-arg="${esc(o.folio)}"><span><b>${esc(o.folio)}</b> · ${esc(o.sol.empresa||o.sol.nombre)}</span><span class="mono">${c} cajas</span></div>`).join("")}</div>`).join(""):`<div class="mut">Nada por aquí.</div>`}
    ${go?`<button class="btn sec sm" data-act="smodego" data-arg="${go}">Ir al escáner</button>`:""}</div>`;
  const totA=by(1).reduce((s,x)=>s+x.n,0), m3A=by(1).reduce((s,x)=>s+x.m3,0), totP=by(0).reduce((s,x)=>s+x.n,0), totC=by(2).reduce((s,x)=>s+x.n,0);
  return `${ptitle("Almacén")}
  <div class="kpis"><div class="kpi w"><small>Por recibir</small><b>${totP}</b><span>cajas confirmadas sin escanear</span></div><div class="kpi b"><small>En almacén</small><b>${totA}</b><span>${num(m3A,1)} m³ ocupados</span></div><div class="kpi"><small>Cargadas en unidad</small><b>${totC}</b><span>esperando salida</span></div></div>
  <div class="grid g3">${blk("Por recibir","confirmadas, aún sin llegar",by(0),"recibida")}${blk("En almacén","recibidas y escaneadas",by(1),"cargada")}${blk("Cargadas en unidad","listas para salir",by(2),"")}</div>
  <h3 style="margin:24px 0 10px">Unidades de hoy</h3>${unidadesHoyHTML()}`;
}
