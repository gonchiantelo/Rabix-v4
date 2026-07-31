# RAVIX V5 — Análisis de Arquitectura y Oportunidades de Mejora

> Análisis realizado sobre el estado actual del repositorio (`main`, commit `7672401`). Objetivo: identificar riesgos, deuda técnica y trazar el camino hacia una arquitectura moderna y escalable **sin tocar la experiencia visual actual**.

---

## 1. Resumen ejecutivo

RAVIX V5 es una aplicación web **100% cliente**, sin build system ni framework, compuesta por HTML/CSS/JS planos que hablan directo con **Supabase** (Postgres + Auth + Storage vía REST/RPC) desde el navegador. Funciona, pero tiene el perfil clásico de un producto que creció por acumulación: ~22.000 líneas de JS/HTML/CSS repartidas en pocos archivos gigantes, estado global mutable, credenciales duplicadas, y dos patrones de composición de UI conviviendo sin una decisión explícita entre ellos.

Se encontraron **3 problemas activos** (no hipotéticos) que conviene resolver ya, independientemente del plan de migración:

1. `index.html` carga `js/app-db.js` y `js/app-dt-drills.js`, que **no existen en el repo** → 404 en cada carga, funcionalidad de Drills probablemente rota.
2. Las credenciales de Supabase (URL + anon key) están **hardcodeadas y duplicadas** en 3 archivos distintos.
3. No hay evidencia de que las políticas de **Row Level Security (RLS)** estén auditadas — con ~100 llamadas `.from(tabla)` directas desde el cliente, esto es la superficie de ataque real (la anon key pública no es el problema; tablas sin RLS correcta, sí).

El resto de este documento detalla el estado actual, los hallazgos y las alternativas de arquitectura. El plan de migración y el backlog están en [`01-plan-migracion-backlog.md`](01-plan-migracion-backlog.md). La integración de spec-driven development está en [`02-spec-driven-development.md`](02-spec-driven-development.md).

---

## 2. Mapa del repositorio actual

```
index.html                 → SPA del Portal + Login + Onboarding DT + Shell DT + Shell Atleta (embebido)
onboarding-athlete.html     → Página física independiente (onboarding del atleta)
dashboard-athlete.html      → Página física independiente (dashboard del atleta)

js/app-core.js       (1656L) → Config Supabase, Wizard de onboarding DT, window.App (auth/router)
js/app-dt.js         (6075L) → Todo el "Tactical OS": calendario, cargas, fabric.js (pizarra táctica), stats
js/app-dt-medical.js  (692L) → Módulo médico del staff
js/app-player.js     (1273L) → Motor del "Player Shell" embebido en index.html
js/app-portal.js      (549L) → Lógica del portal de selección de rol / login

css/styles-core.css  (1465L) → Base compartida
css/styles-dt.css    (3217L) → Estilos del entorno DT
css/styles-player.css(1092L) → Estilos del shell de jugador embebido
css/app-player.css   (1648L) → Estilos adicionales del jugador
css/styles-athletes.css(938L)→ Estilos usados por dashboard-athlete.html / onboarding-athlete.html

carpeta sin título/  → Prototipo previo "RABIX V4" (PWA con service worker) — no referenciado, no forma parte del producto actual
refactor*.js, fix_hydration.js (root) → Codemods puntuales (Node scripts) usados una vez para parchear los .js con regex. No se cargan en ninguna página.
.specify/, .claude/skills/speckit-*  → Scaffold de GitHub Spec Kit, presente pero vacío (ver sección 6 y doc 02)
docs/                 → Vacío hasta este análisis
```

**Stack real:** HTML + CSS + JS vanilla, `window.*` como espacio de nombres global, Supabase JS SDK v2 cargado por CDN, Fabric.js (pizarra táctica) y Chart.js (stats) también por CDN. No hay `package.json`, no hay bundler, no hay linter, no hay tests, no hay CI/CD, no hay control de versiones de esquema de base de datos.

---

## 3. Cómo está compuesta la UI hoy (hallazgo clave)

Conviven **dos patrones de composición distintos**, sin que quede documentado por qué:

- **Entorno DT/Staff** → SPA embebida en `index.html` (`#app-shell`), alimentada por `app-core.js` + `app-dt.js` + `app-dt-medical.js`. Navegación por `classList`/`display` sobre secciones (`view-*`), sin router real.
- **Entorno Atleta** → mitad SPA (`#player-shell` embebido en `index.html`, alimentado por `app-player.js`), mitad **páginas físicas independientes** (`onboarding-athlete.html`, `dashboard-athlete.html`) con su propio `<style>` inline, sus propias variables de diseño (`--bg`, `--accent`, `--volt`...) y su propia instancia de cliente Supabase — no reutilizan `css/styles-core.css`.

Esto no es necesariamente un error: `app-core.js:32` lo hace explícito (`// V2: Onboarding atleta vive en archivo físico separado`), así que fue una decisión consciente en algún momento. Pero hoy genera:

- **Duplicación de design tokens** — si cambian los colores de marca, hay que tocarlos en `css/styles-core.css` *y* en el `<style>` inline de dos HTML distintos. Alto riesgo de que la UI "se desincronice" justo lo que el usuario quiere evitar.
- **Duplicación de la config/cliente Supabase** en 3 lugares (`app-core.js`, `dashboard-athlete.html`, `onboarding-athlete.html`).
- **Dos formas de manejar sesión**: router SPA basado en `localStorage` (`ravix_v5_uid`, `ravix_token`, `ravix_active_role`) vs. cada página física re-verificando por su cuenta.
- **Posible fragmentación de datos, no solo de UI**: `app-player.js` lee/escribe `player_wellness` y `player_training_logs`, mientras que `dashboard-athlete.html` lee/escribe `daily_wellness` y `training_logs` — nombres de tabla distintos para lo que parece ser el mismo concepto (registro de bienestar y de sesiones del atleta). Ver el inventario de tablas en [`03-inventario-tecnico-componentes.md`](03-inventario-tecnico-componentes.md#tablas). **Esto hay que confirmarlo contra el schema real de Supabase antes de asumir que ambas vistas muestran el mismo dato** — si no son vistas/alias del mismo origen, un atleta podría estar viendo información distinta según entre por la SPA o por la página física.

---

## 4. Hallazgos detallados

### 4.1 Críticos (accionables ya, no requieren esperar al plan de migración)

| # | Hallazgo | Evidencia | Impacto |
|---|---|---|---|
| C1 | `js/app-db.js` y `js/app-dt-drills.js` referenciados en `index.html:22,27` no existen en el repo | `git ls-files js/` no los lista; no hay rastro en historial | 404 en cada carga; el módulo de Drills del DT probablemente no funciona |
| C2 | Credenciales Supabase hardcodeadas y duplicadas (URL + anon key) | `js/app-core.js:7-8`, `dashboard-athlete.html:861-862`, `onboarding-athlete.html:470-471` | Config no centralizada; rotar la key implica editar 3 archivos y no olvidarse ninguno |
| C3 | Sesión manejada manualmente vía `localStorage` (`ravix_token`) en vez de `supabase.auth` | `js/app-core.js:226-228` | Reinventa lo que Supabase Auth ya resuelve (refresh de tokens, expiración); token en `localStorage` es accesible por cualquier script → superficie XSS |
| C4 | RLS no auditado / no versionado | ~100 llamadas `.from(tabla)` directas desde el cliente en 7 archivos distintos, sin capa intermedia | Si una tabla no tiene RLS correcta, cualquier usuario autenticado (o con la anon key) puede leer/escribir datos de otros equipos/atletas |
| C5 | **Corregido tras inventario detallado:** cero uso de RPC de Postgres en el código vivo. Todas las ~35 llamadas de `app-dt.js` son `.from(tabla).insert/update/upsert/select()` directas — `.rpc('guardar_tarea_calendario', ...)` y `.rpc('borrar_tarea_calendario', ...)` **solo existen como strings dentro de los codemods `refactor_dt.js`/`refactor_dt2.js`/`refactor_dt3.js`**, nunca se aplicaron al código real | `js/app-dt.js` (0 matches de `.rpc(`) vs. `refactor_dt*.js:9-54` | Toda la lógica de negocio (guardar sesión de calendario, borrar tarea, etc.) vive en el cliente sin ninguna validación centralizada en DB — más grave de lo que se pensó inicialmente. Migrar a RPC/Edge Functions no es "extender un patrón existente", es introducirlo por primera vez |

### 4.2 Deuda técnica estructural

- **Archivos monolíticos**: `app-dt.js` con 6075 líneas mezcla UI, acceso a datos, estado y lógica de la pizarra táctica (Fabric.js) en un solo archivo — cualquier cambio pequeño obliga a cargar mentalmente todo el archivo.
- **Estado global mutable**: `window.App`, `window.Wizard`, probablemente más objetos `window.*` en `app-dt.js`/`app-player.js` — sin un dueño único del estado, cualquier función puede mutarlo desde cualquier lugar.
- **Manejo de errores por `alert()`** (`js/app-core.js:210,216`) — no hay un sistema de notificaciones/toast consistente con el resto de la UI.
- **`console.log` de depuración en producción** en rutas de auth (`js/app-core.js:230` expone parte del UID en consola).
- **Sin capa de acceso a datos**: cada función de UI que necesita datos llama a Supabase directamente inline. No hay repositorio/servicio que centralice queries, cacheo o manejo de errores.
- **CSS sin sistema formal**: 5 archivos, ~8400 líneas totales, aislamiento "por convención" (comentarios como `AISLADO: No afecta ninguna clase del entorno DT`) en vez de scoping real (CSS Modules, `@scope`, BEM estricto, o Shadow DOM). Funciona hoy porque el equipo es disciplinado, pero no escala si entra más gente.
- **Sin tooling de calidad**: no hay linter, formatter, tests, ni pipeline de CI. Ningún cambio se valida automáticamente antes de llegar a producción.
- **Clutter en el repo**: carpeta `carpeta sin título/` (prototipo previo "RABIX V4", con su propio service worker — no forma parte del producto actual) y 6 scripts de codemod en la raíz (`refactor*.js`, `fix_hydration.js`) que no se cargan desde ninguna página. **Ojo:** al menos `refactor_dt.js`/`refactor_dt2.js`/`refactor_dt3.js` parecen codemods que nunca llegaron a aplicarse (proponían migrar a `.rpc()` y el código sigue en `.from()` directo) — no asumir que "ya cumplieron su función"; antes de borrarlos vale la pena revisar si alguien los necesita retomar.
- **`.specify/` y `.claude/skills/speckit-*` presentes pero vacíos**: parece que se corrió `specify init` (GitHub Spec Kit) en algún momento pero el scaffold nunca se completó — carpetas creadas, cero archivos dentro. Ver [doc 02](02-spec-driven-development.md).

### 4.3 Lo que ya está bien (no romper al migrar)

- La convención de **scoping manual por prefijo** (`#player-shell`, `.portal-*`, `.lv-*`) muestra que el equipo ya piensa en aislar módulos visualmente, solo falta tooling que lo haga cumplir.
- `app-dt.js` ya está internamente organizado en sub-objetos con responsabilidad propia (`DTEngine.FabricEngine`, `DTEngine.Board`, `DTEngine.Periodization`, etc. — ver [`03-inventario-tecnico-componentes.md`](03-inventario-tecnico-componentes.md)). No hay que inventar los límites de módulo desde cero: ya existen en el código, solo falta separarlos en archivos/módulos ES reales.
- Separar el onboarding del atleta en su propio archivo fue una decisión deliberada y documentada en el código (no un accidente) — hay que decidir formalmente si se mantiene ese patrón (multi-página) o se absorbe en la SPA, pero no es "código roto".

---

## 5. Matices de arquitectura — opciones para la nueva versión

El requisito no negociable del usuario es: **misma UI, mismos estilos, mismas pantallas, mismo backend (Supabase)**. Esto descarta cualquier reescritura visual y limita las opciones a "qué hay *debajo* del HTML/CSS actual". Se evalúan 3 niveles de intervención, de menor a mayor esfuerzo:

### Opción A — Monolito modular evolutivo (mínimo riesgo)
Mantener JS vanilla, pero:
- Introducir **Vite** solo como bundler/dev-server (sin framework) para poder usar `import`/`export` reales en vez de `window.*` globals.
- Partir `app-dt.js` en módulos ES por dominio (calendario, pizarra táctica, stats, config de equipo).
- Crear una **capa de acceso a datos** (`/src/data/*.js`) que encapsule todas las llamadas a Supabase — nadie más llama `.from()` directo.
- Un único `supabaseClient.js` con la config leída de variables de entorno (`import.meta.env`), no hardcodeada.

**Trade-off**: bajo riesgo y bajo costo, pero el techo de escalabilidad sigue siendo el de JS vanilla (sin tipado, sin componentes reales, testing manual).

### Opción B — Adopción incremental de un micro-framework reactivo (Alpine.js / htmx)
Igual que A, pero reemplazando la manipulación manual del DOM (`getElementById` + `classList`) por **Alpine.js** para el estado de UI reactivo, manteniendo el HTML/CSS existente casi intacto (Alpine trabaja sobre atributos, no reemplaza el markup). htmx puede cubrir las partes que hoy son fetch + re-render manual.

**Trade-off**: mejor DX que A sin reescribir CSS ni estructura HTML, pero introduce una dependencia de runtime nueva y un patrón mental distinto al que ya conoce el equipo (que hoy es DOM manipulation puro).

### Opción C — SPA moderna con el CSS actual portado a design tokens (React/Vue/Svelte + Vite + TypeScript)
Reescribir la capa de componentes usando **el HTML/CSS actual como fuente de verdad visual** (se porta clase por clase, no se rediseña), con:
- TypeScript + tipos generados desde el schema de Supabase (`supabase gen types typescript`).
- Testing (Vitest + Playwright para regresión visual — clave para garantizar "mismos estilos" durante la migración).
- Estado gestionado explícitamente (stores), no `window.*`.

**Trade-off**: mayor esfuerzo inicial y curva de aprendizaje si el equipo no maneja el framework, pero es el único camino que da testing real, tipado, y una base que escala a más features/equipo sin degradarse. Dado que el usuario pide explícitamente "llevar a un próximo nivel... arquitectura moderna y escalable", **esta es la recomendación** — pero ejecutada de forma incremental (ver plan de migración), no como big-bang rewrite.

### Backend / Base de datos — recomendación independiente del frontend elegido
Supabase se mantiene (es el artefacto/servicio que el usuario quiere conservar). Cambios recomendados, en orden de prioridad:
1. **Auditar y versionar RLS** — exportar políticas actuales, escribirlas como migraciones (`supabase/migrations`), y verificar cada tabla contra el modelo de acceso real (un DT solo ve su equipo, un atleta solo sus propios datos).
2. **Migrar sesión a `supabase.auth`** (con refresh automático) en vez del esquema manual de `localStorage`.
3. **Centralizar lógica de negocio sensible en RPC/Postgres functions o Edge Functions** (Deno) — seguir el patrón que ya existe (`guardar_tarea_calendario`) en vez de mezclarlo con `.insert()` directo desde el cliente.
4. **Versionar el esquema** con `supabase/migrations` + CLI, para dejar de depender de cambios manuales por el dashboard de Supabase.
5. **Generar tipos TypeScript del schema** — da contrato fuerte cliente↔DB y detecta breaking changes en build time.

### Recomendación general
**Opción A como base obligatoria** (higiene mínima: módulos ES, capa de datos, config centralizada) para *todos* los módulos desde el día uno — es barata y quita el riesgo de seguridad (C1-C5). Sobre esa base, migrar módulo a módulo hacia **Opción C** empezando por el módulo con mejor relación impacto/riesgo (ver backlog), dejando **Opción B** como alternativa si en algún punto el costo de adoptar un framework completo no se justifica para un módulo pequeño.

---

Continúa en [`01-plan-migracion-backlog.md`](01-plan-migracion-backlog.md) para el plan de ejecución y el backlog módulo a módulo.
