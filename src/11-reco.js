/* ==================== Recolecciones: calendario y solicitudes ==================== */
function ymd(d){ const x=new Date(d); return x.getFullYear()+"-"+pad(x.getMonth()+1,2)+"-"+pad(x.getDate(),2); }
function fromYmd(s){ const [y,m,d]=String(s).split("-").map(Number); return new Date(y,m-1,d); }
function hh(s){ return parseInt(String(s).slice(0,2),10); }
const REC_ST = {solicitada:"Por confirmar", programada:"Programada", recolectada:"Recolectada", no_realizada:"No se pudo", cancelada:"Cancelada"};
function recVentana(r){ return `${r.desde}–${r.hasta}`; }
function recVigente(o){ return !!(o.rec && o.rec.on && o.rec.estado!=="cancelada"); }

function recCount(fecha){ return DB.ord.filter(o=>!o.cancelado && recVigente(o) && o.rec.fecha===fecha).length; }
function diaInfo(fecha){
  const R=CFG.recoleccion, w=fromYmd(fecha).getDay(), bloq=(DB.cal.bloq||{})[fecha];
  if(w===0 || (w===6&&!R.sabado)) return {ok:false, why:"Sin servicio", n:0};
  if(bloq!==undefined) return {ok:false, why:bloq||"Bloqueado", bloq:true, n:recCount(fecha)};
  const n=recCount(fecha); if(n>=R.capDia) return {ok:false, why:"Lleno", n};
  return {ok:true, n};
}
const primerDiaRec = () => ymd(addBiz(Date.now(), CFG.recoleccion.anticipacion));
function recValida(r){
  const m=[], R=CFG.recoleccion;
  if(!r.dir.trim()) m.push("dirección de recolección");
  if(!r.contacto.nombre.trim()) m.push("contacto en sitio");
  if(r.contacto.tel.replace(/\D/g,"").length<8) m.push("teléfono del contacto");
  if(!r.fecha) m.push("día de recolección"); else if(!diaInfo(r.fecha).ok || r.fecha<primerDiaRec()) m.push("un día disponible");
  if(hh(r.hasta)-hh(r.desde)<R.minHoras) m.push(`ventana de al menos ${R.minHoras} horas`);
  return m;
}
function horaOpts(desdeN, hastaN, sel){ let h=""; for(let i=desdeN;i<=hastaN;i++){ const v=pad(i,2)+":00"; h+=`<option value="${v}" ${v===sel?"selected":""}>${v}</option>`; } return h; }
function diasChipsHTML(sel, act){
  let d=fromYmd(primerDiaRec()), out="";
  for(let i=0;i<14;i++){ const f=ymd(d), info=diaInfo(f);
    out+=`<button type="button" class="dchip ${sel===f?"on":""}" ${info.ok?"":"disabled"} data-act="${act}" data-arg="${f}"><b>${esc(fshort(d))}</b><small>${info.ok?"Disponible":esc(info.why)}</small></button>`;
    d=new Date(d.getTime()+DAY); }
  return `<div class="dchips">${out}</div>`;
}
function ventanaHTML(prefix, r, chAct){
  const R=CFG.recoleccion, dur=hh(r.hasta)-hh(r.desde), ok=dur>=R.minHoras;
  const presets=[["09:00","12:00","Mañana"],["12:00","15:00","Mediodía"],["14:00","17:00","Tarde"],["09:00","18:00","Todo el día"]].filter(p=>hh(p[0])>=R.desde&&hh(p[1])<=R.hasta);
  return `<div class="chips" style="margin-bottom:8px">${presets.map(p=>`<button type="button" class="btn sec sm" data-act="${chAct}p" data-arg="${p[0]}|${p[1]}">${p[2]} ${p[0]}–${p[1]}</button>`).join("")}</div>
    <div class="row2"><div><label for="${prefix}-d">Desde</label><select id="${prefix}-d" data-ch="${chAct}d">${horaOpts(R.desde,R.hasta-R.minHoras,r.desde)}</select></div>
    <div><label for="${prefix}-h">Hasta</label><select id="${prefix}-h" data-ch="${chAct}h">${horaOpts(hh(r.desde)+R.minHoras,R.hasta,r.hasta)}</select></div></div>
    <div class="sm ${ok?"mut":""}" style="margin-top:6px;${ok?"":"color:var(--bad);font-weight:700"}">Ventana de ${dur} h. Mínimo ${R.minHoras} horas: es el margen para que la unidad llegue aunque se retrase.</div>`;
}
function ajustaVentana(r, campo, valor){
  const R=CFG.recoleccion; r[campo]=valor;
  if(hh(r.hasta)-hh(r.desde)<R.minHoras){ if(campo==="desde") r.hasta=pad(Math.min(R.hasta,hh(r.desde)+R.minHoras),2)+":00"; else r.desde=pad(Math.max(R.desde,hh(r.hasta)-R.minHoras),2)+":00"; }
}

/* ---- Cliente: tarjeta de recolección y seguro dentro del cotizador ---- */
function renderRec(){
  const el=$("#q-rec"); if(!el) return;
  if(!Q.serv.recoleccion){ el.innerHTML=""; return; }
  const r=Q.rec;
  el.innerHTML=`<div class="card"><div class="h2">Datos de tu recolección</div>
    <div class="row2">
      <div style="grid-column:1/-1"><label for="r-dir">Dirección donde recogemos *</label><input id="r-dir" data-in="rec" data-arg="dir" value="${esc(r.dir)}" placeholder="Calle, número, colonia, ciudad, C.P."></div>
      <div><label for="r-cn">Contacto en sitio *</label><input id="r-cn" data-in="rec" data-arg="cn" value="${esc(r.contacto.nombre)}" placeholder="Quién nos recibe"></div>
      <div><label for="r-ct">Teléfono del contacto *</label><input id="r-ct" type="tel" data-in="rec" data-arg="ct" value="${esc(r.contacto.tel)}"></div>
      <div style="grid-column:1/-1"><label for="r-pr">A quién preguntar o a dónde ir</label><input id="r-pr" data-in="rec" data-arg="pr" value="${esc(r.pregunta)}" placeholder="Ej. Con el jefe de almacén, andén 3, caseta de vigilancia"></div>
    </div>
    <div style="margin-top:14px"><label>Día de recolección *</label>${diasChipsHTML(r.fecha,"qdia")}<div class="xs mut" style="margin-top:6px">Los días llenos o sin servicio aparecen apagados.</div></div>
    <div style="margin-top:14px"><label>Horario en que estarás listo *</label>${ventanaHTML("r",r,"rec")}</div>
    <div style="margin-top:14px"><label for="r-in">Instrucciones para el operador</label><textarea id="r-in" rows="2" data-in="rec" data-arg="instr" placeholder="Acceso, piso, horario de comida, identificación que piden…">${esc(r.instr)}</textarea></div></div>`;
}
function renderSeg(){
  const el=$("#q-seg"); if(!el) return;
  if(!Q.serv.seguro){ el.innerHTML=""; return; }
  const v=parseFloat(Q.seguro.valor)||0, s=v*CFG.seguroPct/100;
  el.innerHTML=`<div class="card flat" style="margin-top:10px;background:var(--soft)"><div class="sm" style="margin-bottom:10px">Seguro de mercancía: <b>${CFG.seguroPct}%</b> sobre el valor declarado. Usa el subtotal de tu factura de la mercancía (sin IVA).</div>
    <div class="row2"><div><label for="sg-v">Valor declarado de la mercancía ($) *</label><input id="sg-v" inputmode="decimal" autocomplete="off" data-in="segv" value="${Q.seguro.valor||""}" placeholder="Ej. 85000"></div>
    <div><label for="sg-f">Sube tu factura de la mercancía (PDF, XML o imagen)</label><input id="sg-f" type="file" accept=".pdf,.xml,image/*" data-ch="segfile"></div></div>
    <div id="sg-res" class="sm" style="margin-top:8px">${v>0?`Costo del seguro: <b>${money(s)}</b> + IVA`:"Captura el valor para calcular el seguro."}${Q.seguro.file?` · <b>${esc(Q.seguro.file.name)}</b> adjunta`:""}</div></div>`;
}
function recResumen(o){
  if(!recVigente(o)) return "";
  const r=o.rec, st={solicitada:"warn",programada:"ok",recolectada:"ok",no_realizada:"bad"}[r.estado]||"";
  return `<div class="note info sm" style="text-align:left"><b>Recolección:</b> ${esc(fshort(fromYmd(r.fecha)))} · ${esc(recVentana(r))} <span class="pill ${st}">${esc(REC_ST[r.estado])}</span>${r.unidad?` · ${esc(r.unidad)}`:""}<br>${esc(r.dir)}<br>Contacto: ${esc(r.contacto.nombre)} · ${esc(r.contacto.tel)}${r.pregunta?`<br>Preguntar por: ${esc(r.pregunta)}`:""}${r.instr?`<br>Instrucciones: ${esc(r.instr)}`:""}</div>`;
}

/* ---- Repetir un pedido anterior ---- */
function cargarComoBase(o){
  Q=newQ(); Q.dest=o.dest;
  Q.items=o.items.map(it=>it.custom?{custom:true,qty:it.qty,l:it.l,a:it.a,h:it.h,kg:it.kg}:{cajaId:it.cajaId,qty:it.qty});
  Q.sol={...o.sol}; Q.dst={...o.dst}; Q.serv={...o.serv}; Q.obs=o.obs||""; Q.notif={wa:false,mail:false,...(o.notif||{})};
  if(o.rec&&o.rec.on){ Q.serv.recoleccion=true; Q.rec={...Q.rec,dir:o.rec.dir,contacto:{...o.rec.contacto},pregunta:o.rec.pregunta||"",instr:o.rec.instr||"",desde:o.rec.desde,hasta:o.rec.hasta,fecha:""}; }
  if(o.seguro&&o.seguro.on){ Q.serv.seguro=true; Q.seguro={valor:o.seguro.valor,file:null}; }
  Q.base=o.folio;
}
function repetirPedido(folio){
  const o=ordOf(folio); if(!o){ toast("No encontré ese pedido","bad"); return; }
  cargarComoBase(o); S.view="cotizar"; S.done=null; S.drawer=null; S.modals=[]; render(); scrollTo(0,0);
  toast(`Copiamos ${o.folio}. Cambia lo que necesites y confirma.`);
}

/* ==================== Módulo Recolecciones (interno) ==================== */
function recCard(o){
  const r=o.rec, st={solicitada:"warn",programada:"ok",recolectada:"ok",no_realizada:"bad",cancelada:"bad"}[r.estado]||"";
  const maps=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.dir)}`;
  const acts=[];
  if(r.estado==="solicitada") acts.push(`<button class="btn sm" data-act="recconf" data-arg="${esc(o.folio)}">Confirmar</button>`);
  if(r.estado==="programada") acts.push(`<button class="btn ok sm" data-act="recdone" data-arg="${esc(o.folio)}">Marcar recolectada</button><button class="btn sec sm" data-act="recfail" data-arg="${esc(o.folio)}">No se pudo</button>`);
  if(["solicitada","programada","no_realizada"].includes(r.estado)) acts.push(`<button class="btn sec sm" data-act="recre" data-arg="${esc(o.folio)}">Reprogramar</button>`);
  return `<div class="opc" style="margin-bottom:10px"><div class="opc-h"><b>${esc(r.desde)}–${esc(r.hasta)}</b><span class="pill ${st}">${esc(REC_ST[r.estado])}</span><span class="mut sm" style="margin-left:auto">${esc(o.folio)}</span></div>
    <div class="sm" style="margin-top:4px"><b>${esc(o.sol.empresa||o.sol.nombre)}</b> · ${o.totals.piezas} cajas · ${num(o.totals.m3,1)} m³ · ${num(o.totals.kg,0)} kg → ${esc(dest(o.dest).name)}</div>
    <div class="sm" style="margin-top:6px">📍 <a href="${esc(maps)}" target="_blank" rel="noopener" style="color:var(--c2)">${esc(r.dir)}</a></div>
    <div class="sm">Contacto: <b>${esc(r.contacto.nombre)}</b> · ${esc(r.contacto.tel)}${r.pregunta?`<br>Preguntar por: <b>${esc(r.pregunta)}</b>`:""}${r.instr?`<br>Instrucciones: ${esc(r.instr)}`:""}${r.unidad?`<br>Unidad: <b>${esc(r.unidad)}</b>`:""}${r.nota?`<br><span class="mut">${esc(r.nota)}</span>`:""}</div>
    <div class="opc-b noprint">${acts.join("")}<button class="btn sec sm" data-act="open" data-arg="${esc(o.folio)}">Ver pedido</button></div></div>`;
}
function calCell(f,hoy){
  const info=diaInfo(f), n=recCount(f), cap=CFG.recoleccion.capDia, past=f<hoy;
  const cls=past?"past":info.bloq?"blk":info.why==="Sin servicio"?"off":n>=cap?"full":n/cap>.6?"hi":"";
  return `<button class="cc ${cls} ${S.recDia===f?"sel":""} ${f===hoy?"today":""}" data-act="calsel" data-arg="${f}"><b>${+f.slice(8)}</b>${info.bloq?`<span>Bloq.</span>`:n?`<span>${n}/${cap}</span>`:""}<i style="width:${Math.min(100,n/cap*100)}%"></i></button>`;
}
function modReco(){
  const hoy=ymd(Date.now()), R=CFG.recoleccion;
  if(!S.recDia){ const ds=DB.ord.filter(o=>!o.cancelado&&recVigente(o)&&o.rec.fecha>=hoy&&["solicitada","programada"].includes(o.rec.estado)).map(o=>o.rec.fecha).sort(); S.recDia=ds[0]||hoy; if(ds[0]){ const d0=fromYmd(ds[0]); S.recRef={y:d0.getFullYear(),m:d0.getMonth()}; } }
  if(!S.recRef) S.recRef={y:new Date().getFullYear(),m:new Date().getMonth()};
  const ref=S.recRef, first=new Date(ref.y,ref.m,1), dim=new Date(ref.y,ref.m+1,0).getDate(), off=(first.getDay()+6)%7;
  const cells=[]; for(let i=0;i<off;i++) cells.push(null); for(let d=1;d<=dim;d++) cells.push(ymd(new Date(ref.y,ref.m,d)));
  const mes=first.toLocaleDateString("es-MX",{month:"long",year:"numeric"});
  const todas=DB.ord.filter(o=>!o.cancelado&&recVigente(o));
  const pend=todas.filter(o=>o.rec.estado==="solicitada").sort((a,b)=>a.rec.fecha.localeCompare(b.rec.fecha)||a.rec.desde.localeCompare(b.rec.desde));
  const dia=todas.filter(o=>o.rec.fecha===S.recDia).sort((a,b)=>a.rec.desde.localeCompare(b.rec.desde));
  const info=diaInfo(S.recDia), m3=dia.reduce((s,o)=>s+o.totals.m3,0);
  return `${ptitle("Recolecciones",`<span class="mut sm">Capacidad: ${R.capDia} recolecciones por día</span>`)}
  ${pend.length?`<div class="card" style="border:2px solid #e0a21b;margin-bottom:16px"><div class="h2">Solicitudes por confirmar <span class="pill warn">${pend.length}</span></div>${pend.map(o=>`<div class="mut xs" style="margin:6px 0 2px">${esc(fshort(fromYmd(o.rec.fecha)))}</div>${recCard(o)}`).join("")}</div>`:`<div class="note ok sm" style="margin-bottom:16px">No hay solicitudes pendientes de confirmar.</div>`}
  <div class="grid g2" style="align-items:start">
    <div class="card"><div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><button class="btn sec sm" data-act="calmes" data-arg="-1" aria-label="Mes anterior">‹</button><h3 style="flex:1;text-align:center">${esc(mes.charAt(0).toUpperCase()+mes.slice(1))}</h3><button class="btn sec sm" data-act="calmes" data-arg="1" aria-label="Mes siguiente">›</button></div>
      <div class="cal">${["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(h=>`<div class="ch">${h}</div>`).join("")}${cells.map(f=>f?calCell(f,hoy):`<div class="cc empty"></div>`).join("")}</div>
      <div class="legend" style="margin-top:10px"><span><i style="background:#d6efe0"></i>Con lugar</span><span><i style="background:#fde9b8"></i>Casi lleno</span><span><i style="background:#f9c9c9"></i>Lleno</span><span><i style="background:#cfd5e2"></i>Bloqueado / sin servicio</span></div></div>
    <div class="card"><div class="h2">${esc(fshort(fromYmd(S.recDia)))} <span class="pill ${info.ok?"ok":info.bloq?"dark":"bad"}">${info.ok?"Con lugar":esc(info.why)}</span></div>
      <div class="sm mut" style="margin-bottom:10px">${dia.length} de ${R.capDia} recolecciones · ${num(m3,1)} m³</div>
      ${dia.map(recCard).join("")||`<div class="mut sm">Sin recolecciones este día.</div>`}
      ${allowed("config")||ROLE==="admin"||ROLE==="almacen"?`<div class="noprint" style="margin-top:12px">${info.bloq?`<button class="btn sec sm" data-act="calopen" data-arg="${S.recDia}">Abrir este día</button>`:`<div class="row2"><div><label for="rb-m">Bloquear este día (motivo)</label><input id="rb-m" placeholder="Mantenimiento, festivo, sin unidades…"></div><div style="align-self:end"><button class="btn sec sm" data-act="calblock" data-arg="${S.recDia}">Bloquear día</button></div></div>`}</div>`:""}</div>
  </div>`;
}
function recHoyHTML(){
  const hoy=ymd(Date.now());
  const l=DB.ord.filter(o=>!o.cancelado&&recVigente(o)&&["solicitada","programada"].includes(o.rec.estado)&&o.rec.fecha<=hoy).sort((a,b)=>a.rec.fecha.localeCompare(b.rec.fecha)||a.rec.desde.localeCompare(b.rec.desde));
  if(!l.length) return "";
  return `<h3 style="margin:20px 0 10px">Recolecciones de hoy <span class="pill red">${l.length}</span></h3>${l.map(recCard).join("")}`;
}

/* ---- ventanas modales ---- */
function openRecConfirm(f){
  const o=ordOf(f), r=o.rec, unidades=[...new Set(["Camioneta 1","Camioneta 2","Rabón 3",...DB.via.map(v=>v.unidad)])];
  openModal({title:"Confirmar recolección", key:"rec", html:`<div class="sm" style="margin-bottom:10px"><b>${esc(o.folio)}</b> · ${esc(fshort(fromYmd(r.fecha)))} · ${esc(recVentana(r))}<br>${esc(r.dir)}</div>
    <label for="rc-u">Unidad que recoge</label><input id="rc-u" list="rc-ul" placeholder="Ej. Camioneta 1"><datalist id="rc-ul">${unidades.map(u=>`<option value="${esc(u)}">`).join("")}</datalist>
    <div style="margin-top:10px"><label for="rc-n">Nota para el cliente (opcional)</label><input id="rc-n" placeholder="Ej. Llegamos entre 10:00 y 11:00"></div>`,
    actions:`<button class="btn" data-act="recconf2" data-arg="${esc(f)}">Confirmar recolección</button>`});
}
function openRecResched(f, keep){
  const o=ordOf(f), r=o.rec; if(!keep) S.rs={folio:f,fecha:"",desde:r.desde,hasta:r.hasta};
  else S.modals.pop();
  const s=S.rs;
  openModal({title:"Reprogramar recolección", key:"rec", wide:true, html:`<div class="sm" style="margin-bottom:10px"><b>${esc(o.folio)}</b> · ${esc(o.sol.empresa||o.sol.nombre)} · ahora: ${esc(fshort(fromYmd(r.fecha)))} ${esc(recVentana(r))}</div>
    <label>Nuevo día</label>${diasChipsHTML(s.fecha,"rsdia")}<div style="margin-top:12px"><label>Horario</label>${ventanaHTML("rs",s,"rs")}</div>`,
    actions:`<button class="btn" data-act="recre2" data-arg="${esc(f)}">Guardar nuevo horario</button>`});
}
function openSeguroEdit(f){
  const o=ordOf(f), sg=o.seguro||{on:false,valor:0};
  openModal({title:"Seguro de la mercancía", key:"seg", html:`<div class="sm" style="margin-bottom:10px"><b>${esc(o.folio)}</b> · cobro de <b>${CFG.seguroPct}%</b> sobre el valor declarado.</div>
    <label for="se-v">Valor declarado de la mercancía ($, sin IVA)</label><input id="se-v" inputmode="decimal" value="${sg.valor||""}" placeholder="0 para quitar el seguro">
    <div style="margin-top:10px"><label for="se-f">Factura de la mercancía (PDF, XML o imagen)</label><input id="se-f" type="file" accept=".pdf,.xml,image/*" data-ch="segfile2">${sg.file?`<div class="xs mut" style="margin-top:4px">Actual: ${esc(sg.file.name)}</div>`:""}</div>
    ${(o.fac||[]).length?`<div class="note sm" style="margin-top:10px">Este pedido ya tiene factura. Al cambiar el seguro, crea una nueva factura o cancela y vuelve a generar la actual.</div>`:""}`,
    actions:`<button class="btn" data-act="seguro2" data-arg="${esc(f)}">Guardar seguro</button>`});
}
function dataUrlBlob(u){ const [h,b]=u.split(","), m=(h.match(/:(.*?);/)||[])[1]||"application/octet-stream", bin=atob(b), a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:m}); }
function leerArchivo(file, cb){
  if(!file) return; if(file.size>900*1024){ toast("El archivo pesa más de 900 KB. Comprímelo o mándalo por correo.","bad"); return; }
  const r=new FileReader(); r.onload=()=>cb({name:file.name,type:file.type,size:file.size,data:r.result}); r.readAsDataURL(file);
}

function repeatCardHTML(){
  if(Q.base) return `<div class="note info" style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between"><span>Repitiendo <b>${esc(Q.base)}</b>. Cambia lo que necesites y confirma.</span><button class="btn sec sm" data-act="newquote">Empezar de cero</button></div>`;
  const mis=(store.get("alr_mis_v1")||[]).filter(f=>ordOf(f)).slice(0,10);
  return `<div class="card" style="margin-bottom:16px"><div class="h2">¿Ya enviaste antes? Repite un pedido</div><div class="row2"><div><label for="rep-s">Tus pedidos en este dispositivo</label><select id="rep-s"><option value="">— elige —</option>${mis.map(f=>{ const o=ordOf(f); return `<option value="${esc(f)}">${esc(f)} · ${o.totals.piezas} cajas → ${esc(dest(o.dest).name)}</option>`; }).join("")}</select></div><div><label for="rep-f">O escribe un folio</label><input id="rep-f" placeholder="Ej. ALR-2026-0005" autocapitalize="characters" autocomplete="off"></div></div><button class="btn sec sm" style="margin-top:10px" data-act="repsel">Usar como base y modificar</button></div>`;
}
function segRes(){ const r=$("#sg-res"); if(!r) return; const v=parseFloat(Q.seguro.valor)||0; r.innerHTML=`${v>0?`Costo del seguro: <b>${money(v*CFG.seguroPct/100)}</b> + IVA`:"Captura el valor para calcular el seguro."}${Q.seguro.file?` · <b>${esc(Q.seguro.file.name)}</b> adjunta`:""}`; }
