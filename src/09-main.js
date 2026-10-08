/* ==================== Render y acciones ==================== */
function render(){
  applyBrand();
  const v = {cotizar:viewCotizar, rastreo:viewRastreo, sistema:viewSistema, etiquetas:viewEtiquetas}[S.view] || viewCotizar;
  $("#app").innerHTML = v();
  if(S.view==="cotizar" && !S.done){ renderPieces(); renderSummary(); renderOcurre(); }
  renderOverlay(); attachCam();
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
    const o=ordOf(id); if(!o) return;
    if(t==="guia") openDoc(guiaDoc(o),`Guía ${o.guia||o.folio}`); else openDoc(remisionDoc(o),`Remisión ${o.rem||o.folio}`); },
  labels(f,el){ S.lab=f; S.labN=48; S.back=el&&el.dataset.from==="sistema"?"sistema":null; S.backOrd=f; S.view="etiquetas"; S.drawer=null; S.modals=[]; render(); scrollTo(0,0); },
  back(){ S.view="sistema"; S.drawer=S.backOrd||null; render(); },
  labmore(){ S.labN+=96; render(); },
  track(f,el,e){ if(e) e.preventDefault(); S.view="rastreo"; S.track=f; S.done=null; S.drawer=null; render(); scrollTo(0,0); },
  newquote(){ S.done=null; Q=newQ(); render(); },
  copytxt(f){ const o=ordOf(f); if(o) copy(orderTexto(o)); },
  copyfield(id){ const e=document.getElementById(id); if(e) copy(e.value); },
  /* cotizador */
  qadd(){ Q.items.push({cajaId:CFG.cajas[0].id,qty:1}); renderPieces(); renderSummary(); },
  pdel(a,el){ const i=+el.closest(".piece").dataset.i; if(Q.items.length>1){ Q.items.splice(i,1); renderPieces(); renderSummary(); } },
  qsend(){ if(!qvalid().ok) return; const o=createOrder(Q); S.done=o.folio; Q=newQ(); render(); scrollTo(0,0); },
  /* pedidos */
  confirmord(f){ const o=ordOf(f); confirmOrder(o); render(); toast(`Confirmado · guía ${o.guia}`); },
  advance(f){ const o=ordOf(f), i=stIdx(o); if(i<1){ toast("Confirma primero el pedido","bad"); return; }
    const k=CFG.steps[i+1].k; advance(o,k,($("#d-note")||{}).value||""); if(k==="entregado"){ for(let n=1;n<=o.sc.length;n++) setBox(o,n,5); if(!o.pod) o.pod={nombre:"Registrado por ALR",id:"",notas:"",at:Date.now()}; }
    logEv("Pedidos","Checkpoint",`${o.folio} → ${stLabel(k)}`); saveDB(); render(); toast("Checkpoint registrado"); },
  entrega(f){ const o=ordOf(f), n=($("#p-n")||{}).value.trim(); if(!n){ toast("Escribe quién recibe","bad"); return; }
    registrarEntrega(o,n,$("#p-i").value.trim(),$("#p-o").value.trim()); render(); toast("Entrega registrada"); },
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
  ptipo(v,el){ const it=Q.items[+el.closest(".piece").dataset.i];
    if(v==="custom") Object.assign(it,{custom:true,cajaId:null,l:"",a:"",h:"",kg:""}); else { it.custom=false; it.cajaId=v; delete it.l; delete it.a; delete it.h; delete it.kg; }
    renderPieces(); renderSummary(); },
  pfield(v,el){ const pc=el.closest(".piece"), it=Q.items[+pc.dataset.i], k=el.dataset.arg;
    if(k==="qty"){ el.value=el.value.replace(/\D/g,"").replace(/^0+/,""); it.qty=parseInt(el.value,10)||0; } else it[k]=Math.max(0,+v||0);
    pc.querySelector(".meta").innerHTML=metaHTML(it); renderSummary(); },
  fq(v){ S.fq=v; keepFocus(); },
  fcliq(v){ S.fCliQ=v; keepFocus(); },
  logq(v){ S.logQ=v; keepFocus(); },
  cfg(v,el){ const nu=el.dataset.num; setPath(CFG, el.dataset.arg, nu?(+v||0):v); saveCfg(); if(el.dataset.arg.startsWith("brand")) applyBrand(); },
  cfgarr(v,el){ const [arr,i,f]=el.dataset.arg.split("|"); const row=getPath(CFG,arr)[+i];
    let val=v; if(el.dataset.num) val = (v===""&&el.dataset.nullable) ? null : (+v||0);
    setPath(row,f,val); saveCfg(); }
};
const CH = {
  fEstado(v){ S.fEstado=v; render(); }, fDest(v){ S.fDest=v; render(); },
  svia(v){ S.scan.via=v; refreshScan(); }, sord(v){ S.scan.ord=v; refreshScan(); },
  repdays(v){ S.repDays=v; render(); },
  qserv(v,el){ Q.serv[el.dataset.arg]=el.checked; },
  cfgocurre(v,el){ CFG.destinos[+el.dataset.arg].ocurre=el.checked; saveCfg(); },
  descon(v,el){ CFG.desc.on=el.checked; saveCfg(); },
  logofile(v,el){ const f=el.files[0]; if(!f) return; if(f.size>1.5e6){ toast("Imagen muy pesada (máx. 1.5 MB)","bad"); return; }
    const r=new FileReader(); r.onload=()=>{ CFG.brand.logo=r.result; saveCfg(); render(); toast("Logo actualizado"); }; r.readAsDataURL(f); },
  cfgfile(v,el){ const f=el.files[0]; if(!f) return; const r=new FileReader();
    r.onload=()=>{ try{ const c=JSON.parse(r.result); if(!c.cajas||!c.destinos||!c.brand) throw 0; CFG=c; saveCfg(); Q=newQ(); render(); toast("Configuración importada"); }catch(_){ toast("Archivo de configuración inválido","bad"); } }; r.readAsText(f); }
};
const FORM = {
  track(){ S.track=$("#t-in").value; render(); },
  login(f){ const role=f.querySelector("input[name=role]:checked").value; if($("#pin").value!==CFG.pin){ toast("PIN incorrecto","bad"); $("#pin").value=""; return; }
    ROLE=role; store.set(KEY_ROLE,role); S.mod=ROLES[role].mods[0]; logEv("Acceso","Inicio de sesión",ROLES[role].t); saveDB(); render(); },
  scan(){ const i=$("#scan-in"), c=i.value.trim(); if(!c) return; submitScan(c); i.value=""; i.focus(); },
  newvia(){ const u=$("#nv-u").value.trim(); if(!u){ toast("Escribe la unidad","bad"); return; }
    const v={id:"V-"+pad(nextSeq("via",1),4),unidad:u,placas:$("#nv-p").value.trim()||"—",operador:$("#nv-o").value.trim()||"—",dest:$("#nv-d").value,status:"abierto",ords:[],fecha:Date.now()};
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
(function boot(){
  const h=(location.hash||"").slice(1);
  if(h==="escaner"){ S.view="sistema"; S.mod="scan"; }
  else if(["rastreo","sistema","cotizar"].includes(h)) S.view=h;
  render();
})();
