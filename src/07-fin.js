/* ==================== Clientes ==================== */
const REGIMENES = {"601":"General de Ley Personas Morales","603":"Personas Morales con Fines no Lucrativos","605":"Sueldos y Salarios","612":"Personas Físicas con Actividades Empresariales","616":"Sin obligaciones fiscales","621":"Incorporación Fiscal","626":"Régimen Simplificado de Confianza (RESICO)"};
const USOS = {"G01":"Adquisición de mercancías","G03":"Gastos en general","P01":"Por definir","S01":"Sin efectos fiscales"};
const rfcOK = r => /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(String(r||"").toUpperCase());
function cliStats(c){
  const os=DB.ord.filter(o=>o.cli===c.id&&!o.cancelado), fs=DB.fac.filter(f=>f.cli===c.id&&f.estado!=="cancelada"&&f.estado!=="borrador");
  return {pedidos:os.length, cajas:os.reduce((s,o)=>s+o.totals.piezas,0), facturado:fs.reduce((s,f)=>s+f.total,0), saldo:fs.reduce((s,f)=>s+facSaldo(f),0)};
}
function modClientes(){
  const q=S.fCliQ.toLowerCase();
  const list=DB.cli.filter(c=>!q||(c.razon+c.rfc+c.nombre+c.correo+c.id).toLowerCase().includes(q));
  return `${ptitle("Clientes",`<button class="btn sm" data-act="newcli">+ Nuevo cliente</button>`)}
  <div class="card" style="padding:16px"><div class="toolbar"><label for="cq" style="display:none">Buscar</label><input id="cq" data-in="fcliq" placeholder="Buscar razón social, RFC, contacto…" value="${esc(S.fCliQ)}"><span class="mut sm" style="margin-left:auto">${list.length} cliente(s)</span></div>
  <div class="scroll"><table><thead><tr><th>Clave</th><th>Razón social</th><th>RFC</th><th>Contacto</th><th class="r">Crédito</th><th class="r">Pedidos</th><th class="r">Facturado</th><th class="r">Saldo</th></tr></thead><tbody>
  ${list.map(c=>{ const s=cliStats(c); return `<tr class="click" data-act="vercli" data-arg="${esc(c.id)}"><td><b>${esc(c.id)}</b></td><td>${esc(c.razon)}${c.pendiente?` <span class="pill warn">datos fiscales</span>`:""}</td><td class="mono sm">${esc(c.rfc||"—")}</td><td class="sm">${esc(c.nombre)}<div class="mut">${esc(c.correo)}</div></td><td class="r">${c.credito?c.credito+" días":"Contado"}</td><td class="r mono">${s.pedidos}</td><td class="r mono">${money0(s.facturado)}</td><td class="r mono">${s.saldo>0.5?`<b style="color:var(--bad)">${money0(s.saldo)}</b>`:"—"}</td></tr>`; }).join("")}
  </tbody></table></div></div>`;
}
function cliForm(c){
  const f=(id,l,v,extra="")=>`<div><label for="cl-${id}">${l}</label><input id="cl-${id}" value="${esc(v)}" ${extra}></div>`;
  const sel=(id,l,opts,v)=>`<div><label for="cl-${id}">${l}</label><select id="cl-${id}">${Object.entries(opts).map(([k,t])=>`<option value="${k}" ${v===k?"selected":""}>${k} · ${esc(t)}</option>`).join("")}</select></div>`;
  return `<div class="row2">${f("razon","Razón social",c.razon)}${f("rfc","RFC",c.rfc,'style="text-transform:uppercase" placeholder="12 o 13 caracteres"')}
    ${sel("regimen","Régimen fiscal",REGIMENES,c.regimen)}${f("cp","C.P. fiscal",c.cp)}
    ${sel("uso","Uso de CFDI",USOS,c.uso)}${f("credito","Días de crédito",c.credito,'type="number" min="0"')}
    ${f("nombre","Contacto",c.nombre)}${f("tel","Teléfono",c.tel)}</div>
    <div style="margin-top:12px">${f("correo","Correo",c.correo)}</div><div style="margin-top:12px">${f("dir","Dirección",c.dir)}</div>
    <label class="chk" style="margin-top:12px"><input type="checkbox" id="cl-ret" ${c.retIva?"checked":""}><span><b>Aplicar retención de IVA 4%</b><br><span class="mut sm">Solo si el cliente es persona moral y su contador lo confirma. Se resta en la factura.</span></span></label>
    <div style="margin-top:12px"><label for="cl-notas">Notas internas</label><textarea id="cl-notas" rows="2">${esc(c.notas||"")}</textarea></div>`;
}
function openCliente(id){
  const c = id==="new" ? {id:"new",razon:"",rfc:"",regimen:"601",cp:"",uso:"G03",nombre:"",correo:"",tel:"",dir:"",credito:0,retIva:false,notas:""} : cliOf(id);
  const os=DB.ord.filter(o=>o.cli===c.id), fs=DB.fac.filter(f=>f.cli===c.id), s=id==="new"?null:cliStats(c);
  openModal({title:id==="new"?"Nuevo cliente":`${c.razon}`, wide:true, key:"cli:"+id,
    html:`${s?`<div class="row4" style="margin-bottom:14px">${[["Pedidos",s.pedidos],["Cajas",s.cajas],["Facturado",money0(s.facturado)],["Saldo",money0(s.saldo)]].map(([a,b])=>`<div style="background:var(--soft);padding:10px;border-radius:10px"><div class="xs mut">${a}</div><b class="mono">${b}</b></div>`).join("")}</div>`:""}
    ${cliForm(c)}
    ${s&&fs.length?`<div class="h2" style="margin-top:18px">Facturas y XML</div>${fs.map(f=>`<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)"><span class="sm"><b>${esc(f.id)}</b> · ${fday(f.fecha)} · ${money(f.total)} <span class="pill ${facEstado(f)==="pagada"?"ok":facEstado(f)==="vencida"?"bad":"warn"}">${esc(FAC_ST[facEstado(f)])}</span></span><span class="chips"><button class="btn sec sm" data-act="verfac" data-arg="${esc(f.id)}">Ver</button><button class="btn sec sm" data-act="xmlfac" data-arg="${esc(f.id)}">XML</button></span></div>`).join("")}
      <button class="btn sec sm" style="margin-top:10px" data-act="xmlcli" data-arg="${esc(c.id)}">Descargar todos los XML (.zip)</button>`:""}
    ${s&&os.length?`<div class="h2" style="margin-top:18px">Pedidos</div>${os.slice(0,12).map(o=>`<div class="sm" style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--line);cursor:pointer" data-act="open" data-arg="${esc(o.folio)}"><span><b>${esc(o.folio)}</b> · ${esc(dest(o.dest).name)} · ${o.totals.piezas} cajas</span>${badge(o)}</div>`).join("")}`:""}`,
    actions:`<button class="btn sm" data-act="savecli" data-arg="${esc(id)}">Guardar cliente</button>`});
}

/* ==================== Facturación ==================== */
function pendientesFacturar(){ return DB.ord.filter(o=>!o.cancelado&&stIdx(o)>=1&&!o.fac.some(id=>{ const f=facOf(id); return f&&f.estado!=="cancelada"; })); }
function modFact(){
  const tabs=[["fac","Facturas"],["pend","Por facturar"],["cob","Cobranza"]];
  const head=`${ptitle("Facturación",`<span class="pill warn">CFDI 4.0 · modo demostración</span>`)}
    <div class="note info sm" style="margin-bottom:14px">El sistema arma la factura y su XML con los datos del pedido (clave SAT 78101800, IVA, retenciones, uso de CFDI). El <b>timbrado</b> con el SAT se hace conectando un proveedor autorizado (PAC); en esta demo el XML sale <b>sin sello ni validez fiscal</b>. El complemento Carta Porte se agrega cuando el traslado usa vía federal.</div>
    <div class="subtabs">${tabs.map(([k,t])=>`<button class="${S.ftab===k?"on":""}" data-act="ftab" data-arg="${k}">${t}</button>`).join("")}</div>`;
  if(S.ftab==="pend"){
    const p=pendientesFacturar();
    return head+`<div class="card" style="padding:16px"><div class="scroll"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Guía</th><th>Estatus</th><th class="r">Subtotal</th><th class="r">Total</th><th></th></tr></thead><tbody>
    ${p.map(o=>`<tr><td><b>${esc(o.folio)}</b></td><td>${esc(cliOf(o.cli).razon)}</td><td class="sm">${esc(o.guia)}</td><td>${badge(o)}</td><td class="r mono">${money(o.totals.subtotal)}</td><td class="r mono">${money(o.totals.total)}</td><td class="r"><button class="btn sm" data-act="facturar" data-arg="${esc(o.folio)}">Facturar</button></td></tr>`).join("")||`<tr><td colspan="7" class="mut c" style="padding:24px">No hay pedidos pendientes de facturar.</td></tr>`}</tbody></table></div></div>`;
  }
  if(S.ftab==="cob"){
    const abiertas=DB.fac.filter(f=>["emitida","vencida"].includes(facEstado(f))&&facSaldo(f)>0.5);
    const bucket=f=>{ const d=Math.floor((Date.now()-f.venc)/DAY); return d<=0?0:d<=15?1:d<=30?2:3; };
    const tot=[0,0,0,0]; abiertas.forEach(f=>tot[bucket(f)]+=facSaldo(f));
    const lbl=["Corriente","Vencido 1–15 días","Vencido 16–30 días","Vencido +30 días"];
    const por={}; abiertas.forEach(f=>{ (por[f.cli]=por[f.cli]||[0,0,0,0])[bucket(f)]+=facSaldo(f); });
    return head+`<div class="kpis">${tot.map((v,i)=>`<div class="kpi ${i===0?"g":i===1?"w":""}"><small>${lbl[i]}</small><b>${money0(v)}</b></div>`).join("")}</div>
    <div class="card" style="padding:16px"><div class="scroll"><table><thead><tr><th>Cliente</th>${lbl.map(l=>`<th class="r">${l}</th>`).join("")}<th class="r">Total</th></tr></thead><tbody>
    ${Object.entries(por).map(([id,v])=>`<tr><td>${esc(cliOf(id).razon)}</td>${v.map(x=>`<td class="r mono">${x?money0(x):"—"}</td>`).join("")}<td class="r mono"><b>${money0(v.reduce((a,b)=>a+b,0))}</b></td></tr>`).join("")||`<tr><td colspan="6" class="mut c" style="padding:24px">Sin saldos por cobrar.</td></tr>`}</tbody></table></div></div>`;
  }
  const fl=DB.fac;
  return head+`<div class="card" style="padding:16px"><div class="toolbar"><span class="mut sm">${fl.length} factura(s)</span><button class="btn sec sm" style="margin-left:auto" data-act="xmlall">Descargar todos los XML (.zip)</button></div>
  <div class="scroll"><table><thead><tr><th>Factura</th><th>Cliente</th><th>Fecha</th><th>Vence</th><th class="r">Total</th><th class="r">Saldo</th><th>Estado</th><th></th></tr></thead><tbody>
  ${fl.map(f=>{ const st=facEstado(f); return `<tr class="click" data-act="verfac" data-arg="${esc(f.id)}"><td><b>${esc(f.id)}</b></td><td>${esc(cliOf(f.cli).razon)}</td><td class="sm">${fday(f.fecha)}</td><td class="sm">${f.estado==="borrador"?"—":fday(f.venc)}</td><td class="r mono">${money(f.total)}</td><td class="r mono">${st==="pagada"||st==="cancelada"?"—":money(facSaldo(f))}</td><td><span class="pill ${st==="pagada"?"ok":st==="vencida"?"bad":st==="borrador"?"":"warn"}">${esc(FAC_ST[st])}</span></td><td class="r"><button class="btn sec sm" data-act="xmlfac" data-arg="${esc(f.id)}">XML</button></td></tr>`; }).join("")||`<tr><td colspan="8" class="mut c" style="padding:24px">Aún no hay facturas.</td></tr>`}</tbody></table></div></div>`;
}
function openFac(id){
  const f=facOf(id); if(!f) return; const st=facEstado(f), saldo=facSaldo(f);
  const pagos=f.pagos.map(p=>`<div class="sm" style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--line)"><span>${fday(p.at)} · ${esc(p.ref||"")}</span><b>${money(p.monto)}</b></div>`).join("");
  openModal({title:`Factura ${f.id}`, wide:true, key:"fac:"+id,
    html:`<div class="sheet">${factDoc(f)}</div>
    <div class="grid g2" style="margin-top:14px">
      <div><div class="h2" style="margin-bottom:6px">Pagos</div>${pagos||`<div class="mut sm">Sin pagos registrados.</div>`}<div class="sm" style="margin-top:6px">Saldo: <b>${money(saldo)}</b></div></div>
      ${["emitida","vencida"].includes(st)?`<div><div class="h2" style="margin-bottom:6px">Registrar pago</div><div class="row3"><div><label for="pg-m">Monto</label><input id="pg-m" type="number" step="0.01" value="${saldo.toFixed(2)}"></div><div><label for="pg-f">Forma</label><select id="pg-f"><option value="03">03 Transferencia</option><option value="01">01 Efectivo</option><option value="02">02 Cheque</option><option value="04">04 Tarjeta</option></select></div><div><label for="pg-r">Referencia</label><input id="pg-r" placeholder="SPEI…"></div></div><button class="btn ok sm" style="margin-top:8px" data-act="pagar" data-arg="${esc(f.id)}">Registrar pago</button></div>`:""}
    </div>`,
    actions:`${st==="borrador"?`<button class="btn sm" data-act="emitir" data-arg="${esc(f.id)}">Emitir (demo, sin timbre)</button>`:""}<button class="btn sec sm" data-act="xmlfac" data-arg="${esc(f.id)}">Descargar XML</button>${SANDBOX?"":`<button class="btn sec sm" data-act="printdoc">Imprimir / PDF</button>`}${st!=="cancelada"&&st!=="pagada"?`<button class="btn ghost sm" style="color:var(--bad)" data-act="cancelfac" data-arg="${esc(f.id)}">Cancelar factura</button>`:""}`});
}
function reopenFac(id){ if(S.modals.length&&S.modals[S.modals.length-1].key==="fac:"+id) S.modals.pop(); openFac(id); }
function xmlZip(list, name){
  if(!list.length){ toast("No hay facturas para descargar","bad"); return; }
  if(SANDBOX){ download(name, list.map(f=>`<!-- ${f.id}.xml -->\n${cfdiXML(f)}`).join("\n")); return; }
  download(name, zipStore(list.map(f=>({name:`${f.id}.xml`, text:cfdiXML(f)}))), "application/zip");
}

/* ==================== Guías, remisiones y manifiestos ==================== */
function modDocs(){
  const tabs=[["rem","Remisiones"],["guia","Guías"],["mani","Manifiestos de carga"]];
  const head=`${ptitle("Guías y remisiones")}<div class="subtabs">${tabs.map(([k,t])=>`<button class="${S.docTab===k?"on":""}" data-act="dtab" data-arg="${k}">${t}</button>`).join("")}</div>`;
  if(S.docTab==="mani") return head+`<div class="card" style="padding:16px"><div class="scroll"><table><thead><tr><th>Viaje</th><th>Unidad</th><th>Operador</th><th>Destino</th><th class="r">Pedidos</th><th>Estado</th><th></th></tr></thead><tbody>${DB.via.map(v=>`<tr><td><b>${esc(v.id)}</b></td><td>${esc(v.unidad)}</td><td>${esc(v.operador)}</td><td>${esc(dest(v.dest).name)}</td><td class="r">${v.ords.length}</td><td>${esc(VIA_ST[v.status])}</td><td class="r"><button class="btn sec sm" data-act="doc" data-arg="mani|${v.id}">Abrir</button></td></tr>`).join("")}</tbody></table></div></div>`;
  const os=DB.ord.filter(o=>!o.cancelado&&stIdx(o)>=1);
  return head+`<div class="card" style="padding:16px"><div class="scroll"><table><thead><tr><th>${S.docTab==="rem"?"Remisión":"Guía"}</th><th>Pedido</th><th>Cliente</th><th>Destinatario</th><th>Fecha</th><th>Entrega</th><th></th></tr></thead><tbody>
  ${os.map(o=>`<tr><td><b>${esc(S.docTab==="rem"?o.rem:o.guia)}</b></td><td>${esc(o.folio)}</td><td>${esc(o.sol.empresa||o.sol.nombre)}</td><td>${esc(o.dst.nombre)}</td><td class="sm">${fday(o.createdAt)}</td><td>${o.pod?`<span class="pill ok">Firmada · ${esc(o.pod.nombre)}</span>`:`<span class="pill warn">Pendiente</span>`}</td>
  <td class="r"><button class="btn sec sm" data-act="doc" data-arg="${S.docTab}|${esc(o.folio)}">Abrir</button> <button class="btn sec sm" data-act="labels" data-arg="${esc(o.folio)}" data-from="sistema">QR</button></td></tr>`).join("")||`<tr><td colspan="7" class="mut c" style="padding:24px">Sin documentos todavía. Confirma un pedido para generarlos.</td></tr>`}</tbody></table></div></div>`;
}
