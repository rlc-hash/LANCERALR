/* ==================== Render y acciones ==================== */
function render(){
  applyBrand(); document.body.dataset.view=S.view;
  const v = {cotizar:viewCotizar, rastreo:viewRastreo, sistema:viewSistema, etiquetas:viewEtiquetas}[S.view] || viewCotizar;
  $("#app").innerHTML = v();
  if(S.view==="cotizar" && !S.done){ renderPieces(); renderSummary(); renderOcurre(); renderRec(); renderSeg(); }
  renderOverlay(); attachCam();
  $$("table.rt").forEach(t=>{ const hs=[...t.querySelectorAll("thead th")].map(h=>h.textContent.trim()); t.querySelectorAll("tbody tr").forEach(tr=>[...tr.children].forEach((td,i)=>{ if(hs[i]) td.setAttribute("data-label",hs[i]); })); });
  if(S.view==="sistema" && S.mod==="scan" && ROLE){ const i=$("#scan-in"); if(i && !S.noFocus) i.focus(); }
}
function setPath(obj, path, v){ const p=path.split("."); let c=obj; while(p.length>1) c=c[p.shift()]; c[p[0]]=v; }
function getPath(obj, path){ return path.split(".").reduce((c,k)=>c[k], obj); }
function keepFocus(){ const a=document.activeElement, id=a&&a.id, pos=a&&a.selectionStart; render(); if(id){ const e=document.getElementById(id); if(e){ e.focus(); try{ e.setSelectionRange(pos,pos); }catch(_){} } } }
function printHTML(html){ $("#print-root").innerHTML=html; document.body.classList.add("printing"); setTimeout(()=>{ window.print(); document.body.classList.remove("printing"); },60); }
function csvOrders(os){
  const rows=[["folio","fecha","estatus","guia","remision","cliente","rfc","destino","cajas","m3","kg_reales","subtotal","iva","total","cajas_recibidas"]];
  os.forEach(o=>rows.push([o.folio,new Date(o.createdAt).toISOString(),o.cancelado?"cancelado":o.status,o.guia,o.rem,cliOf(o.cli).razon,cliOf(o.cli).rfc,dest(o.dest).name,o.totals.piezas,o.totals.m3.toFixed(4),o.totals.kg.toFixed(2),o.totals.subtotal.toFixed(2),o.totals.iva.toFixed(2),o.totals.total.toFixed(2),o.sc.length-stageCounts(o)[0]]));
  return csvOf(rows);
}
function leaveScan(){ if(camStream) camStop(); }

const ACT = {
  go(v){ leaveScan(); if(v==="sistema") S.back=null; setView(v); },
  mod(m){ if(m!=="scan") leaveScan(); S.mod=m; S.drawer=null; S.modals=[]; try{ history.replaceState(null,"","#"+(m==="scan"?"escaner":"sistema")); }catch(e){} render(); scrollTo(0,0); },
  modgo(m){ ACT.mod(m); },
  dpe(arg){ const i=arg.indexOf(":"), t=arg.slice(0,i), v=arg.slice(i+1); if(t==="f"){ S.ftab=v; ACT.mod("fact"); return; } S.fq=""; S.fEstado="todos"; S.fDest="todos"; if(t==="e") S.fEstado=v; if(t==="d") S.fDest=v; ACT.mod(allowed("pedidos")?"pedidos":"oper"); },
  logout(){ leaveScan(); ROLE=null; store.set(KEY_ROLE,null); S.drawer=null; S.modals=[]; render(); },
  open(f){ S.modals=[]; S.drawer=f; renderOverlay(); },
  closedrawer(){ S.drawer=null; renderOverlay(); },
  drawerbg(a,el,e){ if(e.target===el){ S.drawer=null; renderOverlay(); } },
  modalbg(a,el,e){ if(e.target===el) closeModal(); },
  closemodal(){ closeModal(); },
  printdoc(){ const s=$("#doc-sheet")||$(".modal .card"); if(s) printHTML(s.innerHTML); },
  printlabels(){ window.print(); },
  doc(arg){ const [t,id]=arg.split("|");
    if(t==="mani"){ const v=viaOf(id); if(v) openDoc(manifestoDoc(v),`Manifiesto ${v.id}`); return; }
    const o=ordOf(id); if(!o) return; if(t==="guia"){ o.pr=o.pr||{}; o.pr.guia=true; saveDB(); }
    const ex=`<div class="noprint"><div class="h2" style="margin:16px 0 0">Resumen del envío</div>${envioResumen(o)}</div>`;
    if(t==="guia") openDoc(guiaDoc(o),`Guía ${o.guia||o.folio}`,ex); else openDoc(remisionDoc(o),`Remisión ${o.rem||o.folio}`,ex); },
  labels(f,el){ const oo=ordOf(f); if(oo){ oo.pr=oo.pr||{}; oo.pr.lab=true; saveDB(); } S.lab=f; S.labN=48; S.back=el&&el.dataset.from==="sistema"?"sistema":null; S.backOrd=f; S.view="etiquetas"; S.drawer=null; S.modals=[]; render(); scrollTo(0,0); },
  back(){ S.view="sistema"; S.drawer=S.backOrd||null; render(); },
  labmore(){ S.labN+=96; render(); },
  track(f,el,e){ if(e) e.preventDefault(); S.view="rastreo"; S.track=f; S.done=null; S.drawer=null; render(); scrollTo(0,0); },
  newquote(){ S.done=null; Q=newQ(); render(); },
  copytxt(f){ const o=ordOf(f); if(o) copy(orderTexto(o)); },
  copyfield(id){ const e=document.getElementById(id); if(e) copy(e.value); },
  /* operación sencilla por pedido */
  accion(arg){ const [f,k]=arg.split("|"); openAccion(f,k); },
  confirmord2(f){ const o=ordOf(f); confirmOrder(o); closeModal(); render(); toast(`Confirmado · guía ${o.guia}`); },
  kstep(d){ const i=$("#ac-k"); if(!i) return; const max=+i.dataset.max||0; i.value=Math.max(0,Math.min(max,(parseInt(i.value,10)||0)+(+d))); ackUpd(); },
  kall(m){ const i=$("#ac-k"); if(i) i.value=m; ackUpd(); },
  corregir(f){ openCorregir(f); },
  corrapply(f){ const o=ordOf(f), motivo=($("#cj-m")||{}).value.trim(), rows=[1,2,4].map(i=>({i,cur:+$("#cj-"+i).dataset.cur,v:parseInt($("#cj-"+i).value,10)}));
    if(rows.some(r=>isNaN(r.v)||r.v<0||r.v>o.sc.length)){ toast(`Los números deben estar entre 0 y ${o.sc.length}`,"bad"); return; }
    const ch=rows.filter(r=>r.v!==r.cur); if(!ch.length){ toast("No cambiaste ningún número"); return; } if(!motivo){ toast("Escribe el motivo de la corrección","bad"); return; }
    const dec=ch.filter(r=>r.v<r.cur).sort((a,b)=>b.i-a.i), inc=ch.filter(r=>r.v>r.cur).sort((a,b)=>a.i-b.i);
    for(const r of [...dec,...inc]){ const res=ajustarEtapa(o,r.i,r.v,motivo); if(!res.ok){ toast(res.msg,"bad"); render(); return; } }
    closeModal(); render(); toast("Conteo corregido y registrado"); },
  adjapply(arg){ const [f,i]=arg.split("|"), o=ordOf(f), k=parseInt(($("#adj-k")||{}).value,10); if(isNaN(k)){ toast("Escribe un número","bad"); return; }
    const res=ajustarEtapa(o,+i,k,"ajuste manual en el escáner"); if(!res.ok){ toast(res.msg,"bad"); return; } S.scan.ord=f; refreshScan(); toast(res.m?"Conteo guardado":"Sin cambios"); },
  dorecibir(f){ const o=ordOf(f), i=$("#ac-k"), max=+i.dataset.max, k=parseInt(i.value,10)||0;
    if(k<1||k>max){ toast(`Escribe un número entre 1 y ${max}`,"bad"); return; }
    const m=accRecibir(o,k,($("#ac-n")||{}).value.trim(),($("#ac-p")||{}).value.trim()); closeModal(); render(); toast(m<max?`${m} de ${max} cajas recibidas (queda incidencia)`:`${m} cajas recibidas ✓`); },
  docargar(f){ const o=ordOf(f), i=$("#ac-k"), max=+i.dataset.max, k=parseInt(i.value,10)||0, via=($("#ac-via")||{}).value;
    if(k<1||k>max){ toast(`Escribe un número entre 1 y ${max}`,"bad"); return; }
    const v=viaOf(via), oc=viajeOcc(v), n=o.sc.length, pct=Math.max((oc.m3l+k*o.totals.m3/n)/oc.cap.m3,(oc.kgl+k*o.totals.kg/n)/oc.cap.kg);
    if(pct>1 && !ask(`Con estas cajas la unidad pasa de su capacidad (${Math.round(pct*100)}%)`)) return;
    const m=accCargar(o,k,via); closeModal(); render(); toast(`${m} cajas cargadas en ${v.unidad} · ${Math.round(Math.min(pct,9.99)*100)}%`); },
  dollegar(f){ const o=ordOf(f), i=$("#ac-k"), max=+i.dataset.max, k=parseInt(i.value,10)||0;
    if(k<1||k>max){ toast(`Escribe un número entre 1 y ${max}`,"bad"); return; }
    const m=accLlegar(o,k); closeModal(); render(); toast(`${m} cajas llegaron a destino`); },
  quickvia(f){ const o=ordOf(f), u=($("#qv-u")||{}).value.trim(); if(!u){ toast("Escribe el nombre de la unidad","bad"); return; }
    const v={id:"V-"+pad(nextSeq("via",1),4),unidad:u,placas:"—",operador:($("#qv-o").value.trim()||"—"),dest:o.dest,tipo:$("#qv-t").value,status:"abierto",ords:[],fecha:Date.now()};
    DB.via.unshift(v); logEv("Viajes","Viaje creado",`${v.id} · ${u}`); saveDB(); S.modals.pop(); openAccion(f,"cargar"); },
  medcheck(f){ const o=ordOf(f), it=o.items[+$("#mc-it").value], g=id=>parseFloat($(id).value);
    const l=g("#mc-l"),a=g("#mc-a"),h=g("#mc-h"),k=g("#mc-k"); if(![l,a,h,k].every(x=>x>0)){ toast("Captura las 4 medidas","bad"); return; }
    const tol=2, ex=[]; [["largo",l,it.l],["ancho",a,it.a],["alto",h,it.h]].forEach(([n,m,d])=>{ if(m>d+tol) ex.push(`${n} ${num(m,1)} cm (declarado ${d})`); }); if(k>it.kg*1.05) ex.push(`peso ${num(k,1)} kg (declarado ${num(it.kg,1)})`);
    const res=$("#mc-res");
    if(!ex.length){ res.innerHTML=`<div class="note ok sm"><b>Dentro de lo declarado ✓</b> (tolerancia ${tol} cm / 5% en peso)</div>`; S.mc=null; return; }
    const decl=pieceCalc(it,o.dest).line, ratio=Math.max((l*a*h)/(it.l*it.a*it.h), k/it.kg, 1), est=decl*ratio, diff=Math.max(0,est-decl);
    S.mc={folio:f,txt:`${itemName(it)}: excede en ${ex.join(", ")}`,diff};
    res.innerHTML=`<div class="note bad sm"><b>Excede lo declarado:</b> ${esc(ex.join(" · "))}.<br>Si las ${it.qty} cajas de este tipo miden así, el flete sería ~<b>${money(est)}</b> vs ${money(decl)} declarado${diff>0?` → ajuste aprox. <b>${money(diff)}</b>`:""} (proporcional al volumen y peso; ALR define el cobro final).</div><button class="btn sm" style="margin-top:8px" data-act="medinc">Registrar incidencia</button>`; },
  medinc(){ const m=S.mc; if(!m) return; const o=ordOf(m.folio); addInc(o,"medidas",m.txt,m.diff); logEv("Operación","Medidas fuera de lo declarado",`${o.folio} · ${m.txt}`); saveDB(); S.mc=null; $("#mc-res").innerHTML=`<div class="note ok sm">Incidencia registrada en el pedido.</div>`; },
  sign(arg){ const [f,k]=arg.split("|"); openSign(f,k); },
  sgclear(){ const c=$("#sg-c"); if(c){ c.getContext("2d").clearRect(0,0,c.width,c.height); sgDirty=false; } },
  sgsave(arg){ const [f,kind]=arg.split("|"), o=ordOf(f), n=($("#sg-n")||{}).value.trim();
    if(!n){ toast("Escribe el nombre","bad"); return; } const img=firmaImg(); if(!img){ toast("Falta la firma: dibújala con el dedo","bad"); return; }
    let res=null; if(kind==="entrega"){ const kk=$("#sg-k"), max=+kk.dataset.max, k=parseInt(kk.value,10)||0; if(k<1||k>max){ toast(`Escribe cuántas cajas recibe (1 a ${max})`,"bad"); return; } res=accEntregar(o,{nombre:n,id:($("#sg-i")||{}).value.trim(),notas:($("#sg-o")||{}).value.trim(),firma:img,cajas:k}); }
    else { o.firmas=o.firmas||{}; o.firmas.remitente={nombre:n,img,at:Date.now()}; logEv("Operación","Firma del remitente",`${o.folio} · ${n}`); saveDB(); }
    closeModal(); render(); toast(kind==="entrega"?(res&&res.parcial?`Entrega parcial: ${res.total} de ${o.sc.length} cajas`:"Entrega confirmada con firma"):"Firma guardada"); },
  newpractice(){ const o=crearPractica(); S.mod="practica"; render(); toast(`Pedido de práctica ${o.folio} creado`); },
  delpractice(){ if(!ask("¿Borrar los pedidos de práctica?")) return; const fs=DB.ord.filter(o=>o.practice).map(o=>o.folio);
    fs.forEach(f=>nubeTomb("ord",f)); DB.fac.filter(f=>f.ords.every(x=>fs.includes(x))).forEach(f=>nubeTomb("fac",f.id));
    DB.ord=DB.ord.filter(o=>!o.practice); DB.via.forEach(v=>{ v.ords=v.ords.filter(x=>!fs.includes(x)); }); DB.fac=DB.fac.filter(f=>!f.ords.every(x=>fs.includes(x))); saveDB(); render(); toast("Prácticas borradas"); },
  practdocs(f){ const o=ordOf(f); o.pr=o.pr||{}; o.pr.guia=true; o.pr.lab=true; saveDB(); ACT.labels(f,{dataset:{from:"sistema"}}); },
  practsalida(f){ const o=ordOf(f); if(!o.viaje||!viaOf(o.viaje)){ toast("Primero carga las cajas a un camión","bad"); return; } ACT.viasalida(o.viaje); },
  operf(k){ S.operF=k; render(); },
  labzip(f){ etiquetasZip(ordOf(f)); },
  qgo(){ const v=qvalid(); if(v.ok){ ACT.qsend(); return; } toast(v.msg,"bad");
    const order=[["f-sn",Q.sol.nombre.trim()],["f-sc",/^\S+@\S+\.\S+$/.test(Q.sol.correo.trim())],["f-st",Q.sol.tel.replace(/\D/g,"").length>=8],["f-dn",Q.dst.nombre.trim()],["f-dd",Q.dst.dir.trim()],["f-dt",Q.dst.tel.replace(/\D/g,"").length>=8]];
    const bad=order.find(([id,ok])=>!ok); if(bad){ const e=document.getElementById(bad[0]); if(e){ e.scrollIntoView({block:"center",behavior:"smooth"}); e.focus(); } } },
  /* recolección y seguro (cliente) */
  qdia(f){ Q.rec.fecha=f; renderRec(); renderSummary(); },
  recp(arg){ const [d,h]=arg.split("|"); Q.rec.desde=d; Q.rec.hasta=h; renderRec(); renderSummary(); },
  repeat(f){ repetirPedido(f); },
  repsel(){ const f=(($("#rep-f")||{}).value||"").trim().toUpperCase()||(($("#rep-s")||{}).value||""); if(!f){ toast("Elige un pedido o escribe un folio","bad"); return; } repetirPedido(f); },
  /* recolecciones (interno) */
  calsel(f){ S.recDia=f; render(); },
  calmes(d){ const r=S.recRef||{y:new Date().getFullYear(),m:new Date().getMonth()}, x=new Date(r.y,r.m+(+d),1); S.recRef={y:x.getFullYear(),m:x.getMonth()}; render(); },
  calblock(f){ DB.cal.bloq[f]=(($("#rb-m")||{}).value||"").trim()||"Bloqueado"; logEv("Recolecciones","Día bloqueado",`${f} · ${DB.cal.bloq[f]}`); saveDB(); render(); toast("Día bloqueado: ya no recibe solicitudes"); },
  calopen(f){ delete DB.cal.bloq[f]; logEv("Recolecciones","Día abierto",f); saveDB(); render(); toast("Día abierto"); },
  recver(f){ const o=ordOf(f); if(!o||!recVigente(o)) return; const d=fromYmd(o.rec.fecha); S.recRef={y:d.getFullYear(),m:d.getMonth()}; S.recDia=o.rec.fecha; S.mod="reco"; S.drawer=null; S.modals=[]; render(); scrollTo(0,0); },
  recconf(f){ openRecConfirm(f); },
  recconf2(f){ const o=ordOf(f), r=o.rec; r.estado="programada"; r.unidad=($("#rc-u")||{}).value.trim(); r.nota=($("#rc-n")||{}).value.trim(); r.confirmadaAt=Date.now();
    o.history.push({k:o.status,at:Date.now(),note:`Recolección confirmada: ${fshort(fromYmd(r.fecha))} ${recVentana(r)}${r.unidad?` · ${r.unidad}`:""}`,by:ROLES[ROLE].t});
    logEv("Recolecciones","Confirmada",`${o.folio} · ${r.fecha} ${recVentana(r)}`); saveDB(); closeModal(); render(); toast("Recolección confirmada"); },
  recdone(f){ const o=ordOf(f), r=o.rec; if(stIdx(o)<1){ toast("Primero confirma el pedido para generar la guía","bad"); return; }
    r.estado="recolectada"; r.hechaAt=Date.now(); bump(o,"recolectado",`Recolectado en ${r.dir}${r.unidad?` · ${r.unidad}`:""}`);
    logEv("Recolecciones","Recolectada",o.folio); saveDB(); render(); toast("Recolección registrada"); },
  recfail(f){ const o=ordOf(f), r=o.rec; r.estado="no_realizada"; r.nota="No se pudo recolectar; reprogramar con el cliente";
    o.history.push({k:o.status,at:Date.now(),note:"Recolección no realizada; se reprogramará",by:ROLES[ROLE].t}); logEv("Recolecciones","No realizada",o.folio); saveDB(); render(); toast("Marcada como no realizada"); },
  recre(f){ openRecResched(f); },
  rsdia(f){ S.rs.fecha=f; openRecResched(S.rs.folio,true); },
  rsp(arg){ const [d,h]=arg.split("|"); S.rs.desde=d; S.rs.hasta=h; openRecResched(S.rs.folio,true); },
  recre2(f){ const o=ordOf(f), r=o.rec, s=S.rs;
    if(!s.fecha){ toast("Elige el nuevo día","bad"); return; } if(hh(s.hasta)-hh(s.desde)<CFG.recoleccion.minHoras){ toast(`La ventana debe ser de al menos ${CFG.recoleccion.minHoras} horas`,"bad"); return; }
    r.fecha=s.fecha; r.desde=s.desde; r.hasta=s.hasta; if(r.estado==="no_realizada") r.estado="solicitada";
    o.history.push({k:o.status,at:Date.now(),note:`Recolección reprogramada: ${fshort(fromYmd(r.fecha))} ${recVentana(r)}`,by:ROLES[ROLE].t}); logEv("Recolecciones","Reprogramada",`${o.folio} → ${r.fecha}`); saveDB(); closeModal(); S.recDia=r.fecha; render(); toast("Recolección reprogramada"); },
  /* seguro (interno) */
  segedit(f){ S.segTmp=null; openSeguroEdit(f); },
  seguro2(f){ const o=ordOf(f), v=parseFloat((($("#se-v")||{}).value||"").replace(/[^\d.]/g,""))||0;
    o.seguro = v>0 ? {on:true,valor:v,file:S.segTmp||(o.seguro&&o.seguro.file)||null} : {on:false,valor:0};
    o.totals=calc(o.dest,o.items,o.seguro); S.segTmp=null; logEv("Pedidos","Seguro actualizado",`${o.folio} · ${v>0?money(o.totals.seguro):"sin seguro"}`); saveDB(); closeModal(); render(); toast(v>0?`Seguro: ${money(o.totals.seguro)}`:"Seguro quitado"); },
  segdl(f){ const o=ordOf(f), fl=o&&o.seguro&&o.seguro.file; if(!fl) return; download(fl.name, SANDBOX?`(Archivo adjunto: ${fl.name}, ${num(fl.size/1024,0)} KB. La descarga solo funciona abriendo el sistema en su propia página web.)`:dataUrlBlob(fl.data), fl.type); },
  async nubeconn(){ const u=($("#nb-u")||{}).value||"", k=($("#nb-k")||{}).value||""; if(!u.trim()||!k.trim()){ toast("Captura la dirección y la llave","bad"); return; }
    try{ const est=await nubeConectar(u,k);
      if(est==="vacia"){ const n=await nubeSubirTodo(); render(); toast(`Conectado. Se subieron ${n} registros a la nube.`); }
      else { render(); toast("Conectado. La nube ya tiene datos: elige Bajar o Subir."); } }
    catch(e){ toast(e.message||String(e),"bad"); render(); } },
  async nubesync(){ await nubeSync(); render(); toast(NUBE.estado==="ok"?"Sincronizado":NUBE.err,NUBE.estado==="ok"?"":"bad"); },
  nubelink(){ copy(nubeLink()); },
  async nubedown(){ if(!ask("Esto reemplaza los datos de este navegador con los de la nube")) return; try{ await nubeBajarTodo(); render(); toast("Datos de la nube cargados"); }catch(e){ toast(e.message||String(e),"bad"); } },
  async nubeup(){ if(!ask("Esto sube todos tus datos y sobrescribe en la nube lo que coincida")) return; try{ const n=await nubeSubirTodo(); render(); toast(`Se subieron ${n} registros`); }catch(e){ toast(e.message||String(e),"bad"); } },
  nubeoff(){ nubeDesconectar(); render(); toast("Desconectado de la nube"); },
  /* cotizador */
  qadd(){ Q.items.push({cajaId:CFG.cajas[0].id,qty:1}); renderPieces(); renderSummary(); },
  pdel(a,el){ const i=+el.closest(".piece").dataset.i; if(Q.items.length>1){ Q.items.splice(i,1); renderPieces(); renderSummary(); } },
  qsend(){ if(!qvalid().ok) return; const o=createOrder(Q); S.done=o.folio; Q=newQ(); render(); scrollTo(0,0); },
  /* pedidos */
  confirmord(f){ const o=ordOf(f); confirmOrder(o); render(); toast(`Confirmado · guía ${o.guia}`); },
  advance(f){ const o=ordOf(f), i=stIdx(o); if(i<1){ toast("Confirma primero el pedido","bad"); return; }
    const k=CFG.steps[i+1].k; advance(o,k,($("#d-note")||{}).value||""); if(k==="entregado"){ for(let n=1;n<=o.sc.length;n++) setBox(o,n,5); if(!o.pod) o.pod={nombre:"Registrado por ALR",id:"",notas:"",at:Date.now()}; }
    logEv("Pedidos","Checkpoint",`${o.folio} → ${stLabel(k)}`); saveDB(); render(); toast("Checkpoint registrado"); },
  entrega(f){ openSign(f,"entrega"); },
  cancelord(f){ if(!ask("¿Cancelar este pedido?")) return; const o=ordOf(f); o.cancelado=true; o.history.push({k:o.status,at:Date.now(),note:"Pedido cancelado",by:ROLES[ROLE].t}); logEv("Pedidos","Cancelado",o.folio); saveDB(); render(); },
  orderjson(f){ const o=ordOf(f); download(o.folio+".json", JSON.stringify(orderJSON(o),null,2), "application/json"); },
  exportorders(){ download("pedidos-alr.csv", csvOrders(DB.ord), "text/csv"); },
  exportcsv(){ download("pedidos-alr.csv", csvOrders(DB.ord), "text/csv"); },
  repcsv(){ download("reporte-alr.csv", csvOrders(repOrders()), "text/csv"); },
  vercli(id){ openCliente(id); },
  /* escáner */
  smode(k){ S.scan.mode=k; render(); },
  smodego(k){ S.scan.mode=k; S.mod="scan"; render(); },
  camon(){ camStart(); }, camoff(){ camStop(); render(); },
  scanagain(){ S.scanResult=null; S.noFocus=false; render(); camStart(); },
  simnext(){ simulateNext(); }, simall(){ simulateAll(); },
  /* viajes */
  vtab(t){ S.vtab=t; render(); },
  viacargar(id){ S.scan.mode="cargada"; S.scan.via=id; S.mod="scan"; render(); },
  viasalida(id){ const v=viaOf(id), cg=viajeCargadas(v); if(!cg){ toast("No hay cajas cargadas en esta unidad","bad"); return; }
    const f=viajeFaltantes(v); if(f>0 && !ask(`Faltan ${f} cajas por subir; saldrán sin ellas`)) return;
    const n=viajeSalida(v); render(); toast(`${v.unidad} en ruta con ${n} cajas`); },
  vialleg(id){ const v=viaOf(id), n=viajeLlegada(v); render(); toast(`${v.unidad} llegó a ${dest(v.dest).name} · ${n} cajas`); },
  viacerrar(id){ const v=viaOf(id); v.status="cerrado"; logEv("Viajes","Cerrado",v.id); saveDB(); render(); },
  viaadd(id){ const v=viaOf(id), sel=document.getElementById("va-"+id); if(!sel||!sel.value) return; v.ords.push(sel.value); const o=ordOf(sel.value); o.viaje=v.id; if(v.status==="abierto") v.status="abierto"; logEv("Viajes","Pedido asignado",`${sel.value} → ${v.id}`); saveDB(); render(); },
  /* finanzas */
  ftab(t){ S.ftab=t; render(); }, dtab(t){ S.docTab=t; render(); },
  newcli(){ openCliente("new"); },
  savecli(id){
    const g=k=>document.getElementById("cl-"+k), razon=g("razon").value.trim(), rfc=g("rfc").value.trim().toUpperCase();
    if(!razon){ toast("Falta la razón social","bad"); return; }
    if(rfc && !rfcOK(rfc)){ toast("El RFC no tiene un formato válido","bad"); return; }
    const d={razon,rfc,regimen:g("regimen").value,cp:g("cp").value.trim(),uso:g("uso").value,credito:Math.max(0,+g("credito").value||0),nombre:g("nombre").value.trim(),tel:g("tel").value.trim(),correo:g("correo").value.trim(),dir:g("dir").value.trim(),retIva:g("ret").checked,notas:g("notas").value.trim()};
    if(id==="new"){ const c={id:"C"+pad(nextSeq("cli",1),3),createdAt:Date.now(),...d}; DB.cli.push(c); logEv("Clientes","Cliente creado",c.razon); }
    else { const c=cliOf(id); Object.assign(c,d); if(rfc) c.pendiente=false; logEv("Clientes","Cliente actualizado",c.razon); }
    saveDB(); closeModal(); render(); toast("Cliente guardado"); },
  facturar(f){ const o=ordOf(f); const cl=cliOf(o.cli); if(!cl.rfc) toast("El cliente no tiene RFC; complétalo antes de emitir","bad"); const fa=crearFactura([f]); S.drawer=null; renderOverlay(); render(); openFac(fa.id); },
  verfac(id){ openFac(id); },
  xmlfac(id){ const f=facOf(id); download(`${f.id}.xml`, cfdiXML(f), "application/xml"); },
  xmlcli(id){ xmlZip(DB.fac.filter(f=>f.cli===id), `xml-${id}.zip`); },
  xmlall(){ xmlZip(DB.fac, "xml-facturas-alr.zip"); },
  emitir(id){ const f=facOf(id); if(!cliOf(f.cli).rfc){ toast("Captura el RFC del cliente antes de emitir","bad"); return; } emitirFactura(f); reopenFac(id); render(); toast("Factura emitida (demo)"); },
  pagar(id){ const f=facOf(id), m=+(document.getElementById("pg-m").value||0); if(!(m>0)){ toast("Monto inválido","bad"); return; }
    f.pagos.push({at:Date.now(),monto:Math.min(m,facSaldo(f)),forma:document.getElementById("pg-f").value,ref:document.getElementById("pg-r").value.trim()});
    logEv("Facturación","Pago registrado",`${f.id} · ${money(m)}`); saveDB(); reopenFac(id); render(); toast("Pago registrado"); },
  cancelfac(id){ if(!ask("¿Cancelar esta factura?")) return; const f=facOf(id); f.estado="cancelada"; f.ords.forEach(fo=>{ const o=ordOf(fo); if(o) o.fac=o.fac.filter(x=>x!==id); }); logEv("Facturación","Factura cancelada",id); saveDB(); reopenFac(id); render(); },
  /* configuración */
  cfgtab(t){ S.cfgTab=t; render(); },
  addcaja(){ CFG.cajas.push({id:"c"+Date.now(),name:"Caja nueva",l:40,a:40,h:40,kg:10,prices:Object.fromEntries(CFG.destinos.map(d=>[d.id,0]))}); saveCfg(); Q=newQ(); render(); },
  delcaja(i){ CFG.cajas.splice(+i,1); saveCfg(); Q=newQ(); render(); },
  adddest(){ const id="d"+Date.now(); CFG.destinos.push({id,name:"Nuevo destino",transit:"",tMin:null,tMax:null,ocurre:false,kgRate:3}); CFG.cajas.forEach(c=>c.prices[id]=0); saveCfg(); Q=newQ(); render(); },
  deldest(i){ CFG.destinos.splice(+i,1); saveCfg(); Q=newQ(); render(); },
  addtier(){ CFG.desc.tiers.push({desde:500,pct:20}); saveCfg(); render(); },
  deltier(i){ CFG.desc.tiers.splice(+i,1); saveCfg(); render(); },
  logoreset(){ CFG.brand.logo=null; saveCfg(); render(); },
  exportcfg(){ download("configuracion-alr.json", JSON.stringify(CFG,null,2), "application/json"); },
  exportdb(){ download("informacion-alr.json", JSON.stringify(DB,null,2), "application/json"); },
  resetdata(){ if(!ask("¿Restablecer los datos de ejemplo?")) return; seedDB(); saveDB(); render(); toast("Datos restablecidos"); },
  resetall(){ if(!ask("Se borrará todo")) return; CFG=DEFAULT_CFG(); saveCfg(); seedDB(); saveDB(); Q=newQ(); render(); toast("Valores de fábrica"); }
};

const INP = {
  qdest(v){ Q.dest=v; renderPieces(); renderSummary(); renderOcurre(); },
  qf(v,el){ setPath(Q, el.dataset.arg, v); renderSummary(); },
  rec(v,el){ const k=el.dataset.arg; if(k==="dir") Q.rec.dir=v; else if(k==="cn") Q.rec.contacto.nombre=v; else if(k==="ct") Q.rec.contacto.tel=v; else if(k==="pr") Q.rec.pregunta=v; else if(k==="instr") Q.rec.instr=v; renderSummary(); },
  segv(v,el){ el.value=el.value.replace(/[^\d.]/g,""); Q.seguro.valor=el.value; segRes(); renderSummary(); },
  ptipo(v,el){ const it=Q.items[+el.closest(".piece").dataset.i];
    if(v==="custom") Object.assign(it,{custom:true,cajaId:null,l:"",a:"",h:"",kg:""}); else { it.custom=false; it.cajaId=v; delete it.l; delete it.a; delete it.h; delete it.kg; }
    renderPieces(); renderSummary(); },
  pfield(v,el){ const pc=el.closest(".piece"), it=Q.items[+pc.dataset.i], k=el.dataset.arg;
    if(k==="qty"){ el.value=el.value.replace(/\D/g,"").replace(/^0+/,""); it.qty=parseInt(el.value,10)||0; } else it[k]=Math.max(0,+v||0);
    pc.querySelector(".meta").innerHTML=metaHTML(it); renderSummary(); },
  ack(v,el){ el.value=el.value.replace(/\D/g,""); const max=+el.dataset.max; if(+el.value>max) el.value=max; ackUpd(); },
  fq(v){ S.fq=v; keepFocus(); },
  fcliq(v){ S.fCliQ=v; keepFocus(); },
  logq(v){ S.logQ=v; keepFocus(); },
  cfg(v,el){ const nu=el.dataset.num; setPath(CFG, el.dataset.arg, nu?(+v||0):v); saveCfg(); if(el.dataset.arg.startsWith("brand")) applyBrand(); else DB.ord.forEach(o=>{ o.totals=calc(o.dest,o.items,o.seguro); }); },
  cfgarr(v,el){ const [arr,i,f]=el.dataset.arg.split("|"); const row=getPath(CFG,arr)[+i];
    let val=v; if(el.dataset.num) val = (v===""&&el.dataset.nullable) ? null : (+v||0);
    setPath(row,f,val); saveCfg(); }
};
const CH = {
  nubetipo(v){ NUBE.tipo=v; nubeSave(); render(); },
  fEstado(v){ S.fEstado=v; render(); }, fDest(v){ S.fDest=v; render(); },
  svia(v){ S.scan.via=v; refreshScan(); }, sord(v){ S.scan.ord=v; refreshScan(); },
  repdays(v){ S.repDays=v; render(); },
  qserv(v,el){ Q.serv[el.dataset.arg]=el.checked; if(el.dataset.arg==="recoleccion") renderRec(); if(el.dataset.arg==="seguro") renderSeg(); renderSummary(); },
  recd(v){ ajustaVentana(Q.rec,"desde",v); renderRec(); renderSummary(); },
  rech(v){ ajustaVentana(Q.rec,"hasta",v); renderRec(); renderSummary(); },
  rsd(v){ ajustaVentana(S.rs,"desde",v); openRecResched(S.rs.folio,true); },
  rsh(v){ ajustaVentana(S.rs,"hasta",v); openRecResched(S.rs.folio,true); },
  segfile(v,el){ leerArchivo(el.files[0], f=>{ Q.seguro.file=f; renderSeg(); toast("Factura de la mercancía adjunta"); }); },
  segfile2(v,el){ leerArchivo(el.files[0], f=>{ S.segTmp=f; toast("Factura adjunta; guarda el seguro para aplicarla"); }); },
  cfgbool(v,el){ setPath(CFG, el.dataset.arg, el.checked); saveCfg(); DB.ord.forEach(o=>{ o.totals=calc(o.dest,o.items,o.seguro); }); },
  qnotif(v,el){ Q.notif[el.dataset.arg]=el.checked; },
  cfgocurre(v,el){ CFG.destinos[+el.dataset.arg].ocurre=el.checked; saveCfg(); },
  descon(v,el){ CFG.desc.on=el.checked; saveCfg(); },
  logofile(v,el){ const f=el.files[0]; if(!f) return; if(f.size>1.5e6){ toast("Imagen muy pesada (máx. 1.5 MB)","bad"); return; }
    const r=new FileReader(); r.onload=()=>{ CFG.brand.logo=r.result; saveCfg(); render(); toast("Logo actualizado"); }; r.readAsDataURL(f); },
  cfgfile(v,el){ const f=el.files[0]; if(!f) return; const r=new FileReader();
    r.onload=()=>{ try{ const c=JSON.parse(r.result); if(!c.cajas||!c.destinos||!c.brand) throw 0; CFG=c; saveCfg(); Q=newQ(); render(); toast("Configuración importada"); }catch(_){ toast("Archivo de configuración inválido","bad"); } }; r.readAsText(f); }
};
const FORM = {
  track(){ S.track=$("#t-in").value; render(); },
  login(f){ const pin=$("#pin").value; let role=f.querySelector("input[name=role]:checked").value;
    if(pin===CFG.devPin) role="dev"; else if(pin!==CFG.pin){ toast("PIN incorrecto","bad"); $("#pin").value=""; return; }
    ROLE=role; store.set(KEY_ROLE,role); S.mod=ROLES[role].mods[0]; logEv("Acceso","Inicio de sesión",ROLES[role].t); saveDB();
    if(S.pendingScan){ S.mod="scan"; runPendingScan(); } if(S.pendingGuia){ render(); runPendingScan(); return; } render(); },
  guia(){ const i=$("#gi"), f=i.value.trim().toUpperCase(); if(!f) return; i.value=""; guiaPendiente(f); },
  scan(){ const i=$("#scan-in"), c=i.value.trim(); if(!c) return; submitScan(c); i.value=""; i.focus(); },
  newvia(){ const u=$("#nv-u").value.trim(); if(!u){ toast("Escribe la unidad","bad"); return; }
    const v={id:"V-"+pad(nextSeq("via",1),4),unidad:u,placas:$("#nv-p").value.trim()||"—",operador:$("#nv-o").value.trim()||"—",dest:$("#nv-d").value,tipo:$("#nv-t").value,status:"abierto",ords:[],fecha:Date.now()};
    DB.via.unshift(v); logEv("Viajes","Viaje creado",`${v.id} · ${u}`); saveDB(); render(); toast("Viaje creado"); }
};
document.addEventListener("click", e=>{
  const el=e.target.closest("[data-act]"); if(!el) return;
  const f=ACT[el.dataset.act]; if(f) f(el.dataset.arg, el, e);
});
document.addEventListener("input", e=>{ const el=e.target.closest("[data-in]"); if(!el) return; const f=INP[el.dataset.in]; if(f) f(el.value, el); });
document.addEventListener("change", e=>{ const el=e.target.closest("[data-ch],[data-in=qdest],[data-in=ptipo]"); if(!el) return;
  if(el.dataset.ch){ const f=CH[el.dataset.ch]; if(f) f(el.value, el); return; } });
document.addEventListener("change", e=>{
  const t=e.target;
  if(t.dataset && t.dataset.in==="pfield" && t.dataset.arg==="qty"){ const it=Q.items[+t.closest(".piece").dataset.i]; if(!(it.qty>=1)){ it.qty=1; t.value="1"; t.closest(".piece").querySelector(".meta").innerHTML=metaHTML(it); renderSummary(); } }
});
document.addEventListener("submit", e=>{ const f=e.target.closest("[data-form]"); if(!f) return; e.preventDefault(); const h=FORM[f.dataset.form]; if(h) h(f); });
document.addEventListener("keydown", e=>{ if(e.key==="Escape"){ if(S.modals.length) closeModal(); else if(S.drawer){ S.drawer=null; renderOverlay(); } } });
window.addEventListener("storage", e=>{ if(e.key===KEY_DB && e.newValue){ try{ DB=JSON.parse(e.newValue); }catch(_){ return; } const a=document.activeElement; if(!(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))) render(); }
  if(e.key===KEY_CFG && e.newValue){ try{ CFG=JSON.parse(e.newValue); }catch(_){} } });

/* ==================== Arranque ==================== */
/* Una caja escaneada con la cámara normal del teléfono abre la dirección #s.FOLIO.CAJA.TOTAL y se registra sola. */
function takeScanHash(){
  const h=(location.hash||"").slice(1); let m;
  if(m=h.match(/^g\.([A-Za-z0-9-]+)$/)){ S.pendingGuia=m[1]; S.view="sistema"; S.mod="oper"; try{ history.replaceState(null,"","#sistema"); }catch(e){} return true; }
  if(m=h.match(/^t\.([A-Za-z0-9-]+)$/)){ S.view="rastreo"; S.track=m[1]; S.done=null; return true; }
  if(m=h.match(/^nube\.([A-Za-z0-9_-]+)$/)){ try{ const c=JSON.parse(unb64u(m[1])); Object.assign(NUBE,{tipo:c.t||"sheets",url:c.u,key:c.k,on:true,lastS:0,estado:"off"}); nubeSave(); S.joinCloud=true; }catch(e){} try{ history.replaceState(null,"","#sistema"); }catch(e){} S.view="sistema"; return true; }
  if(!h.startsWith("s.")) return false;
  S.pendingScan="#"+h; S.view="sistema"; S.mod="scan"; try{ history.replaceState(null,"","#escaner"); }catch(e){} return true;
}
function runPendingScan(){
  if(S.pendingGuia&&ROLE){ const f=S.pendingGuia; S.pendingGuia=null; setTimeout(()=>guiaPendiente(f),0); return; }
  if(!S.pendingScan||!ROLE) return;
  if(!allowed("scan")){ S.scanResult={ok:false,kind:"bad",msg:"Tu perfil no puede registrar escaneos"}; S.pendingScan=null; return; }
  const r=doScan(S.pendingScan,"auto",{via:S.scan.via}); S.pendingScan=null; r.at=Date.now();
  S.scan.feed.unshift(r); if(r.o) S.scan.ord=r.o.folio; S.scanResult=r; S.noFocus=true; beep(r.ok);
}
function unirNube(){ S.joinCloud=false; nubeBajarTodo().then(()=>{ render(); toast("Conectado a la nube: ya ves los mismos datos que tus compañeros"); }).catch(e=>toast(e.message||String(e),"bad")); }
window.addEventListener("hashchange",()=>{ if(takeScanHash()){ runPendingScan(); render(); if(S.joinCloud) unirNube(); } });
(function boot(){
  if(takeScanHash()) runPendingScan();
  else { const h=(location.hash||"").slice(1);
    if(h==="escaner"){ S.view="sistema"; S.mod="scan"; } else if(["rastreo","sistema","cotizar"].includes(h)) S.view=h; }
  render(); if(S.joinCloud) unirNube();
})();
