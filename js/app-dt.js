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

                    <div class="header-actions">
                        <button onclick="DTEngine.toggleView('home')" class="btn-logout">🏠 HOME</button>
                        <button id="btn-nav-calendar" onclick="DTEngine.toggleView('calendar')" class="btn-logout">📅 CALENDARIO</button>

                        <button id="btn-nav-analytics" onclick="DTEngine.toggleView('analytics')" class="btn-logout">📊 ANALÍTICA</button>
                        <button onclick="if(window.DTEngine) window.DTEngine.toggleView('board')" class="btn-logout">🏟️ PIZARRA</button>
                        <button onclick="App.logout()" class="btn-logout">SALIR</button>
                    </div>
                </header>

                <main class="dt-main-content">
                    <section id="dt-home-view" class="dt-home-view">
                        <!-- Widget 1: Perfil & Identidad -->
                        <div class="platinum-widget profile-widget" onclick="window.DTEngine.toggleView('profile')" style="cursor: pointer;">
                            <div class="pw-content">
                                <div class="dt-avatar-ring">
                                    <div class="dt-avatar-inner"></div>
                                </div>
                                <div class="dt-info">
                                    <span class="dt-tag">DIRECTOR TÉCNICO</span>
                                    <h2 class="dt-name">${window.CurrentUser?.name || 'STAFF'}</h2>
                                    <p class="dt-team-info">${teamName} | Categoría Elite</p>
                                </div>
                                <div class="dt-badge-chrome">LICENSE ${window.CurrentUser?.license || 'UEFA PRO'}</div>
                            </div>
                        </div>

                        <!-- Widget 3: Centro de Comando -->
                        <div class="platinum-widget command-widget">
                            <div class="pw-header">
                                <h3>Centro de Comando</h3>
                            </div>
                            <div id="home-command-center" class="command-center-grid">
                                <div class="cc-block">
                                    <span class="cc-label">PRÓXIMO PARTIDO</span>
                                    <span id="cc-next-match" class="cc-value">—</span>
                                </div>
                                <div class="cc-block">
                                    <span class="cc-label">FOCO DE HOY</span>
                                    <span id="cc-today-focus" class="cc-value">—</span>
                                </div>
                            </div>
                        </div>

                        <!-- Widget 2: Línea de Tiempo Táctica (Calendario) -->
                        <div class="platinum-widget timeline-widget" onclick="DTEngine.toggleView('calendar')">
                            <div class="pw-header">
                                <h3>Línea de Tiempo Semanal</h3>
                                <span class="pw-action">Planificación Completa →</span>
                            </div>
                            <div id="home-timeline-row" class="pw-timeline">
                                <!-- Inyección dinámica -->
                            </div>
                        </div>

                        <!-- Widget 3: Dashboard Analítico -->
                        <div class="platinum-widget stats-widget" onclick="DTEngine.toggleView('analytics')">
                            <div class="pw-header">
                                <h3>Monitor de Rendimiento Platinado</h3>
                                <span class="pw-action">Detalle Estadístico →</span>
                            </div>
                            <div class="pw-charts-row">
                                <div class="pw-mini-chart">
                                    <canvas id="home-chart-load"></canvas>
                                </div>
                                <div class="pw-mini-chart">
                                    <canvas id="home-chart-moments"></canvas>
                                </div>
                            </div>
                        </div>

                        <!-- Widget 4: Sala de Juegos -->
                        <div class="platinum-widget" onclick="if(window.DTEngine) window.DTEngine.toggleView('board')" style="cursor: pointer; border-color: var(--primary-color);">
                            <h3 style="color: var(--primary-color); margin-bottom: 5px;">SALA DE JUEGOS</h3>
                            <p style="color: #888; font-size: 0.85rem;">Pizarra Táctica Interactiva</p>
                        </div>
                    </section>



                    <section id="dt-calendar-view" class="dt-dashboard-view" style="display: none;">

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

                    <section id="dt-analytics-view" class="dt-analytics-view" style="display: none;">
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
                    <section id="view-profile" class="view-section" style="display: none; width: 100%; box-sizing: border-box;">
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
                    
                    <section id="view-board" class="view-section hidden" style="display: none; width: 100%; margin-top: 15px; box-sizing: border-box;">
                        <div style="display: flex; gap: 20px; width: 100%; height: 85vh;">
                            <div style="width: 260px; background: #111827; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); padding: 20px; display: flex; flex-direction: column; gap: 15px; flex-shrink: 0;">
                                <h3 style="color: var(--primary-color, #00F2FE); margin: 0; font-family: Outfit; font-size: 1.2rem;">SALA DE JUEGOS</h3>
                                <p style="color: #6b7280; font-size: 0.8rem; margin-top: -10px; margin-bottom: 10px;">Diseño Táctico</p>
                                
                                <label style="color: #9ca3af; font-size: 0.75rem; font-weight: bold; margin-bottom: -10px;">ESQUEMA LOCAL</label>
                                <select id="slocal" onchange="window.DTEngine.Board.deployTeams(this.value, document.getElementById('srival').value)" style="padding: 10px; background: #1f2937; color: white; border: 1px solid #374151; border-radius: 6px; outline: none; cursor: pointer;">
                                    <option value="4-3-3">1-4-3-3 Ofensivo</option>
                                    <option value="4-4-2">1-4-4-2 Clásico</option>
                                    <option value="4-2-3-1">1-4-2-3-1 Equilibrado</option>
                                    <option value="3-5-2">1-3-5-2 Carrileros</option>
                                </select>
                    
                                <label style="color: #9ca3af; font-size: 0.75rem; font-weight: bold; margin-top: 10px; margin-bottom: -10px;">ESQUEMA RIVAL</label>
                                <select id="srival" onchange="window.DTEngine.Board.deployTeams(document.getElementById('slocal').value, this.value)" style="padding: 10px; background: #1f2937; color: white; border: 1px solid #374151; border-radius: 6px; outline: none; cursor: pointer;">
                                    <option value="4-4-2">1-4-4-2 Clásico</option>
                                    <option value="4-3-3">1-4-3-3 Ofensivo</option>
                                    <option value="4-2-3-1">1-4-2-3-1 Equilibrado</option>
                                    <option value="3-5-2">1-3-5-2 Carrileros</option>
                                </select>
                    
                                <button onclick="window.DTEngine.Board.deployTeams(document.getElementById('slocal').value, document.getElementById('srival').value)" style="margin-top: auto; padding: 12px; background: rgba(255, 77, 77, 0.1); color: #ff4d4d; border: 1px solid rgba(255, 77, 77, 0.3); border-radius: 6px; cursor: pointer; font-weight: bold;">↻ Restaurar Posiciones</button>
                            </div>
                    
                            <div style="flex: 1; background: #0f172a; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                <svg viewBox="0 -5 105 78" style="width: 95%; height: 95%; overflow: visible; opacity: 0.8;">
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
                                <div id="tokens-layer" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
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
                                    <div id="library-list" class="exercise-list-container"></div>
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
                        <div style="width:35%; background:#111111; border-right:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; box-sizing:border-box; overflow:hidden;">
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

                                <!-- MORFOCICLO PHASE + SSP TYPE -->
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
                                    <div>
                                        <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:5px;">Morfociclo</label>
                                        <select id="ct-morfociclo" style="width:100%; padding:10px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; outline:none; font-family:Outfit,sans-serif; font-size:0.82rem; cursor:pointer; box-sizing:border-box;">
                                            <option value="">—</option>
                                            <option value="MD-5">MD-5</option>
                                            <option value="MD-4">MD-4</option>
                                            <option value="MD-3">MD-3</option>
                                            <option value="MD-2">MD-2</option>
                                            <option value="MD-1">MD-1</option>
                                            <option value="MD">MD (Partido)</option>
                                            <option value="MD+1">MD+1</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:5px;">Tipo SSP</label>
                                        <select id="ct-ssp-type" style="width:100%; padding:10px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; outline:none; font-family:Outfit,sans-serif; font-size:0.82rem; cursor:pointer; box-sizing:border-box;">
                                            <option value="">—</option>
                                            <option value="General">General</option>
                                            <option value="Dirigida">Dirigida</option>
                                            <option value="Especial">Especial</option>
                                            <option value="Competitiva">Competitiva</option>
                                        </select>
                                    </div>
                                </div>

                                <!-- MOMENTO DE JUEGO -->
                                <div style="margin-bottom:14px;">
                                    <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:5px;">Momento de Juego</label>
                                    <select id="ct-game-moment" style="width:100%; padding:10px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; outline:none; font-family:Outfit,sans-serif; font-size:0.82rem; cursor:pointer; box-sizing:border-box;">
                                        <option value="">—</option>
                                        <option value="ataque_organizado">Ataque Organizado</option>
                                        <option value="defensa_organizada">Defensa Organizada</option>
                                        <option value="transicion_off">Transición Ofensiva</option>
                                        <option value="transicion_def">Transición Defensiva</option>
                                    </select>
                                </div>

                                <!-- JUGADORES + DENSIDAD -->
                                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
                                    <div>
                                        <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; display:block; margin-bottom:5px;">Min Jug.</label>
                                        <input type="number" id="ct-min-players" min="2" max="22" placeholder="6" style="width:100%; padding:10px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; outline:none; box-sizing:border-box; font-size:0.85rem; text-align:center;">
                                    </div>
                                    <div>
                                        <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; display:block; margin-bottom:5px;">Max Jug.</label>
                                        <input type="number" id="ct-max-players" min="2" max="22" placeholder="11" style="width:100%; padding:10px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; outline:none; box-sizing:border-box; font-size:0.85rem; text-align:center;">
                                    </div>
                                    <div>
                                        <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; display:block; margin-bottom:5px;">Dens. m²/jug</label>
                                        <input type="number" id="ct-density" step="0.1" placeholder="36.0" style="width:100%; padding:10px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; outline:none; box-sizing:border-box; font-size:0.85rem; text-align:center;">
                                    </div>
                                </div>

                                <!-- DIMENSIONES -->
                                <div style="margin-bottom:14px;">
                                    <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:5px;">Dimensiones</label>
                                    <input type="text" id="ct-dimensions" placeholder="Ej: 20x40m" style="width:100%; padding:11px 12px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; font-size:0.85rem; outline:none; box-sizing:border-box; transition:border-color 0.2s;" onfocus="this.style.borderColor='#00F0FF'" onblur="this.style.borderColor='#2a2a2a'">
                                </div>

                                <!-- MATERIALES -->
                                <div style="margin-bottom:14px;">
                                    <label style="font-size:0.68rem; color:#9ca3af; font-weight:700; letter-spacing:1px; text-transform:uppercase; display:block; margin-bottom:5px;">Materiales <span style="color:#6b7280;">(separados por coma)</span></label>
                                    <input type="text" id="ct-materials" placeholder="petos, balones, conos" style="width:100%; padding:11px 12px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; font-size:0.85rem; outline:none; box-sizing:border-box; transition:border-color 0.2s;" onfocus="this.style.borderColor='#00F0FF'" onblur="this.style.borderColor='#2a2a2a'">
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

                                <!-- CONOS COMO ARCO + SUPERFICIE -->
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
                                    <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:#080808; border:1px solid #2a2a2a; border-radius:8px;">
                                        <input type="checkbox" id="ct-cones-goals" style="width:16px; height:16px; accent-color:#00F0FF; cursor:pointer; flex-shrink:0;">
                                        <label for="ct-cones-goals" style="font-size:0.75rem; color:#9ca3af; font-weight:600; cursor:pointer; line-height:1.2;">Conos como arcos</label>
                                    </div>
                                    <div>
                                        <label style="font-size:0.65rem; color:#9ca3af; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; display:block; margin-bottom:5px;">Superficie</label>
                                        <select id="ct-pitch-suitability" multiple style="width:100%; padding:6px 8px; background:#080808; border:1px solid #2a2a2a; border-radius:8px; color:#F5F5F5; outline:none; font-family:Outfit,sans-serif; font-size:0.8rem; cursor:pointer; box-sizing:border-box; height:60px;">
                                            <option value="grass">Grass</option>
                                            <option value="synthetic">Sintético</option>
                                            <option value="futsal">Futsal</option>
                                            <option value="dirt">Tierra</option>
                                        </select>
                                    </div>
                                </div>

                            </div><!-- /scroll body -->

                            <!-- GUARDAR -->
                            <div style="padding:16px 24px; border-top:1px solid rgba(255,255,255,0.06); flex-shrink:0;">
                                <button id="ct-save-btn" onclick="DTEngine.saveCustomTask()" style="width:100%; padding:15px; background:linear-gradient(135deg,#00F0FF,#0088cc); color:#000; border:none; border-radius:10px; font-weight:900; font-family:Outfit,sans-serif; font-size:1rem; cursor:pointer; letter-spacing:1.5px; text-transform:uppercase; transition:transform 0.1s, filter 0.2s; box-shadow:0 4px 20px rgba(0,240,255,0.25);" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'" onmouseover="this.style.filter='brightness(1.15)'" onmouseout="this.style.filter='brightness(1)'">💾 GUARDAR EN BIBLIOTECA</button>
                            </div>
                        </div>

                        <!-- ═══ COLUMNA DERECHA: PIZARRA TÁCTICA FABRIC.JS (65%) ═══ -->
                        <div style="width:65%; background:#080808; display:flex; flex-direction:column; position:relative;">

                            <!-- ── BARRA DE HERRAMIENTAS TÁCTICA ── -->
                            <div id="tactical-toolbar" style="padding:10px 16px; background:#0d0d0d; border-bottom:1px solid rgba(0,240,255,0.12); display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex-shrink:0;">

                                <!-- Etiqueta -->
                                <span style="font-size:0.65rem; color:#00F0FF; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; white-space:nowrap; margin-right:4px;">🎨 HERRAMIENTAS</span>
                                <div style="width:1px; height:28px; background:rgba(255,255,255,0.08); margin:0 4px;"></div>

                                <!-- TRAZO LIBRE -->
                                <button id="tool-draw" onclick="DTEngine.FabricEngine.setTool('draw')" title="Trazo Libre"
                                    style="display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 10px; background:rgba(0,240,255,0.15); border:1.5px solid #00F0FF; border-radius:8px; color:#00F0FF; cursor:pointer; font-size:0.65rem; font-weight:700; min-width:52px; transition:all 0.15s; font-family:Outfit,sans-serif;">
                                    <span style="font-size:1.1rem;">✏️</span>Trazo
                                </button>

                                <!-- JUGADOR AZUL -->
                                <button id="tool-player-blue" onclick="DTEngine.FabricEngine.setTool('player-blue')" title="Jugador Titular"
                                    style="display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 10px; background:transparent; border:1.5px solid #334155; border-radius:8px; color:#9ca3af; cursor:pointer; font-size:0.65rem; font-weight:700; min-width:52px; transition:all 0.15s; font-family:Outfit,sans-serif;">
                                    <span style="display:inline-block; width:18px; height:18px; border-radius:50%; background:#0088ff; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,136,255,0.5);"></span>Local
                                </button>

                                <!-- JUGADOR ROJO -->
                                <button id="tool-player-red" onclick="DTEngine.FabricEngine.setTool('player-red')" title="Jugador Rival"
                                    style="display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 10px; background:transparent; border:1.5px solid #334155; border-radius:8px; color:#9ca3af; cursor:pointer; font-size:0.65rem; font-weight:700; min-width:52px; transition:all 0.15s; font-family:Outfit,sans-serif;">
                                    <span style="display:inline-block; width:18px; height:18px; border-radius:50%; background:#ef4444; border:2px solid #fff; box-shadow:0 2px 6px rgba(239,68,68,0.5);"></span>Rival
                                </button>

                                <!-- BALÓN -->
                                <button id="tool-ball" onclick="DTEngine.FabricEngine.setTool('ball')" title="Balón"
                                    style="display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 10px; background:transparent; border:1.5px solid #334155; border-radius:8px; color:#9ca3af; cursor:pointer; font-size:0.65rem; font-weight:700; min-width:52px; transition:all 0.15s; font-family:Outfit,sans-serif;">
                                    <span style="font-size:1.1rem;">⚽</span>Balón
                                </button>

                                <!-- ZONA SÓLIDA -->
                                <button id="tool-zone-solid" onclick="DTEngine.FabricEngine.setTool('zone-solid')" title="Zona Sólida"
                                    style="display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 10px; background:transparent; border:1.5px solid #334155; border-radius:8px; color:#9ca3af; cursor:pointer; font-size:0.65rem; font-weight:700; min-width:52px; transition:all 0.15s; font-family:Outfit,sans-serif;">
                                    <span style="display:inline-block; width:20px; height:14px; border:2px solid #fff; border-radius:2px;"></span>Zona
                                </button>

                                <!-- ZONA PUNTEADA -->
                                <button id="tool-zone-dashed" onclick="DTEngine.FabricEngine.setTool('zone-dashed')" title="Zona Punteada"
                                    style="display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 10px; background:transparent; border:1.5px solid #334155; border-radius:8px; color:#9ca3af; cursor:pointer; font-size:0.65rem; font-weight:700; min-width:52px; transition:all 0.15s; font-family:Outfit,sans-serif;">
                                    <span style="display:inline-block; width:20px; height:14px; border:2px dashed rgba(255,255,255,0.7); border-radius:2px;"></span>Punteado
                                </button>

                                <!-- Spacer -->
                                <div style="flex:1;"></div>
                                <div style="width:1px; height:28px; background:rgba(255,255,255,0.08);"></div>

                                <!-- BORRAR SELECCIONADO -->
                                <button onclick="DTEngine.FabricEngine.deleteSelected()" title="Borrar seleccionado"
                                    style="display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 10px; background:rgba(239,68,68,0.06); border:1.5px solid rgba(239,68,68,0.3); border-radius:8px; color:#ef4444; cursor:pointer; font-size:0.65rem; font-weight:700; min-width:52px; transition:all 0.15s; font-family:Outfit,sans-serif;" onmouseover="this.style.background='rgba(239,68,68,0.15)'" onmouseout="this.style.background='rgba(239,68,68,0.06)'">
                                    <span style="font-size:1.1rem;">🗑️</span>Borrar
                                </button>

                                <!-- LIMPIAR TODO -->
                                <button onclick="DTEngine.clearCanvas()" title="Limpiar toda la pizarra"
                                    style="display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 10px; background:rgba(239,68,68,0.06); border:1.5px solid rgba(239,68,68,0.3); border-radius:8px; color:#ef4444; cursor:pointer; font-size:0.65rem; font-weight:700; min-width:52px; transition:all 0.15s; font-family:Outfit,sans-serif;" onmouseover="this.style.background='rgba(239,68,68,0.15)'" onmouseout="this.style.background='rgba(239,68,68,0.06)'">
                                    <span style="font-size:1.1rem;">💣</span>Limpiar
                                </button>

                                <!-- CERRAR -->
                                <button onclick="DTEngine.closeCustomTaskModal()"
                                    style="padding:8px; background:transparent; border:none; color:#6b7280; font-size:1.3rem; cursor:pointer; transition:color 0.15s; line-height:1; border-radius:6px;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#6b7280'">✕</button>
                            </div>

                            <!-- Canvas container (Fabric.js) -->
                            <div id="premium-tactical-board-container" style="flex:1; position:relative; overflow:hidden;">
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

        // --- INICIALIZAR COMPONENTES DE PERFIL ---
        if (this.TagInput) this.TagInput.init();
        if (this.RulesTagInput) this.RulesTagInput.init();
        if (this.PitchEngine && typeof this.PitchEngine.init === 'function') this.PitchEngine.init();

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
                        <div class="task-chip" draggable="${!isPast}" ondragstart="event.dataTransfer.setData('text/plain', '${a.logId}|${a.block}|${dateStr}'); event.stopPropagation();" onclick="event.stopPropagation(); window.DTEngine.openTaskModal('${a.rawId || a.id}')">
                            ${timeBadge}<span class="tc-name">${ex.title}</span>
                            ${!isPast ? `<span class="tc-delete" onclick="event.stopPropagation(); window.DTEngine.removeTask('${dateStr}', ${assignments.indexOf(a)})">\u00d7</span>` : ''}
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

    async removeTask(date, index) {
        try {
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
        } catch(err) {
            console.error("🔴 Error al borrar custom task:", err);
            alert("Error al borrar la tarea: " + err.message);
        }
    },

    async openTaskModal(taskId) {
        try {
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

            this.renderTaskModal(task);
        } catch (error) {
            console.error("Error abriendo popup:", error);
        }
    },

    renderTaskModal(task) {
        const modal = document.getElementById('dt-modal');
        const body = document.getElementById('modal-body-content');
        const tagsHtml = Array.isArray(task.tags)
            ? task.tags.map(t => `<span style="background:rgba(0,242,254,0.1);color:#00F2FE;padding:2px 8px;border-radius:4px;font-size:0.7rem;font-weight:700;margin-right:5px;border:1px solid rgba(0,242,254,0.3);">${t}</span>`).join('')
            : '';

        body.innerHTML = `
            <div class="modal-header">
                <div class="m-title-group">
                    <span class="m-task-id">#${task.numericId}</span>
                    <h2 class="m-task-title">${task.title}</h2>
                    ${tagsHtml ? `<div style="margin-top:8px;">${tagsHtml}</div>` : ''}
                </div>
                <button class="btn-close-modal" onclick="DTEngine.closeModal()">✕</button>
            </div>
            <div class="modal-grid" style="grid-template-columns: 1fr;">
                <!-- Metadatos Base -->
                <div style="display:flex;gap:15px;background:rgba(255,255,255,0.03);padding:15px;border-radius:12px;border:1px solid rgba(255,255,255,0.05);margin-bottom:15px;">
                    <div style="flex:1"><label style="font-size:0.65rem;color:#888;text-transform:uppercase;">Momento</label><p style="margin:2px 0 0;font-weight:700;color:#fff;">${(task.game_moment || '').replace('_', ' ').toUpperCase()}</p></div>
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
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    },

    closeModal() { document.getElementById('dt-modal').classList.add('hidden'); },
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

        const matchDates = window.CurrentTeam?.match_dates || Array.from(this._matchDays);
        const todayStr = new Date().toISOString().split('T')[0];
        const todayMidnight = new Date(todayStr + 'T00:00:00');

        // --- PRÓXIMO PARTIDO ---
        const futureDates = matchDates
            .filter(d => d >= todayStr)  // inclye hoy (match day)
            .sort();

        if (futureDates.length === 0) {
            nextMatchEl.textContent = 'Sin partidos programados';
            nextMatchEl.className = 'cc-value cc-neutral';
        } else {
            const nextStr = futureDates[0];
            const nextDate = new Date(nextStr + 'T00:00:00');
            const msPerDay = 24 * 60 * 60 * 1000;
            const daysUntil = Math.round((nextDate - todayMidnight) / msPerDay);

            if (daysUntil === 0) {
                nextMatchEl.textContent = '¡DÍA DE PARTIDO!';
                nextMatchEl.className = 'cc-value cc-match';
            } else {
                const formatted = nextDate.toLocaleDateString('es', { day: '2-digit', month: 'long' }).toUpperCase();
                nextMatchEl.textContent = `${formatted} — Faltan ${daysUntil} días`;
                nextMatchEl.className = 'cc-value cc-future';
            }
        }

        // --- FOCO DE HOY ---
        const todayLabel = this.calcularEtiquetaMD(todayStr, matchDates);
        todayFocusEl.textContent = todayLabel;
        const focusClass = this.getTypeClass(todayLabel);
        todayFocusEl.className = `cc-value ${focusClass ? 'cc-' + focusClass.replace('type-', '') : 'cc-base'}`;
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

        [home, cal, an, prof, board].forEach(v => { if (v) v.style.display = 'none'; });

        let targetView = null;

        if (viewName === 'home') {
            targetView = home;
            this.updateHomeUI();
        } else if (viewName === 'analytics') {
            targetView = an;
            this.renderAnalytics();
        } else if (viewName === 'profile') {
            targetView = prof;
            this.loadProfile();
        } else if (viewName === 'board') {
            targetView = board;
        } else if (viewName === 'calendar') {
            targetView = cal;
            setTimeout(function () { window.DTEngine.Periodization.init(); }, 50);
        }

        if (targetView) {
            targetView.style.display = 'block';
            if (viewName === 'board') {
                setTimeout(() => window.DTEngine.Board.init(), 100);
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
                        if(innerAvatar) {
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
            reader.onload = function(e) {
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

        if (!name) return alert('El nombre es obligatorio.');

        try {
            console.log('💾 Guardando Perfil DT...');
            const profilePayload = {
                id: uid,
                licencia: valLicencia,
                avatar_url: valAvatar
            };

            const { error: pErr } = await window.supabase.from('profiles_dt').upsert(profilePayload);
            if (pErr) throw pErr;

            const { error: uErr } = await window.supabase.from('users').update({ name, license: valLicencia }).eq('id', uid);
            if (uErr) throw uErr;

            if (window.CurrentUser) {
                window.CurrentUser.name = name;
                window.CurrentUser.license = valLicencia;
                if (valAvatar) {
                    const innerAvatar = document.querySelector('.dt-avatar-inner');
                    if(innerAvatar) {
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
                if(valLogo) window.CurrentTeam.logo_url = valLogo;
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
        _fc: null,           // instancia fabric.Canvas
        _activeTool: 'draw', // herramienta activa

        // Lista de IDs de botones de herramientas para resalte
        _toolBtns: ['tool-draw','tool-player-blue','tool-player-red',
                    'tool-ball','tool-zone-solid','tool-zone-dashed'],

        init() {
            // Destruir instancia anterior si existe
            if (this._fc) {
                try { this._fc.dispose(); } catch(e) {}
                this._fc = null;
            }

            const container = document.getElementById('premium-tactical-board-container');
            if (!container) return;
            const w = container.clientWidth  || 800;
            const h = container.clientHeight || 500;

            // Asignar dimensiones físicas al elemento canvas
            const canvasEl = document.getElementById('premium-tactical-board');
            if (!canvasEl) return;
            canvasEl.width  = w;
            canvasEl.height = h;

            // Inicializar Fabric — fondo transparente para que el SVG sea visible
            this._fc = new fabric.Canvas('premium-tactical-board', {
                selection: true,
                backgroundColor: null,
                enableRetinaScaling: false
            });
            this._fc.setWidth(w);
            this._fc.setHeight(h);

            // Activar trazo libre por defecto
            this.setTool('draw');

            // Click en canvas vacío => añadir objeto según herramienta activa
            this._fc.on('mouse:down', (opt) => {
                if (this._activeTool === 'draw') return; // fabric maneja freehand
                if (opt.target) return;                  // click sobre objeto existente
                const ptr = this._fc.getPointer(opt.e);
                this._placeObject(ptr.x, ptr.y);
            });
        },

        // ── Seleccionar herramienta y actualizar resalte de botones ──
        setTool(tool) {
            this._activeTool = tool;
            if (!this._fc) return;

            // Resaltar botón activo
            this._toolBtns.forEach(id => {
                const btn = document.getElementById(id);
                if (!btn) return;
                const isActive = id === ('tool-' + tool);
                btn.style.background = isActive ? 'rgba(0,240,255,0.18)' : 'transparent';
                btn.style.borderColor = isActive ? '#00F0FF' : '#334155';
                btn.style.color = isActive ? '#00F0FF' : '#9ca3af';
            });

            if (tool === 'draw') {
                this._fc.isDrawingMode = true;
                this._fc.freeDrawingBrush.color = '#00F0FF';
                this._fc.freeDrawingBrush.width = 3;
                this._fc.defaultCursor = 'crosshair';
            } else {
                this._fc.isDrawingMode = false;
                this._fc.defaultCursor = 'copy';
                this._fc.renderAll();
            }
        },

        // ── Colocar objeto en (x, y) según herramienta ──
        _placeObject(x, y) {
            let obj;
            const t = this._activeTool;

            if (t === 'player-blue') {
                obj = new fabric.Circle({
                    radius: 15, left: x - 15, top: y - 15,
                    fill: '#0088ff', stroke: '#ffffff', strokeWidth: 2.5,
                    selectable: true, hasControls: true,
                    shadow: new fabric.Shadow({ color: 'rgba(0,136,255,0.6)', blur: 10 })
                });
            } else if (t === 'player-red') {
                obj = new fabric.Circle({
                    radius: 15, left: x - 15, top: y - 15,
                    fill: '#ef4444', stroke: '#ffffff', strokeWidth: 2.5,
                    selectable: true, hasControls: true,
                    shadow: new fabric.Shadow({ color: 'rgba(239,68,68,0.6)', blur: 10 })
                });
            } else if (t === 'ball') {
                obj = new fabric.Text('⚽', {
                    left: x - 14, top: y - 14,
                    fontSize: 28, selectable: true, hasControls: true,
                    fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif'
                });
            } else if (t === 'zone-solid') {
                obj = new fabric.Rect({
                    left: x - 50, top: y - 35, width: 100, height: 70,
                    fill: 'rgba(0,240,255,0.08)', stroke: '#ffffff',
                    strokeWidth: 2, selectable: true, hasControls: true,
                    rx: 4, ry: 4
                });
            } else if (t === 'zone-dashed') {
                obj = new fabric.Rect({
                    left: x - 50, top: y - 35, width: 100, height: 70,
                    fill: 'rgba(255,200,0,0.07)', stroke: '#fbbf24',
                    strokeWidth: 2, strokeDashArray: [8, 5],
                    selectable: true, hasControls: true, rx: 4, ry: 4
                });
            }

            if (obj) {
                this._fc.add(obj);
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

        // ── Limpiar todo ──
        clear() {
            if (!this._fc) return;
            this._fc.clear();
            // Restaurar background null (transparente)
            this._fc.backgroundColor = null;
            this._fc.renderAll();
        },

        // ── Exportar PNG compuesto (campo SVG + objetos Fabric) ──
        toDataURL() {
            if (!this._fc) return null;

            const w = this._fc.getWidth();
            const h = this._fc.getHeight();

            // 1. Renderizar el SVG del campo en un canvas offscreen
            const offscreen = document.createElement('canvas');
            offscreen.width  = w;
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
            octx.beginPath(); octx.moveTo(52.5*sx, 0); octx.lineTo(52.5*sx, h); octx.stroke();
            // Círculo central
            octx.beginPath(); octx.arc(52.5*sx, 34*sy, 9.15*sx, 0, Math.PI*2); octx.stroke();
            // Punto central
            octx.fillStyle = 'rgba(255,255,255,0.5)';
            octx.beginPath(); octx.arc(52.5*sx, 34*sy, 2, 0, Math.PI*2); octx.fill();
            // Áreas
            octx.strokeStyle = 'rgba(255,255,255,0.3)';
            octx.strokeRect(0, 13.84*sy, 16.5*sx, 40.32*sy);
            octx.strokeRect(0, 26.84*sy, 5.5*sx,  14.32*sy);
            octx.strokeRect(88.5*sx, 13.84*sy, 16.5*sx, 40.32*sy);
            octx.strokeRect(99.5*sx, 26.84*sy, 5.5*sx,  14.32*sy);
            // Puntos penales
            ['rgba(255,255,255,0.5)'].forEach(c => { octx.fillStyle = c;
                octx.beginPath(); octx.arc(11*sx, 34*sy, 2, 0, Math.PI*2); octx.fill();
                octx.beginPath(); octx.arc(94*sx, 34*sy, 2, 0, Math.PI*2); octx.fill();
            });
            // Arcos
            octx.beginPath(); octx.arc(16.5*sx, 34*sy, 9.15*sx, -Math.PI/3, Math.PI/3); octx.stroke();
            octx.beginPath(); octx.arc(88.5*sx, 34*sy, 9.15*sx, Math.PI*2/3, Math.PI*4/3); octx.stroke();

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

    // --- BÓVEDA DE TAREAS PERSONALIZADAS ---
    openCustomTaskModal() {
        // Limpiar todos los campos del formulario
        ['ct-title','ct-description','ct-dimensions','ct-materials',
         'ct-rule-provocation','ct-rule-propension','ct-rule-continuity',
         'ct-density','ct-min-players','ct-max-players'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const conesChk = document.getElementById('ct-cones-goals');
        if (conesChk) conesChk.checked = false;
        const morphSel = document.getElementById('ct-morfociclo');
        if (morphSel) morphSel.value = '';
        const sspSel = document.getElementById('ct-ssp-type');
        if (sspSel) sspSel.value = '';
        const momentSel = document.getElementById('ct-game-moment');
        if (momentSel) momentSel.value = '';
        // Deseleccionar pitch_suitability
        const pitchSel = document.getElementById('ct-pitch-suitability');
        if (pitchSel) Array.from(pitchSel.options).forEach(o => o.selected = false);

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
        const title = (document.getElementById('ct-title')?.value || '').trim();
        if (!title) return alert('Por favor, ingresa un título para la tarea.');

        const description      = (document.getElementById('ct-description')?.value || '').trim() || null;
        const morfociclo_phase = (document.getElementById('ct-morfociclo')?.value || '').trim()  || null;
        const ssp_type         = (document.getElementById('ct-ssp-type')?.value || '').trim()    || null;
        const game_moment      = (document.getElementById('ct-game-moment')?.value || '').trim() || null;
        const dimensions       = (document.getElementById('ct-dimensions')?.value || '').trim()  || null;

        // Concatenar Min, Max y Densidad en un solo string
        const _minRaw = document.getElementById('ct-min-players')?.value;
        const _maxRaw = document.getElementById('ct-max-players')?.value;
        const _denRaw = document.getElementById('ct-density')?.value;
        const dimensions_density = `Min: ${_minRaw || '-'} | Max: ${_maxRaw || '-'} | Dens: ${_denRaw || '-'}`;

        // Arrays JSONB — separados por coma desde el DOM
        const _matRaw = document.getElementById('ct-materials')?.value || '';
        const materials = _matRaw
            ? _matRaw.split(',').map(m => m.trim()).filter(Boolean)
            : [];

        // Reglas tácticas
        const rule_provocation = (document.getElementById('ct-rule-provocation')?.value || '').trim() || null;
        const rule_propension  = (document.getElementById('ct-rule-propension')?.value  || '').trim() || null;
        const rule_continuity  = (document.getElementById('ct-rule-continuity')?.value  || '').trim() || null;

        // ════════════════════════════════════════════════════
        // 2. EXPORTAR DIAGRAMA TÁCTICO → tactical_diagram_url
        // ════════════════════════════════════════════════════
        let tactical_diagram_url = null;
        try {
            if (this.FabricEngine._fc) {
                tactical_diagram_url = this.FabricEngine._fc.toDataURL({ format: 'png', multiplier: 1 });
            }
        } catch(e) {
        }

        // ─── 3. Deshabilitar botón durante guardado ───
        const btn = document.getElementById('ct-save-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

        try {
            // ════════════════════════════════════════════════════
            // 3. INSERT → custom_exercises
            // ════════════════════════════════════════════════════
            const payload = {
                user_id: uid,
                title,
                description,
                morfociclo_phase,
                ssp_type,
                game_moment,
                dimensions,
                materials,
                rule_provocation,
                rule_propension,
                rule_continuity,
                tactical_diagram_url,
                dimensions_density
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
        const bg     = type === 'success' ? 'linear-gradient(135deg,rgba(0,240,255,0.12),rgba(0,136,204,0.18))' : 'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(220,38,38,0.18))';
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
        addPlayerBlue: function () {
            if (!window.tacticalCanvas) return;
            const circle = new fabric.Circle({
                radius: 15,
                fill: '#0088ff',
                stroke: '#ffffff',
                strokeWidth: 2,
                top: 100,
                left: 100,
                hasControls: false,
                hasBorders: true
            });
            window.tacticalCanvas.add(circle);
            window.tacticalCanvas.setActiveObject(circle);
        },
        addPlayerRed: function () {
            if (!window.tacticalCanvas) return;
            const circle = new fabric.Circle({
                radius: 15,
                fill: '#ff4444',
                stroke: '#ffffff',
                strokeWidth: 2,
                top: 100,
                left: 150,
                hasControls: false,
                hasBorders: true
            });
            window.tacticalCanvas.add(circle);
            window.tacticalCanvas.setActiveObject(circle);
        },
        addBall: function () {
            if (!window.tacticalCanvas) return;
            const circle = new fabric.Circle({
                radius: 8,
                fill: '#ffffff',
                stroke: '#000000',
                strokeWidth: 2,
                top: 100,
                left: 200,
                hasControls: false,
                hasBorders: true
            });
            window.tacticalCanvas.add(circle);
            window.tacticalCanvas.setActiveObject(circle);
        },
        deleteActive: function () {
            if (!window.tacticalCanvas) return;
            const activeObj = window.tacticalCanvas.getActiveObject();
            if (activeObj) {
                window.tacticalCanvas.remove(activeObj);
            }
        },

        init: function () {
            const layer = document.getElementById('tokens-layer');
            if (!layer) return;
            const loc = document.getElementById('slocal') ? document.getElementById('slocal').value : '4-3-3';
            const riv = document.getElementById('srival') ? document.getElementById('srival').value : '4-4-2';
            this.deployTeams(loc, riv);
        },

        deployTeams: function (loc, riv) {
            if (!loc) loc = '4-3-3';
            if (!riv) riv = '4-4-2';
            const layer = document.getElementById('tokens-layer');
            if (!layer) return;
            layer.innerHTML = '';

            const forms = {
                '4-3-3': [
                    { p: 'POR', r: 'Portero', x: 0.07, y: 0.50 },
                    { p: 'LD', r: 'Lat. Der.', x: 0.22, y: 0.18 },
                    { p: 'DFC', r: 'Zaguero', x: 0.20, y: 0.38 },
                    { p: 'DFC', r: 'Zaguero', x: 0.20, y: 0.62 },
                    { p: 'LI', r: 'Lat. Izq.', x: 0.22, y: 0.82 },
                    { p: 'MCD', r: 'Pivote', x: 0.38, y: 0.50 },
                    { p: 'MC', r: 'Interior', x: 0.46, y: 0.30 },
                    { p: 'MC', r: 'Interior', x: 0.46, y: 0.70 },
                    { p: 'ED', r: 'Extremo', x: 0.58, y: 0.18 },
                    { p: 'DC', r: 'Delantero', x: 0.60, y: 0.50 },
                    { p: 'EI', r: 'Extremo', x: 0.58, y: 0.82 }
                ],
                '4-4-2': [
                    { p: 'POR', r: 'Portero', x: 0.07, y: 0.50 },
                    { p: 'LD', r: 'Lat. Der.', x: 0.22, y: 0.18 },
                    { p: 'DFC', r: 'Zaguero', x: 0.20, y: 0.38 },
                    { p: 'DFC', r: 'Zaguero', x: 0.20, y: 0.62 },
                    { p: 'LI', r: 'Lat. Izq.', x: 0.22, y: 0.82 },
                    { p: 'MD', r: 'Volante', x: 0.42, y: 0.18 },
                    { p: 'MC', r: 'Medio', x: 0.40, y: 0.38 },
                    { p: 'MC', r: 'Medio', x: 0.40, y: 0.62 },
                    { p: 'MI', r: 'Volante', x: 0.42, y: 0.82 },
                    { p: 'DC', r: 'Delantero', x: 0.58, y: 0.38 },
                    { p: 'DC', r: 'Delantero', x: 0.58, y: 0.62 }
                ],
                '4-2-3-1': [
                    { p: 'POR', r: 'Portero', x: 0.07, y: 0.50 },
                    { p: 'LD', r: 'Lat. Der.', x: 0.22, y: 0.18 },
                    { p: 'DFC', r: 'Zaguero', x: 0.20, y: 0.38 },
                    { p: 'DFC', r: 'Zaguero', x: 0.20, y: 0.62 },
                    { p: 'LI', r: 'Lat. Izq.', x: 0.22, y: 0.82 },
                    { p: 'MCD', r: 'Pivote', x: 0.36, y: 0.38 },
                    { p: 'MCD', r: 'Pivote', x: 0.36, y: 0.62 },
                    { p: 'ED', r: 'Ext. Der.', x: 0.50, y: 0.20 },
                    { p: 'MCO', r: 'Enganche', x: 0.50, y: 0.50 },
                    { p: 'EI', r: 'Ext. Izq.', x: 0.50, y: 0.80 },
                    { p: 'DC', r: 'Delantero', x: 0.62, y: 0.50 }
                ],
                '3-5-2': [
                    { p: 'POR', r: 'Portero', x: 0.07, y: 0.50 },
                    { p: 'DFC', r: 'Zaguero', x: 0.20, y: 0.28 },
                    { p: 'DFC', r: 'Zaguero', x: 0.20, y: 0.50 },
                    { p: 'DFC', r: 'Zaguero', x: 0.20, y: 0.72 },
                    { p: 'CRL', r: 'Carrilero', x: 0.36, y: 0.12 },
                    { p: 'MC', r: 'Medio', x: 0.38, y: 0.35 },
                    { p: 'MC', r: 'Medio', x: 0.38, y: 0.50 },
                    { p: 'MC', r: 'Medio', x: 0.38, y: 0.65 },
                    { p: 'CRL', r: 'Carrilero', x: 0.36, y: 0.88 },
                    { p: 'DC', r: 'Delantero', x: 0.58, y: 0.38 },
                    { p: 'DC', r: 'Delantero', x: 0.58, y: 0.62 }
                ]
            };

            const fLocal = forms[loc] || forms['4-3-3'];
            const fRival = forms[riv] || forms['4-4-2'];
            fLocal.forEach(function (t) { window.DTEngine.Board.createFicha('local', t.p, t.r, t.x, t.y); });
            fRival.forEach(function (t) { window.DTEngine.Board.createFicha('rival', t.p, t.r, 1 - t.x, 1 - t.y); });
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
            ficha.style.zIndex = '10';
            ficha.style.pointerEvents = 'auto';
            ficha.style.transition = 'transform 0.12s ease, filter 0.12s ease';

            var label = document.createElement('div');
            label.style.cssText = 'background:' + colorBg + '; border:1px solid ' + colorMain + '; color:' + colorMain + '; font-size:0.52rem; padding:2px 7px; border-radius:4px; font-weight:800; font-family:Outfit,sans-serif; margin-bottom:4px; pointer-events:none; white-space:nowrap; letter-spacing:0.5px;';
            label.textContent = roleText;

            var circle = document.createElement('div');
            circle.style.cssText = 'width:38px; height:38px; background:' + colorMain + '; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.72rem; font-weight:900; color:' + textColor + '; box-shadow: 0 0 12px ' + colorShadow + ', 0 4px 10px rgba(0,0,0,0.6); pointer-events:none; font-family:Outfit,sans-serif; letter-spacing:-0.5px;';
            circle.textContent = posText;

            ficha.appendChild(label);
            ficha.appendChild(circle);

            var isDragging = false;

            ficha.addEventListener('pointerdown', function (e) {
                isDragging = true;
                ficha.style.cursor = 'grabbing';
                ficha.style.zIndex = '100';
                ficha.style.transform = 'translate(-50%, -50%) scale(1.18)';
                ficha.style.filter = 'drop-shadow(0 0 8px ' + colorMain + ')';
                ficha.setPointerCapture(e.pointerId);
            });

            ficha.addEventListener('pointermove', function (e) {
                if (!isDragging) return;
                var rect = layer.getBoundingClientRect();
                var nx = ((e.clientX - rect.left) / rect.width) * 100;
                var ny = ((e.clientY - rect.top) / rect.height) * 100;
                ficha.style.left = nx.toFixed(2) + '%';
                ficha.style.top = ny.toFixed(2) + '%';
            });

            ficha.addEventListener('pointerup', function (e) {
                isDragging = false;
                ficha.style.cursor = 'grab';
                ficha.style.zIndex = '10';
                ficha.style.transform = 'translate(-50%, -50%) scale(1)';
                ficha.style.filter = 'none';
                ficha.releasePointerCapture(e.pointerId);
            });

            layer.appendChild(ficha);
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

