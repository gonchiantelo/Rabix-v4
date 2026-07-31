# Plan de migración y backlog — RAVIX V5

> Continúa el análisis de [`00-analisis-arquitectura.md`](00-analisis-arquitectura.md). Estrategia: **strangler fig** — cada módulo nuevo convive con el viejo hasta demostrar paridad visual y funcional, y recién ahí se retira el código legacy. Nunca se toca el CSS de un módulo salvo que sea el único objetivo explícito de la tarea.

## Principios que gobiernan todo el plan

1. **Cero cambios visuales no solicitados.** El HTML/CSS actual es la fuente de verdad del diseño. Migrar = mismo DOM final, misma clase CSS, mismo comportamiento — solo cambia lo que hay *detrás*.
2. **Supabase se mantiene como backend.** No se migra de motor ni de proveedor. Se ordena y se asegura lo que ya existe.
3. **Módulo por módulo, nunca big-bang.** Cada épica entrega un módulo funcionando en paralelo al legacy, verificado, y luego reemplaza al legacy.
4. **Regresión visual automatizada desde la Fase 0.** Sin captura de pantallas "antes/después" por pantalla clave, no hay forma objetiva de garantizar "mismos estilos" durante 9 épicas de trabajo.
5. **Seguridad y config no esperan al framework.** Los hallazgos C1-C5 del doc 00 se resuelven en la Fase 0, sobre el código actual, sin esperar a Vite/React/etc.

---

## Fase 0 — Fundamentos (bloqueante, ~1-2 semanas)

Esto habilita todo lo demás. No introduce framework nuevo todavía (opción A del doc 00).

- [ ] **F0.1** — Arreglar referencias rotas: crear/recuperar `app-db.js` y `app-dt-drills.js`, o quitar las referencias de `index.html` si ya no aplican. *(Bug activo, prioridad máxima.)*
- [ ] **F0.2** — Centralizar config de Supabase en un único punto (`config.js` o `.env` + build step), eliminar las 3 copias hardcodeadas.
- [ ] **F0.3** — Auditar RLS de cada tabla usada (`profiles_athlete`, `team_configs`, `training_logs`, y las que aparezcan al inventariar `js/app-dt.js`) y documentar el modelo de acceso esperado por tabla.
- [ ] **F0.4** — Migrar el manejo de sesión de `localStorage` manual a `supabase.auth` (`onAuthStateChange`, refresh automático).
- [ ] **F0.5** — Introducir Vite como dev server/bundler (sin framework), convertir los `window.*` a módulos ES `import/export`, manteniendo el comportamiento idéntico.
- [ ] **F0.6** — Crear capa de acceso a datos (`/src/data/*.js`): un archivo por dominio (equipo, atleta, calendario, médico) que envuelva las llamadas Supabase. Ninguna otra parte del código llama `.from()` directo a partir de aquí.
- [ ] **F0.7** — Setup de regresión visual: Playwright + capturas de cada pantalla clave (portal, login, wizard DT, dashboard DT, pizarra táctica, módulo médico, onboarding atleta, dashboard atleta) contra el estado actual, como baseline.
- [ ] **F0.8** — Limpieza de repo: mover `refactor*.js`/`fix_hydration.js` a `/tools` o eliminarlos si ya no se usan; archivar o eliminar `carpeta sin título/` (prototipo V4 no referenciado).
- [ ] **F0.9** — Linter + formatter (ESLint + Prettier) y un pipeline de CI mínimo (lint + build + tests visuales) en GitHub Actions.
- [ ] **F0.10** — Versionar el esquema de Supabase con `supabase/migrations` y generar tipos TS del schema.

**Definition of Done Fase 0:** la app carga sin 404, un solo lugar define credenciales, RLS documentada, sesión vía `supabase.auth`, build reproducible con Vite, baseline visual capturado, CI corriendo en cada PR.

---

## Épicas de migración por módulo

Cada épica sigue el mismo ciclo: **Especificar → Construir en paralelo → Verificar paridad visual/funcional → Cortar el legacy → Borrar código viejo.**

### EPIC 1 — Portal & Autenticación
*Origen: `js/app-portal.js`, secciones `#view-role-selector` / `#view-login` de `index.html`.*
- 1.1 Especificar comportamiento actual (selección de rol, login, guard de sesión, mensajes de error).
- 1.2 Migrar a módulo ES sobre capa de datos F0.6, usando `supabase.auth` de F0.4.
- 1.3 Reemplazar `alert()` por el sistema de notificación visual existente en el CSS (si no existe, crear uno mínimo reutilizable, respetando el estilo actual).
- 1.4 Verificación de paridad visual (Playwright) y funcional (login válido/ inválido, expiración de sesión).
- 1.5 Retirar lógica legacy de `app-portal.js` una vez el nuevo módulo es la fuente activa.

### EPIC 2 — Onboarding (Wizard DT + `onboarding-athlete.html`)
*Origen: `window.Wizard` en `app-core.js`, `onboarding-athlete.html` completo.*
- 2.1 Decisión de arquitectura explícita: ¿el onboarding del atleta sigue siendo página física independiente, o se absorbe en la SPA? (Hoy es implícito — formalizarlo con ADR.)
- 2.2 Extraer design tokens usados en el `<style>` inline de `onboarding-athlete.html` hacia `css/styles-core.css` (o el token system que se defina), sin cambiar un solo valor visual.
- 2.3 Migrar wizard DT y flujo atleta a módulos ES + capa de datos.
- 2.4 Verificación de paridad visual y de los distintos caminos (`create` vs `join`, DT vs atleta).

### EPIC 3 — Dashboard DT / Tactical OS (el módulo más grande — dividir en sub-épicas)
*Origen: `js/app-dt.js` (6075 líneas) + `css/styles-dt.css`. Desglose completo con rangos de línea, funciones y tablas en [`03-inventario-tecnico-componentes.md`](03-inventario-tecnico-componentes.md#desglose-de-app-dtjs--windowdtengine-6075-líneas--el-módulo-grande).*

`DTEngine` ya está internamente organizado en 11 sub-áreas (3.A–3.K en el inventario técnico) — no hace falta re-descubrir los límites del módulo, solo separarlos en archivos reales:

- 3.1 **3.E Analytics** — la más chica y aislada, primer piloto de bajo riesgo dentro de esta épica.
- 3.2 **3.B Calendario, microciclo y drawer de sesión** — mayor uso diario esperado, piloto a escala real.
- 3.3 **3.C Librería de ejercicios y staging de tareas** — depende de 3.2 (comparten el drawer).
- 3.4 **3.D Home / Command Center**.
- 3.5 **3.F Perfil DT / Config de club / Motor de cargas** — la que más tablas distintas toca (`profiles_dt`, `teams`, `team_configs`, `team_load_settings`, `users`, `team_roster`); buen candidato para probar la capa de datos (F0.6) contra más superficie.
- 3.6 **3.G `FabricEngine`** (pizarra de drills) y **3.I `Board`** (pizarra del 11 titular) — **son dos motores de renderizado distintos** (Fabric.js canvas vs. SVG/DOM), tratarlos como specs separadas, no como una sola "pizarra táctica". Migrar de último — el sub-componente más complejo. Regresión visual con `canvas.toDataURL()`, no solo screenshot de DOM.
- 3.7 **3.H `RulesTagInput`** y **3.J `TagInput`** — evaluar unificarlos en un solo componente reutilizable al migrar, hoy son dos implementaciones del mismo tipo de control.
- 3.8 **3.K `Periodization`** + `SeasonPlanningModal` — confirmar la relación exacta entre ambos al especificar.
- 3.9 Introducir la capa RPC/Edge Functions para la lógica de negocio — **no es "extender un patrón existente"**: se confirmó que hoy no hay ningún uso real de RPC en el código vivo (ver corrección en doc 00, hallazgo C5). Es la primera vez que se introduce.
- 3.10 Verificación de paridad visual y funcional por cada sub-épica antes de avanzar a la siguiente.

### EPIC 4 — Módulo médico
*Origen: `js/app-dt-medical.js`.*
- 4.1 Migrar a módulo ES + capa de datos. Módulo relativamente chico (692 líneas) — buen candidato para probar el ciclo completo de migración rápido, en paralelo a EPIC 3.
- 4.2 Verificación de paridad.

### EPIC 5 — Librería de Drills
*Origen: `js/app-dt-drills.js` — actualmente referenciado pero inexistente (ver F0.1).*
- 5.1 Recuperar o reconstruir la funcionalidad esperada (revisar qué llama `app-dt.js` que hoy falla silenciosamente por la ausencia de este archivo).
- 5.2 Construir como módulo ES nuevo desde cero, ya con la arquitectura objetivo (no vale la pena "migrar" algo que no existe).

### EPIC 6 — Player Shell (SPA embebida del atleta)
*Origen: `js/app-player.js` (`PlayerEngine`, `PSTimer`, `PlayerShellEngine`, `StandaloneEngine` — cuatro namespaces ya separados, ver inventario técnico), `#player-shell` en `index.html`, `css/app-player.css` + `css/styles-player.css`.*
- 6.0 **Bloqueante:** resolver la alerta de tablas del inventario técnico (`player_wellness`/`player_training_logs` vs. `daily_wellness`/`training_logs`) contra el schema real de Supabase — confirmar si Player Shell y `dashboard-athlete.html` leen la misma data o no, *antes* de especificar la unificación de 6.2.
- 6.1 Migrar a módulo ES + capa de datos, uno por namespace (`PlayerEngine`, `PSTimer`, `PlayerShellEngine`, `StandaloneEngine`).
- 6.2 Resolver la duplicación con EPIC 7 (ver decisión 2.1) — este módulo y `dashboard-athlete.html` probablemente terminan unificados, condicionado al resultado de 6.0.

### EPIC 7 — Dashboard/páginas físicas del atleta
*Origen: `dashboard-athlete.html`.*
- 7.1 Aplicar la decisión de arquitectura de 2.1: si se mantiene como página física, tratarla como una app Vite independiente que comparte el paquete de design tokens y la capa de datos con el resto; si se absorbe en la SPA, fusionar con EPIC 6.
- 7.2 Eliminar la instancia duplicada de cliente Supabase y credenciales (ya resuelto en F0.2, aquí solo se consume).

### EPIC 8 — Sistema de diseño / CSS
*Transversal, se ejecuta en paralelo a las épicas anteriores, no bloquea ninguna.*
- 8.1 Extraer variables/colores repetidos (hoy definidos manualmente en cada archivo/`<style>` inline) a un único archivo de tokens.
- 8.2 Formalizar el scoping por módulo (hoy es por convención/comentario) con una convención verificable (BEM estricto + linter de CSS, o `@scope` nativo si el soporte de navegador lo permite).
- 8.3 Documentar el sistema de diseño resultante (paleta, tipografía, spacing) en `docs/design-system.md`.

### EPIC 9 — Cierre y limpieza final
- 9.1 Confirmar que no queda código legacy sin retirar (grep de `window.App`, `window.Wizard`, llamadas `.from()` fuera de la capa de datos).
- 9.2 Actualizar este backlog marcando lo completado, archivar decisiones en ADRs.
- 9.3 Pipeline de deploy formal (hoy no existe ninguno documentado).

---

## Orden recomendado de ejecución

```
Fase 0 (bloqueante)
   │
   ├── EPIC 1 (Portal & Auth)         ← primero: módulo chico, valida el patrón end-to-end
   ├── EPIC 4 (Médico)                ← en paralelo: módulo chico, segundo piloto
   │
   ├── EPIC 2 (Onboarding)            ← depende de EPIC 1 (auth) y de la decisión 2.1
   │
   ├── EPIC 3 (Dashboard DT)          ← el más grande, se ejecuta por sub-épicas (3.2 → 3.5)
   ├── EPIC 5 (Drills)                ← depende de 3.1 (inventario) para saber qué reconstruir
   │
   ├── EPIC 6 + EPIC 7 (Atleta)       ← depende de la decisión 2.1
   │
   ├── EPIC 8 (Design system)         ← transversal, corre en paralelo desde el día 1
   └── EPIC 9 (Cierre)
```

**Por qué este orden:** se empieza por los módulos más chicos (Portal, Médico) para validar el ciclo completo — especificar, migrar, verificar paridad, cortar legacy — con bajo riesgo, antes de aplicarlo al módulo más grande y crítico (Dashboard DT). El sistema de diseño (EPIC 8) es transversal porque cada módulo migrado se beneficia de tokens centralizados, pero no bloquea a ninguno.

Este backlog es el punto de partida para generar specs formales módulo a módulo — ver [`02-spec-driven-development.md`](02-spec-driven-development.md) para cómo convertir cada épica en `spec.md` → `plan.md` → `tasks.md` usando las skills de Spec Kit ya presentes (aunque vacías) en este repo.
