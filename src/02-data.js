/* ==================== Base de datos (localStorage) ==================== */
let DB = null;
const saveDB = () => store.set(KEY_DB, DB);
const cliOf = id => DB.cli.find(c=>c.id===id) || {id, razon:"(cliente eliminado)", rfc:"", nombre:""};
const ordOf = f => DB.ord.find(o=>o.folio===f);
const facOf = id => DB.fac.find(x=>x.id===id);
const viaOf = id => DB.via.find(v=>v.id===id);
const stIdx = o => CFG.steps.findIndex(s=>s.k===o.status);
const stKey = k => CFG.steps.findIndex(s=>s.k===k);
const stLabel = k => (CFG.steps.find(s=>s.k===k)||{t:k}).t;
let ROLE = store.get(KEY_ROLE) || null;

function logEv(mod, accion, detalle){
  DB.log.unshift({at:Date.now(), rol:ROLE?ROLES[ROLE].t:"Cliente/Sistema", mod, accion, detalle:detalle||""});
  if(DB.log.length>600) DB.log.length=600;
}
function nextSeq(k, start){ DB.seq[k] = (DB.seq[k]||start-1)+1; return DB.seq[k]; }

/* ---- cajas escaneadas: cadena de dígitos, un dígito por caja (0 = sin escanear … 5 = entregada) ---- */
const boxStage = (o,n) => +o.sc.charAt(n-1);
function setBox(o,n,s){ o.sc = o.sc.slice(0,n-1)+s+o.sc.slice(n); }
function stageCounts(o){ const c=[0,0,0,0,0,0]; for(let i=0;i<o.sc.length;i++) c[+o.sc[i]]++; return c; }
function atLeast(o,i){ const c=stageCounts(o); let k=0; for(let s=i;s<=5;s++) k+=c[s]; return k; }
const totalBoxes = o => o.totals.piezas;

function advance(o, key, note, by){
  o.status = key; o.history.push({k:key, at:Date.now(), note:note||"", by:by||(ROLE?ROLES[ROLE].t:"Sistema")});
}
function bump(o, key, note, by){ if(stKey(key) > stIdx(o)) advance(o,key,note,by); }
function syncStatus(o){
  if(o.cancelado) return;
  const n = o.sc.length; if(!n) return;
  const min = Math.min(...stageCounts(o).map((v,i)=>v?i:9));
  if(min>=5){ bump(o,"entregado","Todas las cajas entregadas (escaneo)"); if(!o.pod) o.pod={nombre:"Recibido (confirmado por escaneo)", id:"", at:Date.now(), notas:""}; }
  else if(min>=4) bump(o,"almacen_destino","Todas las cajas llegaron a plaza (escaneo)");
  else if(min>=3) bump(o,"transito","Todas las cajas salieron en ruta (escaneo)");
  else if(min>=1) bump(o,"almacen_origen","Todas las cajas recibidas en almacén (escaneo)");
}

/* ---- clientes ---- */
function findOrCreateCliente(sol){
  const mail=(sol.correo||"").toLowerCase().trim();
  let c = DB.cli.find(x=>x.correo.toLowerCase()===mail) || DB.cli.find(x=>sol.empresa && x.razon.toLowerCase().startsWith(sol.empresa.toLowerCase()));
  if(c) return c;
  c = {id:"C"+pad(nextSeq("cli",1),3), razon:sol.empresa||sol.nombre, nombre:sol.nombre, rfc:"", regimen:"601", cp:"", uso:"G03", correo:sol.correo, tel:sol.tel, dir:"", credito:0, retIva:false, notas:"Alta automática desde cotizador. Completar datos fiscales.", createdAt:Date.now(), pendiente:true};
  DB.cli.push(c); logEv("Clientes","Alta automática",c.razon); return c;
}

/* ---- pedidos ---- */
function createOrder(q){
  const items = q.items.map(i=>{ const w=withDims(i); return {...w, qty:Math.max(1,parseInt(i.qty,10)||1)}; });
  const cl = findOrCreateCliente(q.sol);
  const o = { folio:`ALR-${new Date().getFullYear()}-${pad(nextSeq("ord",1))}`, createdAt:Date.now(), dest:q.dest, items, sol:{...q.sol}, dst:{...q.dst}, serv:{...q.serv}, obs:q.obs.trim(),
    guia:"", cancelado:false, status:"solicitado", cli:cl.id, rem:null, fac:[], pod:null, history:[{k:"solicitado",at:Date.now(),note:"Pedido capturado en línea",by:"Cliente"}] };
  o.totals = calc(o.dest, items); o.sc = "0".repeat(o.totals.piezas);
  DB.ord.unshift(o); logEv("Pedidos","Pedido nuevo",`${o.folio} · ${o.totals.piezas} cajas · ${money(o.totals.total)}`); saveDB();
  return o;
}
function confirmOrder(o){
  if(!o.guia) o.guia = "ALR-G-"+nextSeq("guia",48200);
  if(!o.rem){ const r={folio:"REM-"+pad(nextSeq("rem",1)), fecha:Date.now(), orden:o.folio}; DB.rem.push(r); o.rem=r.folio; }
  bump(o,"confirmado",`Guía ${o.guia} y remisión ${o.rem} generadas`);
  logEv("Pedidos","Pedido confirmado",`${o.folio} · guía ${o.guia}`); saveDB();
}

/* ---- escaneo ---- */
function doScan(code, mode, ctx){
  const p = parseBox(code);
  if(!p) return {ok:false, kind:"bad", msg:"Código no reconocido", code};
  const o = ordOf(p.folio);
  if(!o) return {ok:false, kind:"bad", msg:`Pedido ${p.folio} no existe`, code};
  if(o.cancelado) return {ok:false, kind:"bad", msg:`${o.folio} está cancelado`, code};
  if(p.n<1 || p.n>o.sc.length || p.total!==o.sc.length) return {ok:false, kind:"bad", msg:`Caja fuera de rango (${p.n}/${p.total})`, code};
  if(stIdx(o) < 1) return {ok:false, kind:"bad", msg:`${o.folio} aún no está confirmado por ALR`, code};
  const st = STAGES.find(s=>s.k===mode), cur = boxStage(o,p.n);
  if(cur>=st.i) return {ok:false, kind:"warn", msg:`Caja ${p.n}/${p.total} de ${o.folio} ya estaba registrada (${STAGES[cur-1].t})`, code, o, n:p.n};
  if(cur < st.i-1) return {ok:false, kind:"bad", msg:`Caja ${p.n}/${p.total}: falta el paso "${STAGES[st.i-2]?STAGES[st.i-2].t:"previo"}"`, code, o, n:p.n};
  if(mode==="cargada"){
    const v = ctx && ctx.via ? viaOf(ctx.via) : null;
    if(!v) return {ok:false, kind:"bad", msg:"Elige primero la unidad/viaje", code};
    if(v.dest!==o.dest) return {ok:false, kind:"bad", msg:`Destino distinto: la caja va a ${dest(o.dest).name} y la unidad a ${dest(v.dest).name}`, code, o, n:p.n};
    if(v.status==="en_ruta"||v.status==="llegado"||v.status==="cerrado") return {ok:false, kind:"bad", msg:`El viaje ${v.id} ya salió`, code};
    if(!v.ords.includes(o.folio)) v.ords.push(o.folio);
    if(v.status==="abierto") v.status="cargando";
    o.viaje = v.id;
  }
  setBox(o,p.n,st.i);
  syncStatus(o);
  logEv("Escáner",st.t,`${o.folio} caja ${p.n}/${p.total}`); saveDB();
  return {ok:true, kind:"ok", msg:`${st.t}: caja ${p.n}/${p.total} de ${o.folio}`, code, o, n:p.n};
}
function viajeFaltantes(v){ let f=0; v.ords.forEach(fo=>{ const o=ordOf(fo); if(o) for(let i=0;i<o.sc.length;i++) if(+o.sc[i]<2) f++; }); return f; }
function viajeCargadas(v){ let f=0; v.ords.forEach(fo=>{ const o=ordOf(fo); if(o) for(let i=0;i<o.sc.length;i++) if(+o.sc[i]===2) f++; }); return f; }
function viajeSalida(v){
  let mov=0; v.ords.forEach(fo=>{ const o=ordOf(fo); if(!o) return; for(let i=0;i<o.sc.length;i++) if(+o.sc[i]===2){ setBox(o,i+1,3); mov++; } syncStatus(o);
    if(atLeast(o,3)>0) bump(o,"transito",`Salió en ${v.unidad} (${v.id}) · ${atLeast(o,3)}/${o.sc.length} cajas`); });
  v.status="en_ruta"; v.salidaAt=Date.now(); logEv("Viajes","Salida",`${v.id} · ${v.unidad} · ${mov} cajas`); saveDB(); return mov;
}
function viajeLlegada(v){
  let mov=0; v.ords.forEach(fo=>{ const o=ordOf(fo); if(!o) return; for(let i=0;i<o.sc.length;i++) if(+o.sc[i]===3){ setBox(o,i+1,4); mov++; } syncStatus(o);
    if(atLeast(o,4)>0) bump(o,"almacen_destino",`Llegó a ${dest(v.dest).name} (${v.id})`); });
  v.status="llegado"; v.llegadaAt=Date.now(); logEv("Viajes","Llegada",`${v.id} · ${mov} cajas`); saveDB(); return mov;
}
function registrarEntrega(o, nombre, idDoc, notas){
  for(let i=0;i<o.sc.length;i++) setBox(o,i+1,5);
  o.pod = {nombre, id:idDoc||"", notas:notas||"", at:Date.now()};
  bump(o,"entregado",`Entregado a ${nombre}`); logEv("Pedidos","Entrega registrada",`${o.folio} · ${nombre}`); saveDB();
}

/* ---- facturación ---- */
const facSaldo = f => Math.max(0, f.total - f.pagos.reduce((s,p)=>s+p.monto,0));
function facEstado(f){
  if(f.estado==="cancelada") return "cancelada";
  if(f.estado==="borrador") return "borrador";
  if(facSaldo(f)<0.005) return "pagada";
  return Date.now()>f.venc+DAY ? "vencida" : "emitida";
}
function crearFactura(folios){
  const ords = folios.map(ordOf).filter(Boolean); if(!ords.length) return null;
  const cl = cliOf(ords[0].cli);
  const subtotal = ords.reduce((s,o)=>s+o.totals.subtotal,0), iva = ords.reduce((s,o)=>s+o.totals.iva,0);
  const ret = cl.retIva ? subtotal*0.04 : 0;
  const n = nextSeq("fac",1001);
  const f = {id:`${CFG.empresa.serie}-${n}`, serie:CFG.empresa.serie, folio:n, fecha:Date.now(), cli:cl.id, ords:folios.slice(),
    conceptos: ords.map(o=>({desc:`Servicio de transporte de carga ${CFG.origen} → ${dest(o.dest).name} · guía ${o.guia||"s/g"} · pedido ${o.folio} · ${o.totals.piezas} cajas, ${num(o.totals.kg)} kg, ${num(o.totals.m3,3)} m³`, importe:o.totals.subtotal})),
    subtotal, iva, ret, total:subtotal+iva-ret, estado:"borrador", pagos:[], venc:Date.now()+(cl.credito||0)*DAY,
    metodo: cl.credito>0?"PPD":"PUE", forma: cl.credito>0?"99":"03", uso:cl.uso||"G03", uuid:null};
  ords.forEach(o=>o.fac.push(f.id)); DB.fac.unshift(f); logEv("Facturación","Factura creada (borrador)",`${f.id} · ${cl.razon} · ${money(f.total)}`); saveDB(); return f;
}
function emitirFactura(f){
  f.estado="emitida"; f.fechaEmision=Date.now();
  f.uuid = "DEMO-"+Math.random().toString(16).slice(2,10).toUpperCase()+"-"+f.id;
  const cl=cliOf(f.cli); f.venc = Date.now()+(cl.credito||0)*DAY;
  logEv("Facturación","Factura emitida (demo, sin timbre)",f.id); saveDB();
}
function cfdiXML(f){
  const c=cliOf(f.cli), E=CFG.empresa, a=(n,v)=>` ${n}="${xe(v)}"`, m=v=>Number(v).toFixed(2);
  const tasa=(CFG.iva/100).toFixed(6);
  const fecha = new Date(f.fecha).toISOString().slice(0,19);
  const conc = f.conceptos.map(x=>{ const iv=x.importe*CFG.iva/100, rt=c.retIva?x.importe*0.04:0;
    return `    <cfdi:Concepto${a("ClaveProdServ","78101800")}${a("Cantidad","1")}${a("ClaveUnidad","E48")}${a("Unidad","Unidad de servicio")}${a("Descripcion",x.desc)}${a("ValorUnitario",m(x.importe))}${a("Importe",m(x.importe))}${a("ObjetoImp","02")}>
      <cfdi:Impuestos>
        <cfdi:Traslados><cfdi:Traslado${a("Base",m(x.importe))}${a("Impuesto","002")}${a("TipoFactor","Tasa")}${a("TasaOCuota",tasa)}${a("Importe",m(iv))}/></cfdi:Traslados>${rt?`
        <cfdi:Retenciones><cfdi:Retencion${a("Base",m(x.importe))}${a("Impuesto","002")}${a("TipoFactor","Tasa")}${a("TasaOCuota","0.040000")}${a("Importe",m(rt))}/></cfdi:Retenciones>`:""}
      </cfdi:Impuestos>
    </cfdi:Concepto>`; }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- DEMO: comprobante SIN TIMBRAR y SIN SELLO. No tiene validez fiscal. Para timbrar se conecta un PAC. -->
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd"${a("Version","4.0")}${a("Serie",f.serie)}${a("Folio",f.folio)}${a("Fecha",fecha)}${a("FormaPago",f.forma)}${a("MetodoPago",f.metodo)}${a("TipoDeComprobante","I")}${a("Exportacion","01")}${a("Moneda","MXN")}${a("SubTotal",m(f.subtotal))}${a("Total",m(f.total))}${a("LugarExpedicion",E.cp)}${a("NoCertificado","")}${a("Certificado","")}${a("Sello","")}>
  <cfdi:Emisor${a("Rfc",E.rfc)}${a("Nombre",E.razon)}${a("RegimenFiscal",E.regimen)}/>
  <cfdi:Receptor${a("Rfc",c.rfc||"XAXX010101000")}${a("Nombre",c.razon)}${a("DomicilioFiscalReceptor",c.cp||E.cp)}${a("RegimenFiscalReceptor",c.regimen||"601")}${a("UsoCFDI",f.uso)}/>
  <cfdi:Conceptos>
${conc}
  </cfdi:Conceptos>
  <cfdi:Impuestos${f.ret?a("TotalImpuestosRetenidos",m(f.ret)):""}${a("TotalImpuestosTrasladados",m(f.iva))}>${f.ret?`
    <cfdi:Retenciones><cfdi:Retencion${a("Impuesto","002")}${a("Importe",m(f.ret))}/></cfdi:Retenciones>`:""}
    <cfdi:Traslados><cfdi:Traslado${a("Base",m(f.subtotal))}${a("Impuesto","002")}${a("TipoFactor","Tasa")}${a("TasaOCuota",tasa)}${a("Importe",m(f.iva))}/></cfdi:Traslados>
  </cfdi:Impuestos>
</cfdi:Comprobante>
`;
}

/* ---- exportables ---- */
function orderTexto(o){
  const t=o.totals, d=dest(o.dest), e=eta(o.dest,o.createdAt);
  const piezas = o.items.map(it=>`  • ${it.qty} × ${itemName(it)} (${it.l}×${it.a}×${it.h} cm, ${it.kg} kg c/u)`).join("\n");
  const serv = [o.serv.recoleccion&&"Recolección en domicilio",o.serv.entrega&&"Entrega en domicilio",o.serv.seguro&&"Seguro"].filter(Boolean).join(", ")||"Ninguno";
  return `*PEDIDO ${o.folio}*${o.guia?`\nGuía: ${o.guia}`:""}
Ruta: ${CFG.origen} → ${d.name} (${d.transit})${e?`\nEntrega estimada: ${etaText(e)}`:""}
Piezas (${t.piezas}):
${piezas}
Volumen: ${num(t.m3,3)} m³ · Peso real: ${num(t.kg)} kg
Servicios: ${serv}
Subtotal: ${money(t.subtotal)}${t.minApplied?" (mínimo por embarque)":""} · IVA: ${money(t.iva)} · *Total: ${money(t.total)}*${t.est?"\n⚠ Incluye medida especial: precio estimado, requiere validación.":""}

Solicitante: ${o.sol.nombre} · ${o.sol.empresa||""} · ${o.sol.tel} · ${o.sol.correo}
Destinatario: ${o.dst.nombre} · ${o.dst.dir} · ${o.dst.tel}${o.obs?"\nObservaciones: "+o.obs:""}`;
}
function orderJSON(o){
  const t=o.totals, c=cliOf(o.cli);
  return { folio:o.folio, creado:new Date(o.createdAt).toISOString(), estatus:o.status, guia:o.guia||null, remision:o.rem||null, facturas:o.fac,
    cliente:{id:c.id, razon:c.razon, rfc:c.rfc},
    ruta:{origen:CFG.origen,destino:dest(o.dest).name,transito:dest(o.dest).transit},
    piezas:t.lines.map(l=>({descripcion:itemName(l),cantidad:l.qty,largo_cm:l.l,ancho_cm:l.a,alto_cm:l.h,peso_kg_unit:l.kg,m3:+l.m3.toFixed(4),precio_unit:+l.unit.toFixed(2),importe:+l.line.toFixed(2),estimado:!!l.est})),
    totales:{piezas:t.piezas,m3:+t.m3.toFixed(4),kg_reales:+t.kg.toFixed(2),kg_volumetricos:+t.kgVol.toFixed(2),kg_cobrables:+t.kgCob.toFixed(2),descuento_pct:t.discPct,subtotal:+t.subtotal.toFixed(2),minimo_aplicado:t.minApplied,iva:+t.iva.toFixed(2),total:+t.total.toFixed(2)},
    cajas_por_etapa:stageCounts(o), servicios:o.serv, solicitante:o.sol, destinatario:o.dst, observaciones:o.obs||"",
    requiere_validacion:t.est, entrega:o.pod, historial:o.history };
}

/* ==================== Datos de ejemplo ==================== */
function seedDB(){
  const H=36e5, now=Date.now();
  const db = {ord:[],cli:[],fac:[],via:[],rem:[],log:[],seq:{}};
  DB = db;
  const cl = (razon,rfc,cp,nombre,correo,tel,dir,credito,retIva)=>{ db.cli.push({id:"C"+pad(nextSeq("cli",1),3),razon,rfc,regimen:"601",cp,uso:"G03",nombre,correo,tel,dir,credito,retIva:!!retIva,notas:"",createdAt:now-30*DAY}); };
  cl("Distribuidora Norte SA de CV","DNO100315AB1","66600","Marisol Treviño","mtrevino@dnorte.mx","81 5550 1122","Av. Industrias 450, Apodaca NL",15);
  cl("Refacciones del Bajío SA de CV","RBA050722KL3","76090","Jorge Salas","jsalas@refbajio.mx","442 555 0101","Blvd. Bernardo Quintana 1200, Querétaro",0);
  cl("Textiles del Valle SA de CV","TVA120918PQ7","03100","Ana Paula Reyes","areyes@tvalle.mx","55 5550 7788","Insurgentes Sur 800, CDMX",30,true);
  cl("Agroinsumos Frontera SA de CV","AFR081104HJ2","88000","Luis Ortega","lortega@agrofront.mx","867 555 2020","Av. Reforma 300, Nuevo Laredo TAMPS",15);
  cl("Laboratorios Vidal SC","LVI990630NM5","76000","Carmen Vidal","cvidal@labvidal.mx","55 5550 4040","Calle 5 de Febrero 88, Querétaro",0);
  cl("Maquinados PG SA de CV","MPG070215TT8","66350","Pedro Gallegos","pgallegos@maqpg.mx","55 5550 6060","Parque Industrial Santa Catarina, NL",0);
  cl("Comercializadora Aztlán SA de CV","CAZ110408RM4","11560","Rosa Elena Campos","rcampos@aztlan.mx","55 5550 8181","Calz. México-Tacuba 1500, CDMX",30);
  cl("Ferretera Sultana SA de CV","FSU020930QW6","64000","Héctor Maldonado","hmaldonado@sultana.mx","81 5550 9090","Av. Constitución 120, Monterrey NL",15);
  const C = e => db.cli.find(c=>c.correo===e).id;
  const box = (id,qty)=>{ const c=CFG.cajas.find(x=>x.id===id); return {cajaId:id,qty,l:c.l,a:c.a,h:c.h,kg:c.kg}; };
  const mkO = (hAgo,destId,items,cliMail,dstN,dstDir,dstTel,st,opt={})=>{
    const c=db.cli.find(x=>x.correo===cliMail), t=now-hAgo*H, n=nextSeq("ord",1);
    const o={folio:`ALR-2026-${pad(n)}`,createdAt:t,dest:destId,items,sol:{nombre:c.nombre,empresa:c.razon,correo:c.correo,tel:c.tel},dst:{nombre:dstN,dir:dstDir,tel:dstTel},
      serv:{recoleccion:true,entrega:!!opt.entrega,seguro:false},obs:opt.obs||"",guia:"",cancelado:false,cli:c.id,rem:null,fac:[],pod:null,history:[]};
    o.totals=calc(destId,items); o.sc="0".repeat(o.totals.piezas);
    o.history.push({k:"solicitado",at:t,note:"Pedido capturado en línea",by:"Cliente"});
    if(st>=1){ o.guia="ALR-G-"+nextSeq("guia",48200); const r={folio:"REM-"+pad(nextSeq("rem",1)),fecha:t+2*H,orden:o.folio}; db.rem.push(r); o.rem=r.folio;
      o.history.push({k:"confirmado",at:t+2*H,note:`Guía ${o.guia} y remisión ${o.rem} generadas`,by:"Ejecutivo de ventas"}); }
    const notes=["","","Recolectado en bodega del cliente, 2 operadores","Todas las cajas recibidas y escaneadas en almacén","Salió en unidad rumbo a destino","Llegó a plaza de destino","Entrega con firma"];
    for(let i=2;i<=st;i++) o.history.push({k:CFG.steps[i].k,at:t+(2+i*5)*H,note:notes[i],by:i>=3?"Almacén":"Operador"});
    o.status=CFG.steps[Math.min(st,6)].k;
    const sc = st>=6?5: st>=5?4: st>=4?3: st>=3?1: 0; o.sc=String(sc).repeat(o.totals.piezas);
    if(st>=6) o.pod={nombre:dstN,id:"INE (ejemplo)",notas:"Entregado completo",at:t+(2+6*5)*H};
    db.ord.push(o); return o;
  };
  const dn="dnorte";
  const o1=mkO(3,"mty",[box("c1",40),box("c2",12)],"mtrevino@dnorte.mx","Almacén Central DN","Av. Industrias 450, Apodaca NL","81 5550 3344",0);
  const o2=mkO(20,"qro",[box("c3",100)],"jsalas@refbajio.mx","Refacciones Bajío Sucursal 2","Blvd. Bernardo Quintana 1200, Querétaro","442 555 0102",1);
  const o3=mkO(50,"mty",[box("c2",300)],"areyes@tvalle.mx","Bodega TV Monterrey","Carr. a Laredo km 12, Escobedo NL","81 5550 9900",3,{obs:"Carga completa de 43 pies. Descuento por volumen por definir."});
  const o4=mkO(70,"nld",[box("c1",25),box("c3",30)],"lortega@agrofront.mx","Agroinsumos Frontera Bodega","Ocurre en terminal ALR Nuevo Laredo","867 555 2021",4);
  const o5=mkO(140,"qro",[box("c1",10),box("c2",6)],"cvidal@labvidal.mx","Dr. Ramiro Vidal","Calle 5 de Febrero 88, Querétaro","442 555 8080",6,{entrega:true});
  const o6=mkO(26,"mty",[{custom:true,qty:4,l:120,a:80,h:90,kg:140}],"pgallegos@maqpg.mx","Maquinados PG Monterrey","Parque Industrial Santa Catarina, NL","81 5550 6061",0,{obs:"Medida especial: requiere validación de ejecutivo."});
  const o7=mkO(200,"mty",[box("c1",60),box("c3",40)],"hmaldonado@sultana.mx","Ferretera Sultana Matriz","Av. Constitución 120, Monterrey NL","81 5550 9091",6);
  const o8=mkO(30,"qro",[box("c2",24),box("c3",15)],"rcampos@aztlan.mx","Aztlán Querétaro","Av. 5 de Febrero 1700, Querétaro","442 555 7711",3);
  const o9=mkO(260,"nld",[box("c2",18)],"lortega@agrofront.mx","Agroinsumos Frontera Bodega","Ocurre en terminal ALR Nuevo Laredo","867 555 2021",6);
  const o10=mkO(8,"mty",[box("c1",15)],"hmaldonado@sultana.mx","Ferretera Sultana Sucursal Norte","Av. Lincoln 2200, Monterrey NL","81 5550 9092",1);
  /* carga parcial del pedido 3: 180 de 300 cajas ya subidas a la unidad V-0002 */
  o3.sc = "2".repeat(180)+"1".repeat(120);
  o3.viaje="V-0002"; o1.viaje=null;
  o4.viaje="V-0001"; o5.viaje="V-0003"; o9.viaje="V-0001";
  o8.sc = "1".repeat(o8.sc.length);
  /* viajes */
  const via=(n,unidad,placas,op,destId,status,ords,extra)=>db.via.push({id:"V-"+pad(nextSeq("via",1),4),unidad,placas,operador:op,dest:destId,status,ords,fecha:now,...extra});
  via(1,"Unidad 214","NL-48-221","Raúl Guerrero","nld","en_ruta",[o4.folio],{salidaAt:now-26*H});
  via(2,"Unidad 118","NL-31-907","Iván Salazar","mty","cargando",[o3.folio],{});
  via(3,"Unidad 087","GTO-12-445","Mario Esquivel","qro","cerrado",[o5.folio],{salidaAt:now-120*H,llegadaAt:now-96*H});
  via(4,"Unidad 301","NL-55-018","Daniel Reyna","qro","abierto",[o8.folio],{});
  /* facturas */
  const fOrd = (o,estado,pagado,diasEmit)=>{ const f=crearFactura([o.folio]); f.fecha=now-diasEmit*DAY; if(estado!=="borrador"){ emitirFactura(f); f.fechaEmision=f.fecha; const cl=cliOf(f.cli); f.venc=f.fecha+(cl.credito||0)*DAY; }
    if(pagado) f.pagos.push({at:f.fecha+3*DAY,monto:f.total,forma:"03",ref:"SPEI 4821"+f.folio}); return f; };
  fOrd(o5,"emitida",true,6);
  fOrd(o7,"emitida",false,10);          // vence en 5 días -> vencida
  fOrd(o9,"emitida",false,3);
  const fp=fOrd(o3,"emitida",false,1); fp.pagos.push({at:now,monto:20000,forma:"03",ref:"Anticipo SPEI"});
  db.log=[]; logEv("Sistema","Datos de ejemplo cargados","8 clientes, 10 pedidos, 4 viajes, 4 facturas");
  return db;
}
function loadDB(){
  DB = store.get(KEY_DB);
  if(!DB || !DB.cli || !DB.ord){ seedDB(); saveDB(); }
  DB.ord.forEach(o=>{ o.totals=calc(o.dest,o.items); if(!o.sc||o.sc.length!==o.totals.piezas) o.sc="0".repeat(o.totals.piezas); });
}
loadDB();
