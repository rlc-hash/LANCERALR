/* ==================== Sistema ALR: acceso y estructura ==================== */
function allowed(m){ return ROLE && ROLES[ROLE].mods.includes(m); }
function badge(o){
  if(o.cancelado) return `<span class="pill bad">Cancelado</span>`;
  const cls = o.status==="entregado"?"ok":o.status==="solicitado"?"warn":"red";
  return `<span class="pill ${cls}">${esc(stLabel(o.status))}</span>`;
}
function atrasado(o){ if(o.cancelado||o.status==="entregado") return false; const e=eta(o.dest,o.createdAt); return !!e && Date.now()>e.max.getTime()+DAY; }

function viewSistema(){
  if(!ROLE) return `<div class="wrap" style="padding:36px 16px"><div class="card" style="max-width:520px;margin:0 auto">
    <h2 style="font-size:24px">Sistema ALR</h2><p class="mut">Operación, almacén, facturación y control de envíos. Elige tu perfil para entrar.</p>
    <form data-form="login">
      <div class="grid" style="gap:8px;margin-bottom:14px">${Object.entries(ROLES).filter(([k,r])=>!r.hidden).map(([k,r],i)=>`<label class="chk"><input type="radio" name="role" value="${k}" ${i===0?"checked":""}><span><b>${esc(r.t)}</b><br><span class="mut sm">${esc(r.who)}</span></span></label>`).join("")}</div>
      <label for="pin">PIN</label><input id="pin" type="password" inputmode="numeric" placeholder="PIN" autocomplete="off">
      <button class="btn" style="width:100%;margin-top:12px">Entrar</button>
    </form>
    ${S.pendingScan||S.pendingGuia?`<div class="note info sm" style="margin-top:12px">Inicia sesión para abrir lo que escaneaste.</div>`:""}
    <div class="mut sm" style="margin-top:12px">Demo: PIN <b>${esc(CFG.pin)}</b>. Cada perfil ve solo los módulos que le corresponden.</div></div></div>`;
  if(!allowed(S.mod)) S.mod = ROLES[ROLE].mods[0];
  const porConf = DB.ord.filter(o=>!o.cancelado&&o.status==="solicitado").length;
  const venc = DB.fac.filter(f=>facEstado(f)==="vencida").length;
  const nb = {pedidos:porConf, fact:venc, reco:DB.ord.filter(o=>!o.cancelado&&recVigente(o)&&o.rec.estado==="solicitada").length};
  const nav = ROLES[ROLE].mods.map(m=>`<button class="nv ${S.mod===m?"on":""}" data-act="mod" data-arg="${m}"><span>${MODS[m].ic}</span>${MODS[m].t}${nb[m]?`<span class="n">${nb[m]}</span>`:""}</button>`).join("");
  const body = {dash:modDash,reco:modReco,oper:modOper,practica:modPractica,pedidos:modPedidos,scan:modScan,viajes:modViajes,almacen:modAlmacen,clientes:modClientes,fact:modFact,docs:modDocs,reportes:modReportes,config:modConfig,bitacora:modBitacora}[S.mod]();
  return `<div class="erp"><aside class="side"><div class="who"><span class="tag">Sesión</span><b>${esc(ROLES[ROLE].t)}</b><button class="btn ghost sm" style="padding:0" data-act="logout">Cerrar sesión</button></div>${nav}<button class="nv" data-act="logout"><span>⎋</span>Salir</button></aside><div class="main">${body}</div></div>`;
}
/* ---- resumen de envío (se reutiliza en facturas, guías, remisiones y escáner) ---- */
function envioLinea(o){
  if(o.cancelado) return "Cancelado";
  const n=o.sc.length, rec=n-stageCounts(o)[0], e=eta(o.dest,o.createdAt);
  if(o.status==="entregado") return `Entregado${o.pod?` a ${o.pod.nombre}`:""}`;
  return `${stLabel(o.status)} · ${rec}/${n} cajas${e?` · llega ${etaText(e)}`:""}`;
}
function miniSteps(o){ const cur=stIdx(o); return `<div class="mini">${CFG.steps.map((s,i)=>`<span class="${i<cur||(i===cur&&s.k==="entregado")?"d":i===cur?"c":""}" title="${esc(s.t)}"></span>`).join("")}</div>`; }
function envioResumen(o){
  const e=eta(o.dest,o.createdAt), last=o.history[o.history.length-1];
  return `<div class="card flat" style="margin-top:10px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><b>${esc(o.folio)}</b> ${badge(o)}<div class="sm mut">${esc(CFG.origen)} → <b>${esc(dest(o.dest).name)}</b> · Guía ${esc(o.guia||"—")} · Remisión ${esc(o.rem||"—")}</div></div>
    <div class="r sm">${e&&o.status!=="entregado"&&!o.cancelado?`Llega <b>${esc(etaText(e))}</b>`:""}${atrasado(o)?` <span class="pill bad">atrasado</span>`:""}</div></div>
    ${miniSteps(o)}<div class="sm" style="margin:6px 0">${esc(stLabel(o.status))}${last&&last.note?` · ${esc(last.note)}`:""} <span class="mut">(${fdate(last.at)})</span></div>
    ${boxProgress(o,true)}${o.pod?`<div class="note ok sm" style="margin-top:8px">Entregado a ${esc(o.pod.nombre)}${o.pod.id?` · ${esc(o.pod.id)}`:""} · ${fdate(o.pod.at)}</div>`:""}
    <div class="chips noprint" style="margin-top:10px"><button class="btn sec sm" data-act="open" data-arg="${esc(o.folio)}">Ver envío completo</button><button class="btn sec sm" data-act="doc" data-arg="guia|${esc(o.folio)}">Guía</button><button class="btn sec sm" data-act="doc" data-arg="rem|${esc(o.folio)}">Remisión</button></div></div>`;
}
const ptitle = (t,right) => `<div class="ptitle"><h2>${esc(t)}</h2><div style="margin-left:auto" class="chips">${right||""}</div></div>`;

/* ==================== Panel general ==================== */
function bar(label,val,max,cls,txt){ return `<div class="br"><span>${esc(label)}</span><div class="tr"><i class="${cls||""}" style="width:${max?Math.max(2,val/max*100):0}%"></i></div><b class="mono r">${txt??val}</b></div>`; }
function modDash(){
  const act = DB.ord.filter(o=>!o.cancelado);
  const porConf = act.filter(o=>o.status==="solicitado");
  const enOp = act.filter(o=>stIdx(o)>=1&&o.status!=="entregado");
  const cajasRuta = act.reduce((s,o)=>s+stageCounts(o)[3],0);
  const entreg = act.filter(o=>o.status==="entregado").length;
  const emit = DB.fac.filter(f=>["emitida","vencida"].includes(facEstado(f)));
  const porCobrar = emit.reduce((s,f)=>s+facSaldo(f),0);
  const vencido = DB.fac.filter(f=>facEstado(f)==="vencida").reduce((s,f)=>s+facSaldo(f),0);
  const alerts=[];
  porConf.forEach(o=>alerts.push({k:"warn",t:`${o.folio} sin confirmar desde ${fdate(o.createdAt)}`,s:`${o.sol.empresa||o.sol.nombre} · ${money(o.totals.total)}`,a:"open",arg:o.folio}));
  act.filter(atrasado).forEach(o=>alerts.push({k:"bad",t:`${o.folio} con retraso`,s:`Debió llegar ${etaText(eta(o.dest,o.createdAt))} · ${stLabel(o.status)}`,a:"open",arg:o.folio}));
  DB.fac.filter(f=>facEstado(f)==="vencida").forEach(f=>alerts.push({k:"bad",t:`Factura ${f.id} vencida`,s:`${cliOf(f.cli).razon} · saldo ${money(facSaldo(f))}`,a:"modgo",arg:"fact"}));
  DB.via.filter(v=>v.status==="cargando").forEach(v=>alerts.push({k:"warn",t:`${v.id} cargando (${v.unidad})`,s:`Faltan ${viajeFaltantes(v)} cajas por subir · destino ${dest(v.dest).name}`,a:"modgo",arg:"viajes"}));
  act.filter(o=>(o.inc||[]).some(x=>x.tipo==="medidas")).forEach(o=>alerts.push({k:"bad",t:`${o.folio} con medidas fuera de lo declarado`,s:"Revisar ajuste de tarifa",a:"open",arg:o.folio}));
  { const rp=DB.ord.filter(o=>!o.cancelado&&recVigente(o)&&o.rec.estado==="solicitada"); if(rp.length) alerts.push({k:"warn",t:`${rp.length} recolección(es) por confirmar`,s:`La más próxima: ${fshort(fromYmd(rp.map(o=>o.rec.fecha).sort()[0]))}`,a:"modgo",arg:"reco"}); }
  act.filter(o=>o.totals.est&&o.status==="solicitado").forEach(o=>alerts.push({k:"warn",t:`${o.folio} con medida especial`,s:"Validar precio antes de confirmar",a:"open",arg:o.folio}));
  DB.cli.filter(c=>c.pendiente).forEach(c=>alerts.push({k:"warn",t:`Cliente ${c.razon} sin datos fiscales`,s:"Completar RFC y régimen para facturar",a:"modgo",arg:"clientes"}));
  const porEtapa = CFG.steps.map(s=>({t:s.t,n:act.filter(o=>o.status===s.k).length}));
  const maxE = Math.max(1,...porEtapa.map(x=>x.n));
  const porDest = CFG.destinos.map(d=>({t:d.name,v:act.filter(o=>o.dest===d.id).reduce((s,o)=>s+o.totals.total,0),n:act.filter(o=>o.dest===d.id).length}));
  const maxD = Math.max(1,...porDest.map(x=>x.v));
  const tot=[0,0,0,0,0,0]; act.forEach(o=>stageCounts(o).forEach((v,i)=>tot[i]+=v)); const T=tot.reduce((a,b)=>a+b,0)||1;
  return `${ptitle("Panel general",`<span class="mut sm">${fday(Date.now())}</span>`)}
  <div class="kpis">
    <div class="kpi w"><small>Por confirmar</small><b>${porConf.length}</b><span>pedidos nuevos</span></div>
    <div class="kpi"><small>En operación</small><b>${enOp.length}</b><span>confirmados, sin entregar</span></div>
    <div class="kpi b"><small>Cajas en ruta</small><b>${cajasRuta}</b><span>escaneadas en camión</span></div>
    <div class="kpi g"><small>Entregados</small><b>${entreg}</b><span>pedidos completos</span></div>
    <div class="kpi b"><small>Por cobrar</small><b>${money0(porCobrar)}</b><span>${emit.length} facturas abiertas</span></div>
    <div class="kpi"><small>Vencido</small><b>${money0(vencido)}</b><span>cartera vencida</span></div>
  </div>
  <div class="grid g2">
    <div class="card"><div class="h2">Requiere atención <span class="pill ${alerts.length?"red":"ok"}">${alerts.length}</span></div>
      ${alerts.length?alerts.slice(0,9).map(a=>`<div class="feed"><div class="it ${a.k}" style="justify-content:space-between"><span><b style="font-family:inherit">${esc(a.t)}</b><br><span class="xs">${esc(a.s)}</span></span><button class="btn sec sm" data-act="${a.a}" data-arg="${esc(a.arg)}">Abrir</button></div></div>`).join(""):`<div class="note ok">Todo en orden.</div>`}</div>
    <div class="card"><div class="h2">Pedidos por etapa</div><div class="bars">${porEtapa.map(x=>bar(x.t,x.n,maxE,"")).join("")}</div>
      <div class="h2" style="margin-top:18px">Cajas por etapa de escaneo</div>
      <div class="stack">${[5,4,3,2,1,0].map(i=>tot[i]?`<i style="width:${tot[i]/T*100}%;background:${stageColor(i)}"></i>`:"").join("")}</div>
      <div class="legend">${[1,2,3,4,5,0].map(i=>`<span><i style="background:${stageColor(i)}"></i>${i?STAGES[i-1].t:"Sin escanear"}: ${tot[i]}</span>`).join("")}</div></div>
    <div class="card"><div class="h2">Valor por destino</div><div class="bars">${porDest.map(x=>bar(`${x.t} (${x.n})`,x.v,maxD,"r",money0(x.v))).join("")}</div></div>
    <div class="card"><div class="h2">Actividad reciente</div>${DB.log.slice(0,8).map(l=>`<div class="sm" style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${esc(l.accion)}</b> <span class="mut">· ${esc(l.detalle)}</span><div class="xs mut">${fdate(l.at)} · ${esc(l.rol)}</div></div>`).join("")||`<div class="mut">Sin actividad.</div>`}</div>
  </div>`;
}

/* ==================== Pedidos ==================== */
function modPedidos(){
  const q = S.fq.toLowerCase();
  const list = DB.ord.filter(o=>{
    if(S.fEstado!=="todos" && (S.fEstado==="cancelado"?!o.cancelado:(o.cancelado||o.status!==S.fEstado))) return false;
    if(S.fDest!=="todos" && o.dest!==S.fDest) return false;
    if(q && !(o.folio+o.sol.nombre+o.sol.empresa+o.dst.nombre+(o.guia||"")).toLowerCase().includes(q)) return false;
    return true;
  });
  return `${ptitle("Pedidos",`<button class="btn sm" data-act="go" data-arg="cotizar">+ Capturar pedido</button>`)}
  <div class="card" style="padding:16px">
    <div class="toolbar">
      <label for="f-q" style="display:none">Buscar</label><input id="f-q" data-in="fq" placeholder="Buscar folio, cliente, guía…" value="${esc(S.fq)}">
      <label for="f-est" style="display:none">Estatus</label><select id="f-est" data-ch="fEstado"><option value="todos">Todos los estatus</option>${CFG.steps.map(s=>`<option value="${s.k}" ${S.fEstado===s.k?"selected":""}>${esc(s.t)}</option>`).join("")}<option value="cancelado" ${S.fEstado==="cancelado"?"selected":""}>Cancelados</option></select>
      <label for="f-dst" style="display:none">Destino</label><select id="f-dst" data-ch="fDest"><option value="todos">Todos los destinos</option>${CFG.destinos.map(d=>`<option value="${d.id}" ${S.fDest===d.id?"selected":""}>${esc(d.name)}</option>`).join("")}</select>
      <span class="mut sm" style="margin-left:auto">${list.length} pedido(s)</span>
      <button class="btn sec sm" data-act="exportorders">Exportar</button>
    </div>
    <div class="scroll"><table class="rt">
      <thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Destino</th><th>Entrega est.</th><th class="r">Cajas</th><th class="r">m³</th><th class="r">Total</th><th>Escaneo</th><th>Estatus</th></tr></thead>
      <tbody>${list.map(o=>{ const c=stageCounts(o), e=eta(o.dest,o.createdAt), n=o.sc.length, rec=n-c[0];
        return `<tr class="click" data-act="open" data-arg="${esc(o.folio)}">
        <td><b>${esc(o.folio)}</b>${o.totals.est?` <span class="pill warn" title="Medida especial">validar</span>`:""}${atrasado(o)?` <span class="pill bad">atrasado</span>`:""}</td>
        <td class="sm mut">${fdate(o.createdAt)}</td>
        <td>${esc(o.sol.empresa||o.sol.nombre)}<div class="sm mut">${esc(o.sol.nombre)}</div></td>
        <td>${esc(dest(o.dest).name)}</td>
        <td class="sm">${e?esc(etaText(e)):"por confirmar"}</td>
        <td class="r mono">${o.totals.piezas}</td><td class="r mono">${num(o.totals.m3,2)}</td>
        <td class="r mono"><b>${money(o.totals.total)}</b></td>
        <td class="sm mono">${stIdx(o)>=1?`${rec}/${n}`:"—"}</td><td>${badge(o)}</td></tr>`; }).join("")||`<tr><td colspan="10" class="mut c" style="padding:30px">Sin pedidos con esos filtros.</td></tr>`}</tbody>
    </table></div></div>`;
}

/* ---- detalle del pedido ---- */
function faltantesTxt(o, minStage){
  const out=[]; for(let i=0;i<o.sc.length;i++) if(+o.sc[i]<minStage) out.push(i+1);
  return out.length ? (out.length>40?out.slice(0,40).join(", ")+` … (+${out.length-40})`:out.join(", ")) : "";
}
function drawerHTML(o){
  const t=o.totals, d=dest(o.dest), i=stIdx(o), next=CFG.steps[i+1], e=eta(o.dest,o.createdAt), cl=cliOf(o.cli), n=o.sc.length, c=stageCounts(o);
  const facs=o.fac.map(facOf).filter(Boolean);
  const falt=faltantesTxt(o,1);
  return `<div class="drawer-bg" data-act="drawerbg"><div class="drawer">
    <div class="noprint" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <button class="btn sec sm" data-act="closedrawer">← Volver</button>
      <div class="chips"><button class="btn sec sm" data-act="doc" data-arg="guia|${esc(o.folio)}">Guía</button><button class="btn sec sm" data-act="doc" data-arg="rem|${esc(o.folio)}">Remisión</button><button class="btn sec sm" data-act="labels" data-arg="${esc(o.folio)}" data-from="sistema">Etiquetas QR</button><button class="btn sec sm" data-act="repeat" data-arg="${esc(o.folio)}">Repetir pedido</button><a class="btn sec sm" href="${esc(waLink(o.sol.tel,shareText(o)))}" target="_blank" rel="noopener">Enviar WhatsApp</a><a class="btn sec sm" href="${esc(mailLink(o.sol.correo,`Pedido ${o.folio} · ${CFG.brand.short}`,shareText(o)))}" target="_blank" rel="noopener">Enviar correo</a><button class="btn sec sm" data-act="copytxt" data-arg="${esc(o.folio)}">Copiar</button></div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div><h2 style="font-size:24px">${esc(o.folio)}</h2><div class="mut sm">${fdate(o.createdAt)} · ${esc(CFG.origen)} → <b>${esc(d.name)}</b> (${esc(d.transit)})</div>
          <div class="sm" style="margin-top:4px">${e?`Entrega estimada: <b>${esc(etaText(e))}</b>`:"Entrega: por confirmar (solo ocurre)"}</div></div>
        <div class="r">${badge(o)}<div class="sm mut" style="margin-top:6px">Guía <b>${esc(o.guia||"—")}</b> · Remisión <b>${esc(o.rem||"—")}</b></div></div>
      </div>
      ${t.est?`<div class="note sm" style="margin-top:12px">⚠ Contiene medida especial. Precio estimado: validar con tarifa real antes de confirmar.</div>`:""}
      ${atrasado(o)?`<div class="note bad sm" style="margin-top:12px">Este pedido va con retraso respecto a la fecha estimada.</div>`:""}
    </div>
    ${o.status==="solicitado"&&!o.cancelado?`<div class="card noprint" style="border:2px solid var(--c1)"><div class="h2">Confirmar pedido</div><p class="mut sm" style="margin:0 0 12px">Al confirmar se asigna número de guía y se genera la remisión. El cliente lo ve de inmediato en su seguimiento.</p><button class="btn" data-act="confirmord" data-arg="${esc(o.folio)}">Confirmar y generar guía + remisión</button></div>`:""}
    ${recVigente(o)?`<div class="card"><div class="h2">Recolección</div>${recCard(o)}<button class="btn sec sm noprint" data-act="recver" data-arg="${esc(o.folio)}">Ver en el calendario</button></div>`:""}
    <div class="card"><div class="h2">Seguro de la mercancía</div>${o.seguro&&o.seguro.on?`<div class="sm">Valor declarado <b>${money(t.seguroValor)}</b> · seguro ${CFG.seguroPct}% = <b>${money(t.seguro)}</b>${o.seguro.file?`<br>Factura de la mercancía: <b>${esc(o.seguro.file.name)}</b> (${num(o.seguro.file.size/1024,0)} KB)`:`<br><span class="mut">Sin factura de mercancía adjunta.</span>`}</div><div class="chips noprint" style="margin-top:10px">${o.seguro.file?`<button class="btn sec sm" data-act="segdl" data-arg="${esc(o.folio)}">Ver / descargar factura</button>`:""}<button class="btn sec sm" data-act="segedit" data-arg="${esc(o.folio)}">Editar seguro</button></div>`:`<div class="sm mut">Este pedido no tiene seguro.</div><button class="btn sec sm noprint" style="margin-top:10px" data-act="segedit" data-arg="${esc(o.folio)}">Agregar seguro (${CFG.seguroPct}%)</button>`}</div>
    ${(o.inc||[]).length?`<div class="card" style="border:2px solid #e0a21b"><div class="h2">Incidencias <span class="pill warn">${o.inc.length}</span></div>${o.inc.map(x=>`<div class="sm" style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${esc(x.tipo==="medidas"?"Medidas":x.tipo==="conteo"?"Conteo":"Nota")}</b> · ${esc(x.detalle)}${x.extra>0?` · ajuste estimado <b>${money(x.extra)}</b>`:""}<div class="xs mut">${fdate(x.at)} · ${esc(x.por)}</div></div>`).join("")}</div>`:""}
    <div class="card"><div class="h2">Cajas escaneadas <span class="pill ${n-c[0]===n?"ok":"warn"}">${n-c[0]} de ${n} recibidas</span></div>
      ${boxProgress(o,false)}
      ${o.conf&&o.conf.recepcion?`<div class="sm" style="margin-top:8px">Almacén confirmó <b>${o.conf.recepcion.cajas} de ${o.conf.recepcion.de}</b> cajas${o.conf.recepcion.nombre?` · ${esc(o.conf.recepcion.nombre)}`:""} · ${fdate(o.conf.recepcion.at)}</div>`:""}
      ${o.pod&&o.pod.cajas!=null?`<div class="sm">Cliente confirmó <b>${o.pod.cajas} de ${o.pod.de}</b> cajas · ${esc(o.pod.nombre)} · ${fdate(o.pod.at)}</div>`:""}
      ${stIdx(o)>=1&&!o.cancelado?`<div class="chips noprint" style="margin-top:8px"><button class="btn sec sm" data-act="corregir" data-arg="${esc(o.folio)}">Corregir conteo</button></div>`:""}
      ${stIdx(o)>=1&&falt?`<div class="note sm" style="margin-top:10px"><b>Faltan por recibir en almacén:</b> cajas ${esc(falt)}</div>`:""}
      ${stIdx(o)>=1&&!falt?`<div class="note ok sm" style="margin-top:10px">Conciliación completa: las ${n} cajas fueron recibidas.</div>`:""}
      <div class="boxes">${n<=400?Array.from({length:n},(_,k)=>`<i class="s${o.sc[k]}" title="Caja ${k+1}"></i>`).join(""):""}</div>
      ${o.viaje?`<div class="sm mut" style="margin-top:8px">Viaje asignado: <b>${esc(o.viaje)}</b></div>`:""}
    </div>
    ${o.cancelado?"":`<div class="card noprint"><div class="h2">Control del envío</div>
      ${next&&i>=1?`<div class="row2"><div><label for="d-note">Nota del checkpoint</label><input id="d-note" placeholder="Unidad, operador, ubicación, incidencia…"></div><div style="align-self:end"><button class="btn" data-act="advance" data-arg="${esc(o.folio)}">Marcar: ${esc(next.t)} →</button></div></div>`:""}
      ${i<1?`<div class="mut sm">Confirma el pedido para habilitar el seguimiento.</div>`:""}
      ${o.status!=="entregado"&&i>=1?`<div class="h2" style="margin-top:18px">Operación del pedido</div><div class="chips">${siguientePaso(o)?`<button class="btn" data-act="accion" data-arg="${esc(o.folio)}|${siguientePaso(o).k}">${esc(siguientePaso(o).t)}</button>`:""}<button class="btn sec" data-act="sign" data-arg="${esc(o.folio)}|remitente">Firma del remitente</button><button class="btn ok" data-act="accion" data-arg="${esc(o.folio)}|entregar">Entregar y firmar</button></div>`:""}
      ${o.pod?`<div class="note ok sm" style="margin-top:12px"><b>Entrega:</b> ${esc(o.pod.nombre)} ${o.pod.id?`· ${esc(o.pod.id)}`:""} · ${fdate(o.pod.at)} ${o.pod.notas?`· ${esc(o.pod.notas)}`:""}${o.pod.firma?`<div style="margin-top:6px"><img src="${o.pod.firma}" alt="firma" style="max-height:70px;background:#fff;border-radius:8px;border:1px solid var(--line)"></div>`:""}</div>`:""}
      ${o.status!=="entregado"?`<div style="margin-top:14px"><button class="btn ghost sm" style="color:var(--bad)" data-act="cancelord" data-arg="${esc(o.folio)}">Cancelar pedido</button></div>`:""}
    </div>`}
    <div class="card"><div class="h2">Carga y tarifa</div>
      <div class="scroll"><table><thead><tr><th>Pieza</th><th class="r">Cant</th><th>Medidas</th><th class="r">kg c/u</th><th class="r">m³</th><th class="r">Importe</th></tr></thead>
      <tbody>${t.lines.map(l=>`<tr><td>${esc(itemName(l))}${l.est?` <span class="pill warn">estimado</span>`:""}</td><td class="r mono">${l.qty}</td><td class="sm">${l.l}×${l.a}×${l.h} cm</td><td class="r mono">${num(l.kgU,1)}</td><td class="r mono">${num(l.m3,3)}</td><td class="r mono">${money(l.line)}</td></tr>`).join("")}</tbody></table></div>
      <div class="row3" style="margin-top:14px">
        ${[["Cajas",t.piezas],["Volumen",num(t.m3,3)+" m³"],["Peso real",num(t.kg)+" kg"],["Seguro",t.seguro>0?money(t.seguro):"—"],["Subtotal",money(t.subtotal)],["IVA",money(t.iva)],["Total",money(t.total)]].map(([a,b])=>`<div style="background:var(--soft);padding:10px;border-radius:10px"><div class="mut sm">${a}</div><b class="mono">${b}</b></div>`).join("")}
      </div>
      <div class="sm mut" style="margin-top:10px">Flete ${money(t.sub)}${t.discPct?` · descuento ${t.discPct}%`:""}${t.minApplied?` → mínimo ${money(CFG.minimo)}`:""} · Servicios: ${esc(servTxt(o))}</div>
    </div>
    <div class="card"><div class="h2">Cliente y destinatario</div><div class="row2">
      <div><b>${esc(cl.razon)}</b> <span class="pill">${esc(cl.id)}</span><div class="sm">${esc(o.sol.nombre)} · ${esc(o.sol.tel)}</div><div class="sm">${esc(o.sol.correo)}</div><div class="sm mut">RFC ${esc(cl.rfc||"pendiente")} · Crédito ${cl.credito||0} días</div>
        <button class="btn sec sm" style="margin-top:8px" data-act="vercli" data-arg="${esc(cl.id)}">Ver ficha del cliente</button></div>
      <div><b>${esc(o.dst.nombre)}</b><div class="sm">${esc(o.dst.dir)}</div><div class="sm">${esc(o.dst.tel)}</div></div></div>
      ${o.obs?`<div class="note sm" style="margin-top:12px"><b>Obs.:</b> ${esc(o.obs)}</div>`:""}</div>
    <div class="card"><div class="h2">Facturación</div>
      ${facs.length?facs.map(f=>`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)"><span><b>${esc(f.id)}</b> · ${money(f.total)} <span class="pill ${facEstado(f)==="pagada"?"ok":facEstado(f)==="vencida"?"bad":"warn"}">${esc(FAC_ST[facEstado(f)])}</span></span><span class="chips"><button class="btn sec sm" data-act="verfac" data-arg="${esc(f.id)}">Ver</button><button class="btn sec sm" data-act="xmlfac" data-arg="${esc(f.id)}">XML</button></span></div>`).join(""):`<div class="mut sm" style="margin-bottom:10px">Sin factura todavía.</div>`}
      ${i>=1&&!o.cancelado&&allowed("fact")?`<button class="btn sm" style="margin-top:10px" data-act="facturar" data-arg="${esc(o.folio)}">${facs.length?"Crear otra factura":"Crear factura"}</button>`:""}</div>
    <div class="card"><div class="h2">Checkpoints</div>${timelineHTML(o)}
      <div class="sm mut">${o.history.map(h=>`${fdate(h.at)} — ${esc(stLabel(h.k))} · ${esc(h.by)}${h.note?` · ${esc(h.note)}`:""}`).join("<br>")}</div>
      <div class="chips noprint" style="margin-top:12px"><button class="btn sec sm" data-act="orderjson" data-arg="${esc(o.folio)}">Exportar datos (JSON)</button></div></div>
  </div></div>`;
}
