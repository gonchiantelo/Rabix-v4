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
            { id: 'VOLLEY', label: 'Volleyball', emoji: '🏐', niveles: [
                { id: 'VOLLEY_COMPETITIVO', label: 'Competitivo', desc: '4-5 días/sem + partido — Liga o selección' },
                { id: 'VOLLEY_GEN',         label: 'Recreativo',  desc: '2-3 días/sem — Club o hobby' },
            ]},
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
        id: 'DUAL',
        label: 'Gimnasio + Deporte',
        emoji: '⚡',
        desc: 'Para deportistas que combinan sala con su deporte. Plan integrado.',
        subcategorias: [
            { id: 'DUAL_FUTBOL',      label: 'Fútbol',      emoji: '⚽', niveles: [{ id: 'DUAL_FUTBOL',      label: 'Fútbol + Gimnasio',      desc: 'Plan integrado cancha y sala' }] },
            { id: 'DUAL_HOCKEY',      label: 'Hockey',      emoji: '🏑', niveles: [{ id: 'DUAL_HOCKEY',      label: 'Hockey + Gimnasio',      desc: 'Plan integrado cancha y sala' }] },
            { id: 'DUAL_RUGBY',       label: 'Rugby',       emoji: '🏉', niveles: [{ id: 'DUAL_RUGBY',       label: 'Rugby + Gimnasio',       desc: 'Plan integrado cancha y sala' }] },
            { id: 'DUAL_BALONCESTO',  label: 'Baloncesto',  emoji: '🏀', niveles: [{ id: 'DUAL_BALONCESTO',  label: 'Baloncesto + Gimnasio',  desc: 'Plan integrado cancha y sala' }] },
            { id: 'DUAL_HANDBALL',    label: 'Handball',    emoji: '🤾', niveles: [{ id: 'DUAL_HANDBALL',    label: 'Handball + Gimnasio',    desc: 'Plan integrado cancha y sala' }] },
            { id: 'DUAL_TENIS',       label: 'Tenis',       emoji: '🎾', niveles: [{ id: 'DUAL_TENIS',       label: 'Tenis + Gimnasio',       desc: 'Plan integrado cancha y sala' }] },
            { id: 'DUAL_ATLETISMO',   label: 'Atletismo',   emoji: '🏃', niveles: [{ id: 'DUAL_ATLETISMO',   label: 'Atletismo + Gimnasio',   desc: 'Plan integrado pista y sala' }] },
            { id: 'DUAL_NATACION',    label: 'Natación',    emoji: '🏊', niveles: [{ id: 'DUAL_NATACION',    label: 'Natación + Gimnasio',    desc: 'Plan integrado pileta y sala' }] },
            { id: 'DUAL_VOLLEY',      label: 'Volleyball',  emoji: '🏐', niveles: [{ id: 'DUAL_VOLLEY',      label: 'Volleyball + Gimnasio',  desc: 'Plan integrado cancha y sala' }] },
        ]
    },
    {
        id: 'HIBRIDO',
        label: 'Deportes de Sala',
        emoji: '🥊',
        desc: 'Deportes donde el gimnasio es parte del entrenamiento principal.',
        subcategorias: [
            { id: 'BOXEO', label: 'Boxeo', emoji: '🥊', niveles: [
                { id: 'BOXEO_COMPETITIVO', label: 'Competitivo', desc: 'Sparring + sala + técnica — 5 días/sem' },
                { id: 'BOXEO_GEN',         label: 'Recreativo',  desc: 'Técnica + acondicionamiento general' },
            ]},
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
        dayScenario: { 1: 'FUERZA_PIERNA_B', 2: 'FUERZA_TREN_SUP', 3: 'HIPERTROFIA_INF', 4: 'HIPERTROFIA_SUP', 5: 'PREVENCION', 6: 'DESCANSO', 0: 'RECUPERACION' },
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
        dayScenario: { 1: 'AEROBICO_BASE', 2: 'FUERZA_AEROBICA', 3: 'INTERVALOS', 4: 'AEROBICO_BASE', 5: 'FUERZA_AEROBICA', 6: 'INTERVALOS', 0: 'DESCANSO' },
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
        dayScenario: { 1: 'MOVILIDAD_FULL', 2: 'STRETCHING_ACTIVO', 3: 'MOVILIDAD_CADERA', 4: 'RECUPERACION', 5: 'MOVILIDAD_FULL', 6: 'AEROBICO_BASE', 0: 'DESCANSO' },
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
        dayScenario: { 1: 'CROSSFIT_FUERZA', 2: 'CROSSFIT_METCON', 3: 'CROSSFIT_CARDIO', 4: 'DESCANSO', 5: 'CROSSFIT_FUERZA', 6: 'CROSSFIT_METCON', 0: 'RECUPERACION' },
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
        dayScenario: { 1: 'REHAB_MOVILIDAD', 2: 'REHAB_CORE', 3: 'REHAB_MOVILIDAD', 4: 'RECUPERACION', 5: 'REHAB_FUERZA', 6: 'AEROBICO_BASE', 0: 'DESCANSO' },
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
        dayScenario: { 0: 'PARTIDO', 1: 'RECUPERACION', 2: 'FUERZA_PIERNA_B', 3: 'HOCKEY_FISICO', 4: 'PREVENCION', 5: 'DESCANSO', 6: 'ACTIVACION_PRE' },
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
        dayScenario: { 1: 'TENIS_FUERZA', 2: 'TENIS_TECNICA', 3: 'TENIS_PREVENCION', 4: 'TENIS_TECNICA', 5: 'TENIS_FUERZA', 6: 'DESCANSO', 0: 'DESCANSO' },
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
        dayScenario: { 1: 'BOXEO_SALA', 2: 'BOXEO_TECNICA', 3: 'RECUPERACION', 4: 'BOXEO_SALA', 5: 'BOXEO_TECNICA', 6: 'RECUPERACION', 0: 'DESCANSO' },
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
        dayScenario: { 1: 'ATLETISMO_FUERZA', 2: 'ATLETISMO_PISTA', 3: 'RECUPERACION', 4: 'ATLETISMO_FUERZA', 5: 'ATLETISMO_PISTA', 6: 'RECUPERACION', 0: 'DESCANSO' },
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
        dayScenario: { 0: 'PARTIDO', 1: 'RECUPERACION', 2: 'BASKET_SALTO', 3: 'BASKET_FISICO', 4: 'PREVENCION', 5: 'DESCANSO', 6: 'ACTIVACION_PRE' },
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
        dayScenario: { 0: 'PARTIDO', 1: 'RECUPERACION', 2: 'RUGBY_SCRUMS', 3: 'RUGBY_FISICO', 4: 'FUERZA_DEAD', 5: 'PREVENCION', 6: 'ACTIVACION_PRE' },
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
        dayScenario: { 0: 'PARTIDO', 1: 'RECUPERACION', 2: 'HANDBALL_LANZAMIENTO', 3: 'HANDBALL_FISICO', 4: 'PREVENCION', 5: 'DESCANSO', 6: 'ACTIVACION_PRE' },
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
        dayScenario: { 1: 'NATACION_SECO', 2: 'NATACION_CARDIO', 3: 'RECUPERACION', 4: 'NATACION_SECO', 5: 'NATACION_CARDIO', 6: 'RECUPERACION', 0: 'DESCANSO' },
        fases: [
            { num: 1, nombre: 'Base Aeróbica', color: '#22d3ee', semanas: [1, 4] },
            { num: 2, nombre: 'Velocidad Acuática', color: '#06b6d4', semanas: [5, 9] },
            { num: 3, nombre: 'Competición', color: '#0891b2', semanas: [10, 14] },
        ],
        metricaLabel: 'Metros',
    },
];

// ── Volleyball ──
OBJETIVOS_DISPONIBLES.push(
    { id: 'VOLLEY_COMPETITIVO', categoria: 'DEPORTES', moduloDeportivo: 'equipo',
      emoji: '🏐', color: '#7c3aed', label: 'Volleyball Competitivo',
      desc: '4-5 días/sem + partido. Liga o selección.',
      rpeYellow: 7.0, rpeRed: 8.5, duracionSemanas: 16, metricaLabel: 'Sesiones',
      dayScenario: { 0: 'PARTIDO', 1: 'RECUPERACION', 2: 'VOLLEY_TECNICA', 3: 'VOLLEY_SALTO', 4: 'VOLLEY_TECNICA', 5: 'VOLLEY_PREVENCION', 6: 'ACTIVACION_PRE' },
      fases: [
        { num: 1, nombre: 'Pretemporada',  color: '#a78bfa', semanas: [1,  4]  },
        { num: 2, nombre: 'Competición I', color: '#8b5cf6', semanas: [5,  8]  },
        { num: 3, nombre: 'Competición II',color: '#7c3aed', semanas: [9,  12] },
        { num: 4, nombre: 'Playoffs',      color: '#6d28d9', semanas: [13, 16] },
      ],
    },
    { id: 'VOLLEY_GEN', categoria: 'DEPORTES', moduloDeportivo: 'equipo',
      emoji: '🏐', color: '#8b5cf6', label: 'Volleyball Recreativo',
      desc: '2-3 días/sem + partido. Club o hobby.',
      rpeYellow: 6.5, rpeRed: 8.0, duracionSemanas: 12, metricaLabel: 'Sesiones',
      dayScenario: { 0: 'PARTIDO', 1: 'RECUPERACION', 2: 'VOLLEY_SALTO', 3: 'DESCANSO', 4: 'VOLLEY_PREVENCION', 5: 'DESCANSO', 6: 'ACTIVACION_PRE' },
      fases: [
        { num: 1, nombre: 'Adaptación',     color: '#c4b5fd', semanas: [1, 4]  },
        { num: 2, nombre: 'Desarrollo',     color: '#8b5cf6', semanas: [5, 8]  },
        { num: 3, nombre: 'Mantenimiento',  color: '#6d28d9', semanas: [9, 12] },
      ],
    },
    { id: 'DUAL_VOLLEY', categoria: 'DUAL', moduloDeportivo: 'dual',
      emoji: '🏐', color: '#7c3aed', label: 'Volleyball + Gym',
      desc: 'Plan integrado cancha y sala para voleibolistas.',
      rpeYellow: 7.1, rpeRed: 8.5, duracionSemanas: 16, metricaLabel: 'Carga Total',
      fases: [
        { num: 1, nombre: 'Adaptación Dual',       color: '#659499', semanas: [1, 4]  },
        { num: 2, nombre: 'Acumulación Integrada', color: '#eab731', semanas: [5, 8]  },
        { num: 3, nombre: 'Intensificación',       color: '#da7a0e', semanas: [9, 12] },
        { num: 4, nombre: 'Pico Competitivo',      color: '#f43f5e', semanas: [13, 16]},
      ],
      dayScenario: { 0: 'PARTIDO', 1: 'RECUPERACION', 2: 'EQUIPO_TAC_VOLLEY', 3: 'GYM_FUERZA_INF', 4: 'EQUIPO_FISICO', 5: 'GYM_PREVENCION', 6: 'ACTIVACION_PRE' },
    }
);

// ── Objetivos DUAL y HÍBRIDO (agregados dinámicamente) ──
OBJETIVOS_DISPONIBLES.push(
    // ── DUAL Tipo A ──
    { id: 'DUAL_FUTBOL', categoria: 'DUAL', moduloDeportivo: 'dual',
      emoji: '⚽', color: '#659499', label: 'Fútbol + Gym',
      desc: 'Plan integrado cancha y sala para futbolistas.',
      rpeYellow: 7.1, rpeRed: 8.5, duracionSemanas: 16, metricaLabel: 'Carga Total',
      fases: [
        { num: 1, nombre: 'Adaptación Dual',       color: '#659499', semanas: [1, 4]  },
        { num: 2, nombre: 'Acumulación Integrada', color: '#eab731', semanas: [5, 8]  },
        { num: 3, nombre: 'Intensificación',       color: '#da7a0e', semanas: [9, 12] },
        { num: 4, nombre: 'Pico Competitivo',      color: '#f43f5e', semanas: [13, 16]},
      ],
      dayScenario: { 0:'PARTIDO', 1:'RECUPERACION', 2:'EQUIPO_TAC_FUTBOL', 3:'GYM_FUERZA_INF', 4:'EQUIPO_FISICO', 5:'GYM_PREVENCION', 6:'ACTIVACION_PRE' },
    },
    { id: 'DUAL_HOCKEY', categoria: 'DUAL', moduloDeportivo: 'dual',
      emoji: '🏑', color: '#0ea5e9', label: 'Hockey + Gym',
      desc: 'Plan integrado cancha y sala para jugadores de hockey.',
      rpeYellow: 7.1, rpeRed: 8.5, duracionSemanas: 16, metricaLabel: 'Carga Total',
      fases: [
        { num: 1, nombre: 'Adaptación Dual',       color: '#659499', semanas: [1, 4]  },
        { num: 2, nombre: 'Acumulación Integrada', color: '#eab731', semanas: [5, 8]  },
        { num: 3, nombre: 'Intensificación',       color: '#da7a0e', semanas: [9, 12] },
        { num: 4, nombre: 'Pico Competitivo',      color: '#f43f5e', semanas: [13, 16]},
      ],
      dayScenario: { 0:'PARTIDO', 1:'RECUPERACION', 2:'EQUIPO_TAC_HOCKEY', 3:'GYM_FUERZA_INF', 4:'EQUIPO_FISICO', 5:'GYM_PREVENCION', 6:'ACTIVACION_PRE' },
    },
    { id: 'DUAL_RUGBY', categoria: 'DUAL', moduloDeportivo: 'dual',
      emoji: '🏉', color: '#059669', label: 'Rugby + Gym',
      desc: 'Plan integrado para rugbiers.',
      rpeYellow: 7.1, rpeRed: 8.5, duracionSemanas: 16, metricaLabel: 'Carga Total',
      fases: [
        { num: 1, nombre: 'Adaptación Dual',       color: '#659499', semanas: [1, 4]  },
        { num: 2, nombre: 'Acumulación Integrada', color: '#eab731', semanas: [5, 8]  },
        { num: 3, nombre: 'Intensificación',       color: '#da7a0e', semanas: [9, 12] },
        { num: 4, nombre: 'Pico Competitivo',      color: '#f43f5e', semanas: [13, 16]},
      ],
      dayScenario: { 0:'PARTIDO', 1:'RECUPERACION', 2:'EQUIPO_FISICO', 3:'GYM_FUERZA_INF', 4:'EQUIPO_TAC_RUGBY', 5:'GYM_FUERZA_SUP', 6:'ACTIVACION_PRE' },
    },
    { id: 'DUAL_BALONCESTO', categoria: 'DUAL', moduloDeportivo: 'dual',
      emoji: '🏀', color: '#f59e0b', label: 'Básquet + Gym',
      desc: 'Plan integrado para basquetbolistas.',
      rpeYellow: 7.1, rpeRed: 8.5, duracionSemanas: 16, metricaLabel: 'Carga Total',
      fases: [
        { num: 1, nombre: 'Adaptación Dual',       color: '#659499', semanas: [1, 4]  },
        { num: 2, nombre: 'Acumulación Integrada', color: '#eab731', semanas: [5, 8]  },
        { num: 3, nombre: 'Intensificación',       color: '#da7a0e', semanas: [9, 12] },
        { num: 4, nombre: 'Pico Competitivo',      color: '#f43f5e', semanas: [13, 16]},
      ],
      dayScenario: { 0:'PARTIDO', 1:'RECUPERACION', 2:'EQUIPO_TAC_BASKET', 3:'GYM_POTENCIA', 4:'EQUIPO_FISICO', 5:'GYM_PREVENCION', 6:'ACTIVACION_PRE' },
    },
    { id: 'DUAL_HANDBALL', categoria: 'DUAL', moduloDeportivo: 'dual',
      emoji: '🤾', color: '#8b5cf6', label: 'Handball + Gym',
      desc: 'Plan integrado para jugadores de handball.',
      rpeYellow: 7.1, rpeRed: 8.5, duracionSemanas: 16, metricaLabel: 'Carga Total',
      fases: [
        { num: 1, nombre: 'Adaptación Dual',       color: '#659499', semanas: [1, 4]  },
        { num: 2, nombre: 'Acumulación Integrada', color: '#eab731', semanas: [5, 8]  },
        { num: 3, nombre: 'Intensificación',       color: '#da7a0e', semanas: [9, 12] },
        { num: 4, nombre: 'Pico Competitivo',      color: '#f43f5e', semanas: [13, 16]},
      ],
      dayScenario: { 0:'PARTIDO', 1:'RECUPERACION', 2:'EQUIPO_TAC_HANDBALL', 3:'GYM_FUERZA_SUP', 4:'EQUIPO_FISICO', 5:'GYM_PREVENCION', 6:'ACTIVACION_PRE' },
    },
    { id: 'DUAL_TENIS', categoria: 'DUAL', moduloDeportivo: 'dual',
      emoji: '🎾', color: '#84cc16', label: 'Tenis + Gym',
      desc: 'Plan integrado para tenistas.',
      rpeYellow: 7.1, rpeRed: 8.5, duracionSemanas: 16, metricaLabel: 'Carga Total',
      fases: [
        { num: 1, nombre: 'Adaptación Dual',       color: '#659499', semanas: [1, 4]  },
        { num: 2, nombre: 'Acumulación Integrada', color: '#eab731', semanas: [5, 8]  },
        { num: 3, nombre: 'Intensificación',       color: '#da7a0e', semanas: [9, 12] },
        { num: 4, nombre: 'Pico Competitivo',      color: '#f43f5e', semanas: [13, 16]},
      ],
      dayScenario: { 0:'DESCANSO', 1:'GYM_FUERZA_INF', 2:'EQUIPO_TAC_TENIS', 3:'GYM_PREVENCION', 4:'EQUIPO_FISICO', 5:'GYM_POTENCIA', 6:'ACTIVACION_PRE' },
    },
    { id: 'DUAL_ATLETISMO', categoria: 'DUAL', moduloDeportivo: 'dual',
      emoji: '🏃', color: '#f97316', label: 'Atletismo + Gym',
      desc: 'Plan integrado para atletas.',
      rpeYellow: 7.1, rpeRed: 8.5, duracionSemanas: 16, metricaLabel: 'Carga Total',
      fases: [
        { num: 1, nombre: 'Adaptación Dual',       color: '#659499', semanas: [1, 4]  },
        { num: 2, nombre: 'Acumulación Integrada', color: '#eab731', semanas: [5, 8]  },
        { num: 3, nombre: 'Intensificación',       color: '#da7a0e', semanas: [9, 12] },
        { num: 4, nombre: 'Pico Competitivo',      color: '#f43f5e', semanas: [13, 16]},
      ],
      dayScenario: { 0:'DESCANSO', 1:'GYM_FUERZA_INF', 2:'EQUIPO_FISICO', 3:'GYM_PREVENCION', 4:'EQUIPO_TAC_ATLETISMO', 5:'GYM_POTENCIA', 6:'ACTIVACION_PRE' },
    },
    { id: 'DUAL_NATACION', categoria: 'DUAL', moduloDeportivo: 'dual',
      emoji: '🏊', color: '#06b6d4', label: 'Natación + Gym',
      desc: 'Plan integrado para nadadores competitivos.',
      rpeYellow: 7.1, rpeRed: 8.5, duracionSemanas: 16, metricaLabel: 'Carga Total',
      fases: [
        { num: 1, nombre: 'Adaptación Dual',       color: '#659499', semanas: [1, 4]  },
        { num: 2, nombre: 'Acumulación Integrada', color: '#eab731', semanas: [5, 8]  },
        { num: 3, nombre: 'Intensificación',       color: '#da7a0e', semanas: [9, 12] },
        { num: 4, nombre: 'Pico Competitivo',      color: '#f43f5e', semanas: [13, 16]},
      ],
      dayScenario: { 0:'DESCANSO', 1:'GYM_FUERZA_SUP', 2:'EQUIPO_FISICO', 3:'GYM_PREVENCION', 4:'EQUIPO_TAC_NATACION', 5:'GYM_POTENCIA', 6:'ACTIVACION_PRE' },
    },
    // ── HÍBRIDO Tipo C ──
    { id: 'BOXEO_COMPETITIVO', categoria: 'HIBRIDO', moduloDeportivo: 'hibrido',
      emoji: '🥊', color: '#dc2626', label: 'Boxeo Competitivo',
      desc: 'Sparring + sala + técnica. 5 días/sem.',
      rpeYellow: 7.5, rpeRed: 9.0, duracionSemanas: 12, metricaLabel: 'Carga Interna',
      dayScenario: { 0:'DESCANSO', 1:'BOXEO_SALA', 2:'BOXEO_TECNICA', 3:'BOXEO_SALA', 4:'BOXEO_SPARRING', 5:'BOXEO_TECNICA', 6:'RECUPERACION' },
      fases: [
        { num: 1, nombre: 'Acondicionamiento', color: '#fca5a5', semanas: [1,  4]  },
        { num: 2, nombre: 'Construcción',       color: '#ef4444', semanas: [5,  8]  },
        { num: 3, nombre: 'Pico Competitivo',   color: '#dc2626', semanas: [9,  12] },
      ],
    }
);



/* ============================================================
   DEPORTE TIPO — Clasificación por modalidad
   A = campo + gym complementario
   B = gym es el deporte principal
   C = híbrido (sala + técnica/sparring externos)
   ============================================================ */
const DEPORTE_TIPO = {
    FUTBOL: 'A', HOCKEY: 'A', RUGBY: 'A',
    HANDBALL: 'A', BALONCESTO: 'A', TENIS: 'A',
    ATLETISMO: 'A', NATACION: 'A', VOLLEY: 'A',
    BOXEO: 'C',
    CROSSFIT: 'B', FUERZA_PURA: 'B',
};

/* Objetivos DUAL — Tipo A (campo + gym) */
const DUAL_BASE = {
    moduloDeportivo: 'dual',
    rpeYellow: 7.1, rpeRed: 8.5,
    duracionSemanas: 16,
    fases: [
        { num: 1, nombre: 'Adaptación Dual',       color: '#659499', semanas: [1, 4]  },
        { num: 2, nombre: 'Acumulación Integrada', color: '#eab731', semanas: [5, 8]  },
        { num: 3, nombre: 'Intensificación',       color: '#da7a0e', semanas: [9, 12] },
        { num: 4, nombre: 'Pico Competitivo',      color: '#f43f5e', semanas: [13, 16]},
    ],
    metricaLabel: 'Carga Total',
};

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
    { cod: 8, nombre: 'Hip Thrust (Empuje de Cadera)', patron: 'Dominante Cadera', grupo: 'Piernas', fatiga: 2, dia: 'Lunes', activo: true },
    { cod: 9, nombre: 'Estocadas con mancuernas', patron: 'Dominante Rodilla', grupo: 'Piernas', fatiga: 2, dia: 'Miércoles', activo: true },
    { cod: 10, nombre: 'Banco de Cuádriceps', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 11, nombre: 'Banco de Isquiotibiales', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 12, nombre: 'Peso muerto hexagonal', patron: 'Dominante Cadera', grupo: 'Piernas', fatiga: 3, dia: 'Lunes', activo: true },
    { cod: 13, nombre: 'Press banca inclinado', patron: 'Empuje Horizontal', grupo: 'Pectoral', fatiga: 2, dia: 'Jueves', activo: true },
    { cod: 14, nombre: 'Aperturas en máquina', patron: 'Aislamiento', grupo: 'Pectoral', fatiga: 1, dia: 'Jueves', activo: true },
    { cod: 15, nombre: 'Remo en T (Seal Row)', patron: 'Tracción Horizontal', grupo: 'Espalda', fatiga: 2, dia: 'Jueves', activo: true },
    { cod: 16, nombre: 'Pull-Over con Mancuerna (Apertura de Espalda)', patron: 'Tracción Vertical', grupo: 'Espalda', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 17, nombre: 'Jalón a dos brazos', patron: 'Tracción Vertical', grupo: 'Espalda', fatiga: 2, dia: 'Jueves', activo: true },
    { cod: 18, nombre: 'Martillo (Bíceps)', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 19, nombre: 'Fondos (Tríceps)', patron: 'Brazos', grupo: 'Brazos', fatiga: 2, dia: 'Martes', activo: true },
    { cod: 20, nombre: 'Extensión polea tríceps', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 21, nombre: 'Bíceps en polea', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 22, nombre: 'Vuelos laterales', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 23, nombre: 'Press hombro + iso', patron: 'Empuje Vertical', grupo: 'Brazos/Hombro', fatiga: 2, dia: 'Martes', activo: true },
    { cod: 24, nombre: 'Face-Pull (Tirón al Rostro en Polea)', patron: 'Tracción Horizontal', grupo: 'Espalda/Hombro', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 25, nombre: 'Banco de Gemelos', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 26, nombre: 'Aductores en Máquina', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 27, nombre: 'Copenhagen Plank (Plancha de Aductores)', patron: 'Core', grupo: 'Core', fatiga: 2, dia: 'Lunes/Jueves', activo: true },
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

    /* ══════════════════════════════════════════════════
       MOVILIDAD & FLEXIBILIDAD — cods 55-68
    ══════════════════════════════════════════════════ */
    { cod: 55, nombre: 'Apertura de Cadera 90-90', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Sentado en el suelo con ambas piernas en ángulo de 90°. Rota el tronco hacia cada lado sosteniendo 30 seg. Mejora la rotación interna y externa de cadera.' },
    { cod: 56, nombre: 'Rotación Torácica en 4 Apoyos', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'En cuadrupedia, mano detrás de la cabeza. Rota el codo hacia el techo, 10 reps por lado. Desbloquea la columna torácica, clave para todo gesto deportivo.' },
    { cod: 57, nombre: 'Movilidad de Tobillo contra la Pared', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'De pie frente a la pared, empuja la rodilla hacia adelante sin levantar el talón. 10-15 reps c/lado. Mejora la dorsiflexión, esencial para sentadilla y saltos.' },
    { cod: 58, nombre: 'Péndulo de Hombro (Codman)', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Apoyado en una mesa, brazo colgando relajado. Círculos suaves de 60 seg c/lado. Descomprime el espacio subacromial, ideal en calentamiento de nadadores y tenistas.' },
    { cod: 59, nombre: 'Estiramiento del Flexor de Cadera', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Rodilla apoyada en el suelo, pie adelante a 90°. Avanza el tronco recto apretando el glúteo trasero. 30-40 seg c/lado. Revierte el acortamiento del psoas por sedentarismo.' },
    { cod: 60, nombre: 'Roll Vertebral de Pie', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Flexión vertebral lenta hacia el suelo vértebra por vértebra y regreso. 5-8 reps. Activa la cadena posterior completa y mejora la percepción corporal segmentada.' },
    { cod: 61, nombre: 'Mariposa Activa (Aductores)', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Sentado, plantas de los pies unidas, empuja las rodillas al suelo con los codos. 30 seg. Mejora la movilidad de cadera, útil para saltadores y deportes de cancha.' },
    { cod: 62, nombre: 'Rotación Interna de Hombro Tumbado', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Tumbado de lado, codo a 90°. Presiona el dorso de la mano hacia el suelo con la otra mano. 30 seg c/lado. Previene lesiones del manguito rotador.' },
    { cod: 63, nombre: 'Estiramiento de Isquiotibiales en el Suelo', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Tumbado boca arriba, lleva una pierna extendida hacia el techo. 30 seg c/lado. Fundamental para futbolistas, corredores y todos los deportes con sprint.' },
    { cod: 64, nombre: 'Círculos de Cadera de Pie', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'De pie, manos en la cadera. Círculos amplios de 8-10 reps en cada dirección. Activa la articulación de cadera en su rango completo antes del entrenamiento.' },
    { cod: 65, nombre: 'Paloma en el Suelo (Piriforme)', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Pierna delantera cruzada a 90°, pierna trasera extendida. Inclina el tronco hacia adelante. 40 seg c/lado. Libera el glúteo y piriforme, previene ciática.' },
    { cod: 66, nombre: 'Estiramiento Lateral de Cuello', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Lleva la oreja al hombro sin elevar este, ayuda suavemente con la mano. 30 seg c/lado. Libera tensión cervical acumulada, útil en rugby, natación y trabajo de escritorio.' },
    { cod: 67, nombre: 'Apertura de Pecho con Rodillo de Espuma', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Foam roller transversal a la columna torácica, brazos abiertos. 2-3 min rodando suavemente. Revierte la postura cifótica y abre el pectoral cerrado por el entrenamiento.' },
    { cod: 68, nombre: 'Estiramiento de Pantorrilla contra la Pared', patron: 'Movilidad', grupo: 'Movilidad', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Pie contra la pared, talón en el suelo, rodilla empuja hacia adelante. 30 seg c/lado, con rodilla recta y doblada. Previene la tendinitis de Aquiles y fascitis plantar.' },

    /* ══════════════════════════════════════════════════
       TÉCNICA DE CAMPO — cods 69-86
    ══════════════════════════════════════════════════ */
    { cod: 69, nombre: 'Rondo 4vs1 (Fútbol)', patron: 'Técnica', grupo: 'Campo', fatiga: 1, dia: 'Martes', activo: true,
      desc: 'Cuatro jugadores en círculo pasan el balón mientras uno presiona en el centro. Mejora el toque, la velocidad de decisión y la presión colectiva.' },
    { cod: 70, nombre: 'Conducción con Cambio de Dirección (Fútbol)', patron: 'Técnica', grupo: 'Campo', fatiga: 1, dia: 'Martes', activo: true,
      desc: 'Conducción en zigzag entre conos con variante de dirección al sonido de señal. Trabaja el control del balón, la aceleración y la frenada explosiva.' },
    { cod: 71, nombre: 'Definición con Remate al Arco (Fútbol)', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Martes', activo: true,
      desc: 'Recepción de pase, uno o dos toques y remate. Automatiza el gesto de definición bajo presión de tiempo.' },
    { cod: 72, nombre: 'Pressing en Bloque (Fútbol)', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Jueves', activo: true,
      desc: 'En grupos de 2-3, recuperar el balón en menos de 5 seg desde la pérdida. Entrena intensidad táctica y resistencia aeróbica combinadas.' },
    { cod: 73, nombre: 'Manchas y Recepción en Serie (Volleyball)', patron: 'Técnica', grupo: 'Campo', fatiga: 1, dia: 'Martes', activo: true,
      desc: 'En parejas, recepción continua de saques o manchas. Trabaja la plataforma, la anticipación y la posición de cadera baja.' },
    { cod: 74, nombre: 'Remate con Salto y Aproximación (Volleyball)', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Martes', activo: true,
      desc: 'Aproximación de 3 pasos, salto y contacto con el balón. Coordinación de carrera, despegue y golpe. Fundamental para atacantes y centrales.' },
    { cod: 75, nombre: 'Colocación desde Distintas Posiciones (Volleyball)', patron: 'Técnica', grupo: 'Campo', fatiga: 1, dia: 'Jueves', activo: true,
      desc: 'Trabajo de distribución de balón desde posición 2, 3 y 4. Mejora la lectura del juego y la precisión de la colocación bajo presión.' },
    { cod: 76, nombre: 'Defensa de Punta Paralelo-Diagonal (Volleyball)', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Jueves', activo: true,
      desc: 'Defensores en posición baja reciben remates dirigidos a puntas. Trabaja la reacción, el desplazamiento lateral y la recuperación de posición.' },
    { cod: 77, nombre: 'Peloteo de Derecha Cruz-Paralelo (Tenis)', patron: 'Técnica', grupo: 'Campo', fatiga: 1, dia: 'Martes', activo: true,
      desc: 'Peloteo sostenido alternando cruz y paralelo desde la línea de base. Trabaja consistencia, footwork y control de profundidad del golpe.' },
    { cod: 78, nombre: 'Volea en Red más Smash (Tenis)', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Martes', activo: true,
      desc: 'Aproximación a la red, volea corta y finalización con smash sobre globo. Trabaja agresividad en la red y la coordinación de golpe aéreo.' },
    { cod: 79, nombre: 'Saque más Primer Punto (Tenis)', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Jueves', activo: true,
      desc: 'Series de saques al cuerpo y a las esquinas, seguidos del primer golpe del punto. Automatiza el gesto del saque y la transición al juego.' },
    { cod: 80, nombre: 'Tackle Técnico por Parejas (Rugby)', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Martes', activo: true,
      desc: 'En parejas con pad o bolsa, práctica del tackle desde distintos ángulos. Trabaja la posición del cuerpo, el agarre y la reducción del impacto.' },
    { cod: 81, nombre: 'Lineout — Salto y Apoyo (Rugby)', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Jueves', activo: true,
      desc: 'Coordinación de salto y apoyo entre el saltador y los apoyadores. Requiere sincronización, fuerza vertical y trabajo colectivo.' },
    { cod: 82, nombre: 'Pase de Cuchara en Movimiento (Rugby)', patron: 'Técnica', grupo: 'Campo', fatiga: 1, dia: 'Martes', activo: true,
      desc: 'Filas en movimiento lateral pasando el balón. Trabaja el pase bajo presión de tiempo y la coordinación en carrera.' },
    { cod: 83, nombre: 'Lanzamiento en Suspensión (Handball)', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Martes', activo: true,
      desc: 'Carrera de 3 pasos, salto y lanzamiento en suspensión al arco. Trabaja la coordinación aérea, la potencia y la colocación del lanzamiento.' },
    { cod: 84, nombre: 'Bandeja y Paso Reglamentario (Básquet)', patron: 'Técnica', grupo: 'Campo', fatiga: 1, dia: 'Martes', activo: true,
      desc: 'Conducción, dos pasos reglamentarios y bandeja a canasta. Gesto más frecuente del básquet. Trabaja coordinación y ritmo de paso específico.' },
    { cod: 85, nombre: 'Pase y Desmarque en Triángulo (Básquet/Handball)', patron: 'Técnica', grupo: 'Campo', fatiga: 1, dia: 'Jueves', activo: true,
      desc: 'Tres jugadores en triángulo: pasa, se mueve, recibe. Trabaja velocidad de decisión, lectura del compañero y movilidad sin balón.' },
    { cod: 86, nombre: 'Conducción con Disparo al Arco (Hockey)', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Martes', activo: true,
      desc: 'Conducción con stick en slalom de conos y disparo al arco. Trabaja el control del palo, el cambio de ritmo y la definición.' },

    /* ══════════════════════════════════════════════════
       FUERZA, POTENCIA Y CORE AVANZADO — cods 87-115
    ══════════════════════════════════════════════════ */
    { cod: 87, nombre: 'Rueda Abdominal', patron: 'Core', grupo: 'Core', fatiga: 2, dia: 'Todos', activo: true,
      desc: 'Arrodillado con la rueda en el suelo, extiende los brazos hacia adelante hasta casi horizontal y regresa. Alto reclutamiento del core anterior completo.' },
    { cod: 88, nombre: 'Bandera Abdominal (Dragon Flag)', patron: 'Core', grupo: 'Core', fatiga: 3, dia: 'Todos', activo: true,
      desc: 'Tumbado en banco, baja el cuerpo extendido desde los hombros controlando la bajada. Core extremadamente exigente, para atletas avanzados.' },
    { cod: 89, nombre: 'Prensa de Resistencia Rotacional (Pallof Press)', patron: 'Core', grupo: 'Core', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'De pie lateral a una polea, extiende los brazos al frente resistiendo la rotación. Entrena la estabilidad antirotacional del core. Clave en deportes de giro.' },
    { cod: 90, nombre: 'Remo Invertido en TRX', patron: 'Tracción Horizontal', grupo: 'Espalda', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Colgado de las correas con los pies en el suelo, jala el pecho hacia las manos. Fácil ajuste de dificultad inclinando más o menos el cuerpo.' },
    { cod: 91, nombre: 'Dominadas con Agarre Supino', patron: 'Tracción Vertical', grupo: 'Espalda', fatiga: 2, dia: 'Martes', activo: true,
      desc: 'Dominadas con las palmas mirando hacia vos. Mayor activación del bíceps. Alternativa accesible para quienes buscan trabajar espalda y bíceps juntos.' },
    { cod: 92, nombre: 'Press de Banca con Agarre Estrecho', patron: 'Empuje Horizontal', grupo: 'Pectoral', fatiga: 2, dia: 'Martes', activo: true,
      desc: 'Press banca con manos a ancho de hombros. Desplaza el énfasis del pectoral al tríceps. Complementa los días de empuje sin duplicar el ejercicio.' },
    { cod: 93, nombre: 'Fondos en Anillas', patron: 'Empuje Horizontal', grupo: 'Pectoral', fatiga: 3, dia: 'Martes', activo: true,
      desc: 'Fondos en anillas de gimnasia. Máxima activación estabilizadora del pectoral y hombros. Versión avanzada de los fondos en paralelas fijas.' },
    { cod: 94, nombre: 'Press de Hombros con Mancuernas Sentado', patron: 'Empuje Vertical', grupo: 'Hombros', fatiga: 2, dia: 'Miércoles', activo: true,
      desc: 'Sentado, empuja las mancuernas desde la oreja hacia arriba. Mayor rango de movimiento y trabajo independiente de cada brazo que el press con barra.' },
    { cod: 95, nombre: 'Elevaciones Laterales en Polea Baja', patron: 'Aislamiento', grupo: 'Hombros', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'De pie lateral a la polea, eleva el brazo hasta el hombro. Tensión constante en todo el rango a diferencia de las mancuernas. Mejor para el deltoides medio.' },
    { cod: 96, nombre: 'Remo al Mentón con Mancuernas', patron: 'Tracción Vertical', grupo: 'Hombros', fatiga: 2, dia: 'Miércoles', activo: true,
      desc: 'Mancuernas colgando, sube los codos por encima del hombro. Activa el trapecio superior y el deltoides lateral de forma simultánea.' },
    { cod: 97, nombre: 'Sentadilla Goblet', patron: 'Dominante Rodilla', grupo: 'Piernas', fatiga: 2, dia: 'Todos', activo: true,
      desc: 'Pesa rusa o mancuerna contra el pecho, sentadilla profunda. Ideal para aprender el patrón de sentadilla o como calentamiento de activación.' },
    { cod: 98, nombre: 'Sentadilla Búlgara con Copa', patron: 'Dominante Rodilla', grupo: 'Piernas', fatiga: 2, dia: 'Miércoles', activo: true,
      desc: 'Pie trasero elevado en banco, desciende controlado. Gran activador de glúteo y cuádriceps unilateral sin alta carga en la columna.' },
    { cod: 99, nombre: 'Extensión de Cadera Unilateral en Suelo', patron: 'Dominante Cadera', grupo: 'Piernas', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Tumbado boca arriba, una rodilla doblada y la otra extendida. Eleva la cadera. Aislamiento de glúteo sin carga, ideal en prevención y rehabilitación.' },
    { cod: 100, nombre: 'Prensa de Piernas', patron: 'Dominante Rodilla', grupo: 'Piernas', fatiga: 2, dia: 'Lunes', activo: true,
      desc: 'Empuja la plataforma de la máquina con los pies a ancho de cadera. Permite cargar piernas sin estrés en la columna vertebral.' },
    { cod: 101, nombre: 'Curl Nórdico de Isquiotibiales', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 3, dia: 'Jueves', activo: true,
      desc: 'Rodillas fijas en el suelo, desciende el tronco hacia adelante frenando con los isquios. El ejercicio más efectivo para prevenir desgarros de isquiotibiales.' },
    { cod: 102, nombre: 'Peso Muerto a una Pierna con Mancuerna', patron: 'Dominante Cadera', grupo: 'Piernas', fatiga: 2, dia: 'Miércoles', activo: true,
      desc: 'En una pierna, inclina el tronco hacia adelante bajando la mancuerna. Trabaja glúteo, isquio y estabilidad de tobillo-rodilla en cadena cinética unilateral.' },
    { cod: 103, nombre: 'Rotación Externa de Hombro con Banda', patron: 'Aislamiento', grupo: 'Hombros', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Codo fijo al costado, gira el antebrazo hacia afuera contra una banda. Fortalece el infraespinoso y el redondo menor. Fundamental para nadadores, tenistas y lanzadores.' },
    { cod: 104, nombre: 'Rotación Interna de Hombro con Banda', patron: 'Aislamiento', grupo: 'Hombros', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Codo fijo al costado, gira el antebrazo hacia el abdomen contra una banda. Fortalece el subescapular. Complementa la rotación externa para equilibrio articular.' },
    { cod: 105, nombre: 'Y-T-W en Banco Inclinado', patron: 'Aislamiento', grupo: 'Hombros', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Tumbado boca abajo en banco inclinado, realiza movimientos en forma de Y, T y W con los brazos. Activa los estabilizadores de escápula y el manguito rotador.' },
    { cod: 106, nombre: 'Salto al Cajón', patron: 'Potencia', grupo: 'Full Body', fatiga: 2, dia: 'Martes', activo: true,
      desc: 'Salto explosivo desde el suelo a un cajón, absorbiendo el impacto en cuclillas. Desarrolla la potencia de piernas. Fundamental en volleyball y básquet.' },
    { cod: 107, nombre: 'Salto Vertical con Contramovimiento', patron: 'Potencia', grupo: 'Full Body', fatiga: 2, dia: 'Martes', activo: true,
      desc: 'Flexión rápida de rodillas y salto máximo hacia arriba. Desarrolla potencia explosiva. Puede medirse la altura para seguimiento del progreso.' },
    { cod: 108, nombre: 'Saltos Laterales de Patinador', patron: 'Potencia', grupo: 'Full Body', fatiga: 2, dia: 'Miércoles', activo: true,
      desc: 'Saltos de un pie al otro en forma lateral imitando el gesto del patinador. Desarrolla potencia lateral y estabilidad de tobillo, clave en deportes de cancha.' },
    { cod: 109, nombre: 'Sprint de 10 metros', patron: 'Potencia', grupo: 'Aeróbico', fatiga: 2, dia: 'Martes', activo: true,
      desc: 'Sprint de máxima intensidad en distancia corta. Trabaja la aceleración inicial. Series de 6-10 reps con recuperación completa entre cada una.' },
    { cod: 110, nombre: 'Agilidad en T (T-Drill)', patron: 'Potencia', grupo: 'Aeróbico', fatiga: 2, dia: 'Jueves', activo: true,
      desc: 'Patrón en T: sprint al frente, lateral y atrás. Desarrolla la agilidad multidireccional y la velocidad de cambio de apoyo. Clásico test de agilidad deportiva.' },
    { cod: 111, nombre: 'Remo en Ergómetro', patron: 'Cardio', grupo: 'Aeróbico', fatiga: 2, dia: 'Todos', activo: true,
      desc: 'Máquina de remo tipo Concept2. Trabaja espalda, piernas y cardio en un movimiento coordinado de tracción. Alta demanda aeróbica con bajo impacto articular.' },
    { cod: 112, nombre: 'Ski Erg (Tracción Aérea)', patron: 'Cardio', grupo: 'Aeróbico', fatiga: 2, dia: 'Todos', activo: true,
      desc: 'Máquina de ski, jala los cordones hacia abajo alternado o simultáneo. Alta demanda cardiovascular con énfasis en dorsal, core y tríceps. Popular en CrossFit.' },
    { cod: 113, nombre: 'Series de Velocidad en Cinta', patron: 'HIIT', grupo: 'Aeróbico', fatiga: 2, dia: 'Todos', activo: true,
      desc: 'En cinta: 30 seg a velocidad máxima con 90 seg de trote suave. 8-10 repeticiones. Mejora el VO2max y la resistencia a la velocidad.' },
    { cod: 114, nombre: 'Caminata Nórdica con Bastones', patron: 'Cardio', grupo: 'Aeróbico', fatiga: 1, dia: 'Todos', activo: true,
      desc: 'Caminata activa con bastones que involucra el tren superior. Ideal en rehabilitación y para usuarios que necesitan cardio de bajo impacto articular.' },
    { cod: 115, nombre: 'Soga con Doble Salto', patron: 'HIIT', grupo: 'Aeróbico', fatiga: 2, dia: 'Todos', activo: true,
      desc: 'La soga pasa dos veces por debajo en cada salto. Requiere mayor potencia y coordinación que el salto simple. Usado en boxeo y CrossFit.' },
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

    /* ════════════════════════════════════════════════
       GIMNASIO PURO — Alto Rendimiento
       Foco: fuerza + hipertrofia + prevención
       ════════════════════════════════════════════════ */
    FUERZA_PIERNA_B:    { label: 'FUERZA PIERNAS A', emoji: '🏋️', color: '#3b82f6',
        ejercicios: [6, 7, 8, 12, 11, 27],
        desc: 'Sentadilla + Peso Muerto + Hip Thrust + Isquios. Sesión pesada.' },
    FUERZA_TREN_SUP:    { label: 'FUERZA TREN SUP', emoji: '💪', color: '#8b5cf6',
        ejercicios: [1, 4, 23, 19, 20, 30],
        desc: 'Empuje horizontal + tracción vertical + hombros. Sesión pesada.' },
    HIPERTROFIA_INF:    { label: 'HIPERTROFIA INF', emoji: '🦵', color: '#06b6d4',
        ejercicios: [9, 10, 11, 25, 26, 43, 28],
        desc: 'Estocadas + quad + isquios + gemelos + aductores. Volumen moderado.' },
    HIPERTROFIA_SUP:    { label: 'HIPERTROFIA SUP', emoji: '🔝', color: '#10b981',
        ejercicios: [13, 5, 15, 17, 30, 24, 3],
        desc: 'Press inclinado + remos + jalón + face-pull. Volumen moderado.' },
    PREVENCION:         { label: 'PREVENCIÓN', emoji: '🛡️', color: '#f59e0b',
        ejercicios: [24, 22, 28, 27, 50, 3],
        desc: 'Manguito rotador + core + aductores. Carga baja, calidad alta.' },

    /* ════════════════════════════════════════════════
       GIMNASIO PURO — Masa Muscular
       Foco: volumen alto, splits por grupo muscular
       ════════════════════════════════════════════════ */
    MASA_PIERNAS:       { label: 'MASA PIERNAS A', emoji: '🦵', color: '#7c3aed',
        ejercicios: [6, 8, 10, 11, 25, 26],
        desc: 'Sentadilla + Hip Thrust + Quad + Isquios + Gemelos + Aductores.' },
    MASA_EMPUJE:        { label: 'MASA EMPUJE', emoji: '💪', color: '#8b5cf6',
        ejercicios: [1, 13, 42, 23, 45, 19, 47],
        desc: 'Press plano + inclinado + hombros + fondos. Pecho/Hombro/Tríceps.' },
    MASA_TRACCION:      { label: 'MASA TRACCIÓN', emoji: '🔝', color: '#6d28d9',
        ejercicios: [4, 30, 5, 17, 44, 15, 16],
        desc: 'Dominadas + remos + jalón + pull-over. Espalda/Bíceps.' },
    MASA_HOMBROS_BRAZOS:{ label: 'HOMBROS & BRAZOS', emoji: '🦾', color: '#5b21b6',
        ejercicios: [45, 23, 22, 24, 46, 20, 47],
        desc: 'Press Arnold + vuelos + curl + extensión + dips. Aislamiento.' },
    MASA_PIERNAS_B:     { label: 'MASA PIERNAS B', emoji: '🏋️', color: '#7c3aed',
        ejercicios: [7, 41, 43, 49, 9, 26],
        desc: 'Peso muerto rumano + búlgaras + step-up + estocadas.' },

    /* ════════════════════════════════════════════════
       GIMNASIO PURO — Pérdida de Peso
       Foco: cardio + circuitos metabólicos
       ════════════════════════════════════════════════ */
    CARDIO_FUERZA:      { label: 'CARDIO + FUERZA', emoji: '🔥', color: '#f97316',
        ejercicios: [40, 9, 39, 29, 51, 52],
        desc: 'Circuito: Thruster + Estocadas + Burpees + Plancha + Climbers + KB Swing.' },
    HIIT:               { label: 'HIIT', emoji: '⚡', color: '#ef4444',
        ejercicios: [36, 38, 39, 53, 51, 52],
        desc: 'Intervalos + soga + burpees + battle ropes + climbers + kettlebell.' },
    CARDIO_LARGO:       { label: 'CARDIO LARGO', emoji: '🌊', color: '#06b6d4',
        ejercicios: [35, 37, 48, 54],
        desc: 'Zona 2: Trote + Bici + Elíptica + Natación. 45-60 min, RPE 5-6.' },

    /* ════════════════════════════════════════════════
       GIMNASIO PURO — Definición
       Foco: fuerza + cardio combinado, déficit
       ════════════════════════════════════════════════ */
    DEF_TREN_INF:       { label: 'DEFINICIÓN INF', emoji: '🎯', color: '#0891b2',
        ejercicios: [6, 43, 9, 11, 10, 25, 51],
        desc: 'Sentadilla + búlgaras + estocadas + isquios + quad + gemelos + climbers.' },
    DEF_TREN_SUP:       { label: 'DEFINICIÓN SUP', emoji: '🎯', color: '#0891b2',
        ejercicios: [1, 5, 3, 22, 24, 29, 50],
        desc: 'Press banca + remo + aperturas + vuelos + face-pull + plancha.' },

    /* ════════════════════════════════════════════════
       GIMNASIO PURO — Aeróbico / Capacidad
       Foco: resistencia cardiorrespiratoria
       ════════════════════════════════════════════════ */
    INTERVALOS:         { label: 'INTERVALOS', emoji: '🌊', color: '#10b981',
        ejercicios: [36, 38, 53, 51],
        desc: '4×4 min intensos + soga + battle ropes + climbers. VO2max.' },
    AEROBICO_BASE:      { label: 'AERÓBICO BASE', emoji: '🫁', color: '#34d399',
        ejercicios: [35, 37, 48, 54],
        desc: 'Zona 2 sostenida. Trote + Bici + Elíptica. 50-60 min.' },
    FUERZA_AEROBICA:    { label: 'FUERZA AERÓBICA', emoji: '💚', color: '#059669',
        ejercicios: [97, 9, 40, 111, 89, 51],
        desc: 'Sentadilla + Estocadas + Thruster + Core. Poco descanso entre series.' },

    /* ════════════════════════════════════════════════
       GIMNASIO PURO — Fuerza Pura (Powerlifting)
       Foco: máxima fuerza en S/B/D, técnica y accesorios
       ════════════════════════════════════════════════ */
    FUERZA_SQUAT:       { label: 'DÍA SQUAT', emoji: '🏋️', color: '#ef4444',
        ejercicios: [6, 43, 10, 9, 27],
        desc: 'Sentadilla principal + accesorio quad. Series pesadas 3-5 reps.' },
    FUERZA_BENCH:       { label: 'DÍA BENCH', emoji: '🏋️', color: '#dc2626',
        ejercicios: [1, 13, 42, 19, 47],
        desc: 'Press banca principal + inclinado + fondos. 3-5 reps pesadas.' },
    FUERZA_DEAD:        { label: 'DÍA DEADLIFT', emoji: '🏋️', color: '#b91c1c',
        ejercicios: [7, 12, 41, 11, 27],
        desc: 'Peso muerto convencional + hex bar + rumano + isquios.' },
    FUERZA_ACCESORIO:   { label: 'ACCESORIOS', emoji: '💪', color: '#991b1b',
        ejercicios: [5, 30, 23, 46, 20, 50],
        desc: 'Remo + dominadas lastre + press hombro + bíceps + tríceps + core.' },

    /* ════════════════════════════════════════════════
       GIMNASIO PURO — Flexibilidad / Movilidad
       Foco: rangos de movimiento, movilidad articular
       ════════════════════════════════════════════════ */
    MOVILIDAD_FULL:     { label: 'MOVILIDAD COMPLETA', emoji: '🧘', color: '#a78bfa',
        ejercicios: [55, 56, 59, 64, 63, 67, 60],
        desc: 'Dead bug + plancha lateral + copenhagen + face-pull + vuelos + trote suave.' },
    MOVILIDAD_CADERA:   { label: 'MOVILIDAD CADERA', emoji: '🔄', color: '#c4b5fd',
        ejercicios: [28, 27, 9, 26, 8, 50],
        desc: 'Dead bug + Copenhagen + estocadas lentas + aductores + glúteo.' },
    STRETCHING_ACTIVO:  { label: 'STRETCHING ACTIVO', emoji: '🌿', color: '#8b5cf6',
        ejercicios: [34, 28, 50, 27, 24],
        desc: 'Trote suave + movilidad de suelo + plancha + face-pull. RPE máx 4.' },

    /* ════════════════════════════════════════════════
       GIMNASIO PURO — CrossFit / Funcional
       Foco: movimientos olímpicos, WODs, capacidad mixta
       ════════════════════════════════════════════════ */
    CROSSFIT_FUERZA:    { label: 'FUERZA FUNCIONAL', emoji: '💥', color: '#dc2626',
        ejercicios: [6, 7, 93, 91, 40, 52],
        desc: 'Sentadilla + DL + Press + Dominadas + Thruster + KB. Cargas altas.' },
    CROSSFIT_METCON:    { label: 'METCON', emoji: '🔥', color: '#ef4444',
        ejercicios: [39, 51, 38, 53, 52, 36],
        desc: 'Burpees + climbers + soga + battle ropes + KB + intervalos. AMRAP/EMOM.' },
    CROSSFIT_CARDIO:    { label: 'CARDIO FUNCIONAL', emoji: '🌊', color: '#f97316',
        ejercicios: [35, 36, 38, 48, 40, 29],
        desc: 'Trote + intervalos + soga + elíptica + thruster + plancha.' },

    /* ════════════════════════════════════════════════
       GIMNASIO PURO — Rehabilitación
       Foco: movilidad, bajo impacto, progresión controlada
       ════════════════════════════════════════════════ */
    REHAB_CORE:         { label: 'CORE REHABILITADOR', emoji: '🫀', color: '#6ee7b7',
        ejercicios: [28, 50, 29, 27, 24],
        desc: 'Dead bug + plancha lateral + plancha toque + Copenhagen + face-pull. Sin carga.' },
    REHAB_MOVILIDAD:    { label: 'MOVILIDAD TERAPÉUTICA', emoji: '💆', color: '#34d399',
        ejercicios: [34, 55, 59, 60, 62, 58],
        desc: 'Caminata suave + dead bug + plancha + rotadores. RPE máx 3.' },
    REHAB_FUERZA:       { label: 'FUERZA PROGRESIVA', emoji: '🌱', color: '#10b981',
        ejercicios: [97, 99, 90, 89, 103, 104],
        desc: 'Estocadas con mancuerna liviana + aductores + core. Progresión controlada.' },

    /* ════════════════════════════════════════════════
       DEPORTES — Escenarios genéricos compartidos
       ════════════════════════════════════════════════ */
    RECUPERACION:       { label: 'RECUPERACIÓN', emoji: '💚', color: '#22c55e',
        ejercicios: [34, 28, 24],
        desc: 'Caminata + dead bug + face-pull. RPE máx 4. Activa, no pasiva.' },
    RECUPERACION_FACILITADA: { label: 'RECUPERACIÓN FACILITADA', emoji: '🧊', color: '#34d399',
        ejercicios: [34, 28, 50, 24],
        desc: 'Caminata + dead bug + plancha lateral + face-pull. Mutación por fatiga.' },
    PARTIDO:            { label: 'PARTIDO', emoji: '⚽', color: '#ef4444', ejercicios: [],
        desc: 'Partido o competencia. Registrá minutos y RPE al terminar.' },
    AMISTOSO:           { label: 'AMISTOSO', emoji: '⚽', color: '#f97316', ejercicios: [31, 32, 33] },
    TECNICA:            { label: 'TÉCNICA', emoji: '🎯', color: '#a78bfa', ejercicios: [31, 32, 33] },
    DESCANSO:           { label: 'DESCANSO', emoji: '😴', color: '#6b7280', ejercicios: [] },

    /* ════════════════════════════════════════════════
       DEPORTES — Fuerza base compartida (mejorada)
       ════════════════════════════════════════════════ */
    FUERZA_BASE:        { label: 'FUERZA BASE', emoji: '💪', color: '#059669',
        ejercicios: [6, 7, 1, 91, 89, 101],
        desc: 'Sentadilla + Peso Muerto + Press Banca + Dominadas + Core. Sesión completa.' },

    /* ════════════════════════════════════════════════
       FÚTBOL — Escenarios específicos
       ════════════════════════════════════════════════ */
    FUTBOL_TECNICA:     { label: 'FÚTBOL — TÉCNICA', emoji: '⚽', color: '#16a34a',
        ejercicios: [31, 32, 33, 34],
        desc: 'Slalom + control + desmarque + trote. Trabajo con balón y técnica.' },
    FUTBOL_FISICO:      { label: 'FÚTBOL — FÍSICO', emoji: '🏃', color: '#15803d',
        ejercicios: [36, 35, 38, 9, 27],
        desc: 'Intervalos de velocidad + cambios de ritmo + estocadas + core.' },

    /* ════════════════════════════════════════════════
       TENIS — Escenarios específicos
       ════════════════════════════════════════════════ */
    TENIS_FUERZA:       { label: 'TENIS — FUERZA', emoji: '🎾', color: '#84cc16',
        ejercicios: [6, 102, 94, 95, 89, 101],
        desc: 'Tren inferior + hombro + manguito rotador + core. Base del tenista.' },
    TENIS_TECNICA:      { label: 'TENIS — TÉCNICA', emoji: '🎾', color: '#65a30d',
        ejercicios: [77, 78, 79, 34, 36],
        desc: 'Trabajo de cancha: drills + desplazamientos + carga cardiovascular.' },
    TENIS_PREVENCION:   { label: 'TENIS — PREVENCIÓN', emoji: '🛡️', color: '#4d7c0f',
        ejercicios: [103, 104, 105, 24, 58, 62],
        desc: 'Face-pull + vuelos + press hombro + core. Prevención de hombro y codo.' },

    /* ════════════════════════════════════════════════
       VOLLEYBALL — Escenarios específicos
       ════════════════════════════════════════════════ */
    VOLLEY_SALTO:       { label: 'VOLLEY — POTENCIA SALTO', emoji: '🏐', color: '#7c3aed',
        ejercicios: [106, 107, 108, 6, 8, 97],
        desc: 'Sentadilla + Hip Thrust + Quad + Búlgaras + KB Swing + Core. Explosividad vertical.' },
    VOLLEY_TECNICA:     { label: 'VOLLEY — TÉCNICA', emoji: '🏐', color: '#6d28d9',
        ejercicios: [73, 74, 75, 76],
        desc: 'Drills de técnica: manchas, remates, colocaciones, desplazamientos.' },
    VOLLEY_PREVENCION:  { label: 'VOLLEY — PREVENCIÓN', emoji: '🛡️', color: '#5b21b6',
        ejercicios: [103, 104, 105, 57, 101, 89],
        desc: 'Manguito + hombro + core + aductores. Prevención rodilla y hombro.' },

    /* ════════════════════════════════════════════════
       RUGBY — Escenarios específicos
       ════════════════════════════════════════════════ */
    RUGBY_SCRUMS:       { label: 'RUGBY — FUERZA/SCRUM', emoji: '🏉', color: '#059669',
        ejercicios: [1, 93, 7, 12, 91, 101],
        desc: 'Empuje horizontal + peso muerto + dominadas + fondos. Fuerza de contacto.' },
    RUGBY_FISICO:       { label: 'RUGBY — FÍSICO', emoji: '🏃', color: '#047857',
        ejercicios: [109, 110, 36, 39, 52, 89],
        desc: 'Intervalos + trote + burpees + KB + core. Resistencia y velocidad.' },

    /* ════════════════════════════════════════════════
       ATLETISMO — Escenarios específicos
       ════════════════════════════════════════════════ */
    ATLETISMO_PISTA:    { label: 'ATLETISMO — PISTA', emoji: '🏃', color: '#ea580c',
        ejercicios: [109, 110, 36, 35, 38, 113],
        desc: 'Intervalos de alta intensidad + trote + soga + battle ropes.' },
    ATLETISMO_FUERZA:   { label: 'ATLETISMO — FUERZA', emoji: '💪', color: '#c2410c',
        ejercicios: [7, 102, 101, 98, 89, 109],
        desc: 'Peso muerto + sentadilla + estocadas + isquios + core. Fuerza del corredor.' },

    /* ════════════════════════════════════════════════
       NATACIÓN — Escenarios específicos
       ════════════════════════════════════════════════ */
    NATACION_SECO:      { label: 'NATACIÓN — TRABAJO SECO', emoji: '🏊', color: '#0284c7',
        ejercicios: [91, 90, 5, 103, 104, 105, 89],
        desc: 'Dominadas + tracción + remo + jalón + hombro + manguito + core.' },
    NATACION_CARDIO:    { label: 'NATACIÓN — CARDIO SECO', emoji: '🌊', color: '#0369a1',
        ejercicios: [54, 37, 35, 36],
        desc: 'Natación + bici + trote + intervalos. Complemento aeróbico en seco.' },

    /* ════════════════════════════════════════════════
       HANDBALL — Escenarios específicos
       ════════════════════════════════════════════════ */
    HANDBALL_LANZAMIENTO:{ label: 'HANDBALL — LANZAMIENTO', emoji: '🤾', color: '#7c3aed',
        ejercicios: [94, 95, 91, 90, 103, 83],
        desc: 'Press banca + hombro + dominadas + remo + vuelos + face-pull. Tren superior.' },
    HANDBALL_FISICO:    { label: 'HANDBALL — FÍSICO', emoji: '🏃', color: '#6d28d9',
        ejercicios: [109, 110, 36, 39, 89, 108],
        desc: 'Intervalos + trote + estocadas + burpees + core.' },

    /* ════════════════════════════════════════════════
       BALONCESTO — Escenarios específicos
       ════════════════════════════════════════════════ */
    BASKET_SALTO:       { label: 'BÁSQUET — SALTO', emoji: '🏀', color: '#ea580c',
        ejercicios: [106, 107, 108, 97, 8, 89],
        desc: 'Sentadilla + Hip Thrust + Búlgaras + KB + Thruster + Core. Explosividad.' },
    BASKET_FISICO:      { label: 'BÁSQUET — FÍSICO', emoji: '🏃', color: '#c2410c',
        ejercicios: [109, 110, 36, 38, 39, 84],
        desc: 'Intervalos + soga + trote + estocadas + climbers + core.' },

    /* ════════════════════════════════════════════════
       HOCKEY — Escenarios específicos
       ════════════════════════════════════════════════ */
    HOCKEY_FISICO:      { label: 'HOCKEY — FÍSICO', emoji: '🏑', color: '#0284c7',
        ejercicios: [109, 110, 86, 36, 39, 89],
        desc: 'Intervalos + trote + estocadas + búlgaras + core. Cambios de dirección.' },

    /* ════════════════════════════════════════════════
       DUAL — GYM integrado con deporte
       ════════════════════════════════════════════════ */
        EQUIPO_TACTICO:      { label: 'ENTRENAMIENTO EQUIPO', emoji: '🤝', color: '#659499', ejercicios: [], desc: 'Entrenamiento con el equipo. Registrá minutos y RPE al terminar.' },
        EQUIPO_TAC_FUTBOL:   { label: 'ENTRENAMIENTO EQUIPO', emoji: '🤝', color: '#659499', ejercicios: [], desc: 'Entrenamiento con el equipo. Registrá minutos y RPE al terminar.' },
        EQUIPO_TAC_VOLLEY:   { label: 'ENTRENAMIENTO EQUIPO', emoji: '🤝', color: '#659499', ejercicios: [], desc: 'Entrenamiento con el equipo. Registrá minutos y RPE al terminar.' },
        EQUIPO_TAC_TENIS:    { label: 'ENTRENAMIENTO EQUIPO', emoji: '🤝', color: '#659499', ejercicios: [], desc: 'Entrenamiento con el equipo. Registrá minutos y RPE al terminar.' },
        EQUIPO_TAC_RUGBY:    { label: 'ENTRENAMIENTO EQUIPO', emoji: '🤝', color: '#659499', ejercicios: [], desc: 'Entrenamiento con el equipo. Registrá minutos y RPE al terminar.' },
        EQUIPO_TAC_HANDBALL: { label: 'ENTRENAMIENTO EQUIPO', emoji: '🤝', color: '#659499', ejercicios: [], desc: 'Entrenamiento con el equipo. Registrá minutos y RPE al terminar.' },
        EQUIPO_TAC_BASKET:   { label: 'ENTRENAMIENTO EQUIPO', emoji: '🤝', color: '#659499', ejercicios: [], desc: 'Entrenamiento con el equipo. Registrá minutos y RPE al terminar.' },
        EQUIPO_TAC_HOCKEY:   { label: 'ENTRENAMIENTO EQUIPO', emoji: '🤝', color: '#659499', ejercicios: [], desc: 'Entrenamiento con el equipo. Registrá minutos y RPE al terminar.' },
    EQUIPO_TAC_ATLETISMO:{ label: 'ENTRENAMIENTO EQUIPO', emoji: '🤝', color: '#659499', ejercicios: [], desc: 'Entrenamiento con el equipo. Registrá minutos y RPE al terminar.' },
        EQUIPO_TAC_NATACION: { label: 'ENTRENAMIENTO EQUIPO', emoji: '🤝', color: '#659499', ejercicios: [], desc: 'Entrenamiento con el equipo. Registrá minutos y RPE al terminar.' },
        EQUIPO_FISICO:       { label: 'ENTRENAMIENTO EQUIPO', emoji: '🤝', color: '#659499', ejercicios: [], desc: 'Entrenamiento con el equipo. Registrá minutos y RPE al terminar.' },
    GYM_FUERZA_INF:     { label: 'GYM — FUERZA INF', emoji: '🏋️', color: '#eab731',
        ejercicios: [6, 7, 8, 9, 11, 27],
        desc: 'Sentadilla + Peso muerto + Hip Thrust + Estocadas + Isquios + Core.' },
    GYM_FUERZA_SUP:     { label: 'GYM — FUERZA SUP', emoji: '💪', color: '#bc9d4b',
        ejercicios: [1, 4, 5, 17, 23, 24],
        desc: 'Press Banca + Dominadas + Remo + Jalón + Hombro + Face-Pull.' },
    GYM_POTENCIA:       { label: 'GYM — POTENCIA', emoji: '⚡', color: '#da7a0e',
        ejercicios: [106, 107, 6, 8, 52, 40],
        desc: 'Sentadilla explosiva + Hip Thrust + KB Swing + Thruster + Búlgaras.' },
    GYM_PREVENCION:     { label: 'GYM — PREVENCIÓN', emoji: '🛡️', color: '#22c55e',
        ejercicios: [103, 104, 24, 28, 101, 89],
        desc: 'Face-Pull + Vuelos + Dead Bug + Copenhagen + Plancha + Aductores.' },
    ACTIVACION_PRE:     { label: 'ACTIVACIÓN PRE-PARTIDO', emoji: '🔆', color: '#f59e0b',
        ejercicios: [34, 57, 64, 59, 56, 97],
        desc: 'Trote suave + dead bug + face-pull + vuelos + core. RPE máx 5.' },

    /* ════════════════════════════════════════════════
       BOXEO — Híbrido Tipo C
       ════════════════════════════════════════════════ */
    BOXEO_SALA:         { label: 'BOXEO — SALA', emoji: '🏋️', color: '#dc2626',
        ejercicios: [7, 91, 93, 52, 89, 101],
        desc: 'Peso muerto + dominadas + fondos + soga + KB + core. Sin press banca.' },
    BOXEO_TECNICA:      { label: 'BOXEO — TÉCNICA', emoji: '🥊', color: '#ef4444',
        ejercicios: [38, 115, 109, 36, 51],
        desc: 'Trote + soga + intervalos + core + climbers. Saco, técnica, pies.' },
    BOXEO_SPARRING:     { label: 'BOXEO — SPARRING', emoji: '🤜', color: '#b91c1c',
        ejercicios: [],
        desc: 'Sparring controlado. Registrá RPE y minutos al finalizar.' },

    /* ════════════════════════════════════════════════
       COMUNES
       ════════════════════════════════════════════════ */
    TENIS_CANCHA:       { label: 'TENIS — CANCHA', emoji: '🎾', color: '#65a30d', ejercicios: [31, 32, 34] },
    MOVILIDAD_CADERA:   { label: 'MOVILIDAD CADERA', emoji: '🔄', color: '#c4b5fd', ejercicios: [55, 61, 64, 65, 59, 57] },
    STRETCHING_ACTIVO:  { label: 'STRETCHING ACTIVO', emoji: '🌿', color: '#8b5cf6', ejercicios: [34, 60, 63, 68, 66, 62] },
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

/* ============================================================
   EJERCICIOS DE FUGA — Para días de partido sin participación
   Activación neuromuscular + prevención + mantener estímulo
   ============================================================ */
const EJERCICIOS_FUGA = [
    { cod: 6,  nombre: 'Sentadilla',            grupo: 'Piernas',  series: 3, reps: '10', desc: 'Mantener fuerza tren inferior' },
    { cod: 9,  nombre: 'Estocadas con mancuernas', grupo: 'Piernas', series: 3, reps: '10', desc: 'Activación unilateral' },
    { cod: 24, nombre: 'Face-Pull (Tirón al Rostro en Polea)',              grupo: 'Hombro',   series: 3, reps: '15', desc: 'Prevención manguito rotador' },
    { cod: 27, nombre: 'Copenhagen Plank (Plancha de Aductores)',       grupo: 'Core',     series: 3, reps: '30s', desc: 'Prevención aductores' },
    { cod: 28, nombre: 'Dead Bug',               grupo: 'Core',     series: 3, reps: '10', desc: 'Estabilidad lumbar' },
    { cod: 34, nombre: 'Caminata / Trote',       grupo: 'Global',   series: 1, reps: '20min', desc: 'Activación cardiovascular suave' },
    { cod: 36, nombre: 'Intervalos 4×4 min',     grupo: 'Aeróbico', series: 4, reps: '4min', desc: 'Mantener VO2max' },
];

/* Selección inteligente de ejercicios de fuga según minutos jugados */
function getFugaEjercicios(minutosJugados) {
    if (minutosJugados === 0) {
        // No jugó nada — estímulo completo
        return [EJERCICIOS_FUGA[0], EJERCICIOS_FUGA[1], EJERCICIOS_FUGA[5], EJERCICIOS_FUGA[2], EJERCICIOS_FUGA[3]];
    } else if (minutosJugados < 45) {
        // Jugó poco — complementar con fuerza + prevención
        return [EJERCICIOS_FUGA[0], EJERCICIOS_FUGA[3], EJERCICIOS_FUGA[2]];
    }
    // Jugó bastante pero menos del total — solo prevención
    return [EJERCICIOS_FUGA[3], EJERCICIOS_FUGA[4]];
}

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

/* ============================================================
   GENERADOR DE PLAN DUAL — Tipo A (campo + gym)
   Lógica:
   1. El día del partido es fijo (DOM por defecto)
   2. El día post-partido es siempre RECUPERACION
   3. Los días de equipo se distribuyen en días no adyacentes al partido
   4. El gym se ubica en los días restantes con reglas de carga:
      - No gym de alta intensidad el día pre-partido → ACTIVACION_PRE
      - Semana 4,8,12,16 = descarga (-30% volumen)
      - Mes 1: adaptación (fuerza media), Mes 2-3: acumulación, Mes 4: pico
   5. Día pre-partido = ACTIVACION_PRE (siempre)
   ============================================================ */
function _generateDualPlan(objetivoId, onboarding) {
    const obj = getObjetivoById(objetivoId);
    if (!obj || obj.moduloDeportivo !== 'dual') return _generatePlan(objetivoId);

    const diasEquipo  = parseInt(onboarding?.diasEquipo  || '2', 10);
    const diasGym     = parseInt(onboarding?.diasGym     || '2', 10);
    const diaPartido  = parseInt(onboarding?.diaPartido  || '0', 10);  // 0=Dom
    const objetivoGym = onboarding?.objetivoGym || 'fuerza';
    const nivel       = onboarding?.nivel || 'intermedio';
    // Días específicos de equipo (ej: '2,4' = Mar y Jue)
    const diasEquipoEsp = onboarding?.diasEquipoEspecificos
        ? onboarding.diasEquipoEspecificos.split(',').map(Number)
        : null;

    // Elegir escenarios de gym según objetivo
    const gymInf = objetivoGym === 'potencia' ? 'GYM_POTENCIA' : 'GYM_FUERZA_INF';
    const gymSup = objetivoGym === 'potencia' ? 'GYM_POTENCIA' : 'GYM_FUERZA_SUP';

    // Distribuir semana base según disponibilidad
    // Reglas fijas: partido, post-partido (RECUPERACION), pre-partido (ACTIVACION_PRE)
    // Días restantes se llenan con equipo y gym alternados
    const diaPostPartido = (diaPartido + 1) % 7;
    const diaDescanso    = parseInt(onboarding?.diaDescanso || '-1', 10);
    // Si descanso coincide con pre-partido, mover activación 2 días antes
    const diaPrePartido  = (diaDescanso >= 0 && diaDescanso === (diaPartido + 6) % 7)
        ? (diaPartido + 5) % 7
        : (diaPartido + 6) % 7;

    // Construir mapa de días

    function buildWeekMap(w) {
        const isTorneoWeek = obj.torneoSemanas && obj.torneoSemanas.includes(w + 1);
        const isDescarga   = [4, 8, 12, 16].includes(w + 1);
        const map = {};

        // Fijos — orden de prioridad: partido > recuperacion > descanso > activacion
        map[diaPartido]     = 'PARTIDO';
        map[diaPostPartido] = 'RECUPERACION';
        if (diaDescanso >= 0) map[diaDescanso] = 'DESCANSO';   // descanso siempre gana
        if (!map[diaPrePartido]) map[diaPrePartido] = 'ACTIVACION_PRE'; // solo si libre

        if (isTorneoWeek) {
            // Semana de torneo: solo prevención y activación (respetando descanso)
            for (let d = 0; d < 7; d++) {
                if (!map[d]) map[d] = d % 2 === 0 ? 'GYM_PREVENCION' : 'RECUPERACION';
            }
            return map;
        }

        // Días libres — excluir diaDescanso ya marcado
        const libres = [];
        for (let d = 0; d < 7; d++) { if (!map[d]) libres.push(d); }

        // Equipo — usar días específicos si están definidos, sino primeros libres
        const equipoPattern = ['EQUIPO_TACTICO', 'EQUIPO_FISICO', 'EQUIPO_TACTICO', 'EQUIPO_FISICO'];
        if (diasEquipoEsp) {
            diasEquipoEsp.forEach((dow, i) => {
                if (!map[dow]) map[dow] = equipoPattern[i % equipoPattern.length];
            });
        } else {
            let equipoCount = 0;
            libres.forEach(d => {
                if (equipoCount < diasEquipo) {
                    map[d] = equipoPattern[equipoCount % equipoPattern.length];
                    equipoCount++;
                }
            });
        }

        // Gym en lo que queda (máx diasGym) — nunca sobreescribir DESCANSO elegido
        let gymCount = 0;
        const gymPattern = isDescarga
            ? ['GYM_PREVENCION', 'GYM_PREVENCION']
            : [gymInf, gymSup, 'GYM_PREVENCION', gymInf];

        for (let d = 0; d < 7; d++) {
            // Respetar día de descanso elegido por el usuario
            if (map[d] === 'DESCANSO') continue;
            if (!map[d] && gymCount < diasGym) {
                map[d] = gymPattern[gymCount % gymPattern.length];
                gymCount++;
            }
        }

        // Resto: descanso
        for (let d = 0; d < 7; d++) { if (!map[d]) map[d] = 'DESCANSO'; }
        return map;
    }

    const plan = [];
    let sessionId = 1;

    for (let w = 0; w < obj.duracionSemanas; w++) {
        const weekMap = buildWeekMap(w);
        let fase = 'MES 1 — ADAPTACIÓN DUAL';
        if (obj.fases) {
            for (const f of obj.fases) {
                if (w + 1 >= f.semanas[0] && w + 1 <= f.semanas[1]) {
                    fase = 'MES ' + f.num + ' — ' + f.nombre.toUpperCase();
                    break;
                }
            }
        }

        // Series/reps según fase
        let series = 3, reps = '10-12';
        const mes = parseInt(fase.match(/MES (\d+)/)?.[1] || '1');
        if (mes === 1) { series = 3; reps = '10-12'; }
        if (mes === 2) { series = 4; reps = '8-10'; }
        if (mes === 3) { series = 4; reps = '6-8'; }
        if (mes === 4) { series = 3; reps = '5-6'; }
        if (nivel === 'principiante') series = Math.max(2, series - 1);

        for (let d = 0; d < 7; d++) {
            const fecha    = _addDays(PLAN_START_DATE, w * 7 + d);
            const dow      = new Date(fecha + 'T12:00:00').getDay(); // 0=Dom…6=Sáb
            const escenario = weekMap[dow] || 'DESCANSO';
            const ejs      = [...(ESCENARIOS[escenario]?.ejercicios || [])];
            const detailed = ejs.map(c => ({ cod: c, series, reps }));
            plan.push({ id: sessionId++, fecha, semana: w + 1, fase, escenario, ejs_cods: detailed,
                        esGym: escenario.startsWith('GYM_'),
                        esEquipo: escenario.startsWith('EQUIPO_') });
        }
    }
    return plan;
}

