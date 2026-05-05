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
    _stagedLabel: null,  // Etiqueta pendiente de confirmar (Lazy Execution)
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
            // Sincronizar estado global para que applyMethodologyLabels() lea la verdad fresca
            if (window.CurrentTeam) {
                window.CurrentTeam.match_dates = Array.from(this._matchDays);
            }
        } catch (e) { console.error("Error al cargar configuración de equipo:", e); }
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
                        <!-- Navegador de Meses Reubicado -->
                        <div class="month-nav calendar-nav-ux">
                            <button type="button" id="btn-prev-month" class="btn-nav">◀</button>
                            <span class="current-month-display">${monthName}</span>
                            <button type="button" id="btn-next-month" class="btn-nav">▶</button>
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
                    
                    <section id="view-board" class="view-section" style="display: none;"><div style="display: flex; gap: 20px; height: 75vh; margin-top: 20px;"><div class="board-toolbar" style="width: 200px; background: #1a1a1a; padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);"><h4 style="color: var(--primary-color); margin-bottom: 15px;">HERRAMIENTAS</h4><button onclick="DTEngine.Board.addToken('local')" style="width:100%; padding: 10px; margin-bottom:10px; background: var(--primary-color); border:none; border-radius:6px; color:#000; font-weight:bold; cursor:pointer;">+ Local</button><button onclick="DTEngine.Board.addToken('rival')" style="width:100%; padding: 10px; margin-bottom:10px; background: #ff4d4d; border:none; border-radius:6px; color:#fff; font-weight:bold; cursor:pointer;">+ Rival</button><button onclick="DTEngine.Board.addToken('ball')" style="width:100%; padding: 10px; margin-bottom:20px; background: #fff; border:none; border-radius:6px; color:#000; font-weight:bold; cursor:pointer;">+ Balón</button><button onclick="DTEngine.Board.toggleDraw()" style="width:100%; padding: 10px; margin-bottom:10px; background: #333; border:1px solid #555; border-radius:6px; color:#fff; cursor:pointer;">Lápiz Libre</button><button onclick="DTEngine.Board.clearBoard()" style="width:100%; padding: 10px; background: transparent; border:1px solid #ff4d4d; border-radius:6px; color:#ff4d4d; cursor:pointer;">Limpiar</button></div><div class="board-canvas-container" style="flex: 1; background: #1a1a1a; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);"><canvas id="tactical-board" width="800" height="600"></canvas></div></div></section>
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
                            <button class="btn-add-custom-task" onclick="DTEngine.openCustomTaskModal()">+ Añadir Tarea Personalizada</button>
                            <div id="library-list" class="exercise-list-container"></div>
                        </div>
                        <div class="drawer-footer-actions">
                            <button class="btn-save-staged" onclick="DTEngine.saveStagedTasks()">GUARDAR CAMBIOS</button>
                        </div>
                    </div>
                </div>

                <!-- Modal de Tarea Personalizada -->
                <div id="modal-custom-task" class="modal-overlay hidden" onclick="DTEngine.closeCustomTaskModal()">
                    <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 520px;">
                        <div class="modal-header">
                            <div class="m-title-group">
                                <span class="m-task-id">BÓVEDA PRIVADA</span>
                                <h2 class="m-task-title">Nueva Tarea Personalizada</h2>
                            </div>
                            <button class="btn-close-modal" onclick="DTEngine.closeCustomTaskModal()">✕</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 18px; margin-top: 20px;">
                            <div class="profile-input-group">
                                <label class="profile-input-group label" style="font-size:10px;color:var(--dt-text-dim);font-weight:900;letter-spacing:1px;">NOMBRE DE LA TAREA</label>
                                <input type="text" id="custom-task-name" class="profile-input" placeholder="Ej: Rondo de pressing específico">
                            </div>
                            <div class="profile-input-group">
                                <label style="font-size:10px;color:var(--dt-text-dim);font-weight:900;letter-spacing:1px;">ETIQUETA TÁCTICA (FASE)</label>
                                <select id="custom-task-phase" class="profile-input">
                                    <option value="MD-4">MD-4 (Tensión)</option>
                                    <option value="MD-3">MD-3 (Duración)</option>
                                    <option value="MD-2">MD-2 (Velocidad)</option>
                                    <option value="MD-1">MD-1 (Activación)</option>
                                    <option value="PARTIDO">Partido (MD)</option>
                                    <option value="RECUPERACIÓN">Recuperación (MD+1)</option>
                                    <option value="BASE">Base / Libre</option>
                                </select>
                            </div>
                            <div class="profile-input-group">
                                <label style="font-size:10px;color:var(--dt-text-dim);font-weight:900;letter-spacing:1px;">REGLAS / CONSTREÑIMIENTOS</label>
                                <textarea id="custom-task-rules" class="profile-input profile-textarea" placeholder="Describe los objetivos tácticos, restricciones de espacio o número de jugadores..."></textarea>
                            </div>
                            <button class="btn-save-profile" onclick="DTEngine.saveCustomTask()">GUARDAR EN BÓVEDA PRIVADA</button>
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
                <div class="macro-day ${typeClass ? typeClass : ''} ${pastClass}" data-date="${dateStr}" onclick="${isPast ? 'void(0)' : `DTEngine.openDrawer('${dateStr}')`}">
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

        // Último paso obligatorio: re-pintar etiquetas sobre el DOM ya renderizado
        this.applyMethodologyLabels();
    },

    applyMethodologyLabels() {
        // Fuente de verdad: priorizar array de Core, fallback al Set local
        const matchDates = (window.CurrentTeam?.match_dates && window.CurrentTeam.match_dates.length > 0)
            ? window.CurrentTeam.match_dates
            : Array.from(this._matchDays);

        const methodology = window.CurrentTeam?.methodology || 'Periodización Táctica';
        const manualLabels = this._manualLabels || {};

        console.log(`🗓️ applyMethodologyLabels: ${matchDates.length} partidos encontrados. Metodología: ${methodology}`);

        if (matchDates.length === 0) {
            console.warn('⚠️ applyMethodologyLabels: No hay fechas de partido configuradas. Las etiquetas quedarán en BASE.');
            return;
        }

        // Mapa de etiquetas por metodología (D-1 = más cercano al partido)
        const isPT = methodology !== 'Microciclo Estructurado';
        const preLabels = isPT
            ? { 1: 'MD-1', 2: 'MD-2', 3: 'MD-3', 4: 'MD-4' }
            : { 1: 'Activación', 2: 'Velocidad', 3: 'Duración', 4: 'Tensión' };

        // Construir el mapa de etiquetas definitivo
        const labelMap = new Map();

        matchDates.forEach(matchStr => {
            // Partido
            labelMap.set(matchStr, 'PARTIDO');

            const matchDate = new Date(matchStr + 'T00:00:00');

            // D-1 a D-4 (días PRE-partido)
            for (let i = 1; i <= 4; i++) {
                const d = new Date(matchDate);
                d.setDate(matchDate.getDate() - i);
                const dStr = d.toISOString().split('T')[0];
                if (!labelMap.has(dStr)) {
                    labelMap.set(dStr, preLabels[i] || `MD-${i}`);
                }
            }

            // D+1 (Recuperación)
            const postDate = new Date(matchDate);
            postDate.setDate(matchDate.getDate() + 1);
            const postStr = postDate.toISOString().split('T')[0];
            if (!labelMap.has(postStr)) {
                labelMap.set(postStr, 'RECUPERACIÓN');
            }
        });

        // Etiquetas manuales siempre ganan (overwrite final)
        Object.entries(manualLabels).forEach(([dateStr, lbl]) => {
            if (lbl) labelMap.set(dateStr, lbl);
        });

        // Patch DOM: buscar cada celda por data-date e inyectar solo la etiqueta
        let patched = 0;
        labelMap.forEach((label, dateStr) => {
            try {
                const cell = document.querySelector(`.macro-day[data-date="${dateStr}"]`);
                if (!cell) return; // Fuera del mes visible — OK, ignorar silenciosamente

                // Actualizar texto de la etiqueta de fase
                const labelEl = cell.querySelector('.m-day-label');
                if (labelEl) {
                    labelEl.textContent = label;
                    patched++;
                }

                // Actualizar clase de color del tipo
                const typeClasses = ['type-partido', 'type-base', 'type-tension', 'type-duracion', 'type-velocidad', 'type-activacion', 'type-recuperacion', 'type-descanso'];
                typeClasses.forEach(c => cell.classList.remove(c));
                const newClass = this.getTypeClass(label);
                if (newClass && newClass.trim() !== '') {
                    cell.classList.add(newClass.trim());
                }
            } catch (err) {
                console.error(`🔴 applyMethodologyLabels: error procesando ${dateStr}:`, err);
            }
        });

        console.log(`✅ applyMethodologyLabels: ${patched} celdas actualizadas de ${labelMap.size} etiquetas calculadas.`);
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
        if (!label) return 'type-base';
        if (label.includes('PARTIDO')) return 'type-partido';
        if (label.includes('MD-4') || label.includes('Tensión')) return 'type-tension';
        if (label.includes('MD-3') || label.includes('Duración')) return 'type-duracion';
        if (label.includes('MD-2') || label.includes('Velocidad')) return 'type-velocidad';
        if (label.includes('MD-1') || label.includes('Activación')) return 'type-activacion';
        if (label.includes('RECUPERACIÓN')) return 'type-recuperacion';
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
        const oldLabel = this._manualLabels[this._selectedDate];

        if (!val) delete this._manualLabels[this._selectedDate];
        else this._manualLabels[this._selectedDate] = val;

        const isMatch = (val === 'PARTIDO');
        const wasMatch = (oldLabel === 'PARTIDO');

        if (isMatch) this._matchDays.add(this._selectedDate);
        else if (wasMatch) this._matchDays.delete(this._selectedDate);

        // Sincronizar inmediatamente el estado global
        if (window.CurrentTeam) {
            window.CurrentTeam.match_dates = Array.from(this._matchDays);
        }

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

        // --- FUENTES DE DATOS ---
        const customTasks = window.CustomExercises || [];
        let globalTasks = window.ExercisesLibrary || [];

        // Filtrar tareas globales por fase si aplica
        if (!this._showAllExercises && (currentPhase.startsWith('MD-') || currentPhase === 'PARTIDO')) {
            globalTasks = globalTasks.filter(ex =>
                ex.morfociclo_phase?.trim().toUpperCase() === currentPhase
            );
        }

        // --- RENDER CUSTOM (prioridad, badge dorado) ---
        const customFiltered = this._showAllExercises
            ? customTasks
            : customTasks.filter(ex => !ex.morfociclo_phase || ex.morfociclo_phase.trim().toUpperCase() === currentPhase || currentPhase === 'BASE');

        const customHTML = customFiltered.map(ex => {
            const isStaged = this._stagedTasks.some(t => t.id === ex.numericId && t.isCustom);
            return `
                <div class="exercise-card custom-task-card ${isStaged ? 'staged-card' : ''}">
                    <div class="ex-info">
                        <span class="ex-id custom-badge">★ TUYA</span>
                        <h5 class="ex-title">${ex.title}</h5>
                        <p class="ex-meta">${ex.morfociclo_phase || 'Personalizada'} | ${ex.description || ''}</p>
                    </div>
                    <div class="ex-actions">
                        <select class="block-select" id="select-c${ex.numericId}">
                            <option value="gimnasio">Gimnasio</option>
                            <option value="entrada_calor">E. Calor</option>
                            <option value="parte_principal" selected>P. Principal</option>
                            <option value="doble_turno">2º Turno</option>
                            <option value="vuelta_calma">V. Calma</option>
                        </select>
                        <button id="btn-add-c${ex.numericId}" class="ex-add-btn ${isStaged ? 'staged' : ''}" onclick="DTEngine.stageExercise(${ex.numericId}, true)">
                            ${isStaged ? '✓' : '+'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // --- RENDER GLOBAL ---
        const globalHTML = globalTasks.map(ex => {
            const isStaged = this._stagedTasks.some(t => t.id === ex.numericId && !t.isCustom);
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
                        <button id="btn-add-${ex.numericId}" class="ex-add-btn ${isStaged ? 'staged' : ''}" onclick="DTEngine.stageExercise(${ex.numericId}, false)">
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
            labelDisplay.textContent = val ? `Etiqueta: ${val} (pendiente de guardar)` : this.getMethodologyLabel(this._selectedDate);
        }
    },

    stageExercise(id, isCustom = false) {
        const selectEl = document.getElementById(isCustom ? `select-c${id}` : `select-${id}`);
        const block = selectEl ? selectEl.value : 'parte_principal';
        const btnEl = document.getElementById(isCustom ? `btn-add-c${id}` : `btn-add-${id}`);

        // Toggle selection
        const existingIdx = this._stagedTasks.findIndex(t => t.id === id && t.isCustom === isCustom);
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
                // Cadena estricta: fetch → render → labels (sin reconstruir shell)
                try {
                    await this.fetchMonthLogs();
                    this.generateCalendar();  // incluye applyMethodologyLabels()
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
                    <div class="m-info-block"><label>Momento</label><p>${task.game_moment.replace('_', ' ').toUpperCase()}</p></div>
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
        const todayLabel = this.getMethodologyLabel(todayStr);
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
            const uRes = await fetch(`${window.SUPABASE_URL}/rest/v1/users?id=eq.${uid}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name, license })
            });

            // 2. Actualizar Equipo
            const teamId = window.CurrentTeam?.id;
            const tRes = await fetch(`${window.SUPABASE_URL}/rest/v1/teams?id=eq.${teamId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: teamName })
            });

            // 3. Actualizar Config Táctica (incluyendo tactical_dna)
            const cRes = await fetch(`${window.SUPABASE_URL}/rest/v1/team_configs?team_id=eq.${teamId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ primary_color: color, methodology, tactical_dna })
            });

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

    // --- BÓVEDA DE TAREAS PERSONALIZADAS ---
    openCustomTaskModal() {
        document.getElementById('custom-task-name').value = '';
        document.getElementById('custom-task-rules').value = '';
        document.getElementById('modal-custom-task').classList.remove('hidden');
    },

    closeCustomTaskModal() {
        document.getElementById('modal-custom-task').classList.add('hidden');
    },

    async saveCustomTask() {
        const uid = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        const name = document.getElementById('custom-task-name').value.trim();
        const phase = document.getElementById('custom-task-phase').value;
        const rules = document.getElementById('custom-task-rules').value.trim();

        if (!name) return alert('El nombre de la tarea es obligatorio.');

        try {
            console.log('💾 Guardando tarea personalizada en bóveda...');
            const res = await fetch(`${window.SUPABASE_URL}/rest/v1/custom_exercises`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': window.SUPABASE_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    user_id: uid,
                    title: name,
                    morfociclo_phase: phase,
                    description: rules
                })
            });

            if (!res.ok) throw new Error('Error al guardar en Supabase.');

            const data = await res.json();
            const newTask = data[0];

            // Inyectar en memoria global inmediatamente
            if (!window.CustomExercises) window.CustomExercises = [];
            window.CustomExercises.unshift({
                ...newTask,
                numericId: newTask.id,
                isCustom: true
            });

            this.closeCustomTaskModal();
            // Re-renderizar la biblioteca con la nueva tarea al tope
            this.renderLibrary(this.getMethodologyLabel(this._selectedDate));
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
        canvas: null, 
        init: function() {
    try {
        if (typeof fabric === 'undefined') {
            console.error('Fabric.js no está cargado. Verifica el CDN en index.html');
            return;
        }
        const canvasElement = document.getElementById('tactical-board');
        if (!canvasElement) {
            console.error('No se encontró el elemento canvas #tactical-board en el DOM');
            return;
        }
        if (this.canvas) return; // Ya inicializado
        
        this.canvas = new fabric.Canvas('tactical-board', { selection: true });
        const container = canvasElement.parentElement;
        this.canvas.setWidth(container.clientWidth || 800);
        this.canvas.setHeight(container.clientHeight || 600);
        this.drawPitch();
    } catch (err) {
        console.error('Error al inicializar la Pizarra:', err);
    }
}, 
        drawPitch: function() { 
            this.canvas.setBackgroundColor('#1c2a22', this.canvas.renderAll.bind(this.canvas)); 
            const w = this.canvas.width; 
            const h = this.canvas.height; 
            const centerLine = new fabric.Line([w/2, 0, w/2, h], { stroke: 'rgba(255,255,255,0.3)', strokeWidth: 2, selectable: false }); 
            const centerCircle = new fabric.Circle({ radius: 60, left: w/2, top: h/2, fill: 'transparent', stroke: 'rgba(255,255,255,0.3)', strokeWidth: 2, originX: 'center', originY: 'center', selectable: false }); 
            this.canvas.add(centerLine, centerCircle); 
        }, 
        addToken: function(type) { 
            let color = type === 'local' ? (window.CurrentTeam?.primary_color || '#0eb1a7') : (type === 'rival' ? '#ff4d4d' : '#ffffff'); 
            let r = type === 'ball' ? 8 : 16; 
            const token = new fabric.Circle({ radius: r, fill: color, left: this.canvas.width/2, top: this.canvas.height/2, originX: 'center', originY: 'center', hasControls: false, borderColor: '#fff', transparentCorners: false }); 
            this.canvas.add(token); 
            this.canvas.setActiveObject(token); 
        }, 
        toggleDraw: function() { 
            this.canvas.isDrawingMode = !this.canvas.isDrawingMode; 
            if (this.canvas.isDrawingMode) { 
                this.canvas.freeDrawingBrush.color = 'var(--primary-color, #0eb1a7)'; 
                this.canvas.freeDrawingBrush.width = 3; 
            } 
        }, 
        clearBoard: function() { 
            this.canvas.clear(); 
            this.drawPitch(); 
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


};
