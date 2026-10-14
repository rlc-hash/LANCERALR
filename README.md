# Sistema ALR (demo marca blanca)

Cotizador para el cliente + sistema interno (ERP ligero) para ALR. Sin servidor: `index.html` es un solo archivo que abre en cualquier navegador.

**Edita en `src/`, arma con `python3 build.py`** (genera `index.html`; `artifact.html` es una copia para visores aislados y no se versiona).

## Cliente
- **Cotizar**: ruta, cajas (cualquier cantidad), servicios, precio, **entrega estimada**, folio.
- **Etiquetas QR**: una por caja, imprimibles.
- **Rastrear**: por folio o guía; avance por caja, checkpoints y comprobante de entrega.

## Sistema ALR (PIN demo `1234`, perfiles: Dirección, Ventas, Almacén, Operador)
Panel general · Pedidos (confirmar, guía, remisión, checkpoints, entrega con firma) · **Escáner QR** (recibir, cargar, llegada, entrega; lector de mano, cámara o simulación; conciliación "15 de 15") · Viajes y unidades (salida/llegada masiva, manifiesto) · Almacén · Clientes (datos fiscales) · Facturación (CFDI 4.0 demo, XML y ZIP por cliente, pagos, cobranza) · Guías y remisiones · Reportes · Configuración (marca, tarifas, descuentos, reglas, empresa, integraciones) · Bitácora.

**Escaneo automático:** el QR de cada caja es una dirección (`…#s.FOLIO.CAJA.TOTAL`). Con la cámara normal del teléfono abre el sistema y la caja avanza sola al siguiente paso. En el escáner del sistema el modo por defecto también es automático.

**Configuración** solo la ve el perfil de LANCER (PIN aparte, definido en Configuración → Reglas); los perfiles de ALR no la ven.

Los datos viven en `localStorage` del navegador (demo).

## Operación sencilla (v7)
Pensada para una fletera que hoy lo hace todo a mano: **un toque por pedido, no una lectura por caja**. En *Operación* cada pedido muestra su siguiente paso (recibir, cargar, llegó, entregar) con un botón grande y el conteo de cajas; si el conteo no cuadra queda una incidencia. El QR de la guía abre el pedido directo en ese paso. El QR por caja sigue disponible (*Escaneo por caja*) para quien quiera control fino. Unidades con % de ocupación (Rabón, Torton, Tráiler), firma con el dedo, guía/remisión con precio, práctica guiada y modo móvil con barra inferior (instalable en iPhone/Android desde `manifest.webmanifest`).

## Recolección, seguro y conteo (v8)
- **Recolección tipo paquetería:** el cliente elige día, ventana de al menos 3 h (configurable), contacto en sitio, a quién preguntar e instrucciones. Los días llenos, sin servicio o bloqueados salen apagados.
- **Calendario interno de recolecciones:** capacidad por día, bloqueo de días, solicitudes por confirmar, asignar unidad, marcar recolectada o reprogramar.
- **Repetir un pedido** (cliente e interno): copia todo y deja modificar.
- **Seguro:** 1% del valor declarado (configurable); el cliente puede subir la factura de su mercancía; se suma al total y sale como concepto propio en la factura y el XML.
- **Conteo:** confirmación de cajas en recepción y en entrega, corrección de conteo con motivo y entrega parcial.

## Datos compartidos (v9)
Ver `docs/NUBE.md`. Con la nube conectada (Google Sheets: tu propio Excel en Drive; Supabase opcional), todos los usuarios ven los mismos pedidos, calendario y cajas. El panel general es interactivo: cada número, barra y fila abre el detalle.

## Pendientes con ALR
Logo oficial en alta resolución · azul de marca · razón social y RFC reales · factor volumétrico (556 kg/m³ es inferido) · regla para medidas especiales · tabla de recolección/entrega · descuentos por volumen · origen · IVA.
Para producción: backend compartido, PAC para timbrar (y complemento Carta Porte), usuarios individuales.
