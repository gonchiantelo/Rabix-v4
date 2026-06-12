'use strict';

/* ============================================================
   RAVIX V5 — DT ENGINE (app-dt.js)
   Phase 3.8: Navegación Anual & Bloques Ocultos (Completo)
   ============================================================ */

// ═══════════════════════════════════════════════════════
// SEASON PLANNING MODAL ENGINE
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// PREDEFINED OBJECTIVES DICTIONARY
// ═══════════════════════════════════════════════════════
const predefinedObjectives = [
    'Volumen Aeróbico', 'Fuerza Base', 'Fuerza Explosiva', 'Hipertrofia Funcional',
    'Pliometría', 'Velocidad Lineal', 'Agilidad y Cambio de Dirección', 'Movilidad y Flexibilidad',
    'Resistencia Específica', 'Recuperación Activa', 'Pico de Rendimiento', 'Control de Carga',
    'Afinación Táctica', 'Ataque Organizado', 'Defensa Organizada',
    'Transición Defensiva', 'Transición Ofensiva', 'Pelota Parada (ABP)',
    'Cohesión Táctica', 'Automatismos', 'Estrategia Rival', 'Gestión Psicológica',
    'Evaluación de Temporada', 'Planificación Siguiente Ciclo'
];

// ═══════════════════════════════════════════════════════
// SEASON PLANNING MODAL ENGINE
// ═══════════════════════════════════════════════════════
window.SeasonPlanningModal = {

    // --- Internal: Add a tag chip to a container ---
    _addTag: function (containerId, text) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const normalized = text.trim();
        if (!normalized) return;
        // Prevent duplicates
        const existing = Array.from(container.querySelectorAll('.ravix-tag-text')).map(el => el.textContent);
        if (existing.includes(normalized)) return;

        const chip = document.createElement('span');
        chip.className = 'ravix-tag';
        chip.innerHTML = `<span class="ravix-tag-text">${normalized}</span><button type="button" class="ravix-tag-remove" onclick="this.parentElement.remove()" title="Eliminar">×</button>`;
        container.appendChild(chip);
    },

    // --- Internal: Read all tag texts from a container ---
    _getTags: function (containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];
        return Array.from(container.querySelectorAll('.ravix-tag-text')).map(el => el.textContent.trim()).filter(Boolean);
    },

    // --- Internal: Clear and repopulate a tag container from array ---
    _renderTags: function (containerId, tagsArray) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        (tagsArray || []).forEach(tag => this._addTag(containerId, tag));
    },

    // --- Internal: Handle tag input keydown/selection ---
    _handleTagInput: function (inputId, containerId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const val = input.value.trim();
        if (!val) return;
        this._addTag(containerId, val);
        input.value = '';
        input.focus();
    },

    open: function () {
        const per = window.DTEngine._periodization;
        if (!per) return;

        const inp = (id) => document.getElementById(id);
        if (inp('spm-temporada')) inp('spm-temporada').value = per.macrociclo || '';

        const keys = ['pre', 'comp', 'playoffs', 'trans'];
        per.fases.forEach(function (fase, i) {
            const key = keys[i];
            if (!key) return;
            if (inp('spm-' + key + '-start')) inp('spm-' + key + '-start').value = fase.start || '';
            if (inp('spm-' + key + '-end')) inp('spm-' + key + '-end').value = fase.end || '';
            // Render tag chips from stored array
            window.SeasonPlanningModal._renderTags('spm-' + key + '-tags', fase.objetivos || []);
        });

        const modal = document.getElementById('modal-season-planning');
        if (modal) {
            modal.classList.remove('hidden');
            requestAnimationFrame(() => modal.classList.add('spm-visible'));
        }
    },

    close: function () {
        const modal = document.getElementById('modal-season-planning');
        if (modal) {
            modal.classList.remove('spm-visible');
            setTimeout(() => modal.classList.add('hidden'), 250);
        }
    },

    save: async function () {
        const teamId = window.CurrentTeam?.id || localStorage.getItem('ravix_team_id');
        if (!teamId) { console.warn('SeasonPlanningModal.save: no teamId'); return; }

        const per = window.DTEngine._periodization;
        if (!per) return;

        const inp = (id) => document.getElementById(id)?.value.trim();
        const keys = ['pre', 'comp', 'playoffs', 'trans'];

        // Mutate _periodization in place
        per.macrociclo = inp('spm-temporada') || per.macrociclo;
        keys.forEach((key, i) => {
            if (!per.fases[i]) return;
            per.fases[i].start = inp('spm-' + key + '-start') || per.fases[i].start;
            per.fases[i].end = inp('spm-' + key + '-end') || per.fases[i].end;
            // Read objetivos from tag chips in DOM
            per.fases[i].objetivos = window.SeasonPlanningModal._getTags('spm-' + key + '-tags');
        });

        const payload = {
            macrociclo: per.macrociclo,
            fases: per.fases.map(f => ({
                name: f.name,
                color: f.color,
                start: f.start,
                end: f.end,
                objetivos: f.objetivos
            }))
        };

        console.log('💾 Guardando Planificación Anual:', payload);

        const { error } = await window.supabase
            .from('team_configs')
            .update({ season_planning: payload })
            .eq('team_id', teamId);

        if (error) {
            console.error('Error al guardar season_planning:', error.message);
            return;
        }

        if (window.CurrentTeam) window.CurrentTeam.season_planning = payload;

        window.DTEngine.Periodization.renderTimeline();
        window.DTEngine.Periodization.renderProcessView();

        this.close();
        console.log('✅ Planificación guardada y UI actualizada.');
    }
};


window.DTEngine = {
    _currentDate: new Date(), // Inicialización dinámica
    _matchDays: new Set(),
    _manualLabels: {},   // { "YYYY-MM-DD": "MD-4" }
    _assignedTasks: {},  // { "YYYY-MM-DD": [ { logId, id, block } ] }
    _exercises: [],
    _selectedDate: null,
    _showAllExercises: false,
    _dayActivities: [],  // Actividades temporales del día seleccionado
    _stagedLabel: null,  // Etiqueta pendiente de confirmar (Lazy Execution)
    _charts: {}, // Almacén para instancias de Chart.js
    _calendarView: 'weekly', // 'weekly' | 'process'
    _periodization: null, // { macrociclo, fases: [{name, start, end, objetivos}], fase_actual_idx }

    async fetchMonthLogs() {
        let dateToUse = this._currentDate;
        if (!(dateToUse instanceof Date) || isNaN(dateToUse.getTime())) {
            dateToUse = new Date();
            this._currentDate = dateToUse;
        }

        const year = dateToUse.getFullYear();
        const monthNum = dateToUse.getMonth() + 1;
        const monthStr = String(monthNum).padStart(2, '0');
        const lastDay = new Date(year, monthNum, 0).getDate();
        const lastDayStr = String(lastDay).padStart(2, '0');

        // ── RESOLUCIÓN DE teamId (3 capas de fallback) ─────────────────────
        const teamId = window.CurrentTeam?.id
            || localStorage.getItem('ravix_team_id')
            || window.CurrentUser?.team_id;
        const token = localStorage.getItem('ravix_token');

        console.log('🔑 fetchMonthLogs → teamId:', teamId, '| token:', token ? '✅' : '❌ FALTA');

        if (!teamId || !token) {
            console.warn('⚠️ fetchMonthLogs: Sin teamId o token. Abortando. CurrentTeam:', window.CurrentTeam);
            return;
        }

        // Recuperar Configuración del Morfociclo (Match Days)
        await this.fetchTeamConfig();

        try {
            if (isNaN(year) || isNaN(monthNum)) {
                console.warn('⚠️ fetchMonthLogs: Fecha inválida (NaN). Abortando fetch para evitar Error 400.');
                return;
            }

            let startDate = `${year}-${monthStr}-01`.substring(0, 10);
            let endDate = `${year}-${monthStr}-${lastDayStr}`.substring(0, 10);

            console.log("Fechas de consulta principal:", startDate, endDate);

            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
                console.warn("Fetch mensual cancelado por formato de fecha inválido:", startDate, endDate);
                return;
            }

            const [{ data, error }, { data: customData }, { data: sessionData }] = await Promise.all([
                window.supabase.from('training_logs').select('*').eq('team_id', teamId).gte('fecha', startDate).lte('fecha', endDate),
                window.supabase.from('custom_exercises').select('*'),
                window.supabase.from('microcycle_sessions').select('*').eq('team_id', teamId).gte('fecha', startDate).lte('fecha', endDate)
            ]);

            this._microcycleSessions = {};
            if (sessionData) {
                sessionData.forEach(s => {
                    this._microcycleSessions[s.fecha] = s;
                });
            }

            if (customData) {
                window.CustomExercises = customData.map(ex => ({ ...ex, numericId: ex.id, isCustom: true }));
                console.log("🔒 Bóveda de tareas personalizadas cargada:", customData);
            }

            // ── DIAGNÓSTICO FASE 1 ──────────────────────────────────────────
            console.log('📅 Datos de training_logs recibidos:', data);
            if (error) console.error('❌ Error en training_logs:', error);

            if (error) throw error;

            this._assignedTasks = {};
            if (data && Array.isArray(data)) {
                data.forEach(log => {
                    if (!log.fecha) return;

                    // Escáner de Partidos automático
                    const isMatchLog = log.type === 'Partido' || log.title === 'Partido' || log.tipo === 'Partido' || log.block === 'Partido';
                    if (isMatchLog) {
                        this._matchDays.add(log.fecha);
                    }

                    if (!this._assignedTasks[log.fecha]) this._assignedTasks[log.fecha] = [];

                    // ejs_cods puede ser: string, number, UUID string, o array de los anteriores
                    const rawCods = Array.isArray(log.ejs_cods) ? log.ejs_cods : [log.ejs_cods];

                    rawCods.forEach(rawId => {
                        if (rawId == null) return;

                        // Intentar parsear como entero (ID numérico legacy)
                        const numericAttempt = parseInt(String(rawId).replace(/\D/g, ''), 10);

                        this._assignedTasks[log.fecha].push({
                            logId: log.id,
                            id: isNaN(numericAttempt) ? rawId : numericAttempt,
                            rawId: rawId,       // Guardar el original para matching por UUID
                            block: log.scenario || log.block || 'parte_principal'
                        });
                    });
                });

                // ── DIAGNÓSTICO FASE 1b ─────────────────────────────────────
                const totalTasks = Object.values(this._assignedTasks).reduce((acc, arr) => acc + arr.length, 0);
                console.log(`📅 _assignedTasks mapeados: ${Object.keys(this._assignedTasks).length} días, ${totalTasks} tareas totales`);
                const sampleDate = Object.keys(this._assignedTasks)[0];
                if (sampleDate) {
                    console.log(`📅 Muestra [${sampleDate}]:`, this._assignedTasks[sampleDate]);
                }
                // ─────────────────────────────────────────────────────────────
            }
        } catch (e) { console.error('Error al cargar planificación:', e); }
    },


    async fetchTeamConfig() {
        const teamId = window.CurrentTeam?.id;
        if (!teamId) return;

        // Priorizar memoria de App Core (window.CurrentTeam) para match_dates
        if (window.CurrentTeam && window.CurrentTeam.match_dates) {
            this._matchDays = new Set(window.CurrentTeam.match_dates);
        }

        try {
            const { data, error } = await window.supabase.from('team_configs').select('*').eq('team_id', teamId);
            if (error) throw error;
            if (data && data[0]) {
                if (data[0].match_dates) {
                    this._matchDays = new Set(data[0].match_dates);
                }
                // Load season_planning JSON into _periodization
                if (data[0].season_planning && data[0].season_planning.fases) {
                    const sp = data[0].season_planning;
                    // Merge stored fases with default colors/names if missing
                    const defaultPhases = window.DTEngine.Periodization._defaultPhases;
                    const mergedFases = sp.fases.map(function (f, i) {
                        const def = defaultPhases[i] || {};
                        return {
                            name: f.name || def.name,
                            color: f.color || def.color || '#00F2FE',
                            start: f.start || '',
                            end: f.end || '',
                            objetivos: Array.isArray(f.objetivos) ? f.objetivos : (def.objetivos || []),
                            completed: f.completed || false
                        };
                    });
                    window.DTEngine._periodization = {
                        macrociclo: sp.macrociclo || ('Temporada ' + new Date().getFullYear()),
                        fases: mergedFases,
                        fase_actual_idx: 0
                    };
                    if (window.CurrentTeam) window.CurrentTeam.season_planning = sp;
                    console.log('📅 season_planning cargado desde Supabase');
                }
            }
            // Sincronizar estado global
            if (window.CurrentTeam) {
                window.CurrentTeam.match_dates = Array.from(this._matchDays);
            }
        } catch (e) { console.error('Error al cargar configuración de equipo:', e); }
    },

    changeMonth(e, offset) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        // Navegación pura: solo actualizar grilla, NO reconstruir el shell
        const nextDate = new Date(this._currentDate);
        nextDate.setMonth(nextDate.getMonth() + offset);
        this._currentDate = nextDate;

        // Actualizar solo el texto del mes visible
        const monthDisplay = document.querySelector('.current-month-display');
        if (monthDisplay) {
            monthDisplay.textContent = this._currentDate.toLocaleString('es', { month: 'long', year: 'numeric' }).toUpperCase();
        }

        // Re-fetch y re-pintar solo la grilla del calendario
        this.fetchMonthLogs().then(() => {
            this.generateCalendar();
        });
    },


    async renderDashboard() {
        const shell = document.getElementById('app-shell');
        if (!shell) return;

        const monthName = this._currentDate.toLocaleString('es', { month: 'long', year: 'numeric' }).toUpperCase();

        const teamName = window.CurrentTeam ? window.CurrentTeam.name : 'Equipo no asignado';

        shell.innerHTML = `
            <div class="dt-shell-container">
                <header class="app-header">
                    <div class="brand-name">RAVIX <span class="team-name-badge">${teamName}</span> <span class="dt-badge">DT ELITE</span></div>

                    <div class="header-actions" style="display: flex; gap: 32px; align-items: center;">
                        <button onclick="window.location.hash = '#portal';" class="dt-nav-link dt-portal-btn">← Portal del Manager</button>
                        
                        <nav class="dt-main-nav">
                            <button id="btn-nav-home" onclick="DTEngine.toggleView('home')" class="dt-nav-link">Inicio</button>
                            <button id="btn-nav-calendar" onclick="DTEngine.toggleView('calendar')" class="dt-nav-link">Calendario</button>
                            <button id="btn-nav-analytics" onclick="DTEngine.toggleView('analytics')" class="dt-nav-link">Analítica</button>
                            <button id="btn-nav-board" onclick="if(window.DTEngine) window.DTEngine.toggleView('board')" class="dt-nav-link">Pizarra</button>
                        </nav>

                        <button onclick="App.logout()" class="dt-nav-link dt-nav-logout">Salir</button>
                    </div>
                </header>

                <main class="dt-main-content">
                    <section id="dt-home-view" class="dt-home-view view-section">
                        <!-- Header/Identity (Widget B) -->
                        <div class="platinum-widget profile-widget-compact" onclick="window.DTEngine.toggleView('profile')" style="cursor: pointer; grid-column: span 4;">
                            <div class="pw-content-compact">
                                <div class="dt-avatar-ring-compact">
                                    <div class="dt-avatar-inner"></div>
                                </div>
                                <div class="dt-info-compact">
                                    <h2 class="dt-name-compact" style="font-family: 'Outfit', sans-serif; font-size: 20px; color: #E0E0E0; margin: 0 0 4px 0;">${window.CurrentUser?.name || 'STAFF'}</h2>
                                    <p id="np-role-label" class="dt-team-info-compact" style="color: var(--dt-accent); font-weight: 700; letter-spacing: 1px; font-size: 11px;">DIRECTOR TÉCNICO</p>
                                </div>
                            </div>
                        </div>

                        <!-- Próximo Partido (Widget C) -->
                        <div id="widget-next-match-container" class="platinum-widget widget-next-match" style="grid-column: span 8; display: flex; flex-direction: column; justify-content: center; padding: 20px;">
                            <div style="font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #888; margin-bottom: 8px;">
                                PRÓXIMO PARTIDO
                            </div>
                            <div>
                                <span id="cc-next-match" style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; color: #E0E0E0;">—</span>
                            </div>
                        </div>

                        <!-- Foco del Día (Widget A) -->
                        <div class="platinum-widget widget-today-focus" style="grid-column: span 4; grid-row: span 2;">
                            <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #888; margin-bottom: 15px; text-transform: uppercase;">
                                FOCO DEL DÍA <span id="cc-today-focus" style="margin-left: 8px; color: var(--dt-accent);"></span>
                            </div>
                            <ul id="cc-today-tasks" class="clean-tasks-list">
                                <li class="empty-tasks">Cargando foco del día...</li>
                            </ul>
                        </div>

                        <!-- Analítica -->
                        <div id="tile-analytics" class="platinum-widget action-tile-mini" onclick="DTEngine.toggleView('analytics')" style="grid-column: span 4; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                            <div class="tile-icon-mini">📊</div>
                            <h3 class="tile-title-mini">Analítica</h3>
                        </div>
                        
                        <!-- Pizarra -->
                        <div id="tile-board" class="platinum-widget action-tile-mini" onclick="if(window.DTEngine) window.DTEngine.toggleView('board')" style="grid-column: span 4; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                            <div class="tile-icon-mini">♟️</div>
                            <h3 class="tile-title-mini">Pizarra</h3>
                        </div>
                        
                        <!-- Calendario -->
                        <div id="tile-calendar" class="platinum-widget action-tile-mini" onclick="DTEngine.toggleView('calendar')" style="grid-column: span 8; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;">
                            <div class="tile-icon-mini">📅</div>
                            <h3 class="tile-title-mini">Calendario</h3>
                        </div>
                    </section>



                    <section id="dt-calendar-view" class="dt-dashboard-view view-section">

                        <!-- ═══ HEADER DE PERIODIZACIÓN ═══ -->
                        <div id="periodization-header" style="background: linear-gradient(135deg, #0d1117 0%, #111827 100%); border: 1px solid rgba(0,242,254,0.08); border-radius: 12px; padding: 20px 24px; margin-bottom: 16px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <span style="font-family: Outfit, sans-serif; font-size: 0.65rem; font-weight: 800; color: #00F2FE; letter-spacing: 2px; text-transform: uppercase;">PERIODIZACIÓN</span>
                                    <span id="periodo-macro-name" style="font-family: Outfit, sans-serif; font-size: 0.85rem; color: #e5e7eb; font-weight: 600;">—</span>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <button onclick="window.SeasonPlanningModal.open()" class="btn-edit-planning" title="Editar Planificación Anual">✎ Editar Planificación</button>
                                    <div style="display: flex; align-items: center; gap: 6px; background: #1a2235; border-radius: 8px; padding: 3px;">
                                        <button id="btn-view-weekly" onclick="DTEngine.Periodization.setView('weekly')" style="padding: 6px 14px; border-radius: 6px; border: none; font-size: 0.7rem; font-weight: 700; font-family: Outfit, sans-serif; cursor: pointer; transition: all 0.2s; background: #00F2FE; color: #0d1117; letter-spacing: 0.5px;">SEMANAL</button>
                                        <button id="btn-view-process" onclick="DTEngine.Periodization.setView('process')" style="padding: 6px 14px; border-radius: 6px; border: none; font-size: 0.7rem; font-weight: 700; font-family: Outfit, sans-serif; cursor: pointer; transition: all 0.2s; background: transparent; color: #6b7280; letter-spacing: 0.5px;">PROCESO</button>
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                                <span style="font-size: 0.6rem; color: #6b7280; font-weight: 700; letter-spacing: 1.5px; font-family: Outfit, sans-serif;">ESTADO DEL PROCESO:</span>
                                <span id="periodo-fase-label" style="font-size: 0.72rem; color: #00F2FE; font-weight: 800; font-family: Outfit, sans-serif; background: rgba(0,242,254,0.08); padding: 3px 10px; border-radius: 4px;">—</span>
                            </div>
                            <div id="periodo-timeline" style="display: flex; align-items: center; gap: 0; width: 100%; height: 28px; border-radius: 6px; overflow: hidden; background: #1a2235;"></div>
                            <div id="periodo-legend" style="display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap;"></div>
                        </div>

                        <!-- ═══ VISTA PROCESO (oculta por defecto) ═══ -->
                        <div id="dt-process-view" style="display: none;">
                            <div id="process-phases-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;"></div>
                        </div>

                        <!-- ═══ ROADMAP BANNER (inyectado dinámicamente por Periodization.renderTimeline) ═══ -->
                        <div id="periodo-roadmap" style="margin-bottom: 16px;"></div>

                        <!-- Navegador de Meses Reubicado -->
                        <div id="dt-weekly-view">
                            <div class="month-nav calendar-nav-ux">
                                <button type="button" id="btn-prev-month" class="btn-nav">◀</button>
                                <span class="current-month-display">${monthName}</span>
                                <button type="button" id="btn-next-month" class="btn-nav">▶</button>
                            </div>
                            
                            <div id="dt-calendar-grid" class="macro-calendar-grid">
                                <!-- Inyección dinámica -->
                            </div>
                        </div>
                    </section>

                    <section id="dt-analytics-view" class="dt-analytics-view view-section">
                        <div class="analytics-grid">
                            <div class="chart-card">
                                <h3>Curva de Carga Semanal (Minutos)</h3>
                                <div class="chart-container">
                                    <canvas id="canvas-carga-semanal"></canvas>
                                </div>
                            </div>
                            <div class="chart-card">
                                <h3>Monitor de Carga sRPE</h3>
                                <div class="chart-container">
                                    <canvas id="canvas-srpe"></canvas>
                                </div>
                            </div>
                            <div class="chart-card">
                                <h3>Distribución por Momentos</h3>
                                <div class="chart-container">
                                    <canvas id="canvas-momentos-juego"></canvas>
                                </div>
                            </div>
                            <div class="chart-card">
                                <h3>Densidad de Espacio (m²/jug)</h3>
                                <div class="chart-container">
                                    <canvas id="canvas-espacio"></canvas>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- SECCIÓN CENTRO DE AJUSTES (#view-profile) -->
                    <style>
                        .settings-tab-btn { background: transparent; color: #9ca3af; border: none; text-align: left; padding: 12px 15px; border-radius: 8px; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; }
                        .settings-tab-btn:hover { background: rgba(255,255,255,0.05); color: #fff; }
                        .settings-tab-btn.active { background: rgba(0, 242, 254, 0.1); color: #00F2FE; }
                    </style>
                    <section id="view-profile" class="view-section" style="width: 100%; box-sizing: border-box;">
                        <div style="display: flex; gap: 30px; align-items: flex-start; max-width: 1200px; margin: 0 auto;">
                            
                            <!-- Sidebar -->
                            <div style="width: 250px; flex-shrink: 0; background: #111827; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; display: flex; flex-direction: column; gap: 8px;">
                                <h2 style="font-family:'Outfit'; font-size:18px; color:#fff; margin:0 0 15px 5px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.05);">CENTRO DE AJUSTES</h2>
                                
                                <button class="settings-tab-btn active" id="tab-btn-dt" onclick="DTEngine.switchSettingsTab('dt')">👤 Perfil del DT</button>
                                <button class="settings-tab-btn" id="tab-btn-club" onclick="DTEngine.switchSettingsTab('club')">🛡️ Club y Plantel</button>
                                <button class="settings-tab-btn" id="tab-btn-load" onclick="DTEngine.switchSettingsTab('load')">⚡ Motor de Rendimiento</button>
                                <button class="settings-tab-btn" id="tab-btn-sys" onclick="DTEngine.switchSettingsTab('sys')">⚙️ Sistema</button>
                            </div>

                            <!-- Contenido -->
                            <div style="flex: 1; background: #0f172a; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; min-height: 500px; padding: 30px;">
                                
                                <!-- Tab 1: Perfil DT -->
                                <div id="settings-tab-dt" class="settings-tab-content" style="display: block;">
                                    <div class="profile-card">
                                        <h3 class="profile-section-title">IDENTIDAD STAFF</h3>
                                        <div class="profile-form-grid" style="align-items: center;">
                                            <div class="profile-input-group" style="grid-column: span 2; display: flex; align-items: center; gap: 20px;">
                                                <div style="position: relative; width: 80px; height: 80px; border-radius: 50%; overflow: hidden; background: #1f2937; border: 2px solid #00F2FE;">
                                                    <img id="prof-avatar-preview" src="" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; display: none;">
                                                </div>
                                                <div>
                                                    <label>FOTO DE PERFIL</label>
                                                    <input type="file" id="prof-avatar-upload" accept="image/*" class="profile-input" style="padding: 8px;" onchange="window.DTEngine.handleImageUpload(event, 'prof-avatar-preview', 'avatar_url_base64')">
                                                    <input type="hidden" id="avatar_url_base64">
                                                </div>
                                            </div>
                                            <div class="profile-input-group">
                                                <label>NOMBRE COMPLETO</label>
                                                <input type="text" id="prof-name" class="profile-input" placeholder="Nombre del DT" autocomplete="name">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>EMAIL</label>
                                                <input type="email" id="prof-email" class="profile-input" readonly style="opacity: 0.7; cursor: not-allowed;" placeholder="dt@equipo.com">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>LICENCIA</label>
                                                <select id="prof-license" class="profile-input">
                                                    <option value="UEFA PRO">UEFA PRO</option>
                                                    <option value="CONMEBOL PRO">CONMEBOL PRO</option>
                                                    <option value="AFA / ATFA">AFA / ATFA</option>
                                                    <option value="AMATEUR">AMATEUR</option>
                                                </select>
                                            </div>
                                            <div class="profile-input-group" style="display: flex; flex-direction: column; justify-content: center;">
                                                <label>SUSCRIPCIÓN</label>
                                                <div style="display: inline-block; padding: 5px 12px; background: rgba(0,242,254,0.1); color: #00F2FE; border: 1px solid #00F2FE; border-radius: 20px; font-weight: bold; font-size: 12px; text-align: center; width: max-content;">
                                                    PRO / ELITE
                                                </div>
                                            </div>
                                            <div class="profile-input-group" style="grid-column: span 2;">
                                                <button type="button" class="btn-save-profile" style="background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); margin-top: 10px; width: auto; padding: 10px 20px;" onclick="alert('Funcionalidad de cambio de contraseña próximamente')">Cambiar Contraseña</button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="profile-card" style="margin-top: 20px;">
                                        <h3 class="profile-section-title">TRAYECTORIA PREVIA (Histórico)</h3>
                                        <div class="profile-form-grid">
                                            <div class="profile-input-group">
                                                <label>PARTIDOS DIRIGIDOS</label>
                                                <input type="number" id="prof-hist-partidos" class="profile-input" placeholder="0" min="0">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>TÍTULOS OBTENIDOS</label>
                                                <input type="number" id="prof-hist-titulos" class="profile-input" placeholder="0" min="0">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>AÑOS / TEMPORADAS DE EXPERIENCIA</label>
                                                <input type="number" id="prof-hist-temporadas" class="profile-input" placeholder="0" min="0">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>VICTORIAS</label>
                                                <input type="number" id="prof-hist-victorias" class="profile-input" placeholder="0" min="0">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>EMPATES</label>
                                                <input type="number" id="prof-hist-empates" class="profile-input" placeholder="0" min="0">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>DERROTAS</label>
                                                <input type="number" id="prof-hist-derrotas" class="profile-input" placeholder="0" min="0">
                                            </div>
                                        </div>
                                    </div>
                                    <button class="btn-save-profile" onclick="DTEngine.saveDTProfile()" style="margin-top: 25px;">GUARDAR PERFIL DEL DT</button>
                                </div>

                                <!-- Tab 2: Club y Plantel -->
                                <div id="settings-tab-club" class="settings-tab-content" style="display: none;">
                                    <div class="profile-card">
                                        <h3 class="profile-section-title">🛡️ CONFIGURACIÓN DEL CLUB</h3>
                                        <div class="profile-form-grid" style="align-items: center;">
                                            <div class="profile-input-group" style="grid-column: span 2; display: flex; align-items: center; gap: 20px;">
                                                <div style="position: relative; width: 80px; height: 80px; border-radius: 12px; overflow: hidden; background: #1f2937; border: 2px solid #374151;">
                                                    <img id="prof-shield-preview" src="" alt="Escudo" style="width: 100%; height: 100%; object-fit: contain; display: none;">
                                                </div>
                                                <div>
                                                    <label>ESCUDO DEL CLUB</label>
                                                    <input type="file" id="prof-shield-upload" accept="image/*" class="profile-input" style="padding: 8px;" onchange="window.DTEngine.handleImageUpload(event, 'prof-shield-preview', 'shield_url_base64')">
                                                    <input type="hidden" id="shield_url_base64">
                                                </div>
                                            </div>
                                            <div class="profile-input-group">
                                                <label>NOMBRE DEL EQUIPO</label>
                                                <input type="text" id="prof-team-name" class="profile-input" placeholder="Nombre del Club">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>CATEGORÍA</label>
                                                <input type="text" id="prof-team-category" class="profile-input" placeholder="Ej. Primera División">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>LIGA</label>
                                                <input type="text" id="prof-team-liga" class="profile-input" placeholder="Ej. La Liga">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>COLOR PRINCIPAL</label>
                                                <input type="color" id="prof-team-color" class="profile-input" style="height: 48px; padding: 5px;">
                                            </div>
                                            <div class="profile-input-group" style="grid-column: span 2;">
                                                <label>METODOLOGÍA</label>
                                                <select id="prof-methodology" class="profile-input">
                                                    <option value="Periodización Táctica">Periodización Táctica</option>
                                                    <option value="Microciclo Estructurado">Microciclo Estructurado</option>
                                                    <option value="Entrenamiento Integrado">Entrenamiento Integrado</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
<div class="profile-card" style="margin-top: 20px;">
                                        <h3 class="profile-section-title">⚙️ ADN TÁCTICO — MODELO DE JUEGO</h3>
                                        <div class="dna-section-label">ORGANIZACIÓN OFENSIVA</div>
                                        <div class="profile-form-grid">
                                            <div class="profile-input-group">
                                                <label>MÉTODO OFENSIVO</label>
                                                <select id="dna-ataque" class="profile-input">
                                                    <option value="Ataque Posicional">Ataque Posicional</option>
                                                    <option value="Ataque Directo">Ataque Directo</option>
                                                    <option value="Ataque Rápido">Ataque Rápido</option>
                                                </select>
                                            </div>
                                            <div class="profile-input-group" style="grid-column: span 2;">
                                                <label>PRINCIPIOS OPERATIVOS</label>
                                                <div class="tag-input-wrapper" id="tag-input-wrapper">
                                                    <div class="tag-chips" id="tag-chips"></div>
                                                    <div class="tag-input-row">
                                                        <input type="text" id="tag-input" class="tag-input-field" list="tag-suggestions" placeholder="Buscar o escribir un principio..." autocomplete="off" onkeydown="DTEngine.TagInput.onKeyDown(event)">
                                                        <datalist id="tag-suggestions"></datalist>
                                                        <button type="button" class="tag-add-btn" onclick="DTEngine.TagInput.addFromInput()">+</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="dna-section-label">ORGANIZACIÓN DEFENSIVA</div>
                                        <div class="profile-form-grid">
                                            <div class="profile-input-group">
                                                <label>MÉTODO DEFENSIVO</label>
                                                <select id="dna-defensa" class="profile-input">
                                                    <option value="Defensa Zonal">Defensa Zonal</option>
                                                    <option value="Hombre a Hombre">Hombre a Hombre</option>
                                                    <option value="Individual">Individual</option>
                                                    <option value="Combinada">Combinada</option>
                                                    <option value="Presión Alta">Presión Alta</option>
                                                </select>
                                            </div>
                                            <div class="profile-input-group">
                                                <label>ALTURA DEL BLOQUE</label>
                                                <select id="dna-bloque" class="profile-input">
                                                    <option value="Alto">Bloque Alto</option>
                                                    <option value="Medio">Bloque Medio</option>
                                                    <option value="Bajo">Bloque Bajo</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div class="dna-section-label">TRANSICIONES</div>
                                        <div class="profile-form-grid">
                                            <div class="profile-input-group">
                                                <label>TRANSICIÓN OFENSIVA (DEF→AT)</label>
                                                <select id="dna-trans-of" class="profile-input">
                                                    <option value="Contraataque">Contraataque</option>
                                                    <option value="Conservación">Conservación</option>
                                                </select>
                                            </div>
                                            <div class="profile-input-group">
                                                <label>TRANSICIÓN DEFENSIVA (AT→DEF)</label>
                                                <select id="dna-trans-def" class="profile-input">
                                                    <option value="Presión tras pérdida">Presión tras pérdida</option>
                                                    <option value="Repliegue Medio">Repliegue Medio</option>
                                                    <option value="Repliegue Bajo">Repliegue Bajo</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div class="dna-section-label">REGLAS DE ACCIÓN Y PROVOCACIÓN</div>
                                        <div class="profile-input-group" style="grid-column: span 2; margin-top: 10px;">
                                            <label>ATRACTORES Y CONSTREÑIMIENTOS DEL DT</label>
                                            <div class="tag-input-wrapper" id="rules-tag-input-wrapper">
                                                <div class="tag-chips" id="rules-tag-chips"></div>
                                                <div class="tag-input-row">
                                                    <input type="text" id="rules-tag-input" class="tag-input-field" list="rules-tag-suggestions" placeholder="Buscar o escribir una regla..." autocomplete="off" onkeydown="DTEngine.RulesTagInput.onKeyDown(event)">
                                                    <datalist id="rules-tag-suggestions"></datalist>
                                                    <button type="button" class="tag-add-btn" onclick="DTEngine.RulesTagInput.addFromInput()">+</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="profile-card" style="margin-top: 20px;">
                                        <h3 class="profile-section-title">⚽ ESTRUCTURA Y PERFILES DEL 11 IDEAL</h3>
                                        <div class="profile-input-group">
                                            <label>ESQUEMA BASE</label>
                                            <select id="dna-esquema" class="profile-input" onchange="DTEngine.PitchEngine.renderPitch(this.value)">
                                                <option value="1-4-3-3">1-4-3-3</option>
                                                <option value="1-4-4-2">1-4-4-2</option>
                                                <option value="1-3-5-2">1-3-5-2</option>
                                                <option value="1-4-2-3-1">1-4-2-3-1</option>
                                            </select>
                                        </div>
                                        <div id="tactical-pitch" class="pitch-container"></div>
                                        
                                        <!-- Modal inline de Perfil de Posición -->
                                        <div id="position-modal" class="position-modal hidden">
                                            <div class="position-modal-inner">
                                                <div class="position-modal-header">
                                                    <span id="position-modal-title" class="position-modal-title">GK</span>
                                                    <button type="button" class="tag-chip-remove" onclick="DTEngine.PitchEngine.closePositionModal()" style="width:22px;height:22px;font-size:16px;">×</button>
                                                </div>
                                                <div id="position-modal-content" style="max-height: 400px; overflow-y: auto; margin-bottom: 15px; padding-right: 5px;">
                                                    <div class="scouting-group">
                                                        <label style="font-size:10px;color:var(--dt-accent);font-weight:900;letter-spacing:1px;display:block;margin-bottom:8px;">ROL TÁCTICO BASE (Elige 1)</label>
                                                        <div id="options-rol" class="role-options-grid"></div>
                                                    </div>
                                                    <div class="scouting-group" style="margin-top:15px;">
                                                        <label style="font-size:10px;color:var(--dt-accent);font-weight:900;letter-spacing:1px;display:block;margin-bottom:8px;">FÍSICO IDEAL (1 a 3 opciones)</label>
                                                        <div id="options-fisicos" class="role-options-grid"></div>
                                                    </div>
                                                    <div class="scouting-group" style="margin-top:15px;">
                                                        <label style="font-size:10px;color:var(--dt-accent);font-weight:900;letter-spacing:1px;display:block;margin-bottom:8px;">TÉCNICO / COGNITIVO (1 a 3 opciones)</label>
                                                        <div id="options-tacticos" class="role-options-grid"></div>
                                                    </div>
                                                </div>
                                                <button type="button" class="btn-save-profile" onclick="DTEngine.PitchEngine.savePositionProfile()" style="margin-top:12px;padding:10px 20px;font-size:11px;">GUARDAR PERFIL SCOUTING</button>
                                            </div>
                                        </div>
                                    </div>
                                    <button class="btn-save-profile" onclick="DTEngine.saveClubSettings()" style="margin-top: 25px;">GUARDAR CLUB Y PLANTEL</button>
                                </div>

                                <!-- Tab 3: Motor de Rendimiento -->
                                <div id="settings-tab-load" class="settings-tab-content" style="display: none;">
                                    <div class="profile-card">
                                        <h3 class="profile-section-title">⚡ MOTOR DE CARGAS Y RENDIMIENTO</h3>
                                        <div class="profile-form-grid">
                                            <div class="profile-input-group" style="grid-column: span 2; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 8px;">
                                                <label style="margin:0; font-size: 13px;">Separar RPE Cardiovascular y Muscular</label>
                                                <input type="checkbox" id="load-rpe-diff" style="width:20px; height:20px; accent-color:#00F0FF; cursor:pointer;">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>LÍMITE RIESGO LESIÓN (A/C)</label>
                                                <input type="number" step="0.1" id="load-ac-ratio" class="profile-input" value="1.5">
                                            </div>
                                            <div class="profile-input-group">
                                                <label>LÍMITE DE MONOTONÍA SEMANAL</label>
                                                <input type="number" step="0.1" id="load-monotony" class="profile-input" value="2.0">
                                            </div>
                                            <div class="profile-input-group" style="grid-column: span 2; display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 8px;">
                                                <label style="margin:0; font-size: 13px;">Activar alertas visuales de riesgo en Calendario</label>
                                                <input type="checkbox" id="load-assistant" style="width:20px; height:20px; accent-color:#00F0FF; cursor:pointer;">
                                            </div>
                                            <div class="profile-input-group" style="grid-column: span 2;">
                                                <label>FRECUENCIA DE CUESTIONARIO HOOPER</label>
                                                <select id="load-wellness-freq" class="profile-input">
                                                    <option value="Diario">Diario</option>
                                                    <option value="Solo Días de Entrenamiento">Solo Días de Entrenamiento</option>
                                                    <option value="Apagado">Apagado</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <button class="btn-save-profile" onclick="DTEngine.saveLoadEngineSettings()" style="margin-top: 25px;">GUARDAR MOTOR DE RENDIMIENTO</button>
                                </div>

                                <!-- Tab 4: Sistema -->
                                <div id="settings-tab-sys" class="settings-tab-content" style="display: none;">
                                    <div class="profile-card">
                                        <h3 class="profile-section-title">⚙️ SISTEMA</h3>
                                        <p style="color:#888; font-size: 14px;">Ajustes generales del sistema próximamente (Notificaciones, Exportación, Privacidad)...</p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </section>
                    
                    <section id="view-board" class="view-section" style="width: 100%; margin-top: 15px; box-sizing: border-box;">
                        <div style="display: flex; gap: 20px; width: 100%; height: 85vh;">

                            <!-- ═══ PANEL LATERAL: ESQUEMAS + HERRAMIENTAS TÁCTICAS ═══ -->
                            <div style="width: 260px; background: #111827; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); padding: 20px; display: flex; flex-direction: column; gap: 14px; flex-shrink: 0; overflow-y: auto;">
                                <h3 style="color: var(--primary-color, #00F2FE); margin: 0; font-family: Outfit; font-size: 1.2rem;">SALA DE JUEGOS</h3>
                                <p style="color: #6b7280; font-size: 0.8rem; margin-top: -10px; margin-bottom: 4px;">Diseño Táctico</p>

                                <!-- ═══ HERRAMIENTAS TÁCTICAS NATIVAS (DOM) ═══ -->
                                <div style="border-top: 1px solid rgba(0,242,254,0.12); padding-top: 14px; display: flex; flex-direction: column; gap: 16px;">
                                    
                                    <!-- GRUPO A: Elementos (Nodos) -->
                                    <div class="tool-group" style="display: flex; flex-direction: column; gap: 6px;">
                                        <p style="color: #00F2FE; font-size: 0.65rem; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 2px 0;">Elementos</p>
                                        <button onclick="window.DTEngine.Board.Spawner.spawnSinglePlayer('local')" style="padding: 8px 12px; background: rgba(0,242,254,0.05); color: #00F2FE; border: 1px solid rgba(0,242,254,0.2); border-radius: 7px; cursor: pointer; font-family: Outfit, sans-serif; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px; transition: all 0.15s;" onmouseover="this.style.background='rgba(0,242,254,0.15)';" onmouseout="this.style.background='rgba(0,242,254,0.05)';">👤 Añadir Jugador Local</button>
                                        <button onclick="window.DTEngine.Board.Spawner.spawnSinglePlayer('rival')" style="padding: 8px 12px; background: rgba(255,77,77,0.05); color: #ff4d4d; border: 1px solid rgba(255,77,77,0.2); border-radius: 7px; cursor: pointer; font-family: Outfit, sans-serif; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px; transition: all 0.15s;" onmouseover="this.style.background='rgba(255,77,77,0.15)';" onmouseout="this.style.background='rgba(255,77,77,0.05)';">👤 Añadir Jugador Rival</button>
                                        <button onclick="window.DTEngine.Board.Spawner.addBallDOM()" style="padding: 8px 12px; background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 7px; cursor: pointer; font-family: Outfit, sans-serif; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px; transition: all 0.15s;"
                                            onmouseover="this.style.background='rgba(255,255,255,0.15)';" onmouseout="this.style.background='rgba(255,255,255,0.05)';">⚽ Añadir Balón</button>
                                    </div>

                                    <!-- GRUPO B: Herramientas (Trazos) -->
                                    <div class="tool-group" style="display: flex; flex-direction: column; gap: 6px;">
                                        <p style="color: #00F2FE; font-size: 0.65rem; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 2px 0;">Herramientas</p>
                                        <button id="tool-btn-none" onclick="window.DTEngine.Board.DrawTool.setMode('none')" style="padding: 9px 12px; background: rgba(107,114,128,0.06); color: #6b7280; border: 1px solid rgba(107,114,128,0.18); border-radius: 7px; cursor: pointer; font-family: Outfit, sans-serif; font-size: 0.78rem; font-weight: 700; text-align: left; display: flex; align-items: center; gap: 8px; transition: all 0.15s;"
                                            onmouseover="this.style.borderColor='#9ca3af'; this.style.color='#9ca3af';" onmouseout="this.style.borderColor='rgba(107,114,128,0.18)'; this.style.color='#6b7280';">✋ Mover Nodos</button>
                                        <button id="tool-btn-zone" onclick="window.DTEngine.Board.DrawTool.setMode('zone')" style="padding: 9px 12px; background: rgba(0,242,254,0.05); color: #9ca3af; border: 1px solid rgba(0,242,254,0.15); border-radius: 7px; cursor: pointer; font-family: Outfit, sans-serif; font-size: 0.78rem; font-weight: 700; text-align: left; display: flex; align-items: center; gap: 8px; transition: all 0.15s; letter-spacing: 0.3px;"
                                            onmouseover="this.style.borderColor='#00F2FE'; this.style.color='#00F2FE';" onmouseout="if(window.DTEngine.Board.DrawTool._mode!=='zone'){this.style.borderColor='rgba(0,242,254,0.15)'; this.style.color='#9ca3af';}">◻ Trazar Zona</button>
                                        <button id="tool-btn-arrow" onclick="window.DTEngine.Board.DrawTool.setMode('arrow')" style="padding: 9px 12px; background: rgba(0,242,254,0.05); color: #9ca3af; border: 1px solid rgba(0,242,254,0.15); border-radius: 7px; cursor: pointer; font-family: Outfit, sans-serif; font-size: 0.78rem; font-weight: 700; text-align: left; display: flex; align-items: center; gap: 8px; transition: all 0.15s; letter-spacing: 0.3px;"
                                            onmouseover="this.style.borderColor='#00F2FE'; this.style.color='#00F2FE';" onmouseout="if(window.DTEngine.Board.DrawTool._mode!=='arrow'){this.style.borderColor='rgba(0,242,254,0.15)'; this.style.color='#9ca3af';}">→ Línea / Flecha</button>
                                        <button id="tool-btn-pass" onclick="window.DTEngine.Board.DrawTool.setMode('pass')" style="padding: 9px 12px; background: rgba(255,200,0,0.05); color: #9ca3af; border: 1px solid rgba(255,200,0,0.15); border-radius: 7px; cursor: pointer; font-family: Outfit, sans-serif; font-size: 0.78rem; font-weight: 700; text-align: left; display: flex; align-items: center; gap: 8px; transition: all 0.15s; letter-spacing: 0.3px;"
                                            onmouseover="this.style.borderColor='#FFC800'; this.style.color='#FFC800';" onmouseout="if(window.DTEngine.Board.DrawTool._mode!=='pass'){this.style.borderColor='rgba(255,200,0,0.15)'; this.style.color='#9ca3af';}">⤳ Línea de Pase</button>
                                    </div>

                                    <!-- GRUPO C: Acciones Globales -->
                                    <div class="tool-group" style="display: flex; flex-direction: column; gap: 6px;">
                                        <p style="color: #ff3b30; font-size: 0.65rem; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 2px 0;">Acciones</p>
                                        <button onclick="window.DTEngine.Board.DrawTool.clearAll()" style="padding: 8px 12px; background: rgba(255,59,48,0.07); color: #ff3b30; border: 1px solid rgba(255,59,48,0.2); border-radius: 7px; cursor: pointer; font-family: Outfit, sans-serif; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px; transition: all 0.15s;"
                                            onmouseover="this.style.background='rgba(255,59,48,0.15)';" onmouseout="this.style.background='rgba(255,59,48,0.07)';">🗑 Limpiar Pizarra</button>
                                    </div>

                                    <!-- Modo activo indicador -->
                                    <div id="overlay-mode-indicator" style="font-size: 0.68rem; color: #4b5563; text-align: center; font-family: Outfit, sans-serif; letter-spacing: 0.5px; margin-top: 2px;">Modo: Mover Nodos</div>
                                </div>
                            </div>

                            <!-- ═══ CANCHA PRINCIPAL ═══ -->
                            <div id="pitch-container" style="flex: 1; background: #0f172a; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                <!-- Fondo SVG de la cancha (no interactivo) -->
                                <svg viewBox="0 -5 105 78" style="width: 95%; height: 95%; overflow: visible; opacity: 0.8; pointer-events: none;">
                                    <rect x="0" y="0" width="105" height="68" fill="none" stroke="#334155" stroke-width="0.4"/>
                                    <line x1="52.5" y1="0" x2="52.5" y2="68" stroke="#334155" stroke-width="0.4"/>
                                    <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="#334155" stroke-width="0.4"/>
                                    <circle cx="52.5" cy="34" r="0.5" fill="#334155"/>
                                    <rect x="0" y="13.84" width="16.5" height="40.32" fill="none" stroke="#334155" stroke-width="0.4"/>
                                    <rect x="0" y="26.84" width="5.5" height="14.32" fill="none" stroke="#334155" stroke-width="0.4"/>
                                    <circle cx="11" cy="34" r="0.4" fill="#334155"/>
                                    <path d="M 16.5 24.84 A 9.15 9.15 0 0 1 16.5 43.16" fill="none" stroke="#334155" stroke-width="0.4"/>
                                    <rect x="88.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="#334155" stroke-width="0.4"/>
                                    <rect x="99.5" y="26.84" width="5.5" height="14.32" fill="none" stroke="#334155" stroke-width="0.4"/>
                                    <circle cx="94" cy="34" r="0.4" fill="#334155"/>
                                    <path d="M 88.5 24.84 A 9.15 9.15 0 0 0 88.5 43.16" fill="none" stroke="#334155" stroke-width="0.4"/>
                                </svg>

                                <!-- SVG Overlay para líneas y flechas (z=10, encima del fondo, debajo de fichas) -->
                                <svg id="tactical-svg-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;" xmlns="http://www.w3.org/2000/svg">
                                    <defs>
                                        <marker id="arrowhead-cyan" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                                            <polygon points="0 0, 8 3, 0 6" fill="#00F2FE" />
                                        </marker>
                                        <marker id="arrowhead-yellow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                                            <polygon points="0 0, 8 3, 0 6" fill="#FFC800" />
                                        </marker>
                                    </defs>
                                </svg>

                                <!-- Capa de Zonas DOM (z=11, encima del SVG, debajo de fichas) -->
                                <div id="zones-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 11;"></div>

                                <!-- Capa de fichas de jugadores (z=20, encima de todo) -->
                                <div id="tokens-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 20;"></div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>

                <!-- Drawer Lateral Unificado -->
                <div id="dt-drawer" class="drawer-overlay hidden">
                    <div class="drawer-content" style="max-width: 480px;">
                        <div class="drawer-header">
                            <div class="title-group">
                                <h3 id="drawer-date-title">Detalle</h3>
                                <p id="drawer-methodology-label" class="methodology-badge"></p>
                            </div>
                            <button class="btn-close" onclick="DTEngine.closeDrawer()">✕</button>
                        </div>

                        <!-- ══ BLOQUE SUPERIOR: MACRO & SOLÉ ══ -->
                        <div style="padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.06);">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: end;">
                                <div style="display: flex; flex-direction: column; gap: 5px;">
                                    <label style="color:#9ca3af; font-size:0.68rem; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Enfoque</label>
                                    <select id="drawer-enfoque" style="width:100%; background:#1A1A1A; border:1px solid rgba(255,255,255,0.12); color:#fff; padding:10px 8px; border-radius:8px; outline:none; font-family:Outfit,sans-serif; cursor:pointer; font-size:0.85rem; box-sizing:border-box;">
                                        <option value="Tensión">Tensión</option>
                                        <option value="Resistencia">Resistencia</option>
                                        <option value="Velocidad">Velocidad</option>
                                        <option value="Activación">Activación</option>
                                        <option value="Recuperación">Recuperación</option>
                                        <option value="Día Libre">Día Libre</option>
                                        <option value="Día Club">Día Club</option>
                                        <option value="Gimnasio">Gimnasio</option>
                                        <option value="ABP">ABP</option>
                                    </select>
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 5px;">
                                    <label style="color:#9ca3af; font-size:0.68rem; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Índice Solé</label>
                                    <select id="drawer-especificidad" style="width:100%; background:#1A1A1A; border:1px solid rgba(255,255,255,0.12); color:#fff; padding:10px 8px; border-radius:8px; outline:none; font-family:Outfit,sans-serif; cursor:pointer; font-size:0.85rem; box-sizing:border-box;">
                                        <option value="0.4">0.4 — General</option>
                                        <option value="0.5">0.5 — Dirigido</option>
                                        <option value="0.6">0.6 — Especial</option>
                                        <option value="0.7">0.7 — Competitivo</option>
                                        <option value="0.9">0.9 — Oficial</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div id="rival-container" style="display: none; margin-top: 12px;">
                                <label style="color:#9ca3af; font-size:0.68rem; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Rival</label>
                                <input type="text" id="macro-rival" class="premium-input" placeholder="Nombre del Rival (ej. Nacional)" style="width:100%; background:#1A1A1A; border:1px solid rgba(255,255,255,0.12); color:#fff; padding:10px 8px; border-radius:8px; outline:none; font-family:Outfit,sans-serif; font-size:0.85rem; box-sizing:border-box; transition: border-color 0.2s;" onfocus="this.style.borderColor='#00F2FE'" onblur="this.style.borderColor='rgba(255,255,255,0.12)'">
                            </div>
                        </div>



                        <!-- ══ BLOQUE INFERIOR: MATEMÁTICA & GUARDADO ══ -->
                        <div style="padding: 16px 20px; display: flex; align-items: center; gap: 14px;">
                            <div style="display:flex; flex-direction:column; gap:3px; flex-shrink:0;">
                                <label style="color:#00F2FE; font-size:0.65rem; font-weight:800; letter-spacing:1.5px; text-transform:uppercase;">Volumen</label>
                                <input type="number" id="drawer-volumen" class="premium-input" placeholder="Ej: 90" style="width:90px; background:#0a0a0a; border:1.5px solid rgba(0,242,254,0.35); color:#00F2FE; padding:9px 6px; border-radius:8px; outline:none; font-family:Outfit,sans-serif; font-size:1.2rem; font-weight:900; text-align:center; box-sizing:border-box; letter-spacing:1px;">
                            </div>
                            <div style="display:flex; flex:1; gap:8px;">
                                <button id="drawer-save-btn" onclick="window.DTEngine.guardarDrawerSession()" style="flex:1; padding:13px 10px; background:#00F2FE; color:#080808; border:none; border-radius:8px; font-family:Outfit,sans-serif; font-weight:900; font-size:0.9rem; text-transform:uppercase; letter-spacing:1.5px; cursor:pointer; transition:filter 0.2s, transform 0.1s; white-space:nowrap;" onmouseover="this.style.filter='brightness(1.1)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.filter='brightness(1)'; this.style.transform='translateY(0)'">GUARDAR SESIÓN</button>
                                <button type="button" id="btn-delete-session" onclick="window.DTEngine.eliminarDrawerSession()" style="background: transparent; border: 1px solid #FF3B30; color: #FF3B30; padding: 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-family:Outfit,sans-serif; font-weight:900; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,59,48,0.1)'" onmouseout="this.style.background='transparent'" title="Eliminar Sesión">🗑️ BORRAR</button>
                            </div>
                        </div>

                        <!-- ══ BIBLIOTECA DE TAREAS (Cajón colapsable) ══ -->
                        <div style="padding: 0 20px 16px; border-top: 1px solid rgba(255,255,255,0.06);">
                            <details style="margin-top: 12px;">
                                <summary style="cursor:pointer; color:#9ca3af; font-size:0.75rem; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:8px 0; user-select:none;">📚 Biblioteca de Tareas</summary>
                                <div style="margin-top: 8px;">
                                    <button class="btn-add-custom-task" onclick="DTEngine.openCustomTaskModal()" style="width:100%; margin-bottom:8px;">+ CREAR TAREA</button>
                                    <div id="library-list" class="exercise-list-container" style="max-height: 70vh; overflow-y: auto; scrollbar-width: thin;"></div>
                                </div>
                            </details>
                        </div>

                        <div class="drawer-footer-actions">
                            <button class="btn-save-staged" onclick="DTEngine.saveStagedTasks()">GUARDAR CAMBIOS TAREAS</button>
                        </div>
                    </div>
                </div>

                <!-- Modal de Tarea Personalizada PREMIUM V3 — exercises_library -->
                <div id="modal-custom-task" class="modal-overlay hidden" onclick="DTEngine.closeCustomTaskModal()">
                    <div class="custom-task-content" onclick="event.stopPropagation()" style="background:#080808; border:1px solid rgba(0,240,255,0.2); border-radius:16px; width:92vw; max-width:1440px; height:88vh; display:flex; flex-direction:row; overflow:hidden; color:#F5F5F5; position:relative; box-shadow:0 10px 40px rgba(0,0,0,0.8);">

                        <!-- ═══ COLUMNA IZQUIERDA: FORMULARIO exercises_library (35%) ═══ -->
                        <div style="width:35%; background:#111111; border-right:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; box-sizing:border-box; overflow:hidden; z-index:1;">
                            <div style="padding:24px 24px 0; flex-shrink:0;">
                                <h2 style="margin:0 0 4px 0; color:#00F0FF; font-family:Outfit,sans-serif; font-size:1.4rem; letter-spacing:1px;">📋 NUEVA TAREA</h2>
                                <p style="margin:0 0 16px 0; font-size:0.75rem; color:#6b7280;">exercises_library · Todos los campos sincronizados con Supabase</p>
                            </div>

                            <!-- Scroll form body -->
                            <div style="flex:1; overflow-y:auto; padding:0 24px 24px; scrollbar-width:thin; scrollbar-color:#333 transparent;">

                                <!-- TÍTULO -->
                                <div style="margin-bottom:14px;">
                                    <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:5px;">Título *</label>
                                    <input type="text" id="ct-title" placeholder="Ej: Rondo de pressing 4v4+3" style="width:100%; padding:11px 12px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; font-size:0.9rem; outline:none; box-sizing:border-box; transition:border-color 0.2s;" onfocus="this.style.borderColor='#00F0FF'" onblur="this.style.borderColor='#2a2a2a'">
                                </div>

                                <!-- DESCRIPCIÓN -->
                                <div style="margin-bottom:14px;">
                                    <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:5px;">Descripción</label>
                                    <textarea id="ct-description" rows="2" placeholder="Explicación general de la tarea..." style="width:100%; padding:11px 12px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; font-size:0.85rem; outline:none; resize:none; box-sizing:border-box; transition:border-color 0.2s;" onfocus="this.style.borderColor='#00F0FF'" onblur="this.style.borderColor='#2a2a2a'"></textarea>
                                </div>

                                <!-- OBJETIVO TÁCTICO Y FÍSICO -->
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
                                    <div>
                                        <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:5px;">Objetivo Táctico</label>
                                        <input type="text" id="ct-objetivo-tactico" placeholder="Ej: Posesión" style="width:100%; padding:10px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; font-size:0.82rem; outline:none; box-sizing:border-box;">
                                    </div>
                                    <div>
                                        <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:5px;">Objetivo Físico</label>
                                        <select id="ct-objetivo-fisico" onchange="window.DTEngine.autoFillM2()" style="width:100%; padding:10px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; outline:none; font-family:Outfit,sans-serif; font-size:0.82rem; cursor:pointer; box-sizing:border-box;">
                                            <option value="">—</option>
                                            <option value="Fuerza">Fuerza</option>
                                            <option value="Resistencia">Resistencia</option>
                                            <option value="Velocidad">Velocidad</option>
                                            <option value="Táctica">Táctica / Cuadrados Reducidos</option>
                                            <option value="Activación">Activación</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- ASISTENTE FISIOLÓGICO — helper text Juegos Reducidos -->
                                <div id="ct-fisiologico-helper" style="display:none; font-size:0.78rem; color:#34d399; font-weight:600; padding:9px 12px; background:rgba(52,211,153,0.07); border:1px solid rgba(52,211,153,0.25); border-radius:8px; margin-bottom:14px; line-height:1.5;"></div>

                                <!-- TIEMPOS, ESPACIOS Y DENSIDAD -->
                                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
                                    <div>
                                        <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; display:block; margin-bottom:5px;">Vol (min)</label>
                                        <input type="number" id="ct-volumen" placeholder="4" oninput="window.DTEngine.calcDensity()" style="width:100%; padding:10px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; outline:none; box-sizing:border-box; font-size:0.85rem; text-align:center;">
                                    </div>
                                    <div>
                                        <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; display:block; margin-bottom:5px;">Pausa (min)</label>
                                        <input type="number" id="ct-pausa" placeholder="2" oninput="window.DTEngine.calcDensity()" style="width:100%; padding:10px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; outline:none; box-sizing:border-box; font-size:0.85rem; text-align:center;">
                                    </div>
                                    <div>
                                        <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; display:block; margin-bottom:5px;">m² por Jug</label>
                                        <input type="number" id="ct-m2-jugador" placeholder="75" style="width:100%; padding:10px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; outline:none; box-sizing:border-box; font-size:0.85rem; text-align:center;">
                                    </div>
                                </div>

                                <!-- DENSIDAD HELPER -->
                                <div id="ct-density-helper" style="font-size:0.75rem; color:#eab308; font-weight:600; text-align:center; padding:6px; background:rgba(234,179,8,0.05); border:1px solid rgba(234,179,8,0.2); border-radius:6px; display:none; margin-bottom:14px;">
                                    <!-- Calculado dinámicamente -->
                                </div>

                                <!-- DIMENSIONES -->
                                <div style="margin-bottom:14px;">
                                    <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:5px;">Dimensiones</label>
                                    <input type="text" id="ct-dimensions" placeholder="Ej: 20x40m" style="width:100%; padding:11px 12px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; font-size:0.85rem; outline:none; box-sizing:border-box; transition:border-color 0.2s;" onfocus="this.style.borderColor='#00F0FF'" onblur="this.style.borderColor='#2a2a2a'">
                                </div>

                                <!-- MATERIALES (Tags) -->
                                <div style="margin-bottom:14px;">
                                    <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:5px;">Materiales</label>
                                    <div id="ct-materials-tags-container" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;"></div>
                                    <input type="text" id="ct-materials-input" placeholder="Escribe y presiona Enter..." style="width:100%; padding:11px 12px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; font-size:0.85rem; outline:none; box-sizing:border-box; transition:border-color 0.2s;" onfocus="this.style.borderColor='#00F0FF'" onblur="this.style.borderColor='#2a2a2a'" onkeydown="if(event.key==='Enter'){event.preventDefault(); window.DTEngine.addMaterialTag(this.value); this.value='';}">
                                    <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">
                                        <button type="button" onclick="window.DTEngine.addMaterialTag('Chalecos')" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#9ca3af; padding:4px 8px; border-radius:12px; font-size:0.7rem; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#9ca3af'">+ Chalecos</button>
                                        <button type="button" onclick="window.DTEngine.addMaterialTag('Conos')" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#9ca3af; padding:4px 8px; border-radius:12px; font-size:0.7rem; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#9ca3af'">+ Conos</button>
                                        <button type="button" onclick="window.DTEngine.addMaterialTag('Mini porterías')" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#9ca3af; padding:4px 8px; border-radius:12px; font-size:0.7rem; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#9ca3af'">+ Mini porterías</button>
                                        <button type="button" onclick="window.DTEngine.addMaterialTag('Portería móvil F11')" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#9ca3af; padding:4px 8px; border-radius:12px; font-size:0.7rem; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#9ca3af'">+ Portería móvil F11</button>
                                        <button type="button" onclick="window.DTEngine.addMaterialTag('Portería móvil F8')" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#9ca3af; padding:4px 8px; border-radius:12px; font-size:0.7rem; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#9ca3af'">+ Portería móvil F8</button>
                                        <button type="button" onclick="window.DTEngine.addMaterialTag('Balones')" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#9ca3af; padding:4px 8px; border-radius:12px; font-size:0.7rem; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#9ca3af'">+ Balones</button>
                                        <button type="button" onclick="window.DTEngine.addMaterialTag('Cintas')" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#9ca3af; padding:4px 8px; border-radius:12px; font-size:0.7rem; cursor:pointer; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#fff'" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#9ca3af'">+ Cintas</button>
                                    </div>
                                </div>

                                <!-- REGLAS -->
                                <div style="margin-bottom:14px; padding:12px; background:rgba(0,240,255,0.04); border:1px solid rgba(0,240,255,0.1); border-radius:10px;">
                                    <p style="margin:0 0 10px 0; font-size:0.68rem; color:#00F0FF; font-weight:700; letter-spacing:1px; text-transform:uppercase;">⚡ REGLAS TÁCTICAS</p>
                                    <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; display:block; margin-bottom:4px;">PROVOCACIÓN</label>
                                    <input type="text" id="ct-rule-provocation" placeholder="Ej: Presión al primer toque del portero..." style="width:100%; padding:9px 10px; margin-bottom:8px; background:#080808; border:1px solid #2a2a2a; border-radius:6px; color:#F5F5F5; font-size:0.82rem; outline:none; box-sizing:border-box;">
                                    <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; display:block; margin-bottom:4px;">PROPENSIÓN</label>
                                    <input type="text" id="ct-rule-propension" placeholder="Ej: Juego interior por líneas..." style="width:100%; padding:9px 10px; margin-bottom:8px; background:#080808; border:1px solid #2a2a2a; border-radius:6px; color:#F5F5F5; font-size:0.82rem; outline:none; box-sizing:border-box;">
                                    <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; display:block; margin-bottom:4px;">CONTINUIDAD</label>
                                    <input type="text" id="ct-rule-continuity" placeholder="Ej: Rotar posesión sin perder balón..." style="width:100%; padding:9px 10px; background:#080808; border:1px solid #2a2a2a; border-radius:6px; color:#F5F5F5; font-size:0.82rem; outline:none; box-sizing:border-box;">
                                </div>

                                <!-- DISPOSICIÓN TÁCTICA -->
                                <div style="margin-bottom:14px; padding:12px; background:rgba(0,240,255,0.04); border:1px solid rgba(0,240,255,0.1); border-radius:10px;">
                                    <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:10px; border-bottom:1px solid rgba(0,240,255,0.1); padding-bottom:5px;">Disposición Táctica</label>
                                    
                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                                        <div>
                                            <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; display:block; margin-bottom:4px;">FORMATO</label>
                                            <select id="ct-tactical-format" onchange="window.DTEngine.calcTacticalGroups()" style="width:100%; padding:9px 10px; background:#080808; border:1px solid #2a2a2a; border-radius:6px; color:#F5F5F5; font-size:0.82rem; outline:none; box-sizing:border-box;">
                                                <option value="Grupos / Estaciones">Grupos / Estaciones</option>
                                                <option value="Equipos Enfrentados">Equipos Enfrentados</option>
                                                <option value="Todo el Plantel">Todo el Plantel</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; display:block; margin-bottom:4px;">JUGADORES IDEALES</label>
                                            <input type="number" id="ct-ideal-players" min="1" max="50" placeholder="Ej: 22" oninput="window.DTEngine.calcTacticalGroups()" style="width:100%; padding:9px 10px; background:#080808; border:1px solid #2a2a2a; border-radius:6px; color:#F5F5F5; font-size:0.82rem; outline:none; box-sizing:border-box;">
                                        </div>
                                    </div>

                                    <div id="ct-group-qty-container" style="margin-bottom:10px;">
                                        <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; display:block; margin-bottom:4px;">CANTIDAD DE GRUPOS</label>
                                        <input type="number" id="ct-group-qty" min="1" max="10" placeholder="Ej: 2" oninput="window.DTEngine.calcTacticalGroups()" style="width:100%; padding:9px 10px; background:#080808; border:1px solid #2a2a2a; border-radius:6px; color:#F5F5F5; font-size:0.82rem; outline:none; box-sizing:border-box;">
                                    </div>

                                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                                        <div style="display:flex; justify-content:space-between; align-items:center; background:#080808; padding:8px 10px; border-radius:6px; border:1px solid #2a2a2a;">
                                            <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; margin:0;">USA GOLEROS</label>
                                            <input type="number" id="ct-use-gks" placeholder="0" style="width:45px; padding:4px; background:#1A1A1A; border:1px solid #2a2a2a; border-radius:4px; color:#F5F5F5; font-size:0.8rem; outline:none; text-align:center;" oninput="window.DTEngine.calcTacticalGroups()">
                                        </div>
                                        <div style="display:flex; justify-content:space-between; align-items:center; background:#080808; padding:8px 10px; border-radius:6px; border:1px solid #2a2a2a;">
                                            <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; margin:0;">USA COMODINES</label>
                                            <input type="number" id="ct-use-wildcards" placeholder="0" style="width:45px; padding:4px; background:#1A1A1A; border:1px solid #2a2a2a; border-radius:4px; color:#F5F5F5; font-size:0.8rem; outline:none; text-align:center;" oninput="window.DTEngine.calcTacticalGroups()">
                                        </div>
                                    </div>

                                    <!-- CALC HELPER -->
                                    <div id="ct-calc-helper" style="font-size:0.7rem; color:#00F0FF; font-weight:600; text-align:center; padding:6px; background:rgba(0,240,255,0.05); border-radius:6px; display:none;">
                                        <!-- Calculado dinámicamente -->
                                    </div>
                                </div>

                                <!-- Removed 'Conos como arcos' y 'Superficie' -->

                            </div><!-- /scroll body -->

                            <!-- GUARDAR -->
                            <div style="padding:16px 24px; border-top:1px solid rgba(255,255,255,0.06); flex-shrink:0;">
                                <button id="ct-save-btn" onclick="DTEngine.saveCustomTask()" style="width:100%; padding:15px; background:linear-gradient(135deg,#00F0FF,#0088cc); color:#000; border:none; border-radius:10px; font-weight:900; font-family:Outfit,sans-serif; font-size:1rem; cursor:pointer; letter-spacing:1.5px; text-transform:uppercase; transition:transform 0.1s, filter 0.2s; box-shadow:0 4px 20px rgba(0,240,255,0.25);" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'" onmouseover="this.style.filter='brightness(1.15)'" onmouseout="this.style.filter='brightness(1)'">💾 GUARDAR EN BIBLIOTECA</button>
                            </div>
                        </div>

                        <!-- ═══ COLUMNA DERECHA: PIZARRA TÁCTICA FABRIC.JS (65%) ═══ -->
                        <div style="width:65%; background:#080808; display:flex; flex-direction:column; position:relative; z-index:10; pointer-events:auto; height: 100%; max-height: 100%; overflow: hidden;">

                            <!-- ══════════════════════════════════════════════════
                                 TACTICAL BOARD 2.0 — BARRA DE HERRAMIENTAS
                            ══════════════════════════════════════════════════ -->
                                <style>
                                    #tactical-toolbar { padding:2px 6px; background:#080808; border-bottom:1px solid rgba(0,240,255,0.1); display:flex; align-items:center; gap:2px; flex-wrap:wrap; flex-shrink:0; }
                                    .tb-group { display:flex; align-items:center; gap:2px; padding:0 4px; border-right:1px solid rgba(255,255,255,0.07); }
                                    .tb-group:last-child { border-right:none; }
                                    .tb-label { font-size:0.5rem; color:#4b5563; font-weight:800; letter-spacing:0.5px; text-transform:uppercase; white-space:nowrap; padding-right:2px; }
                                    .tb-btn {
                                        display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0px;
                                        padding:2px 4px; border-radius:4px; border:1px solid #1f2937;
                                        background:transparent; color:#6b7280; cursor:pointer;
                                        font-size:0.55rem; font-weight:700; min-width:34px;
                                        transition:all 0.15s ease; font-family:Outfit,sans-serif; line-height:1;
                                    }
                                    .tb-btn:hover { background:rgba(255,255,255,0.06); border-color:#374151; color:#d1d5db; }
                                    .tb-btn.tb-active { background:rgba(0,240,255,0.12); border-color:#00F0FF; color:#00F0FF; }
                                    .tb-btn .tb-icon { font-size:0.8rem; line-height:1; }
                                    .tb-btn .tb-dot { display:inline-block; width:10px; height:10px; border-radius:50%; border:2px solid rgba(255,255,255,0.8); margin-bottom:1px; }
                                    .tb-player-blue  { background:#1d6aff !important; box-shadow:0 0 8px rgba(29,106,255,0.5); }
                                    .tb-player-red   { background:#ef4444 !important; box-shadow:0 0 8px rgba(239,68,68,0.5); }
                                    .tb-player-yel   { background:#eab308 !important; box-shadow:0 0 8px rgba(234,179,8,0.5); }
                                    .tb-player-grn   { background:#22c55e !important; box-shadow:0 0 8px rgba(34,197,94,0.5); }
                                    .tb-player-blk   { background:#374151 !important; box-shadow:0 0 8px rgba(55,65,81,0.5); }
                                    .tb-select {
                                        background:#0f172a; border:1px solid #1f2937; color:#9ca3af;
                                        font-family:Outfit,sans-serif; font-size:0.6rem; font-weight:700;
                                        padding:2px 4px; border-radius:4px; cursor:pointer; outline:none;
                                        transition:border-color 0.2s;
                                    }
                                    .tb-select:hover, .tb-select:focus { border-color:#00F0FF; color:#e2e8f0; }
                                    .tb-toggle { display:flex; align-items:center; gap:3px; font-size:0.5rem; color:#6b7280; font-weight:700; font-family:Outfit,sans-serif; cursor:pointer; white-space:nowrap; }
                                    .tb-toggle input[type=checkbox] { accent-color:#00F0FF; width:10px; height:10px; }
                                    .tb-toggle:hover { color:#9ca3af; }
                                    .tb-danger { border-color:rgba(239,68,68,0.3) !important; color:#ef4444 !important; }
                                    .tb-danger:hover { background:rgba(239,68,68,0.12) !important; border-color:#ef4444 !important; }
                                </style>
                            <div id="tactical-toolbar">

                                <!-- ─── GRUPO 1: FONDO / DEPORTE ─── -->
                                <div class="tb-group">
                                    <span class="tb-label">⚽ Campo</span>
                                    <select id="board-background-selector" class="tb-select" onchange="DTEngine.FabricEngine.setBackground(this.value)">
                                        <option value="futbol11">Fútbol 11</option>
                                        <option value="futbol-media">½ Cancha</option>
                                        <option value="basketball">Básquetbol</option>
                                        <option value="parquet">Parquet</option>
                                        <option value="blank">Pizarra Lisa</option>
                                    </select>
                                </div>

                                <!-- ─── GRUPO 2: TRAZO ─── -->
                                <div class="tb-group">
                                    <span class="tb-label">✏️</span>
                                    <button id="tool-draw" class="tb-btn tb-active" onclick="DTEngine.FabricEngine.setTool('draw')" title="Trazo Libre">
                                        <span class="tb-icon">✏️</span>Trazo
                                    </button>
                                </div>

                                <!-- ─── AFFORDANCE: Hint de Drag & Drop ─── -->
                                <div style="width:100%; text-align:center; padding:1px 0; margin-bottom:0px;">
                                    <span style="
                                        display:inline-flex; align-items:center; gap:3px;
                                        font-family:Outfit,sans-serif; font-size:0.5rem; font-weight:600;
                                        color:#4b5563; letter-spacing:0.5px;
                                        background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05);
                                        border-radius:12px; padding:1px 6px;
                                        user-select:none; pointer-events:none;
                                    ">💡 Arrastra a la cancha o hace clic en ella</span>
                                </div>

                                <!-- ─── GRUPO 3: JUGADORES NUMERADOS ─── -->
                                <div class="tb-group">
                                    <span class="tb-label">👤 Local</span>
                                    <button id="tool-player-blue" class="tb-btn" draggable="true" ondragstart="event.dataTransfer.setData('tool', 'player-blue')" onclick="DTEngine.FabricEngine.setTool('player-blue')" title="Local (Azul)">
                                        <span class="tb-dot tb-player-blue"></span>Local
                                    </button>
                                    <button id="tool-player-red" class="tb-btn" draggable="true" ondragstart="event.dataTransfer.setData('tool', 'player-red')" onclick="DTEngine.FabricEngine.setTool('player-red')" title="Rival (Rojo)">
                                        <span class="tb-dot tb-player-red"></span>Rival
                                    </button>
                                    <button id="tool-player-yellow" class="tb-btn" draggable="true" ondragstart="event.dataTransfer.setData('tool', 'player-yellow')" onclick="DTEngine.FabricEngine.setTool('player-yellow')" title="Comodín">
                                        <span class="tb-dot tb-player-yel"></span>Comod.
                                    </button>
                                    <button id="tool-player-green" class="tb-btn" draggable="true" ondragstart="event.dataTransfer.setData('tool', 'player-green')" onclick="DTEngine.FabricEngine.setTool('player-green')" title="Verde">
                                        <span class="tb-dot tb-player-grn"></span>Verde
                                    </button>
                                    <button id="tool-player-black" class="tb-btn" draggable="true" ondragstart="event.dataTransfer.setData('tool', 'player-black')" onclick="DTEngine.FabricEngine.setTool('player-black')" title="Negro">
                                        <span class="tb-dot tb-player-blk"></span>Negro
                                    </button>
                                    <!-- Contador de número de ficha -->
                                    <input id="player-number-input" type="number" min="1" max="99" value="" placeholder="#"
                                        title="Número del jugador (opcional)"
                                        style="width:30px; background:#0f172a; border:1px solid #1f2937; border-radius:4px; color:#e2e8f0; font-family:Outfit,sans-serif; font-size:0.65rem; font-weight:700; padding:2px 2px; text-align:center; outline:none; transition:border-color 0.2s;"
                                        onfocus="this.style.borderColor='#00F0FF'" onblur="this.style.borderColor='#1f2937'"
                                    >
                                </div>

                                <!-- ─── GRUPO 4: ELEMENTOS ─── -->
                                <div class="tb-group">
                                    <span class="tb-label">🧩</span>
                                    <button id="tool-ball" class="tb-btn" draggable="true" ondragstart="event.dataTransfer.setData('tool', 'ball')" onclick="DTEngine.FabricEngine.setTool('ball')" title="Balón">
                                        <span class="tb-icon">⚽</span>Balón
                                    </button>
                                    <button id="tool-cone" class="tb-btn" draggable="true" ondragstart="event.dataTransfer.setData('tool', 'cone')" onclick="DTEngine.FabricEngine.setTool('cone')" title="Cono">
                                        <span class="tb-icon">🔺</span>Cono
                                    </button>
                                    <button id="tool-minigoal" class="tb-btn" draggable="true" ondragstart="event.dataTransfer.setData('tool', 'minigoal')" onclick="DTEngine.FabricEngine.setTool('minigoal')" title="Mini Arco">
                                        <span class="tb-icon">🥅</span>Arco
                                    </button>
                                    <button id="tool-text" class="tb-btn" onclick="DTEngine.FabricEngine.setTool('text')" title="Texto libre">
                                        <span class="tb-icon">T</span>Texto
                                    </button>
                                </div>

                                <!-- ─── GRUPO 5: RUTAS / FLECHAS ─── -->
                                <div class="tb-group">
                                    <span class="tb-label">🏃 Rutas</span>
                                    <button id="tool-arrow-pass" class="tb-btn" onclick="DTEngine.FabricEngine.setTool('arrow-pass')" title="Pase (línea punteada con flecha)">
                                        <span style="font-size:0.9rem; letter-spacing:-1px;">--→</span>Pase
                                    </button>
                                    <button id="tool-arrow-run" class="tb-btn" onclick="DTEngine.FabricEngine.setTool('arrow-run')" title="Conducción (curva con flecha)">
                                        <span style="font-size:0.9rem;">↝→</span>Cond.
                                    </button>
                                    <button id="tool-arrow-solid" class="tb-btn" onclick="DTEngine.FabricEngine.setTool('arrow-solid')" title="Flecha sólida">
                                        <span style="font-size:0.9rem;">──→</span>Flecha
                                    </button>
                                </div>

                                <!-- ─── GRUPO 6: ZONAS ─── -->
                                <div class="tb-group">
                                    <span class="tb-label">⬛ Zonas</span>
                                    <button id="tool-zone-solid" class="tb-btn" onclick="DTEngine.FabricEngine.setTool('zone-solid')" title="Zona Rondo (verde)">
                                        <span style="display:inline-block; width:18px; height:12px; border:2px solid rgba(0,240,255,0.8); border-radius:2px; background:rgba(0,240,255,0.1);"></span>Zona
                                    </button>
                                    <button id="tool-zone-dashed" class="tb-btn" onclick="DTEngine.FabricEngine.setTool('zone-dashed')" title="Zona Punteada (amarilla)">
                                        <span style="display:inline-block; width:18px; height:12px; border:2px dashed rgba(251,191,36,0.8); border-radius:2px; background:rgba(251,191,36,0.07);"></span>Punteada
                                    </button>
                                    <button id="tool-zone-red" class="tb-btn" onclick="DTEngine.FabricEngine.setTool('zone-red')" title="Zona Presión (roja)">
                                        <span style="display:inline-block; width:18px; height:12px; border:2px solid rgba(239,68,68,0.8); border-radius:2px; background:rgba(239,68,68,0.1);"></span>Presión
                                    </button>
                                </div>

                                <!-- ─── GRUPO 7: OPCIONES ─── -->
                                <div class="tb-group">
                                    <span class="tb-label">⚙️</span>
                                    <label class="tb-toggle" title="Activar cuadrícula magnética para alinear elementos">
                                        <input type="checkbox" id="snap-grid-toggle" onchange="DTEngine.FabricEngine.toggleSnapGrid(this.checked)">
                                        Snap Grid
                                    </label>
                                </div>

                                <!-- ─── SPACER + ACCIONES ─── -->
                                <div style="flex:1;"></div>
                                <div class="tb-group">
                                    <button class="tb-btn tb-danger" onclick="DTEngine.FabricEngine.deleteSelected()" title="Eliminar seleccionado">
                                        <span class="tb-icon">🗑️</span>Borrar
                                    </button>
                                    <button class="tb-btn tb-danger" onclick="DTEngine.clearCanvas()" title="Limpiar toda la pizarra">
                                        <span class="tb-icon">💣</span>Limpiar
                                    </button>
                                    <button onclick="DTEngine.closeCustomTaskModal()"
                                        style="padding:8px; background:transparent; border:none; color:#6b7280; font-size:1.3rem; cursor:pointer; border-radius:6px; transition:color 0.15s; line-height:1;"
                                        onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#6b7280'">✕</button>
                                </div>


                            <!-- Canvas container (Fabric.js) -->
                            <div id="premium-tactical-board-container" style="flex-grow: 1; flex-shrink: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; position:relative; width: 100%;">
                                <!-- Campo SVG (fondo decorativo — z-index:1, bajo el canvas Fabric) -->
                                <svg id="ct-pitch-svg" viewBox="0 0 105 68" preserveAspectRatio="none" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:none;">
                                    <rect width="105" height="68" fill="#1a4a1a"/>
                                    <rect x="0" y="0" width="105" height="68" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.6"/>
                                    <line x1="52.5" y1="0" x2="52.5" y2="68" stroke="rgba(255,255,255,0.3)" stroke-width="0.6"/>
                                    <circle cx="52.5" cy="34" r="9.15" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.6"/>
                                    <circle cx="52.5" cy="34" r="0.7" fill="rgba(255,255,255,0.5)"/>
                                    <rect x="0" y="13.84" width="16.5" height="40.32" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.6"/>
                                    <rect x="0" y="26.84" width="5.5" height="14.32" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.6"/>
                                    <rect x="88.5" y="13.84" width="16.5" height="40.32" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.6"/>
                                    <rect x="99.5" y="26.84" width="5.5" height="14.32" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.6"/>
                                    <circle cx="11" cy="34" r="0.5" fill="rgba(255,255,255,0.5)"/>
                                    <circle cx="94" cy="34" r="0.5" fill="rgba(255,255,255,0.5)"/>
                                    <!-- Arcos -->
                                    <path d="M 16.5 24.84 A 9.15 9.15 0 0 1 16.5 43.16" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.6"/>
                                    <path d="M 88.5 24.84 A 9.15 9.15 0 0 0 88.5 43.16" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.6"/>
                                </svg>
                                <!-- Canvas Fabric.js — transparent background, z-index:10 -->
                                <canvas id="premium-tactical-board" style="position:absolute; top:0; left:0; z-index:10;"></canvas>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Modal de Tarea (Ficha Técnica) -->
                <div id="dt-modal" class="modal-overlay hidden" onclick="DTEngine.closeModal()">
                    <div class="modal-content" onclick="event.stopPropagation()">
                        <div id="modal-body-content"></div>
                    </div>
                </div>

                <!-- ═══ MODAL: PLANIFICACIÓN ANUAL ═══ -->
                <div id="modal-season-planning" class="spm-overlay hidden" onclick="if(event.target===this) window.SeasonPlanningModal.close()">
                    <div class="spm-panel" onclick="event.stopPropagation()">
                        <div class="spm-header">
                            <div>
                                <p class="spm-eyebrow">PLANIFICACIÓN ANUAL</p>
                                <h2 class="spm-title">Editar Temporada</h2>
                            </div>
                            <button class="spm-close-btn" onclick="window.SeasonPlanningModal.close()">✕</button>
                        </div>

                        <div class="spm-body">
                            <!-- Nombre de Temporada -->
                            <div class="spm-field-group">
                                <label class="spm-label">NOMBRE DE TEMPORADA</label>
                                <input type="text" id="spm-temporada" class="spm-input" placeholder="Ej: Temporada 2026">
                            </div>

                            <div class="spm-divider"></div>

                            <!-- PRETEMPORADA -->
                            <div class="spm-phase-block">
                                <div class="spm-phase-title" style="--phase-color: #f59e0b;">⬤ Pretemporada</div>
                                <div class="spm-dates-row">
                                    <div class="spm-field-group">
                                        <label class="spm-label">INICIO</label>
                                        <input type="date" id="spm-pre-start" class="spm-input">
                                    </div>
                                    <div class="spm-field-group">
                                        <label class="spm-label">FIN</label>
                                        <input type="date" id="spm-pre-end" class="spm-input">
                                    </div>
                                </div>
                                <label class="spm-label" style="margin-top:10px;">OBJETIVOS DE FASE</label>
                                <div class="spm-tag-input-row">
                                    <input type="text" id="spm-pre-inp" class="spm-input spm-tag-input" list="spm-obj-list" placeholder="Buscar objetivo..." autocomplete="off"
                                        onkeydown="if(event.key==='Enter'){event.preventDefault();window.SeasonPlanningModal._handleTagInput('spm-pre-inp','spm-pre-tags')}"
                                        onchange="window.SeasonPlanningModal._handleTagInput('spm-pre-inp','spm-pre-tags');this.value='';">
                                    <button type="button" class="spm-tag-add-btn" onclick="window.SeasonPlanningModal._handleTagInput('spm-pre-inp','spm-pre-tags')">+</button>
                                </div>
                                <div id="spm-pre-tags" class="spm-tags-container"></div>
                            </div>

                            <!-- COMPETENCIA -->
                            <div class="spm-phase-block">
                                <div class="spm-phase-title" style="--phase-color: #00F2FE;">⬤ Competencia</div>
                                <div class="spm-dates-row">
                                    <div class="spm-field-group">
                                        <label class="spm-label">INICIO</label>
                                        <input type="date" id="spm-comp-start" class="spm-input">
                                    </div>
                                    <div class="spm-field-group">
                                        <label class="spm-label">FIN</label>
                                        <input type="date" id="spm-comp-end" class="spm-input">
                                    </div>
                                </div>
                                <label class="spm-label" style="margin-top:10px;">OBJETIVOS DE FASE</label>
                                <div class="spm-tag-input-row">
                                    <input type="text" id="spm-comp-inp" class="spm-input spm-tag-input" list="spm-obj-list" placeholder="Buscar objetivo..." autocomplete="off"
                                        onkeydown="if(event.key==='Enter'){event.preventDefault();window.SeasonPlanningModal._handleTagInput('spm-comp-inp','spm-comp-tags')}"
                                        onchange="window.SeasonPlanningModal._handleTagInput('spm-comp-inp','spm-comp-tags');this.value='';">
                                    <button type="button" class="spm-tag-add-btn" onclick="window.SeasonPlanningModal._handleTagInput('spm-comp-inp','spm-comp-tags')">+</button>
                                </div>
                                <div id="spm-comp-tags" class="spm-tags-container"></div>
                            </div>

                            <!-- PLAY-OFFS -->
                            <div class="spm-phase-block">
                                <div class="spm-phase-title" style="--phase-color: #a855f7;">⬤ Play-offs</div>
                                <div class="spm-dates-row">
                                    <div class="spm-field-group">
                                        <label class="spm-label">INICIO</label>
                                        <input type="date" id="spm-playoffs-start" class="spm-input">
                                    </div>
                                    <div class="spm-field-group">
                                        <label class="spm-label">FIN</label>
                                        <input type="date" id="spm-playoffs-end" class="spm-input">
                                    </div>
                                </div>
                                <label class="spm-label" style="margin-top:10px;">OBJETIVOS DE FASE</label>
                                <div class="spm-tag-input-row">
                                    <input type="text" id="spm-playoffs-inp" class="spm-input spm-tag-input" list="spm-obj-list" placeholder="Buscar objetivo..." autocomplete="off"
                                        onkeydown="if(event.key==='Enter'){event.preventDefault();window.SeasonPlanningModal._handleTagInput('spm-playoffs-inp','spm-playoffs-tags')}"
                                        onchange="window.SeasonPlanningModal._handleTagInput('spm-playoffs-inp','spm-playoffs-tags');this.value='';">
                                    <button type="button" class="spm-tag-add-btn" onclick="window.SeasonPlanningModal._handleTagInput('spm-playoffs-inp','spm-playoffs-tags')">+</button>
                                </div>
                                <div id="spm-playoffs-tags" class="spm-tags-container"></div>
                            </div>

                            <!-- TRANSICIÓN -->
                            <div class="spm-phase-block">
                                <div class="spm-phase-title" style="--phase-color: #6b7280;">⬤ Transición</div>
                                <div class="spm-dates-row">
                                    <div class="spm-field-group">
                                        <label class="spm-label">INICIO</label>
                                        <input type="date" id="spm-trans-start" class="spm-input">
                                    </div>
                                    <div class="spm-field-group">
                                        <label class="spm-label">FIN</label>
                                        <input type="date" id="spm-trans-end" class="spm-input">
                                    </div>
                                </div>
                                <label class="spm-label" style="margin-top:10px;">OBJETIVOS DE FASE</label>
                                <div class="spm-tag-input-row">
                                    <input type="text" id="spm-trans-inp" class="spm-input spm-tag-input" list="spm-obj-list" placeholder="Buscar objetivo..." autocomplete="off"
                                        onkeydown="if(event.key==='Enter'){event.preventDefault();window.SeasonPlanningModal._handleTagInput('spm-trans-inp','spm-trans-tags')}"
                                        onchange="window.SeasonPlanningModal._handleTagInput('spm-trans-inp','spm-trans-tags');this.value='';">
                                    <button type="button" class="spm-tag-add-btn" onclick="window.SeasonPlanningModal._handleTagInput('spm-trans-inp','spm-trans-tags')">+</button>
                                </div>
                                <div id="spm-trans-tags" class="spm-tags-container"></div>
                            </div>
                        </div>

                        <!-- Global datalist shared by all phase inputs -->
                        <datalist id="spm-obj-list">${predefinedObjectives.map(o => `<option value="${o}">`).join('')}</datalist>

                        <div class="spm-footer">
                            <button class="spm-btn-cancel" onclick="window.SeasonPlanningModal.close()">Cancelar</button>
                            <button class="spm-btn-save" onclick="window.SeasonPlanningModal.save()">💾 Guardar Planificación</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // --- AISLAMIENTO TOTAL DE NAVEGACIÓN (Bloqueo de Bubbling) ---
        setTimeout(() => {
            const bp = document.getElementById('btn-prev-month');
            const bn = document.getElementById('btn-next-month');
            if (bp) {
                bp.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.changeMonth(e, -1);
                    return false;
                };
            }
            if (bn) {
                bn.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    this.changeMonth(e, 1);
                    return false;
                };
            }
        }, 0);

        // await this.fetchExercises(); // Eliminado: Ahora es global
        await this.fetchMonthLogs();

        // --- FLUJO ESTRICTO DE RENDERIZADO ---
        this.generateCalendar();   // 1. Grilla y Tareas
        this.updateHomeUI();       // 2. Timeline
        
        // --- AUTO-ENCENDIDO DEL HOME ---
        this.toggleView('home');

        // --- INICIALIZAR COMPONENTES DE PERFIL ---
        if (this.TagInput) this.TagInput.init();
        if (this.RulesTagInput) this.RulesTagInput.init();
        if (this.PitchEngine && typeof this.PitchEngine.init === 'function') this.PitchEngine.init();
        if (this.Board && typeof this.Board.init === 'function') this.Board.init();

        // 3. Sincronizar Analítica solo si hay biblioteca
        if (window.ExercisesLibrary) {
            const anView = document.getElementById('dt-analytics-view');
            if (anView && anView.style.display === 'block') {
                this.renderAnalytics();
            }
        }
    },

    // fetchExercises eliminada, integrada en App.fetchExercisesLibrary

    generateCalendar() {
        const grid = document.getElementById('dt-calendar-grid');
        if (!grid) return;

        const year = this._currentDate.getFullYear();
        const month = this._currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;

        let html = '';
        ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(n => html += `<div class="day-h">${n}</div>`);

        for (let i = 0; i < startOffset; i++) html += `<div class="macro-day empty"></div>`;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const label = this.calcularEtiquetaMD(dateStr, Array.from(this._matchDays));
            const typeClass = this.getTypeClass(label);

            const cellDate = new Date(dateStr + 'T00:00:00');
            const isPast = cellDate < today;
            const pastClass = isPast ? 'past-day' : '';

            const assignments = this._assignedTasks[dateStr] || [];

            const renderBlock = (blockId, title) => {
                const tasks = assignments.filter(a => a.block === blockId);
                const tasksHtml = tasks.map((a) => {
                    // Dual matching: numeric legacy ID OR UUID string (Supabase primary key)
                    const findEx = (lib) => (lib || []).find(e =>
                        String(e.numericId) === String(a.id) ||
                        String(e.id) === String(a.rawId || a.id)
                    );
                    const ex = findEx(window.ExercisesLibrary) || findEx(window.CustomExercises);
                    if (!ex) return '';

                    let timeBadge = '';
                    const ser = ex.series || ex.blocks;
                    const wrk = ex.work_time || ex.duration;
                    const pse = ex.pause_time;
                    if (ser && wrk) {
                        const pausePart = pse ? ` (${pse}')` : '';
                        timeBadge = `<span style="color:#00F2FE;font-size:0.6rem;font-weight:700;margin-right:3px;white-space:nowrap;">⏱ ${ser}x${wrk}'${pausePart}</span>`;
                    } else if (wrk) {
                        timeBadge = `<span style="color:#00F2FE;font-size:0.6rem;font-weight:700;margin-right:3px;">⏱ ${wrk}'</span>`;
                    }
                    return `
                        <div class="task-chip" draggable="${!isPast}" ondragstart="event.dataTransfer.setData('text/plain', '${a.logId}|${a.block}|${dateStr}'); event.stopPropagation();" onclick="window.DTEngine.openTaskModal(event, '${a.rawId || a.id}')">
                            ${timeBadge}<span class="tc-name">${ex.title}</span>
                            ${!isPast ? `<span class="tc-delete" onclick="window.DTEngine.removeTask(event, '${dateStr}', ${assignments.indexOf(a)})">\u00d7</span>` : ''}
                        </div>
                    `;
                }).join('');

                return `
                    <div class="session-block ${blockId}" ondragover="event.preventDefault();" ondrop="event.preventDefault(); event.stopPropagation(); window.DTEngine.handleTaskDrop(event, '${dateStr}', '${blockId}')">
                        ${tasks.length > 0 ? `<span class="sb-title">${title}</span>` : ''}
                        <div class="sb-tasks">${tasksHtml}</div>
                    </div>
                `;
            };

            const hasTasks = assignments.length > 0;

            const ptSuggestions = { "MD-4": "Tensión", "MD-3": "Duración", "MD-2": "Velocidad", "MD-1": "Activación", "MD+1": "Recup. Activa", "MD+2": "Descanso" };
            const sugBadge = (label && ptSuggestions[label]) ? `<span class="m-day-suggestion" style="font-size: 0.6rem; color: #a1a1aa; background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 4px; margin-top: 2px;">Sug: ${ptSuggestions[label]}</span>` : '';

            const isMatch = this._matchDays.has(dateStr);
            const matchBtnStyle = isMatch
                ? 'background:rgba(0,242,254,0.25); border-color:#00F2FE; box-shadow:0 0 6px rgba(0,242,254,0.4);'
                : 'background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.15);';

            const session = (this._microcycleSessions && this._microcycleSessions[dateStr]) || null;
            const enfoqueBadge = (session && session.enfoque) ? `<span class="badge-enfoque" style="font-size: 0.65rem; font-weight: 700; color: #00F2FE; background: rgba(0,242,254,0.1); padding: 2px 6px; border-radius: 4px; margin-top: 4px;">${session.enfoque}</span>` : '';
            const volumenText = (session && session.volumen_minutos) ? `<span class="text-muted" style="font-size: 0.7rem; color: #a1a1aa; font-weight: 600; margin-top: 2px;">⏱ ${session.volumen_minutos} min</span>` : '';
            const rivalBadge = (isMatch && session && session.rival) ? `<div class="rival-badge" style="font-size: 0.75rem; color: #fff; background: rgba(255,59,48,0.2); border: 1px solid rgba(255,59,48,0.5); padding: 3px 6px; border-radius: 4px; margin-top: 4px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center;">🆚 ${session.rival}</div>` : '';

            html += `
                <div class="macro-day ${typeClass ? typeClass : ''} ${pastClass}${hasTasks && isPast ? ' has-tasks' : ''}" data-date="${dateStr}" onclick="${isPast ? 'void(0)' : `DTEngine.openDrawer('${dateStr}')`}">
                    <div class="m-day-top">
                        <span class="m-day-num">${d}</span>
                        <div style="display: flex; align-items: flex-start; gap: 4px;">
                            ${!isPast ? `<button onclick="event.stopPropagation(); window.DTEngine.toggleCalendarMatchDay('${dateStr}', this)" title="Marcar como Día de Partido" style="width:22px; height:22px; border-radius:5px; border:1.5px solid; font-size:0.7rem; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; transition:all 0.2s; flex-shrink:0; ${matchBtnStyle}">⚽</button>` : ''}
                            <div style="display: flex; flex-direction: column; align-items: flex-end;">
                                <span class="m-day-label ${label === '' ? 'label-libre' : ''}">${label}</span>
                                ${sugBadge}
                                ${enfoqueBadge}
                                ${volumenText}
                                ${rivalBadge}
                            </div>
                        </div>
                        ${isPast && hasTasks ? '<span class="past-hist-badge">HIST</span>' : ''}
                    </div>
                    <div class="m-day-content">
                        ${renderBlock('gimnasio', 'Gimnasio')}
                        ${renderBlock('entrada_calor', 'Entrada en Calor')}
                        ${renderBlock('parte_principal', 'Parte Principal')}
                        ${renderBlock('doble_turno', '2º Turno / Táctica')}
                        ${renderBlock('vuelta_calma', 'Vuelta a la Calma')}
                    </div>
                </div>
            `;
        }
        grid.innerHTML = html;
    },

    calcularEtiquetaMD(fechaActual, arrayFechasPartidos) {
        if (arrayFechasPartidos.includes(fechaActual)) return 'MD';

        const current = new Date(fechaActual + 'T00:00:00');

        let diasPost = Infinity;
        let diasPre = Infinity;

        // 1. Buscar partido anterior más cercano
        for (let i = 1; i <= 60; i++) {
            const prev = new Date(current);
            prev.setDate(current.getDate() - i);
            const prevStr = prev.toISOString().split('T')[0];
            if (arrayFechasPartidos.includes(prevStr)) {
                diasPost = i;
                break;
            }
        }

        // 2. Buscar partido siguiente más cercano
        for (let i = 1; i <= 60; i++) {
            const fut = new Date(current);
            fut.setDate(current.getDate() + i);
            const futStr = fut.toISOString().split('T')[0];
            if (arrayFechasPartidos.includes(futStr)) {
                diasPre = i;
                break;
            }
        }

        let etiquetaFinal = "";

        if (diasPost === 1) {
            etiquetaFinal = "MD+1"; // PRIORIDAD ABSOLUTA: Si jugué ayer, hoy recupero. No importa si juego mañana de nuevo.
        } else if (diasPost === 2) {
            etiquetaFinal = "MD+2"; // PRIORIDAD: Descanso o recuperación compensatoria.
        } else if (diasPre > 0 && diasPre !== Infinity) {
            etiquetaFinal = "MD-" + diasPre; // Recién a partir del 3er día post-partido, miro hacia el futuro partido.
        } else {
            etiquetaFinal = ""; // Sin partidos a la vista
        }

        return etiquetaFinal;
    },


    getTypeClass(label) {
        if (!label) return 'type-base';
        if (label === 'MD' || label.includes('PARTIDO')) return 'type-partido';
        if (label.includes('MD-4') || label.includes('Tensión')) return 'type-tension';
        if (label.includes('MD-3') || label.includes('Duración')) return 'type-duracion';
        if (label.includes('MD-2') || label.includes('Velocidad')) return 'type-velocidad';
        if (label.includes('MD-1') || label.includes('Activación')) return 'type-activacion';
        if (label.includes('MD+1') || label.includes('MD+2') || label.includes('RECUPERACIÓN')) return 'type-recuperacion';
        if (label.includes('DESCANSO')) return 'type-descanso';
        return 'type-base';
    },

    async openDrawer(date) {
        this._selectedDate = date;
        this._showAllExercises = false;

        // Poblar título y etiqueta
        document.getElementById('drawer-date-title').innerText = date;

        // Resetear controles
        const enfoqueEl = document.getElementById('drawer-enfoque');
        const especEl = document.getElementById('drawer-especificidad');
        const volEl = document.getElementById('drawer-volumen');
        const saveBtn = document.getElementById('drawer-save-btn');

        if (enfoqueEl) enfoqueEl.value = 'Tensión';
        if (especEl) especEl.value = '0.4';
        if (volEl) volEl.value = '';
        if (saveBtn) saveBtn.textContent = 'GUARDAR SESIÓN';

        const rivalContainer = document.getElementById('rival-container');
        const rivalInput = document.getElementById('macro-rival');
        const isMatch = this._matchDays.has(date);

        if (rivalContainer) rivalContainer.style.display = isMatch ? 'block' : 'none';
        if (rivalInput) rivalInput.value = '';

        this.updateDrawerUI();
        document.getElementById('dt-drawer').classList.remove('hidden');

        // Cargar datos existentes de microcycle_sessions
        const teamId = window.CurrentTeam?.id || localStorage.getItem('ravix_team_id') || window.CurrentUser?.team_id;
        if (teamId) {
            try {
                const { data: sessionData } = await window.supabase
                    .from('microcycle_sessions')
                    .select('*')
                    .eq('team_id', teamId)
                    .eq('fecha', date)
                    .maybeSingle();

                if (sessionData) {
                    if (enfoqueEl && sessionData.enfoque) enfoqueEl.value = sessionData.enfoque;
                    if (especEl && sessionData.indice_especificidad) especEl.value = sessionData.indice_especificidad;
                    if (volEl && sessionData.volumen_minutos) volEl.value = sessionData.volumen_minutos;
                    if (sessionData.is_match_day) {
                        this._matchDays.add(date);
                        if (rivalContainer) rivalContainer.style.display = 'block';
                    }
                    if (sessionData.rival && rivalInput) {
                        rivalInput.value = sessionData.rival;
                    }
                }
            } catch (e) { console.error('Error cargando sesión del día:', e); }
        }
    },

    // ── TOGGLE MATCH DAY DESDE CALENDARIO ──
    async toggleCalendarMatchDay(dateStr, btnEl) {
        const wasMatch = this._matchDays.has(dateStr);

        // Toggle estado local
        if (wasMatch) {
            this._matchDays.delete(dateStr);
        } else {
            this._matchDays.add(dateStr);
        }

        // Feedback visual inmediato en el botón
        const isNowMatch = this._matchDays.has(dateStr);
        if (btnEl) {
            btnEl.style.background = isNowMatch ? 'rgba(0,242,254,0.25)' : 'rgba(255,255,255,0.06)';
            btnEl.style.borderColor = isNowMatch ? '#00F2FE' : 'rgba(255,255,255,0.15)';
            btnEl.style.boxShadow = isNowMatch ? '0 0 6px rgba(0,242,254,0.4)' : 'none';
        }

        // Si el drawer está abierto para este mismo día, actualizar la UI del rival
        if (this._selectedDate === dateStr) {
            const rivalContainer = document.getElementById('rival-container');
            const rivalInput = document.getElementById('macro-rival');
            if (isNowMatch) {
                if (rivalContainer) rivalContainer.style.display = 'block';
            } else {
                if (rivalContainer) rivalContainer.style.display = 'none';
                if (rivalInput) rivalInput.value = '';
            }
        }

        // Sincronizar con CurrentTeam
        if (window.CurrentTeam) {
            window.CurrentTeam.match_dates = Array.from(this._matchDays);
        }

        // Persistir en Supabase
        try {
            await this.saveMatchDays();
            console.log(`✅ Match Day ${isNowMatch ? 'activado' : 'desactivado'}: ${dateStr}`);
        } catch (e) {
            console.error('❌ Error guardando Match Day:', e);
            // Rollback
            if (wasMatch) this._matchDays.add(dateStr);
            else this._matchDays.delete(dateStr);
        }

        // Re-renderizar calendario para actualizar etiquetas MD-x
        this.generateCalendar();
    },



    // ── GUARDADO UNIFICADO (UPSERT) ──
    async guardarDrawerSession() {
        const teamId = window.CurrentTeam?.id || localStorage.getItem('ravix_team_id') || window.CurrentUser?.team_id;
        if (!teamId) { alert('Error: No se encontró el ID del equipo.'); return; }

        const dateStr = this._selectedDate;
        if (!dateStr) return;

        const enfoque = document.getElementById('drawer-enfoque')?.value || 'Tensión';
        const especificidad = document.getElementById('drawer-especificidad')?.value || '0.4';
        const isMatch = this._matchDays.has(dateStr);
        const volumen = document.getElementById('drawer-volumen')?.value || null;

        const rivalInput = document.getElementById('macro-rival');
        const rival = (isMatch && rivalInput) ? rivalInput.value.trim() : null;

        const payload = {
            team_id: teamId,
            fecha: dateStr,
            enfoque: enfoque,
            volumen_minutos: volumen ? parseInt(volumen) : null,
            indice_especificidad: parseFloat(especificidad),
            is_match_day: isMatch,
            rival: rival || null
        };

        const btn = document.getElementById('drawer-save-btn');
        const oldText = btn ? btn.textContent : 'GUARDAR SESIÓN';
        if (btn) btn.textContent = 'GUARDANDO...';

        try {
            const { error } = await window.supabase
                .from('microcycle_sessions')
                .upsert([payload], { onConflict: 'team_id,fecha' });

            if (error) throw error;

            if (btn) btn.textContent = '¡GUARDADO!';
            console.log('✅ Sesión guardada:', payload);

            // Sincronizar match days si cambió
            if (isMatch) this._matchDays.add(dateStr);
            else this._matchDays.delete(dateStr);
            if (window.CurrentTeam) window.CurrentTeam.match_dates = Array.from(this._matchDays);
            await this.saveMatchDays();

            // Refrescar calendario
            this.generateCalendar();

            setTimeout(() => { if (btn) btn.textContent = oldText; }, 2000);
        } catch (e) {
            console.error('❌ Error al guardar sesión:', e);
            alert('Error al guardar la sesión.');
            if (btn) btn.textContent = oldText;
        }
    },

    async eliminarDrawerSession() {
        const teamId = window.CurrentTeam?.id;
        const dateStr = this._selectedDate;
        if (!teamId || !dateStr) return;

        if (!confirm('¿Seguro que deseas eliminar la planificación de este día?')) return;

        try {
            const { error } = await window.supabase
                .from('microcycle_sessions')
                .delete()
                .match({ team_id: teamId, fecha: dateStr });

            if (error) throw error;

            console.log('✅ Sesión eliminada:', dateStr);

            // Limpiar estado local
            if (this._microcycleSessions && this._microcycleSessions[dateStr]) {
                delete this._microcycleSessions[dateStr];
            }
            if (this._matchDays.has(dateStr)) {
                this._matchDays.delete(dateStr);
                if (window.CurrentTeam) window.CurrentTeam.match_dates = Array.from(this._matchDays);
                await this.saveMatchDays();
            }

            // Limpiar UI
            const enfoqueEl = document.getElementById('drawer-enfoque');
            const especEl = document.getElementById('drawer-especificidad');
            const volEl = document.getElementById('drawer-volumen');
            const rivalInput = document.getElementById('macro-rival');
            if (enfoqueEl) enfoqueEl.value = 'Tensión';
            if (especEl) especEl.value = '0.4';
            if (volEl) volEl.value = '';
            if (rivalInput) rivalInput.value = '';

            // Refrescar calendario y cerrar
            this.generateCalendar();
            this.closeDrawer();

            alert('Sesión eliminada correctamente.');
        } catch (e) {
            console.error('❌ Error al eliminar sesión:', e);
            alert('Error al eliminar la sesión.');
        }
    },

    async forceLabel(val) {
        // 1. Sanitización Estricta de la Fecha
        let sanitizedDate = String(this._selectedDate).substring(0, 10);
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(sanitizedDate)) {
            console.error("❌ Error: formato de fecha inválido para override", this._selectedDate);
            return;
        }

        const teamId = (window.App && window.App.user && window.App.user.team_id) || window.CurrentTeam?.id || localStorage.getItem('ravix_team_id') || window.CurrentUser?.team_id;
        if (!teamId) {
            console.error("No hay teamId.");
            return;
        }

        const wasMatch = this._matchDays.has(sanitizedDate);
        const isMatch = (val === 'PARTIDO');

        try {
            // Sincronizar match_dates (Nuevo Paradigma)
            if (isMatch) this._matchDays.add(sanitizedDate);
            else this._matchDays.delete(sanitizedDate);

            if (window.CurrentTeam) {
                window.CurrentTeam.match_dates = Array.from(this._matchDays);
            }

            if (isMatch !== wasMatch) {
                await this.saveMatchDays();
                console.log(`✅ Estado de partido actualizado: ${sanitizedDate} -> ${isMatch}`);
            }

            // Refrescar UI (sincronización final)
            this.generateCalendar();
            this.updateDrawerUI();

        } catch (err) {
            console.error("❌ Error guardando (rollback):", err);
            alert("Error al guardar. Se revertirá a su estado anterior.");

            // Rollback UI local
            if (wasMatch) this._matchDays.add(sanitizedDate);
            else this._matchDays.delete(sanitizedDate);

            if (window.CurrentTeam) {
                window.CurrentTeam.match_dates = Array.from(this._matchDays);
            }

            const selector = document.getElementById('label-selector');
            if (selector) selector.value = wasMatch ? 'PARTIDO' : 'BASE';
        }
    },

    async saveMatchDays() {
        const teamId = window.CurrentTeam?.id;
        const userId = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        if (!teamId || !userId || !token) return;

        const payload = {
            team_id: teamId,
            owner_id: userId,
            match_dates: Array.from(this._matchDays)
        };

        try {
            const { error: upsertErr } = await window.supabase.from('team_configs').upsert(payload, { onConflict: 'team_id' });
            if (upsertErr) throw upsertErr;
            console.log("🟢 Configuración de Morfociclo persistida.");
        } catch (e) { console.error("Error al guardar morfociclo:", e); }
    },

    updateDrawerUI() {
        const etiquetaReal = this.calcularEtiquetaMD(this._selectedDate, Array.from(this._matchDays));
        document.getElementById('drawer-methodology-label').innerText = etiquetaReal;
        this.renderLibrary(etiquetaReal);
    },



    renderLibrary(currentLabel) {
        const container = document.getElementById('library-list');
        if (!container) return;

        // ── DIAGNÓSTICO FASE 2 ──────────────────────────────────────────
        const libraryData = window.ExercisesLibrary || [];
        console.log('🏋️ Datos de exercises_library recibidos:', libraryData.length, 'ejercicios');
        if (libraryData.length > 0) console.log('🏋️ Muestra ejercicio[0]:', libraryData[0]);
        // ───────────────────────────────────────────────────────────────

        // --- FUENTES DE DATOS ---
        const customTasks = window.CustomExercises || [];
        const globalTasks = libraryData;

        // --- RENDER CUSTOM (prioridad, badge dorado) ---
        const customFiltered = customTasks;

        const customHTML = customFiltered.map(ex => {
            const isStaged = this._stagedTasks.some(t => String(t.id) === String(ex.numericId) && t.isCustom);
            return `
                <div class="exercise-card custom-task-card ${isStaged ? 'staged-card' : ''}">
                    <div class="ex-info" onclick="DTEngine.openTaskModal('${ex.numericId}')" style="cursor: pointer;">
                        <span class="ex-id custom-badge">★ TUYA</span>
                        <h5 class="ex-title">${ex.title}</h5>
                        <p class="ex-meta">${ex.ssp_type || 'Personalizada'} | ${ex.game_moment || ex.description || ''}</p>
                    </div>
                    <div class="ex-actions">
                        <select class="block-select" id="select-c${ex.numericId}">
                            <option value="gimnasio">Gimnasio</option>
                            <option value="entrada_calor">E. Calor</option>
                            <option value="parte_principal" selected>P. Principal</option>
                            <option value="doble_turno">2º Turno</option>
                            <option value="vuelta_calma">V. Calma</option>
                        </select>
                        <button id="btn-add-c${ex.numericId}" class="ex-add-btn ${isStaged ? 'staged' : ''}" onclick="DTEngine.stageExercise('${ex.numericId}', true)">
                            ${isStaged ? '✓' : '+'}
                        </button>
                        <button type="button" class="ex-del-btn" style="background:transparent; border:none; color:#ff4444; font-size:1.1rem; cursor:pointer; padding:0 5px;" onclick="DTEngine.deleteCustomTask('${ex.numericId}')" title="Eliminar de mi Biblioteca">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

        // --- RENDER GLOBAL ---
        const globalHTML = globalTasks.map(ex => {
            const isStaged = this._stagedTasks.some(t => String(t.id) === String(ex.numericId) && !t.isCustom);
            return `
                <div class="exercise-card ${isStaged ? 'staged-card' : ''}">
                    <div class="ex-info" onclick="DTEngine.openTaskModal('${ex.numericId}')" style="cursor: pointer;">
                        <span class="ex-id">#${ex.numericId}</span>
                        <h5 class="ex-title">${ex.title}</h5>
                        <p class="ex-meta">${ex.ssp_type || 'Universal'} | ${ex.game_moment || ''}</p>
                    </div>
                    <div class="ex-actions">
                        <select class="block-select" id="select-${ex.numericId}">
                            <option value="gimnasio">Gimnasio</option>
                            <option value="entrada_calor">E. Calor</option>
                            <option value="parte_principal" selected>P. Principal</option>
                            <option value="doble_turno">2º Turno</option>
                            <option value="vuelta_calma">V. Calma</option>
                        </select>
                        <button id="btn-add-${ex.numericId}" class="ex-add-btn ${isStaged ? 'staged' : ''}" onclick="DTEngine.stageExercise('${ex.numericId}', false)">
                            ${isStaged ? '✓' : '+'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        const combined = customHTML + globalHTML;
        container.innerHTML = combined || '<p class="empty-msg">No hay tareas para esta fase.</p>';
    },

    _stagedTasks: [],

    // Almacena la etiqueta temporalmente sin persistir (Lazy Execution)
    stageLabel(val) {
        this._stagedLabel = val || null;
        // Preview visual inmediato en el drawer sin tocar Supabase
        const labelDisplay = document.getElementById('drawer-methodology-label');
        if (labelDisplay) {
            labelDisplay.textContent = val ? `Etiqueta: ${val} (pendiente de guardar)` : this.calcularEtiquetaMD(this._selectedDate, Array.from(this._matchDays));
        }
    },

    stageExercise(id, isCustom = false) {
        const selectEl = document.getElementById(isCustom ? `select-c${id}` : `select-${id}`);
        const block = selectEl ? selectEl.value : 'parte_principal';
        const btnEl = document.getElementById(isCustom ? `btn-add-c${id}` : `btn-add-${id}`);

        // Toggle selection
        const existingIdx = this._stagedTasks.findIndex(t => String(t.id) === String(id) && t.isCustom === isCustom);
        if (existingIdx > -1) {
            this._stagedTasks.splice(existingIdx, 1);
            if (btnEl) { btnEl.classList.remove('staged'); btnEl.innerText = '+'; }
        } else {
            this._stagedTasks.push({ id, block, isCustom });
            if (btnEl) { btnEl.classList.add('staged'); btnEl.innerText = '✓'; }
        }
    },

    async saveStagedTasks() {
        const hasLabel = this._stagedLabel !== null;
        const hasTasks = this._stagedTasks.length > 0;

        // Si no hay nada que guardar, simplemente cerrar
        if (!hasLabel && !hasTasks) return this.closeDrawer();

        try {
            // --- PASO 1: Ejecutar etiqueta diferida (si la hay) ---
            if (hasLabel) {
                console.log(`🏷️ Aplicando etiqueta diferida '${this._stagedLabel}' para ${this._selectedDate}`);
                await this.forceLabel(this._stagedLabel);
                this._stagedLabel = null;
            }

            // --- PASO 2: Guardar tareas seleccionadas (si las hay) ---
            if (hasTasks) {
                const teamId = window.CurrentTeam?.id;
                const userId = localStorage.getItem('ravix_v5_uid');
                const token = localStorage.getItem('ravix_token');
                const date = this._selectedDate;

                if (!teamId || !token) throw new Error("Sesión inválida");

                console.log(`💾 Guardando masivamente ${this._stagedTasks.length} tareas para ${date}...`);

                // Usar INSERT directo a training_logs con la columna 'fecha'
                const logsToInsert = this._stagedTasks.map(task => ({
                    user_id: userId,
                    team_id: teamId,
                    fecha: date,
                    scenario: task.block,
                    ejs_cods: [task.id.toString()]
                }));

                const { error } = await window.supabase.from('training_logs').insert(logsToInsert);
                if (error) throw error;

                this._stagedTasks = [];
                // Cadena estricta: fetch → render → labels (sin reconstruir shell)
                try {
                    await this.fetchMonthLogs();
                    this.generateCalendar();
                    console.log('✅ Post-guardado: calendario actualizado correctamente.');
                } catch (renderErr) {
                    console.error('🔴 Error en cadena post-guardado:', renderErr);
                }
            }

            this.closeDrawer();

        } catch (e) {
            console.error('🔴 Error al guardar tareas:', e);
            alert("Error al guardar cambios: " + e.message);
        }
    },

    // assignExercise antigua eliminada en favor de staging

    async handleTaskDrop(event, newDate, newBlock) {
        const data = event.dataTransfer.getData('text/plain');
        if (!data) return;
        const [logId, oldBlock, oldDate] = data.split('|');
        if (!logId || (oldDate === newDate && oldBlock === newBlock)) return;

        // Efectuamos la actualización estricta a Supabase
        await this.actualizarActividad(logId, { fecha: newDate, scenario: newBlock });
    },

    async actualizarActividad(idActividad, nuevosDatos) {
        try {
            const { data, error } = await window.supabase
                .from('training_logs')
                .update(nuevosDatos)
                .eq('id', idActividad);

            if (error) throw error;

            console.log("✅ Actividad actualizada en Supabase con éxito.");

            // Refrescar UI del calendario luego de modificar Supabase
            await this.refreshState();
        } catch (error) {
            console.error("❌ Error al actualizar en Supabase:", error.message);
            alert("Error al guardar los cambios en la base de datos.");
        }
    },

    async removeTask(e, date, index) {
        try {
            if (e && e.stopPropagation) {
                e.preventDefault();
                e.stopPropagation();
            }
            const task = this._assignedTasks[date][index];
            if (!task) return;

            const teamId = window.CurrentTeam?.id || localStorage.getItem('ravix_team_id') || window.CurrentUser?.team_id;
            if (!teamId) return alert("Error: Equipo no identificado.");

            console.log("🟡 Intentando desasignar tarea del calendario:", task);

            // 1. Lógica solicitada: Filtrar del array 'actividades' en microcycle_sessions
            const session = this._microcycleSessions && this._microcycleSessions[date];
            if (session) {
                let arrayActualizado = session.actividades || [];
                // Filtrar asegurando comparar id o ejercicio_id
                arrayActualizado = arrayActualizado.filter(act => {
                    const actId = String(act.id || act.ejercicio_id || act);
                    return actId !== String(task.rawId) && actId !== String(task.id);
                });

                const { error: sessionError } = await window.supabase
                    .from('microcycle_sessions')
                    .update({ actividades: arrayActualizado })
                    .eq('team_id', teamId)
                    .eq('fecha', date);

                if (sessionError) throw sessionError;
                session.actividades = arrayActualizado;
            }

            // 2. Fallback de persistencia: Borrar también el registro en training_logs
            if (task.logId) {
                await window.supabase.from('training_logs').delete().eq('id', task.logId);
            }

            // Refrescar el estado global de la UI
            await this.refreshState();

        } catch (error) {
            console.error("🔴 Error crítico al borrar en removeTask:", error);
            alert("Error al borrar: " + (error.message || error));
        }
    },

    async deleteCustomTask(taskId) {
        try {
            if (!confirm('¿Estás seguro de que deseas eliminar esta tarea de tu biblioteca para siempre?')) return;

            const uid = localStorage.getItem('ravix_v5_uid');
            if (!uid) return;

            const { error } = await window.supabase
                .from('custom_exercises')
                .delete()
                .eq('id', taskId)
                .eq('user_id', uid);

            if (error) throw error;

            // Eliminar del estado local
            if (window.CustomExercises) {
                window.CustomExercises = window.CustomExercises.filter(t => String(t.numericId) !== String(taskId) && String(t.id) !== String(taskId));
            }

            // Re-renderizar la biblioteca usando la etiqueta actual
            this.renderLibrary(this._stagedLabel || this.calcularEtiquetaMD(this._selectedDate, Array.from(this._matchDays)));

            if (this._showToast) this._showToast('🗑️ Tarea eliminada permanentemente', 'success');
        } catch (err) {
            console.error("🔴 Error al borrar custom task:", err);
            alert("Error al borrar la tarea: " + err.message);
        }
    },

    async openTaskModal(eventOrId, optionalId) {
        try {
            let taskId = optionalId !== undefined ? optionalId : eventOrId;
            let e = optionalId !== undefined ? eventOrId : null;
            if (e && e.stopPropagation) {
                e.preventDefault();
                e.stopPropagation();
            }
            console.log("Clic detectado en tarea ID:", taskId);
            const idBuscado = String(taskId);
            let task = (window.ExercisesLibrary || []).find(t => String(t.numericId) === idBuscado || String(t.id) === idBuscado) ||
                (window.CustomExercises || []).find(t => String(t.numericId) === idBuscado || String(t.id) === idBuscado);

            if (!task) {
                // FALLBACK DIRECTO A BASE DE DATOS
                const { data, error } = await window.supabase
                    .from('custom_exercises')
                    .select('*')
                    .eq('id', idBuscado)
                    .single();

                if (error) {
                    console.warn("⚠️ Error en fallback de Supabase:", error.message);
                }

                if (data) {
                    // Mapeo seguro para el frontend
                    task = { ...data, numericId: data.id, isCustom: true };
                } else {
                    console.warn("⚠️ Tarea no encontrada en memoria ni en BD. ID:", idBuscado);
                    return;
                }
            }

            if (!task) {
                console.warn("⚠️ Retorno temprano: La tarea resolvió a undefined.");
                return;
            }

            this.renderTaskModal(task);
        } catch (error) {
            console.error("Error abriendo popup:", error);
        }
    },

    renderTaskModal(task) {
        if (!task) return;

        const tagsHtml = Array.isArray(task?.tags)
            ? task.tags.map(t => `<span style="background:rgba(0,242,254,0.1);color:#00F2FE;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:700;margin-right:5px;border:1px solid rgba(0,242,254,0.3);">${t}</span>`).join('')
            : '';

        const htmlContent = `
            <div class="modal-header">
                <div class="m-title-group">
                    <span class="m-task-id">#${task.numericId}</span>
                    <h2 class="m-task-title">${task.title}</h2>
                    ${tagsHtml ? `<div style="margin-top:8px;">${tagsHtml}</div>` : ''}
                </div>
                <button class="premium-close" onclick="DTEngine.closeModal()" aria-label="Cerrar">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
            </div>
            <div class="modal-grid" style="grid-template-columns: 1fr;">
                <!-- Metadatos Base -->
                <div style="display:flex;gap:15px;background:rgba(255,255,255,0.03);padding:15px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);margin-bottom:15px;">
                    <div style="flex:1"><label style="font-size:0.65rem;color:#888;text-transform:uppercase;">Momento</label><p style="margin:2px 0 0;font-weight:700;color:#fff;">${String(task.game_moment || '').replace('_', ' ').toUpperCase()}</p></div>
                    <div style="flex:1"><label style="font-size:0.65rem;color:#888;text-transform:uppercase;">SSP</label><p style="margin:2px 0 0;font-weight:700;color:#fff;">${task.ssp_type || 'N/A'}</p></div>
                    <div style="flex:1"><label style="font-size:0.65rem;color:#888;text-transform:uppercase;">Materiales</label><p style="margin:2px 0 0;font-weight:700;color:#fff;">${task.materials || 'Balones, Conos'}</p></div>
                </div>

                <!-- Ficha Técnica Premium -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                    <div class="m-info-block">
                        <label style="color:#00F2FE;font-size:0.75rem;font-weight:bold;display:block;margin-bottom:5px;"><i class="fas fa-chess-board"></i> S.S.P. (Contexto de Juego)</label>
                        <p class="m-desc">${task.ssp_context || task.tactical_objective || task.description || '<span style="color:#6b7280;font-style:italic;">No definido para esta tarea</span>'}</p>
                    </div>
                    <div class="m-info-block">
                        <label style="color:#00F2FE;font-size:0.75rem;font-weight:bold;display:block;margin-bottom:5px;"><i class="fas fa-brain"></i> Principios Tácticos</label>
                        <p class="m-desc">${task.tactical_principles || '<span style="color:#6b7280;font-style:italic;">No definido para esta tarea</span>'}</p>
                    </div>
                    <div class="m-info-block">
                        <label style="color:#00F2FE;font-size:0.75rem;font-weight:bold;display:block;margin-bottom:5px;"><i class="fas fa-clipboard-list"></i> Reglas de Intervención</label>
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            <div><span style="color:#9ca3af;font-size:0.65rem;font-weight:bold;text-transform:uppercase;">Provocación:</span> <span class="m-desc" style="display:inline-block;margin-top:2px;">${task.rule_provocation || task.intervention_rules || task.provocation_rules || '<span style="color:#6b7280;font-style:italic;">No definido</span>'}</span></div>
                            <div><span style="color:#9ca3af;font-size:0.65rem;font-weight:bold;text-transform:uppercase;">Propensión:</span> <span class="m-desc" style="display:inline-block;margin-top:2px;">${task.rule_propension || '<span style="color:#6b7280;font-style:italic;">No definido</span>'}</span></div>
                            <div><span style="color:#9ca3af;font-size:0.65rem;font-weight:bold;text-transform:uppercase;">Continuidad:</span> <span class="m-desc" style="display:inline-block;margin-top:2px;">${task.rule_continuity || '<span style="color:#6b7280;font-style:italic;">No definido</span>'}</span></div>
                        </div>
                    </div>
                    <div class="m-info-block">
                        <label style="color:#00F2FE;font-size:0.75rem;font-weight:bold;display:block;margin-bottom:5px;"><i class="fas fa-vector-square"></i> Dimensiones y Estructuras</label>
                        <p class="m-desc">${task.dimensions || task.dimensions_density || '<span style="color:#6b7280;font-style:italic;">No definido</span>'}</p>
                    </div>
                    <div class="m-info-block" style="grid-column: 1 / -1; margin-top: 10px;" id="contenedor-diagrama-tactico">
                        <label style="color:#00F2FE;font-size:0.75rem;font-weight:bold;display:block;margin-bottom:10px;"><i class="fas fa-chalkboard"></i> Esquema Táctico</label>
                        ${(task.tactical_diagram_url && task.tactical_diagram_url.length > 50) ? `
                        <div style="margin-top: 15px; border: 1px solid #333; border-radius: 8px; overflow: hidden;"><img src="${task.tactical_diagram_url}" style="width: 100%; display: block;" alt="Diagrama Táctico"></div>
                        ` : '<p class="text-muted" style="font-size: 0.85em;">Sin esquema táctico adjunto.</p>'}
                    </div>
                </div>
            </div>
        `;

        const bodyEl = document.getElementById('modal-body-content');
        if (bodyEl) {
            bodyEl.innerHTML = htmlContent;
        }

        const modalTarget = document.getElementById('dt-modal');
        console.log('Elemento modal objetivo:', modalTarget);

        if (modalTarget) {
            if (modalTarget.parentElement !== document.body) {
                document.body.appendChild(modalTarget);
            }

            modalTarget.classList.remove('hidden');

            // FUERZA BRUTA CSS: Sobrescribir cualquier conflicto externo
            modalTarget.style.cssText = `
                display: flex !important;
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 2147483647 !important;
                background: rgba(0, 0, 0, 0.85) !important;
                backdrop-filter: blur(8px) !important;
                align-items: center !important;
                justify-content: center !important;
                visibility: visible !important;
                opacity: 1 !important;
                pointer-events: auto !important;
            `;

            const contentTarget = modalTarget.querySelector('.modal-content');
            if (contentTarget) {
                contentTarget.style.cssText = `
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    position: relative !important;
                    z-index: 2147483647 !important;
                `;
            }

            console.log('Modal abierto exitosamente (movido a document.body)');
        } else {
            console.error('CRÍTICO: No se encontró el elemento modal en el HTML con ese ID.');
        }
    },

    closeModal() {
        const modal = document.getElementById('dt-modal');
        if (modal) {
            modal.style.cssText = ''; // Clean all inline CSS
            modal.style.display = 'none';
            modal.classList.add('hidden');
        }
    },
    closeDrawer() {
        // Limpiar todo el staging al cancelar con ✕
        this._stagedTasks = [];
        this._stagedLabel = null;
        document.getElementById('dt-drawer').classList.add('hidden');
    },

    // --- MÓDULO DE REACTIVIDAD (Phase 6) ---
    async refreshState() {
        await this.fetchMonthLogs();
        this.generateCalendar();
        this.updateHomeUI();
        const anView = document.getElementById('dt-analytics-view');
        if (anView && anView.style.display === 'block') {
            this.renderAnalytics();
        }
        if (this.Periodization) {
            if (typeof this.Periodization.renderProcessView === 'function') this.Periodization.renderProcessView();
            if (typeof this.Periodization.renderTimeline === 'function') this.Periodization.renderTimeline();
        }
    },

    updateHomeUI() {
        const timelineEl = document.getElementById('home-timeline-row');
        if (!timelineEl) return;

        // 1. Generar 7 días desde hoy
        let html = '';
        const today = new Date();
        for (let i = 0; i < 7; i++) {
            const current = new Date(today);
            current.setDate(today.getDate() + i);
            const dateStr = current.toISOString().split('T')[0];
            const tasks = this._assignedTasks[dateStr] || [];
            const isMatch = this._matchDays.has(dateStr);
            const dayName = current.toLocaleDateString('es', { weekday: 'short' }).toUpperCase();

            html += `
                <div class="timeline-day ${isMatch ? 'match-day' : ''}">
                    <span class="t-name">${dayName}</span>
                    <span class="t-num">${current.getDate()}</span>
                    <div class="t-dots">
                        ${tasks.slice(0, 3).map(() => '<span class="t-dot"></span>').join('')}
                        ${tasks.length > 3 ? '<span class="t-dot plus">+</span>' : ''}
                    </div>
                </div>
            `;
        }
        timelineEl.innerHTML = html;

        // 2. Mini Charts
        this.renderHomeCharts();

        // 3. Centro de Comando
        this.updateCommandCenter();
    },

    updateCommandCenter() {
        const nextMatchEl = document.getElementById('cc-next-match');
        const todayFocusEl = document.getElementById('cc-today-focus');
        if (!nextMatchEl || !todayFocusEl) return;

        // --- ROL DINÁMICO ---
        const roleLabelEl = document.getElementById('np-role-label');
        if (roleLabelEl) {
            const roleMap = {
                'head_coach': 'DIRECTOR TÉCNICO',
                'assistant': 'ASISTENTE TÉCNICO',
                'gk_coach': 'ENTRENADOR DE ARQUEROS',
                'fitness_coach': 'PREPARADOR FÍSICO',
                'analyst': 'ANALISTA',
                'medical': 'CUERPO MÉDICO'
            };
            const userRole = window.CurrentUser?.role || 'head_coach';
            roleLabelEl.textContent = roleMap[userRole] || 'STAFF TÉCNICO';
        }

        const matchDates = window.CurrentTeam?.match_dates || Array.from(this._matchDays);
        const todayStr = new Date().toISOString().split('T')[0];
        const todayMidnight = new Date(todayStr + 'T00:00:00');

        // --- PRÓXIMO PARTIDO ---
        const futureDates = matchDates
            .filter(d => d >= todayStr)  // inclye hoy (match day)
            .sort();

        if (futureDates.length === 0) {
            nextMatchEl.innerHTML = '<span style="color: #888;">Sin partidos programados</span>';
            nextMatchEl.className = 'cc-value cc-neutral';
        } else {
            const nextStr = futureDates[0];
            const nextDate = new Date(nextStr + 'T00:00:00');
            const msPerDay = 24 * 60 * 60 * 1000;
            const daysUntil = Math.round((nextDate - todayMidnight) / msPerDay);
            
            // Si hay tareas tipo partido, podríamos extraer el nombre, por ahora hardcodeado o general
            let rivalName = 'PRÓXIMO RIVAL';
            const matchLogs = this._assignedTasks[nextStr] || [];
            const partidoLog = matchLogs.find(l => l.block === 'Partido' || l.type === 'Partido');
            if (partidoLog && typeof partidoLog.id === 'string') {
                rivalName = partidoLog.id; // asumiendo que guarda el rival
            }
            
            if (daysUntil === 0) {
                nextMatchEl.innerHTML = `<div style="font-size: 22px; font-weight: 900; color: #FFF; margin-bottom: 4px;">${rivalName}</div><div style="font-size: 12px; color: var(--dt-error); font-weight: 700;">MD-0 (HOY)</div>`;
                nextMatchEl.className = '';
                document.getElementById('widget-next-match-container').className = 'platinum-widget widget-next-match semaphore-left-red';
            } else {
                let countdownText = `MD-${daysUntil} (Faltan ${daysUntil} días)`;
                nextMatchEl.innerHTML = `<div style="font-size: 22px; font-weight: 900; color: #FFF; margin-bottom: 4px;">${rivalName}</div><div style="font-size: 12px; color: var(--dt-accent); font-weight: 700;">${countdownText}</div>`;
                nextMatchEl.className = '';
                
                let semColor = 'semaphore-left-neutral';
                if (daysUntil <= 1) { semColor = 'semaphore-left-red'; }
                else if (daysUntil <= 3) { semColor = 'semaphore-left-yellow'; }
                else { semColor = 'semaphore-left-green'; }

                document.getElementById('widget-next-match-container').className = `platinum-widget widget-next-match ${semColor}`;
            }
        }

        // --- FOCO DE HOY ---
        const todayLabel = this.calcularEtiquetaMD(todayStr, matchDates);
        todayFocusEl.textContent = todayLabel;
        const focusClass = this.getTypeClass(todayLabel);

        const todayTasksUl = document.getElementById('cc-today-tasks');
        if (todayTasksUl) {
            const tasksToday = this._assignedTasks[todayStr] || [];
            if (tasksToday.length === 0) {
                todayTasksUl.innerHTML = '<li class="empty-tasks" style="color: #666; font-style: italic; list-style: none;">DÍA LIBRE - Sin tareas tácticas asignadas</li>';
            } else {
                todayTasksUl.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;">` + tasksToday.map(t => {
                    const blockName = t.block === 'parte_principal' ? 'Principal' : (t.block || 'Tarea');
                    let exName = 'Actividad planificada';
                    const numId = parseInt(t.id);
                    if (!isNaN(numId)) {
                        const customEx = window.CustomExercises?.find(c => c.numericId === numId);
                        if (customEx) exName = customEx.title;
                        else {
                            const preEx = this._exercises.find(e => e.id === numId);
                            if (preEx) exName = preEx.title;
                        }
                    } else if (typeof t.id === 'string') {
                        const customEx = window.CustomExercises?.find(c => c.id === t.id);
                        if (customEx) exName = customEx.title;
                    }
                    return `<li style="font-size: 13px; color: #E0E0E0; margin-bottom: 8px; border-left: 2px solid var(--dt-accent); padding-left: 10px;"><strong>${blockName}:</strong> <span style="opacity:0.8;">${exName}</span></li>`;
                }).join('') + `</ul>`;
            }
        }

        // --- DATA TILES (Micro-Analítica) ---
        const tileBoard = document.getElementById('tile-board');
        const tileAnalytics = document.getElementById('tile-analytics');
        const tileCalendar = document.getElementById('tile-calendar');

        if (tileBoard) {
            const sys = window.CurrentTeam?.tactical_system || '4-3-3';
            tileBoard.innerHTML = `<div style="font-size: 10px; font-weight: 800; color: #888; text-transform: uppercase; margin-bottom: 5px;">SISTEMA BASE</div><div style="font-size: 24px; font-weight: 900; color: #FFF; font-family: 'Outfit', sans-serif;">${sys}</div>`;
        }

        if (tileAnalytics) {
            const currentMonthStr = todayStr.substring(0, 7);
            let monthSessionsCount = 0;
            Object.keys(this._assignedTasks).forEach(date => {
                if (date.startsWith(currentMonthStr)) monthSessionsCount++;
            });
            tileAnalytics.innerHTML = `<div style="font-size: 10px; font-weight: 800; color: #888; text-transform: uppercase; margin-bottom: 5px;">CARGA MENSUAL</div><div style="font-size: 24px; font-weight: 900; color: #FFF; font-family: 'Outfit', sans-serif;">${monthSessionsCount} <span style="font-size: 12px; color: var(--dt-accent);">SESIONES</span></div>`;
        }

        if (tileCalendar) {
            const currentMonthName = new Date().toLocaleString('es', { month: 'long' }).toUpperCase();
            tileCalendar.innerHTML = `<div style="font-size: 10px; font-weight: 800; color: #888; text-transform: uppercase; margin-bottom: 5px;">${currentMonthName}</div><div style="font-size: 18px; font-weight: 900; color: var(--dt-accent); font-family: 'Outfit', sans-serif;">Macrociclo Activo</div>`;
        }

        // --- WIDGET PROACTIVO DE RESULTADOS PENDIENTES ---
        try {
            this._renderPendingResultsWidget(todayStr);
        } catch (err) {
            console.error('Error en Widget:', err);
        }
    },

    getPendingMatchResults(todayStr) {
        const pending = [];
        const sessions = this._microcycleSessions || {};
        
        // Iteramos sobre todos los match days
        this._matchDays.forEach(dateStr => {
            if (dateStr <= todayStr) {
                const session = sessions[dateStr];
                const resultado = session ? session.match_result : 'Pendiente';
                if (!resultado || resultado === 'Pendiente') {
                    pending.push({ date: dateStr, rival: session?.rival || '' });
                }
            }
        });
        
        // Orden cronológico
        return pending.sort((a, b) => a.date.localeCompare(b.date));
    },

    _renderPendingResultsWidget(todayStr) {
        let container = document.getElementById('cc-pending-results-container');
        if (!container) {
            const cmdCenter = document.getElementById('home-command-center');
            if (cmdCenter) {
                container = document.createElement('div');
                container.id = 'cc-pending-results-container';
                container.style.marginTop = '15px';
                cmdCenter.parentNode.appendChild(container);
            }
        }

        if (!container) return;

        const pending = this.getPendingMatchResults(todayStr);
        
        if (pending.length === 0) {
            container.innerHTML = '';
            return;
        }

        const match = pending[0]; // Mostrar el más antiguo primero
        const matchTitle = match.rival ? `vs ${match.rival}` : match.date;

        container.innerHTML = `
            <div style="background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.3); border-radius: 12px; padding: 15px 20px; display: flex; align-items: center; justify-content: space-between; gap: 15px; animation: fadeIn 0.3s ease; box-shadow: 0 4px 15px rgba(0, 242, 254, 0.05);">
                <div style="display:flex; flex-direction:column;">
                    <span style="color:#00F2FE; font-size:0.7rem; font-weight:800; letter-spacing:1px; text-transform:uppercase;">Acción Requerida</span>
                    <span style="color:#fff; font-size:1.05rem; font-weight:700; margin-top:2px;">¿Cómo salió el partido ${matchTitle}?</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="window.DTEngine.resolveMatchResult('${match.date}', 'Victoria'); event.stopPropagation();" style="background: rgba(76, 175, 80, 0.15); color: #4CAF50; border: 1px solid rgba(76,175,80,0.5); padding: 8px 16px; border-radius: 6px; font-weight: 800; font-family: Outfit, sans-serif; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(76, 175, 80, 0.3)'" onmouseout="this.style.background='rgba(76, 175, 80, 0.15)'">V</button>
                    <button onclick="window.DTEngine.resolveMatchResult('${match.date}', 'Empate'); event.stopPropagation();" style="background: rgba(255, 193, 7, 0.15); color: #FFC107; border: 1px solid rgba(255,193,7,0.5); padding: 8px 16px; border-radius: 6px; font-weight: 800; font-family: Outfit, sans-serif; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255, 193, 7, 0.3)'" onmouseout="this.style.background='rgba(255, 193, 7, 0.15)'">E</button>
                    <button onclick="window.DTEngine.resolveMatchResult('${match.date}', 'Derrota'); event.stopPropagation();" style="background: rgba(244, 67, 54, 0.15); color: #F44336; border: 1px solid rgba(244,67,54,0.5); padding: 8px 16px; border-radius: 6px; font-weight: 800; font-family: Outfit, sans-serif; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(244, 67, 54, 0.3)'" onmouseout="this.style.background='rgba(244, 67, 54, 0.15)'">D</button>
                    <button onclick="window.DTEngine.resolveMatchResult('${match.date}', 'Ignorar'); event.stopPropagation();" style="background: transparent; color: #9ca3af; border: none; padding: 8px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s; display:flex; align-items:center;" title="Ignorar" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>
        `;
    },

    async resolveMatchResult(fecha, resultado) {
        const resultToSave = (resultado === 'Ignorar') ? 'Ignorado' : resultado;
        const teamId = window.CurrentTeam?.id || localStorage.getItem('ravix_team_id');
        if (!teamId) return;

        try {
            const { error } = await window.supabase
                .from('microcycle_sessions')
                .upsert([{
                    team_id: teamId,
                    fecha: fecha,
                    is_match_day: true,
                    match_result: resultToSave
                }], { onConflict: 'team_id,fecha' });
            if (error) throw error;

            console.log(`✅ Resultado del partido del ${fecha} resuelto como: ${resultToSave}`);
            
            await this.fetchMonthLogs();
            this.refreshState();
        } catch(e) {
            console.error('Error al guardar el resultado del partido:', e);
            alert('Error al resolver el partido.');
        }
    },

    renderHomeCharts() {
        if (this._charts.homeLoad) this._charts.homeLoad.destroy();
        if (this._charts.homeMoments) this._charts.homeMoments.destroy();

        // Procesar datos rápidos
        const loadData = [0, 0, 0, 0, 0, 0, 0];
        const moments = { A: 0, D: 0, T: 0 };

        Object.keys(this._assignedTasks).forEach(date => {
            const d = new Date(date + 'T00:00:00');
            const dayIdx = (d.getDay() + 6) % 7;
            this._assignedTasks[date].forEach(t => {
                loadData[dayIdx] += 15;
                const ex = (window.ExercisesLibrary || []).find(e => e.numericId === t.id);
                if (ex) {
                    if (ex.game_moment.includes('ATAQUE')) moments.A++;
                    else if (ex.game_moment.includes('DEFENSA')) moments.D++;
                    else moments.T++;
                }
            });
        });

        const commonOptions = {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        };

        this._charts.homeLoad = new Chart(document.getElementById('home-chart-load'), {
            type: 'line',
            data: {
                labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
                datasets: [{ data: loadData, borderColor: '#00F2FE', tension: 0.4, borderWidth: 2, pointRadius: 0 }]
            },
            options: commonOptions
        });

        this._charts.homeMoments = new Chart(document.getElementById('home-chart-moments'), {
            type: 'doughnut',
            data: {
                datasets: [{ data: Object.values(moments), backgroundColor: ['#00F2FE', '#E0E0E0', '#606070'], borderWidth: 0 }]
            },
            options: { cutout: '80%', maintainAspectRatio: false }
        });
    },

    toggleView(viewName) {
        const home = document.getElementById('dt-home-view');
        const cal = document.getElementById('dt-calendar-view');
        const an = document.getElementById('dt-analytics-view');
        const prof = document.getElementById('view-profile');
        const board = document.getElementById('view-board');

        const views = [home, cal, an, prof, board];
        views.forEach(v => {
            if (v) {
                v.classList.remove('active');
                v.style.display = 'none';
            }
        });

        let targetView = null;

        if (viewName === 'home') {
            targetView = home;
            if (targetView) targetView.style.display = ''; // Let CSS (.active) control it to be grid
            this.updateHomeUI();
        } else if (viewName === 'analytics') {
            targetView = an;
            if (targetView) targetView.style.display = 'block';
            this.renderAnalytics();
        } else if (viewName === 'profile') {
            targetView = prof;
            if (targetView) targetView.style.display = 'block';
            this.loadProfile();
        } else if (viewName === 'board') {
            targetView = board;
            if (targetView) targetView.style.display = 'block';
        } else if (viewName === 'calendar') {
            targetView = cal;
            if (targetView) targetView.style.display = 'block';
            setTimeout(function () { window.DTEngine.Periodization.init(); }, 50);
        }

        if (targetView) {
            targetView.classList.add('active');
            if (viewName === 'board') {
                const container = document.getElementById('premium-tactical-board-container');
                if (container) {
                    console.log("[Router] Evaluando contenedor Pizarra. Altura actual:", container.clientHeight);

                    // Definimos ResizeObserver para esperar volumen real sin parches de tiempo
                    const resizeObserver = new ResizeObserver((entries, observer) => {
                        for (let entry of entries) {
                            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                                console.log("[Router] Contenedor Pizarra con volumen:", entry.contentRect.width, "x", entry.contentRect.height);
                                const fe = window.DTEngine.FabricEngine;

                                if (!fe._fc) {
                                    fe.init();
                                } else {
                                    fe._fc.setWidth(entry.contentRect.width);
                                    fe._fc.setHeight(entry.contentRect.height);
                                    fe.setBackground(fe._currentBackground || 'futbol11');
                                    fe._fc.renderAll();
                                }
                                observer.disconnect();
                                break;
                            }
                        }
                    });

                    // Comienza a observar
                    resizeObserver.observe(container);
                }
            }
        }
    },

    renderAnalytics() {
        if (this._charts.carga) this._charts.carga.destroy();
        if (this._charts.momentos) this._charts.momentos.destroy();
        if (this._charts.srpe) this._charts.srpe.destroy();
        if (this._charts.espacio) this._charts.espacio.destroy();

        const weeklyMinutes = [0, 0, 0, 0, 0, 0, 0];
        const weeklySRPE = [0, 0, 0, 0, 0, 0, 0];

        // PREPARACIÓN FASE 2: Estructuras para "CARGA REAL" devuelta por los jugadores.
        // Se usarán para superponer un segundo dataset en las gráficas semanales.
        const weeklyRealMinutes = [0, 0, 0, 0, 0, 0, 0]; // TODO Phase 2
        const weeklyRealSRPE = [0, 0, 0, 0, 0, 0, 0];    // TODO Phase 2

        const moments = { 'ATAQUE': 0, 'DEFENSA': 0, 'TRANSICIONES': 0, 'OTROS': 0 };
        const spaceData = [0, 0, 0, 0, 0, 0, 0];

        Object.keys(this._assignedTasks).forEach(date => {
            const d = new Date(date + 'T00:00:00');
            const dayIdx = (d.getDay() + 6) % 7;

            this._assignedTasks[date].forEach(task => {
                const ex = (window.ExercisesLibrary || []).find(e => e.numericId === task.id);
                if (ex) {
                    const duration = parseInt(ex.duration) || 15;
                    weeklyMinutes[dayIdx] += duration;

                    // sRPE: Duración * Intensidad (asumimos 7 si no existe)
                    const rpe = 7;
                    weeklySRPE[dayIdx] += (duration * rpe);

                    // Espacio: individual_m2 (asumimos 30 si no existe)
                    const m2 = parseFloat(ex.individual_m2) || 30;
                    spaceData[dayIdx] = m2; // Simplificado: último del día o promedio

                    const m = (ex.game_moment || 'otros').toUpperCase();
                    if (m.includes('ATAQUE')) moments['ATAQUE']++;
                    else if (m.includes('DEFENSA')) moments['DEFENSA']++;
                    else if (m.includes('TRANSICION')) moments['TRANSICIONES']++;
                    else moments['OTROS']++;
                }
            });
        });

        const chartOptions = {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#E0E0E6' } } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#606070' } },
                x: { grid: { display: false }, ticks: { color: '#606070' } }
            }
        };

        // 1. Volumen (Planificado vs Real en Fase 2)
        this._charts.carga = new Chart(document.getElementById('canvas-carga-semanal'), {
            type: 'bar',
            data: {
                labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
                // TODO Phase 2: Agregar un segundo objeto a 'datasets' para "Volumen Real"
                datasets: [{ label: 'Minutos (Volumen Proyectado)', data: weeklyMinutes, backgroundColor: '#079FA0', borderRadius: 5 }]
            },
            options: chartOptions
        });

        // 2. sRPE (Línea) - Carga Proyectada
        this._charts.srpe = new Chart(document.getElementById('canvas-srpe'), {
            type: 'line',
            data: {
                labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
                // TODO Phase 2: Agregar un segundo objeto a 'datasets' para "Carga Real (sRPE Reportado)"
                datasets: [{ label: 'Carga Proyectada (sRPE Planificado)', data: weeklySRPE, borderColor: '#F58B01', tension: 0.4 }]
            },
            options: chartOptions
        });

        // 3. Momentos
        this._charts.momentos = new Chart(document.getElementById('canvas-momentos-juego'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(moments),
                datasets: [{ data: Object.values(moments), backgroundColor: ['#079FA0', '#F58B01', '#DC2E2F', '#161620'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
        });

        // 4. Espacio (Radar o Barras)
        this._charts.espacio = new Chart(document.getElementById('canvas-espacio'), {
            type: 'bar',
            data: {
                labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
                datasets: [{ label: 'm² por Jugador', data: spaceData, backgroundColor: 'rgba(7, 159, 160, 0.2)', borderColor: '#079FA0', borderWidth: 2 }]
            },
            options: chartOptions
        });
    },

    async loadProfile() {
        const userData = window.CurrentUser;
        const teamData = window.CurrentTeam;

        // Inicializar el componente Tag Input (datalist + render)
        this.TagInput.init();

        if (userData && teamData) {
            const nameEl = document.getElementById('prof-name');
            const dtNameInputEl = document.getElementById('dt-name-input');
            const teamNameEl = document.getElementById('prof-team-name');
            const teamColorEl = document.getElementById('prof-team-color');

            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== null && val !== undefined) el.value = val; };

            if (nameEl) nameEl.value = userData.name || '';
            if (dtNameInputEl) dtNameInputEl.value = userData.name || '';

            const emailEl = document.getElementById('prof-email');
            if (emailEl) emailEl.value = userData.email || '';

            // Pre-hidratación estricta desde variables globales para evitar vacíos visuales (Fallback)
            if (teamNameEl) teamNameEl.value = teamData.name || '';
            if (teamColorEl) teamColorEl.value = teamData.primary_color || '#079FA0';


            try {
                // Cargar datos del DT
                const { data: pData } = await window.supabase.from('profiles_dt').select('*').eq('id', userData.id).maybeSingle();

                if (pData) {
                    setVal('prof-license', pData.licencia);
                    if (pData.avatar_url) {
                        const avatarPreview = document.getElementById('prof-avatar-preview');
                        if (avatarPreview) {
                            avatarPreview.src = pData.avatar_url;
                            avatarPreview.style.display = 'block';
                        }
                        const avatarHidden = document.getElementById('avatar_url_base64');
                        if (avatarHidden) avatarHidden.value = pData.avatar_url;

                        const innerAvatar = document.querySelector('.dt-avatar-inner');
                        if (innerAvatar) {
                            innerAvatar.style.backgroundImage = 'url(' + pData.avatar_url + ')';
                            innerAvatar.style.backgroundSize = 'cover';
                        }
                    }
                }

                // Cargar datos del Club y Táctica (de la tabla teams)
                const { data: tData } = await window.supabase.from('teams').select('*').eq('id', teamData.id).maybeSingle();
                if (tData) {
                    setVal('prof-team-name', tData.name || '');
                    setVal('prof-team-category', tData.category || tData.categoria || '');
                    setVal('prof-team-liga', tData.liga || '');

                    if (tData.logo_url) {
                        const shieldPreview = document.getElementById('prof-shield-preview');
                        if (shieldPreview) {
                            shieldPreview.src = tData.logo_url;
                            shieldPreview.style.display = 'block';
                        }
                        const shieldHidden = document.getElementById('shield_url_base64');
                        if (shieldHidden) shieldHidden.value = tData.logo_url;
                    }

                    // Táctica y 11 Ideal
                    setVal('dna-esquema', tData.esquema_base);
                    setVal('dna-ataque', tData.organizacion_ofensiva);
                    setVal('altura_bloque_ofensivo', tData.altura_bloque_ofensivo);
                    setVal('dna-defensa', tData.organizacion_defensiva);
                    setVal('dna-bloque', tData.altura_bloque_defensivo);
                    setVal('dna-trans-def', tData.transicion_ata_def);
                    setVal('dna-trans-of', tData.transicion_def_ata);

                    const reglasVal = tData.reglas_accion_provocacion || tData.reglas_accion || tData.reglas_propension || '';
                    setVal('reglas_propension', reglasVal);
                    if (reglasVal && document.getElementById('rules-tag-input-wrapper')) {
                        DTEngine.RulesTagInput.load(reglasVal.split('|').map(s => s.trim()));
                    }

                    setVal('ideal_arquero', tData.ideal_arquero);
                    setVal('ideal_lateral_derecho', tData.ideal_lateral_derecho);
                    setVal('ideal_central_derecho', tData.ideal_central_derecho);
                    setVal('ideal_central_izquierdo', tData.ideal_central_izquierdo);
                    setVal('ideal_lateral_izquierdo', tData.ideal_lateral_izquierdo);
                    setVal('ideal_pivote', tData.ideal_pivote);
                    setVal('ideal_interior_derecho', tData.ideal_interior_derecho);
                    setVal('ideal_interior_izquierdo', tData.ideal_interior_izquierdo);
                    setVal('ideal_extremo_derecho', tData.ideal_extremo_derecho);
                    setVal('ideal_extremo_izquierdo', tData.ideal_extremo_izquierdo);
                    setVal('ideal_delantero', tData.ideal_delantero);

                    if (tData.tactical_dna?.ideal_11) {
                        DTEngine.PitchEngine.load(tData.tactical_dna.ideal_11);
                    }
                }

                // Color y Metodologia (siguen en team_configs por ahora)
                const { data: cData } = await window.supabase.from('team_configs').select('*').eq('team_id', teamData.id).maybeSingle();
                if (cData) {
                    setVal('prof-team-color', cData.primary_color || '#079FA0');
                    setVal('prof-methodology', cData.methodology || cData.metodologia);
                }

                // Cargar team_load_settings
                if (teamData) {
                    const { data: loadData } = await window.supabase.from('team_load_settings').select('*').eq('team_id', teamData.id).maybeSingle();
                    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== null && val !== undefined) el.value = val; };
                    const cbVal = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

                    if (loadData) {
                        cbVal('load-rpe-diff', loadData.rpe_diferenciado);
                        setVal('load-ac-ratio', loadData.umbral_ac_ratio);
                        setVal('load-monotony', loadData.umbral_monotonia);
                        cbVal('load-assistant', loadData.asistente_fisiologico);
                        setVal('load-wellness-freq', loadData.frecuencia_wellness);
                    } else {
                        cbVal('load-rpe-diff', false);
                        setVal('load-ac-ratio', 1.5);
                        setVal('load-monotony', 2.0);
                        cbVal('load-assistant', false);
                        setVal('load-wellness-freq', 'Solo Días de Entrenamiento');
                    }
                }

            } catch (err) {
                console.error("Error cargando profiles_dt o team_load_settings:", err);
            }
        }
    },


    handleImageUpload(event, previewId, hiddenId) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const base64Str = e.target.result;
                document.getElementById(hiddenId).value = base64Str;
                const preview = document.getElementById(previewId);
                preview.src = base64Str;
                preview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        }
    },

    switchSettingsTab(tabId) {
        document.querySelectorAll('.settings-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.settings-tab-content').forEach(content => content.style.display = 'none');

        const activeBtn = document.getElementById(`tab-btn-${tabId}`);
        const activeContent = document.getElementById(`settings-tab-${tabId}`);

        if (activeBtn) activeBtn.classList.add('active');
        if (activeContent) activeContent.style.display = 'block';
    },

    async saveDTProfile() {
        const uid = window.CurrentUser?.id || localStorage.getItem('ravix_v5_uid');
        if (!uid) return alert('Error: Usuario no identificado.');

        const name = document.getElementById('prof-name')?.value;
        const valLicencia = document.getElementById('prof-license')?.value || null;
        const valAvatar = document.getElementById('avatar_url_base64')?.value || null;

        // Histórico
        const hPartidos = parseInt(document.getElementById('prof-hist-partidos')?.value) || 0;
        const hTitulos = parseInt(document.getElementById('prof-hist-titulos')?.value) || 0;
        const hTemporadas = parseInt(document.getElementById('prof-hist-temporadas')?.value) || 0;
        const hVictorias = parseInt(document.getElementById('prof-hist-victorias')?.value) || 0;
        const hEmpates = parseInt(document.getElementById('prof-hist-empates')?.value) || 0;
        const hDerrotas = parseInt(document.getElementById('prof-hist-derrotas')?.value) || 0;

        if (!name) return alert('El nombre es obligatorio.');

        try {
            console.log('💾 Guardando Perfil DT...');
            const profilePayload = {
                id: uid,
                licencia: valLicencia,
                avatar_url: valAvatar,
                hist_partidos: hPartidos,
                hist_titulos: hTitulos,
                hist_temporadas: hTemporadas,
                hist_victorias: hVictorias,
                hist_empates: hEmpates,
                hist_derrotas: hDerrotas
            };

            const { error: pErr } = await window.supabase.from('profiles_dt').upsert(profilePayload);
            if (pErr) throw pErr;

            const { error: uErr } = await window.supabase.from('users').update({ name, license: valLicencia }).eq('id', uid);
            if (uErr) throw uErr;

            if (window.CurrentUser) {
                window.CurrentUser.name = name;
                window.CurrentUser.license = valLicencia;
                window.CurrentUser.hist_partidos = hPartidos;
                window.CurrentUser.hist_titulos = hTitulos;
                window.CurrentUser.hist_temporadas = hTemporadas;
                window.CurrentUser.hist_victorias = hVictorias;
                window.CurrentUser.hist_empates = hEmpates;
                window.CurrentUser.hist_derrotas = hDerrotas;

                if (valAvatar) {
                    const innerAvatar = document.querySelector('.dt-avatar-inner');
                    if (innerAvatar) {
                        innerAvatar.style.backgroundImage = 'url(' + valAvatar + ')';
                        innerAvatar.style.backgroundSize = 'cover';
                    }
                }
            }

            alert('✅ Perfil guardado.');
        } catch (error) {
            console.error('🔴 ERROR SUPABASE:', error.message);
            alert('Error al guardar Perfil.');
        }
    },

    async saveClubSettings() {
        const teamId = window.CurrentTeam?.id;
        if (!teamId) return alert('Error: Equipo no identificado.');

        const teamName = document.getElementById('prof-team-name')?.value;
        const valCategory = document.getElementById('prof-team-category')?.value || null;
        const valLiga = document.getElementById('prof-team-liga')?.value || null;
        const valLogo = document.getElementById('shield_url_base64')?.value || null;
        const color = document.getElementById('prof-team-color')?.value;
        const valMetodologia = document.getElementById('prof-methodology')?.value || null;

        const valEsquemaBase = document.getElementById('dna-esquema')?.value || null;
        const valOrgOfensiva = document.getElementById('dna-ataque')?.value || null;
        const valAlturaOfensiva = document.getElementById('altura_bloque_ofensivo')?.value || null;
        const valOrgDefensiva = document.getElementById('dna-defensa')?.value || null;
        const valAlturaDefensiva = document.getElementById('dna-bloque')?.value || null;
        const valTransAtaDef = document.getElementById('dna-trans-def')?.value || null;
        const valTransDefAta = document.getElementById('dna-trans-of')?.value || null;

        const rulesInputEl = document.getElementById('reglas_propension');
        const valReglasPropension = rulesInputEl ? rulesInputEl.value : (DTEngine.RulesTagInput.getTags().join(' | ') || null);
        const valPrincipiosOperativos = DTEngine.TagInput.getTags().join(' | ') || null;
        const valReglasAccion = document.getElementById('reglas_accion')?.value || null;

        const valArquero = document.getElementById('ideal_arquero')?.value || null;
        const valLateralDerecho = document.getElementById('ideal_lateral_derecho')?.value || null;
        const valCentralDerecho = document.getElementById('ideal_central_derecho')?.value || null;
        const valCentralIzquierdo = document.getElementById('ideal_central_izquierdo')?.value || null;
        const valLateralIzquierdo = document.getElementById('ideal_lateral_izquierdo')?.value || null;
        const valPivote = document.getElementById('ideal_pivote')?.value || null;
        const valInteriorDerecho = document.getElementById('ideal_interior_derecho')?.value || null;
        const valInteriorIzquierdo = document.getElementById('ideal_interior_izquierdo')?.value || null;
        const valExtremoDerecho = document.getElementById('ideal_extremo_derecho')?.value || null;
        const valExtremoIzquierdo = document.getElementById('ideal_extremo_izquierdo')?.value || null;
        const valDelantero = document.getElementById('ideal_delantero')?.value || null;

        if (!teamName || teamName.trim() === '') {
            alert('⚠️ El nombre del equipo es obligatorio. Por favor, completa este campo para evitar sobreescrituras.');
            return;
        }

        try {
            console.log('💾 Guardando Ajustes del Club y Táctica...');
            const teamPayload = {
                name: teamName,
                categoria: valCategory,
                liga: valLiga,
                logo_url: valLogo,
                esquema_base: valEsquemaBase,
                organizacion_ofensiva: valOrgOfensiva,
                altura_bloque_ofensivo: valAlturaOfensiva,
                organizacion_defensiva: valOrgDefensiva,
                altura_bloque_defensivo: valAlturaDefensiva,
                transicion_ata_def: valTransAtaDef,
                transicion_def_ata: valTransDefAta,
                principios_operativos: valPrincipiosOperativos,
                reglas_accion: valReglasAccion,
                reglas_accion_provocacion: valReglasPropension,
                ideal_arquero: valArquero,
                ideal_lateral_derecho: valLateralDerecho,
                ideal_central_derecho: valCentralDerecho,
                ideal_central_izquierdo: valCentralIzquierdo,
                ideal_lateral_izquierdo: valLateralIzquierdo,
                ideal_pivote: valPivote,
                ideal_interior_derecho: valInteriorDerecho,
                ideal_interior_izquierdo: valInteriorIzquierdo,
                ideal_extremo_derecho: valExtremoDerecho,
                ideal_extremo_izquierdo: valExtremoIzquierdo,
                ideal_delantero: valDelantero
            };

            const { error: tErr } = await window.supabase.from('teams').update(teamPayload).eq('id', teamId);
            if (tErr) throw tErr;

            if (color || valMetodologia) {
                const { error: cErr } = await window.supabase.from('team_configs').update({ primary_color: color, methodology: valMetodologia }).eq('team_id', teamId);
                if (!cErr && color) {
                    document.documentElement.style.setProperty('--primary-color', color);
                    document.documentElement.style.setProperty('--primary', color);
                }
            }

            if (window.CurrentTeam) {
                window.CurrentTeam.name = teamName;
                window.CurrentTeam.primary_color = color;
                window.CurrentTeam.methodology = valMetodologia;
                if (valLogo) window.CurrentTeam.logo_url = valLogo;
            }

            alert('✅ Configuración del Club y Táctica guardadas en la tabla teams.');
            this.renderDashboard();
        } catch (error) {
            console.error('🔴 ERROR SUPABASE:', error.message);
            alert('Error al guardar Club.');
        }
    },

    async saveLoadEngineSettings() {
        const teamId = window.CurrentTeam?.id;
        if (!teamId) return alert('Error: Equipo no identificado.');

        const teamLoadPayload = {
            team_id: teamId,
            rpe_diferenciado: document.getElementById('load-rpe-diff')?.checked || false,
            umbral_ac_ratio: parseFloat(document.getElementById('load-ac-ratio')?.value) || 1.5,
            umbral_monotonia: parseFloat(document.getElementById('load-monotony')?.value) || 2.0,
            asistente_fisiologico: document.getElementById('load-assistant')?.checked || false,
            frecuencia_wellness: document.getElementById('load-wellness-freq')?.value || 'Solo Días de Entrenamiento'
        };

        try {
            console.log('💾 Guardando Motor de Rendimiento...');
            const { error: loadErr } = await window.supabase.from('team_load_settings').upsert(teamLoadPayload, { onConflict: 'team_id' });
            if (loadErr) throw loadErr;
            alert('✅ Motor de Rendimiento guardado.');
        } catch (error) {
            console.error('🔴 ERROR SUPABASE:', error.message);
            alert('Error al guardar Motor de Rendimiento.');
        }
    },

    // ══════════════════════════════════════════════════════
    // MOTOR FABRIC.JS — FabricEngine
    // ══════════════════════════════════════════════════════
    FabricEngine: {
        _fc: null,              // instancia fabric.Canvas
        _activeTool: 'draw',    // herramienta activa
        _background: 'futbol11',// fondo activo
        _snapGrid: false,       // snap-to-grid toggle
        _snapSize: 20,          // tamaño de celda de la grilla
        _canvasW: 0,            // dimensiones en píxeles
        _canvasH: 0,
        _playerCounter: { blue: 0, red: 0, yellow: 0, green: 0, black: 0 }, // auto-incremento de fichas

        // --- Estado de dibujo dinámico ---
        _isDrawingShape: false,
        _drawStartX: 0,
        _drawStartY: 0,
        _tempShape: null,

        // Todos los IDs de botones de herramientas
        _toolBtns: [
            'tool-draw',
            'tool-player-blue', 'tool-player-red', 'tool-player-yellow', 'tool-player-green', 'tool-player-black',
            'tool-ball', 'tool-cone', 'tool-minigoal', 'tool-text',
            'tool-arrow-pass', 'tool-arrow-run', 'tool-arrow-solid',
            'tool-zone-solid', 'tool-zone-dashed', 'tool-zone-red'
        ],

        updateMeasurementHUD: function (x, y, text, visible) {
            let hud = document.getElementById('tactical-measurement-hud');
            if (!hud) {
                hud = document.createElement('div');
                hud.id = 'tactical-measurement-hud';
                hud.style.position = 'fixed';
                hud.style.pointerEvents = 'none';
                hud.style.background = 'rgba(15, 23, 42, 0.9)';
                hud.style.color = '#00F0FF';
                hud.style.border = '1px solid #1e293b';
                hud.style.padding = '4px 8px';
                hud.style.borderRadius = '6px';
                hud.style.fontFamily = 'Outfit, sans-serif';
                hud.style.fontSize = '0.85rem';
                hud.style.fontWeight = '700';
                hud.style.zIndex = '9999';
                hud.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
                document.body.appendChild(hud);
            }
            if (visible) {
                hud.style.display = 'block';
                hud.innerText = text;
                hud.style.left = (x + 15) + 'px';
                hud.style.top = (y + 15) + 'px';
            } else {
                hud.style.display = 'none';
            }
        },

        setBackground: function (type) {
            if (!this._fc) return;

            // --- SINCRONIZACIÓN DE DIMENSIONES PADRE ---
            const container = document.getElementById('premium-tactical-board-container');
            if (container) {
                const parentW = container.clientWidth;
                const parentH = container.clientHeight;
                if (parentW > 0 && parentH > 0 && (this._fc.width !== parentW || this._fc.height !== parentH)) {
                    this._fc.setWidth(parentW);
                    this._fc.setHeight(parentH);

                    const canvasEl = document.getElementById('premium-tactical-board');
                    if (canvasEl) {
                        canvasEl.width = parentW;
                        canvasEl.height = parentH;
                    }
                }
            }
            // -------------------------------------------

            this._fc.setBackgroundImage(null, this._fc.renderAll.bind(this._fc));

            let svgString = '';
            const w = this._fc.width || 800;
            const h = this._fc.height || 600;

            // FIX PILAR 3: SVGs definidos SOLO con viewBox; las dimensiones lógicas
            // se fijan vía las variables svgW/svgH del viewBox para que scaleX/Y
            // sean siempre exactas (img.width puede ser 0 con ciertas versiones de Fabric).
            let svgW = 100, svgH = 65; // dimensiones lógicas del viewBox

            if (type === 'futbol11') {
                svgW = 100; svgH = 65;
                svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${svgW} ${svgH}">
                    <rect width="${svgW}" height="${svgH}" fill="#2e7d32"/>
                    <rect x="5" y="5" width="90" height="55" fill="none" stroke="white" stroke-width="0.5"/>
                    <line x1="50" y1="5" x2="50" y2="60" stroke="white" stroke-width="0.5"/>
                    <circle cx="50" cy="32.5" r="9" fill="none" stroke="white" stroke-width="0.5"/>
                    <rect x="5" y="15" width="16" height="35" fill="none" stroke="white" stroke-width="0.5"/>
                    <rect x="79" y="15" width="16" height="35" fill="none" stroke="white" stroke-width="0.5"/>
                </svg>`;
            } else if (type === 'futbol-media') {
                svgW = 100; svgH = 65;
                // '1/2 cancha': goal on the bottom, penalty area, center circle at top
                svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${svgW} ${svgH}">
                    <rect width="${svgW}" height="${svgH}" fill="#2e7d32"/>
                    <rect x="5" y="5" width="90" height="55" fill="none" stroke="white" stroke-width="0.5"/>
                    <line x1="5" y1="5" x2="95" y2="5" stroke="white" stroke-width="0.5"/>
                    <circle cx="50" cy="5" r="9" fill="none" stroke="white" stroke-width="0.5"/>
                    <rect x="25" y="44" width="50" height="16" fill="none" stroke="white" stroke-width="0.5"/>
                    <rect x="38" y="54" width="24" height="6" fill="none" stroke="white" stroke-width="0.5"/>
                </svg>`;
            } else if (type === 'basquetbol' || type === 'basketball') {
                svgW = 100; svgH = 50;
                svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${svgW} ${svgH}">
                    <rect width="${svgW}" height="${svgH}" fill="#d2884a"/>
                    <rect x="5" y="5" width="90" height="40" fill="none" stroke="white" stroke-width="0.8"/>
                    <line x1="50" y1="5" x2="50" y2="45" stroke="white" stroke-width="0.8"/>
                    <circle cx="50" cy="25" r="6" fill="none" stroke="white" stroke-width="0.8"/>
                </svg>`;
            } else if (type === 'parquet') {
                svgW = 100; svgH = 50;
                svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${svgW} ${svgH}">
                    <rect width="${svgW}" height="${svgH}" fill="#f5deb3"/>
                    <rect x="5" y="5" width="90" height="40" fill="none" stroke="white" stroke-width="0.8"/>
                    <line x1="50" y1="5" x2="50" y2="45" stroke="white" stroke-width="0.8"/>
                    <circle cx="50" cy="25" r="6" fill="none" stroke="white" stroke-width="0.8"/>
                </svg>`;
            } else if (type === 'blank') {
                this._fc.setBackgroundColor('#1e293b', this._fc.renderAll.bind(this._fc));
                return;
            } else {
                this._fc.setBackgroundColor('#1e293b', this._fc.renderAll.bind(this._fc));
                return;
            }

            const encodedData = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

            this._fc.setBackgroundColor('#1e293b', this._fc.renderAll.bind(this._fc));

            // Capturar dimensiones de Fabric ANTES del callback asíncrono
            const fcW = this._fc.width;
            const fcH = this._fc.height;

            fabric.Image.fromURL(encodedData, (img, isError) => {
                if (isError || !img) {
                    this._fc.setBackgroundColor('#2e7d32', this._fc.renderAll.bind(this._fc));
                    return;
                }
                // Usar dimensiones del viewBox como referencia lógica (nunca 0)
                const imgLogicalW = img.width || svgW;
                const imgLogicalH = img.height || svgH;
                img.set({
                    id: 'cancha_bg',
                    originX: 'left',
                    originY: 'top',
                    // FIX PILAR 1: Forzar renderizado a resolución nativa del canvas (Chrome Fix)
                    width: fcW,
                    height: fcH,
                    scaleX: 1,
                    scaleY: 1,
                    selectable: false,
                    evented: false
                });
                this._fc.setBackgroundImage(img, this._fc.renderAll.bind(this._fc));
            });
        },

        // ── CREAR FICHA NUMERADA (fabric.Group) ──
        _makePlayerToken(x, y, fillColor, shadowColor, label) {
            const r = 18;
            const circle = new fabric.Circle({
                radius: r,
                fill: fillColor,
                stroke: '#ffffff',
                strokeWidth: 2.5,
                originX: 'center',
                originY: 'center',
                shadow: new fabric.Shadow({ color: shadowColor, blur: 12 })
            });
            const text = new fabric.Text(String(label || ''), {
                fontSize: label ? 13 : 0,
                fill: '#ffffff',
                fontWeight: '900',
                fontFamily: 'Outfit, sans-serif',
                originX: 'center',
                originY: 'center',
                textAlign: 'center',
                selectable: false,
                evented: false,
                shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.7)', blur: 4 })
            });
            const group = new fabric.Group([circle, text], {
                left: x - r,
                top: y - r,
                selectable: true,
                hasControls: true,
                subTargetCheck: false,
                data: { type: 'player', color: fillColor }
            });
            // Doble click para editar el número
            group.on('mousedblclick', () => {
                const newNum = prompt('Número del jugador:', label || '');
                if (newNum !== null) {
                    text.set('text', String(newNum));
                    text.set('fontSize', newNum ? 13 : 0);
                    this._fc.renderAll();
                }
            });
            return group;
        },

        // ── CREAR FLECHA DE PASE (línea punteada + cabeza) ──
        _makeArrow(x, y, type) {
            const len = 80;
            let dash = [], color = '#ffffff';
            if (type === 'arrow-pass') { dash = [8, 5]; color = '#ffffff'; }
            else if (type === 'arrow-run') { dash = []; color = '#facc15'; }
            else { dash = []; color = '#ffffff'; }

            const line = new fabric.Line([x, y, x + len, y], {
                stroke: color, strokeWidth: 2.5,
                strokeDashArray: dash,
                selectable: true, hasControls: true, hasBorders: true, padding: 10
            });

            // Cabeza de flecha (triángulo pequeño)
            const head = new fabric.Triangle({
                width: 12, height: 14,
                fill: color, stroke: color, strokeWidth: 1,
                left: x + len - 6, top: y - 7,
                angle: 90,
                selectable: false, evented: false
            });

            // Si es conducción, añadir ondulación visual
            if (type === 'arrow-run') {
                const wave = new fabric.Path(
                    `M ${x} ${y} Q ${x + len * 0.25} ${y - 20} ${x + len * 0.5} ${y} Q ${x + len * 0.75} ${y + 20} ${x + len} ${y}`,
                    {
                        stroke: color, strokeWidth: 2.5, fill: 'transparent', strokeDashArray: [],
                        selectable: true, hasControls: true
                    }
                );
                this._fc.add(wave);
                this._fc.add(head);
                this._fc.renderAll();
                return null; // ya añadidos
            }

            const group = new fabric.Group([line, head], {
                selectable: true, hasControls: true
            });
            return group;
        },

        _drawField(ctx, w, h) {
            const sx = w / 105;
            const sy = h / 68;

            // Fondo verde
            ctx.save();
            ctx.fillStyle = '#1e5c1e';
            ctx.fillRect(0, 0, w, h);

            // Franjas decorativas de césped (alternadas)
            ctx.fillStyle = 'rgba(0,0,0,0.06)';
            for (let i = 0; i < 7; i++) {
                ctx.fillRect(i * (w / 7) * (i % 2 === 0 ? 1 : 0), 0, w / 7, h);
            }

            // Líneas del campo
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);

            // Borde exterior
            ctx.strokeRect(2, 2, w - 4, h - 4);

            // Línea media
            ctx.beginPath();
            ctx.moveTo(52.5 * sx, 2);
            ctx.lineTo(52.5 * sx, h - 2);
            ctx.stroke();

            // Círculo central
            ctx.beginPath();
            ctx.arc(52.5 * sx, 34 * sy, 9.15 * sx, 0, Math.PI * 2);
            ctx.stroke();

            // Punto central
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            ctx.arc(52.5 * sx, 34 * sy, 3, 0, Math.PI * 2);
            ctx.fill();

            // Área grande izquierda
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.strokeRect(2, 13.84 * sy, 16.5 * sx, 40.32 * sy);
            // Área chica izquierda
            ctx.strokeRect(2, 26.84 * sy, 5.5 * sx, 14.32 * sy);

            // Área grande derecha
            ctx.strokeRect(w - 2 - 16.5 * sx, 13.84 * sy, 16.5 * sx, 40.32 * sy);
            // Área chica derecha
            ctx.strokeRect(w - 2 - 5.5 * sx, 26.84 * sy, 5.5 * sx, 14.32 * sy);

            // Puntos penales
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath(); ctx.arc(11 * sx, 34 * sy, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(94 * sx, 34 * sy, 3, 0, Math.PI * 2); ctx.fill();

            // Arcos de penales
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.beginPath();
            ctx.arc(16.5 * sx, 34 * sy, 9.15 * sx, -Math.PI / 3, Math.PI / 3);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(w - 2 - 16.5 * sx, 34 * sy, 9.15 * sx, Math.PI * 2 / 3, Math.PI * 4 / 3);
            ctx.stroke();

            ctx.restore();
        },

        init() {
            // Destruir instancia anterior si existe
            if (this._fc) {
                try { this._fc.dispose(); } catch (e) { }
                this._fc = null;
            }
            // Limpiar listener de resize si existe
            if (this._resizeHandler) {
                window.removeEventListener('resize', this._resizeHandler);
                this._resizeHandler = null;
            }

            const container = document.getElementById('premium-tactical-board-container');
            if (!container) return;
            const w = container.clientWidth || 800;
            const h = container.clientHeight || 500;

            // Asignar dimensiones físicas al elemento canvas
            const canvasEl = document.getElementById('premium-tactical-board');
            if (!canvasEl) return;
            canvasEl.width = w;
            canvasEl.height = h;

            // Inicializar Fabric — fondo transparente (el campo lo pinta _drawField)
            this._fc = new fabric.Canvas('premium-tactical-board', {
                selection: true,
                backgroundColor: 'transparent',
                enableRetinaScaling: false
            });
            this._fc.setWidth(w);
            this._fc.setHeight(h);

            // ── Fondo multi-deporte via setBackgroundImage (estable, no bloquea el hilo) ──
            this.setBackground('futbol11');

            // Forzar primer render
            this._fc.renderAll();

            // Activar trazo libre por defecto
            this.setTool('draw');

            const boardContainer = document.getElementById('premium-tactical-board')?.parentElement;
            if (boardContainer) {
                boardContainer.addEventListener('mouseenter', () => {
                    try {
                        if (this._fc && typeof this._fc.calcOffset === 'function') {
                            this._fc.calcOffset();
                        }
                    } catch (err) {
                        console.warn('Advertencia de FabricJS silenciada:', err);
                    }
                });

                // FIX PILAR 4: dragover DEBE llamar preventDefault para habilitar el drop.
                boardContainer.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                });
                // FIX PILAR 4: getPointer() sólo acepta eventos Fabric — para drops DOM
                // usamos getBoundingClientRect para calcular coordenadas canvas-relativas.
                boardContainer.addEventListener('drop', (e) => {
                    e.preventDefault();
                    if (!this._fc) return;
                    const tool = e.dataTransfer.getData('tool');
                    if (tool) {
                        const rect = boardContainer.getBoundingClientRect();
                        // FIX PILAR 2: Cálculo robusto de coordenadas que soporta contenedores flex/scaled en Chrome
                        const scaleX = this._fc.width / rect.width;
                        const scaleY = this._fc.height / rect.height;
                        const x = (e.clientX - rect.left) * scaleX;
                        const y = (e.clientY - rect.top) * scaleY;
                        this._activeTool = tool;
                        this._placeObject(x, y);
                    }
                });
                // FIX PILAR 2: mouse:out del contenedor fuerza el estado a false
                boardContainer.addEventListener('mouseleave', () => {
                    this._isDrawingShape = false;
                    this.updateMeasurementHUD(0, 0, '', false);
                    if (this._fc) {
                        if (this._tempShape) {
                            this._fc.remove(this._tempShape);
                            this._tempShape = null;
                        }
                        // FIX PILAR 3: Hard Reset de Estado
                        if (this._activeTool !== 'draw') {
                            this._fc.isDrawingMode = false;
                            this._fc.selection = true;
                        }
                        this._fc.renderAll();
                    }
                });
            }

            // FIX: Redimensionamiento Seguro y Debounce Estricto
            let resizeTimeout;
            this._resizeHandler = () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    if (!this._fc || !container) return;

                    const newW = container.clientWidth || 800;
                    const newH = container.clientHeight || 500;

                    // Solo actualizar dimensiones del objeto (NO destruir ni recrear)
                    this._fc.setWidth(newW);
                    this._fc.setHeight(newH);

                    // Regenerar el fondo a la escala nueva y repintar
                    this.setBackground(this._currentBackground || 'futbol11');
                    this._fc.renderAll();

                    console.log(`Pizarra táctica redimensionada de forma segura a ${newW}x${newH}`);
                }, 300); // 300ms de Debounce nativo para evitar 'Event Thrashing'
            };
            window.addEventListener('resize', this._resizeHandler);

            // FIX PILAR 1 + PILAR 2: Arrow Function — scope léxico de FabricEngine.
            // CANDADO DE COLISIÓN: si Fabric está en modo pincel nativo, retornar
            // inmediatamente para no interferir con _onMouseDownInDrawingMode.
            this._fc.on('mouse:down', (opt) => {
                if (this._fc.isDrawingMode) return; // ← Candado anti-crash del lápiz
                const tool = this._activeTool || '';
                if (tool === 'draw') return;

                // Dibujo dinámico para Zonas y Líneas
                if (tool.startsWith('zone-') || tool.startsWith('arrow-')) {
                    if (opt.target) return; // Si clica en un objeto existente, no dibujar

                    this._fc.selection = false;
                    const ptr = this._fc.getPointer(opt.e);
                    // FIX PILAR 2: Estado ENCENDIDO sólo en mouse:down con herramienta válida
                    this._isDrawingShape = true;
                    this._drawStartX = ptr.x;
                    this._drawStartY = ptr.y;

                    if (this._activeTool === 'zone-solid') {
                        this._tempShape = new fabric.Rect({
                            left: ptr.x, top: ptr.y, width: 0, height: 0,
                            fill: 'rgba(0,240,255,0.1)', stroke: '#00F0FF',
                            strokeWidth: 2, rx: 4, ry: 4, selectable: false, evented: false
                        });
                    } else if (this._activeTool === 'zone-dashed') {
                        this._tempShape = new fabric.Rect({
                            left: ptr.x, top: ptr.y, width: 0, height: 0,
                            fill: 'rgba(251,191,36,0.08)', stroke: '#fbbf24',
                            strokeWidth: 2, strokeDashArray: [8, 5], rx: 4, ry: 4, selectable: false, evented: false
                        });
                    } else if (this._activeTool === 'zone-red') {
                        this._tempShape = new fabric.Rect({
                            left: ptr.x, top: ptr.y, width: 0, height: 0,
                            fill: 'rgba(239,68,68,0.1)', stroke: '#ef4444',
                            strokeWidth: 2, rx: 4, ry: 4, selectable: false, evented: false
                        });
                    } else if (this._activeTool.startsWith('arrow-')) {
                        let color = '#ffffff', dash = [];
                        if (tool === 'arrow-pass') { dash = [8, 5]; color = '#ffffff'; }
                        else if (tool === 'arrow-run') { dash = []; color = '#facc15'; }
                        else { dash = []; color = '#00F0FF'; }

                        this._tempShape = new fabric.Line([ptr.x, ptr.y, ptr.x, ptr.y], {
                            stroke: color, strokeWidth: tool === 'arrow-solid' ? 3 : 2.5,
                            strokeDashArray: dash, selectable: false, evented: false
                        });
                    }

                    if (this._tempShape) {
                        this._fc.add(this._tempShape);
                    }
                    return;
                }

                if (opt.target) return;
                const ptr = this._fc.getPointer(opt.e);
                this._placeObject(ptr.x, ptr.y);
            });

            this._fc.on('mouse:move', (opt) => {
                if (this._fc.isDrawingMode) return; // ← Candado anti-crash del lápiz
                if (!this._isDrawingShape) return;
                if (!this._tempShape) return;
                const ptr = this._fc.getPointer(opt.e);
                const scale = 68 / this._fc.width; // Asumiendo ancho de cancha = 68m

                if (this._tempShape.type === 'rect') {
                    const w = Math.abs(ptr.x - this._drawStartX);
                    const h = Math.abs(ptr.y - this._drawStartY);
                    this._tempShape.set({
                        left: Math.min(ptr.x, this._drawStartX),
                        top: Math.min(ptr.y, this._drawStartY),
                        width: w,
                        height: h
                    });

                    const mX = (w * scale).toFixed(1);
                    const mY = (h * scale).toFixed(1);
                    this.updateMeasurementHUD(opt.e.clientX, opt.e.clientY, `${mX}m x ${mY}m`, true);

                } else if (this._tempShape.type === 'line') {
                    this._tempShape.set({ x2: ptr.x, y2: ptr.y });

                    const dx = ptr.x - this._drawStartX;
                    const dy = ptr.y - this._drawStartY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const mDist = (dist * scale).toFixed(1);
                    this.updateMeasurementHUD(opt.e.clientX, opt.e.clientY, `${mDist}m`, true);
                }

                this._fc.renderAll();
            });

            // FIX PILAR 2: Estado APAGADO forzosamente en mouse:up sin excepción.
            this._fc.on('mouse:up', (opt) => {
                this._isDrawingShape = false; // Estado siempre falso al soltar
                this.updateMeasurementHUD(0, 0, '', false);

                // FIX PILAR 3: Hard Reset de Estado
                if (this._activeTool !== 'draw') {
                    this._fc.isDrawingMode = false;
                    this._fc.selection = true;
                }

                if (this._tempShape) {

                    // Si el tamaño es muy pequeño (clic accidental), eliminar
                    let isTooSmall = false;
                    if (this._tempShape.type === 'rect' && (this._tempShape.width < 5 && this._tempShape.height < 5)) isTooSmall = true;
                    if (this._tempShape.type === 'line') {
                        const dx = this._tempShape.x2 - this._tempShape.x1;
                        const dy = this._tempShape.y2 - this._tempShape.y1;
                        if (Math.sqrt(dx * dx + dy * dy) < 5) isTooSmall = true;
                    }

                    if (isTooSmall) {
                        this._fc.remove(this._tempShape);
                        this._tempShape = null;
                        this._fc.renderAll();
                        return;
                    }

                    this._tempShape.set({ selectable: true, evented: true, hasControls: true });

                    // Para líneas, necesitamos agregar la cabeza de la flecha y agrupar
                    if (this._tempShape.type === 'line') {
                        const x1 = this._drawStartX, y1 = this._drawStartY;
                        const x2 = this._tempShape.x2, y2 = this._tempShape.y2;
                        const dx = x2 - x1, dy = y2 - y1;
                        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

                        const color = this._tempShape.stroke;
                        const head = new fabric.Triangle({
                            width: 14, height: 16, fill: color,
                            left: x2, top: y2, angle: angle + 90,
                            originX: 'center', originY: 'center',
                            selectable: false, evented: false
                        });

                        const lineObj = new fabric.Line([x1, y1, x2, y2], {
                            stroke: color, strokeWidth: this._tempShape.strokeWidth, strokeDashArray: this._tempShape.strokeDashArray,
                            selectable: true, hasControls: true, hasBorders: true, padding: 8
                        });

                        const grp = new fabric.Group([lineObj, head], { selectable: true, hasControls: true });
                        this._fc.remove(this._tempShape);
                        this._fc.add(grp);
                        this._fc.setActiveObject(grp);
                    } else {
                        this._fc.setActiveObject(this._tempShape);
                    }
                    this._tempShape = null;
                    this._fc.renderAll();
                }
            });
        },

        // ── Seleccionar herramienta y actualizar resalte de botones ──
        setTool(tool) {
            this._activeTool = tool;
            if (!this._fc) return;

            // Resaltar botón activo con clase CSS .tb-active
            this._toolBtns.forEach(id => {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.classList.toggle('tb-active', id === ('tool-' + tool));
            });

            if (tool === 'draw') {
                this._fc.isDrawingMode = true;
                if (this._fc.freeDrawingBrush) {
                    this._fc.freeDrawingBrush.color = '#00F0FF';
                    this._fc.freeDrawingBrush.width = 3;
                }
                this._fc.defaultCursor = 'crosshair';
            } else {
                this._fc.isDrawingMode = false;
                this._fc.defaultCursor = 'copy';
                this._fc.renderAll();
            }
        },

        // ═══════════════════════════════════════════════════════════════
        // _placeObject(x, y) — fábrica de objetos tácticos
        // ═══════════════════════════════════════════════════════════════
        _placeObject(x, y) {
            const t = this._activeTool;
            let obj = null;

            // ── Fichas de jugadores numeradas (fabric.Group) ──
            const playerMap = {
                'player-blue': { fill: '#1d6aff', shadow: 'rgba(29,106,255,0.7)', key: 'blue' },
                'player-red': { fill: '#ef4444', shadow: 'rgba(239,68,68,0.7)', key: 'red' },
                'player-yellow': { fill: '#eab308', shadow: 'rgba(234,179,8,0.7)', key: 'yellow' },
                'player-green': { fill: '#22c55e', shadow: 'rgba(34,197,94,0.7)', key: 'green' },
                'player-black': { fill: '#1f2937', shadow: 'rgba(31,41,55,0.7)', key: 'black' }
            };

            if (playerMap[t]) {
                const { fill, shadow, key } = playerMap[t];
                // Leer número manual o auto-incrementar
                const inputEl = document.getElementById('player-number-input');
                const manualNum = inputEl && inputEl.value.trim() !== '' ? inputEl.value.trim() : null;
                const num = manualNum !== null ? manualNum : ++this._playerCounter[key];
                obj = this._makePlayerToken(x, y, fill, shadow, num);

            } else if (t === 'ball') {
                obj = new fabric.Text('⚽', {
                    left: x - 14, top: y - 14, fontSize: 28,
                    fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif',
                    selectable: true, hasControls: true
                });

            } else if (t === 'cone') {
                obj = new fabric.Triangle({
                    width: 16, height: 22, left: x - 8, top: y - 11,
                    fill: '#f97316', stroke: '#fff', strokeWidth: 1,
                    selectable: true, hasControls: true,
                    shadow: new fabric.Shadow({ color: 'rgba(249,115,22,0.5)', blur: 8 })
                });

            } else if (t === 'minigoal') {
                obj = new fabric.Rect({
                    width: 44, height: 14, left: x - 22, top: y - 7,
                    fill: 'transparent', stroke: '#ffffff', strokeWidth: 3,
                    rx: 2, ry: 2, selectable: true, hasControls: true
                });

            } else if (t === 'text') {
                obj = new fabric.IText('Texto...', {
                    left: x - 20, top: y - 10,
                    fontFamily: 'Outfit, sans-serif', fill: '#ffffff',
                    fontSize: 20, fontWeight: '700',
                    selectable: true, hasControls: true
                });

                // ── Rutas inteligentes con flechas ──
            } else if (t === 'arrow-pass') {
                // Pase: línea punteada blanca con flecha
                const line = new fabric.Line([x, y, x + 90, y], {
                    stroke: '#ffffff', strokeWidth: 2.5, strokeDashArray: [9, 5],
                    selectable: true, hasControls: true, hasBorders: true, padding: 8
                });
                const head = new fabric.Triangle({
                    width: 12, height: 14, fill: '#ffffff',
                    left: x + 90 - 6, top: y - 7, angle: 90,
                    selectable: false, evented: false
                });
                obj = new fabric.Group([line, head], { selectable: true, hasControls: true });

            } else if (t === 'arrow-run') {
                // Conducción: curva sinusoidal amarilla con flecha
                const wave = new fabric.Path(
                    `M ${x} ${y} C ${x + 25} ${y - 28} ${x + 50} ${y + 28} ${x + 80} ${y}`,
                    {
                        stroke: '#facc15', strokeWidth: 2.5, fill: 'transparent',
                        selectable: true, hasControls: true
                    }
                );
                const head = new fabric.Triangle({
                    width: 12, height: 14, fill: '#facc15',
                    left: x + 80 - 6, top: y - 7, angle: 90,
                    selectable: false, evented: false
                });
                this._fc.add(wave);
                this._fc.add(head);
                this._fc.renderAll();
                return; // ya insertados individualmente

            } else if (t === 'arrow-solid') {
                // Flecha sólida rápida
                const line = new fabric.Line([x, y, x + 80, y], {
                    stroke: '#00F0FF', strokeWidth: 3,
                    selectable: true, hasControls: true, hasBorders: true, padding: 8
                });
                const head = new fabric.Triangle({
                    width: 14, height: 16, fill: '#00F0FF',
                    left: x + 80 - 7, top: y - 8, angle: 90,
                    selectable: false, evented: false
                });
                obj = new fabric.Group([line, head], { selectable: true, hasControls: true });

                // ── Zonas sombreadas ──
            } else if (t === 'zone-solid') {
                obj = new fabric.Rect({
                    left: x - 55, top: y - 38, width: 110, height: 76,
                    fill: 'rgba(0,240,255,0.1)', stroke: '#00F0FF',
                    strokeWidth: 2, selectable: true, hasControls: true, rx: 4, ry: 4
                });

            } else if (t === 'zone-dashed') {
                obj = new fabric.Rect({
                    left: x - 55, top: y - 38, width: 110, height: 76,
                    fill: 'rgba(251,191,36,0.08)', stroke: '#fbbf24',
                    strokeWidth: 2, strokeDashArray: [8, 5],
                    selectable: true, hasControls: true, rx: 4, ry: 4
                });

            } else if (t === 'zone-red') {
                obj = new fabric.Rect({
                    left: x - 55, top: y - 38, width: 110, height: 76,
                    fill: 'rgba(239,68,68,0.1)', stroke: '#ef4444',
                    strokeWidth: 2, selectable: true, hasControls: true, rx: 4, ry: 4
                });
            }

            if (obj) {
                this._fc.add(obj);
                this._fc.bringToFront(obj);
                this._fc.setActiveObject(obj);
                this._fc.renderAll();
            }
        },

        // ── Borrar objeto seleccionado ──
        deleteSelected() {
            if (!this._fc) return;
            const active = this._fc.getActiveObject();
            if (!active) return;
            if (active.type === 'activeSelection') {
                active.forEachObject(obj => this._fc.remove(obj));
                this._fc.discardActiveObject();
            } else {
                this._fc.remove(active);
            }
            this._fc.renderAll();
        },

        // ── LIMPIAR: elimina todos los objetos del usuario, el campo SIEMPRE sobrevive
        // porque está pintado en el hook 'before:render', no como un objeto Fabric.
        clear() {
            if (!this._fc) return;
            // Eliminar todos los objetos (trazos, jugadores, zonas, etc.)
            this._fc.getObjects().slice().forEach(obj => this._fc.remove(obj));
            // Limpiar trazos libres que puedan quedar en el buffer
            if (this._fc.freeDrawingBrush) {
                this._fc._isCurrentlyDrawing = false;
            }
            this._fc.discardActiveObject();
            this._fc.renderAll(); // before:render repinta el campo automáticamente
        },

        // ── Exportar PNG compuesto (campo SVG + objetos Fabric) ──
        toDataURL() {
            if (!this._fc) return null;

            const w = this._fc.getWidth();
            const h = this._fc.getHeight();

            // 1. Renderizar el SVG del campo en un canvas offscreen
            const offscreen = document.createElement('canvas');
            offscreen.width = w;
            offscreen.height = h;
            const octx = offscreen.getContext('2d');

            // Dibujar fondo verde + líneas del SVG
            octx.fillStyle = '#1a4a1a';
            octx.fillRect(0, 0, w, h);

            // Helper para dibujar las líneas tácticas del campo en escala
            const sx = w / 105;
            const sy = h / 68;
            octx.strokeStyle = 'rgba(255,255,255,0.3)';
            octx.lineWidth = 1;

            // Borde campo
            octx.strokeRect(0, 0, w, h);
            // Línea media
            octx.beginPath(); octx.moveTo(52.5 * sx, 0); octx.lineTo(52.5 * sx, h); octx.stroke();
            // Círculo central
            octx.beginPath(); octx.arc(52.5 * sx, 34 * sy, 9.15 * sx, 0, Math.PI * 2); octx.stroke();
            // Punto central
            octx.fillStyle = 'rgba(255,255,255,0.5)';
            octx.beginPath(); octx.arc(52.5 * sx, 34 * sy, 2, 0, Math.PI * 2); octx.fill();
            // Áreas
            octx.strokeStyle = 'rgba(255,255,255,0.3)';
            octx.strokeRect(0, 13.84 * sy, 16.5 * sx, 40.32 * sy);
            octx.strokeRect(0, 26.84 * sy, 5.5 * sx, 14.32 * sy);
            octx.strokeRect(88.5 * sx, 13.84 * sy, 16.5 * sx, 40.32 * sy);
            octx.strokeRect(99.5 * sx, 26.84 * sy, 5.5 * sx, 14.32 * sy);
            // Puntos penales
            ['rgba(255,255,255,0.5)'].forEach(c => {
                octx.fillStyle = c;
                octx.beginPath(); octx.arc(11 * sx, 34 * sy, 2, 0, Math.PI * 2); octx.fill();
                octx.beginPath(); octx.arc(94 * sx, 34 * sy, 2, 0, Math.PI * 2); octx.fill();
            });
            // Arcos
            octx.beginPath(); octx.arc(16.5 * sx, 34 * sy, 9.15 * sx, -Math.PI / 3, Math.PI / 3); octx.stroke();
            octx.beginPath(); octx.arc(88.5 * sx, 34 * sy, 9.15 * sx, Math.PI * 2 / 3, Math.PI * 4 / 3); octx.stroke();

            // 2. Componer encima los objetos de Fabric
            const fabricDataURL = this._fc.toDataURL({ format: 'png', multiplier: 1 });
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    octx.drawImage(img, 0, 0);
                    resolve(offscreen.toDataURL('image/png'));
                };
                img.onerror = () => resolve(offscreen.toDataURL('image/png'));
                img.src = fabricDataURL;
            });
        }
    },

    initCanvas() {
        this.FabricEngine.init();
    },

    clearCanvas() {
        this.FabricEngine.clear();
    },

    // ── FIX 4: ASISTENTE FISIOLÓGICO Y TÁCTICO (Juegos Reducidos) ──
    autoFillM2() {
        const objFisico = document.getElementById('ct-objetivo-fisico')?.value;
        const m2Input = document.getElementById('ct-m2-jugador');
        const volInput = document.getElementById('ct-volumen');
        const pausaInput = document.getElementById('ct-pausa');
        const helperEl = document.getElementById('ct-fisiologico-helper');

        // ── Tabla paramétrica basada en teoría de Juegos Reducidos ──
        const presets = {
            'Fuerza': {
                m2: 60,
                volumen: '2',
                pausa: '1',
                texto: 'Info: A menor espacio y n° de jugadores aumenta el ritmo, cambios de dirección, regates y contactos. Se sugieren bloques cortos de alta intensidad.'
            },
            'Resistencia': {
                m2: 125,
                volumen: '6',
                pausa: '2',
                texto: 'Info: A mayor espacio y jugadores (ej. 50x40m) aumenta la Vel. Máxima, aceleraciones y distancia a alta intensidad, pero baja el ritmo de juego.'
            },
            'Velocidad': {
                m2: 220,
                volumen: '1',
                pausa: '3',
                texto: 'Info: Espacios largos y bloques muy cortos (1 min) con pausa extensa (3 min) para garantizar recuperación neuromuscular completa.'
            },
            'Táctica': {
                m2: 80,
                volumen: '5',
                pausa: '2',
                texto: 'Info: Ideal para mejorar posesiones, ritmo y toma de decisiones. Cuadrados reducidos (ej. 6v6 en 30x50) fomentan la circulación y el pressing organizado.'
            },
            'Activación': {
                m2: 30,
                volumen: '3',
                pausa: '1',
                texto: 'Info: Espacios muy reducidos para activación neuromuscular pre-partido. Baja exigencia aeróbica, alta densidad de contactos.'
            }
        };

        const preset = presets[objFisico];

        if (preset) {
            if (m2Input) m2Input.value = preset.m2;
            if (volInput) volInput.value = preset.volumen;
            if (pausaInput) pausaInput.value = preset.pausa;

            // Mostrar texto de ayuda fisiológico
            if (helperEl) {
                helperEl.textContent = preset.texto;
                helperEl.style.display = 'block';
            }

            // Actualizar helper de densidad
            this.calcDensity();
        } else {
            // Sin selección: limpiar helper
            if (helperEl) {
                helperEl.textContent = '';
                helperEl.style.display = 'none';
            }
        }

        if (window.DTEngine?.FabricEngine?._fc && typeof window.DTEngine.FabricEngine._fc.calcOffset === 'function') {
            window.DTEngine.FabricEngine._fc.calcOffset();
        }
    },

    calcDensity() {
        const vol = parseFloat(document.getElementById('ct-volumen')?.value);
        const pausa = parseFloat(document.getElementById('ct-pausa')?.value);
        const helper = document.getElementById('ct-density-helper');
        if (!helper) return;

        if (!isNaN(vol) && !isNaN(pausa)) {
            helper.style.display = 'block';
            helper.textContent = `Densidad ${vol}:${pausa}`;
        } else {
            helper.style.display = 'none';
        }
        if (window.DTEngine?.FabricEngine?._fc && typeof window.DTEngine.FabricEngine._fc.calcOffset === 'function') {
            window.DTEngine.FabricEngine._fc.calcOffset();
        }
    },

    calcTacticalGroups() {
        const formatEl = document.getElementById('ct-tactical-format');
        const idealEl = document.getElementById('ct-ideal-players');
        const groupsEl = document.getElementById('ct-group-qty');
        const helperEl = document.getElementById('ct-calc-helper');
        const groupContainer = document.getElementById('ct-group-qty-container');

        if (!formatEl || !idealEl || !groupsEl || !helperEl || !groupContainer) return;

        const format = formatEl.value;
        const ideal = parseInt(idealEl.value, 10);
        const groups = parseInt(groupsEl.value, 10);

        if (format === 'Todo el Plantel') {
            groupContainer.style.display = 'none';
            if (!isNaN(ideal)) {
                helperEl.style.display = 'block';
                helperEl.textContent = `Resultado: 1 grupo de ${ideal} jugadores`;
            } else {
                helperEl.style.display = 'none';
            }
        } else {
            groupContainer.style.display = 'block';
            if (!isNaN(ideal) && !isNaN(groups) && groups > 0) {
                helperEl.style.display = 'block';
                const perGroup = Math.floor(ideal / groups);
                const remainder = ideal % groups;
                let text = `Resultado: ${groups} grupos de ${perGroup} jugadores`;
                if (remainder > 0) {
                    text += ` (Sobran ${remainder} jugador(es) para comodines/rotación)`;
                }
                helperEl.textContent = text;
            } else {
                helperEl.style.display = 'none';
            }
        }
        if (window.DTEngine?.FabricEngine?._fc && typeof window.DTEngine.FabricEngine._fc.calcOffset === 'function') {
            window.DTEngine.FabricEngine._fc.calcOffset();
        }
    },

    materialTags: [],

    addMaterialTag(tag) {
        if (!tag || tag.trim() === '') return;
        tag = tag.trim();
        if (!this.materialTags.includes(tag)) {
            this.materialTags.push(tag);
            this.renderMaterialTags();
        }
    },

    removeMaterialTag(tag) {
        this.materialTags = this.materialTags.filter(t => t !== tag);
        this.renderMaterialTags();
    },

    renderMaterialTags() {
        const container = document.getElementById('ct-materials-tags-container');
        if (!container) return;
        container.innerHTML = '';
        this.materialTags.forEach(tag => {
            const el = document.createElement('div');
            el.style.cssText = 'background:rgba(0,240,255,0.1); color:#00F0FF; border:1px solid rgba(0,240,255,0.3); padding:4px 10px; border-radius:12px; font-size:0.75rem; display:flex; align-items:center; gap:6px;';
            el.innerHTML = `
                <span>${tag}</span>
                <span onclick="window.DTEngine.removeMaterialTag('${tag}')" style="cursor:pointer; font-weight:bold; font-size:0.8rem; margin-left:4px;">&times;</span>
            `;
            container.appendChild(el);
        });
    },

    // --- BÓVEDA DE TAREAS PERSONALIZADAS ---
    openCustomTaskModal() {
        // Limpiar todos los campos del formulario
        ['ct-title', 'ct-description', 'ct-dimensions', 'ct-materials-input',
            'ct-rule-provocation', 'ct-rule-propension', 'ct-rule-continuity',
            'ct-density', 'ct-min-players', 'ct-max-players'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

        this.materialTags = [];
        this.renderMaterialTags();

        const morphSel = document.getElementById('ct-morfociclo');
        if (morphSel) morphSel.value = '';
        const sspSel = document.getElementById('ct-ssp-type');
        if (sspSel) sspSel.value = '';
        const momentSel = document.getElementById('ct-game-moment');
        if (momentSel) momentSel.value = '';

        // Reset brush controls
        const colorInput = document.getElementById('ct-brush-color');
        if (colorInput) colorInput.value = '#00F0FF';
        const sizeInput = document.getElementById('ct-brush-size');
        if (sizeInput) sizeInput.value = '3';

        // Mostrar modal
        document.getElementById('modal-custom-task').classList.remove('hidden');

        // Inicializar Fabric.js tras render DOM
        setTimeout(() => {
            this.FabricEngine.init();
            window.DTEngine.FabricEngine.setBackground('futbol11');
        }, 150);
    },

    closeCustomTaskModal() {
        document.getElementById('modal-custom-task').classList.add('hidden');
    },

    async saveCustomTask() {
        const uid = localStorage.getItem('ravix_v5_uid');
        if (!uid) return alert('Sesión no encontrada. Por favor vuelve a iniciar sesión.');

        // ════════════════════════════════════════════════════
        // 1. CAPTURA DE CAMPOS — mapeo 1:1 con custom_exercises
        // ════════════════════════════════════════════════════
        const title = (document.getElementById('ct-title')?.value || '').trim() || null;

        const description = (document.getElementById('ct-description')?.value || '').trim() || null;
        const objetivo_tactico = document.getElementById('ct-objetivo-tactico')?.value || null;
        const objetivo_fisico = document.getElementById('ct-objetivo-fisico')?.value || null;
        const volumen = parseFloat(document.getElementById('ct-volumen')?.value) || null;
        const pausa = parseFloat(document.getElementById('ct-pausa')?.value) || null;
        const m2_jugador = parseFloat(document.getElementById('ct-m2-jugador')?.value) || null;
        const densidad = (volumen !== null && pausa !== null) ? `${volumen}:${pausa}` : null;

        // Etiquetas visuales unificadas a string
        const materials = this.materialTags.length > 0 ? this.materialTags.join(', ') : null;

        // Reglas tácticas
        const rule_provocation = (document.getElementById('ct-rule-provocation')?.value || '').trim() || null;
        const rule_propension = (document.getElementById('ct-rule-propension')?.value || '').trim() || null;
        const rule_continuity = (document.getElementById('ct-rule-continuity')?.value || '').trim() || null;

        const tactical_format = document.getElementById('ct-tactical-format')?.value || 'Grupos / Estaciones';
        const ideal_players = parseInt(document.getElementById('ct-ideal-players')?.value || '0', 10) || null;
        const group_qty = tactical_format !== 'Todo el Plantel' ? (parseInt(document.getElementById('ct-group-qty')?.value || '0', 10) || null) : null;
        const usa_goleros = document.getElementById('ct-use-gks')?.value?.trim() || null;
        const usa_comodines = document.getElementById('ct-use-wildcards')?.value?.trim() || null;

        // Capturar nuevos campos para el DB estricto
        const _tagsRaw = document.getElementById('ct-tags')?.value || '';
        const tags = _tagsRaw ? _tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
        const series = parseInt(document.getElementById('ct-series')?.value, 10) || null;
        const blocks = parseInt(document.getElementById('ct-blocks')?.value, 10) || null;

        // ════════════════════════════════════════════════════
        // 2. EXPORTAR DIAGRAMA TÁCTICO → tactical_diagram_url
        // ════════════════════════════════════════════════════
        let tactical_diagram_url = null;
        try {
            if (this.FabricEngine._fc) {
                // Ensure everything is rendered
                this.FabricEngine._fc.renderAll();
                tactical_diagram_url = this.FabricEngine._fc.toDataURL({ format: 'png', multiplier: 1 });
            }
        } catch (e) {
            console.error('Error exportando diagrama:', e);
        }

        // ─── 3. Deshabilitar botón durante guardado ───
        const btn = document.getElementById('ct-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

        try {
            // ════════════════════════════════════════════════════
            // 3. INSERT → custom_exercises
            // ════════════════════════════════════════════════════
            const payload = {
                title,
                description,
                objetivo_fisico,
                objetivo_tactico,
                volumen,
                pausa,
                densidad,
                m2_jugador,
                formato: tactical_format,
                jugadores_total: ideal_players,
                cantidad_grupos: group_qty,
                usa_goleros,
                usa_comodines,
                materials,
                tactical_diagram_url,
                tags,
                series,
                blocks
            };

            console.log('💾 Payload custom_exercises:', payload);

            const { data, error } = await window.supabase
                .from('custom_exercises')
                .insert([payload])
                .select();

            if (error) throw new Error(error.message);
            const newTask = data[0];

            // ── Éxito: limpiar canvas y cerrar modal ──
            this.FabricEngine.clear();
            this.closeCustomTaskModal();

            // Actualizar lista local sin recargar
            if (!window.CustomExercises) window.CustomExercises = [];
            window.CustomExercises.unshift({ ...newTask, numericId: newTask.id, isCustom: true });
            const etiquetaReal = this.calcularEtiquetaMD(this._selectedDate, Array.from(this._matchDays));
            this.renderLibrary(etiquetaReal);

            // ── Toast de éxito ──
            this._showToast('✅ Tarea guardada en la Biblioteca', 'success');
            console.log('✅ Tarea guardada en custom_exercises → id:', newTask.id);

        } catch (err) {
            console.error('🔴 Error al guardar en custom_exercises:', err);
            this._showToast('❌ Error: ' + err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '💾 GUARDAR EN BIBLIOTECA'; }
        }
    },

    // ─── Toast de notificación (no bloquea como alert) ───
    _showToast(message, type = 'success') {
        const existing = document.getElementById('ravix-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'ravix-toast';
        toast.textContent = message;
        const bg = type === 'success' ? 'linear-gradient(135deg,rgba(0,240,255,0.12),rgba(0,136,204,0.18))' : 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(220,38,38,0.18))';
        const border = type === 'success' ? '#00F0FF' : '#ef4444';
        toast.style.cssText = `position:fixed;bottom:32px;right:32px;z-index:99999;padding:14px 22px;border-radius:12px;background:${bg};border:1px solid ${border};color:#F5F5F5;font-family:Outfit,sans-serif;font-size:0.9rem;font-weight:700;backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:ravix-toast-in 0.3s ease;`;
        if (!document.getElementById('ravix-toast-style')) {
            const s = document.createElement('style');
            s.id = 'ravix-toast-style';
            s.textContent = `@keyframes ravix-toast-in{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`;
            document.head.appendChild(s);
        }
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(() => toast.remove(), 400); }, 3500);
    },

    // ══════════════════════════════════════════════════════
    // MÓDULO RULES TAG INPUT — Reglas de Acción y Provocación
    // ══════════════════════════════════════════════════════
    RulesTagInput: {
        _tags: [],
        _dictionary: [
            'Espacio reducido a 2 toques',
            'Orientar presión a banda',
            'Pase vertical tras recuperación',
            'Laterales en amplitud máxima',
            'Pivote fijo como referencia',
            'Pressing al saque de banda rival',
            'Repliegue antes de línea propia',
            'Cambio de orientación en zona media',
            'Salida en 3 desde portero',
            'Cierre de líneas centrales'
        ],
        init() {
            const dl = document.getElementById('rules-tag-suggestions');
            if (!dl) return;
            dl.innerHTML = this._dictionary.map(p => `<option value="${p}">`).join('');
        },
        load(tagsArray) {
            this._tags = Array.isArray(tagsArray) ? [...tagsArray] : [];
            this.init();
            this._render();
        },
        getTags() { return [...this._tags]; },
        addTag(val) {
            const trimmed = val.trim();
            if (!trimmed || this._tags.includes(trimmed)) return;
            this._tags.push(trimmed);
            this._render();
        },
        removeTag(idx) { this._tags.splice(idx, 1); this._render(); },
        addFromInput() {
            const input = document.getElementById('rules-tag-input');
            if (!input || !input.value.trim()) return;
            this.addTag(input.value);
            input.value = '';
            input.focus();
        },
        onKeyDown(e) { if (e.key === 'Enter') { e.preventDefault(); this.addFromInput(); } },
        _render() {
            const container = document.getElementById('rules-tag-chips');
            if (!container) return;
            container.innerHTML = this._tags.map((tag, i) => `
                <span class="tag-chip rules-chip">
                    <span class="tag-chip-text">${tag}</span>
                    <button type="button" class="tag-chip-remove" onclick="DTEngine.RulesTagInput.removeTag(${i})">×</button>
                </span>
            `).join('');
        }
    },

    // ══════════════════════════════════════════════════════
    // MÓDULO PITCH ENGINE — Pizarra del 11 Ideal
    // ══════════════════════════════════════════════════════
    Board: {
        init: function () {
            const layer = document.getElementById('tokens-layer');
            if (!layer) return;
            layer.innerHTML = '';
            if (this.Interaction && this.Interaction.init) {
                this.Interaction.init();
            }
        },

        Spawner: {
            spawnSinglePlayer: function(type) {
                this.createFicha(type, 'P', 'Nuevo', 0.5, 0.5);
            },
            createFicha: function (type, posText, roleText, percentX, percentY) {
                const layer = document.getElementById('tokens-layer');
                if (!layer) return;
                const isLocal = type === 'local';
                const colorMain = isLocal ? '#00F2FE' : '#ff4d4d';
                const colorBg = isLocal ? 'rgba(0,242,254,0.15)' : 'rgba(255,77,77,0.15)';
                const colorShadow = isLocal ? 'rgba(0,242,254,0.4)' : 'rgba(255,77,77,0.4)';
                const textColor = isLocal ? '#001a1f' : '#fff';

                var lx = (percentX * 100).toFixed(2);
                var ly = (percentY * 100).toFixed(2);

                var ficha = document.createElement('div');
                ficha.style.position = 'absolute';
                ficha.style.left = lx + '%';
                ficha.style.top = ly + '%';
                ficha.style.transform = 'translate(-50%, -50%)';
                ficha.style.display = 'flex';
                ficha.style.flexDirection = 'column';
                ficha.style.alignItems = 'center';
                ficha.style.cursor = 'grab';
                ficha.style.userSelect = 'none';
                ficha.style.webkitUserSelect = 'none';
                ficha.style.zIndex = '20';
                ficha.style.pointerEvents = 'auto';
                ficha.style.transition = 'transform 0.12s ease, filter 0.12s ease';
                ficha.classList.add('tactical-ficha');

                var label = document.createElement('div');
                label.style.cssText = 'background:' + colorBg + '; border:1px solid ' + colorMain + '; color:' + colorMain + '; font-size:0.52rem; padding:2px 7px; border-radius:4px; font-weight:800; font-family:Outfit,sans-serif; margin-bottom:4px; pointer-events:none; white-space:nowrap; letter-spacing:0.5px; transition: all 0.2s; user-select: none; -webkit-user-select: none;';
                label.textContent = roleText;
                label.dataset.role = roleText;

                var circle = document.createElement('div');
                circle.style.cssText = 'width:38px; height:38px; background:' + colorMain + '; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:900; color:' + textColor + '; box-shadow: 0 0 12px ' + colorShadow + ', 0 4px 10px rgba(0,0,0,0.6); pointer-events:auto; cursor:text; font-family:Outfit,sans-serif; letter-spacing:-0.5px; position:relative; user-select: none; -webkit-user-select: none;';
                circle.textContent = posText;

                circle.addEventListener('dblclick', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    var newPos = prompt('Ingresa el número o posición (Ej: 5, MC, DC):', circle.textContent);
                    if (newPos !== null && newPos.trim() !== '') {
                        circle.textContent = newPos.trim().substring(0, 4).toUpperCase();
                    }
                });

                ficha.appendChild(label);
                ficha.appendChild(circle);

                window.DTEngine.Board.Interaction.makeDraggable(ficha);

                layer.appendChild(ficha);
            },
            addBallDOM: function () {
                const layer = document.getElementById('tokens-layer');
                if (!layer) return;

                var ball = document.createElement('div');
                ball.className = 'tactical-ball';
                ball.style.cssText = [
                    'position:absolute',
                    'left:50%',
                    'top:50%',
                    'transform:translate(-50%, -50%)',
                    'display:flex',
                    'align-items:center',
                    'justify-content:center',
                    'cursor:grab',
                    'user-select:none',
                    '-webkit-user-select:none',
                    'z-index:30',
                    'pointer-events:auto',
                    'font-size:1.2rem',
                    'width:24px',
                    'height:24px',
                    'background:#fff',
                    'border-radius:50%',
                    'box-shadow:0 0 10px rgba(255,255,255,0.5), inset -2px -2px 6px rgba(0,0,0,0.3)',
                    'transition:transform 0.1s ease'
                ].join(';');
                ball.textContent = '⚽';

                window.DTEngine.Board.Interaction.makeDraggable(ball, 1.3, '30');

                layer.appendChild(ball);
            }
        },

        Interaction: {
            init: function() {
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                        var tag = e.target.tagName;
                        if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
                        if (window.DTEngine && window.DTEngine.activeNode) {
                            console.log('Intentando borrar:', window.DTEngine.activeNode);
                            window.DTEngine.activeNode.remove();
                            window.DTEngine.Board.Interaction.selectNode(null);
                        }
                    }
                });

                document.addEventListener('pointerdown', function(e) {
                    var node = e.target.closest('.tactical-ficha, .tactical-ball, .tactical-zone, g');
                    if (node && node.tagName && node.tagName.toLowerCase() === 'g' && !node.closest('#tactical-svg-overlay')) {
                        node = null;
                    }
                    if (node) {
                        window.DTEngine.Board.Interaction.selectNode(node);
                    } else if (e.target.closest('#pitch-container')) {
                        window.DTEngine.Board.Interaction.selectNode(null);
                    }
                });
            },

            selectNode: function(el) {
                if (window.DTEngine.activeNode && window.DTEngine.activeNode !== el) {
                    var prev = window.DTEngine.activeNode;
                    prev.classList.remove('node-selected');
                    if (prev.classList.contains('tactical-zone')) {
                        prev.style.boxShadow = 'inset 0 0 20px rgba(0,242,254,0.04), 0 0 8px rgba(0,242,254,0.12)';
                        prev.style.borderColor = '#00f2fe';
                    } else if (prev.tagName === 'g') {
                        var pline = prev.querySelector('line');
                        if (pline) pline.setAttribute('stroke-width', '2');
                    } else if (prev.classList.contains('tactical-ficha') || prev.classList.contains('tactical-ball')) {
                        prev.style.filter = 'none';
                    }
                }

                window.DTEngine.activeNode = el;
                if (el) {
                    el.classList.add('node-selected');
                    if (el.classList.contains('tactical-zone')) {
                        el.style.boxShadow = 'inset 0 0 20px rgba(255,255,255,0.2), 0 0 12px rgba(255,255,255,0.8)';
                        el.style.borderColor = '#fff';
                    } else if (el.tagName === 'g') {
                        var line = el.querySelector('line');
                        if (line) line.setAttribute('stroke-width', '4');
                    } else if (el.classList.contains('tactical-ficha') || el.classList.contains('tactical-ball')) {
                        el.style.filter = 'drop-shadow(0 0 12px rgba(255,255,255,0.8))';
                    }
                }
            },

            makeDraggable: function(el, scaleUp = 1.18, normalZ = '20') {
                var isDragging = false;
                var layer = document.getElementById('tokens-layer');
                el.addEventListener('pointerdown', function (e) {
                    var overlayMode = window.DTEngine.Board.DrawTool._mode;
                    if (overlayMode !== 'none') return;
                    isDragging = true;
                    
                    window.DTEngine.Board.Interaction.selectNode(el);
                    
                    el.style.cursor = 'grabbing';
                    el.style.zIndex = '200';
                    el.style.transform = 'translate(-50%, -50%) scale(' + scaleUp + ')';
                    el.setPointerCapture(e.pointerId);
                });

                el.addEventListener('pointermove', function (e) {
                    if (!isDragging) return;
                    var rect = layer.getBoundingClientRect();
                    var nx = ((e.clientX - rect.left) / rect.width) * 100;
                    var ny = ((e.clientY - rect.top) / rect.height) * 100;
                    el.style.left = nx.toFixed(2) + '%';
                    el.style.top = ny.toFixed(2) + '%';
                });

                el.addEventListener('pointerup', function (e) {
                    if (!isDragging) return;
                    isDragging = false;
                    el.style.cursor = 'grab';
                    el.style.zIndex = normalZ;
                    el.style.transform = 'translate(-50%, -50%) scale(1)';
                    el.releasePointerCapture(e.pointerId);
                });
            }
        },

        DrawTool: {
            _mode: 'none',
            _drawing: false,
            _startX: 0,
            _startY: 0,
            _currentZone: null,
            _currentLine: null,
            _currentG: null,
            _boundDown: null,
            _boundMove: null,
            _boundUp: null,

            setMode: function (mode) {
                this._mode = mode;
                var pitchEl = document.getElementById('pitch-container');
                var tokensLayer = document.getElementById('tokens-layer');
                var svgOverlay = document.getElementById('tactical-svg-overlay');
                var zonesLayer = document.getElementById('zones-layer');
                var indicator = document.getElementById('overlay-mode-indicator');

                // Resetear estilos de todos los botones de herramienta
                ['tool-btn-zone','tool-btn-arrow','tool-btn-pass','tool-btn-none'].forEach(function(id){
                    var btn = document.getElementById(id);
                    if (!btn) return;
                    var isYellow = id === 'tool-btn-pass';
                    btn.style.background = isYellow ? 'rgba(255,200,0,0.05)' : 'rgba(0,242,254,0.05)';
                    btn.style.color = '#9ca3af';
                    btn.style.borderColor = isYellow ? 'rgba(255,200,0,0.15)' : 'rgba(0,242,254,0.15)';
                    btn.style.boxShadow = 'none';
                });

                // Destacar el botón activo
                var activeBtnId = {
                    'zone': 'tool-btn-zone',
                    'arrow': 'tool-btn-arrow',
                    'pass': 'tool-btn-pass',
                    'none': 'tool-btn-none'
                }[mode];
                if (activeBtnId) {
                    var activeBtn = document.getElementById(activeBtnId);
                    if (activeBtn) {
                        var isPassMode = mode === 'pass';
                        activeBtn.style.background = isPassMode ? 'rgba(255,200,0,0.15)' : 'rgba(0,242,254,0.15)';
                        activeBtn.style.color = isPassMode ? '#FFC800' : '#00F2FE';
                        activeBtn.style.borderColor = isPassMode ? '#FFC800' : '#00F2FE';
                        activeBtn.style.boxShadow = '0 0 10px ' + (isPassMode ? 'rgba(255,200,0,0.25)' : 'rgba(0,242,254,0.25)');
                    }
                }

                var modeLabels = {
                    'none': 'Mover Nodos',
                    'zone': 'Trazar Zona',
                    'arrow': 'Línea / Flecha',
                    'pass': 'Línea de Pase'
                };
                if (indicator) indicator.textContent = 'Modo: ' + (modeLabels[mode] || mode);

                if (mode === 'none') {
                    if (tokensLayer) tokensLayer.style.pointerEvents = 'auto';
                    if (svgOverlay) svgOverlay.style.pointerEvents = 'none';
                    if (zonesLayer) zonesLayer.style.pointerEvents = 'none';
                    if (pitchEl) pitchEl.style.cursor = 'default';
                    this._detachListeners(pitchEl);
                } else {
                    if (tokensLayer) tokensLayer.style.pointerEvents = 'none';
                    if (svgOverlay) svgOverlay.style.pointerEvents = 'none';
                    if (zonesLayer) zonesLayer.style.pointerEvents = 'none';
                    if (pitchEl) pitchEl.style.cursor = 'crosshair';
                    this._attachListeners(pitchEl);
                }
            },

            _attachListeners: function (container) {
                this._detachListeners(container);
                var self = this;
                this._boundDown = function(e) { self._onDown(e, container); };
                this._boundMove = function(e) { self._onMove(e, container); };
                this._boundUp   = function(e) { self._onUp(e, container); };
                container.addEventListener('pointerdown', this._boundDown);
                container.addEventListener('pointermove', this._boundMove);
                container.addEventListener('pointerup',   this._boundUp);
            },

            _detachListeners: function (container) {
                if (!container) return;
                if (this._boundDown) container.removeEventListener('pointerdown', this._boundDown);
                if (this._boundMove) container.removeEventListener('pointermove', this._boundMove);
                if (this._boundUp)   container.removeEventListener('pointerup',   this._boundUp);
                this._boundDown = this._boundMove = this._boundUp = null;
            },

            _getRelativePos: function (e, container) {
                var rect = container.getBoundingClientRect();
                return {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                    px: ((e.clientX - rect.left) / rect.width) * 100,
                    py: ((e.clientY - rect.top) / rect.height) * 100
                };
            },

            _makeInteractive: function (el) {
                el.style.pointerEvents = 'auto';
                el.style.cursor = 'pointer';
                el.addEventListener('pointerdown', function (e) {
                    if (window.DTEngine.Board.DrawTool._mode !== 'none') return;
                    e.stopPropagation();

                    window.DTEngine.Board.Interaction.selectNode(el);

                    var overlay = window.DTEngine.Board.DrawTool;
                    var container = document.getElementById('pitch-container');
                    var startPos = overlay._getRelativePos(e, container);

                    var initialLeft, initialTop;
                    var initialTx = 0, initialTy = 0;

                    if (el.classList.contains('tactical-zone')) {
                        if (e.offsetX > el.clientWidth - 16 && e.offsetY > el.clientHeight - 16) {
                            return; // Is on resize handle, allow native resize
                        }
                        initialLeft = parseFloat(el.style.left);
                        initialTop = parseFloat(el.style.top);
                    } else if (el.tagName === 'g') {
                        var t = el.getAttribute('transform');
                        if (t) {
                            var match = t.match(/translate\(([^,]+),\s*([^\)]+)\)/);
                            if (match) {
                                initialTx = parseFloat(match[1]);
                                initialTy = parseFloat(match[2]);
                            }
                        }
                    }

                    el.setPointerCapture(e.pointerId);

                    var moveHandler = function (ev) {
                        var currPos = overlay._getRelativePos(ev, container);
                        var dx = currPos.px - startPos.px;
                        var dy = currPos.py - startPos.py;

                        if (el.classList.contains('tactical-zone')) {
                            el.style.left = (initialLeft + dx) + '%';
                            el.style.top = (initialTop + dy) + '%';
                        } else if (el.tagName === 'g') {
                            var dxPx = currPos.x - startPos.x;
                            var dyPx = currPos.y - startPos.y;
                            el.setAttribute('transform', 'translate(' + (initialTx + dxPx) + ', ' + (initialTy + dyPx) + ')');
                        }
                    };

                    var upHandler = function (ev) {
                        el.releasePointerCapture(ev.pointerId);
                        el.removeEventListener('pointermove', moveHandler);
                        el.removeEventListener('pointerup', upHandler);
                    };

                    el.addEventListener('pointermove', moveHandler);
                    el.addEventListener('pointerup', upHandler);
                });
            },

            _onDown: function (e, container) {
                if (e.button !== 0) return;
                e.preventDefault();
                this._drawing = true;
                var pos = this._getRelativePos(e, container);
                this._startX = pos.x;
                this._startY = pos.y;
                container.setPointerCapture(e.pointerId);

                if (this._mode === 'zone') {
                    var zone = document.createElement('div');
                    zone.className = 'tactical-zone';
                    zone.style.cssText = [
                        'position:absolute',
                        'border:2px dashed #00f2fe',
                        'background:rgba(0,242,254,0.08)',
                        'border-radius:4px',
                        'pointer-events:none',
                        'box-shadow:inset 0 0 20px rgba(0,242,254,0.04), 0 0 8px rgba(0,242,254,0.12)',
                        'resize:both',
                        'overflow:hidden',
                        'max-width:100%',
                        'max-height:100%',
                        'left:' + pos.px.toFixed(2) + '%',
                        'top:' + pos.py.toFixed(2) + '%',
                        'width:0',
                        'height:0',
                        'transition: box-shadow 0.2s, border-color 0.2s'
                    ].join(';');
                    zone.dataset.ox = pos.x;
                    zone.dataset.oy = pos.y;
                    document.getElementById('zones-layer').appendChild(zone);
                    this._currentZone = zone;

                } else if (this._mode === 'arrow' || this._mode === 'pass') {
                    var svgEl = document.getElementById('tactical-svg-overlay');
                    var isPass = this._mode === 'pass';
                    var color = isPass ? '#FFC800' : '#00F2FE';
                    var markerId = isPass ? 'arrowhead-yellow' : 'arrowhead-cyan';

                    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    g.setAttribute('transform', 'translate(0, 0)');
                    g.style.pointerEvents = 'none';
                    g.style.transition = 'filter 0.2s';

                    var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', pos.px.toFixed(2) + '%');
                    line.setAttribute('y1', pos.py.toFixed(2) + '%');
                    line.setAttribute('x2', pos.px.toFixed(2) + '%');
                    line.setAttribute('y2', pos.py.toFixed(2) + '%');
                    line.setAttribute('stroke', color);
                    line.setAttribute('stroke-width', '2');
                    line.setAttribute('stroke-linecap', 'round');
                    line.setAttribute('marker-end', 'url(#' + markerId + ')');
                    line.setAttribute('filter', 'drop-shadow(0 0 4px ' + color + ')');
                    line.style.transition = 'stroke-width 0.2s';
                    
                    if (isPass) {
                        line.setAttribute('stroke-dasharray', '8,5');
                    }
                    g.appendChild(line);
                    svgEl.appendChild(g);
                    this._currentLine = line;
                    this._currentG = g;
                }
            },

            _onMove: function (e, container) {
                if (!this._drawing) return;
                e.preventDefault();
                var pos = this._getRelativePos(e, container);

                if (this._mode === 'zone' && this._currentZone) {
                    var rect = container.getBoundingClientRect();
                    var ox = parseFloat(this._currentZone.dataset.ox);
                    var oy = parseFloat(this._currentZone.dataset.oy);
                    var cx = pos.x;
                    var cy = pos.y;
                    var left   = Math.min(ox, cx);
                    var top    = Math.min(oy, cy);
                    var width  = Math.abs(cx - ox);
                    var height = Math.abs(cy - oy);
                    this._currentZone.style.left   = (left / rect.width * 100).toFixed(2) + '%';
                    this._currentZone.style.top    = (top  / rect.height * 100).toFixed(2) + '%';
                    this._currentZone.style.width  = (width / rect.width * 100).toFixed(2) + '%';
                    this._currentZone.style.height = (height / rect.height * 100).toFixed(2) + '%';

                } else if ((this._mode === 'arrow' || this._mode === 'pass') && this._currentLine) {
                    this._currentLine.setAttribute('x2', pos.px.toFixed(2) + '%');
                    this._currentLine.setAttribute('y2', pos.py.toFixed(2) + '%');
                }
            },

            _onUp: function (e, container) {
                if (!this._drawing) return;
                this._drawing = false;
                container.releasePointerCapture(e.pointerId);

                if (this._mode === 'zone' && this._currentZone) {
                    var w = parseFloat(this._currentZone.style.width);
                    var h = parseFloat(this._currentZone.style.height);
                    if (w < 2 && h < 2) {
                        this._currentZone.remove();
                    } else {
                        this._makeInteractive(this._currentZone);
                    }
                    this._currentZone = null;

                } else if ((this._mode === 'arrow' || this._mode === 'pass') && this._currentLine) {
                    var x1 = parseFloat(this._currentLine.getAttribute('x1'));
                    var x2 = parseFloat(this._currentLine.getAttribute('x2'));
                    var y1 = parseFloat(this._currentLine.getAttribute('y1'));
                    var y2 = parseFloat(this._currentLine.getAttribute('y2'));
                    if (Math.abs(x2 - x1) < 1.5 && Math.abs(y2 - y1) < 1.5) {
                        this._currentG.remove();
                    } else {
                        this._makeInteractive(this._currentG);
                    }
                    this._currentLine = null;
                    this._currentG = null;
                }
            },

            clearAll: function () {
                var svgEl = document.getElementById('tactical-svg-overlay');
                if (svgEl) {
                    Array.from(svgEl.children).forEach(function(child){
                        if (child.tagName !== 'defs') child.remove();
                    });
                }
                var zonesLayer = document.getElementById('zones-layer');
                if (zonesLayer) zonesLayer.innerHTML = '';
            }
        }
    },

    PitchEngine: {
        _esquema: '1-4-3-3',
        _profiles: {},      // { 'GK': { rol: '', fisicos: [], tacticos: [] } }
        _activePosition: null,

        rolesByLine: {
            GK: ['Portero Líbero', 'Atajador Tradicional', 'Dominador Aéreo'],
            DEF: ['Zaguero Marcador', 'Zaguero Libre', 'Lateral Defensivo', 'Lateral Ofensivo', 'Carrilero'],
            MED: ['Volante Tapón', 'Todoterreno', 'Organizador', 'Volante Mixto', 'Enganche', 'Rol Libre'],
            ATA: ['Extremo Abierto', 'Extremo Pierna Cambiada', 'Falso 9', 'Delantero Referencia', 'Atacante de Ruptura']
        },
        _fisicosDict: ['Velocidad Alta', 'Dominante Aéreo', 'Fuerte en Duelos', 'Biotipo Alto', 'Biotipo Bajo', 'Gran Resistencia (Stamina)', 'Agilidad/Explosividad'],
        _tacticosDict: ['Inteligencia Táctica', 'Salida Limpia', 'Agresivo en Presión', 'Lectura de Anticipación', 'Buen 1v1 Ofensivo', 'Buen 1v1 Defensivo', 'Juego de Espaldas'],

        _formations: {
            '1-4-3-3': [
                { row: 1, positions: [{ id: 'GK', label: 'GK' }] },
                { row: 2, positions: [{ id: 'LI', label: 'LI' }, { id: 'DFI', label: 'DFC-IZQ' }, { id: 'DFD', label: 'DFC-DER' }, { id: 'LD', label: 'LD' }] },
                { row: 3, positions: [{ id: 'MCI', label: 'MCI' }, { id: 'MC', label: 'MC' }, { id: 'MCD', label: 'MCD' }] },
                { row: 4, positions: [{ id: 'EI', label: 'EXT-IZQ' }, { id: 'DC', label: 'DEL' }, { id: 'ED', label: 'EXT-DER' }] }
            ],
            '1-4-4-2': [
                { row: 1, positions: [{ id: 'GK', label: 'GK' }] },
                { row: 2, positions: [{ id: 'LI', label: 'LI' }, { id: 'DFI', label: 'DFC-IZQ' }, { id: 'DFD', label: 'DFC-DER' }, { id: 'LD', label: 'LD' }] },
                { row: 3, positions: [{ id: 'MCI', label: 'MCI' }, { id: 'MCO1', label: 'MCO-IZQ' }, { id: 'MCO2', label: 'MCO-DER' }, { id: 'MCD', label: 'MCD' }] },
                { row: 4, positions: [{ id: 'DI', label: 'DEL-IZQ' }, { id: 'DD', label: 'DEL-DER' }] }
            ],
            '1-3-5-2': [
                { row: 1, positions: [{ id: 'GK', label: 'GK' }] },
                { row: 2, positions: [{ id: 'DFI', label: 'DFC-IZQ' }, { id: 'DFC', label: 'DFC-CEN' }, { id: 'DFD', label: 'DFC-DER' }] },
                { row: 3, positions: [{ id: 'CRL1', label: 'CRL-IZQ' }, { id: 'MCI', label: 'MCI' }, { id: 'MCO', label: 'MCO' }, { id: 'MCD', label: 'MCD' }, { id: 'CRL2', label: 'CRL-DER' }] },
                { row: 4, positions: [{ id: 'DI', label: 'DEL-IZQ' }, { id: 'DD', label: 'DEL-DER' }] }
            ],
            '1-4-2-3-1': [
                { row: 1, positions: [{ id: 'GK', label: 'GK' }] },
                { row: 2, positions: [{ id: 'LI', label: 'LI' }, { id: 'DFI', label: 'DFC-IZQ' }, { id: 'DFD', label: 'DFC-DER' }, { id: 'LD', label: 'LD' }] },
                { row: 3, positions: [{ id: 'MCD1', label: 'MCD-IZQ' }, { id: 'MCD2', label: 'MCD-DER' }] },
                { row: 4, positions: [{ id: 'EI', label: 'EXT-IZQ' }, { id: 'MCO', label: 'MCO' }, { id: 'ED', label: 'EXT-DER' }] },
                { row: 5, positions: [{ id: 'DC', label: 'DELANTERO' }] }
            ]
        },

        load(ideal11) {
            if (!ideal11 || typeof ideal11 !== 'object') { this.renderPitch(this._esquema); return; }
            this._esquema = ideal11.esquema || '1-4-3-3';
            this._profiles = ideal11.perfiles || {};
            const sel = document.getElementById('dna-esquema');
            if (sel) sel.value = this._esquema;
            this.renderPitch(this._esquema);
        },

        getData() {
            return { esquema: this._esquema, perfiles: { ...this._profiles } };
        },

        renderPitch(esquema) {
            this._esquema = esquema;
            const container = document.getElementById('tactical-pitch');
            if (!container) return;

            const formation = this._formations[esquema];
            if (!formation) return;

            const rowsHTML = formation.map(rowDef => {
                const positionsHTML = rowDef.positions.map(pos => {
                    const profile = this._profiles[pos.id];
                    const hasProfile = profile && typeof profile === 'object' && profile.rol;
                    const badgeHTML = hasProfile ? `<div class="role-badge">${profile.rol}</div>` : '';

                    return `
                        <div class="pitch-position ${hasProfile ? 'has-profile' : ''}"
                             onclick="DTEngine.PitchEngine.openPositionModal('${pos.id}', '${pos.label}')"
                             title="${hasProfile ? 'Perfil definido ✓' : 'Click para definir perfil'}">
                            ${badgeHTML}
                            <div class="pitch-pos-circle">${pos.label}</div>
                            ${hasProfile ? '<div class="pitch-pos-dot"></div>' : ''}
                        </div>
                    `;
                }).join('');
                return `<div class="pitch-row">${positionsHTML}</div>`;
            }).join('');

            container.innerHTML = `
                <div class="pitch-field">
                    <div class="pitch-center-circle"></div>
                    <div class="pitch-halfway-line"></div>
                    <div class="pitch-penalty-box top"></div>
                    <div class="pitch-penalty-box bottom"></div>
                    <div class="pitch-formation-rows">${rowsHTML}</div>
                </div>
            `;
        },

        openPositionModal(posId, label) {
            this._activePosition = posId;
            const modal = document.getElementById('position-modal');
            const title = document.getElementById('position-modal-title');
            if (!modal || !title) return;

            title.textContent = label;

            let profile = this._profiles[posId];
            if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
                profile = { rol: '', fisicos: [], tacticos: [] };
            }

            // Logic to detect line
            let lineKey = 'ATA';
            const upperLabel = posId.toUpperCase();
            if (upperLabel === 'GK') {
                lineKey = 'GK';
            } else if (upperLabel.includes('M') || upperLabel.includes('CARR')) {
                lineKey = 'MED';
            } else if (upperLabel.includes('E') || upperLabel.includes('DC') || upperLabel.includes('DEL') || upperLabel === 'DI' || upperLabel === 'DD') {
                lineKey = 'ATA';
            } else if (upperLabel.includes('D') || upperLabel === 'LI' || upperLabel === 'LD') {
                lineKey = 'DEF';
            }

            const lineRoles = this.rolesByLine[lineKey] || [];

            const renderChips = (containerId, dict, type, selectedItems) => {
                const container = document.getElementById(containerId);
                if (!container) return;
                container.innerHTML = dict.map(item => {
                    const isSelected = type === 'radio' ? item === selectedItems : selectedItems.includes(item);
                    return `
                        <label class="role-chip ${isSelected ? 'selected' : ''}">
                            <input type="${type}" name="pos_${type}_${containerId}" value="${item}" ${isSelected ? 'checked' : ''} onchange="DTEngine.PitchEngine.toggleRole(this.parentElement, '${type}')">
                            <span class="role-chip-text">${item}</span>
                        </label>
                    `;
                }).join('');
            };

            renderChips('options-rol', lineRoles, 'radio', profile.rol);
            renderChips('options-fisicos', this._fisicosDict, 'checkbox', profile.fisicos || []);
            renderChips('options-tacticos', this._tacticosDict, 'checkbox', profile.tacticos || []);

            modal.classList.remove('hidden');
        },

        toggleRole(labelElement, type) {
            if (type === 'radio') {
                const siblings = labelElement.parentElement.querySelectorAll('.role-chip');
                siblings.forEach(el => el.classList.remove('selected'));
                labelElement.classList.add('selected');
            } else {
                if (labelElement.querySelector('input').checked) {
                    labelElement.classList.add('selected');
                } else {
                    labelElement.classList.remove('selected');
                }
            }
        },

        closePositionModal() {
            const modal = document.getElementById('position-modal');
            if (modal) modal.classList.add('hidden');
            this._activePosition = null;
        },

        savePositionProfile() {
            if (!this._activePosition) return;

            const getValues = (containerId, selector) => {
                const container = document.getElementById(containerId);
                if (!container) return [];
                const inputs = container.querySelectorAll(selector);
                return Array.from(inputs).map(i => i.value);
            };

            const rolSel = getValues('options-rol', 'input[type="radio"]:checked')[0] || '';
            const fisicosSel = getValues('options-fisicos', 'input[type="checkbox"]:checked');
            const tacticosSel = getValues('options-tacticos', 'input[type="checkbox"]:checked');

            this._profiles[this._activePosition] = {
                rol: rolSel,
                fisicos: fisicosSel,
                tacticos: tacticosSel
            };

            this.renderPitch(this._esquema);
            this.closePositionModal();
        }
    },

    // ══════════════════════════════════════════════════════
    // MÓDULO TAG INPUT — Principios Operativos del Modelo de Juego
    // ══════════════════════════════════════════════════════
    TagInput: {
        _tags: [],

        // Diccionario base de principios (ofensivos + defensivos)
        _dictionary: [
            // Ofensivos
            'Atracción y Cambio de Orientación',
            'Cobertura Espacio Cercano',
            'Tercer Hombre',
            'Creación de Superioridades',
            'Juego a Espaldas',
            'Temporización Ofensiva',
            // Defensivos
            'Orientación del Rival',
            'Reducción Líneas de Pase',
            'Equilibrio Defensivo',
            'Densidad Defensiva',
            'Compensación de Espacios',
            'Unidad Defensiva'
        ],

        init() {
            // Inyectar opciones en el datalist
            const dl = document.getElementById('tag-suggestions');
            if (!dl) return;
            dl.innerHTML = this._dictionary
                .map(p => `<option value="${p}">`)
                .join('');
        },

        load(tagsArray) {
            this._tags = Array.isArray(tagsArray) ? [...tagsArray] : [];
            this.init();
            this._render();
        },

        getTags() {
            return [...this._tags];
        },

        addTag(val) {
            const trimmed = val.trim();
            if (!trimmed || this._tags.includes(trimmed)) return;
            this._tags.push(trimmed);
            this._render();
        },

        removeTag(idx) {
            this._tags.splice(idx, 1);
            this._render();
        },

        addFromInput() {
            const input = document.getElementById('tag-input');
            if (!input || !input.value.trim()) return;
            this.addTag(input.value);
            input.value = '';
            input.focus();
        },

        onKeyDown(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addFromInput();
            }
        },

        _render() {
            const container = document.getElementById('tag-chips');
            if (!container) return;
            container.innerHTML = this._tags.map((tag, i) => `
                <span class="tag-chip">
                    <span class="tag-chip-text">${tag}</span>
                    <button type="button" class="tag-chip-remove" onclick="DTEngine.TagInput.removeTag(${i})">×</button>
                </span>
            `).join('');
        }
    },

    // ══════════════════════════════════════════════════════
    // MÓDULO PERIODIZACIÓN — Macro/Meso/Microciclo
    // ══════════════════════════════════════════════════════
    Periodization: {
        _defaultPhases: [
            { name: 'Pretemporada', color: '#f59e0b', objetivos: ['Volumen aeróbico', 'Fuerza base', 'Cohesión táctica inicial'] },
            { name: 'Competencia', color: '#00F2FE', objetivos: ['Afinación táctica', 'Intensidad específica', 'Automatismos'] },
            { name: 'Play-offs', color: '#a855f7', objetivos: ['Pico de rendimiento', 'Gestión de carga', 'Estrategia rival'] },
            { name: 'Transición', color: '#6b7280', objetivos: ['Recuperación activa', 'Evaluación de temporada', 'Planificación'] }
        ],

        init: function () {
            var self = this;
            var stored = window.CurrentTeam ? window.CurrentTeam.periodization : null;

            if (stored && stored.macrociclo) {
                window.DTEngine._periodization = stored;
            }

            if (!window.DTEngine._periodization) {
                window.DTEngine._periodization = self._buildDefault();
            }

            self.renderTimeline();
            self.renderProcessView();
            self.setView(window.DTEngine._calendarView || 'weekly');
        },

        _buildDefault: function () {
            var year = new Date().getFullYear();
            var phases = this._defaultPhases.map(function (p, i) {
                var startMonth = i * 3;
                var endMonth = startMonth + 2;
                return {
                    name: p.name,
                    color: p.color,
                    objetivos: p.objetivos.slice(),
                    start: year + '-' + String(startMonth + 1).padStart(2, '0') + '-01',
                    end: year + '-' + String(endMonth + 1).padStart(2, '0') + '-28',
                    completed: false
                };
            });
            return {
                macrociclo: 'Temporada ' + year,
                fases: phases,
                fase_actual_idx: 0
            };
        },

        _getCurrentPhaseIdx: function () {
            var per = window.DTEngine._periodization;
            if (!per || !per.fases) return 0;
            var today = new Date().toISOString().split('T')[0];
            for (var i = 0; i < per.fases.length; i++) {
                if (today >= per.fases[i].start && today <= per.fases[i].end) return i;
            }
            return per.fase_actual_idx || 0;
        },

        renderTimeline: function () {
            var per = window.DTEngine._periodization;
            if (!per) return;

            var macroEl = document.getElementById('periodo-macro-name');
            var faseEl = document.getElementById('periodo-fase-label');
            var tlEl = document.getElementById('periodo-timeline');
            var legEl = document.getElementById('periodo-legend');
            if (!macroEl || !faseEl || !tlEl) return;

            var currentIdx = this._getCurrentPhaseIdx();
            per.fase_actual_idx = currentIdx;

            macroEl.textContent = per.macrociclo || 'Sin definir';
            faseEl.textContent = per.fases[currentIdx] ? per.fases[currentIdx].name : '—';

            var totalDays = 0;
            var phaseDays = [];
            per.fases.forEach(function (f) {
                var s = new Date(f.start + 'T00:00:00');
                var e = new Date(f.end + 'T00:00:00');
                var d = Math.max(1, Math.round((e - s) / 86400000));
                phaseDays.push(d);
                totalDays += d;
            });

            var html = '';
            var legendHtml = '';
            per.fases.forEach(function (f, i) {
                var pct = ((phaseDays[i] / totalDays) * 100).toFixed(1);
                var isPast = i < currentIdx;
                var isCurrent = i === currentIdx;
                var opacity = isPast ? '1' : (isCurrent ? '0.85' : '0.25');
                var bgColor = f.color || '#334155';
                var borderStyle = isCurrent ? 'border: 2px solid #fff; margin: -1px;' : '';

                html += '<div style="width: ' + pct + '%; height: 100%; background: ' + bgColor + '; opacity: ' + opacity + '; position: relative; transition: opacity 0.3s; ' + borderStyle + '" title="' + f.name + '">';
                if (isCurrent) {
                    html += '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.55rem; color: #fff; font-weight: 900; font-family: Outfit, sans-serif; white-space: nowrap; text-shadow: 0 1px 3px rgba(0,0,0,0.6);">' + f.name.toUpperCase() + '</div>';
                }
                html += '</div>';

                var dotStyle = isPast ? 'background:' + bgColor : (isCurrent ? 'background:' + bgColor + '; box-shadow: 0 0 6px ' + bgColor : 'background: #334155');
                legendHtml += '<div style="display: flex; align-items: center; gap: 5px;"><div style="width: 8px; height: 8px; border-radius: 50%; ' + dotStyle + ';"></div><span style="font-size: 0.6rem; color: ' + (isCurrent ? '#e5e7eb' : '#6b7280') + '; font-family: Outfit, sans-serif; font-weight: ' + (isCurrent ? '700' : '500') + ';">' + f.name + '</span></div>';
            });

            tlEl.innerHTML = html;
            if (legEl) legEl.innerHTML = legendHtml;

            // ══ ROADMAP BANNER ══
            var roadmapEl = document.getElementById('periodo-roadmap');
            if (roadmapEl && per.fases[currentIdx]) {
                var currentFase = per.fases[currentIdx];
                var fasesDone = currentIdx;
                var today2 = new Date();
                var phaseStart = new Date(currentFase.start ? currentFase.start + 'T00:00:00' : today2);
                var phaseEnd = new Date(currentFase.end ? currentFase.end + 'T00:00:00' : today2);
                var phaseLen = Math.max(1, phaseEnd - phaseStart);
                var elapsed = Math.max(0, Math.min(phaseLen, today2 - phaseStart));
                var phasePct = Math.round((elapsed / phaseLen) * 100);
                var weeksLeft = Math.max(0, Math.round((phaseEnd - today2) / (7 * 86400000)));
                var phaseColor = currentFase.color || '#00F2FE';

                // Format date helper
                var fmtDate = function (d) {
                    if (!d) return '—';
                    var parts = d.split('-');
                    if (parts.length < 3) return d;
                    var months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                    return parts[2] + ' ' + months[parseInt(parts[1]) - 1];
                };

                // Build objectives HTML
                var objsHtml = '';
                (currentFase.objetivos || []).slice(0, 3).forEach(function (obj) {
                    objsHtml += '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;"><span style="color:' + phaseColor + ';font-size:0.6rem;">◉</span><span style="font-size:0.72rem;color:#9ca3af;font-family:Outfit,sans-serif;">' + obj + '</span></div>';
                });

                roadmapEl.innerHTML =
                    '<div class="spm-roadmap-card">'
                    + '<div class="spm-roadmap-left">'
                    + '<div class="spm-roadmap-meta">'
                    + '<span class="spm-roadmap-badge">' + per.macrociclo + '</span>'
                    + '<span style="font-size:0.6rem;color:#4b5563;font-family:Outfit,sans-serif;">' + fmtDate(currentFase.start) + ' → ' + fmtDate(currentFase.end) + '</span>'
                    + '</div>'
                    + '<h2 class="spm-roadmap-phase-name" style="color:' + phaseColor + ';">' + currentFase.name + '</h2>'
                    + '<p class="spm-roadmap-sub">Fase ' + (fasesDone + 1) + ' de ' + per.fases.length + ' &nbsp;·&nbsp; Mesociclo activo</p>'
                    + objsHtml
                    + '</div>'
                    + '<div class="spm-roadmap-right">'
                    + '<div class="spm-roadmap-pct-label"><span style="color:#6b7280;font-size:0.65rem;font-weight:700;font-family:Outfit,sans-serif;">PROGRESO DE ETAPA</span><span style="color:' + phaseColor + ';font-size:0.7rem;font-weight:800;font-family:Outfit,sans-serif;">' + phasePct + '%</span></div>'
                    + '<div class="spm-roadmap-bar"><div class="spm-roadmap-fill" style="width:' + phasePct + '%;background:' + phaseColor + ';box-shadow:0 0 8px ' + phaseColor + ';"></div></div>'
                    + '<p style="margin:6px 0 0 0;color:#4b5563;font-size:0.65rem;font-family:Outfit,sans-serif;">Restan <strong style="color:#9ca3af;">' + weeksLeft + '</strong> semana' + (weeksLeft !== 1 ? 's' : '') + '</p>'
                    + '</div>'
                    + '</div>';
            }
        },

        renderProcessView: function () {
            var per = window.DTEngine._periodization;
            var grid = document.getElementById('process-phases-grid');
            if (!per || !grid) return;

            var currentIdx = this._getCurrentPhaseIdx();
            var tasks = window.DTEngine._assignedTasks || {};
            var totalSessionsGlobal = 0;
            Object.keys(tasks).forEach(function (k) { totalSessionsGlobal += tasks[k].length; });

            var html = '';
            per.fases.forEach(function (fase, i) {
                var isPast = i < currentIdx;
                var isCurrent = i === currentIdx;
                var statusText = isPast ? 'COMPLETADA' : (isCurrent ? 'EN CURSO' : 'PENDIENTE');
                var statusColor = isPast ? '#10b981' : (isCurrent ? '#00F2FE' : '#374151');
                var borderColor = isCurrent ? fase.color : 'rgba(255,255,255,0.05)';

                var sessionsInPhase = 0;
                Object.keys(tasks).forEach(function (dateStr) {
                    if (dateStr >= fase.start && dateStr <= fase.end) {
                        sessionsInPhase += tasks[dateStr].length;
                    }
                });

                var objHtml = '';
                fase.objetivos.forEach(function (obj, oi) {
                    var checkColor = isPast ? '#10b981' : (isCurrent && oi === 0 ? '#00F2FE' : '#374151');
                    var icon = isPast ? '✓' : (isCurrent && oi === 0 ? '◉' : '○');
                    objHtml += '<div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.03);"><span style="color: ' + checkColor + '; font-size: 0.7rem; width: 16px;">' + icon + '</span><span style="font-size: 0.72rem; color: ' + (isPast ? '#9ca3af' : '#e5e7eb') + '; font-family: Outfit, sans-serif;">' + obj + '</span></div>';
                });

                html += '<div style="background: linear-gradient(145deg, #111827 0%, #0d1117 100%); border: 1px solid ' + borderColor + '; border-radius: 12px; padding: 20px; transition: border-color 0.3s;">';
                html += '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;"><h4 style="color: ' + fase.color + '; font-family: Outfit, sans-serif; font-size: 0.9rem; margin: 0; font-weight: 700;">' + fase.name + '</h4><span style="font-size: 0.55rem; font-weight: 800; color: ' + statusColor + '; background: rgba(255,255,255,0.03); padding: 3px 8px; border-radius: 4px; letter-spacing: 1px; font-family: Outfit, sans-serif;">' + statusText + '</span></div>';
                html += '<div style="display: flex; gap: 16px; margin-bottom: 14px;"><div style="text-align: center;"><div style="font-size: 1.3rem; font-weight: 900; color: #e5e7eb; font-family: Outfit, sans-serif;">' + sessionsInPhase + '</div><div style="font-size: 0.55rem; color: #6b7280; font-weight: 700; letter-spacing: 0.5px;">SESIONES</div></div><div style="text-align: center;"><div style="font-size: 1.3rem; font-weight: 900; color: #e5e7eb; font-family: Outfit, sans-serif;">' + fase.start.substring(5) + '</div><div style="font-size: 0.55rem; color: #6b7280; font-weight: 700; letter-spacing: 0.5px;">INICIO</div></div><div style="text-align: center;"><div style="font-size: 1.3rem; font-weight: 900; color: #e5e7eb; font-family: Outfit, sans-serif;">' + fase.end.substring(5) + '</div><div style="font-size: 0.55rem; color: #6b7280; font-weight: 700; letter-spacing: 0.5px;">FIN</div></div></div>';
                html += '<div style="font-size: 0.6rem; color: #6b7280; font-weight: 800; letter-spacing: 1px; margin-bottom: 8px; font-family: Outfit, sans-serif;">OBJETIVOS</div>';
                html += objHtml;
                html += '</div>';
            });

            grid.innerHTML = html;
        },

        setView: function (viewName) {
            window.DTEngine._calendarView = viewName;
            var weekly = document.getElementById('dt-weekly-view');
            var process = document.getElementById('dt-process-view');
            var btnW = document.getElementById('btn-view-weekly');
            var btnP = document.getElementById('btn-view-process');

            if (weekly) weekly.style.display = viewName === 'weekly' ? 'block' : 'none';
            if (process) process.style.display = viewName === 'process' ? 'block' : 'none';

            if (btnW) {
                btnW.style.background = viewName === 'weekly' ? '#00F2FE' : 'transparent';
                btnW.style.color = viewName === 'weekly' ? '#0d1117' : '#6b7280';
            }
            if (btnP) {
                btnP.style.background = viewName === 'process' ? '#00F2FE' : 'transparent';
                btnP.style.color = viewName === 'process' ? '#0d1117' : '#6b7280';
            }
        },

        save: function () {
            var per = window.DTEngine._periodization;
            if (!per) return;

            var teamId = window.CurrentTeam ? window.CurrentTeam.id : null;
            var token = localStorage.getItem('ravix_token');
            if (!teamId || !token) {
                console.warn('Periodization.save: No team or token');
                return;
            }

            window.supabase.from('team_configs').update({ periodization: per }).eq('team_id', teamId)
                .then(function ({ error }) {
                    if (!error) {
                        console.log('✅ Periodización guardada en Supabase.');
                        if (window.CurrentTeam) window.CurrentTeam.periodization = per;
                    } else {
                        console.error('🔴 Error al guardar periodización:', error.message);
                    }
                }).catch(function (err) {
                    console.error('🔴 Error de red al guardar periodización:', err);
                });
        },

        updatePhase: function (idx, field, value) {
            var per = window.DTEngine._periodization;
            if (!per || !per.fases[idx]) return;
            per.fases[idx][field] = value;
            this.renderTimeline();
            this.renderProcessView();
            this.save();
        },

        setMacroName: function (name) {
            var per = window.DTEngine._periodization;
            if (!per) return;
            per.macrociclo = name;
            this.renderTimeline();
            this.save();
        }
    }

};


// Board Background Selector Binding
document.addEventListener("DOMContentLoaded", () => {
    const bgSelector = document.getElementById('board-background-selector');
    if (bgSelector) {
        bgSelector.addEventListener('change', (e) => {
            if (window.DTEngine && window.DTEngine.FabricEngine) {
                window.DTEngine.FabricEngine.setBackground(e.target.value);
            }
        });
    }
});
