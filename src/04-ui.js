/* ==================== Estado de interfaz ==================== */
const S = { view:"cotizar", mod:"dash", modals:[], drawer:null, done:null, track:"", lab:null, labN:48, back:null,
  fEstado:"todos", fDest:"todos", fq:"", fCliQ:"", ftab:"fac", docTab:"rem", cfgTab:"marca", repDays:30, logQ:"", vtab:"activos", cliSel:null,
  scan:{mode:"recibida", via:"", ord:"", feed:[], cam:false} };
let Q = null;
const newQ = () => ({ dest:CFG.destinos[0].id, items:[{cajaId:CFG.cajas[0].id, qty:1}], sol:{nombre:"",empresa:"",correo:"",tel:""}, dst:{nombre:"",dir:"",tel:""}, serv:{recoleccion:true,entrega:false,seguro:false}, obs:"" });
Q = newQ();
const withDims = it => { if(it.custom) return it; const c=CFG.cajas.find(x=>x.id===it.cajaId)||CFG.cajas[0]; return {...it, cajaId:c.id, l:c.l,a:c.a,h:c.h,kg:c.kg}; };

/* ---- modales y cajón ---- */
function openModal(m){ S.modals.push(m); renderOverlay(); }
function closeModal(){ S.modals.pop(); renderOverlay(); }
function openDoc(html, title){
  openModal({title, wide:true, html:`<div class="sheet" id="doc-sheet">${html}</div>`, actions:SANDBOX?"":`<button class="btn sm" data-act="printdoc">Imprimir / PDF</button>`});
}
function renderOverlay(){
  let h = "";
  if(S.drawer && S.view==="sistema" && ROLE){ const o=ordOf(S.drawer); if(o) h += drawerHTML(o); }
  S.modals.forEach((m,i)=>{ h += `<div class="modal ${m.wide?"wide":""}" data-act="modalbg"><div class="card">
    ${m.title?`<div class="h2">${esc(m.title)}</div>`:""}${m.html}
    <div class="chips noprint" style="margin-top:14px">${m.actions||""}<button class="btn sec sm" data-act="closemodal">Cerrar</button></div></div></div>`; });
  $("#overlay").innerHTML = h;
}

/* ---- marca y navegación ---- */
function applyBrand(){
  const b=CFG.brand, r=document.documentElement.style;
  r.setProperty("--c1",b.c1); r.setProperty("--c2",b.c2);
  document.title = "Cotizador · "+b.short;
  $("#brand").innerHTML = `<img src="${esc(logoSrc())}" alt="${esc(b.short)}"><b>${S.view==="sistema"?"Sistema ALR":"Cotizador en línea"}</b><span class="pill" style="background:rgba(255,255,255,.18);color:#fff">${APP_VERSION}</span>`;
  const tabs = [["cotizar","Cotizar"],["rastreo","Rastrear envío"],["sistema", ROLE?"Sistema ALR":"🔒 Sistema ALR"]];
  $("#nav").innerHTML = tabs.map(([k,t])=>`<button data-act="go" data-arg="${k}" class="${(S.view===k||(S.view==="etiquetas"&&k==="rastreo"))?"on":""}">${t}</button>`).join("");
  $("#foot").innerHTML = `${esc(b.name)} · Cotización sujeta a validación de ALR · Tarifa vigente ${esc(CFG.vigencia)}<br>Demo operativo: los datos se guardan solo en este navegador. <b>Versión ${APP_VERSION}</b> · ${APP_DATE}`;
}
function setView(v, mod){
  S.view=v; if(mod) S.mod=mod; S.done=null; S.drawer=null; S.modals=[];
  try{ history.replaceState(null,"", "#"+(v==="sistema"&&S.mod==="scan"?"escaner":v)); }catch(e){}
  render(); scrollTo(0,0);
}

/* ==================== Cliente: cotizar ==================== */
function etaBox(destId, from){
  const e=eta(destId, from);
  if(!e) return `<div class="eta"><span class="ico">⏱</span><div><b>Tiempo por confirmar</b><span class="sm mut">Este destino se atiende solo ocurre; ALR te avisa cuando llegue.</span></div></div>`;
  return `<div class="eta"><span class="ico">⏱</span><div><b>Entrega estimada: ${esc(etaText(e))}</b><span class="sm mut">${esc(e.txt)} de tránsito · salida estimada ${esc(fshort(e.salida))}</span></div></div>`;
}
function viewCotizar(){
  if(S.done) return viewDone();
  return `
  <div class="hero"><div class="wrap">
    <h1>Cotiza tu envío en 1 minuto</h1>
    <p>Captura tu carga, ve el precio y la fecha estimada de entrega al instante y confirma. Tu pedido llega a ALR ya estructurado, con folio, etiquetas QR y seguimiento.</p>
  </div></div>
  <div class="wrap pull"><div class="layout">
    <div>
      <div class="card">
        <div class="h2"><span class="stepn">1</span>Ruta</div>
        <div class="row2">
          <div><label for="q-orig">Origen</label><input id="q-orig" value="${esc(CFG.origen)}" disabled></div>
          <div><label for="q-dest">Destino</label><select id="q-dest" data-in="qdest">${CFG.destinos.map(d=>`<option value="${d.id}" ${Q.dest===d.id?"selected":""}>${esc(d.name)} · ${esc(d.transit)}</option>`).join("")}</select></div>
        </div>
        <div id="q-ocurre"></div>
      </div>
      <div class="card">
        <div class="h2"><span class="stepn">2</span>Tu carga</div>
        <div id="q-pieces"></div>
        <button class="btn sec sm" data-act="qadd">+ Agregar otra pieza</button>
      </div>
      <div class="card">
        <div class="h2"><span class="stepn">3</span>Servicios</div>
        <div class="grid" style="gap:10px">
          <label class="chk"><input type="checkbox" data-ch="qserv" data-arg="recoleccion" ${Q.serv.recoleccion?"checked":""}><span><b>Recolección en mi domicilio</b><br><span class="mut sm">ALR la coordina; el costo de maniobras se confirma al aceptar el pedido.</span></span></label>
          <label class="chk"><input type="checkbox" data-ch="qserv" data-arg="entrega" ${Q.serv.entrega?"checked":""}><span><b>Entrega en domicilio del destinatario</b><br><span class="mut sm">Costo de reparto se confirma por ALR.</span></span></label>
          <label class="chk"><input type="checkbox" data-ch="qserv" data-arg="seguro" ${Q.serv.seguro?"checked":""}><span><b>Asegurar mi mercancía</b><br><span class="mut sm">ALR te contactará con el procedimiento (factura con subtotal).</span></span></label>
        </div>
      </div>
      <div class="card">
        <div class="h2"><span class="stepn">4</span>Quién envía</div>
        <div class="row2">
          <div><label for="f-sn">Nombre *</label><input id="f-sn" data-in="qf" data-arg="sol.nombre" value="${esc(Q.sol.nombre)}" autocomplete="name"></div>
          <div><label for="f-se">Empresa</label><input id="f-se" data-in="qf" data-arg="sol.empresa" value="${esc(Q.sol.empresa)}"></div>
          <div><label for="f-sc">Correo *</label><input id="f-sc" type="email" data-in="qf" data-arg="sol.correo" value="${esc(Q.sol.correo)}" autocomplete="email"></div>
          <div><label for="f-st">Teléfono *</label><input id="f-st" type="tel" data-in="qf" data-arg="sol.tel" value="${esc(Q.sol.tel)}" autocomplete="tel"></div>
        </div>
      </div>
      <div class="card">
        <div class="h2"><span class="stepn">5</span>Quién recibe</div>
        <div class="row2">
          <div><label for="f-dn">Nombre o razón social *</label><input id="f-dn" data-in="qf" data-arg="dst.nombre" value="${esc(Q.dst.nombre)}"></div>
          <div><label for="f-dt">Teléfono *</label><input id="f-dt" type="tel" data-in="qf" data-arg="dst.tel" value="${esc(Q.dst.tel)}"></div>
        </div>
        <div style="margin-top:12px"><label for="f-dd">Dirección de entrega *</label><input id="f-dd" data-in="qf" data-arg="dst.dir" value="${esc(Q.dst.dir)}" placeholder="Calle, número, colonia, ciudad"></div>
        <div style="margin-top:12px"><label for="f-ob">Observaciones</label><textarea id="f-ob" rows="2" data-in="qf" data-arg="obs" placeholder="Horarios, referencias, carga frágil…">${esc(Q.obs)}</textarea></div>
        <div class="note info sm" style="margin-top:12px">Si el destinatario es nuevo, ALR lo da de alta en 1–2 días hábiles antes de la recolección.</div>
      </div>
    </div>
    <aside class="sticky"><div class="card sum" id="q-sum"></div></aside>
  </div></div>`;
}
function metaHTML(it){
  const p = pieceCalc(withDims(it), Q.dest), w = withDims(it);
  return it.custom
    ? (p.line>0?`Estimado ${money(p.line)} · ${num(p.m3,3)} m³ · cobrable ${num(Math.max(p.kg,p.kgVol))} kg. <b>Requiere validación de ALR.</b>`:"Captura las medidas y el peso.")
    : `${money(p.unit)} por pieza · ${num(w.l*w.a*w.h/1e6,4)} m³ c/u · <b>${money(p.line)}</b>`;
}
function pieceRow(it,i){
  const opts = CFG.cajas.map(c=>`<option value="${c.id}" ${!it.custom&&it.cajaId===c.id?"selected":""}>${esc(c.name)} — ${c.l}×${c.a}×${c.h} cm · ${c.kg} kg</option>`).join("") + `<option value="custom" ${it.custom?"selected":""}>Otra medida…</option>`;
  return `<div class="piece" data-i="${i}">
    <div class="head">
      <div><label for="pt${i}">Tipo de caja</label><select id="pt${i}" data-in="ptipo">${opts}</select></div>
      <div><label for="pq${i}">Cantidad</label><input id="pq${i}" type="text" inputmode="numeric" autocomplete="off" value="${it.qty||""}" data-in="pfield" data-arg="qty" placeholder="1"></div>
      <button class="x" data-act="pdel" ${Q.items.length<2?"disabled style='opacity:.3'":""} aria-label="Quitar pieza">×</button>
    </div>
    ${it.custom?`<div class="dim">
      <div><label for="pl${i}">Largo cm</label><input id="pl${i}" type="number" min="1" data-in="pfield" data-arg="l" value="${it.l||""}"></div>
      <div><label for="pa${i}">Ancho cm</label><input id="pa${i}" type="number" min="1" data-in="pfield" data-arg="a" value="${it.a||""}"></div>
      <div><label for="ph${i}">Alto cm</label><input id="ph${i}" type="number" min="1" data-in="pfield" data-arg="h" value="${it.h||""}"></div>
      <div><label for="pk${i}">Peso kg c/u</label><input id="pk${i}" type="number" min="0.1" step="0.1" data-in="pfield" data-arg="kg" value="${it.kg||""}"></div>
    </div>`:""}
    <div class="meta">${metaHTML(it)}</div>
  </div>`;
}
function renderPieces(){ $("#q-pieces").innerHTML = Q.items.map(pieceRow).join(""); }
function qvalid(){
  const m=[];
  if(!Q.sol.nombre.trim()) m.push("nombre del remitente");
  if(!/^\S+@\S+\.\S+$/.test(Q.sol.correo.trim())) m.push("correo válido");
  if(Q.sol.tel.replace(/\D/g,"").length<8) m.push("teléfono");
  if(!Q.dst.nombre.trim()) m.push("destinatario");
  if(!Q.dst.dir.trim()) m.push("dirección de entrega");
  if(Q.dst.tel.replace(/\D/g,"").length<8) m.push("teléfono del destinatario");
  if(Q.items.some(i=>!(i.qty>=1))) m.push("cantidad de cajas");
  if(Q.items.some(i=>i.custom&&!(i.l>0&&i.a>0&&i.h>0&&i.kg>0))) m.push("medidas de la pieza especial");
  return {ok:!m.length, msg:m.length?"Falta: "+m.join(", "):""};
}
function renderSummary(){
  const items = Q.items.map(withDims).filter(it=>it.l>0&&it.a>0&&it.h>0&&it.kg>0&&it.qty>0);
  const c = calc(Q.dest, items), d = dest(Q.dest), v = qvalid();
  $("#q-sum").innerHTML = `
    <div class="h2" style="margin-bottom:10px">Resumen</div>
    <div class="mut sm" style="margin-bottom:12px">${esc(CFG.origen)} → <b>${esc(d.name)}</b> · ${esc(d.transit)}</div>
    <dl>
      <dt>Piezas</dt><dd class="mono">${c.piezas}</dd>
      <dt>Volumen</dt><dd class="mono">${num(c.m3,3)} m³</dd>
      <dt>Peso real</dt><dd class="mono">${num(c.kg)} kg</dd>
      <dt class="mut">Volumétrico (referencia)</dt><dd class="mono mut">${num(c.kgVol)} kg</dd>
      ${c.est?`<dt>Peso cobrable</dt><dd class="mono">${num(c.kgCob)} kg</dd>`:""}
      <dt>Flete</dt><dd class="mono">${money(c.sub)}</dd>
      ${c.discPct?`<dt>Descuento por volumen ${c.discPct}%</dt><dd class="mono">−${money(c.disc)}</dd>`:""}
      ${c.minApplied?`<dt>Mínimo por embarque</dt><dd class="mono">${money(CFG.minimo)}</dd>`:""}
      <dt>IVA ${CFG.iva}%</dt><dd class="mono">${money(c.iva)}</dd>
    </dl>
    <div class="tot"><span>Total</span><b class="mono">${money(c.total)}</b></div>
    ${etaBox(Q.dest)}
    ${c.lines.length&&!c.est?`<div class="mut sm" style="margin-top:12px">Las cajas de catálogo se cobran por pieza; el peso volumétrico es solo de referencia.</div>`:""}
    ${c.minApplied?`<div class="note sm" style="margin-top:12px">Se aplicó el mínimo por embarque de ${money(CFG.minimo)}.</div>`:""}
    ${c.est?`<div class="note sm" style="margin-top:12px">Incluye medida especial: precio estimado. ALR lo confirmará al revisar tu pedido.</div>`:""}
    ${d.ocurre?`<div class="note sm" style="margin-top:12px">${esc(d.name)}: entrega solo <b>ocurre</b> (el destinatario recoge en terminal ALR).</div>`:""}
    <button class="btn" data-act="qsend" style="width:100%;margin-top:16px;padding:14px" ${c.total>0&&v.ok?"":"disabled"}>Confirmar pedido</button>
    <div class="mut sm" style="margin-top:8px;text-align:center">${esc(v.msg)||"Sin pago en línea. ALR confirma tu pedido y te asigna guía."}</div>
    <div class="mut sm" style="margin-top:10px;text-align:center">Tarifa vigente ${esc(CFG.vigencia)}</div>`;
}
function renderOcurre(){ const d=dest(Q.dest); $("#q-ocurre").innerHTML = d.ocurre?`<div class="note" style="margin-top:12px">Este destino se atiende <b>solo ocurre</b>: el destinatario recoge en la terminal de ALR.</div>`:""; }

function viewDone(){
  const o = ordOf(S.done); if(!o){ S.done=null; return viewCotizar(); }
  return `<div class="wrap" style="padding-top:30px;max-width:720px">
    <div class="card" style="text-align:center">
      <div class="ok-big">✓</div>
      <h1 style="font-size:26px">¡Pedido recibido!</h1>
      <p class="mut">ALR lo revisará y te confirmará con tu guía de envío.</p>
      <div style="margin:18px 0;padding:16px;background:var(--bg);border-radius:12px">
        <div class="mut sm">Tu folio</div><div style="font-size:30px;font-weight:800;color:var(--c1);letter-spacing:1px">${esc(o.folio)}</div>
        <div class="mut sm">Total ${money(o.totals.total)} · ${esc(CFG.origen)} → ${esc(dest(o.dest).name)} · ${o.totals.piezas} cajas</div>
      </div>
      ${etaBox(o.dest,o.createdAt)}
      <div class="note info sm" style="margin:16px 0;text-align:left"><b>Siguiente paso:</b> imprime una etiqueta QR por cada caja y pégala en un lugar visible. ALR las escanea al recibir, cargar y entregar, y tú ves en cuál punto va cada una.</div>
      <div class="chips" style="justify-content:center">
        <button class="btn" data-act="labels" data-arg="${esc(o.folio)}">Imprimir etiquetas QR (${o.totals.piezas})</button>
        <button class="btn sec" data-act="track" data-arg="${esc(o.folio)}">Ver seguimiento</button>
        <button class="btn sec" data-act="copytxt" data-arg="${esc(o.folio)}">Copiar resumen</button>
        <button class="btn sec" data-act="newquote">Nueva cotización</button>
      </div>
      <p class="mut sm" style="margin-top:16px">Guarda tu folio: con él consultas el estado de tu envío cuando quieras.</p>
    </div></div>`;
}

/* ==================== Cliente: rastreo y etiquetas ==================== */
function timelineHTML(o){
  const cur = stIdx(o);
  if(o.cancelado) return `<div class="note bad">Este pedido fue cancelado.</div>`;
  return `<ul class="tl">${CFG.steps.map((s,i)=>{
    const h = [...o.history].reverse().find(x=>x.k===s.k);
    const cls = i<cur?"done":i===cur?(s.k==="entregado"?"done":"cur"):"todo";
    return `<li class="${cls}"><span class="dot">${cls==="done"?"✓":""}</span><b>${esc(s.t)}</b>
      <span class="when">${h?fdate(h.at):"Pendiente"}</span>
      ${h&&h.note?`<div class="sm">${esc(h.note)}</div>`:""}
      ${cls==="cur"?`<div class="sm mut">${esc(s.d)}</div>`:""}</li>`;
  }).join("")}</ul>`;
}
function boxProgress(o, big){
  const c=stageCounts(o), n=o.sc.length;
  const seg=[5,4,3,2,1,0].map(i=>c[i]?`<i style="width:${c[i]/n*100}%;background:${stageColor(i)}" title="${i?STAGES[i-1].t:"Sin escanear"}: ${c[i]}"></i>`:"").join("");
  const rec=n-c[0];
  return `<div class="stack">${seg}</div><div class="legend">${[1,2,3,4,5].filter(i=>c[i]).map(i=>`<span><i style="background:${stageColor(i)}"></i>${STAGES[i-1].t}: ${c[i]}</span>`).join("")}${c[0]?`<span><i style="background:${stageColor(0)}"></i>Sin escanear: ${c[0]}</span>`:""}</div>
    ${big?`<div class="sm" style="margin-top:8px"><b>${rec} de ${n}</b> cajas ya fueron recibidas por ALR${rec===n?" ✓":""}</div>`:""}`;
}
function viewRastreo(){
  const q=(S.track||"").trim().toLowerCase();
  const pb = parseBox(S.track);
  const o = q ? (pb?ordOf(pb.folio):DB.ord.find(x=>x.folio.toLowerCase()===q || (x.guia&&x.guia.toLowerCase()===q))) : null;
  const e = o ? eta(o.dest,o.createdAt) : null;
  return `<div class="hero"><div class="wrap"><h1>Rastrea tu envío</h1><p>Captura tu folio o número de guía para ver en qué punto va tu carga.</p></div></div>
  <div class="wrap pull" style="max-width:760px">
    <div class="card">
      <form data-form="track" style="display:flex;gap:10px"><label for="t-in" style="display:none">Folio o guía</label><input id="t-in" placeholder="Ej. ALR-2026-0003 o ALR-G-48202" value="${esc(S.track)}" style="flex:1"><button class="btn">Buscar</button></form>
      <div class="mut sm" style="margin-top:8px">Prueba con: ${DB.ord.filter(x=>x.rem).slice(0,3).map(x=>`<a href="#rastreo" data-act="track" data-arg="${esc(x.folio)}" style="color:var(--c1)">${esc(x.folio)}</a>`).join(" · ")}</div>
    </div>
    ${S.track&&!o?`<div class="card"><b>No encontramos ese folio.</b><div class="mut sm">Verifica que esté completo (ej. ALR-2026-0001).</div></div>`:""}
    ${o?`<div class="card">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px">
        <div><div class="mut sm">Folio</div><h2 style="font-size:22px">${esc(o.folio)}</h2></div>
        <div class="r"><div class="mut sm">Guía</div><b>${esc(o.guia||"Por asignar")}</b></div>
      </div>
      <div class="mut sm" style="margin-bottom:6px">${esc(CFG.origen)} → <b>${esc(dest(o.dest).name)}</b> · ${o.totals.piezas} cajas · ${num(o.totals.m3,3)} m³ · Destinatario: ${esc(o.dst.nombre)}</div>
      ${o.status==="entregado"?`<div class="note ok" style="margin:12px 0"><b>Entregado</b>${o.pod?` a ${esc(o.pod.nombre)} · ${fdate(o.pod.at)}`:""}</div>`:(o.cancelado?"":etaBox(o.dest,o.createdAt))}
      <div style="margin:16px 0"><div class="tag" style="margin-bottom:6px">Tus cajas</div>${boxProgress(o,true)}</div>
      ${timelineHTML(o)}
      <div class="chips" style="margin-top:6px"><button class="btn sec sm" data-act="labels" data-arg="${esc(o.folio)}">Imprimir etiquetas QR</button></div>
    </div>`:""}
  </div>`;
}
function viewEtiquetas(){
  const o=ordOf(S.lab); if(!o){ return `<div class="wrap" style="padding:30px 0"><div class="card">Pedido no encontrado.</div></div>`; }
  const L = etiquetasHTML(o, S.labN);
  return `<div class="wrap" style="padding:24px 16px">
    <div class="card noprint" style="margin-bottom:16px">
      <div class="h2">Etiquetas QR · ${esc(o.folio)}</div>
      <p class="mut" style="margin:0 0 12px">Una etiqueta por caja (${L.total}). Imprímelas y pégalas en un lugar plano y visible. ALR las escanea con el teléfono al recibir, cargar y entregar.</p>
      <div class="chips">${SANDBOX?"":`<button class="btn" data-act="printlabels">Imprimir etiquetas</button>`}<button class="btn sec" data-act="${S.back==="sistema"?"back":"track"}" data-arg="${esc(o.folio)}">← Volver</button>
      ${L.shown<L.total?`<button class="btn sec" data-act="labmore">Mostrar más (${L.shown} de ${L.total})</button>`:""}</div>
      ${SANDBOX?`<div class="note info sm" style="margin-top:12px">Para imprimir, abre el sistema en su dirección web (esta vista previa no permite imprimir).</div>`:""}
    </div>
    <div class="labels" id="labels-area">${L.html}</div></div>`;
}
