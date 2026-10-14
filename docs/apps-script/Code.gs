/**
 * Sistema ALR · almacén de datos en Google Sheets
 * Pégalo en Extensiones → Apps Script de una hoja de cálculo nueva.
 * Antes de implementar: Configuración del proyecto → Propiedades de la secuencia de comandos → agrega CLAVE (una contraseña que tú elijas).
 */
var HOJA_ITEMS = "items", HOJA_SEQ = "seq", TROZO = 40000, MAXT = 20;

function props_() { return PropertiesService.getScriptProperties(); }
function hoja_(nombre, encabezado) {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var h = libro.getSheetByName(nombre);
  if (!h) { h = libro.insertSheet(nombre); h.appendRow(encabezado); }
  return h;
}
function items_() {
  var enc = ["id", "kind", "u", "s", "n"];
  for (var i = 1; i <= MAXT; i++) enc.push("d" + i);
  return hoja_(HOJA_ITEMS, enc);
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  var r = {};
  try { r = e && e.parameter && e.parameter.d ? JSON.parse(e.parameter.d) : { op: "ping" }; } catch (x) { return out_({ ok: false, error: "json" }); }
  return atender_(r);
}
function doPost(e) {
  var r = {};
  try { r = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: "json" }); }
  return atender_(r);
}

function atender_(r) {
  var clave = props_().getProperty("CLAVE");
  if (!clave || r.key !== clave) return out_({ ok: false, error: "clave" });
  var cerrojo = LockService.getScriptLock();
  cerrojo.waitLock(25000);
  try {
    if (r.op === "ping") return out_({ ok: true, n: Math.max(0, items_().getLastRow() - 1) });
    if (r.op === "pull") return out_(leer_(+r.since || 0));
    if (r.op === "push") return out_(guardar_(r.rows || []));
    if (r.op === "seq") return out_(folio_(String(r.k), +r.start));
    if (r.op === "seqset") return out_(folios_(r.rows || []));
    return out_({ ok: false, error: "op" });
  } finally { cerrojo.releaseLock(); }
}

/* Devuelve las filas cuyo contador s es mayor a "since". */
function leer_(since) {
  var h = items_(), n = h.getLastRow() - 1;
  if (n < 1) return { ok: true, rows: [] };
  var ss = h.getRange(2, 4, n, 1).getValues(), idx = [];
  for (var i = 0; i < n; i++) if (+ss[i][0] > since) idx.push(i);
  if (!idx.length) return { ok: true, rows: [] };
  var lo = idx[0], hi = idx[idx.length - 1];
  var bloque = h.getRange(2 + lo, 1, hi - lo + 1, 5 + MAXT).getValues(), rows = [];
  idx.forEach(function (k) {
    var f = bloque[k - lo], cnt = +f[4], d = "";
    for (var c = 0; c < cnt; c++) d += String(f[5 + c]).slice(1);
    rows.push({ id: f[0], kind: f[1], u: +f[2], s: +f[3], data: d });
  });
  return { ok: true, rows: rows };
}

/* Inserta o actualiza filas por id. Cada trozo lleva "#" al inicio para que Sheets nunca lo trate como fórmula. */
function guardar_(rows) {
  var h = items_(), n = h.getLastRow() - 1, pos = {};
  if (n > 0) h.getRange(2, 1, n, 1).getValues().forEach(function (f, i) { pos[f[0]] = i + 2; });
  var contador = +(props_().getProperty("S") || 0), nuevas = [];
  rows.forEach(function (r) {
    var txt = String(r.data), partes = [];
    for (var i = 0; i < txt.length && partes.length < MAXT; i += TROZO) partes.push("#" + txt.substr(i, TROZO));
    contador += 1;
    var linea = [r.id, r.kind, r.u, contador, partes.length].concat(partes);
    while (linea.length < 5 + MAXT) linea.push("");
    if (pos[r.id]) h.getRange(pos[r.id], 1, 1, 5 + MAXT).setValues([linea]);
    else { nuevas.push(linea); pos[r.id] = h.getLastRow() + nuevas.length; }
  });
  if (nuevas.length) h.getRange(h.getLastRow() + 1, 1, nuevas.length, 5 + MAXT).setValues(nuevas);
  props_().setProperty("S", String(contador));
  return { ok: true, n: rows.length };
}

/* Siguiente folio: nunca se repite aunque dos personas pidan al mismo tiempo (hay cerrojo). */
function folio_(k, start) {
  var h = hoja_(HOJA_SEQ, ["k", "v"]), n = h.getLastRow() - 1;
  if (n > 0) {
    var ks = h.getRange(2, 1, n, 1).getValues();
    for (var i = 0; i < n; i++) if (ks[i][0] === k) {
      var v = +h.getRange(i + 2, 2).getValue() + 1;
      h.getRange(i + 2, 2).setValue(v);
      return { ok: true, v: v };
    }
  }
  h.appendRow([k, start]);
  return { ok: true, v: start };
}
function folios_(rows) {
  var h = hoja_(HOJA_SEQ, ["k", "v"]);
  rows.forEach(function (r) {
    var n = h.getLastRow() - 1, hallado = false;
    if (n > 0) {
      var ks = h.getRange(2, 1, n, 1).getValues();
      for (var i = 0; i < n; i++) if (ks[i][0] === r.k) {
        if (+r.v > +h.getRange(i + 2, 2).getValue()) h.getRange(i + 2, 2).setValue(+r.v);
        hallado = true;
      }
    }
    if (!hallado) h.appendRow([r.k, +r.v]);
  });
  return { ok: true };
}
