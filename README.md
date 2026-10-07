# Cotizador ALR (demo marca blanca)

Un solo archivo, sin dependencias: abre `index.html` en el navegador (o `npx http-server`).

- **Cotizar** (cliente): ruta, piezas (Caja 1/2/3 u otra medida), servicios, remitente/destinatario → folio.
- **Rastrear envío** (cliente): por folio o guía, con checkpoints.
- **Panel ALR** (interno, PIN demo `1234`): pedidos, detalle con m³/kg, guía, checkpoints, hoja de embarque imprimible, texto WhatsApp, JSON por pedido, vista de almacén por destino, configuración (logo, colores, tarifas, reglas), exportar/importar.

Los datos viven en `localStorage` del navegador (demo). Pendientes con ALR: logo oficial, factor volumétrico (556 kg/m³ es inferido),
regla para medidas especiales, tabla de recolección/entrega, descuentos por volumen, origen, IVA.
