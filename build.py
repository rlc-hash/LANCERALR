#!/usr/bin/env python3
"""Arma index.html (sitio completo) y artifact.html (versión para visor aislado) desde src/."""
import re, sys, pathlib
R = pathlib.Path(__file__).parent
S = R/"src"
rd = lambda p: (S/p).read_text()
app = "\n".join(rd(f) for f in ["00-logo.js","01-core.js","02-data.js","03-docs.js","04-ui.js","05-erp.js","06-ops.js","07-fin.js","08-admin.js","10-oper.js","09-main.js"])
app = '"use strict";\n' + app.replace('"use strict";\n','',1)
head = '''<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
@@EXTRA@@<title>Cotizador ALR</title>
<style>
%s
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <div class="brand" id="brand"></div>
  <nav class="tabs" id="nav"></nav>
</div></header>
<div class="stripe"></div>
<main id="app"></main>
<footer id="foot"></footer>
<div id="print-root"></div>
<div id="overlay"></div>
<script>
%s
</script>
<script>
%s
</script>
<script>
%s
</script>
</body>
</html>
''' % (rd("style.css"), rd("vendor/qrcode.js"), rd("vendor/jsQR.js"), app)
extra='<meta name="theme-color" content="#14327d">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="ALR">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<link rel="icon" href="icon-192.png">\n'
(R/"index.html").write_text(head.replace('@@EXTRA@@',extra))
head=head.replace('@@EXTRA@@','')
art = re.sub(r'<!doctype html>\s*<html[^>]*>\s*<head>\s*','',head)
art = art.replace('</head>\n<body>\n','').replace('</body>\n</html>\n','').replace('<meta charset="utf-8">\n','').replace('<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n','')
out = sys.argv[1] if len(sys.argv)>1 else str(R/"artifact.html")
pathlib.Path(out).write_text(art)
print("index.html", len(head), "bytes; artifact", len(art))
