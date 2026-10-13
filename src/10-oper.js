/* ==================== Unidades: capacidad y ocupación ==================== */
function viajeCap(v){ const t=CFG.camiones||{}; return t[v.tipo]||t.torton||{t:"Unidad",m3:45,kg:12000}; }
function viajeOcc(v){
  let m3a=0,kga=0,m3l=0,kgl=0,n=0,nl=0;
  v.ords.forEach(fo=>{ const o=ordOf(fo); if(!o) return; const k=o.sc.length, m3b=o.totals.m3/k, kgb=o.totals.kg/k;
    for(let i=0;i<k;i++){ m3a+=m3b; kga+=kgb; n++; if(+o.sc[i]>=2){ m3l+=m3b; kgl+=kgb; nl++; } } });
  const c=viajeCap(v);
  return {cap:c, m3a,kga,m3l,kgl,n,nl, pctA:Math.max(m3a/c.m3,kga/c.kg), pctL:Math.max(m3l/c.m3,kgl/c.kg)};
}
function occBar(label, pct, txt){
  const p=Math.min(100,Math.round(pct*100)), cls=pct>1?"over":pct>.7?"hi":"";
  return `<div class="occ"><div class="occ-h"><span>${label}</span><b>${Math.round(pct*100)}%</b></div><div class="occ-t"><i class="${cls}" style="width:${p}%"></i></div><div class="xs mut">${txt}</div></div>`;
}
function viajeOccHTML(v){
  const o=viajeOcc(v), c=o.cap;
  const t=`${num(o.m3l,1)} de ${c.m3} m³ · ${num(o.kgl,0)} de ${num(c.kg,0)} kg · ${o.nl} de ${o.n} cajas`;
  const ta=`${num(o.m3a,1)} m³ · ${num(o.kga,0)} kg asignados`;
  return occBar(`${esc(c.t)} · cargado`, o.pctL, t) + (o.pctA>o.pctL+0.005 ? occBar("Con lo que falta por subir", o.pctA, ta) : "");
}
function unidadesHoyHTML(){
  const vs=DB.via.filter(v=>v.status!=="cerrado");
  if(!vs.length) return `<div class="mut sm">No hay unidades activas. Crea un viaje en "Viajes y unidades".</div>`;
  return `<div class="grid g3">${vs.map(v=>`<div class="card flat" style="padding:14px"><div style="display:flex;justify-content:space-between;gap:6px"><b>${esc(v.unidad)}</b><span class="pill">${esc(VIA_ST[v.status])}</span></div><div class="xs mut" style="margin-bottom:6px">${esc(v.id)} → ${esc(dest(v.dest).name)} · ${esc(v.operador)}</div>${viajeOccHTML(v)}</div>`).join("")}</div>`;
}

/* ==================== Operación por pedido (modo sencillo) ==================== */
function siguientePaso(o){
  if(o.cancelado||o.status==="entregado") return null;
  if(stIdx(o)<1) return {k:"confirmar", t:"Confirmar pedido"};
  const c=stageCounts(o), pl=n=>`${n} caja${n===1?"":"s"}`;
  if(c[0]>0) return {k:"recibir", n:c[0], t:`Recibir ${pl(c[0])}`};
  if(c[1]>0) return {k:"cargar", n:c[1], t:`Cargar ${pl(c[1])} al camión`};
  if(c[2]>0) return {k:"esperar", n:c[2], t:"Esperando salida del camión"};
  if(c[3]>0) return {k:"llegar", n:c[3], t:`Llegaron ${pl(c[3])} a destino`};
  if(c[4]>0) return {k:"entregar", n:c[4], t:"Entregar y firmar"};
  return null;
}
function moverCajas(o, desde, hasta, k){ let m=0; for(let i=1;i<=o.sc.length&&m<k;i++) if(boxStage(o,i)===desde){ setBox(o,i,hasta); m++; } return m; }
function addInc(o,tipo,detalle,extra){ (o.inc=o.inc||[]).push({tipo,detalle,extra:extra||0,at:Date.now(),por:ROLE?ROLES[ROLE].t:"Sistema"}); }
function accRecibir(o,k,nota){
  const pend=stageCounts(o)[0]; k=Math.min(k,pend); const m=moverCajas(o,0,1,k);
  if(m<pend) addInc(o,"conteo",`Recepción parcial: llegaron ${m} de ${pend} cajas pendientes${nota?` · ${nota}`:""}`); else if(nota) addInc(o,"nota",nota);
  o.history.push({k:o.status,at:Date.now(),note:`Recepción en almacén: ${m} de ${o.sc.length} cajas${nota?` · ${nota}`:""}`,by:ROLE?ROLES[ROLE].t:"Almacén"});
  syncStatus(o); logEv("Operación","Recepción",`${o.folio} · ${m} cajas`); saveDB(); return m;
}
function accCargar(o,k,viaId){
  const v=viaOf(viaId); if(!v) return 0; const m=moverCajas(o,1,2,k);
  if(!v.ords.includes(o.folio)) v.ords.push(o.folio); o.viaje=v.id; if(v.status==="abierto") v.status="cargando";
  o.history.push({k:o.status,at:Date.now(),note:`${m} cajas cargadas en ${v.unidad} (${v.id})`,by:ROLE?ROLES[ROLE].t:"Almacén"});
  logEv("Operación","Carga a unidad",`${o.folio} · ${m} cajas → ${v.id}`); saveDB(); return m;
}
function accLlegar(o,k){
  const m=moverCajas(o,3,4,k); syncStatus(o);
  if(m && stIdx(o)<stKey("almacen_destino")) o.history.push({k:o.status,at:Date.now(),note:`${m} cajas llegaron a destino`,by:ROLE?ROLES[ROLE].t:"Operador"});
  logEv("Operación","Llegada a destino",`${o.folio} · ${m} cajas`); saveDB(); return m;
}
function accEntregar(o,d){
  const c=stageCounts(o), sin=c[0]+c[1]+c[2];
  for(let i=1;i<=o.sc.length;i++) setBox(o,i,5);
  if(sin) addInc(o,"conteo",`Entrega registrada con ${sin} cajas sin registro previo de salida`);
  o.pod={nombre:d.nombre,id:d.id||"",notas:d.notas||"",firma:d.firma||null,at:Date.now()};
  bump(o,"entregado",`Entregado a ${d.nombre}${d.firma?" (con firma)":""}`);
  logEv("Operación","Entrega con firma",`${o.folio} · ${d.nombre}`); saveDB();
}

/* ---- hoja de acción ---- */
function declaradoHTML(o){
  return `<div class="note info sm" style="margin:10px 0"><b>Lo que declaró el cliente</b>${o.items.map(it=>`<div>${it.qty} × ${esc(itemName(it))} — ${it.l}×${it.a}×${it.h} cm · ${num(it.kg,1)} kg c/u</div>`).join("")}</div>`;
}
function stepperHTML(max,val){
  return `<label for="ac-k">¿Cuántas cajas?</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn sec" data-act="kstep" data-arg="-1" aria-label="Menos">−</button><input id="ac-k" type="text" inputmode="numeric" autocomplete="off" value="${val}" data-max="${max}" style="text-align:center;font-size:26px;font-weight:800;max-width:130px"><button class="btn sec" data-act="kstep" data-arg="1" aria-label="Más">+</button><button class="btn sec sm" data-act="kall" data-arg="${max}">Todas (${max})</button></div>`;
}
function openAccion(folio, kind){
  const o=ordOf(folio); if(!o) return;
  const p=siguientePaso(o); kind=kind||(p&&p.k);
  const hd=`<div style="margin-bottom:6px"><b style="font-size:18px">${esc(o.folio)}</b> ${badge(o)}<div class="sm mut">${esc(o.sol.empresa||o.sol.nombre)} → ${esc(o.dst.nombre)} · <b>${esc(dest(o.dest).name)}</b> · ${o.totals.piezas} cajas · ${num(o.totals.m3,2)} m³</div></div>`;
  const c=stageCounts(o);
  if(!kind||kind==="esperar"){
    openModal({title:"Siguiente paso", key:"acc", html:`${hd}${boxProgress(o,false)}<div class="note sm" style="margin-top:12px">${kind==="esperar"?`Las cajas ya están en la unidad${o.viaje?` <b>${esc(o.viaje)}</b>`:""}. Falta registrar la <b>salida del camión</b> en "Viajes y unidades".`:"Este pedido ya no tiene pasos pendientes."}</div>`,
      actions:`${kind==="esperar"?`<button class="btn sm" data-act="mod" data-arg="viajes">Ir a Viajes</button>`:""}<button class="btn sec sm" data-act="open" data-arg="${esc(o.folio)}">Ver envío completo</button>`}); return;
  }
  if(kind==="confirmar"){
    openModal({title:"Confirmar pedido", key:"acc", html:`${hd}${declaradoHTML(o)}<p class="mut sm">Al confirmar se asigna la guía y se genera la remisión.</p>`,
      actions:`<button class="btn sm" data-act="confirmord2" data-arg="${esc(o.folio)}">Confirmar y generar guía</button>`}); return;
  }
  if(kind==="recibir"){
    const max=c[0];
    openModal({title:"Recibir cajas en almacén", key:"acc", wide:true, html:`${hd}${declaradoHTML(o)}${stepperHTML(max,max)}
      <div style="margin-top:12px"><label for="ac-n">Nota (si faltan cajas, escribe qué pasó)</label><input id="ac-n" placeholder="Opcional"></div>
      <details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">Verificar medidas de una caja (opcional)</summary>
        <div class="sm mut" style="margin:8px 0">Mide una caja y compárala con lo declarado. Si excede, queda una incidencia y se estima el ajuste.</div>
        <div class="row2"><div><label for="mc-it">Tipo de caja</label><select id="mc-it">${o.items.map((it,i)=>`<option value="${i}">${esc(itemName(it))} — declarada ${it.l}×${it.a}×${it.h} cm · ${num(it.kg,1)} kg</option>`).join("")}</select></div><div></div></div>
        <div class="row4" style="margin-top:8px"><div><label for="mc-l">Largo cm</label><input id="mc-l" type="number" inputmode="decimal"></div><div><label for="mc-a">Ancho cm</label><input id="mc-a" type="number" inputmode="decimal"></div><div><label for="mc-h">Alto cm</label><input id="mc-h" type="number" inputmode="decimal"></div><div><label for="mc-k">Peso kg</label><input id="mc-k" type="number" inputmode="decimal"></div></div>
        <button class="btn sec sm" style="margin-top:10px" data-act="medcheck" data-arg="${esc(o.folio)}">Comparar</button><div id="mc-res" style="margin-top:10px"></div></details>`,
      actions:`<button class="btn" data-act="dorecibir" data-arg="${esc(o.folio)}">Confirmar recepción</button>`}); return;
  }
  if(kind==="cargar"){
    const max=c[1], vias=DB.via.filter(v=>v.dest===o.dest&&["abierto","cargando"].includes(v.status));
    const quick=`<div class="card flat" style="margin-top:12px"><b class="sm">No hay unidad abierta a ${esc(dest(o.dest).name)}. Crea una:</b><div class="row3" style="margin-top:8px"><div><label for="qv-u">Unidad</label><input id="qv-u" placeholder="Unidad 214"></div><div><label for="qv-t">Tipo</label><select id="qv-t">${Object.entries(CFG.camiones).map(([k,t])=>`<option value="${k}">${esc(t.t)} (${t.m3} m³)</option>`).join("")}</select></div><div><label for="qv-o">Operador</label><input id="qv-o" placeholder="Nombre"></div></div><button class="btn sec sm" style="margin-top:8px" data-act="quickvia" data-arg="${esc(o.folio)}">Crear unidad</button></div>`;
    openModal({title:"Cargar al camión", key:"acc", wide:true, html:`${hd}${vias.length?`<label for="ac-via">Unidad</label><select id="ac-via">${vias.map(v=>{ const oc=viajeOcc(v); return `<option value="${v.id}">${esc(v.id)} · ${esc(v.unidad)} (${esc(oc.cap.t)}) · ${Math.round(oc.pctL*100)}% cargado</option>`; }).join("")}</select>`:quick}
      ${vias.length?`<div style="margin-top:12px">${stepperHTML(max,max)}</div>`:""}`,
      actions:vias.length?`<button class="btn" data-act="docargar" data-arg="${esc(o.folio)}">Cargar al camión</button>`:""}); return;
  }
  if(kind==="llegar"){
    const max=c[3];
    openModal({title:"Llegada a destino", key:"acc", html:`${hd}${stepperHTML(max,max)}<div class="note sm" style="margin-top:12px">Cuenta las cajas que bajan del camión en ${esc(dest(o.dest).name)}.</div>`,
      actions:`<button class="btn" data-act="dollegar" data-arg="${esc(o.folio)}">Confirmar llegada</button>`}); return;
  }
  if(kind==="entregar"){ openSign(o.folio,"entrega"); return; }
}
function guiaPendiente(folio){
  const o=ordOf(folio); if(!o){ toast("No encontré ese pedido","bad"); return; }
  S.view="sistema"; S.mod="oper"; S.drawer=null; render(); openAccion(folio);
}

/* ---- firma con el dedo ---- */
let sgDrawing=false, sgDirty=false;
function openSign(folio, kind){
  const o=ordOf(folio); if(!o) return; const ent=kind==="entrega";
  sgDirty=false;
  openModal({title:ent?"Entrega y firma":"Firma del remitente", key:"sign", wide:true,
    html:`<div class="sm mut" style="margin-bottom:8px"><b>${esc(o.folio)}</b> · ${esc(o.dst.nombre)} · ${o.totals.piezas} cajas</div>
      <div class="row2"><div><label for="sg-n">${ent?"Quién recibe":"Nombre de quien entrega"}</label><input id="sg-n" value="${esc(ent?"":o.sol.nombre)}" placeholder="Nombre completo"></div>${ent?`<div><label for="sg-i">Identificación (opcional)</label><input id="sg-i" placeholder="INE / folio"></div>`:`<div></div>`}</div>
      <div style="margin-top:10px"><label>Firma (dibuja con el dedo)</label><canvas id="sg-c" width="700" height="260" class="sgpad"></canvas>
      <div class="chips" style="margin-top:8px"><button class="btn sec sm" data-act="sgclear">Borrar firma</button></div></div>
      ${ent?`<div style="margin-top:10px"><label for="sg-o">Notas (opcional)</label><input id="sg-o" placeholder="Ej. caja con golpe, recibió completo…"></div>`:""}`,
    actions:`<button class="btn ok" data-act="sgsave" data-arg="${esc(o.folio)}|${kind}">${ent?"Guardar entrega":"Guardar firma"}</button>`});
  initSignPad();
}
function initSignPad(){
  const c=$("#sg-c"); if(!c) return; const x=c.getContext("2d");
  x.lineWidth=4; x.lineCap="round"; x.lineJoin="round"; x.strokeStyle="#111";
  const pos=e=>{ const r=c.getBoundingClientRect(); return {x:(e.clientX-r.left)*c.width/r.width, y:(e.clientY-r.top)*c.height/r.height}; };
  c.addEventListener("pointerdown",e=>{ e.preventDefault(); try{ c.setPointerCapture(e.pointerId); }catch(_){} sgDrawing=true; sgDirty=true; const p=pos(e); x.beginPath(); x.moveTo(p.x,p.y); x.lineTo(p.x+.1,p.y+.1); x.stroke(); });
  c.addEventListener("pointermove",e=>{ if(!sgDrawing) return; e.preventDefault(); const p=pos(e); x.lineTo(p.x,p.y); x.stroke(); });
  ["pointerup","pointercancel","pointerleave"].forEach(ev=>c.addEventListener(ev,()=>{ sgDrawing=false; }));
}
function firmaImg(){ const c=$("#sg-c"); if(!c||!sgDirty) return null;
  const t=document.createElement("canvas"); t.width=c.width; t.height=c.height; const x=t.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,t.width,t.height); x.drawImage(c,0,0); return t.toDataURL("image/png"); }
const firmaTag = (f,alt) => f ? `<img src="${f}" alt="${esc(alt)}" style="max-height:60px;max-width:100%;display:block;margin:0 auto 2px">` : "";

/* ==================== Etiquetas descargables y envío al cliente ==================== */
function etiquetaSVG(o,i){
  const n=o.sc.length, it=itemOfBox(o,i), q=qrSVG(boxCode(o.folio,i,n));
  const inner=q.replace(/^<svg[^>]*>/,"").replace(/<\/svg>$/,""), v=q.match(/viewBox="0 0 (\d+) (\d+)"/)[1];
  const t=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" viewBox="0 0 480 260"><rect x="3" y="3" width="474" height="254" rx="8" fill="#fff" stroke="#000" stroke-width="5"/>
  <svg x="16" y="16" width="228" height="228" viewBox="0 0 ${v} ${v}">${inner}</svg>
  <g font-family="Arial,Helvetica,sans-serif" fill="#000"><text x="262" y="48" font-size="24" font-weight="700">${t(dest(o.dest).name)}</text>
  <text x="262" y="112" font-size="60" font-weight="900">${i}<tspan font-size="24" font-weight="700"> / ${n}</tspan></text>
  <text x="262" y="142" font-size="20" font-weight="700">${t(o.folio)}</text>
  <text x="262" y="168" font-size="15">${t((o.dst.nombre||"").slice(0,28))}</text>
  <text x="262" y="190" font-size="15">${t(CFG.brand.short)} · ${t(o.guia||"pre-guía")}</text>
  ${it?`<text x="262" y="222" font-size="17" font-weight="700">${it.l}×${it.a}×${it.h} cm · ${num(it.kg,1)} kg</text><text x="262" y="242" font-size="12">Medidas máximas declaradas</text>`:""}</g></svg>`;
}
function etiquetasZip(o){
  const n=o.sc.length, files=[]; for(let i=1;i<=n;i++) files.push({name:`caja-${pad(i,3)}-de-${n}.svg`, text:etiquetaSVG(o,i)});
  if(SANDBOX){ download(`etiquetas-${o.folio}.svg.txt`, files.slice(0,3).map(f=>`<!-- ${f.name} -->\n${f.text}`).join("\n\n")+(n>3?`\n\n<!-- … y ${n-3} más -->`:"")); return; }
  download(`etiquetas-${o.folio}.zip`, zipStore(files), "application/zip");
}

/* ==================== Operación (pantalla principal de almacén y operador) ==================== */
function modOper(){
  const F=S.operF||"todos", me=ROLE;
  const base=DB.ord.filter(o=>!o.cancelado&&stIdx(o)>=1&&o.status!=="entregado");
  const items=base.map(o=>({o,p:siguientePaso(o)})).filter(x=>x.p);
  const kinds=[["recibir","Por recibir"],["cargar","Por cargar"],["esperar","En unidad"],["llegar","En ruta"],["entregar","Por entregar"]];
  const cnt=k=>items.filter(x=>x.p.k===k).length;
  const lista=items.filter(x=>F==="todos"||x.p.k===F);
  const por=DB.ord.filter(o=>!o.cancelado&&o.status==="solicitado").length;
  return `${ptitle("Operación",`<span class="mut sm">Un toque por pedido. Sin escanear caja por caja.</span>`)}
  <div class="opscan card"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><div style="flex:1;min-width:220px"><b>Escanear guía o caja</b><div class="sm mut">Apunta la cámara al QR de la guía: se abre el pedido con su siguiente paso.</div></div>
    <button class="btn" data-act="${S.scan.cam?"camoff":"camon"}">${S.scan.cam?"Apagar cámara":"Abrir cámara"}</button></div>
    ${S.scan.cam?`<div style="margin-top:12px"><video id="cam" class="cam" playsinline muted autoplay></video></div>`:""}
    <form data-form="guia" style="display:flex;gap:8px;margin-top:12px"><label for="gi" style="display:none">Folio</label><input id="gi" placeholder="Escribe el folio, ej. ALR-2026-0003" autocomplete="off" autocapitalize="characters"><button class="btn sec">Abrir</button></form></div>
  ${por&&allowed("pedidos")?`<div class="note sm" style="margin-top:12px">Hay <b>${por}</b> pedido(s) nuevos por confirmar en <a href="#" data-act="mod" data-arg="pedidos" style="color:var(--c1);font-weight:700">Pedidos</a>.</div>`:""}
  <div class="opchips">${[["todos","Todos",items.length],...kinds.map(([k,t])=>[k,t,cnt(k)])].map(([k,t,n])=>`<button class="${F===k?"on":""}" data-act="operf" data-arg="${k}">${t}<b>${n}</b></button>`).join("")}</div>
  <div class="oplist">${lista.map(({o,p})=>{ const e=eta(o.dest,o.createdAt);
    return `<div class="opc"><div class="opc-h"><b>${esc(o.folio)}</b>${o.practice?` <span class="pill dark">práctica</span>`:""}${atrasado(o)?` <span class="pill bad">atrasado</span>`:""}<span class="mut sm" style="margin-left:auto">${esc(dest(o.dest).name)}</span></div>
      <div class="sm">${esc(o.sol.empresa||o.sol.nombre)} → ${esc(o.dst.nombre)}</div>
      <div class="xs mut" style="margin:4px 0 8px">${o.totals.piezas} cajas · ${num(o.totals.m3,1)} m³ · ${num(o.totals.kg,0)} kg${e?` · llega ${esc(etaText(e))}`:""}</div>
      ${boxProgress(o,false)}
      <div class="opc-b"><button class="btn big" data-act="accion" data-arg="${esc(o.folio)}|${p.k}">${esc(p.t)}</button><button class="btn sec" data-act="open" data-arg="${esc(o.folio)}">Ver envío</button></div></div>`; }).join("")||`<div class="card mut c" style="padding:28px">No hay pedidos en esta lista.</div>`}</div>
  <h3 style="margin:24px 0 10px">Unidades de hoy</h3>${unidadesHoyHTML()}`;
}

/* ==================== Práctica guiada ==================== */
function crearPractica(){
  let c=DB.cli.find(x=>x.id==="C-PRAC");
  if(!c){ c={id:"C-PRAC",razon:"Cliente de práctica SA de CV",nombre:"Persona de práctica",rfc:"XAXX010101000",regimen:"601",cp:"64000",uso:"G03",correo:"practica@lancer.mx",tel:"5555555555",dir:"Calle de práctica 1",credito:0,retIva:false,notas:"Cliente para entrenamiento",createdAt:Date.now()}; DB.cli.push(c); }
  const mk=id=>{ const k=CFG.cajas.find(x=>x.id===id)||CFG.cajas[0]; return {cajaId:k.id,l:k.l,a:k.a,h:k.h,kg:k.kg}; };
  const d=CFG.destinos.find(x=>!x.ocurre)||CFG.destinos[0];
  const items=[{...mk(CFG.cajas[0].id),qty:8},{...mk((CFG.cajas[1]||CFG.cajas[0]).id),qty:4}];
  const o={folio:`ALR-${new Date().getFullYear()}-${pad(nextSeq("ord",1))}`, createdAt:Date.now(), dest:d.id, items, sol:{nombre:c.nombre,empresa:c.razon,correo:c.correo,tel:c.tel}, dst:{nombre:"Bodega de práctica",dir:"Av. de práctica 100, "+d.name,tel:"5555555556"}, serv:{recoleccion:false,entrega:false,seguro:false}, obs:"PEDIDO DE PRÁCTICA", guia:"", cancelado:false, status:"solicitado", cli:c.id, rem:null, fac:[], pod:null, inc:[], firmas:{}, notif:{}, practice:true, pr:{}, history:[{k:"solicitado",at:Date.now(),note:"Pedido de práctica",by:"Sistema"}]};
  o.totals=calc(o.dest,items); o.sc="0".repeat(o.totals.piezas);
  DB.ord.unshift(o); logEv("Práctica","Pedido de práctica creado",o.folio); saveDB(); return o;
}
function practicaPasos(o){
  const c=stageCounts(o), n=o.sc.length, pr=o.pr||{};
  return [
    {t:"Confirmar el pedido y generar la guía", ok:stIdx(o)>=1, act:["accion",`${o.folio}|confirmar`], b:"Confirmar"},
    {t:"Ver la guía y las etiquetas QR (así las recibe el cliente)", ok:!!(pr.guia&&pr.lab), act:["practdocs",o.folio], b:"Abrir guía y etiquetas", need:1},
    {t:"Recibir las cajas en almacén", ok:c[0]===0&&stIdx(o)>=1, act:["accion",`${o.folio}|recibir`], b:"Recibir", need:1},
    {t:"Cargar las cajas al camión", ok:c[0]===0&&c[1]===0&&stIdx(o)>=1, act:["accion",`${o.folio}|cargar`], b:"Cargar", need:3},
    {t:"Registrar la salida del camión", ok:c[0]+c[1]+c[2]===0&&stIdx(o)>=1, act:["practsalida",o.folio], b:"Registrar salida", need:4},
    {t:"Registrar la llegada a destino", ok:c[4]+c[5]===n, act:["accion",`${o.folio}|llegar`], b:"Llegada", need:5},
    {t:"Entregar con firma en el teléfono", ok:!!(o.pod&&o.pod.firma), act:["accion",`${o.folio}|entregar`], b:"Entregar y firmar", need:6},
    {t:"Crear la factura del pedido", ok:o.fac.length>0, act:["facturar",o.folio], b:"Facturar", need:7}
  ];
}
function modPractica(){
  const os=DB.ord.filter(o=>o.practice);
  return `${ptitle("Práctica guiada",`<button class="btn sm" data-act="newpractice">+ Pedido de práctica</button>${os.length?`<button class="btn sec sm" data-act="delpractice">Borrar prácticas</button>`:""}`)}
  <div class="note info sm" style="margin-bottom:14px">Crea un pedido de práctica (12 cajas) y recórrelo de principio a fin: confirmar, guía y etiquetas, recibir, cargar, salida, llegada, entrega con firma y factura. Es un pedido de entrenamiento; puedes borrarlo cuando quieras.</div>
  ${os.map(o=>{ const pasos=practicaPasos(o), hechos=pasos.filter(p=>p.ok).length, sig=pasos.findIndex(p=>!p.ok);
    return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><div><h3>${esc(o.folio)} <span class="pill dark">práctica</span></h3><div class="sm mut">${o.totals.piezas} cajas → ${esc(dest(o.dest).name)} · ${hechos} de ${pasos.length} pasos</div></div><button class="btn sec sm" data-act="open" data-arg="${esc(o.folio)}">Ver envío</button></div>
    <div class="stack" style="margin:12px 0"><i style="width:${hechos/pasos.length*100}%;background:var(--ok)"></i></div>
    ${pasos.map((p,i)=>`<div class="pstep ${p.ok?"ok":i===sig?"now":""}"><span class="pn">${p.ok?"✓":i+1}</span><div style="flex:1;min-width:0"><b>${esc(p.t)}</b></div>${p.ok?"":(i===sig?`<button class="btn sm" data-act="${p.act[0]}" data-arg="${esc(p.act[1])}">${esc(p.b)}</button>`:"")}</div>`).join("")}
    ${sig<0?`<div class="note ok" style="margin-top:12px">¡Práctica completa! Ya recorriste todo el proceso.</div>`:""}</div>`; }).join("")||`<div class="card c" style="padding:30px"><p class="mut">Todavía no hay pedidos de práctica.</p><button class="btn" data-act="newpractice">Crear pedido de práctica</button></div>`}`;
}
