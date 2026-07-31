# Inventario técnico de componentes — RAVIX V5

> Complementa [`00-analisis-arquitectura.md`](00-analisis-arquitectura.md) y [`01-plan-migracion-backlog.md`](01-plan-migracion-backlog.md). Este documento existe para un solo propósito: darle a `/speckit.specify` contexto real (funciones, rangos de línea, tablas tocadas) en vez de descripciones a nivel de archivo. Al generar la spec de una épica, citar la sección correspondiente de este inventario en el prompt.

---

## Corrección importante sobre el análisis previo

El doc 00 (hallazgo C5) afirmaba que parte de la lógica ya vivía en RPC de Postgres (`guardar_tarea_calendario`). **Es incorrecto** — se corrigió ahí, se repite acá porque cambia el diagnóstico: `.rpc(` tiene **cero** apariciones en el código vivo (`js/*.js`, `*.html`). Esas llamadas solo existen como strings de reemplazo dentro de `refactor_dt.js`, `refactor_dt2.js` y `refactor_dt3.js` — codemods que, aparentemente, se escribieron pero nunca se ejecutaron contra el código real. **Toda** la lógica de negocio hoy vive en el cliente vía `.from(tabla).insert/update/upsert/select()`. Esto sube la prioridad de F0.3/EPIC 3.6 del backlog: no es "extender un patrón que ya funciona", es introducirlo por primera vez.

---

## Registro de tablas Supabase tocadas desde el cliente {#tablas}

Construido por grep de `.from('...')` en todo el repo (`js/*.js`, `dashboard-athlete.html`, `onboarding-athlete.html`). Ninguna pasa por una capa intermedia — cada fila de esta tabla es, hoy, una superficie de RLS a auditar por separado (F0.3).

| Tabla | Tocada desde | Uso aparente |
|---|---|---|
| `teams` | app-core.js, app-dt.js, app-portal.js, app-player.js, onboarding-athlete.html | Entidad equipo |
| `team_configs` | app-core.js, app-dt.js, app-portal.js | Configuración de equipo (fechas de partido, ajustes) |
| `team_roster` | app-dt.js, app-player.js, app-dt-medical.js | Plantel/roster de jugadores |
| `team_load_settings` | app-dt.js | Parámetros del motor de cargas |
| `users` | app-core.js | Tabla de usuarios base |
| `profiles_dt` | app-core.js, app-dt.js, app-portal.js | Perfil del staff/DT |
| `profiles_athlete` | app-core.js, app-player.js, dashboard-athlete.html, onboarding-athlete.html | Perfil del atleta |
| `exercises_library` | app-core.js | Librería de ejercicios (biblioteca base, no custom) |
| `custom_exercises` | app-core.js, app-dt.js | Ejercicios/drills creados por el DT |
| `microcycle_sessions` | app-dt.js, app-portal.js, dashboard-athlete.html | Sesiones de entrenamiento del calendario/microciclo |
| `training_logs` | app-dt.js, dashboard-athlete.html | Registro de entrenamiento — **ver alerta abajo** |
| `player_training_logs` | app-player.js | Registro de entrenamiento del atleta — **ver alerta abajo** |
| `daily_wellness` | dashboard-athlete.html | Check-in de bienestar diario — **ver alerta abajo** |
| `player_wellness` | app-player.js | Check-in de bienestar del atleta — **ver alerta abajo** |

### ⚠️ Alerta a resolver antes de EPIC 6/7

`app-player.js` (shell embebido) y `dashboard-athlete.html` (página física) usan **nombres de tabla distintos** para lo que parecen ser los mismos dos conceptos:

- Entrenamiento: `player_training_logs` vs. `training_logs`
- Bienestar: `player_wellness` vs. `daily_wellness`

Tres explicaciones posibles, cada una con implicancia distinta para la spec de EPIC 6/7:
1. Son la misma data vista desde tablas/vistas distintas (alias) → sin riesgo real, solo hay que documentar el mapeo.
2. Son conceptualmente distintas (ej. una es el plan que carga el DT, otra el log que carga el atleta) → está bien que sean tablas separadas, pero hay que nombrarlo así en la spec, no asumir duplicación.
3. Son divergencia real de datos entre las dos superficies de UI del atleta → un atleta podría ver datos incompletos según por dónde entre. Esto es un bug de producto, no solo deuda técnica.

**Acción antes de escribir la spec de EPIC 6/7:** confirmar contra el dashboard de Supabase (schema real + si son vistas) cuál de las tres aplica. No avanzar la unificación de Player Shell / dashboard-athlete asumiendo que comparten datos.

---

## Mapa de namespaces globales (`window.*`) por archivo

| Archivo | Namespace(s) | Responsabilidad aparente |
|---|---|---|
| `app-core.js` | `window.Wizard`, `window.App` | Config Supabase, wizard de onboarding DT, router/guard de sesión, login/signup |
| `app-portal.js` | `window.PortalHub` (IIFE) | Selección de rol, transición portal → login |
| `app-dt.js` | `window.SeasonPlanningModal`, `window.DTEngine` (+ sub-objetos, ver abajo), funciones sueltas al final del archivo | Todo el "Tactical OS" del DT — ver desglose completo abajo |
| `app-dt-medical.js` | `window.DTMedical` | Ficha médica / lesiones del plantel (usa `team_roster`) |
| `app-player.js` | `window.PlayerEngine`, `window.PSTimer`, `window.PlayerShellEngine`, `window.StandaloneEngine` | Motor del shell del atleta embebido — cuatro sub-sistemas, ver nota abajo |

**Nota sobre `app-player.js`:** cuatro namespaces top-level en un mismo archivo (1273 líneas) sugieren que ya está mentalmente dividido en sub-responsabilidades aunque físicamente no lo esté: `PlayerEngine` (vistas/navegación del shell), `PSTimer` (temporizador de sesión — barra de progreso, estados de color), `PlayerShellEngine` (el motor principal, con `state` propio — bootstrap, tabs, wellness, extra-team flow), `StandaloneEngine` (motor de "escenarios" — parece ser el modo sin equipo/standalone, con `ESCENARIOS` y `OBJETIVO` como datos de configuración). Igual que con `DTEngine`, estos son candidatos directos a módulos ES separados — los límites ya existen en el código.

---

## Desglose de `app-dt.js` / `window.DTEngine` (6.075 líneas — el módulo grande)

`DTEngine` es un único objeto literal desde la línea 157 hasta ~5920. Internamente ya está organizado en secciones marcadas con comentarios `═══` y en sub-objetos anidados. Este desglose es la base para partir **EPIC 3** en sub-épicas reales (reemplaza la enumeración genérica del doc 01).

### 3.A — Bootstrap y resolución de equipo · L157–356
`fetchMonthLogs()`, `fetchTeamConfig()`, `changeMonth()`, `renderDashboard()`.
Resuelve `teamId` con "3 capas de fallback" (comentario explícito en L184) — punto de fragilidad conocido por el propio autor del código, buen candidato a endurecer con tipos/tests al migrar.
**Tablas:** `team_configs`, `teams`.

### 3.B — Calendario, microciclo y drawer de sesión · L1641–2094
`generateCalendar()`, `calcularEtiquetaMD()`, `getTypeClass()`, `openDrawer()`, `toggleCalendarMatchDay()`, `guardarDrawerSession()`, `eliminarDrawerSession()`, `forceLabel()`, `saveMatchDays()`, `updateDrawerUI()`.
**Tablas:** `microcycle_sessions`, `training_logs`, `team_configs`.
**Candidato a EPIC 3, primer sub-módulo a migrar** (mayor uso diario esperado).

### 3.C — Librería de ejercicios y staging de tareas (drag & drop) · L2102–2414
`renderLibrary()`, `stageLabel()`, `stageExercise()`, `saveStagedTasks()`, `handleTaskDrop()`, `actualizarActividad()`, `removeTask()`, `deleteCustomTask()`, `openTaskModal()`, `renderTaskModal()`.
**Tablas:** `training_logs`, `custom_exercises`, `microcycle_sessions`.
Depende de 3.B (comparten el drawer/calendario).

### 3.D — Home / Command Center · L2524–2981
`closeModal()`, `closeDrawer()`, `refreshState()`, `updateHomeUI()`, `updateCommandCenter()`, `getPendingMatchResults()`, `_renderPendingResultsWidget()`, `resolveMatchResult()`, `renderHomeCharts()` (Chart.js), `toggleView()`.
**Tablas:** `microcycle_sessions` (resultados de partido pendientes).

### 3.E — Analytics · L3077–3173
`renderAnalytics()`. La sección más chica y aislada — buen candidato a migrar temprano dentro de EPIC 3 para validar el patrón con bajo riesgo.

### 3.F — Perfil DT / Configuración de club / Motor de cargas · L3173–3493
`loadProfile()`, `handleImageUpload()`, `switchSettingsTab()`, `saveDTProfile()`, `saveClubSettings()`, `saveLoadEngineSettings()`.
**Tablas:** `profiles_dt`, `teams`, `team_configs`, `team_load_settings`, `users`, `team_roster`.
Es el sub-módulo que más tablas distintas toca — buen candidato para ser el primero en pasar por una capa de datos real (F0.6), ya que ejercita el patrón contra más superficie.

### 3.G — `FabricEngine` (pizarra de drills, Fabric.js) · L3520–4140, + modal de tarea custom L4362–4682
Motor de dibujo táctico sobre canvas (Fabric.js): `_placeObject()` (fábrica de fichas de jugador y flechas de pase), herramientas de selección/dibujo, exportación a PNG. Incluye además una calculadora de "Juegos Reducidos" (`autoFillM2()`, `calcDensity()`, `calcTacticalGroups()` — tabla paramétrica de teoría de juegos reducidos) y el formulario de creación de drill custom (`openCustomTaskModal()`, `saveCustomTask()` → escribe en `custom_exercises` y sube `tactical_diagram_url`).
**Es el sub-componente más complejo e interactivo de toda la app.** Migrar de último dentro de EPIC 3, y considerar Playwright con capturas de canvas (no solo DOM) para la regresión visual — un `toDataURL()` del canvas antes/después es más confiable que un screenshot genérico acá.

### 3.H — `RulesTagInput` · L4704–4756
Widget de tags para "Reglas de Acción y Provocación" del modelo de juego. Componente de UI reutilizable (ver también 3.J) — candidato a extraerse como componente compartido en vez de duplicarse.

### 3.I — `Board` — "Pizarra del 11 Ideal" · L4759–5562
**Un segundo motor de pizarra, distinto de `FabricEngine`.** No usa Fabric.js — manipula SVG/DOM directo (`innerHTML` sobre capas `#board-layer`, `svg`, `zones`). Sirve para la formación/alineación titular, no para diagramar drills. Las funciones sueltas al final del archivo (`injectBoardElement()`, `drawCarriles()`, `removeSelectedElement()`, `clearBoard()`, `selectTool()` — L5922–6075, fuera de `DTEngine`) pertenecen a este sub-sistema, no a `FabricEngine`.
**Importante para la spec:** no tratar "la pizarra táctica" como un solo componente — son dos motores de renderizado distintos (Fabric.js canvas vs. SVG/DOM) con propósitos distintos (diagramar un drill vs. armar el 11 titular). Conviene que sean dos specs separadas dentro de EPIC 3.

### 3.J — `TagInput` · L5565–5644
Segundo widget de tags, para "Principios Operativos del Modelo de Juego". Mismo patrón que 3.H — evaluar si conviene unificarlos en un solo componente `TagInput` reutilizable durante la migración, ya que hoy son dos implementaciones separadas del mismo tipo de control.

### 3.K — `Periodization` · L5647–~5920
Motor de planificación de temporada (Macro/Meso/Microciclo). `window.SeasonPlanningModal` (L27, fuera de `DTEngine`) es, aparentemente, el wrapper de modal/UI que lo invoca — confirmar la relación exacta al escribir la spec.
**Tabla:** `team_configs` (fechas de partido usadas para el roadmap).

---

## Mapa de vistas del DOM (`index.html`) → módulo que las controla

| `id` de sección | Controlado por | Notas |
|---|---|---|
| `#view-role-selector` | `app-portal.js` (`PortalHub`) | Portal de entrada |
| `#view-login` | `app-portal.js`, `app-core.js` (`App.login`/`App.signUp`) | Login split-panel |
| `#view-onboarding` / `#wizard-dt` | `app-core.js` (`Wizard`) | Wizard de onboarding DT |
| `#view-dt-hub` / `#app-shell` | `app-dt.js` (`DTEngine`), `app-dt-medical.js` | Shell principal del DT — `DTEngine.renderDashboard()` puebla `#app-shell` dinámicamente |
| `#view-athlete-dashboard` | referenciado desde `app-core.js`/`app-player.js` | Confirmar si sigue en uso o es remanente — no se encontró referencia directa de escritura de contenido dinámico, solo toggles de visibilidad |
| `#view-athletes` (`.athlete-world`) | `app-portal.js` | Relacionado al flujo de selección de atleta |
| `#view-onboarding-athlete` | redirige a `onboarding-athlete.html` (página física) | Ver EPIC 2, decisión de arquitectura pendiente |
| `#player-shell` | `app-player.js` (`PlayerShellEngine`) | Shell del atleta embebido — homólogo dinámico de `dashboard-athlete.html` |

---

## Cómo usar esto al generar specs

Para cada sub-épica de EPIC 3 (3.A a 3.K de este documento), el prompt de `/speckit.specify` debería incluir:
1. El rango de líneas y las funciones listadas acá (contexto de comportamiento actual).
2. Las tablas tocadas (contexto de datos).
3. Cualquier alerta marcada con ⚠️ que aplique, resuelta *antes* de especificar, no durante.

Ejemplo de prompt para la primera sub-épica a migrar:

> Especificar la migración del sub-módulo "Calendario, microciclo y drawer de sesión" de `DTEngine` (RAVIX V5), hoy implementado en `js/app-dt.js:1641-2094` (funciones `generateCalendar`, `openDrawer`, `guardarDrawerSession`, `eliminarDrawerSession`, `saveMatchDays`, etc.), que opera sobre las tablas Supabase `microcycle_sessions`, `training_logs` y `team_configs` sin capa de datos intermedia. Mantener comportamiento y HTML/CSS idénticos (`css/styles-dt.css`); mover el acceso a datos a `/src/data/calendar.js`.

Este nivel de detalle es el que falta si se le pide a `/speckit.specify` que trabaje solo a partir de "EPIC 3 — Dashboard DT" del backlog original.
