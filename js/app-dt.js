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
    _addTag: function(containerId, text) {
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
    _getTags: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return [];
        return Array.from(container.querySelectorAll('.ravix-tag-text')).map(el => el.textContent.trim()).filter(Boolean);
    },

    // --- Internal: Clear and repopulate a tag container from array ---
    _renderTags: function(containerId, tagsArray) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        (tagsArray || []).forEach(tag => this._addTag(containerId, tag));
    },

    // --- Internal: Handle tag input keydown/selection ---
    _handleTagInput: function(inputId, containerId) {
        const input = document.getElementById(inputId);
        if (!input) return;
        const val = input.value.trim();
        if (!val) return;
        this._addTag(containerId, val);
        input.value = '';
        input.focus();
    },

    open: function() {
        const per = window.DTEngine._periodization;
        if (!per) return;

        const inp = (id) => document.getElementById(id);
        if (inp('spm-temporada')) inp('spm-temporada').value = per.macrociclo || '';

        const keys   = ['pre','comp','playoffs','trans'];
        per.fases.forEach(function(fase, i) {
            const key = keys[i];
            if (!key) return;
            if (inp('spm-' + key + '-start')) inp('spm-' + key + '-start').value = fase.start || '';
            if (inp('spm-' + key + '-end'))   inp('spm-' + key + '-end').value   = fase.end   || '';
            // Render tag chips from stored array
            window.SeasonPlanningModal._renderTags('spm-' + key + '-tags', fase.objetivos || []);
        });

        const modal = document.getElementById('modal-season-planning');
        if (modal) {
            modal.classList.remove('hidden');
            requestAnimationFrame(() => modal.classList.add('spm-visible'));
        }
    },

    close: function() {
        const modal = document.getElementById('modal-season-planning');
        if (modal) {
            modal.classList.remove('spm-visible');
            setTimeout(() => modal.classList.add('hidden'), 250);
        }
    },

    save: async function() {
        const teamId = window.CurrentTeam?.id || localStorage.getItem('ravix_team_id');
        if (!teamId) { console.warn('SeasonPlanningModal.save: no teamId'); return; }

        const per = window.DTEngine._periodization;
        if (!per) return;

        const inp  = (id) => document.getElementById(id)?.value.trim();
        const keys = ['pre','comp','playoffs','trans'];

        // Mutate _periodization in place
        per.macrociclo = inp('spm-temporada') || per.macrociclo;
        keys.forEach((key, i) => {
            if (!per.fases[i]) return;
            per.fases[i].start     = inp('spm-' + key + '-start') || per.fases[i].start;
            per.fases[i].end       = inp('spm-' + key + '-end')   || per.fases[i].end;
            // Read objetivos from tag chips in DOM
            per.fases[i].objetivos = window.SeasonPlanningModal._getTags('spm-' + key + '-tags');
        });

        const payload = {
            macrociclo: per.macrociclo,
            fases: per.fases.map(f => ({
                name:      f.name,
                color:     f.color,
                start:     f.start,
                end:       f.end,
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

            const [ { data, error }, { data: customData, error: customErr } ] = await Promise.all([
                window.supabase.from('training_logs').select('*').eq('team_id', teamId).gte('fecha', startDate).lte('fecha', endDate),
                window.supabase.from('custom_exercises').select('*')
            ]);

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
                            logId:    log.id,
                            id:       isNaN(numericAttempt) ? rawId : numericAttempt,
                            rawId:    rawId,       // Guardar el original para matching por UUID
                            block:    log.scenario || log.block || 'parte_principal'
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
                    const mergedFases = sp.fases.map(function(f, i) {
                        const def = defaultPhases[i] || {};
                        return {
                            name:      f.name      || def.name,
                            color:     f.color     || def.color || '#00F2FE',
                            start:     f.start     || '',
                            end:       f.end       || '',
                            objetivos: Array.isArray(f.objetivos) ? f.objetivos : (def.objetivos || []),
                            completed: f.completed || false
                        };
                    });
                    window.DTEngine._periodization = {
                        macrociclo:      sp.macrociclo || ('Temporada ' + new Date().getFullYear()),
                        fases:           mergedFases,
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

                    <!-- SECCIÓN PERFIL DEL DT (#view-profile) -->
                    <section id="view-profile" class="view-section" style="display: none;">
                        <div class="profile-view-container">

                            <!-- BLOQUE 1: IDENTIDAD -->
                            <div class="profile-card">
                                <h3 class="profile-section-title">IDENTIDAD STAFF</h3>
                                <div class="profile-form-grid">
                                    <div class="profile-input-group">
                                        <label>NOMBRE COMPLETO</label>
                                        <input type="text" id="prof-name" class="profile-input" placeholder="Nombre del DT">
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
                                </div>

                                <h3 class="profile-section-title">CONFIGURACIÓN DEL CLUB</h3>
                                <div class="profile-form-grid">
                                    <div class="profile-input-group">
                                        <label>NOMBRE DEL EQUIPO</label>
                                        <input type="text" id="prof-team-name" class="profile-input" placeholder="Nombre del Club">
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

                            <!-- BLOQUE 2: ADN TÁCTICO -->
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
                                                <input
                                                    type="text"
                                                    id="tag-input"
                                                    class="tag-input-field"
                                                    list="tag-suggestions"
                                                    placeholder="Buscar o escribir un principio..."
                                                    autocomplete="off"
                                                    onkeydown="DTEngine.TagInput.onKeyDown(event)"
                                                >
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
                                            <input
                                                type="text"
                                                id="rules-tag-input"
                                                class="tag-input-field"
                                                list="rules-tag-suggestions"
                                                placeholder="Buscar o escribir una regla..."
                                                autocomplete="off"
                                                onkeydown="DTEngine.RulesTagInput.onKeyDown(event)"
                                            >
                                            <datalist id="rules-tag-suggestions"></datalist>
                                            <button type="button" class="tag-add-btn" onclick="DTEngine.RulesTagInput.addFromInput()">+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- BLOQUE 3: 11 IDEAL -->
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

                            <button class="btn-save-profile" onclick="DTEngine.saveProfile()" style="margin-top: 25px;">GUARDAR CONFIGURACIÓN COMPLETA</button>

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

                <!-- Drawer Lateral (Cajón Táctico) -->
                <div id="dt-drawer" class="drawer-overlay hidden">
                    <div class="drawer-content">
                        <div class="drawer-header">
                            <div class="title-group">
                                <h3 id="drawer-date-title">Detalle</h3>
                                <p id="drawer-methodology-label" class="methodology-badge"></p>
                            </div>
                            <button class="btn-close" onclick="DTEngine.closeDrawer()">✕</button>
                        </div>
                        <div class="drawer-controls">
                            <div class="control-row">
                                <label>Forzar Etiqueta:</label>
                                <select id="label-selector" onchange="DTEngine.stageLabel(this.value)">
                                    <option value="">(Automático)</option>
                                    <option value="PARTIDO">Añadir Partido (MD)</option>
                                    <option value="BASE">Quitar Partido</option>
                                </select>
                            </div>
                        </div>
                        <div class="drawer-body">
                            <div class="library-header">
                                <h4>Biblioteca de Tareas</h4>
                            </div>
                            <button class="btn-add-custom-task" onclick="DTEngine.openCustomTaskModal()">+ CREAR TAREA</button>
                            <div id="library-list" class="exercise-list-container"></div>
                        </div>
                        <div class="drawer-footer-actions">
                            <button class="btn-save-staged" onclick="DTEngine.saveStagedTasks()">GUARDAR CAMBIOS</button>
                        </div>
                    </div>
                </div>

                <!-- Modal de Tarea Personalizada -->
                <div id="modal-custom-task" class="modal-overlay hidden" onclick="DTEngine.closeCustomTaskModal()">
                    <div class="custom-task-content" onclick="event.stopPropagation()" style="background:#111827;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:30px;width:100%;max-width:520px;color:#fff;position:relative;">
                        <div style="position:sticky; top:-30px; z-index:100; display:flex; justify-content:flex-end; margin-bottom:-30px; pointer-events:none;">
                            <button onclick="DTEngine.closeCustomTaskModal()" style="background:#1f2937;border:1px solid #374151;color:#fff;font-size:1.2rem;cursor:pointer;border-radius:50%;width:32px;height:32px;pointer-events:auto;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.5);">✕</button>
                        </div>
                        <p style="margin:0 0 2px 0;font-size:0.65rem;font-weight:800;color:#00F2FE;letter-spacing:2px;font-family:Outfit,sans-serif;">BÓVEDA PRIVADA</p>
                        <h2 style="margin:0 0 20px 0;color:var(--primary-color,#00F2FE);font-family:Outfit,sans-serif;font-size:1.4rem;">Nueva Tarea Táctica</h2>

                        <label style="font-size:0.7rem;color:#9ca3af;font-weight:bold;display:block;margin-bottom:5px;">NOMBRE DE LA TAREA</label>
                        <input type="text" id="custom-task-name" placeholder="Ej: Rondo de pressing específico" style="width:100%;padding:12px;margin-bottom:15px;background:#1f2937;border:1px solid #374151;border-radius:8px;color:#fff;outline:none;box-sizing:border-box;">

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
                            <div>
                                <label style="font-size:0.7rem;color:#9ca3af;font-weight:bold;display:block;margin-bottom:5px;">MOMENTO DEL JUEGO</label>
                                <select id="task-moment" style="width:100%;padding:12px;background:#1f2937;border:1px solid #374151;border-radius:8px;color:#fff;outline:none;">
                                    <option value="Ataque Organizado">Ataque Organizado</option>
                                    <option value="Defensa Organizada">Defensa Organizada</option>
                                    <option value="Transición O-D">Transición O-D</option>
                                    <option value="Transición D-O">Transición D-O</option>
                                    <option value="ABP">Pelota Parada (ABP)</option>
                                </select>
                            </div>
                            <div>
                                <label style="font-size:0.7rem;color:#9ca3af;font-weight:bold;display:block;margin-bottom:5px;">TIPO DE TAREA (SSP)</label>
                                <select id="task-ssp" style="width:100%;padding:12px;background:#1f2937;border:1px solid #374151;border-radius:8px;color:#fff;outline:none;">
                                    <option value="General">General</option>
                                    <option value="Dirigida">Dirigida</option>
                                    <option value="Especial">Especial</option>
                                    <option value="Competitiva">Competitiva</option>
                                </select>
                            </div>
                        </div>

                        <div style="background:rgba(0,242,254,0.05);border:1px solid rgba(0,242,254,0.2);border-radius:8px;padding:15px;margin-bottom:15px;">
                            <label style="font-size:0.75rem;color:#00F2FE;font-weight:bold;display:block;margin-bottom:10px;">⏱ DOSIFICACIÓN (VOLUMEN Y DENSIDAD)</label>
                            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                                <div>
                                    <label style="font-size:0.65rem;color:#9ca3af;display:block;margin-bottom:4px;">SERIES/BLOQUES</label>
                                    <input type="number" id="task-blocks" placeholder="Ej: 4" min="1" style="width:100%;padding:10px;background:#111827;border:1px solid #374151;border-radius:6px;color:#fff;outline:none;box-sizing:border-box;">
                                </div>
                                <div>
                                    <label style="font-size:0.65rem;color:#9ca3af;display:block;margin-bottom:4px;">T. TRABAJO (min)</label>
                                    <input type="number" id="task-work" placeholder="Ej: 5" min="1" style="width:100%;padding:10px;background:#111827;border:1px solid #374151;border-radius:6px;color:#fff;outline:none;box-sizing:border-box;">
                                </div>
                                <div>
                                    <label style="font-size:0.65rem;color:#9ca3af;display:block;margin-bottom:4px;">T. PAUSA (min)</label>
                                    <input type="number" id="task-pause" placeholder="Ej: 1" min="0" style="width:100%;padding:10px;background:#111827;border:1px solid #374151;border-radius:6px;color:#fff;outline:none;box-sizing:border-box;">
                                </div>
                            </div>
                        </div>



                        <label style="font-size:0.7rem;color:#9ca3af;font-weight:bold;display:block;margin-bottom:5px;">MATERIALES NECESARIOS</label>
                        <input type="text" id="task-materials" placeholder="Ej: 10 conos, 6 petos, balones" style="width:100%;padding:12px;margin-bottom:15px;background:#1f2937;border:1px solid #374151;border-radius:8px;color:#fff;outline:none;box-sizing:border-box;">

                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
                            <div>
                                <label style="font-size:0.7rem;color:#9ca3af;font-weight:bold;display:block;margin-bottom:5px;">S.S.P. (CONTEXTO DE JUEGO)</label>
                                <textarea id="ex-ssp" rows="2" placeholder="Ej: Ante ataque posicional del rival..." style="width:100%;padding:12px;background:#1f2937;border:1px solid rgba(0,242,254,0.4);border-radius:8px;color:#fff;outline:none;resize:none;box-sizing:border-box;"></textarea>
                            </div>
                            <div>
                                <label style="font-size:0.7rem;color:#9ca3af;font-weight:bold;display:block;margin-bottom:5px;">PRINCIPIOS TÁCTICOS</label>
                                <textarea id="ex-principles" rows="2" placeholder="Principal / De Base / Episódico" style="width:100%;padding:12px;background:#1f2937;border:1px solid rgba(0,242,254,0.4);border-radius:8px;color:#fff;outline:none;resize:none;box-sizing:border-box;"></textarea>
                            </div>
                        </div>

                        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:15px;margin-bottom:15px;">
                            <div>
                                <label style="font-size:0.7rem;color:#9ca3af;font-weight:bold;display:block;margin-bottom:5px;">REGLA DE PROVOCACIÓN</label>
                                <textarea id="ex-rule-provocation" rows="2" placeholder="Ej: Si filtran pase, suma 1 punto." style="width:100%;padding:12px;background:#1f2937;border:1px solid rgba(0,242,254,0.4);border-radius:8px;color:#fff;outline:none;resize:none;box-sizing:border-box;"></textarea>
                            </div>
                            <div>
                                <label style="font-size:0.7rem;color:#9ca3af;font-weight:bold;display:block;margin-bottom:5px;">REGLA DE PROPENSIÓN</label>
                                <textarea id="ex-rule-propension" rows="2" placeholder="Ej: Repliegue inmediato al área." style="width:100%;padding:12px;background:#1f2937;border:1px solid rgba(0,242,254,0.4);border-radius:8px;color:#fff;outline:none;resize:none;box-sizing:border-box;"></textarea>
                            </div>
                            <div>
                                <label style="font-size:0.7rem;color:#9ca3af;font-weight:bold;display:block;margin-bottom:5px;">REGLA DE CONTINUIDAD</label>
                                <textarea id="ex-rule-continuity" rows="2" placeholder="Ej: Inyección de balón del DT." style="width:100%;padding:12px;background:#1f2937;border:1px solid rgba(0,242,254,0.4);border-radius:8px;color:#fff;outline:none;resize:none;box-sizing:border-box;"></textarea>
                            </div>
                        </div>

                        <div style="margin-bottom:15px;">
                            <label style="font-size:0.7rem;color:#9ca3af;font-weight:bold;display:block;margin-bottom:5px;">DIMENSIONES Y ESTRUCTURAS</label>
                            <input type="text" id="ex-dimensions" placeholder="Medidas, m² por jugador y estructuras implicadas" style="width:100%;padding:12px;background:#1f2937;border:1px solid rgba(0,242,254,0.4);border-radius:8px;color:#fff;outline:none;box-sizing:border-box;">
                        </div>

                        <label style="font-size:0.7rem;color:#9ca3af;font-weight:bold;display:block;margin-bottom:5px;">TAGS TÁCTICOS</label>
                        <input type="text" id="exercise-tags" placeholder="Ej: pressing, posesion, amplitud (separados por coma)" style="width:100%;padding:12px;margin-bottom:20px;background:#1f2937;border:1px solid rgba(0,242,254,0.4);border-radius:8px;color:#00F2FE;font-weight:bold;outline:none;box-sizing:border-box;">

                        <!-- Pizarra Técnica (Pilar 4) -->
                        <div style="margin-bottom:20px;border:1px solid #374151;border-radius:12px;overflow:hidden;background:#111827;">
                            <div style="padding:10px;background:#1f2937;border-bottom:1px solid #374151;display:flex;justify-content:space-between;align-items:center;">
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <button type="button" id="btn-add-player-blue" style="padding: 6px 12px; border-radius: 4px; background: #0088ff; color: white; border: none; cursor: pointer; font-size: 0.8rem; font-family: Outfit;" onclick="window.DTEngine.Board.addPlayerBlue()">🔵 Jugador Base</button>
                                    <button type="button" id="btn-add-player-red" style="padding: 6px 12px; border-radius: 4px; background: #ff4444; color: white; border: none; cursor: pointer; font-size: 0.8rem; font-family: Outfit;" onclick="window.DTEngine.Board.addPlayerRed()">🔴 Jugador Rival</button>
                                    <button type="button" id="btn-add-ball" style="padding: 6px 12px; border-radius: 4px; background: #ffffff; color: #000; border: none; cursor: pointer; font-size: 0.8rem; font-family: Outfit;" onclick="window.DTEngine.Board.addBall()">⚽ Balón</button>
                                    <button type="button" id="btn-delete-obj" style="padding: 6px 12px; border-radius: 4px; background: transparent; color: #ef4444; border: 1px solid #ef4444; cursor: pointer; font-size: 0.8rem; font-family: Outfit;" onclick="window.DTEngine.Board.deleteActive()">🗑️ Borrar Seleccionado</button>
                                </div>
                                <button type="button" onclick="DTEngine.clearCanvas()" style="background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:1.1rem;" title="Limpiar Todo"><i class="fas fa-trash"></i></button>
                            </div>
                            <div style="position:relative;width:100%;height:350px;">
                                <canvas id="tactical-board" style="position:absolute;top:0;left:0;width:100%;height:100%;touch-action:none;background:linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), #1a2f24;background-size:20px 20px;cursor:crosshair;"></canvas>
                            </div>
                        </div>

                        <button onclick="DTEngine.saveCustomTask()" style="width:100%;padding:14px;background:var(--primary-color,#00F2FE);color:#000;border:none;border-radius:8px;font-weight:900;font-family:Outfit,sans-serif;font-size:1.05rem;cursor:pointer;letter-spacing:0.5px;">GUARDAR FICHA TÉCNICA</button>
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

            html += `
                <div class="macro-day ${typeClass ? typeClass : ''} ${pastClass}${hasTasks && isPast ? ' has-tasks' : ''}" data-date="${dateStr}" onclick="${isPast ? 'void(0)' : `DTEngine.openDrawer('${dateStr}')`}">
                    <div class="m-day-top">
                        <span class="m-day-num">${d}</span>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span class="m-day-label ${label === '' ? 'label-libre' : ''}">${label}</span>
                            ${sugBadge}
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

    openDrawer(date) {
        this._selectedDate = date;
        this._showAllExercises = false;
        document.getElementById('drawer-date-title').innerText = date;
        document.getElementById('label-selector').value = this._manualLabels[date] || '';
        this.updateDrawerUI();
        document.getElementById('dt-drawer').classList.remove('hidden');
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

            const teamId = window.CurrentTeam?.id;
            const userId = localStorage.getItem('ravix_v5_uid');
            const token = localStorage.getItem('ravix_token');

            if (!teamId || !userId || !token) {
                alert("Error: Sesión no identificada.");
                return;
            }

            console.log("🟡 Intentando borrar vía RPC:", task);

            const { error } = await window.supabase.rpc('borrar_tarea_calendario', {
                    p_user_id: userId,
                    p_team_id: teamId,
                    p_fecha: date,
                    p_scenario: task.block,
                    p_task_id: task.id.toString()
                });
                if (error) throw error;

            // Solo después de confirmar, refrescamos el estado global
            await this.refreshState();

        } catch (error) {
            console.error("🔴 Error crítico al borrar en RPC:", error);
            alert("Error al borrar: " + (error.message || error));
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
            setTimeout(function() { window.DTEngine.Periodization.init(); }, 50);
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

        // 1. Volumen
        this._charts.carga = new Chart(document.getElementById('canvas-carga-semanal'), {
            type: 'bar',
            data: {
                labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
                datasets: [{ label: 'Minutos', data: weeklyMinutes, backgroundColor: '#079FA0', borderRadius: 5 }]
            },
            options: chartOptions
        });

        // 2. sRPE (Línea)
        this._charts.srpe = new Chart(document.getElementById('canvas-srpe'), {
            type: 'line',
            data: {
                labels: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
                datasets: [{ label: 'sRPE (Intensidad x Duración)', data: weeklySRPE, borderColor: '#F58B01', tension: 0.4 }]
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

    loadProfile() {
        const userData = window.CurrentUser;
        const teamData = window.CurrentTeam;

        // Inicializar el componente Tag Input (datalist + render)
        this.TagInput.init();

        if (userData) {
            const nameEl = document.getElementById('prof-name');
            const licenseEl = document.getElementById('prof-license');
            if (nameEl) nameEl.value = userData.name || '';
            if (licenseEl) licenseEl.value = userData.license || 'UEFA PRO';
        }

        if (teamData) {
            const teamNameEl = document.getElementById('prof-team-name');
            const teamColorEl = document.getElementById('prof-team-color');
            const methodologyEl = document.getElementById('prof-methodology');
            if (teamNameEl) teamNameEl.value = teamData.name || '';
            if (teamColorEl) teamColorEl.value = teamData.primary_color || '#079FA0';
            if (methodologyEl) methodologyEl.value = teamData.methodology || 'Periodización Táctica';

            // Cargar ADN Táctico desde tactical_dna
            const dna = teamData.tactical_dna || {};
            const setVal = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
            setVal('dna-ataque', dna.ataque);
            DTEngine.TagInput.load(dna.principios || []);
            setVal('dna-defensa', dna.defensa);
            setVal('dna-bloque', dna.bloque);
            setVal('dna-trans-of', dna.trans_of);
            setVal('dna-trans-def', dna.trans_def);
            DTEngine.RulesTagInput.load(dna.reglas_provocacion || []);
            DTEngine.PitchEngine.load(dna.ideal_11 || {});
        }
    },

    async saveProfile() {
        const uid = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');

        const name = document.getElementById('prof-name').value;
        const license = document.getElementById('prof-license').value;
        const teamName = document.getElementById('prof-team-name').value;
        const color = document.getElementById('prof-team-color').value;
        const methodology = document.getElementById('prof-methodology').value;

        // Construir objeto ADN Táctico
        const tactical_dna = {
            ataque: document.getElementById('dna-ataque')?.value,
            principios: DTEngine.TagInput.getTags(),
            defensa: document.getElementById('dna-defensa')?.value,
            bloque: document.getElementById('dna-bloque')?.value,
            trans_of: document.getElementById('dna-trans-of')?.value,
            trans_def: document.getElementById('dna-trans-def')?.value,
            reglas_provocacion: DTEngine.RulesTagInput.getTags(),
            ideal_11: DTEngine.PitchEngine.getData(),
        };

        if (!name || !teamName) return alert('Nombre y Equipo son obligatorios.');

        try {
            console.log('💾 Guardando cambios en perfil, equipo y ADN táctico...');

            // 1. Actualizar Usuario
            const { error: uErr } = await window.supabase.from('users').update({ name, license }).eq('id', uid);
            const uRes = { ok: !uErr };

            // 2. Actualizar Equipo
            const teamId = window.CurrentTeam?.id;
            const { error: tErr } = await window.supabase.from('teams').update({ name: teamName }).eq('id', teamId);
            const tRes = { ok: !tErr };

            // 3. Actualizar Config Táctica (incluyendo tactical_dna)
            const { error: cErr } = await window.supabase.from('team_configs').update({ primary_color: color, methodology, tactical_dna }).eq('team_id', teamId);
            const cRes = { ok: !cErr };

            if (uRes.ok && tRes.ok && cRes.ok) {
                // Actualizar Memoria Global
                if (window.CurrentUser) { window.CurrentUser.name = name; window.CurrentUser.license = license; }
                if (window.CurrentTeam) {
                    window.CurrentTeam.name = teamName;
                    window.CurrentTeam.primary_color = color;
                    window.CurrentTeam.methodology = methodology;
                    window.CurrentTeam.tactical_dna = tactical_dna;
                }

                // Actualizar CSS
                document.documentElement.style.setProperty('--primary-color', color);
                document.documentElement.style.setProperty('--primary', color);

                alert('✅ Perfil, Club y ADN Táctico actualizados.');
                this.renderDashboard();
                this.toggleView('home');
            } else {
                throw new Error('Error al guardar en el servidor. Verifica tu conexión.');
            }
        } catch (err) {
            alert('🔴 ' + err.message);
        }
    },

    // --- CANVAS DIBUJO TÁCTICO (Fabric.js) ---
    initCanvas() {
        if (!window.tacticalCanvas) {
            window.tacticalCanvas = new fabric.Canvas('tactical-board', {
                selection: false // No permite seleccionar grupos por ahora
            });
        }
        
        const canvasEl = document.getElementById('tactical-board');
        const container = canvasEl ? canvasEl.parentElement : null;
        if (container && window.tacticalCanvas) {
            const rect = container.getBoundingClientRect();
            window.tacticalCanvas.setWidth(rect.width || 500);
            window.tacticalCanvas.setHeight(rect.height || 350);
            window.tacticalCanvas.calcOffset();
            window.tacticalCanvas.renderAll();
        }
    },

    clearCanvas() {
        if (window.tacticalCanvas) {
            window.tacticalCanvas.clear();
        }
    },

    // --- BÓVEDA DE TAREAS PERSONALIZADAS ---
    openCustomTaskModal() {
        document.getElementById('custom-task-name').value = '';
        document.getElementById('ex-ssp').value = '';
        document.getElementById('ex-principles').value = '';
        document.getElementById('ex-rule-provocation').value = '';
        document.getElementById('ex-rule-propension').value = '';
        document.getElementById('ex-rule-continuity').value = '';
        document.getElementById('ex-dimensions').value = '';
        document.getElementById('exercise-tags').value = '';
        const tb = document.getElementById('task-blocks'); if (tb) tb.value = '';
        const tw = document.getElementById('task-work');   if (tw) tw.value = '';
        const tp = document.getElementById('task-pause');  if (tp) tp.value = '';
        const tm = document.getElementById('task-materials'); if (tm) tm.value = '';
        
        // 1. Mostrar el modal primero para que los contenedores tengan dimensiones reales en el DOM
        document.getElementById('modal-custom-task').classList.remove('hidden');

        // 2. Inicializar la pizarra un instante después para asegurar que el BoundingClientRect sea correcto
        setTimeout(() => {
            this.initCanvas();
            this.clearCanvas();
        }, 100);
    },

    closeCustomTaskModal() {
        document.getElementById('modal-custom-task').classList.add('hidden');
    },

    async saveCustomTask() {
        const uid   = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        const name  = document.getElementById('custom-task-name').value.trim();
        const phase = ''; // Universal (Desacoplado)
        const sspContext = document.getElementById('ex-ssp').value.trim();
        const tacticalPrinciples = document.getElementById('ex-principles').value.trim();
        const ruleProvocation = document.getElementById('ex-rule-provocation').value.trim();
        const rulePropension = document.getElementById('ex-rule-propension').value.trim();
        const ruleContinuity = document.getElementById('ex-rule-continuity').value.trim();
        const dimensionsDensity = document.getElementById('ex-dimensions').value.trim();
        const tagsRaw = document.getElementById('exercise-tags').value;
        const tags = tagsRaw.split(',').map(t => t.trim()).filter(t => t !== '');
        
        const moment   = document.getElementById('task-moment')    ? document.getElementById('task-moment').value    : '';
        const ssp      = document.getElementById('task-ssp')       ? document.getElementById('task-ssp').value       : '';
        const blocks   = document.getElementById('task-blocks')    ? parseInt(document.getElementById('task-blocks').value)  || null : null;
        const workTime = document.getElementById('task-work')      ? parseInt(document.getElementById('task-work').value)    || null : null;
        const pauseTime= document.getElementById('task-pause')     ? parseInt(document.getElementById('task-pause').value)   || null : null;
        const materials= document.getElementById('task-materials') ? document.getElementById('task-materials').value.trim()          : '';

        if (!name) {
            return alert('Por favor, ingresa al menos un título para la tarea.');
        }

        const totalMinutes = (blocks && workTime) ? blocks * workTime : null;
        
        // Capturar Pizarra
        let diagramDataUrl = null;
        if (window.tacticalCanvas) {
            diagramDataUrl = window.tacticalCanvas.toDataURL({
                format: 'png',
                quality: 1
            });
        }

        try {
            console.log('💾 Guardando ficha técnica en bóveda...');
            const { data, error } = await window.supabase.from('custom_exercises').insert({
                user_id: uid,
                title: name,
                morfociclo_phase: phase,
                ssp_context: sspContext,
                tactical_principles: tacticalPrinciples,
                rule_provocation: ruleProvocation,
                rule_propension: rulePropension,
                rule_continuity: ruleContinuity,
                dimensions: dimensionsDensity,
                tactical_diagram_url: diagramDataUrl,
                tags: tags,
                description: sspContext, // Fallback legacy
                game_moment: moment,
                ssp_type: ssp,
                series: blocks,
                duration: totalMinutes,
                work_time: workTime,
                pause_time: pauseTime,
                materials: materials
            }).select();

            if (error) throw new Error('Error al guardar en Supabase: ' + error.message);
            const newTask = data[0];

            if (!window.CustomExercises) window.CustomExercises = [];
            window.CustomExercises.unshift({
                ...newTask,
                numericId: newTask.id,
                isCustom: true
            });

            this.closeCustomTaskModal();
            const etiquetaReal = this.calcularEtiquetaMD(this._selectedDate, Array.from(this._matchDays));
            this.renderLibrary(etiquetaReal);
            console.log('✅ Tarea personalizada guardada y priorizada en biblioteca.');
        } catch (err) {
            alert('🔴 Error: ' + err.message);
        }
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
        addPlayerBlue: function() {
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
        addPlayerRed: function() {
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
        addBall: function() {
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
        deleteActive: function() {
            if (!window.tacticalCanvas) return;
            const activeObj = window.tacticalCanvas.getActiveObject();
            if (activeObj) {
                window.tacticalCanvas.remove(activeObj);
            }
        },

        init: function() {
            const layer = document.getElementById('tokens-layer');
            if (!layer) return;
            const loc = document.getElementById('slocal') ? document.getElementById('slocal').value : '4-3-3';
            const riv = document.getElementById('srival') ? document.getElementById('srival').value : '4-4-2';
            this.deployTeams(loc, riv);
        },

        deployTeams: function(loc, riv) {
            if (!loc) loc = '4-3-3';
            if (!riv) riv = '4-4-2';
            const layer = document.getElementById('tokens-layer');
            if (!layer) return;
            layer.innerHTML = '';

            const forms = {
                '4-3-3': [
                    {p:'POR', r:'Portero',   x:0.07, y:0.50},
                    {p:'LD',  r:'Lat. Der.', x:0.22, y:0.18},
                    {p:'DFC', r:'Zaguero',   x:0.20, y:0.38},
                    {p:'DFC', r:'Zaguero',   x:0.20, y:0.62},
                    {p:'LI',  r:'Lat. Izq.', x:0.22, y:0.82},
                    {p:'MCD', r:'Pivote',    x:0.38, y:0.50},
                    {p:'MC',  r:'Interior',  x:0.46, y:0.30},
                    {p:'MC',  r:'Interior',  x:0.46, y:0.70},
                    {p:'ED',  r:'Extremo',   x:0.58, y:0.18},
                    {p:'DC',  r:'Delantero', x:0.60, y:0.50},
                    {p:'EI',  r:'Extremo',   x:0.58, y:0.82}
                ],
                '4-4-2': [
                    {p:'POR', r:'Portero',   x:0.07, y:0.50},
                    {p:'LD',  r:'Lat. Der.', x:0.22, y:0.18},
                    {p:'DFC', r:'Zaguero',   x:0.20, y:0.38},
                    {p:'DFC', r:'Zaguero',   x:0.20, y:0.62},
                    {p:'LI',  r:'Lat. Izq.', x:0.22, y:0.82},
                    {p:'MD',  r:'Volante',   x:0.42, y:0.18},
                    {p:'MC',  r:'Medio',     x:0.40, y:0.38},
                    {p:'MC',  r:'Medio',     x:0.40, y:0.62},
                    {p:'MI',  r:'Volante',   x:0.42, y:0.82},
                    {p:'DC',  r:'Delantero', x:0.58, y:0.38},
                    {p:'DC',  r:'Delantero', x:0.58, y:0.62}
                ],
                '4-2-3-1': [
                    {p:'POR', r:'Portero',   x:0.07, y:0.50},
                    {p:'LD',  r:'Lat. Der.', x:0.22, y:0.18},
                    {p:'DFC', r:'Zaguero',   x:0.20, y:0.38},
                    {p:'DFC', r:'Zaguero',   x:0.20, y:0.62},
                    {p:'LI',  r:'Lat. Izq.', x:0.22, y:0.82},
                    {p:'MCD', r:'Pivote',    x:0.36, y:0.38},
                    {p:'MCD', r:'Pivote',    x:0.36, y:0.62},
                    {p:'ED',  r:'Ext. Der.', x:0.50, y:0.20},
                    {p:'MCO', r:'Enganche',  x:0.50, y:0.50},
                    {p:'EI',  r:'Ext. Izq.', x:0.50, y:0.80},
                    {p:'DC',  r:'Delantero', x:0.62, y:0.50}
                ],
                '3-5-2': [
                    {p:'POR', r:'Portero',   x:0.07, y:0.50},
                    {p:'DFC', r:'Zaguero',   x:0.20, y:0.28},
                    {p:'DFC', r:'Zaguero',   x:0.20, y:0.50},
                    {p:'DFC', r:'Zaguero',   x:0.20, y:0.72},
                    {p:'CRL', r:'Carrilero', x:0.36, y:0.12},
                    {p:'MC',  r:'Medio',     x:0.38, y:0.35},
                    {p:'MC',  r:'Medio',     x:0.38, y:0.50},
                    {p:'MC',  r:'Medio',     x:0.38, y:0.65},
                    {p:'CRL', r:'Carrilero', x:0.36, y:0.88},
                    {p:'DC',  r:'Delantero', x:0.58, y:0.38},
                    {p:'DC',  r:'Delantero', x:0.58, y:0.62}
                ]
            };

            const fLocal = forms[loc] || forms['4-3-3'];
            const fRival = forms[riv] || forms['4-4-2'];
            fLocal.forEach(function(t) { window.DTEngine.Board.createFicha('local', t.p, t.r, t.x, t.y); });
            fRival.forEach(function(t) { window.DTEngine.Board.createFicha('rival', t.p, t.r, 1 - t.x, 1 - t.y); });
        },

        createFicha: function(type, posText, roleText, percentX, percentY) {
            const layer = document.getElementById('tokens-layer');
            if (!layer) return;
            const isLocal = type === 'local';
            const colorMain  = isLocal ? '#00F2FE' : '#ff4d4d';
            const colorBg    = isLocal ? 'rgba(0,242,254,0.15)' : 'rgba(255,77,77,0.15)';
            const colorShadow= isLocal ? 'rgba(0,242,254,0.4)'  : 'rgba(255,77,77,0.4)';
            const textColor  = isLocal ? '#001a1f' : '#fff';

            var lx = (percentX * 100).toFixed(2);
            var ly = (percentY * 100).toFixed(2);

            var ficha = document.createElement('div');
            ficha.style.position   = 'absolute';
            ficha.style.left       = lx + '%';
            ficha.style.top        = ly + '%';
            ficha.style.transform  = 'translate(-50%, -50%)';
            ficha.style.display    = 'flex';
            ficha.style.flexDirection = 'column';
            ficha.style.alignItems = 'center';
            ficha.style.cursor     = 'grab';
            ficha.style.userSelect = 'none';
            ficha.style.zIndex     = '10';
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

            ficha.addEventListener('pointerdown', function(e) {
                isDragging = true;
                ficha.style.cursor = 'grabbing';
                ficha.style.zIndex = '100';
                ficha.style.transform = 'translate(-50%, -50%) scale(1.18)';
                ficha.style.filter = 'drop-shadow(0 0 8px ' + colorMain + ')';
                ficha.setPointerCapture(e.pointerId);
            });

            ficha.addEventListener('pointermove', function(e) {
                if (!isDragging) return;
                var rect = layer.getBoundingClientRect();
                var nx = ((e.clientX - rect.left) / rect.width)  * 100;
                var ny = ((e.clientY - rect.top)  / rect.height) * 100;
                ficha.style.left = nx.toFixed(2) + '%';
                ficha.style.top  = ny.toFixed(2) + '%';
            });

            ficha.addEventListener('pointerup', function(e) {
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
            { name: 'Pretemporada',  color: '#f59e0b', objetivos: ['Volumen aeróbico', 'Fuerza base', 'Cohesión táctica inicial'] },
            { name: 'Competencia',   color: '#00F2FE', objetivos: ['Afinación táctica', 'Intensidad específica', 'Automatismos'] },
            { name: 'Play-offs',     color: '#a855f7', objetivos: ['Pico de rendimiento', 'Gestión de carga', 'Estrategia rival'] },
            { name: 'Transición',    color: '#6b7280', objetivos: ['Recuperación activa', 'Evaluación de temporada', 'Planificación'] }
        ],

        init: function() {
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

        _buildDefault: function() {
            var year = new Date().getFullYear();
            var phases = this._defaultPhases.map(function(p, i) {
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

        _getCurrentPhaseIdx: function() {
            var per = window.DTEngine._periodization;
            if (!per || !per.fases) return 0;
            var today = new Date().toISOString().split('T')[0];
            for (var i = 0; i < per.fases.length; i++) {
                if (today >= per.fases[i].start && today <= per.fases[i].end) return i;
            }
            return per.fase_actual_idx || 0;
        },

        renderTimeline: function() {
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
            per.fases.forEach(function(f) {
                var s = new Date(f.start + 'T00:00:00');
                var e = new Date(f.end + 'T00:00:00');
                var d = Math.max(1, Math.round((e - s) / 86400000));
                phaseDays.push(d);
                totalDays += d;
            });

            var html = '';
            var legendHtml = '';
            per.fases.forEach(function(f, i) {
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
                var phaseEnd   = new Date(currentFase.end   ? currentFase.end   + 'T00:00:00' : today2);
                var phaseLen   = Math.max(1, phaseEnd - phaseStart);
                var elapsed    = Math.max(0, Math.min(phaseLen, today2 - phaseStart));
                var phasePct   = Math.round((elapsed / phaseLen) * 100);
                var weeksLeft  = Math.max(0, Math.round((phaseEnd - today2) / (7 * 86400000)));
                var phaseColor = currentFase.color || '#00F2FE';

                // Format date helper
                var fmtDate = function(d) {
                    if (!d) return '—';
                    var parts = d.split('-');
                    if (parts.length < 3) return d;
                    var months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                    return parts[2] + ' ' + months[parseInt(parts[1]) - 1];
                };

                // Build objectives HTML
                var objsHtml = '';
                (currentFase.objetivos || []).slice(0, 3).forEach(function(obj) {
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

        renderProcessView: function() {
            var per = window.DTEngine._periodization;
            var grid = document.getElementById('process-phases-grid');
            if (!per || !grid) return;

            var currentIdx = this._getCurrentPhaseIdx();
            var tasks = window.DTEngine._assignedTasks || {};
            var totalSessionsGlobal = 0;
            Object.keys(tasks).forEach(function(k) { totalSessionsGlobal += tasks[k].length; });

            var html = '';
            per.fases.forEach(function(fase, i) {
                var isPast = i < currentIdx;
                var isCurrent = i === currentIdx;
                var statusText = isPast ? 'COMPLETADA' : (isCurrent ? 'EN CURSO' : 'PENDIENTE');
                var statusColor = isPast ? '#10b981' : (isCurrent ? '#00F2FE' : '#374151');
                var borderColor = isCurrent ? fase.color : 'rgba(255,255,255,0.05)';

                var sessionsInPhase = 0;
                Object.keys(tasks).forEach(function(dateStr) {
                    if (dateStr >= fase.start && dateStr <= fase.end) {
                        sessionsInPhase += tasks[dateStr].length;
                    }
                });

                var objHtml = '';
                fase.objetivos.forEach(function(obj, oi) {
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

        setView: function(viewName) {
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

        save: function() {
            var per = window.DTEngine._periodization;
            if (!per) return;

            var teamId = window.CurrentTeam ? window.CurrentTeam.id : null;
            var token = localStorage.getItem('ravix_token');
            if (!teamId || !token) {
                console.warn('Periodization.save: No team or token');
                return;
            }

            window.supabase.from('team_configs').update({ periodization: per }).eq('team_id', teamId)
            .then(function({ error }) {
                if (!error) {
                    console.log('✅ Periodización guardada en Supabase.');
                    if (window.CurrentTeam) window.CurrentTeam.periodization = per;
                } else {
                    console.error('🔴 Error al guardar periodización:', error.message);
                }
            }).catch(function(err) {
                console.error('🔴 Error de red al guardar periodización:', err);
            });
        },

        updatePhase: function(idx, field, value) {
            var per = window.DTEngine._periodization;
            if (!per || !per.fases[idx]) return;
            per.fases[idx][field] = value;
            this.renderTimeline();
            this.renderProcessView();
            this.save();
        },

        setMacroName: function(name) {
            var per = window.DTEngine._periodization;
            if (!per) return;
            per.macrociclo = name;
            this.renderTimeline();
            this.save();
        }
    }

};

