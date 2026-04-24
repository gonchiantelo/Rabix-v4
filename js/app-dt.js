'use strict';

/* ============================================================
   RAVIX V5 — DT ENGINE (app-dt.js)
   Phase 3.8: Navegación Anual & Bloques Ocultos (Completo)
   ============================================================ */

window.DTEngine = {
    _currentDate: new Date(),
    _matchDays: new Set(),
    _manualLabels: {},   // { "YYYY-MM-DD": "MD-4" }
    _assignedTasks: {},  // { "YYYY-MM-DD": [ { id, block } ] }
    _exercises: [],
    _selectedDate: null,
    _showAllExercises: false,

    changeMonth(offset) {
        this._currentDate.setMonth(this._currentDate.getMonth() + offset);
        this.renderDashboard();
    },

    async renderDashboard() {
        const shell = document.getElementById('app-shell');
        if (!shell) return;

        const monthName = this._currentDate.toLocaleString('es', { month: 'long', year: 'numeric' }).toUpperCase();

        shell.innerHTML = `
            <div class="dt-shell-container">
                <header class="app-header">
                    <div class="brand-name">RAVIX <span class="dt-badge">DT ELITE</span></div>
                    
                    <div class="month-nav">
                        <button class="btn-nav" onclick="DTEngine.changeMonth(-1)">◀</button>
                        <span class="current-month-display">${monthName}</span>
                        <button class="btn-nav" onclick="DTEngine.changeMonth(1)">▶</button>
                    </div>

                    <div class="header-actions">
                        <button onclick="App.logout()" class="btn-logout">SALIR</button>
                    </div>
                </header>

                <main class="dt-main-content">
                    <section class="dt-dashboard-view">
                        <div id="dt-calendar-grid" class="macro-calendar-grid">
                            <!-- Inyección dinámica -->
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

        await this.fetchExercises();
        this.generateCalendar();
    },

    async fetchExercises() {
        if (this._exercises.length > 0) return;
        try {
            const data = await window.Supa._req('GET', 'exercises_library');
            if (data) {
                this._exercises = data.map(ex => ({
                    ...ex,
                    numericId: parseInt(ex.id.replace(/\D/g, '')) || Date.now()
                }));
            }
        } catch (e) { console.error("Error biblioteca:", e); }
    },

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

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const label = this.getMethodologyLabel(dateStr);
            const typeClass = this.getTypeClass(label);
            
            const assignments = this._assignedTasks[dateStr] || [];
            
            const renderBlock = (blockId, title) => {
                const tasks = assignments.filter(a => a.block === blockId);
                const tasksHtml = tasks.map((a) => {
                    const ex = this._exercises.find(e => e.numericId === a.id);
                    if (!ex) return '';
                    return `
                        <div class="task-chip" onclick="event.stopPropagation(); DTEngine.openTaskModal(${a.id})">
                            <span class="tc-name">${ex.title}</span>
                            <span class="tc-delete" onclick="event.stopPropagation(); DTEngine.removeTask('${dateStr}', ${assignments.indexOf(a)})">×</span>
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
                <div class="macro-day ${typeClass}" onclick="DTEngine.openDrawer('${dateStr}')">
                    <div class="m-day-top">
                        <span class="m-day-num">${d}</span>
                        <span class="m-day-label">${label}</span>
                    </div>
                    <div class="m-day-content">
                        ${renderBlock('gym', 'Gimnasio')}
                        ${renderBlock('entry', 'Entrada en Calor')}
                        ${renderBlock('main', 'Parte Principal')}
                        ${renderBlock('double', '2º Turno / Táctica')}
                        ${renderBlock('cool', 'Vuelta a la Calma')}
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
        for (let i = 1; i <= 4; i++) {
            const fut = new Date(current);
            fut.setDate(current.getDate() + i);
            const futStr = fut.toISOString().split('T')[0];
            if (this._matchDays.has(futStr) || this._manualLabels[futStr] === 'PARTIDO') return `MD-${i}`;
        }

        const yesterday = new Date(current);
        yesterday.setDate(current.getDate() - 1);
        const yestStr = yesterday.toISOString().split('T')[0];
        if (this._matchDays.has(yestStr) || this._manualLabels[yestStr] === 'PARTIDO') return 'RECUPERACIÓN';

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

    forceLabel(val) {
        if (!val) delete this._manualLabels[this._selectedDate];
        else this._manualLabels[this._selectedDate] = val;
        
        if (val === 'PARTIDO') this._matchDays.add(this._selectedDate);
        else this._matchDays.delete(this._selectedDate);

        this.generateCalendar();
        this.updateDrawerUI();
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
        const phase = currentLabel.split(' ')[0];

        let filtered = this._exercises;
        if (!this._showAllExercises && (phase.startsWith('MD-') || phase === 'PARTIDO')) {
            filtered = this._exercises.filter(ex => ex.morfociclo_phase === phase);
        }

        container.innerHTML = filtered.map(ex => `
            <div class="exercise-card">
                <div class="ex-info">
                    <span class="ex-id">#${ex.numericId}</span>
                    <h5 class="ex-title">${ex.title}</h5>
                    <p class="ex-meta">${ex.morfociclo_phase} | ${ex.game_moment}</p>
                </div>
                <div class="ex-actions">
                    <select class="block-select" id="select-${ex.numericId}">
                        <option value="gym">Gimnasio</option>
                        <option value="entry">E. Calor</option>
                        <option value="main" selected>P. Principal</option>
                        <option value="double">2º Turno</option>
                        <option value="cool">V. Calma</option>
                    </select>
                    <button class="ex-add-btn" onclick="DTEngine.assignExercise(${ex.numericId})">+</button>
                </div>
            </div>
        `).join('') || '<p class="empty-msg">No hay tareas para esta fase.</p>';
    },

    assignExercise(id) {
        const block = document.getElementById(`select-${id}`).value;
        if (!this._assignedTasks[this._selectedDate]) this._assignedTasks[this._selectedDate] = [];
        this._assignedTasks[this._selectedDate].push({ id, block });
        this.generateCalendar();
    },

    removeTask(date, index) {
        if (this._assignedTasks[date]) {
            this._assignedTasks[date].splice(index, 1);
            this.generateCalendar();
        }
    },

    openTaskModal(numericId) {
        const task = this._exercises.find(e => e.numericId === numericId);
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
    closeDrawer() { document.getElementById('dt-drawer').classList.add('hidden'); }
};
