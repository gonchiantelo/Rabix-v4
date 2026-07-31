# Changelog

Todas las modificaciones relevantes de este proyecto se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Fixed
- Se eliminaron las referencias a `js/app-db.js` y `js/app-dt-drills.js` en `index.html` — ambos archivos no existen en el repositorio, causando un 404 garantizado en cada carga de la página.
- Se eliminaron los `<script>` duplicados de `app-core.js` y `app-dt-medical.js` (cargaban una vez en `<head>` y otra vez antes de `</body>`), que arriesgaban una doble inicialización de `window.App` / `window.DTEngine`.
