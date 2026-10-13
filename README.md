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

## Pendientes con ALR
Logo oficial en alta resolución · azul de marca · razón social y RFC reales · factor volumétrico (556 kg/m³ es inferido) · regla para medidas especiales · tabla de recolección/entrega · descuentos por volumen · origen · IVA.
Para producción: backend compartido, PAC para timbrar (y complemento Carta Porte), usuarios individuales.
