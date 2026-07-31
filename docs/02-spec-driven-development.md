# Spec-Driven Development para RAVIX V5

## Lo que ya hay en el repo (y por qué no funciona todavía)

Este repositorio ya tiene el **scaffold de [GitHub Spec Kit](https://github.com/github/spec-kit)** instalado como skills de Claude Code:

```
.claude/skills/
  speckit-constitution/
  speckit-specify/
  speckit-clarify/
  speckit-plan/
  speckit-tasks/
  speckit-analyze/
  speckit-checklist/
  speckit-implement/
  speckit-converge/
  speckit-taskstoissues/

.specify/
  memory/
  templates/
  scripts/bash/
  workflows/speckit/
  integrations/
```

**Problema:** todas estas carpetas están **vacías** — cero archivos `SKILL.md`, cero templates, cero scripts. Es decir, se corrió `specify init` (o se creó el scaffold manualmente) en algún momento, pero el proceso no llegó a copiar el contenido real. Hoy, si escribís `/speckit.specify` en este repo, no va a encontrar instrucciones que ejecutar.

## Paso 1 — Reparar la instalación

Desde la raíz del repo, correr el inicializador oficial de Spec Kit apuntando a Claude Code como agente. Es seguro re-ejecutarlo: solo puebla archivos, no toca tu código de app:

```bash
uvx --from git+https://github.com/github/spec-kit.git specify init --here --ai claude
```

(Si no tenés `uv` instalado, la alternativa es `pip install specify-cli` y luego `specify init --here --ai claude`.)

Esto debería:
- Poblar `.specify/templates/` con `spec-template.md`, `plan-template.md`, `tasks-template.md`.
- Poblar `.specify/scripts/bash/` con los scripts que las skills invocan (crear branch de feature, generar `spec.md`, etc.).
- Poblar cada carpeta `.claude/skills/speckit-*/` con su `SKILL.md`.

Verificar después con:

```bash
git status
```

y revisar qué se agregó antes de commitear (no debería tocar nada fuera de `.specify/` y `.claude/skills/`).

## Paso 2 — Constitución del proyecto (antes de escribir la primera spec)

El paso `/speckit.constitution` genera `.specify/memory/constitution.md`: las reglas que **todas** las specs y planes futuros deben respetar. Para RAVIX V5, la constitución debería capturar explícitamente los principios ya definidos en [`00-analisis-arquitectura.md`](00-analisis-arquitectura.md) y [`01-plan-migracion-backlog.md`](01-plan-migracion-backlog.md), por ejemplo:

- **No se modifica el HTML/CSS visual salvo que sea el objetivo explícito de la tarea.** Cualquier plan que implique cambios de estilo no solicitados se rechaza en la fase de `/speckit.analyze`.
- **Supabase es el backend fijo.** No se proponen alternativas de base de datos o BaaS.
- **Toda spec de migración de módulo debe incluir un paso de verificación de paridad visual** (Playwright contra el baseline de la Fase 0).
- **Ninguna llamada a Supabase fuera de la capa `/src/data/*`** una vez migrado un módulo.
- **RLS se verifica, nunca se asume**, en cualquier spec que toque una tabla nueva o existente.

Esta constitución es la que hace que el flujo de spec-driven development sea *robustecedor* del código, tal como pediste: cada feature nueva que pase por `/speckit.plan` va a ser chequeada contra estas reglas antes de implementarse.

## Paso 3 — Flujo recomendado, aplicado al backlog

El backlog de [`01-plan-migracion-backlog.md`](01-plan-migracion-backlog.md) ya está cortado en épicas del tamaño correcto para alimentar el flujo de Spec Kit una por una. Para cada épica (ej. "EPIC 1 — Portal & Autenticación"):

1. **`/speckit.specify`** — usando como input la sección correspondiente del backlog + los hallazgos del doc 00 sobre ese módulo (ej. C3: sesión manejada por `localStorage`). Esto genera `spec.md` con el comportamiento esperado, sin hablar todavía de implementación.
2. **`/speckit.clarify`** — resuelve ambigüedades antes de planear (ej.: la decisión 2.1 sobre si el onboarding del atleta sigue siendo página física — esto es exactamente el tipo de pregunta que este paso debería forzar a responder antes de seguir).
3. **`/speckit.plan`** — genera el plan técnico del módulo, restringido por la constitución (Vite + módulos ES + capa de datos + Supabase sin cambios, según la Opción A/C definida en el doc 00).
4. **`/speckit.tasks`** — desglosa el plan en tareas ejecutables — el detalle fino que complementa los ítems ya listados en el backlog.
5. **`/speckit.analyze`** — chequeo de consistencia entre spec, plan y tareas antes de tocar código (acá se atraparía, por ejemplo, un plan que accidentalmente reescribe CSS).
6. **`/speckit.implement`** — ejecuta las tareas.
7. **`/speckit.checklist`** — checklist de calidad/paridad antes de dar el módulo por cerrado (paridad visual, RLS verificada, capa de datos respetada).

`/speckit.converge` y `/speckit.taskstoissues` quedan disponibles para, respectivamente, reconciliar specs que diverjan del código real a mitad de migración, y volcar las tareas generadas como issues de GitHub si el equipo quiere trackear el backlog ahí en vez de (o además de) en este `docs/`.

## Por qué este orden importa acá en particular

El riesgo más grande de este proyecto no es técnico, es de **deriva silenciosa del diseño visual** durante una migración larga (9 épicas). El flujo `specify → clarify → plan → analyze` obliga a que cada cambio pase por un chequeo explícito contra la constitución *antes* de que se escriba una sola línea de implementación — es la forma más barata de garantizar, spec a spec, que "mismos estilos y pantallas" se cumple en la práctica y no solo en la intención inicial.

## Próximo paso concreto

1. Correr el comando del Paso 1 para poblar el scaffold.
2. Correr `/speckit.constitution` con los principios listados arriba.
3. Empezar por EPIC 1 (Portal & Auth) con `/speckit.specify` — es la épica más chica del backlog, ideal para validar que el flujo completo (specify → implement) funciona antes de aplicarlo al Dashboard DT (EPIC 3), que es donde realmente se paga el retorno de esta inversión.
