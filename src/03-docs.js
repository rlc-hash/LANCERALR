/* ==================== Documentos imprimibles ==================== */
const logoSrc = () => CFG.brand.logo || LOGO_DEFAULT;
function docHead(titulo, folio, qrText, extra){
  return `<div class="hd"><div style="display:flex;gap:12px;align-items:center"><img class="lg" src="${esc(logoSrc())}" alt=""><div><b style="font-size:14px">${esc(CFG.empresa.razon)}</b><div>${esc(CFG.empresa.dir)} · RFC ${esc(CFG.empresa.rfc)}</div></div></div>
    <div style="display:flex;gap:12px;align-items:center;text-align:right"><div><div style="font-size:11px;letter-spacing:1px">${esc(titulo)}</div><div style="font-size:24px;font-weight:800">${esc(folio)}</div>${extra||""}</div><div class="qr">${qrSVG(qrText)}</div></div></div>`;
}
function servTxt(o){ return [o.serv.recoleccion&&"Recolección en domicilio",o.serv.entrega&&"Entrega en domicilio",o.serv.seguro&&"Seguro"].filter(Boolean).join(", ")||"Ninguno"; }
function cargaTabla(o, precio){
  const t=o.totals;
  const pr = precio ? `<th>P. unit.</th><th>Importe</th>` : "";
  const cols = precio ? 7 : 5;
  const totales = precio ? `
    <table style="margin:10px 0 0 auto;width:300px;border-collapse:collapse"><tr><td>Flete</td><td class="r">${money(t.sub)}</td></tr>
    ${t.discPct?`<tr><td>Descuento por volumen ${t.discPct}%</td><td class="r">−${money(t.disc)}</td></tr>`:""}
    ${t.minApplied?`<tr><td>Mínimo por embarque</td><td class="r">${money(CFG.minimo)}</td></tr>`:""}
    <tr><td>Subtotal</td><td class="r">${money(t.subtotal)}</td></tr><tr><td>IVA ${CFG.iva}%</td><td class="r">${money(t.iva)}</td></tr><tr><td><b>Total</b></td><td class="r"><b>${money(t.total)}</b></td></tr></table>
    ${t.est?`<div style="font-size:11px;margin-top:4px">Incluye medida especial: precio estimado, sujeto a validación de ALR.</div>`:""}` : "";
  return `<table style="width:100%;border-collapse:collapse"><thead><tr><th>Cant.</th><th>Descripción</th><th>Medidas (cm)</th><th>kg c/u</th><th>m³</th>${pr}</tr></thead><tbody>
    ${t.lines.map(l=>`<tr><td class="c"><b>${l.qty}</b></td><td>${esc(itemName(l))}</td><td>${l.l}×${l.a}×${l.h}</td><td class="r">${num(l.kgU,1)}</td><td class="r">${num(l.m3,3)}</td>${precio?`<td class="r">${money(l.unit)}</td><td class="r">${money(l.line)}</td>`:""}</tr>`).join("")}
    <tr><td class="c"><b>${t.piezas}</b></td><td colspan="2"><b>TOTAL</b> (${num(t.kg)} kg)</td><td class="r"><b>${num(t.kg)} kg</b></td><td class="r"><b>${num(t.m3,3)}</b></td>${precio?`<td></td><td class="r"><b>${money(t.sub)}</b></td>`:""}</tr></tbody></table>${totales}`;
}
function partes(o){
  return `<div class="two"><div><b>REMITENTE</b><br>${esc(o.sol.empresa||o.sol.nombre)}<br>${esc(o.sol.nombre)} · ${esc(o.sol.tel)}<br>${esc(o.sol.correo)}</div>
    <div><b>DESTINATARIO</b><br>${esc(o.dst.nombre)}<br>${esc(o.dst.dir)}<br>${esc(o.dst.tel)}</div></div>`;
}
function guiaDoc(o){
  const e=eta(o.dest,o.createdAt), f=(o.firmas||{}).remitente;
  return `<div class="doc">${docHead(o.guia?"GUÍA DE EMBARQUE":"PRE-GUÍA · HOJA DE EMBARQUE", o.guia||o.folio, `${qrBase()}#g.${o.folio}`)}
    ${o.guia?"":`<p class="wm">Pre-guía: queda sujeta a confirmación de ${esc(CFG.brand.short)}. Entrega esta hoja con tus cajas; el QR abre el pedido en el almacén.</p>`}
    <p style="font-size:14px"><b>Pedido:</b> ${esc(o.folio)} &nbsp; <b>Fecha:</b> ${fday(o.createdAt)} &nbsp; <b>Ruta:</b> ${esc(CFG.origen)} → <b>${esc(dest(o.dest).name)}</b> (${esc(dest(o.dest).transit)})${e?` &nbsp; <b>Entrega estimada:</b> ${esc(etaText(e))}`:""}</p>
    ${partes(o)}${cargaTabla(o,true)}
    <p><b>Servicios:</b> ${esc(servTxt(o))} &nbsp; <b>Cajas a etiquetar:</b> ${o.totals.piezas}</p>${o.obs?`<p><b>Observaciones:</b> ${esc(o.obs)}</p>`:""}
    <div class="sig"><div>${firmaTag(f&&f.img,"firma remitente")}Firma remitente${f?` · ${esc(f.nombre)}`:""}</div><div>Firma operador / recolección</div><div>Firma almacén</div></div></div>`;
}
function remisionDoc(o){
  const e=eta(o.dest,o.createdAt), p=o.pod;
  return `<div class="doc">${docHead("REMISIÓN DE ENTREGA", o.rem||"(sin remisión)", `${qrBase()}#g.${o.folio}`)}
    <p style="font-size:14px"><b>Guía:</b> ${esc(o.guia||"—")} &nbsp; <b>Pedido:</b> ${esc(o.folio)} &nbsp; <b>Fecha:</b> ${fday(o.createdAt)}${e?` &nbsp; <b>Entrega estimada:</b> ${esc(etaText(e))}`:""}</p>
    ${partes(o)}${cargaTabla(o,true)}
    <p>Recibí de conformidad la mercancía descrita, en buen estado y completa (${o.totals.piezas} bultos).</p>
    ${p?`<p><b>Recibió:</b> ${esc(p.nombre)} ${p.id?`· ID: ${esc(p.id)}`:""} · ${fdate(p.at)}${p.notas?` · ${esc(p.notas)}`:""}</p>`:""}
    <div class="sig"><div>${firmaTag(p&&p.firma,"firma de quien recibe")}Nombre y firma de quien recibe${p?` · ${esc(p.nombre)}`:""}</div><div>${p?fdate(p.at):""}<br>Fecha y hora</div><div>Operador ${esc(CFG.brand.short)}</div></div>
    <p class="wm">Documento operativo. La factura fiscal (CFDI) se emite por separado.</p></div>`;
}
function manifestoDoc(v){
  const os = v.ords.map(ordOf).filter(Boolean);
  const tp = os.reduce((s,o)=>s+o.totals.piezas,0), tm = os.reduce((s,o)=>s+o.totals.m3,0), tk = os.reduce((s,o)=>s+o.totals.kg,0);
  return `<div class="doc">${docHead("MANIFIESTO DE CARGA", v.id, `ALR-VIAJE|${v.id}`)}
    <p style="font-size:14px"><b>Unidad:</b> ${esc(v.unidad)} (${esc(v.placas)}) &nbsp; <b>Operador:</b> ${esc(v.operador)} &nbsp; <b>Destino:</b> ${esc(dest(v.dest).name)} &nbsp; <b>Estado:</b> ${esc(VIA_ST[v.status])}</p>
    <table style="width:100%;border-collapse:collapse"><thead><tr><th>Pedido</th><th>Guía</th><th>Remitente</th><th>Destinatario</th><th>Cajas</th><th>Cargadas</th><th>m³</th><th>kg</th></tr></thead><tbody>
    ${os.map(o=>{ const c=stageCounts(o); const cg=c[2]+c[3]+c[4]+c[5]; return `<tr><td>${esc(o.folio)}</td><td>${esc(o.guia)}</td><td>${esc(o.sol.empresa||o.sol.nombre)}</td><td>${esc(o.dst.nombre)}</td><td class="r">${o.totals.piezas}</td><td class="r">${cg}</td><td class="r">${num(o.totals.m3,2)}</td><td class="r">${num(o.totals.kg,0)}</td></tr>`; }).join("")}
    <tr><td colspan="4"><b>TOTAL</b></td><td class="r"><b>${tp}</b></td><td></td><td class="r"><b>${num(tm,2)}</b></td><td class="r"><b>${num(tk,0)}</b></td></tr></tbody></table>
    <div class="sig"><div>Despachó (almacén)</div><div>Operador de la unidad</div><div>Recibió en destino</div></div></div>`;
}
function factDoc(f){
  const c=cliOf(f.cli), E=CFG.empresa, est=facEstado(f);
  return `<div class="doc">${docHead("FACTURA · CFDI 4.0 (VISTA PREVIA)", `${f.serie}-${f.folio}`, `ALR-FAC|${f.id}|${(f.uuid||"SIN-TIMBRAR")}`)}
    <p class="wm">DEMO · Comprobante sin timbrar y sin validez fiscal. Para timbrar se conecta un proveedor autorizado (PAC).</p>
    <div class="two"><div><b>EMISOR</b><br>${esc(E.razon)}<br>RFC ${esc(E.rfc)} · Régimen ${esc(E.regimen)}<br>Lugar de expedición ${esc(E.cp)}</div>
    <div><b>RECEPTOR</b><br>${esc(c.razon)}<br>RFC ${esc(c.rfc||"(pendiente)")} · Régimen ${esc(c.regimen)} · CP ${esc(c.cp||"—")}<br>Uso CFDI ${esc(f.uso)}</div></div>
    <p><b>Fecha:</b> ${fday(f.fecha)} &nbsp; <b>Método:</b> ${esc(f.metodo)} &nbsp; <b>Forma:</b> ${esc(f.forma)} &nbsp; <b>Moneda:</b> MXN &nbsp; <b>UUID:</b> ${esc(f.uuid||"— sin timbrar —")}</p>
    <table style="width:100%;border-collapse:collapse"><thead><tr><th>Clave SAT</th><th>Descripción</th><th>Unidad</th><th>Cant.</th><th>Importe</th></tr></thead><tbody>
    ${f.conceptos.map(x=>`<tr><td>78101800</td><td>${esc(x.desc)}</td><td>E48</td><td class="c">1</td><td class="r">${money(x.importe)}</td></tr>`).join("")}</tbody></table>
    <table style="margin:10px 0 0 auto;width:260px;border-collapse:collapse"><tr><td>Subtotal</td><td class="r">${money(f.subtotal)}</td></tr><tr><td>IVA ${CFG.iva}%</td><td class="r">${money(f.iva)}</td></tr>${f.ret?`<tr><td>Retención IVA 4%</td><td class="r">−${money(f.ret)}</td></tr>`:""}<tr><td><b>Total</b></td><td class="r"><b>${money(f.total)}</b></td></tr></table>
    <p style="font-size:11px">Estado: ${esc(FAC_ST[est]||est)} · Complemento Carta Porte: se agrega cuando el traslado utiliza vía federal (se arma con los datos del pedido y la guía).</p></div>`;
}
function etiquetasHTML(o, limit){
  const n=o.sc.length, lim=Math.min(n, limit||48);
  let h=""; for(let i=1;i<=lim;i++){ const it=itemOfBox(o,i);
    h+=`<div class="lab"><div class="qr">${qrSVG(boxCode(o.folio,i,n))}</div><div class="t"><b>${esc(dest(o.dest).name)}</b><div class="big">${i}<span style="font-size:14px;font-weight:700"> / ${n}</span></div><div><b>${esc(o.folio)}</b></div><div>${esc(o.dst.nombre)}</div><div>${esc(CFG.brand.short)} · ${esc(o.guia||"pre-guía")}</div>${it?`<div style="margin-top:3px"><b>${it.l}×${it.a}×${it.h} cm · ${num(it.kg,1)} kg</b><br><span style="font-size:10px">medidas máximas declaradas</span></div>`:""}</div></div>`;
  }
  return {html:h, shown:lim, total:n};
}
const VIA_ST = {abierto:"Planeado", cargando:"Cargando", en_ruta:"En ruta", llegado:"Llegó a destino", cerrado:"Cerrado"};
const FAC_ST = {borrador:"Borrador", emitida:"Emitida", pagada:"Pagada", vencida:"Vencida", cancelada:"Cancelada"};
