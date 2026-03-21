'use strict';

/* ============================================================
   RABIX V4 — Data Engine
   Biblioteca · Objetivos · Planificación · Pesos · Escenarios
   ============================================================ */

const RABIX_VERSION = 'V4.0';
const PLAN_START_DATE = '2026-03-16';

/* ── Sport Module Types ── */
const MODULO_DEPORTIVO = { EQUIPO: 'equipo', FUERZA: 'fuerza', RESISTENCIA: 'resistencia' };

/* ── Morfociclo Patterns (Team Sports — Periodización Táctica) ── */
const MORFOCICLO_PATTERNS = {
    0: { label: 'Descanso', intensidad: 0, color: '#6b7280' },
    1: { label: 'Recuperación', intensidad: 2, color: '#22c55e' },
    2: { label: 'Resistencia', intensidad: 6, color: '#3b82f6' },
    3: { label: 'Tensión', intensidad: 10, color: '#ef4444' },
    4: { label: 'Velocidad', intensidad: 7, color: '#f59e0b' },
    5: { label: 'Activación', intensidad: 4, color: '#a78bfa' },
    6: { label: 'Competencia', intensidad: 8, color: '#f97316' },
};

/* ── HR Training Zones (Endurance) ── */
const ZONAS_ENTRENAMIENTO = [
    { id: 'Z1', label: 'Regenerativo', min: 50, max: 60, color: '#22c55e' },
    { id: 'Z2', label: 'Subaeróbico', min: 60, max: 70, color: '#3b82f6' },
    { id: 'Z3', label: 'Superaeróbico', min: 70, max: 80, color: '#f59e0b' },
    { id: 'Z4', label: 'VO2 Máximo', min: 80, max: 90, color: '#ef4444' },
    { id: 'Z5', label: 'Anaeróbico', min: 90, max: 100, color: '#dc2626' },
];

/* ── RIR Progression ── */
const RIR_PROGRESSION_THRESHOLD = 2;

/* ============================================================
   CATEGORÍAS DE ENTRENAMIENTO — Estructura jerárquica
   ============================================================ */
const CATEGORIAS_ENTRENAMIENTO = [
    {
        id: 'DEPORTES',
        label: 'Deportes',
        emoji: '⚽',
        subcategorias: [
            {
                id: 'FUTBOL',
                label: 'Fútbol',
                emoji: '⚽',
                niveles: [
                    { id: 'FUTBOL_PRO', label: 'Profesional', desc: '7 días/sem — Entrenamiento completo de alto rendimiento' },
                    { id: 'FUTBOL_SEMI', label: 'Semi-Profesional', desc: '3-4 días/sem + partido — Gimnasio y cancha' },
                    { id: 'FUTBOL_AMATEUR', label: 'Amateur', desc: '1-2 días/sem + partido — Mantenimiento y diversión' },
                ]
            },
            { id: 'TENIS', label: 'Tenis', emoji: '🎾', niveles: [{ id: 'TENIS_GEN', label: 'General', desc: 'Plan genérico para tenistas' }] },
            { id: 'BOXEO', label: 'Boxeo', emoji: '🥊', niveles: [{ id: 'BOXEO_GEN', label: 'General', desc: 'Plan genérico para boxeadores' }] },
            { id: 'HOCKEY', label: 'Hockey', emoji: '🏑', niveles: [{ id: 'HOCKEY_GEN', label: 'General', desc: 'Plan genérico para hockey' }] },
            { id: 'ATLETISMO', label: 'Atletismo', emoji: '🏃', niveles: [{ id: 'ATLETISMO_GEN', label: 'General', desc: 'Plan genérico para atletismo' }] },
            { id: 'BALONCESTO', label: 'Baloncesto', emoji: '🏀', niveles: [{ id: 'BALONCESTO_GEN', label: 'General', desc: 'Plan genérico para baloncesto' }] },
            { id: 'RUGBY', label: 'Rugby', emoji: '🏉', niveles: [{ id: 'RUGBY_GEN', label: 'General', desc: 'Plan genérico para rugby' }] },
            { id: 'HANDBALL', label: 'Handball', emoji: '🤾', niveles: [{ id: 'HANDBALL_GEN', label: 'General', desc: 'Plan genérico para handball' }] },
            { id: 'NATACION', label: 'Natación', emoji: '🏊', niveles: [{ id: 'NATACION_GEN', label: 'General', desc: 'Plan genérico para natación' }] },
        ]
    },
    {
        id: 'GIMNASIO',
        label: 'Gimnasio',
        emoji: '🏋️',
        subcategorias: [
            { id: 'GYM_ALTO_RENDIMIENTO', label: 'Alto Rendimiento', emoji: '⚡' },
            { id: 'GYM_MASA_MUSCULAR', label: 'Masa Muscular', emoji: '💪' },
            { id: 'GYM_PERDIDA_PESO', label: 'Pérdida de Peso', emoji: '🔥' },
            { id: 'GYM_DEFINICION', label: 'Definición', emoji: '🎯' },
            { id: 'GYM_AEROBICO', label: 'Capacidad Aeróbica', emoji: '🌊' },
            { id: 'GYM_FUERZA_PURA', label: 'Fuerza Pura', emoji: '🏋️' },
            { id: 'GYM_FLEXIBILIDAD', label: 'Flexibilidad y Movilidad', emoji: '🧘' },
            { id: 'GYM_CROSSFIT', label: 'CrossFit / Funcional', emoji: '💥' },
            { id: 'GYM_REHABILITACION', label: 'Rehabilitación', emoji: '🫀' },
        ]
    }
];

/* ============================================================
   OBJETIVOS DE ENTRENAMIENTO — Planes detallados
   ============================================================ */
const OBJETIVOS_DISPONIBLES = [
    /* ══════════ GIMNASIO ══════════ */
    {
        id: 'ALTO_RENDIMIENTO', categoria: 'GIMNASIO', selectorId: 'GYM_ALTO_RENDIMIENTO',
        moduloDeportivo: 'fuerza',
        label: 'Alto Rendimiento', emoji: '⚡', color: '#00c8ff',
        desc: 'Fuerza, potencia y técnica de campo. Para atletas competitivos.',
        rpeYellow: 7.1, rpeRed: 8.5, duracionSemanas: 17,
        dayScenario: { 1: 'FUERZA_PIERNA_B', 2: 'FUERZA_TREN_SUP', 3: 'HIPERTROFIA_INF', 4: 'HIPERTROFIA_SUP', 5: 'PREVENCION', 6: 'PARTIDO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Acumulación', color: '#22c55e', semanas: [1, 4] },
            { num: 2, nombre: 'Intensificación', color: '#3b82f6', semanas: [5, 9] },
            { num: 3, nombre: 'Transformación', color: '#f59e0b', semanas: [10, 13] },
            { num: 4, nombre: 'Pico Competitivo', color: '#ef4444', semanas: [14, 17] },
        ],
        metricaLabel: 'Vol. Semanal',
    },
    {
        id: 'MASA_MUSCULAR', categoria: 'GIMNASIO', selectorId: 'GYM_MASA_MUSCULAR',
        moduloDeportivo: 'fuerza',
        label: 'Masa Muscular', emoji: '💪', color: '#8b5cf6',
        desc: 'Hipertrofia progresiva. Más volumen, más músculo.',
        rpeYellow: 7.5, rpeRed: 9.0, duracionSemanas: 16,
        dayScenario: { 1: 'MASA_PIERNAS', 2: 'MASA_EMPUJE', 3: 'MASA_TRACCION', 4: 'MASA_HOMBROS_BRAZOS', 5: 'MASA_PIERNAS_B', 6: 'DESCANSO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Base Hipertrófica', color: '#8b5cf6', semanas: [1, 4] },
            { num: 2, nombre: 'Acumulación de Volumen', color: '#7c3aed', semanas: [5, 9] },
            { num: 3, nombre: 'Intensificación', color: '#6d28d9', semanas: [10, 13] },
            { num: 4, nombre: 'Descarga y Consolidación', color: '#5b21b6', semanas: [14, 16] },
        ],
        metricaLabel: 'Tonelaje',
    },
    {
        id: 'PERDIDA_PESO', categoria: 'GIMNASIO', selectorId: 'GYM_PERDIDA_PESO',
        moduloDeportivo: 'fuerza',
        label: 'Pérdida de Peso', emoji: '🔥', color: '#f97316',
        desc: 'Cardio + fuerza para quemar grasa y mantener músculo.',
        rpeYellow: 6.5, rpeRed: 8.0, duracionSemanas: 12,
        dayScenario: { 1: 'CARDIO_FUERZA', 2: 'HIIT', 3: 'CARDIO_FUERZA', 4: 'DESCANSO', 5: 'CARDIO_FUERZA', 6: 'CARDIO_LARGO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Activación Metabólica', color: '#fb923c', semanas: [1, 3] },
            { num: 2, nombre: 'Quema de Grasa', color: '#f97316', semanas: [4, 8] },
            { num: 3, nombre: 'Definición Final', color: '#ea580c', semanas: [9, 12] },
        ],
        metricaLabel: 'Sesiones',
    },
    {
        id: 'DEFINICION', categoria: 'GIMNASIO', selectorId: 'GYM_DEFINICION',
        moduloDeportivo: 'fuerza',
        label: 'Definición', emoji: '🎯', color: '#06b6d4',
        desc: 'Mantener músculo mientras se reduce el porcentaje graso.',
        rpeYellow: 7.0, rpeRed: 8.5, duracionSemanas: 12,
        dayScenario: { 1: 'DEF_TREN_INF', 2: 'DEF_TREN_SUP', 3: 'CARDIO_LARGO', 4: 'DEF_TREN_INF', 5: 'DEF_TREN_SUP', 6: 'HIIT', 0: 'DESCANSO' },
        fases: [
            { num: 1, nombre: 'Adaptación', color: '#06b6d4', semanas: [1, 3] },
            { num: 2, nombre: 'Definición Progresiva', color: '#0891b2', semanas: [4, 9] },
            { num: 3, nombre: 'Corte Final', color: '#0e7490', semanas: [10, 12] },
        ],
        metricaLabel: 'Cardio (min)',
    },
    {
        id: 'AEROBICO', categoria: 'GIMNASIO', selectorId: 'GYM_AEROBICO',
        moduloDeportivo: 'resistencia',
        label: 'Capacidad Aeróbica', emoji: '🌊', color: '#10b981',
        desc: 'Máxima resistencia cardiovascular. VO2max y resistencia.',
        rpeYellow: 7.0, rpeRed: 8.5, duracionSemanas: 14,
        dayScenario: { 1: 'CARDIO_LARGO', 2: 'FUERZA_BASE', 3: 'INTERVALOS', 4: 'RECUPERACION', 5: 'CARDIO_LARGO', 6: 'HIIT', 0: 'DESCANSO' },
        fases: [
            { num: 1, nombre: 'Base Aeróbica', color: '#34d399', semanas: [1, 4] },
            { num: 2, nombre: 'Desarrollo VO2max', color: '#10b981', semanas: [5, 9] },
            { num: 3, nombre: 'Pico Aeróbico', color: '#059669', semanas: [10, 14] },
        ],
        metricaLabel: 'Min Cardio',
    },
    {
        id: 'FUERZA_PURA', categoria: 'GIMNASIO', selectorId: 'GYM_FUERZA_PURA',
        moduloDeportivo: 'fuerza',
        label: 'Fuerza Pura', emoji: '🏋️', color: '#ef4444',
        desc: 'Powerlifting-inspired. Squat, Bench, Deadlift. Máxima fuerza.',
        rpeYellow: 8.0, rpeRed: 9.5, duracionSemanas: 16,
        dayScenario: { 1: 'FUERZA_SQUAT', 2: 'FUERZA_BENCH', 3: 'DESCANSO', 4: 'FUERZA_DEAD', 5: 'FUERZA_ACCESORIO', 6: 'DESCANSO', 0: 'DESCANSO' },
        fases: [
            { num: 1, nombre: 'Técnica y Base', color: '#fca5a5', semanas: [1, 4] },
            { num: 2, nombre: 'Fuerza Máxima', color: '#f87171', semanas: [5, 9] },
            { num: 3, nombre: 'Intensificación', color: '#ef4444', semanas: [10, 13] },
            { num: 4, nombre: 'Pico y Test 1RM', color: '#dc2626', semanas: [14, 16] },
        ],
        metricaLabel: '1RM estimado',
    },
    {
        id: 'FLEXIBILIDAD', categoria: 'GIMNASIO', selectorId: 'GYM_FLEXIBILIDAD',
        moduloDeportivo: 'fuerza',
        label: 'Flexibilidad y Movilidad', emoji: '🧘', color: '#a78bfa',
        desc: 'Yoga, stretching y movilidad articular para mejorar rango de movimiento.',
        rpeYellow: 5.0, rpeRed: 7.0, duracionSemanas: 12,
        dayScenario: { 1: 'MOVILIDAD_FULL', 2: 'FUERZA_BASE', 3: 'MOVILIDAD_FULL', 4: 'RECUPERACION', 5: 'MOVILIDAD_FULL', 6: 'CARDIO_LARGO', 0: 'DESCANSO' },
        fases: [
            { num: 1, nombre: 'Evaluación y Adaptación', color: '#a78bfa', semanas: [1, 4] },
            { num: 2, nombre: 'Progresión de Rango', color: '#8b5cf6', semanas: [5, 8] },
            { num: 3, nombre: 'Consolidación', color: '#7c3aed', semanas: [9, 12] },
        ],
        metricaLabel: 'Sesiones',
    },
    {
        id: 'CROSSFIT', categoria: 'GIMNASIO', selectorId: 'GYM_CROSSFIT',
        moduloDeportivo: 'fuerza',
        label: 'CrossFit / Funcional', emoji: '💥', color: '#f59e0b',
        desc: 'Entrenamiento funcional de alta intensidad. WODs y circuitos.',
        rpeYellow: 7.5, rpeRed: 9.0, duracionSemanas: 12,
        dayScenario: { 1: 'HIIT', 2: 'FUERZA_BASE', 3: 'CARDIO_FUERZA', 4: 'DESCANSO', 5: 'HIIT', 6: 'CARDIO_LARGO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Base Funcional', color: '#fbbf24', semanas: [1, 4] },
            { num: 2, nombre: 'Intensidad', color: '#f59e0b', semanas: [5, 8] },
            { num: 3, nombre: 'Competición', color: '#d97706', semanas: [9, 12] },
        ],
        metricaLabel: 'Sesiones',
    },
    {
        id: 'REHABILITACION', categoria: 'GIMNASIO', selectorId: 'GYM_REHABILITACION',
        moduloDeportivo: 'fuerza',
        label: 'Rehabilitación', emoji: '🫀', color: '#ec4899',
        desc: 'Recuperación post-lesión. Baja carga, alta frecuencia de movilidad.',
        rpeYellow: 5.0, rpeRed: 6.5, duracionSemanas: 12,
        dayScenario: { 1: 'MOVILIDAD_FULL', 2: 'RECUPERACION', 3: 'MOVILIDAD_FULL', 4: 'RECUPERACION', 5: 'MOVILIDAD_FULL', 6: 'CARDIO_LARGO', 0: 'DESCANSO' },
        fases: [
            { num: 1, nombre: 'Fase Aguda', color: '#f472b6', semanas: [1, 4] },
            { num: 2, nombre: 'Rehabilitación Activa', color: '#ec4899', semanas: [5, 8] },
            { num: 3, nombre: 'Retorno al Deporte', color: '#db2777', semanas: [9, 12] },
        ],
        metricaLabel: 'Sesiones',
    },

    /* ══════════ DEPORTES — Fútbol ══════════ */
    {
        id: 'FUTBOL_PRO', categoria: 'DEPORTES',
        moduloDeportivo: 'equipo',
        label: 'Fútbol Profesional', emoji: '⚽', color: '#00c8ff',
        desc: '7 días/semana. Gimnasio + cancha + partido. Plan de alto rendimiento deportivo.',
        rpeYellow: 7.1, rpeRed: 8.5, duracionSemanas: 17,
        dayScenario: { 1: 'FUERZA_PIERNA_B', 2: 'FUERZA_TREN_SUP', 3: 'HIPERTROFIA_INF', 4: 'HIPERTROFIA_SUP', 5: 'PREVENCION', 6: 'PARTIDO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Pretemporada', color: '#22c55e', semanas: [1, 4] },
            { num: 2, nombre: 'Competición I', color: '#3b82f6', semanas: [5, 8] },
            { num: 3, nombre: 'Competición II', color: '#f59e0b', semanas: [9, 12] },
            { num: 4, nombre: 'Pico y Playoffs', color: '#ef4444', semanas: [13, 17] },
        ],
        metricaLabel: 'Vol. Semanal',
    },
    {
        id: 'FUTBOL_SEMI', categoria: 'DEPORTES',
        moduloDeportivo: 'equipo',
        label: 'Fútbol Semi-Pro', emoji: '⚽', color: '#3b82f6',
        desc: '3-4 días/sem + partido. Equilibrio entre gimnasio, cancha y vida.',
        rpeYellow: 7.0, rpeRed: 8.5, duracionSemanas: 16,
        dayScenario: { 1: 'FUERZA_PIERNA_B', 2: 'FUERZA_TREN_SUP', 3: 'DESCANSO', 4: 'PREVENCION', 5: 'DESCANSO', 6: 'PARTIDO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Base', color: '#3b82f6', semanas: [1, 4] },
            { num: 2, nombre: 'Desarrollo', color: '#2563eb', semanas: [5, 8] },
            { num: 3, nombre: 'Competición', color: '#1d4ed8', semanas: [9, 12] },
            { num: 4, nombre: 'Mantenimiento', color: '#1e40af', semanas: [13, 16] },
        ],
        metricaLabel: 'Sesiones',
    },
    {
        id: 'FUTBOL_AMATEUR', categoria: 'DEPORTES',
        moduloDeportivo: 'equipo',
        label: 'Fútbol Amateur', emoji: '⚽', color: '#22c55e',
        desc: '1-2 días/sem + partido. Mantenimiento y diversión.',
        rpeYellow: 6.5, rpeRed: 8.0, duracionSemanas: 12,
        dayScenario: { 1: 'DESCANSO', 2: 'FUERZA_BASE', 3: 'DESCANSO', 4: 'PREVENCION', 5: 'DESCANSO', 6: 'PARTIDO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Adaptación', color: '#22c55e', semanas: [1, 4] },
            { num: 2, nombre: 'Acondicionamiento', color: '#16a34a', semanas: [5, 8] },
            { num: 3, nombre: 'Mantenimiento', color: '#15803d', semanas: [9, 12] },
        ],
        metricaLabel: 'Sesiones',
    },

    /* ══════════ DEPORTES — Otros (genéricos) ══════════ */
    {
        id: 'TENIS_GEN', categoria: 'DEPORTES',
        moduloDeportivo: 'fuerza',
        label: 'Tenis', emoji: '🎾', color: '#84cc16',
        desc: 'Agilidad, potencia de golpe y resistencia. Contempla semanas de torneo con partidos consecutivos.',
        rpeYellow: 7.0, rpeRed: 8.5, duracionSemanas: 16,
        /*
         * MODELO SEMANAL — Tenis con torneos
         * Semanas normales: Fuerza + Prevención + Cardio
         * Semanas de torneo (sem 5,6,9,10,13,14): bloques de PARTIDO + RECUPERACION
         * El planificador detecta la semana y aplica el patrón correcto
         */
        dayScenario: { 1: 'FUERZA_BASE', 2: 'PREVENCION', 3: 'HIIT', 4: 'PREVENCION', 5: 'FUERZA_BASE', 6: 'DESCANSO', 0: 'DESCANSO' },
        // Semanas de torneo — partidos pueden caer Jue a Dom consecutivos
        torneoSemanas: [5, 6, 9, 10, 13, 14],
        torneoDayScenario: { 1: 'RECUPERACION', 2: 'PREVENCION', 3: 'PARTIDO', 4: 'PARTIDO', 5: 'PARTIDO', 6: 'PARTIDO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Base Física', color: '#84cc16', semanas: [1, 4] },
            { num: 2, nombre: 'Competición I', color: '#65a30d', semanas: [5, 8] },
            { num: 3, nombre: 'Competición II', color: '#4d7c0f', semanas: [9, 12] },
            { num: 4, nombre: 'Playoffs / Pico', color: '#3a5c09', semanas: [13, 16] },
        ],
        metricaLabel: 'Sesiones',
    },
    {
        id: 'BOXEO_GEN', categoria: 'DEPORTES',
        moduloDeportivo: 'fuerza',
        label: 'Boxeo', emoji: '🥊', color: '#dc2626',
        desc: 'Potencia, velocidad de manos y resistencia cardiovascular.',
        rpeYellow: 7.5, rpeRed: 9.0, duracionSemanas: 12,
        dayScenario: { 1: 'HIIT', 2: 'FUERZA_TREN_SUP', 3: 'CARDIO_FUERZA', 4: 'DESCANSO', 5: 'HIIT', 6: 'FUERZA_BASE', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Acondicionamiento', color: '#fca5a5', semanas: [1, 4] },
            { num: 2, nombre: 'Potencia y Técnica', color: '#ef4444', semanas: [5, 8] },
            { num: 3, nombre: 'Pelea', color: '#dc2626', semanas: [9, 12] },
        ],
        metricaLabel: 'Sesiones',
    },
    {
        id: 'HOCKEY_GEN', categoria: 'DEPORTES',
        moduloDeportivo: 'equipo',
        label: 'Hockey', emoji: '🏑', color: '#0ea5e9',
        desc: 'Resistencia, velocidad y agilidad sobre cancha.',
        rpeYellow: 7.0, rpeRed: 8.5, duracionSemanas: 12,
        dayScenario: { 1: 'FUERZA_PIERNA_B', 2: 'FUERZA_TREN_SUP', 3: 'DESCANSO', 4: 'PREVENCION', 5: 'DESCANSO', 6: 'PARTIDO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Pretemporada', color: '#38bdf8', semanas: [1, 4] },
            { num: 2, nombre: 'Competición', color: '#0ea5e9', semanas: [5, 8] },
            { num: 3, nombre: 'Mantenimiento', color: '#0284c7', semanas: [9, 12] },
        ],
        metricaLabel: 'Sesiones',
    },
    {
        id: 'ATLETISMO_GEN', categoria: 'DEPORTES',
        moduloDeportivo: 'resistencia',
        label: 'Atletismo', emoji: '🏃', color: '#f97316',
        desc: 'Velocidad, resistencia y técnica de carrera.',
        rpeYellow: 7.0, rpeRed: 8.5, duracionSemanas: 14,
        dayScenario: { 1: 'INTERVALOS', 2: 'FUERZA_BASE', 3: 'CARDIO_LARGO', 4: 'RECUPERACION', 5: 'HIIT', 6: 'CARDIO_LARGO', 0: 'DESCANSO' },
        fases: [
            { num: 1, nombre: 'Base Aeróbica', color: '#fdba74', semanas: [1, 4] },
            { num: 2, nombre: 'Velocidad', color: '#f97316', semanas: [5, 9] },
            { num: 3, nombre: 'Competición', color: '#ea580c', semanas: [10, 14] },
        ],
        metricaLabel: 'Km',
    },
    {
        id: 'BALONCESTO_GEN', categoria: 'DEPORTES',
        moduloDeportivo: 'equipo',
        label: 'Baloncesto', emoji: '🏀', color: '#f59e0b',
        desc: 'Potencia de salto, agilidad lateral y resistencia.',
        rpeYellow: 7.0, rpeRed: 8.5, duracionSemanas: 12,
        dayScenario: { 1: 'FUERZA_PIERNA_B', 2: 'FUERZA_TREN_SUP', 3: 'HIIT', 4: 'DESCANSO', 5: 'PREVENCION', 6: 'PARTIDO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Pretemporada', color: '#fcd34d', semanas: [1, 4] },
            { num: 2, nombre: 'Competición', color: '#f59e0b', semanas: [5, 8] },
            { num: 3, nombre: 'Playoffs', color: '#d97706', semanas: [9, 12] },
        ],
        metricaLabel: 'Sesiones',
    },
    {
        id: 'RUGBY_GEN', categoria: 'DEPORTES',
        moduloDeportivo: 'equipo',
        label: 'Rugby', emoji: '🏉', color: '#059669',
        desc: 'Fuerza bruta, resistencia al contacto y potencia.',
        rpeYellow: 7.5, rpeRed: 9.0, duracionSemanas: 16,
        dayScenario: { 1: 'FUERZA_SQUAT', 2: 'FUERZA_BENCH', 3: 'HIIT', 4: 'FUERZA_DEAD', 5: 'PREVENCION', 6: 'PARTIDO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Pretemporada', color: '#34d399', semanas: [1, 4] },
            { num: 2, nombre: 'Fuerza Máxima', color: '#10b981', semanas: [5, 8] },
            { num: 3, nombre: 'Competición', color: '#059669', semanas: [9, 12] },
            { num: 4, nombre: 'Playoffs', color: '#047857', semanas: [13, 16] },
        ],
        metricaLabel: 'Vol. Semanal',
    },
    {
        id: 'HANDBALL_GEN', categoria: 'DEPORTES',
        moduloDeportivo: 'equipo',
        label: 'Handball', emoji: '🤾', color: '#8b5cf6',
        desc: 'Potencia de lanzamiento, agilidad y resistencia.',
        rpeYellow: 7.0, rpeRed: 8.5, duracionSemanas: 12,
        dayScenario: { 1: 'FUERZA_TREN_SUP', 2: 'FUERZA_PIERNA_B', 3: 'DESCANSO', 4: 'HIIT', 5: 'PREVENCION', 6: 'PARTIDO', 0: 'RECUPERACION' },
        fases: [
            { num: 1, nombre: 'Pretemporada', color: '#a78bfa', semanas: [1, 4] },
            { num: 2, nombre: 'Competición', color: '#8b5cf6', semanas: [5, 8] },
            { num: 3, nombre: 'Mantenimiento', color: '#7c3aed', semanas: [9, 12] },
        ],
        metricaLabel: 'Sesiones',
    },
    {
        id: 'NATACION_GEN', categoria: 'DEPORTES',
        moduloDeportivo: 'resistencia',
        label: 'Natación', emoji: '🏊', color: '#06b6d4',
        desc: 'Resistencia acuática, técnica y fuerza de tracción.',
        rpeYellow: 7.0, rpeRed: 8.5, duracionSemanas: 14,
        dayScenario: { 1: 'CARDIO_LARGO', 2: 'FUERZA_BASE', 3: 'INTERVALOS', 4: 'RECUPERACION', 5: 'CARDIO_LARGO', 6: 'FUERZA_BASE', 0: 'DESCANSO' },
        fases: [
            { num: 1, nombre: 'Base Aeróbica', color: '#22d3ee', semanas: [1, 4] },
            { num: 2, nombre: 'Velocidad Acuática', color: '#06b6d4', semanas: [5, 9] },
            { num: 3, nombre: 'Competición', color: '#0891b2', semanas: [10, 14] },
        ],
        metricaLabel: 'Metros',
    },
];

/* ============================================================
   BIBLIOTECA: EJERCICIOS BASE (34 ejercicios + 20 nuevos)
   ============================================================ */
const EJERCICIOS = [
    { cod: 1, nombre: 'Press Banca Barra', patron: 'Empuje Horizontal', grupo: 'Pectoral', fatiga: 3, dia: 'Martes', activo: true },
    { cod: 2, nombre: 'Press con Mancuernas', patron: 'Empuje Horizontal', grupo: 'Pectoral', fatiga: 2, dia: 'Martes', activo: true },
    { cod: 3, nombre: 'Aperturas en Polea', patron: 'Aislamiento', grupo: 'Pectoral', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 4, nombre: 'Dominadas', patron: 'Tracción Vertical', grupo: 'Espalda', fatiga: 3, dia: 'Martes', activo: true },
    { cod: 5, nombre: 'Remo con DB', patron: 'Tracción Horizontal', grupo: 'Espalda', fatiga: 2, dia: 'Miércoles', activo: true },
    { cod: 6, nombre: 'Sentadilla', patron: 'Dominante Rodilla', grupo: 'Piernas', fatiga: 3, dia: 'Lunes', activo: true },
    { cod: 7, nombre: 'Peso Muerto', patron: 'Dominante Cadera', grupo: 'Piernas', fatiga: 3, dia: 'Lunes', activo: true },
    { cod: 8, nombre: 'Hip Thrust', patron: 'Dominante Cadera', grupo: 'Piernas', fatiga: 2, dia: 'Lunes', activo: true },
    { cod: 9, nombre: 'Estocadas con mancuernas', patron: 'Dominante Rodilla', grupo: 'Piernas', fatiga: 2, dia: 'Miércoles', activo: true },
    { cod: 10, nombre: 'Banco de Cuádriceps', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 11, nombre: 'Banco de Isquiotibiales', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 12, nombre: 'Peso muerto hexagonal', patron: 'Dominante Cadera', grupo: 'Piernas', fatiga: 3, dia: 'Lunes', activo: true },
    { cod: 13, nombre: 'Press banca inclinado', patron: 'Empuje Horizontal', grupo: 'Pectoral', fatiga: 2, dia: 'Jueves', activo: true },
    { cod: 14, nombre: 'Aperturas en máquina', patron: 'Aislamiento', grupo: 'Pectoral', fatiga: 1, dia: 'Jueves', activo: true },
    { cod: 15, nombre: 'Remo en T (Seal Row)', patron: 'Tracción Horizontal', grupo: 'Espalda', fatiga: 2, dia: 'Jueves', activo: true },
    { cod: 16, nombre: 'Pull over con mancuerna', patron: 'Tracción Vertical', grupo: 'Espalda', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 17, nombre: 'Jalón a dos brazos', patron: 'Tracción Vertical', grupo: 'Espalda', fatiga: 2, dia: 'Jueves', activo: true },
    { cod: 18, nombre: 'Martillo (Bíceps)', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 19, nombre: 'Fondos (Tríceps)', patron: 'Brazos', grupo: 'Brazos', fatiga: 2, dia: 'Martes', activo: true },
    { cod: 20, nombre: 'Extensión polea tríceps', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 21, nombre: 'Bíceps en polea', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 22, nombre: 'Vuelos laterales', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 23, nombre: 'Press hombro + iso', patron: 'Empuje Vertical', grupo: 'Brazos/Hombro', fatiga: 2, dia: 'Martes', activo: true },
    { cod: 24, nombre: 'Face-Pull', patron: 'Tracción Horizontal', grupo: 'Espalda/Hombro', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 25, nombre: 'Banco de Gemelos', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 26, nombre: 'Aductores en Máquina', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 27, nombre: 'Copenhagen Plank', patron: 'Core', grupo: 'Core', fatiga: 2, dia: 'Lunes/Jueves', activo: true },
    { cod: 28, nombre: 'Dead Bug (Bicho Muerto)', patron: 'Core', grupo: 'Core', fatiga: 1, dia: 'Miércoles/Viernes', activo: true },
    { cod: 29, nombre: 'Plancha Toque Hombro', patron: 'Core', grupo: 'Core', fatiga: 2, dia: 'Martes', activo: true },
    { cod: 30, nombre: 'Dominadas Neutras Lastre', patron: 'Tracción Vertical', grupo: 'Espalda', fatiga: 3, dia: 'Jueves', activo: true },
    { cod: 31, nombre: 'Slalom de precisión', patron: 'Técnica', grupo: 'Campo', fatiga: 1, dia: 'Sábado', activo: true },
    { cod: 32, nombre: 'Control y Giro (Conos)', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Sábado', activo: true },
    { cod: 33, nombre: 'Remate tras desmarque', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Sábado', activo: true },
    { cod: 34, nombre: 'Caminata / Trote', patron: 'Cardio', grupo: 'Global', fatiga: 1, dia: 'Recuperación', activo: true },
    /* ── NUEVOS para objetivos adicionales ── */
    { cod: 35, nombre: 'Trote 30 min (Z2)', patron: 'Cardio', grupo: 'Aeróbico', fatiga: 1, dia: 'Variable', activo: true },
    { cod: 36, nombre: 'Intervalos 4×4 min', patron: 'HIIT', grupo: 'Aeróbico', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 37, nombre: 'Bicicleta Estática 40 min', patron: 'Cardio', grupo: 'Aeróbico', fatiga: 1, dia: 'Variable', activo: true },
    { cod: 38, nombre: 'Salto a la Soga 3×3 min', patron: 'HIIT', grupo: 'Aeróbico', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 39, nombre: 'Burpees 5×10', patron: 'HIIT', grupo: 'Full Body', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 40, nombre: 'Sentadilla + Press (Thruster)', patron: 'Full Body', grupo: 'Full Body', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 41, nombre: 'Peso Muerto Rumano', patron: 'Dominante Cadera', grupo: 'Piernas / Espalda', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 42, nombre: 'Press Banca con Mancuernas', patron: 'Empuje Horizontal', grupo: 'Pectoral', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 43, nombre: 'Zancadas Búlgaras', patron: 'Dominante Rodilla', grupo: 'Piernas', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 44, nombre: 'Remo en Máquina Horizontal', patron: 'Tracción Horizontal', grupo: 'Espalda', fatiga: 1, dia: 'Variable', activo: true },
    { cod: 45, nombre: 'Press Arnold', patron: 'Empuje Vertical', grupo: 'Hombros', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 46, nombre: 'Curl de Bíceps con Barra', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Variable', activo: true },
    { cod: 47, nombre: 'Dips en Paralelas', patron: 'Brazos', grupo: 'Brazos / Pectoral', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 48, nombre: 'Cardio Elíptica 45 min', patron: 'Cardio', grupo: 'Aeróbico', fatiga: 1, dia: 'Variable', activo: true },
    { cod: 49, nombre: 'Step-Up con Mancuernas', patron: 'Dominante Rodilla', grupo: 'Piernas', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 50, nombre: 'Plancha Lateral 3×45s', patron: 'Core', grupo: 'Core', fatiga: 1, dia: 'Variable', activo: true },
    { cod: 51, nombre: 'Mountain Climbers 3×30s', patron: 'Core / Cardio', grupo: 'Core', fatiga: 1, dia: 'Variable', activo: true },
    { cod: 52, nombre: 'Kettlebell Swing 3×15', patron: 'Potencia', grupo: 'Full Body', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 53, nombre: 'Battle Ropes 3×30s', patron: 'Potencia', grupo: 'Full Body', fatiga: 2, dia: 'Variable', activo: true },
    { cod: 54, nombre: 'Natación 45 min', patron: 'Cardio', grupo: 'Aeróbico', fatiga: 1, dia: 'Variable', activo: true },
];

/* ============================================================
   PESOS INICIALES
   ============================================================ */
const PESOS_INICIALES = {
    1: 65, 2: 50, 3: 60, 4: 30, 5: 0, 6: 67.5, 7: 15, 8: 60,
    9: 20, 10: 35, 11: 30, 12: 60, 13: 50, 14: 40, 15: 60, 16: 15,
    17: 55, 18: 14, 19: 0, 20: 20, 21: 15, 22: 8, 23: 30, 24: 15,
    25: 40, 26: 30, 27: 0, 28: 0, 29: 0, 30: 5, 31: 0, 32: 0,
    33: 0, 34: 0, 35: 0, 36: 0, 37: 0, 38: 0, 39: 0, 40: 20,
    41: 40, 42: 20, 43: 15, 44: 45, 45: 12, 46: 30, 47: 0, 48: 0,
    49: 12, 50: 0, 51: 0, 52: 16, 53: 0, 54: 0,
};

/* ============================================================
   ESCENARIOS — Todos los objetivos agrupados
   ============================================================ */
const ESCENARIOS = {
    /* ── Alto Rendimiento (original) ── */
    FUERZA_PIERNA_B: { label: 'FUERZA PIERNAS', emoji: '🏋️', color: '#3b82f6', ejercicios: [6, 7, 8, 12, 11, 27] },
    FUERZA_TREN_SUP: { label: 'FUERZA TREN SUP', emoji: '💪', color: '#8b5cf6', ejercicios: [1, 3, 23, 19, 4, 20] },
    HIPERTROFIA_INF: { label: 'HIPERTROFIA INF', emoji: '🦵', color: '#06b6d4', ejercicios: [9, 10, 11, 25, 26, 28] },
    HIPERTROFIA_SUP: { label: 'HIPERTROFIA SUP', emoji: '🔝', color: '#10b981', ejercicios: [13, 5, 15, 17, 30, 24] },
    PREVENCION: { label: 'PREVENCIÓN', emoji: '🛡️', color: '#f59e0b', ejercicios: [24, 22, 28, 27, 34, 3] },
    RECUPERACION: { label: 'RECUPERACIÓN', emoji: '💚', color: '#22c55e', ejercicios: [34, 28, 24] },
    PARTIDO: { label: 'PARTIDO', emoji: '⚽', color: '#ef4444', ejercicios: [] },
    AMISTOSO: { label: 'AMISTOSO', emoji: '⚽', color: '#f97316', ejercicios: [31, 32, 33] },
    TECNICA: { label: 'TÉCNICA', emoji: '🎯', color: '#a78bfa', ejercicios: [31, 32, 33] },
    DESCANSO: { label: 'DESCANSO', emoji: '😴', color: '#6b7280', ejercicios: [] },

    /* ── Masa Muscular ── */
    MASA_PIERNAS: { label: 'MASA PIERNAS A', emoji: '🦵', color: '#7c3aed', ejercicios: [6, 2, 8, 10, 11, 25] },
    MASA_EMPUJE: { label: 'MASA EMPUJE', emoji: '💪', color: '#8b5cf6', ejercicios: [1, 13, 42, 4, 23, 19] },
    MASA_TRACCION: { label: 'MASA TRACCIÓN', emoji: '🔝', color: '#6d28d9', ejercicios: [5, 3, 17, 44, 15, 16] },
    MASA_HOMBROS_BRAZOS: { label: 'HOMBROS & BRAZOS', emoji: '💪', color: '#5b21b6', ejercicios: [4, 45, 22, 24, 46, 20, 47] },
    MASA_PIERNAS_B: { label: 'MASA PIERNAS B', emoji: '🏋️', color: '#7c3aed', ejercicios: [7, 41, 43, 9, 49, 26] },

    /* ── Pérdida de Peso / Definición ── */
    CARDIO_FUERZA: { label: 'CARDIO + FUERZA', emoji: '🔥', color: '#f97316', ejercicios: [35, 40, 9, 39, 29, 51] },
    HIIT: { label: 'HIIT', emoji: '⚡', color: '#ef4444', ejercicios: [36, 38, 39, 53, 51, 52] },
    CARDIO_LARGO: { label: 'CARDIO LARGO', emoji: '🌊', color: '#06b6d4', ejercicios: [35, 37, 48, 54] },
    DEF_TREN_INF: { label: 'DEFINICIÓN INF', emoji: '🎯', color: '#0891b2', ejercicios: [6, 9, 43, 10, 11, 25, 51] },
    DEF_TREN_SUP: { label: 'DEFINICIÓN SUP', emoji: '🎯', color: '#0891b2', ejercicios: [1, 3, 5, 22, 24, 50, 29] },

    /* ── Aeróbico ── */
    INTERVALOS: { label: 'INTERVALOS', emoji: '🌊', color: '#10b981', ejercicios: [36, 35, 38, 53] },
    FUERZA_BASE: { label: 'FUERZA BASE', emoji: '💪', color: '#059669', ejercicios: [6, 1, 3, 27, 28] },

    /* ── Fuerza Pura ── */
    FUERZA_SQUAT: { label: 'DÍA SQUAT', emoji: '🏋️', color: '#ef4444', ejercicios: [6, 2, 43, 10, 27] },
    FUERZA_BENCH: { label: 'DÍA BENCH', emoji: '🏋️', color: '#dc2626', ejercicios: [1, 13, 42, 19, 47] },
    FUERZA_DEAD: { label: 'DÍA DEADLIFT', emoji: '🏋️', color: '#b91c1c', ejercicios: [7, 12, 41, 11, 27] },
    FUERZA_ACCESORIO: { label: 'ACCESORIOS FUERZA', emoji: '💪', color: '#991b1b', ejercicios: [5, 30, 23, 46, 20, 50] },

    /* ── Movilidad ── */
    MOVILIDAD_FULL: { label: 'MOVILIDAD COMPLETA', emoji: '🧘', color: '#a78bfa', ejercicios: [28, 50, 51, 34] },


    /* ── Tenis ── */
    TENIS_FUERZA: { label: 'FUERZA TENIS', emoji: '🎾', color: '#84cc16', ejercicios: [6, 9, 23, 24, 27, 28] },
    TENIS_CANCHA: { label: 'CANCHA / TÉCNICA', emoji: '🎾', color: '#65a30d', ejercicios: [31, 32, 34] },
    /* ── Recuperación Facilitada (Auto-mutación por fatiga) ── */
    RECUPERACION_FACILITADA: { label: 'RECUPERACIÓN FACILITADA', emoji: '🧊', color: '#34d399', ejercicios: [34, 28, 50, 24] },
};

/* ============================================================
   MOVILIDAD ARTICULAR
   ============================================================ */
const MOVILIDAD_ARTICULAR = [
    { id: 'm1', nombre: 'Rotaciones de Cadera', emoji: '🔄', duracion: 45, descripcion: '15 seg c/lado — círculos amplios en posición de pie', grupo: 'Cadera / Glúteo' },
    { id: 'm2', nombre: 'Péndulo de Hombro', emoji: '🌀', duracion: 30, descripcion: 'Brazo relajado, círculos hacia adelante y atrás, c/lado', grupo: 'Hombro / Manguito' },
    { id: 'm3', nombre: 'Movilidad de Tobillo', emoji: '🦶', duracion: 40, descripcion: 'Círculos + dorsiflexión activa contra pared, c/lado', grupo: 'Tobillo / Pierna' },
    { id: 'm4', nombre: 'Rotación Torácica', emoji: '🌪️', duracion: 40, descripcion: '10 reps c/lado — desde 4 apoyos, columna neutra', grupo: 'Columna Torácica' },
    { id: 'm5', nombre: 'Apertura de Cadera 90-90', emoji: '🧘', duracion: 60, descripcion: '30 seg c/lado — posición 90-90 en el suelo', grupo: 'Cadera / Aductores' },
    { id: 'm6', nombre: 'Roll de Columna', emoji: '🐛', duracion: 30, descripcion: 'De pie: flexión vertebral segmentada lenta, 5 reps', grupo: 'Columna / Isquios' },
];

const USER_EMOJIS = ['⚡', '🦸', '💪', '🏃', '🦊', '🐺', '🦅', '🏋️', '🌊', '🔥', '🎯', '⚽', '🥊', '🏆', '🦁', '🐉'];

const DIA_DOBLE_OPTIONS = [
    { key: 'REPETIR', label: 'Repetir sesión', emoji: '🔁', desc: 'Los mismos ejercicios del día' },
    { key: 'AMISTOSO', label: 'Club / Amistoso', emoji: '⚽', desc: 'Técnica de campo liviana' },
    { key: 'RECUPERACION', label: 'Recuperación activa', emoji: '💚', desc: 'Trote + movilidad, RPE máx 5' },
    { key: 'FUERZA_TREN_SUP', label: 'Fuerza Tren Superior', emoji: '💪', desc: 'Segundo trabajo de empuje/tracción' },
];

/* ============================================================
   HELPERS
   ============================================================ */
function getObjetivoById(id) {
    return OBJETIVOS_DISPONIBLES.find(o => o.id === id) || OBJETIVOS_DISPONIBLES[0];
}

function getEjercicioByCod(cod) {
    return EJERCICIOS.find(e => e.cod === cod) || null;
}

function _addDays(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function _generatePlan(objetivoId) {
    const obj = getObjetivoById(objetivoId || 'ALTO_RENDIMIENTO');
    const plan = [];
    let sessionId = 1;
    for (let w = 0; w < obj.duracionSemanas; w++) {
        // Detectar si es semana de torneo (para deportes como tenis)
        const semanaNum = w + 1;
        const esSemTorneo = obj.torneoSemanas && obj.torneoSemanas.includes(semanaNum);
        const scenarioMap = esSemTorneo && obj.torneoDayScenario
            ? obj.torneoDayScenario
            : obj.dayScenario;

        for (let d = 0; d < 7; d++) {
            const fecha = _addDays(PLAN_START_DATE, w * 7 + d);
            const dow = new Date(fecha + 'T12:00:00').getDay();
            let escenario = scenarioMap[dow] || 'DESCANSO';
            let ejs = [...(ESCENARIOS[escenario]?.ejercicios || [])];
            let fase = 'FASE 1';
            if (obj.fases) {
                for (const f of obj.fases) {
                    if (w + 1 >= f.semanas[0] && w + 1 <= f.semanas[1]) {
                        fase = `MES ${f.num} — ${f.nombre.toUpperCase()}`;
                        break;
                    }
                }
            }
            // Determinar series y reps según fase (solo para Alto Rendimiento por ahora)
            let series = null, reps = null;
            if (objetivoId === 'ALTO_RENDIMIENTO') {
                const mes = fase.match(/MES (\d+)/)?.[1];
                if (mes == 1) {
                    series = 4; reps = '10-12';
                    if (escenario === 'PREVENCION') { series = 3; reps = '15'; }
                    if (w + 1 === 4) { series = 3; } // Semana de descarga
                } else if (mes == 2) {
                    if (escenario.startsWith('FUERZA')) { series = 5; reps = '5'; }
                    else if (escenario.startsWith('HIPERTROFIA')) { series = 4; reps = '8'; }
                    else if (escenario === 'PREVENCION') { series = 3; reps = '12'; }
                } else if (mes == 3) {
                    if (escenario.startsWith('FUERZA')) { series = 4; reps = '6-8'; }
                    else if (escenario.startsWith('HIPERTROFIA')) { series = 4; reps = '10'; }
                    else if (escenario === 'PREVENCION') { series = 3; reps = '15'; }
                } else if (mes == 4) {
                    if (escenario.startsWith('FUERZA')) { series = 3; reps = '5'; }
                    else if (escenario.startsWith('HIPERTROFIA')) { series = 3; reps = '8'; }
                    else if (escenario === 'PREVENCION') { series = 2; reps = '15'; }
                }
            }

            // Inyectar el escenario del día según el mes (Alto Rendimiento específico)
            if (objetivoId === 'ALTO_RENDIMIENTO') {
                const mes = fase.match(/MES (\d+)/)?.[1];
                if (mes >= 2) {
                    // Mes 2, 3 y 4: Lunes es RECUPERACIÓN y Domingo es PARTIDO
                    if (dow === 1) { escenario = 'RECUPERACION'; ejs = [...ESCENARIOS.RECUPERACION.ejercicios]; }
                    if (dow === 0) { escenario = 'PARTIDO'; ejs = []; }
                }
            }

            const detailed_ejs = ejs.map(c => ({ cod: c, series: series, reps: reps }));
            plan.push({ id: sessionId++, fecha, semana: w + 1, fase, escenario, ejs_cods: detailed_ejs });
        }
    }
    return plan;
}

function getSessionByDate(dateStr, plan) {
    return (plan || []).find(s => s.fecha === dateStr) || null;
}

function getFaseForObjetivo(semana, objetivoId) {
    const obj = getObjetivoById(objetivoId);
    return obj.fases.find(f => semana >= f.semanas[0] && semana <= f.semanas[1]) || obj.fases[obj.fases.length - 1];
}
