'use strict';

/* ============================================================
   RAVIX V5 — DT ENGINE (app-dt.js)
   Phase 3.8: Navegación Anual & Bloques Ocultos (Completo)
   ============================================================ */

window.DTEngine = {
    _currentDate: new Date(), // Inicialización dinámica
    _matchDays: new Set(),
    _manualLabels: {},   // { "YYYY-MM-DD": "MD-4" }
    _assignedTasks: {},  // { "YYYY-MM-DD": [ { logId, id, block } ] }
    _exercises: [],
    _selectedDate: null,
    _showAllExercises: false,
    _charts: {}, // Almacén para instancias de Chart.js

    async fetchMonthLogs() {
        const year = this._currentDate.getFullYear();
        const monthNum = this._currentDate.getMonth() + 1;
        const monthStr = String(monthNum).padStart(2, '0');
        const lastDay = new Date(year, monthNum, 0).getDate();
        const lastDayStr = String(lastDay).padStart(2, '0');

        const teamId = window.CurrentTeam?.id;
        const token = localStorage.getItem('ravix_token');
        if (!teamId || !token) return;

        // Recuperar Configuración del Morfociclo (Match Days)
        await this.fetchTeamConfig();

        try {
            const path = `training_logs?team_id=eq.${teamId}&fecha=gte.${year}-${monthStr}-01&fecha=lte.${year}-${monthStr}-${lastDayStr}`;
            const res = await fetch(`${window.SUPABASE_URL}/rest/v1/${path}`, {
                headers: {
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            
            this._assignedTasks = {}; 
            if (data && Array.isArray(data)) {
                data.forEach(log => {
                    if (!this._assignedTasks[log.fecha]) this._assignedTasks[log.fecha] = [];
                    const rawId = Array.isArray(log.ejs_cods) ? log.ejs_cods[0] : log.ejs_cods;
                    const taskId = parseInt(rawId);
                    
                    this._assignedTasks[log.fecha].push({
                        logId: log.id,
                        id: taskId,
                        block: log.scenario
                    });
                });
            }
        } catch (e) { console.error("Error al cargar planificación:", e); }
    },

    async fetchTeamConfig() {
        // Priorizar memoria de App Core (window.CurrentTeam)
        if (window.CurrentTeam && window.CurrentTeam.match_dates) {
            this._matchDays = new Set(window.CurrentTeam.match_dates);
            console.log("📍 Morfociclo cargado desde Memoria Core");
            return;
        }

        const teamId = window.CurrentTeam?.id;
        if (!teamId) return;
        try {
            const data = await window.Supa._req('GET', `team_configs?team_id=eq.${teamId}`);
            if (data && data[0] && data[0].match_dates) {
                this._matchDays = new Set(data[0].match_dates);
            }
        } catch (e) { console.error("Error al cargar configuración de equipo:", e); }
    },

    changeMonth(e, offset) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        // Navegación pura sin intervención del router
        const nextDate = new Date(this._currentDate);
        nextDate.setMonth(nextDate.getMonth() + offset);
        this._currentDate = nextDate;
        this.renderDashboard();
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
                        <button onclick="App.logout()" class="btn-logout">SALIR</button>
                    </div>
                </header>

                <main class="dt-main-content">
                    <section id="dt-home-view" class="dt-home-view">
                        <!-- Widget 1: Perfil & Identidad -->
                        <div class="platinum-widget profile-widget">
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
                    </section>

                    <section id="dt-calendar-view" class="dt-dashboard-view" style="display: none;">
                        <!-- Navegador de Meses Reubicado -->
                        <div class="month-nav calendar-nav-ux">
                            <button type="button" class="btn-nav" onclick="event.preventDefault(); event.stopPropagation(); DTEngine.changeMonth(event, -1)">◀</button>
                            <span class="current-month-display">${monthName}</span>
                            <button type="button" class="btn-nav" onclick="event.preventDefault(); event.stopPropagation(); DTEngine.changeMonth(event, 1)">▶</button>
                        </div>
                        
                        <div id="dt-calendar-grid" class="macro-calendar-grid">
                            <!-- Inyección dinámica -->
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
                </main>

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
                                <select id="label-selector" onchange="DTEngine.forceLabel(this.value)">
                                    <option value="">(Automático)</option>
                                    <option value="MD-4">MD-4 (Tensión)</option>
                                    <option value="MD-3">MD-3 (Duración)</option>
                                    <option value="MD-2">MD-2 (Velocidad)</option>
                                    <option value="MD-1">MD-1 (Activación)</option>
                                    <option value="PARTIDO">Partido (MD)</option>
                                    <option value="RECUPERACIÓN">Recuperación (MD+1)</option>
                                    <option value="DESCANSO">Descanso</option>
                                    <option value="BASE">Base / Libre</option>
                                </select>
                            </div>
                        </div>
                        <div class="drawer-body">
                            <div class="library-header">
                                <h4>Biblioteca de Tareas</h4>
                                <button id="btn-toggle-filter" class="btn-text" onclick="DTEngine.toggleFilter()">Ver Toda</button>
                            </div>
                            <div id="library-list" class="exercise-list-container"></div>
                        </div>
                        <div class="drawer-footer-actions">
                            <button class="btn-save-staged" onclick="DTEngine.saveStagedTasks()">GUARDAR CAMBIOS</button>
                        </div>
                    </div>
                </div>

                <!-- Modal de Tarea (Ficha Técnica) -->
                <div id="dt-modal" class="modal-overlay hidden" onclick="DTEngine.closeModal()">
                    <div class="modal-content" onclick="event.stopPropagation()">
                        <div id="modal-body-content"></div>
                    </div>
                </div>
            </div>
        `;

        // await this.fetchExercises(); // Eliminado: Ahora es global
        await this.fetchMonthLogs(); 
        
        // --- FLUJO ESTRICTO DE RENDERIZADO ---
        this.generateCalendar();   // 1. Grilla y Tareas
        this.updateHomeUI();       // 2. Timeline
        
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
            const label = this.getMethodologyLabel(dateStr);
            const typeClass = this.getTypeClass(label);
            
            const cellDate = new Date(dateStr + 'T00:00:00');
            const isPast = cellDate < today;
            const pastClass = isPast ? 'past-day' : '';
            
            const assignments = this._assignedTasks[dateStr] || [];
            
            const renderBlock = (blockId, title) => {
                const tasks = assignments.filter(a => a.block === blockId);
                const tasksHtml = tasks.map((a) => {
                    const ex = (window.ExercisesLibrary || []).find(e => e.numericId === a.id);
                    if (!ex) return '';
                    return `
                        <div class="task-chip" onclick="event.stopPropagation(); DTEngine.openTaskModal(${a.id})">
                            <span class="tc-name">${ex.title}</span>
                            ${!isPast ? `<span class="tc-delete" onclick="event.stopPropagation(); DTEngine.removeTask('${dateStr}', ${assignments.indexOf(a)})">\u00d7</span>` : ''}
                        </div>
                    `;
                }).join('');

                return `
                    <div class="session-block ${blockId}">
                        ${tasks.length > 0 ? `<span class="sb-title">${title}</span>` : ''}
                        <div class="sb-tasks">${tasksHtml}</div>
                    </div>
                `;
            };

            html += `
                <div class="macro-day ${typeClass} ${pastClass}" onclick="${isPast ? 'void(0)' : `DTEngine.openDrawer('${dateStr}')`}">
                    <div class="m-day-top">
                        <span class="m-day-num">${d}</span>
                        <span class="m-day-label">${label}</span>
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

    getMethodologyLabel(dateStr) {
        if (this._manualLabels[dateStr]) return this._manualLabels[dateStr];
        if (this._matchDays.has(dateStr)) return 'PARTIDO';

        const current = new Date(dateStr + 'T00:00:00');
        const methodology = window.CurrentTeam?.methodology || 'Periodización Táctica';

        // 1. Días Pre-Partido
        for (let i = 1; i <= 4; i++) {
            const fut = new Date(current);
            fut.setDate(current.getDate() + i);
            const futStr = fut.toISOString().split('T')[0];
            
            if (this._matchDays.has(futStr)) {
                if (methodology === 'Microciclo Estructurado') {
                    const structLabels = {
                        1: 'Activación (MD-1)',
                        2: 'Velocidad (MD-2)',
                        3: 'Duración (MD-3)',
                        4: 'Tensión (MD-4)'
                    };
                    return structLabels[i] || `MD-${i}`;
                }
                // Periodización Táctica
                return `MD-${i}`;
            }
        }

        // 2. Días Post-Partido (MD+1)
        const yesterday = new Date(current);
        yesterday.setDate(current.getDate() - 1);
        const yestStr = yesterday.toISOString().split('T')[0];
        if (this._matchDays.has(yestStr)) return 'RECUPERACIÓN';

        return 'BASE';
    },

    getTypeClass(label) {
        if (label.includes('PARTIDO')) return 'type-partido';
        if (label.includes('MD-4')) return 'type-tension';
        if (label.includes('MD-3')) return 'type-duracion';
        if (label.includes('MD-2')) return 'type-velocidad';
        if (label.includes('MD-1')) return 'type-activacion';
        if (label.includes('RECUPERACIÓN')) return 'type-recuperacion';
        if (label.includes('DESCANSO')) return 'type-descanso';
        return '';
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
        const oldLabel = this._manualLabels[this._selectedDate];
        
        if (!val) delete this._manualLabels[this._selectedDate];
        else this._manualLabels[this._selectedDate] = val;
        
        const isMatch = (val === 'PARTIDO');
        const wasMatch = (oldLabel === 'PARTIDO');

        if (isMatch) this._matchDays.add(this._selectedDate);
        else if (wasMatch) this._matchDays.delete(this._selectedDate);

        // Si hubo cambios en los días de partido, persistir en team_configs
        if (isMatch || wasMatch) {
            await this.saveMatchDays();
        }

        this.generateCalendar();
        this.updateDrawerUI();
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
            await fetch(`${window.SUPABASE_URL}/rest/v1/team_configs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(payload)
            });
            console.log("🟢 Configuración de Morfociclo persistida.");
        } catch (e) { console.error("Error al guardar morfociclo:", e); }
    },

    updateDrawerUI() {
        const label = this.getMethodologyLabel(this._selectedDate);
        document.getElementById('drawer-methodology-label').innerText = label;
        this.renderLibrary(label);
    },

    toggleFilter() {
        this._showAllExercises = !this._showAllExercises;
        const btn = document.getElementById('btn-toggle-filter');
        btn.innerText = this._showAllExercises ? 'Filtrar por Fase' : 'Ver Toda';
        this.renderLibrary(this.getMethodologyLabel(this._selectedDate));
    },

    renderLibrary(currentLabel) {
        const container = document.getElementById('library-list');
        if (!container) return;
        
        // Fase actual limpia
        const currentPhase = currentLabel.split(' ')[0].trim().toUpperCase();

        let filtered = window.ExercisesLibrary || [];
        
        // Si no estamos en 'Ver Toda', filtramos por fase exacta
        if (!this._showAllExercises && (currentPhase.startsWith('MD-') || currentPhase === 'PARTIDO')) {
            filtered = filtered.filter(ex => 
                ex.morfociclo_phase?.trim().toUpperCase() === currentPhase
            );
        }

        container.innerHTML = filtered.map(ex => {
            const isStaged = this._stagedTasks.some(t => t.id === ex.numericId);
            return `
                <div class="exercise-card ${isStaged ? 'staged-card' : ''}">
                    <div class="ex-info">
                        <span class="ex-id">#${ex.numericId}</span>
                        <h5 class="ex-title">${ex.title}</h5>
                        <p class="ex-meta">${ex.morfociclo_phase} | ${ex.game_moment}</p>
                    </div>
                    <div class="ex-actions">
                        <select class="block-select" id="select-${ex.numericId}">
                            <option value="gimnasio">Gimnasio</option>
                            <option value="entrada_calor">E. Calor</option>
                            <option value="parte_principal" selected>P. Principal</option>
                            <option value="doble_turno">2º Turno</option>
                            <option value="vuelta_calma">V. Calma</option>
                        </select>
                        <button id="btn-add-${ex.numericId}" class="ex-add-btn ${isStaged ? 'staged' : ''}" onclick="DTEngine.stageExercise(${ex.numericId})">
                            ${isStaged ? '✓' : '+'}
                        </button>
                    </div>
                </div>
            `;
        }).join('') || '<p class="empty-msg">No hay tareas para esta fase.</p>';
    },

    _stagedTasks: [],

    stageExercise(id) {
        const block = document.getElementById(`select-${id}`).value;
        const btn = document.getElementById(`btn-add-${id}`);
        
        // Toggle selection
        const existingIdx = this._stagedTasks.findIndex(t => t.id === id);
        if (existingIdx > -1) {
            this._stagedTasks.splice(existingIdx, 1);
            btn.classList.remove('staged');
            btn.innerText = '+';
        } else {
            this._stagedTasks.push({ id, block });
            btn.classList.add('staged');
            btn.innerText = '✓';
        }
    },

    async saveStagedTasks() {
        if (this._stagedTasks.length === 0) return this.closeDrawer();
        
        try {
            const teamId = window.CurrentTeam?.id;
            const userId = localStorage.getItem('ravix_v5_uid');
            const token = localStorage.getItem('ravix_token');
            const date = this._selectedDate;

            if (!teamId || !token) throw new Error("Sesión inválida");

            console.log(`💾 Guardando masivamente ${this._stagedTasks.length} tareas para ${date}...`);

            // Usar RPC para mayor consistencia y performance
            for (const task of this._stagedTasks) {
                const payload = {
                    p_user_id: userId,
                    p_team_id: teamId,
                    p_fecha: date,
                    p_scenario: task.block,
                    p_task_id: task.id.toString()
                };

                await fetch(`${window.SUPABASE_URL}/rest/v1/rpc/guardar_tarea_calendario`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': window.SUPABASE_KEY,
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
            }

            this._stagedTasks = [];
            await this.refreshState();
            this.closeDrawer();

        } catch (e) {
            alert("Error al guardar cambios: " + e.message);
        }
    },

    // assignExercise antigua eliminada en favor de staging

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

            const response = await fetch(`${window.SUPABASE_URL}/rest/v1/rpc/borrar_tarea_calendario`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    p_user_id: userId,
                    p_team_id: teamId,
                    p_fecha: date,
                    p_scenario: task.block,
                    p_task_id: task.id.toString()
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(JSON.stringify(errorData));
            }

            console.log("🟢 Tarea eliminada con éxito vía RPC");
            
            // Solo después de confirmar, refrescamos el estado global
            await this.refreshState();

        } catch (error) {
            console.error("🔴 Error crítico al borrar en RPC:", error.message);
            alert("Error al borrar: " + error.message);
        }
    },

    openTaskModal(numericId) {
        const task = (window.ExercisesLibrary || []).find(ex => ex.numericId === numericId);
        if (task) this.renderTaskModal(task);
    },

    renderTaskModal(task) {
        const modal = document.getElementById('dt-modal');
        const body = document.getElementById('modal-body-content');
        body.innerHTML = `
            <div class="modal-header">
                <div class="m-title-group">
                    <span class="m-task-id">#${task.numericId}</span>
                    <h2 class="m-task-title">${task.title}</h2>
                </div>
                <button class="btn-close-modal" onclick="DTEngine.closeModal()">✕</button>
            </div>
            <div class="modal-grid">
                <div class="m-col">
                    <div class="m-info-block"><label>Momento</label><p>${task.game_moment.replace('_',' ').toUpperCase()}</p></div>
                    <div class="m-info-block"><label>SSP</label><p>${task.ssp_type}</p></div>
                    <div class="m-info-block"><label>Jugadores</label><p>${task.min_players}-${task.max_players}</p></div>
                    <div class="m-info-block"><label>Dimensiones</label><p>${task.dimensions}</p></div>
                </div>
                <div class="m-col">
                    <div class="m-info-block"><label>Descripción</label><p class="m-desc">${task.description || '...'}</p></div>
                    <div class="m-info-block"><label>Materiales</label><p>${task.materials || 'Balones'}</p></div>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
    },

    closeModal() { document.getElementById('dt-modal').classList.add('hidden'); },
    closeDrawer() { document.getElementById('dt-drawer').classList.add('hidden'); },

    // --- MÓDULO DE REACTIVIDAD (Phase 6) ---
    async refreshState() {
        await this.fetchMonthLogs();
        this.generateCalendar();
        this.updateHomeUI();
        const anView = document.getElementById('dt-analytics-view');
        if (anView && anView.style.display === 'block') {
            this.renderAnalytics();
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
                labels: ['L','M','X','J','V','S','D'],
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

    toggleView(view) {
        const home = document.getElementById('dt-home-view');
        const cal = document.getElementById('dt-calendar-view');
        const an = document.getElementById('dt-analytics-view');
        
        [home, cal, an].forEach(v => { if(v) v.style.display = 'none'; });

        if (view === 'home') {
            home.style.display = 'block';
            this.updateHomeUI();
        } else if (view === 'analytics') {
            an.style.display = 'block';
            this.renderAnalytics();
        } else {
            cal.style.display = 'block';
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
    }
};
