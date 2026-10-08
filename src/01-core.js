"use strict";
/* ==================== Utilidades ==================== */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const xe = esc;
const money = n => "$" + Number(n||0).toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});
const money0 = n => "$" + Math.round(Number(n||0)).toLocaleString("es-MX");
const num = (n,d=2) => Number(n||0).toLocaleString("es-MX",{minimumFractionDigits:d,maximumFractionDigits:d});
const fdate = t => t ? new Date(t).toLocaleString("es-MX",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
const fday = t => t ? new Date(t).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const fshort = t => new Date(t).toLocaleDateString("es-MX",{weekday:"short",day:"numeric",month:"short"});
const pad = (n,l=4) => String(n).padStart(l,"0");
const APP_VERSION = "v5", APP_DATE = "8 oct 2026";
const KEY_CFG = "alr_cfg_v5", KEY_DB = "alr_db_v5", KEY_ROLE = "alr_role_v5";
const store = {
  mem:{},
  get(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):null }catch(e){ return this.mem[k]||null } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)) }catch(e){ this.mem[k]=v } }
};
const SANDBOX = (()=>{ try{ return window.self!==window.top }catch(e){ return true } })();
const DAY = 864e5;

/* ==================== Configuración ==================== */
const DEFAULT_CFG = () => ({
  brand:{ name:"ALR · Autolíneas Regiomontanas", short:"ALR", c1:"#fb0c0f", c2:"#14327d", logo:null, web:"alr.com.mx", contacto:"paqmex2@alr.com.mx", tel:"" },
  empresa:{ razon:"Autolíneas Regiomontanas (razón social por confirmar)", rfc:"AAA010101AAA", regimen:"601", cp:"64000", dir:"Monterrey, Nuevo León", serie:"A", tel:"", correo:"paqmex2@alr.com.mx" },
  origen:"Ciudad de México",
  volFactor:556,
  minimo:440,
  iva:16,
  vigencia:"Marzo 2026 – Marzo 2027",
  pin:"1234",
  desc:{ on:false, tiers:[{desde:50,pct:5},{desde:100,pct:8},{desde:200,pct:12},{desde:300,pct:19}] },
  destinos:[
    {id:"qro", name:"Querétaro",    transit:"1–2 días",    tMin:1, tMax:2,    ocurre:false, kgRate:2.15},
    {id:"mty", name:"Monterrey",    transit:"2–3 días",    tMin:2, tMax:3,    ocurre:false, kgRate:2.55},
    {id:"nld", name:"Nuevo Laredo", transit:"Solo ocurre", tMin:null, tMax:null, ocurre:true, kgRate:3.25}
  ],
  cajas:[
    {id:"c1", name:"Caja 1", l:75, a:53, h:48, kg:20, prices:{qro:43.59, mty:53.08, nld:66.34}},
    {id:"c2", name:"Caja 2", l:70, a:47, h:34, kg:30, prices:{qro:90.63, mty:110.08, nld:129.47}},
    {id:"c3", name:"Caja 3", l:50, a:50, h:50, kg:15, prices:{qro:18.95, mty:18.96, nld:32.23}}
  ],
  steps:[
    {k:"solicitado",       t:"Solicitud recibida",       d:"ALR recibió tu pedido y lo está revisando."},
    {k:"confirmado",       t:"Confirmado por ALR",       d:"Pedido aceptado y guía asignada."},
    {k:"recolectado",      t:"Mercancía recolectada",    d:"Tu carga ya está en poder de ALR."},
    {k:"almacen_origen",   t:"En almacén de origen",     d:"Cajas recibidas y escaneadas en almacén."},
    {k:"transito",         t:"En tránsito",              d:"Tu carga va en camino al destino."},
    {k:"almacen_destino",  t:"En plaza de destino",      d:"Llegó a la plaza; en proceso de entrega."},
    {k:"entregado",        t:"Entregado",                d:"Mercancía entregada al destinatario."}
  ]
});
let CFG = store.get(KEY_CFG) || DEFAULT_CFG();
(function migrateCfg(){ const d=DEFAULT_CFG(); ["empresa","desc"].forEach(k=>{ if(!CFG[k]) CFG[k]=d[k]; });
  CFG.destinos.forEach(x=>{ if(x.tMin===undefined){ const m=d.destinos.find(y=>y.id===x.id); x.tMin=m?m.tMin:null; x.tMax=m?m.tMax:null; } }); })();
const saveCfg = () => store.set(KEY_CFG, CFG);

/* ==================== Etapas de escaneo ==================== */
const STAGES = [
  {i:1,k:"recibida", t:"Recepción en almacén", s:"Caja recibida en bodega",     step:"almacen_origen"},
  {i:2,k:"cargada",  t:"Carga a unidad",       s:"Caja subida al camión",        step:null},
  {i:3,k:"ruta",     t:"En ruta",              s:"Camión salió con la caja",     step:"transito"},
  {i:4,k:"llegada",  t:"Llegada a plaza",      s:"Caja descargada en destino",   step:"almacen_destino"},
  {i:5,k:"entregada",t:"Entrega",              s:"Caja entregada al cliente",    step:"entregado"}
];
const stageColor = i => ["#dfe5f0","#9bb4e6","#4f78d4","#e0a21b","#b06ad8","#168a4a"][i];

/* ==================== Roles ==================== */
const ROLES = {
  admin:   {t:"Dirección ALR",      mods:["dash","pedidos","scan","viajes","almacen","clientes","fact","docs","reportes","config","bitacora"], who:"Acceso total"},
  ventas:  {t:"Ejecutivo de ventas",mods:["dash","pedidos","clientes","fact","docs","reportes"], who:"Pedidos, clientes y facturación"},
  almacen: {t:"Almacén",            mods:["dash","pedidos","scan","viajes","almacen","docs"], who:"Recepción, carga y viajes"},
  operador:{t:"Operador de unidad", mods:["scan","viajes"], who:"Escáner y su viaje"}
};
const MODS = {
  dash:{t:"Panel general",ic:"▦"}, pedidos:{t:"Pedidos",ic:"▤"}, scan:{t:"Escáner QR",ic:"⌗"}, viajes:{t:"Viajes y unidades",ic:"⛟"},
  almacen:{t:"Almacén",ic:"▣"}, clientes:{t:"Clientes",ic:"☺"}, fact:{t:"Facturación",ic:"$"}, docs:{t:"Guías y remisiones",ic:"≣"},
  reportes:{t:"Reportes",ic:"◔"}, config:{t:"Configuración",ic:"⚙"}, bitacora:{t:"Bitácora",ic:"☰"}
};

/* ==================== Cálculo de tarifa ==================== */
function pieceCalc(it, destId){
  const m3u = it.l*it.a*it.h/1e6;
  const m3 = m3u*it.qty, kg = it.kg*it.qty, kgVol = m3*CFG.volFactor;
  let unit=0, line=0, est=false;
  if(it.custom){
    est = true;
    const d = CFG.destinos.find(x=>x.id===destId);
    line = Math.max(kg, kgVol)*(d?d.kgRate:0); unit = it.qty ? line/it.qty : 0;
  } else {
    const c = CFG.cajas.find(x=>x.id===it.cajaId);
    unit = c ? (c.prices[destId]||0) : 0; line = unit*it.qty;
  }
  return {m3, kg, kgVol, unit, line, est};
}
function discPct(piezas){
  const d = CFG.desc; if(!d || !d.on) return 0;
  let p = 0; d.tiers.forEach(t=>{ if(piezas>=t.desde) p=Math.max(p,t.pct); }); return p;
}
function calc(destId, items){
  let m3=0,kg=0,kgVol=0,kgCob=0,sub=0,piezas=0,est=false;
  const lines = items.map(it=>{
    const p = pieceCalc(it,destId);
    m3+=p.m3; kg+=p.kg; kgVol+=p.kgVol; kgCob+=it.custom?Math.max(p.kg,p.kgVol):p.kg; sub+=p.line; piezas+=it.qty; est=est||p.est;
    return {...it, ...p};
  });
  const pct = discPct(piezas), disc = sub*pct/100, net = sub-disc;
  const minApplied = net>0 && net<CFG.minimo;
  const subtotal = net>0 ? Math.max(net, CFG.minimo) : 0;
  const iva = subtotal*CFG.iva/100;
  return {lines, piezas, m3, kg, kgVol, kgCob, sub, discPct:pct, disc, subtotal, minApplied, iva, total:subtotal+iva, est};
}
const dest = id => CFG.destinos.find(d=>d.id===id) || {id, name:id, transit:"", tMin:null, tMax:null};
const itemName = it => it.custom ? `Medida especial ${it.l}×${it.a}×${it.h} cm` : ((CFG.cajas.find(c=>c.id===it.cajaId)||{}).name || it.name || "Caja");

/* ==================== Entrega estimada ==================== */
function addBiz(d, n){ const x=new Date(d); let k=0; while(k<n){ x.setDate(x.getDate()+1); const w=x.getDay(); if(w!==0&&w!==6) k++; } return x; }
function eta(destId, from){
  const d = dest(destId);
  if(d.tMin==null) return null;
  const salida = addBiz(from||Date.now(), 1);
  return {salida, min:addBiz(salida,d.tMin), max:addBiz(salida,d.tMax), txt:`${d.tMin===d.tMax?d.tMin:d.tMin+"–"+d.tMax} días hábiles`};
}
function etaText(e){ if(!e) return null; return e.min.toDateString()===e.max.toDateString() ? fshort(e.min) : `${fshort(e.min)} – ${fshort(e.max)}`; }

/* ==================== QR ==================== */
function qrSVG(text){
  const q = qrcode(0, "M"); q.addData(String(text)); q.make();
  const n = q.getModuleCount(); let d="";
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(q.isDark(r,c)) d+=`M${c+4},${r+4}h1v1h-1z`;
  const s = n+8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
const boxCode = (folio,n,total) => `ALR|${folio}|${n}|${total}`;
function parseBox(code){
  const m = String(code||"").trim().match(/^ALR\|([A-Za-z0-9-]+)\|(\d+)\|(\d+)$/);
  return m ? {folio:m[1], n:+m[2], total:+m[3]} : null;
}

/* ==================== ZIP (sin compresión) y descargas ==================== */
const _crcT = (()=>{ const t=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1; t[n]=c>>>0; } return t; })();
function crc32(b){ let c=0xFFFFFFFF; for(let i=0;i<b.length;i++) c=_crcT[(c^b[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function zipStore(files){
  const enc = new TextEncoder(), parts=[], cent=[]; let off=0;
  files.forEach(f=>{
    const data=enc.encode(f.text), name=enc.encode(f.name), crc=crc32(data);
    const lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true); lh.setUint16(4,20,true); lh.setUint16(6,0x0800,true); lh.setUint16(8,0,true);
    lh.setUint16(10,0,true); lh.setUint16(12,0x21,true); lh.setUint32(14,crc,true); lh.setUint32(18,data.length,true);
    lh.setUint32(22,data.length,true); lh.setUint16(26,name.length,true); lh.setUint16(28,0,true);
    parts.push(lh.buffer,name,data);
    const ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true); ch.setUint16(4,20,true); ch.setUint16(6,20,true); ch.setUint16(8,0x0800,true); ch.setUint16(10,0,true);
    ch.setUint16(12,0,true); ch.setUint16(14,0x21,true); ch.setUint32(16,crc,true); ch.setUint32(20,data.length,true); ch.setUint32(24,data.length,true);
    ch.setUint16(28,name.length,true); ch.setUint32(42,off,true);
    cent.push(ch.buffer,name);
    off += 30+name.length+data.length;
  });
  const csz = cent.reduce((s,b)=>s+(b.byteLength!==undefined?b.byteLength:b.length),0);
  const end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true); end.setUint16(8,files.length,true); end.setUint16(10,files.length,true); end.setUint32(12,csz,true); end.setUint32(16,off,true);
  return new Blob([...parts,...cent,end.buffer],{type:"application/zip"});
}
function download(name, content, type="application/octet-stream"){
  if(SANDBOX){
    const txt = content instanceof Blob ? "(Este archivo solo se puede descargar abriendo el sistema en su propia página web.)" : String(content);
    openModal({title:name, wide:true, html:`<div class="note info sm" style="margin-bottom:10px">En esta vista previa no se permiten descargas. Copia el contenido o abre el sistema en su dirección web para descargar el archivo.</div><textarea id="dl-txt" rows="14" readonly style="font:12px/1.4 ui-monospace,Menlo,monospace">${esc(txt)}</textarea>`,
      actions:`<button class="btn sm" data-act="copyfield" data-arg="dl-txt">Copiar</button>`});
    return;
  }
  const blob = content instanceof Blob ? content : new Blob([content],{type});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
}
function copy(text){
  const fb=()=>{ const a=document.createElement("textarea"); a.value=text; document.body.appendChild(a); a.select(); try{ document.execCommand("copy"); toast("Copiado") }catch(e){ toast("No se pudo copiar","bad") } a.remove(); };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(()=>toast("Copiado"),fb); else fb();
}
function toast(msg, kind=""){ const t=document.createElement("div"); t.className="toast "+kind; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2400); }
let _askKey=null, _askT=0;
function ask(msg){ if(_askKey===msg && Date.now()-_askT<5000){ _askKey=null; return true; } _askKey=msg; _askT=Date.now(); toast(msg+" — da clic otra vez para confirmar"); return false; }
function beep(ok){ try{ const A=window.AudioContext||window.webkitAudioContext; if(!A) return; const c=new A(), o=c.createOscillator(), g=c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value=ok?880:220; g.gain.value=.08; o.start(); o.stop(c.currentTime+(ok?.09:.28)); setTimeout(()=>c.close(),400); }catch(e){} }
