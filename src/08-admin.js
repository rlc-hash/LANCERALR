/* ==================== Reportes ==================== */
function repOrders(){ const lim = S.repDays==="0" ? 0 : Date.now()-(+S.repDays)*DAY; return DB.ord.filter(o=>!o.cancelado && o.createdAt>=lim); }
function entregaDias(o){ const h=[...o.history].reverse().find(x=>x.k==="entregado"); return h ? (h.at-o.createdAt)/DAY : null; }
function modReportes(){
  const os=repOrders();
  const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
  const ent=os.map(entregaDias).filter(x=>x!=null);
  const porCli={}; os.forEach(o=>{ const r=porCli[o.cli]=porCli[o.cli]||{n:0,cajas:0,val:0}; r.n++; r.cajas+=o.totals.piezas; r.val+=o.totals.total; });
  const porDest=CFG.destinos.map(d=>{ const a=os.filter(o=>o.dest===d.id); const e=a.map(entregaDias).filter(x=>x!=null); return {d,n:a.length,cajas:sum(a,o=>o.totals.piezas),m3:sum(a,o=>o.totals.m3),kg:sum(a,o=>o.totals.kg),val:sum(a,o=>o.totals.total),dias:e.length?e.reduce((x,y)=>x+y,0)/e.length:null}; });
  const maxV=Math.max(1,...Object.values(porCli).map(r=>r.val));
  return `${ptitle("Reportes",`<label for="rep-d" style="display:none">Periodo</label><select id="rep-d" data-ch="repdays" style="width:auto">${[["7","Últimos 7 días"],["30","Últimos 30 días"],["90","Últimos 90 días"],["0","Todo"]].map(([k,t])=>`<option value="${k}" ${S.repDays===k?"selected":""}>${t}</option>`).join("")}</select><button class="btn sec sm" data-act="repcsv">Exportar CSV</button>`)}
  <div class="kpis"><div class="kpi"><small>Pedidos</small><b>${os.length}</b></div><div class="kpi b"><small>Cajas movidas</small><b>${sum(os,o=>o.totals.piezas)}</b></div><div class="kpi b"><small>Volumen</small><b>${num(sum(os,o=>o.totals.m3),1)} m³</b></div><div class="kpi g"><small>Valor cotizado</small><b>${money0(sum(os,o=>o.totals.total))}</b></div><div class="kpi w"><small>Ticket promedio</small><b>${money0(os.length?sum(os,o=>o.totals.total)/os.length:0)}</b></div><div class="kpi"><small>Entrega promedio</small><b>${ent.length?num(ent.reduce((a,b)=>a+b,0)/ent.length,1)+" d":"—"}</b></div></div>
  <div class="grid g2"><div class="card"><div class="h2">Ventas por cliente</div><div class="bars">${Object.entries(porCli).sort((a,b)=>b[1].val-a[1].val).map(([id,r])=>bar(cliOf(id).razon.slice(0,22),r.val,maxV,"r",money0(r.val))).join("")||`<div class="mut">Sin datos.</div>`}</div></div>
  <div class="card"><div class="h2">Por destino</div><div class="scroll"><table><thead><tr><th>Destino</th><th class="r">Ped.</th><th class="r">Cajas</th><th class="r">m³</th><th class="r">Valor</th><th class="r">Días</th></tr></thead><tbody>${porDest.map(x=>`<tr><td>${esc(x.d.name)}</td><td class="r mono">${x.n}</td><td class="r mono">${x.cajas}</td><td class="r mono">${num(x.m3,1)}</td><td class="r mono">${money0(x.val)}</td><td class="r mono">${x.dias!=null?num(x.dias,1):"—"}</td></tr>`).join("")}</tbody></table></div></div></div>
  <div class="card" style="margin-top:16px"><div class="h2">Detalle por cliente</div><div class="scroll"><table><thead><tr><th>Cliente</th><th class="r">Pedidos</th><th class="r">Cajas</th><th class="r">Valor</th></tr></thead><tbody>${Object.entries(porCli).sort((a,b)=>b[1].val-a[1].val).map(([id,r])=>`<tr><td>${esc(cliOf(id).razon)}</td><td class="r mono">${r.n}</td><td class="r mono">${r.cajas}</td><td class="r mono">${money(r.val)}</td></tr>`).join("")}</tbody></table></div></div>`;
}
function csvOf(rows){ return "﻿"+rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n"); }

/* ==================== Bitácora ==================== */
function modBitacora(){
  const q=S.logQ.toLowerCase(); const l=DB.log.filter(x=>!q||(x.mod+x.accion+x.detalle+x.rol).toLowerCase().includes(q));
  return `${ptitle("Bitácora de actividad")}<div class="card" style="padding:16px"><div class="toolbar"><label for="lq" style="display:none">Buscar</label><input id="lq" data-in="logq" placeholder="Buscar en la bitácora…" value="${esc(S.logQ)}"><span class="mut sm" style="margin-left:auto">${l.length} registro(s)</span></div>
  <div class="scroll"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Módulo</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${l.slice(0,200).map(x=>`<tr><td class="sm">${fdate(x.at)}</td><td class="sm">${esc(x.rol)}</td><td>${esc(x.mod)}</td><td><b>${esc(x.accion)}</b></td><td class="sm">${esc(x.detalle)}</td></tr>`).join("")||`<tr><td colspan="5" class="mut c" style="padding:24px">Sin registros.</td></tr>`}</tbody></table></div></div>`;
}

/* ==================== Configuración ==================== */
function modConfig(){
  const tabs=[["marca","Marca"],["tarifas","Tarifas y destinos"],["desc","Descuentos"],["reglas","Reglas"],["empresa","Empresa y fiscal"],["usuarios","Usuarios"],["integ","Integraciones"],["datos","Datos"]];
  const b=CFG.brand, E=CFG.empresa;
  const inp=(id,l,path,v,ex="")=>`<div><label for="${id}">${l}</label><input id="${id}" data-in="cfg" data-arg="${path}" value="${esc(v)}" ${ex}></div>`;
  let body="";
  if(S.cfgTab==="marca") body=`<div class="row2">${inp("cb-n","Nombre comercial","brand.name",b.name)}${inp("cb-s","Siglas","brand.short",b.short)}
    <div><label for="cb-1">Color principal</label><input id="cb-1" type="color" data-in="cfg" data-arg="brand.c1" value="${b.c1}" style="height:44px;padding:4px"></div>
    <div><label for="cb-2">Color secundario</label><input id="cb-2" type="color" data-in="cfg" data-arg="brand.c2" value="${b.c2}" style="height:44px;padding:4px"></div></div>
    <div style="margin-top:16px;display:flex;gap:16px;align-items:center;flex-wrap:wrap"><img class="logo-prev" src="${esc(logoSrc())}" alt="logo"><div><label for="logo-file">Logo (PNG, JPG, SVG)</label><input type="file" id="logo-file" data-ch="logofile" accept="image/*"><div class="mut sm" style="margin-top:6px">Se actualiza al instante en todo el sistema y en los documentos.</div>${b.logo?`<button class="btn ghost sm" data-act="logoreset">Restablecer logo</button>`:""}</div></div>
    <div class="note sm" style="margin-top:16px">El logo cargado es de baja resolución. Sube el original (PNG grande o SVG) aquí para mejor calidad.</div>`;
  if(S.cfgTab==="tarifas") body=`<div class="scroll"><table><thead><tr><th>Caja</th><th>L</th><th>A</th><th>H</th><th>kg</th>${CFG.destinos.map(d=>`<th>${esc(d.name)} $/pza</th>`).join("")}<th></th></tr></thead><tbody>
    ${CFG.cajas.map((c,i)=>`<tr><td><input aria-label="Nombre de caja" data-in="cfgarr" data-arg="cajas|${i}|name" value="${esc(c.name)}" style="min-width:90px"></td>
    ${["l","a","h","kg"].map(k=>`<td><input aria-label="${k}" type="number" data-in="cfgarr" data-num="1" data-arg="cajas|${i}|${k}" value="${c[k]}" style="width:72px"></td>`).join("")}
    ${CFG.destinos.map(d=>`<td><input aria-label="Precio ${esc(d.name)}" type="number" step="0.01" data-in="cfgarr" data-num="1" data-arg="cajas|${i}|prices.${d.id}" value="${c.prices[d.id]??""}" style="width:96px"></td>`).join("")}
    <td><button class="x" data-act="delcaja" data-arg="${i}" ${CFG.cajas.length<2?"disabled":""} aria-label="Quitar">×</button></td></tr>`).join("")}</tbody></table></div>
    <button class="btn sec sm" data-act="addcaja" style="margin-top:10px">+ Agregar caja</button>
    <h3 style="margin:24px 0 10px">Destinos y tiempos de tránsito</h3>
    <div class="scroll"><table><thead><tr><th>Nombre</th><th>Texto visible</th><th>Días mín.</th><th>Días máx.</th><th>Solo ocurre</th><th>$/kg especial</th><th></th></tr></thead><tbody>
    ${CFG.destinos.map((d,i)=>`<tr><td><input aria-label="Destino" data-in="cfgarr" data-arg="destinos|${i}|name" value="${esc(d.name)}"></td><td><input aria-label="Texto" data-in="cfgarr" data-arg="destinos|${i}|transit" value="${esc(d.transit)}"></td>
    <td><input aria-label="Días mínimos" type="number" min="0" data-in="cfgarr" data-num="1" data-nullable="1" data-arg="destinos|${i}|tMin" value="${d.tMin??""}" style="width:70px"></td><td><input aria-label="Días máximos" type="number" min="0" data-in="cfgarr" data-num="1" data-nullable="1" data-arg="destinos|${i}|tMax" value="${d.tMax??""}" style="width:70px"></td>
    <td><input aria-label="Solo ocurre" type="checkbox" data-ch="cfgocurre" data-arg="${i}" ${d.ocurre?"checked":""}></td><td><input aria-label="Precio por kg" type="number" step="0.01" data-in="cfgarr" data-num="1" data-arg="destinos|${i}|kgRate" value="${d.kgRate}" style="width:90px"></td>
    <td><button class="x" data-act="deldest" data-arg="${i}" ${CFG.destinos.length<2?"disabled":""} aria-label="Quitar">×</button></td></tr>`).join("")}</tbody></table></div>
    <button class="btn sec sm" data-act="adddest" style="margin-top:10px">+ Agregar destino</button>
    <div class="note sm" style="margin-top:16px">Los días de tránsito alimentan la fecha estimada de entrega que ve el cliente (días hábiles, con salida al siguiente día hábil). Déjalos vacíos si el destino no tiene tiempo definido. El $/kg de medida especial es un valor de referencia, no una tarifa de ALR.</div>`;
  if(S.cfgTab==="desc") body=`<label class="chk"><input type="checkbox" data-ch="descon" ${CFG.desc.on?"checked":""}><span><b>Aplicar descuento por volumen</b><br><span class="mut sm">Descuenta un porcentaje del flete según el número total de cajas del pedido.</span></span></label>
    <div class="scroll" style="margin-top:14px"><table><thead><tr><th>Desde (cajas)</th><th>Descuento %</th><th></th></tr></thead><tbody>${CFG.desc.tiers.map((t,i)=>`<tr><td><input aria-label="Desde" type="number" data-in="cfgarr" data-num="1" data-arg="desc.tiers|${i}|desde" value="${t.desde}" style="width:110px"></td><td><input aria-label="Porcentaje" type="number" step="0.5" data-in="cfgarr" data-num="1" data-arg="desc.tiers|${i}|pct" value="${t.pct}" style="width:110px"></td><td><button class="x" data-act="deltier" data-arg="${i}" aria-label="Quitar">×</button></td></tr>`).join("")}</tbody></table></div>
    <button class="btn sec sm" data-act="addtier" style="margin-top:10px">+ Agregar escalón</button>
    <div class="note sm" style="margin-top:16px">Los escalones son de ejemplo y están apagados por defecto: ALR confirmó que existe descuento por volumen pero no entregó su tabla. El único dato firme es 300 cajas de 30 kg a Monterrey en $26,750 por caja de 43 pies completa, 19% abajo de la tarifa lineal.</div>`;
  if(S.cfgTab==="reglas") body=`<div class="row3">${inp("cg-o","Origen","origen",CFG.origen)}${inp("cg-m","Mínimo por embarque ($)","minimo",CFG.minimo,'type="number" data-num="1"')}${inp("cg-i","IVA (%)","iva",CFG.iva,'type="number" data-num="1"')}${inp("cg-v","Factor volumétrico (kg/m³)","volFactor",CFG.volFactor,'type="number" data-num="1"')}${inp("cg-g","Vigencia de tarifa","vigencia",CFG.vigencia)}${inp("cg-p","PIN del sistema","pin",CFG.pin)}</div>
    <div class="note sm" style="margin-top:16px">Factor 556 kg/m³ = inferido de “una tarima = 1,000 kg” ÷ 1.80 m³. <b>No es dato de ALR</b>: confirmar. Si la tarima mide 1.20 m de alto, sería 694. Combustible: no aplica.</div>`;
  if(S.cfgTab==="empresa") body=`<div class="row2">${inp("ce-r","Razón social","empresa.razon",E.razon)}${inp("ce-f","RFC emisor","empresa.rfc",E.rfc,'style="text-transform:uppercase"')}${inp("ce-g","Régimen fiscal (clave)","empresa.regimen",E.regimen)}${inp("ce-c","C.P. de expedición","empresa.cp",E.cp)}${inp("ce-d","Dirección","empresa.dir",E.dir)}${inp("ce-s","Serie de facturas","empresa.serie",E.serie)}${inp("ce-t","Teléfono","empresa.tel",E.tel)}${inp("ce-e","Correo","empresa.correo",E.correo)}</div>
    <div class="note sm" style="margin-top:16px">El RFC y la razón social de ejemplo se sustituyen por los reales de ALR. Para timbrar se necesita además el certificado de sello digital (CSD) y un PAC; eso se conecta en la fase de implementación.</div>`;
  if(S.cfgTab==="usuarios") body=`<div class="scroll"><table><thead><tr><th>Perfil</th><th>Acceso</th><th>Módulos</th></tr></thead><tbody>${Object.values(ROLES).map(r=>`<tr><td><b>${esc(r.t)}</b></td><td class="sm">${esc(r.who)}</td><td class="sm">${r.mods.map(m=>MODS[m].t).join(" · ")}</td></tr>`).join("")}</tbody></table></div>
    <div class="note info sm" style="margin-top:16px">En la demo se entra con un PIN por perfil. En producción cada persona tiene usuario y contraseña propios, con bitácora de lo que hace cada quien.</div>`;
  if(S.cfgTab==="integ") body=`<div class="grid g3">${[
    ["Timbrado CFDI 4.0","Conexión con un PAC para sellar y timbrar facturas con el SAT.","Fase 2"],
    ["Carta Porte","Complemento para traslados por vía federal, armado desde pedido, guía y unidad.","Fase 2"],
    ["WhatsApp Business","Avisos automáticos al cliente: confirmación, salida, llegada y entrega.","Fase 2"],
    ["Correo transaccional","Envío de cotizaciones, guías y facturas (PDF + XML) al cliente.","Fase 2"],
    ["CONTPAQi / Aspel","Exportación de facturas y cobranza a la contabilidad.","Fase 2"],
    ["API y webhooks","Conexión del pedido (JSON) con sistemas externos de ALR.","Listo en demo"],
    ["Lector de mano","Pistolas Zebra / Honeywell en modo teclado: funcionan hoy sin instalación.","Listo en demo"],
    ["Cámara del teléfono","Escaneo de etiquetas QR desde cualquier celular.","Listo en demo"],
    ["GPS de unidades","Posición en vivo del camión en el seguimiento del cliente.","Fase 3"]
  ].map(([t,d,s])=>`<div class="card flat"><div style="display:flex;justify-content:space-between;gap:8px"><b>${t}</b><span class="pill ${s==="Listo en demo"?"ok":"warn"}">${s}</span></div><div class="sm mut" style="margin-top:6px">${d}</div></div>`).join("")}</div>`;
  if(S.cfgTab==="datos") body=`<div class="chips"><button class="btn dark" data-act="exportcfg">Exportar configuración</button><label class="btn sec" style="margin:0;text-transform:none;letter-spacing:0;font-size:15px;color:var(--c2)">Importar configuración<input type="file" id="cfg-file" data-ch="cfgfile" accept=".json" hidden></label><button class="btn sec" data-act="exportdb">Exportar toda la información</button><button class="btn sec" data-act="exportcsv">Pedidos (CSV)</button></div>
    <h3 style="margin:24px 0 8px">Reiniciar demo</h3><div class="chips"><button class="btn sec sm" data-act="resetdata">Restablecer datos de ejemplo</button><button class="btn sec sm" data-act="resetall" style="color:var(--bad)">Borrar todo y volver a valores de fábrica</button></div>`;
  return `${ptitle("Configuración")}<div class="card"><div class="subtabs">${tabs.map(([k,t])=>`<button class="${S.cfgTab===k?"on":""}" data-act="cfgtab" data-arg="${k}">${t}</button>`).join("")}</div>${body}</div>`;
}
