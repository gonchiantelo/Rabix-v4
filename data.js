'use strict';

/* ============================================================
   RABIX V4 — Data Engine
   Biblioteca · Objetivos · Planificación · Pesos · Escenarios
   ============================================================ */

const RABIX_VERSION = 'V4.0';
const PLAN_START_DATE = '2026-03-16';

/* ============================================================
   OBJETIVOS DE ENTRENAMIENTO — 6 perfiles
   ============================================================ */
const OBJETIVOS_DISPONIBLES = [
    {
        id: 'ALTO_RENDIMIENTO',
        label: 'Alto Rendimiento',
        emoji: '⚡',
        color: '#00c8ff',
        desc: 'Fuerza, potencia y técnica de campo. Para atletas competitivos.',
        rpeYellow: 7.1, rpeRed: 8.5,
        duracionSemanas: 17,
        dayScenario: {
            1: 'FUERZA_PIERNA_B', 2: 'FUERZA_TREN_SUP',
            3: 'HIPERTROFIA_INF', 4: 'HIPERTROFIA_SUP',
            5: 'PREVENCION', 6: 'PARTIDO', 0: 'RECUPERACION'
        },
        fases: [
            { num: 1, nombre: 'Acumulación', color: '#22c55e', semanas: [1, 4] },
            { num: 2, nombre: 'Intensificación', color: '#3b82f6', semanas: [5, 8] },
            { num: 3, nombre: 'Transformación', color: '#f59e0b', semanas: [9, 12] },
            { num: 4, nombre: 'Pico Competitivo', color: '#ef4444', semanas: [13, 17] },
        ],
        metricaLabel: 'Vol. Semanal',
    },
    {
        id: 'MASA_MUSCULAR',
        label: 'Masa Muscular',
        emoji: '💪',
        color: '#8b5cf6',
        desc: 'Hipertrofia progresiva. Más volumen, más músculo.',
        rpeYellow: 7.5, rpeRed: 9.0,
        duracionSemanas: 16,
        dayScenario: {
            1: 'MASA_PIERNAS', 2: 'MASA_EMPUJE',
            3: 'MASA_TRACCION', 4: 'MASA_HOMBROS_BRAZOS',
            5: 'MASA_PIERNAS_B', 6: 'DESCANSO', 0: 'RECUPERACION'
        },
        fases: [
            { num: 1, nombre: 'Base Hipertrófica', color: '#8b5cf6', semanas: [1, 4] },
            { num: 2, nombre: 'Acumulación de Volumen', color: '#7c3aed', semanas: [5, 9] },
            { num: 3, nombre: 'Intensificación', color: '#6d28d9', semanas: [10, 13] },
            { num: 4, nombre: 'Descarga y Consolidación', color: '#5b21b6', semanas: [14, 16] },
        ],
        metricaLabel: 'Tonelaje',
    },
    {
        id: 'PERDIDA_PESO',
        label: 'Pérdida de Peso',
        emoji: '🔥',
        color: '#f97316',
        desc: 'Cardio + fuerza para quemar grasa y mantener músculo.',
        rpeYellow: 6.5, rpeRed: 8.0,
        duracionSemanas: 12,
        dayScenario: {
            1: 'CARDIO_FUERZA', 2: 'HIIT',
            3: 'CARDIO_FUERZA', 4: 'DESCANSO',
            5: 'CARDIO_FUERZA', 6: 'CARDIO_LARGO', 0: 'RECUPERACION'
        },
        fases: [
            { num: 1, nombre: 'Activación Metabólica', color: '#fb923c', semanas: [1, 3] },
            { num: 2, nombre: 'Quema de Grasa', color: '#f97316', semanas: [4, 8] },
            { num: 3, nombre: 'Definición Final', color: '#ea580c', semanas: [9, 12] },
        ],
        metricaLabel: 'Sesiones',
    },
    {
        id: 'DEFINICION',
        label: 'Definición',
        emoji: '🎯',
        color: '#06b6d4',
        desc: 'Mantener músculo mientras se reduce el porcentaje graso.',
        rpeYellow: 7.0, rpeRed: 8.5,
        duracionSemanas: 12,
        dayScenario: {
            1: 'DEF_TREN_INF', 2: 'DEF_TREN_SUP',
            3: 'CARDIO_LARGO', 4: 'DEF_TREN_INF',
            5: 'DEF_TREN_SUP', 6: 'HIIT', 0: 'DESCANSO'
        },
        fases: [
            { num: 1, nombre: 'Adaptación', color: '#06b6d4', semanas: [1, 3] },
            { num: 2, nombre: 'Definición Progresiva', color: '#0891b2', semanas: [4, 9] },
            { num: 3, nombre: 'Corte Final', color: '#0e7490', semanas: [10, 12] },
        ],
        metricaLabel: 'Cardio (min)',
    },
    {
        id: 'AEROBICO',
        label: 'Capacidad Aeróbica',
        emoji: '🌊',
        color: '#10b981',
        desc: 'Máxima resistencia cardiovascular. VO2max y resistencia.',
        rpeYellow: 7.0, rpeRed: 8.5,
        duracionSemanas: 14,
        dayScenario: {
            1: 'CARDIO_LARGO', 2: 'FUERZA_BASE',
            3: 'INTERVALOS', 4: 'RECUPERACION',
            5: 'CARDIO_LARGO', 6: 'HIIT', 0: 'DESCANSO'
        },
        fases: [
            { num: 1, nombre: 'Base Aeróbica', color: '#34d399', semanas: [1, 4] },
            { num: 2, nombre: 'Desarrollo VO2max', color: '#10b981', semanas: [5, 9] },
            { num: 3, nombre: 'Pico Aeróbico', color: '#059669', semanas: [10, 14] },
        ],
        metricaLabel: 'Min Cardio',
    },
    {
        id: 'FUERZA_PURA',
        label: 'Fuerza Pura',
        emoji: '🏋️',
        color: '#ef4444',
        desc: 'Powerlifting-inspired. Squat, Bench, Deadlift. Máxima fuerza.',
        rpeYellow: 8.0, rpeRed: 9.5,
        duracionSemanas: 16,
        dayScenario: {
            1: 'FUERZA_SQUAT', 2: 'FUERZA_BENCH',
            3: 'DESCANSO', 4: 'FUERZA_DEAD',
            5: 'FUERZA_ACCESORIO', 6: 'DESCANSO', 0: 'DESCANSO'
        },
        fases: [
            { num: 1, nombre: 'Técnica y Base', color: '#fca5a5', semanas: [1, 4] },
            { num: 2, nombre: 'Fuerza Máxima', color: '#f87171', semanas: [5, 9] },
            { num: 3, nombre: 'Intensificación', color: '#ef4444', semanas: [10, 13] },
            { num: 4, nombre: 'Pico y Test 1RM', color: '#dc2626', semanas: [14, 16] },
        ],
        metricaLabel: '1RM estimado',
    },
];

/* ============================================================
   BIBLIOTECA: EJERCICIOS BASE (34 ejercicios + 20 nuevos)
   ============================================================ */
const EJERCICIOS = [
    { cod: 1, nombre: 'Press Banca', patron: 'Empuje Horizontal', grupo: 'Pectoral', fatiga: 2, dia: 'Martes', activo: true },
    { cod: 2, nombre: 'Sentadilla con Pausa', patron: 'Dominante Rodilla', grupo: 'Piernas', fatiga: 3, dia: 'Lunes', activo: true },
    { cod: 3, nombre: 'Remo con Barra', patron: 'Tracción Horizontal', grupo: 'Espalda', fatiga: 2, dia: 'Martes', activo: true },
    { cod: 4, nombre: 'Press Militar', patron: 'Empuje Vertical', grupo: 'Hombros', fatiga: 2, dia: 'Jueves', activo: true },
    { cod: 5, nombre: 'Dominadas', patron: 'Tracción Vertical', grupo: 'Espalda', fatiga: 2, dia: 'Jueves', activo: true },
    { cod: 6, nombre: 'Sentadilla', patron: 'Dominante Rodilla', grupo: 'Piernas', fatiga: 3, dia: 'Lunes', activo: true },
    { cod: 7, nombre: 'Peso Muerto Convencional', patron: 'Dominante Cadera', grupo: 'Piernas / Espalda', fatiga: 3, dia: 'Lunes', activo: true },
    { cod: 8, nombre: 'Hip Thrust', patron: 'Dominante Cadera', grupo: 'Piernas', fatiga: 2, dia: 'Lunes', activo: true },
    { cod: 9, nombre: 'Estocadas con Mancuernas', patron: 'Dominante Rodilla', grupo: 'Piernas', fatiga: 2, dia: 'Miércoles', activo: true },
    { cod: 10, nombre: 'Banco de Cuádriceps', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 11, nombre: 'Banco de Isquiotibiales', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 12, nombre: 'Peso Muerto Hexagonal', patron: 'Dominante Cadera', grupo: 'Piernas', fatiga: 3, dia: 'Lunes', activo: true },
    { cod: 13, nombre: 'Press Banca Inclinado', patron: 'Empuje Horizontal', grupo: 'Pectoral', fatiga: 2, dia: 'Jueves', activo: true },
    { cod: 14, nombre: 'Aperturas en Máquina', patron: 'Aislamiento', grupo: 'Pectoral', fatiga: 1, dia: 'Jueves', activo: true },
    { cod: 15, nombre: 'Remo en T (Seal Row)', patron: 'Tracción Horizontal', grupo: 'Espalda', fatiga: 2, dia: 'Jueves', activo: true },
    { cod: 16, nombre: 'Pull Over con Mancuerna', patron: 'Tracción Vertical', grupo: 'Espalda', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 17, nombre: 'Jalón a Dos Brazos', patron: 'Tracción Vertical', grupo: 'Espalda', fatiga: 2, dia: 'Jueves', activo: true },
    { cod: 18, nombre: 'Martillo (Bíceps)', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 19, nombre: 'Fondos (Tríceps)', patron: 'Brazos', grupo: 'Brazos', fatiga: 2, dia: 'Martes', activo: true },
    { cod: 20, nombre: 'Extensión Polea Tríceps', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 21, nombre: 'Bíceps en Polea', patron: 'Brazos', grupo: 'Brazos', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 22, nombre: 'Vuelos Laterales', patron: 'Aislamiento', grupo: 'Hombros', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 23, nombre: 'Press Hombro + Iso', patron: 'Empuje Vertical', grupo: 'Brazos / Hombros', fatiga: 2, dia: 'Martes', activo: true },
    { cod: 24, nombre: 'Face-Pull', patron: 'Tracción Horizontal', grupo: 'Espalda / Hombros', fatiga: 1, dia: 'Viernes', activo: true },
    { cod: 25, nombre: 'Banco de Gemelos', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 26, nombre: 'Aductores en Máquina', patron: 'Aislamiento', grupo: 'Piernas', fatiga: 1, dia: 'Miércoles', activo: true },
    { cod: 27, nombre: 'Copenhagen Plank', patron: 'Core', grupo: 'Core', fatiga: 2, dia: 'Lunes / Jueves', activo: true },
    { cod: 28, nombre: 'Dead Bug (Bicho Muerto)', patron: 'Core', grupo: 'Core', fatiga: 1, dia: 'Miércoles / Viernes', activo: true },
    { cod: 29, nombre: 'Plancha Toque Hombro', patron: 'Core', grupo: 'Core', fatiga: 2, dia: 'Martes', activo: true },
    { cod: 30, nombre: 'Dominadas Neutras Lastre', patron: 'Tracción Vertical', grupo: 'Espalda', fatiga: 3, dia: 'Jueves', activo: true },
    { cod: 31, nombre: 'Slalom de Precisión', patron: 'Técnica', grupo: 'Campo', fatiga: 1, dia: 'Sábado', activo: true },
    { cod: 32, nombre: 'Control y Giro (Conce)', patron: 'Técnica', grupo: 'Campo', fatiga: 1, dia: 'Sábado', activo: true },
    { cod: 33, nombre: 'Remate tras Demarque', patron: 'Técnica', grupo: 'Campo', fatiga: 2, dia: 'Sábado', activo: true },
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
    FUERZA_PIERNA_B:  { label: 'FUERZA PIERNAS',      emoji: '🏋️', color: '#3b82f6', ejercicios: [6, 7, 8, 12, 27] },
    FUERZA_TREN_SUP:  { label: 'FUERZA TREN SUP',     emoji: '💪', color: '#8b5cf6', ejercicios: [1, 3, 13, 17, 30, 29] },
    HIPERTROFIA_INF:  { label: 'HIPERTROFIA INF',     emoji: '🦵', color: '#06b6d4', ejercicios: [9, 10, 11, 25, 26, 28] },
    HIPERTROFIA_SUP:  { label: 'HIPERTROFIA SUP',     emoji: '🔝', color: '#10b981', ejercicios: [13, 14, 15, 23, 24, 27] },
    PREVENCION:       { label: 'PREVENCIÓN',           emoji: '🛡️', color: '#f59e0b', ejercicios: [24, 22, 16, 18, 28] },
    RECUPERACION:     { label: 'RECUPERACIÓN',         emoji: '💚', color: '#22c55e', ejercicios: [34, 28, 24] },
    PARTIDO:          { label: 'PARTIDO',              emoji: '⚽', color: '#ef4444', ejercicios: [] },
    AMISTOSO:         { label: 'AMISTOSO',             emoji: '⚽', color: '#f97316', ejercicios: [31, 32, 33] },
    TECNICA:          { label: 'TÉCNICA',              emoji: '🎯', color: '#a78bfa', ejercicios: [31, 32, 33] },
    DESCANSO:         { label: 'DESCANSO',             emoji: '😴', color: '#6b7280', ejercicios: [] },

    /* ── Masa Muscular ── */
    MASA_PIERNAS:         { label: 'MASA PIERNAS A',      emoji: '🦵', color: '#7c3aed', ejercicios: [6, 2, 8, 10, 11, 25] },
    MASA_EMPUJE:          { label: 'MASA EMPUJE',         emoji: '💪', color: '#8b5cf6', ejercicios: [1, 13, 42, 4, 23, 19] },
    MASA_TRACCION:        { label: 'MASA TRACCIÓN',       emoji: '🔝', color: '#6d28d9', ejercicios: [5, 3, 17, 44, 15, 16] },
    MASA_HOMBROS_BRAZOS:  { label: 'HOMBROS & BRAZOS',   emoji: '💪', color: '#5b21b6', ejercicios: [4, 45, 22, 24, 46, 20, 47] },
    MASA_PIERNAS_B:       { label: 'MASA PIERNAS B',      emoji: '🏋️', color: '#7c3aed', ejercicios: [7, 41, 43, 9, 49, 26] },

    /* ── Pérdida de Peso / Definición ── */
    CARDIO_FUERZA:    { label: 'CARDIO + FUERZA',     emoji: '🔥', color: '#f97316', ejercicios: [35, 40, 9, 39, 29, 51] },
    HIIT:             { label: 'HIIT',                 emoji: '⚡', color: '#ef4444', ejercicios: [36, 38, 39, 53, 51, 52] },
    CARDIO_LARGO:     { label: 'CARDIO LARGO',         emoji: '🌊', color: '#06b6d4', ejercicios: [35, 37, 48, 54] },
    DEF_TREN_INF:     { label: 'DEFINICIÓN INF',       emoji: '🎯', color: '#0891b2', ejercicios: [6, 9, 43, 10, 11, 25, 51] },
    DEF_TREN_SUP:     { label: 'DEFINICIÓN SUP',       emoji: '🎯', color: '#0891b2', ejercicios: [1, 3, 5, 22, 24, 50, 29] },

    /* ── Aeróbico ── */
    INTERVALOS:       { label: 'INTERVALOS',           emoji: '🌊', color: '#10b981', ejercicios: [36, 35, 38, 53] },
    FUERZA_BASE:      { label: 'FUERZA BASE',          emoji: '💪', color: '#059669', ejercicios: [6, 1, 3, 27, 28] },

    /* ── Fuerza Pura ── */
    FUERZA_SQUAT:     { label: 'DÍA SQUAT',            emoji: '🏋️', color: '#ef4444', ejercicios: [6, 2, 43, 10, 27] },
    FUERZA_BENCH:     { label: 'DÍA BENCH',            emoji: '🏋️', color: '#dc2626', ejercicios: [1, 13, 42, 19, 47] },
    FUERZA_DEAD:      { label: 'DÍA DEADLIFT',         emoji: '🏋️', color: '#b91c1c', ejercicios: [7, 12, 41, 11, 27] },
    FUERZA_ACCESORIO: { label: 'ACCESORIOS FUERZA',    emoji: '💪', color: '#991b1b', ejercicios: [5, 30, 23, 46, 20, 50] },
};

/* ============================================================
   MOVILIDAD ARTICULAR
   ============================================================ */
const MOVILIDAD_ARTICULAR = [
    { id: 'm1', nombre: 'Rotaciones de Cadera',    emoji: '🔄', duracion: 45, descripcion: '15 seg c/lado — círculos amplios en posición de pie',              grupo: 'Cadera / Glúteo' },
    { id: 'm2', nombre: 'Péndulo de Hombro',       emoji: '🌀', duracion: 30, descripcion: 'Brazo relajado, círculos hacia adelante y atrás, c/lado',           grupo: 'Hombro / Manguito' },
    { id: 'm3', nombre: 'Movilidad de Tobillo',    emoji: '🦶', duracion: 40, descripcion: 'Círculos + dorsiflexión activa contra pared, c/lado',               grupo: 'Tobillo / Pierna' },
    { id: 'm4', nombre: 'Rotación Torácica',       emoji: '🌪️', duracion: 40, descripcion: '10 reps c/lado — desde 4 apoyos, columna neutra',                  grupo: 'Columna Torácica' },
    { id: 'm5', nombre: 'Apertura de Cadera 90-90',emoji: '🧘', duracion: 60, descripcion: '30 seg c/lado — posición 90-90 en el suelo',                        grupo: 'Cadera / Aductores' },
    { id: 'm6', nombre: 'Roll de Columna',         emoji: '🐛', duracion: 30, descripcion: 'De pie: flexión vertebral segmentada lenta, 5 reps',                grupo: 'Columna / Isquios' },
];

const USER_EMOJIS = ['⚡', '🦸', '💪', '🏃', '🦊', '🐺', '🦅', '🏋️', '🌊', '🔥', '🎯', '⚽', '🥊', '🏆', '🦁', '🐉'];

const DIA_DOBLE_OPTIONS = [
    { key: 'REPETIR',      label: 'Repetir sesión',        emoji: '🔁', desc: 'Los mismos ejercicios del día' },
    { key: 'AMISTOSO',     label: 'Club / Amistoso',       emoji: '⚽', desc: 'Técnica de campo liviana' },
    { key: 'RECUPERACION', label: 'Recuperación activa',   emoji: '💚', desc: 'Trote + movilidad, RPE máx 5' },
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
        for (let d = 0; d < 7; d++) {
            const fecha = _addDays(PLAN_START_DATE, w * 7 + d);
            const dow = new Date(fecha + 'T12:00:00').getDay();
            const escenario = obj.dayScenario[dow] || 'DESCANSO';
            const ejs = [...(ESCENARIOS[escenario]?.ejercicios || [])];
            let fase = 'FASE 1';
            if (obj.fases) {
                for (const f of obj.fases) {
                    if (w + 1 >= f.semanas[0] && w + 1 <= f.semanas[1]) {
                        fase = `MES ${f.num} — ${f.nombre.toUpperCase()}`;
                        break;
                    }
                }
            }
            plan.push({ id: sessionId++, fecha, semana: w + 1, fase, escenario, ejs_cods: ejs });
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
