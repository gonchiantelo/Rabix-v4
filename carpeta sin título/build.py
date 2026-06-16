#!/usr/bin/env python3
"""
RABIX V4 Build Script
Combines index.html + styles.css + data.js + app.js + logo (base64)
into a single self-contained RABIX_V4.html
"""

import base64
import re
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def read(filename):
    with open(os.path.join(BASE_DIR, filename), 'r', encoding='utf-8') as f:
        return f.read()

def read_b64(filename):
    with open(os.path.join(BASE_DIR, filename), 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')

# Load sources
html = read('index.html')
css  = read('styles.css')
data = read('data.js')
app  = read('app.js')

# Logo as base64 data URI
logo_b64 = read_b64('assets/logo-rabix.png')
logo_uri = f'data:image/png;base64,{logo_b64}'

# Replace external CSS link with inline <style>
html = re.sub(
    r'<link\s+rel="stylesheet"\s+href="styles\.css"\s*/?>',
    f'<style>\n{css}\n</style>',
    html
)

# Replace external script tags with inline <script>
html = re.sub(
    r'<script\s+src="data\.js"></script>',
    f'<script>\n{data}\n</script>',
    html
)
html = re.sub(
    r'<script\s+src="app\.js"></script>',
    f'<script>\n{app}\n</script>',
    html
)

# Replace logo/image src references
html = html.replace('src="assets/logo-rabix.png"', f'src="{logo_uri}"')

# Update manifest to be inline (remove manifest link since it can't load from file://)
html = re.sub(r'<link rel="manifest" href="manifest\.json" />', '', html)

# Add a proper inline manifest as JSON-LD / meta
pwa_meta = f'''    <link rel="apple-touch-icon" href="{logo_uri}" />'''
html = html.replace('<link rel="apple-touch-icon" href="assets/logo-rabix.png" />', pwa_meta)

# Update title to V4
html = html.replace('<title>RABIX V4 — Training OS</title>',
                    '<title>RABIX V4 — Training OS</title>')

out_path = os.path.join(BASE_DIR, 'RABIX_V4.html')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(html)

size_kb = os.path.getsize(out_path) / 1024
print(f"✅ RABIX_V4.html generado exitosamente")
print(f"   Tamaño: {size_kb:.1f} KB")
print(f"   Ruta: {out_path}")
