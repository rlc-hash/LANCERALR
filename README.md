# Sistema ALR (demo marca blanca)

Cotizador para el cliente + sistema interno (ERP ligero) para ALR. Sin servidor: `index.html` es un solo archivo que abre en cualquier navegador.

**Edita en `src/`, arma con `python3 build.py`** (genera `index.html`; `artifact.html` es una copia para visores aislados y no se versiona).

## Cliente
- **Cotizar**: ruta, cajas (cualquier cantidad), servicios, precio, **entrega estimada**, folio.
- **Etiquetas QR**: una por caja, imprimibles.
- **Rastrear**: por folio o guía; avance por caja, checkpoints y comprobante de entrega.

## Sistema ALR (PIN demo `1234`, perfiles: Dirección, Ventas, Almacén, Operador)
Panel general · Pedidos (confirmar, guía, remisión, checkpoints, entrega con firma) · **Escáner QR** (recibir, cargar, llegada, entrega; lector de mano, cámara o simulación; conciliación "15 de 15") · Viajes y unidades (salida/llegada masiva, manifiesto) · Almacén · Clientes (datos fiscales) · Facturación (CFDI 4.0 demo, XML y ZIP por cliente, pagos, cobranza) · Guías y remisiones · Reportes · Configuración (marca, tarifas, descuentos, reglas, empresa, integraciones) · Bitácora.

Los datos viven en `localStorage` del navegador (demo).

## Pendientes con ALR
Logo oficial en alta resolución · azul de marca · razón social y RFC reales · factor volumétrico (556 kg/m³ es inferido) · regla para medidas especiales · tabla de recolección/entrega · descuentos por volumen · origen · IVA.
Para producción: backend compartido, PAC para timbrar (y complemento Carta Porte), usuarios individuales.
