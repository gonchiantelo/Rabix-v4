#!/usr/bin/env bash
# RABIX V4 — Build script usando python3 del sistema
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

/usr/bin/python3 << PYEOF
import base64, re, os, sys

base_dir = "$DIR"

def read(f):
    with open(os.path.join(base_dir, f), encoding='utf-8') as fh:
        return fh.read()

html = read('index.html')
css  = read('styles.css')
data = read('data.js')
app  = read('app.js')

with open(os.path.join(base_dir, 'assets/logo-rabix.png'), 'rb') as fh:
    logo_b64 = base64.b64encode(fh.read()).decode('ascii')
logo_uri = 'data:image/png;base64,' + logo_b64

html = re.sub(r'<link\s+rel="stylesheet"\s+href="styles\.css"\s*/?>',
              '<style>\n' + css + '\n    </style>', html)
html = re.sub(r'<script\s+src="data\.js"></script>',
              '<script>\n' + data + '\n    </script>', html)
html = re.sub(r'<script\s+src="app\.js"></script>',
              '<script>\n' + app + '\n    </script>', html)
html = html.replace('src="assets/logo-rabix.png"', 'src="' + logo_uri + '"')
html = html.replace('href="assets/logo-rabix.png"', 'href="' + logo_uri + '"')
html = re.sub(r'\s*<link rel="manifest"[^>]+/>', '', html)

out = os.path.join(base_dir, 'RABIX_V4.html')
with open(out, 'w', encoding='utf-8') as fh:
    fh.write(html)

kb = os.path.getsize(out) / 1024
print(f'OK RABIX_V4.html generado: {kb:.0f} KB')
PYEOF
