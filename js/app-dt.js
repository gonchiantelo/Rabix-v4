'use strict';

/* ============================================================
   RAVIX V5 — DT ENGINE (app-dt.js)
   Phase 3.6: Technical Task Modal & Interaction
   ============================================================ */

window.DTEngine = {
    _currentDate: new Date(),
    _matchDays: new Set(),
    _manualLabels: {},
    _assignedTasks: {},
    _exercises: [],
    _selectedDate: null,
    _showAllExercises: false,

    async renderDashboard() {
        const shell = document.getElementById('app-shell');
        if (!shell) return;

        const monthName = this._currentDate.toLocaleString('es', { month: 'long', year: 'numeric' }).toUpperCase();

        shell.innerHTML = `
            <div class="dt-shell-container">
                <header class="app-header">
                    <div class="brand-name">RAVIX <span class="dt-badge">DT ELITE</span></div>
                    <button onclick="App.logout()" class="btn-logout">SALIR</button>
                </header>

                <main class="dt-main-content">
                    <section class="dt-dashboard-view">
                        <div class="dt-view-header">
                            <h1 class="dt-main-title">Planificación Estratégica</h1>
                            <p class="dt-main-subtitle">${monthName}</p>
                        </div>
                        <div id="dt-calendar-grid" class="macro-calendar-grid"></div>
                    </section>
                </main>

                <!-- Drawer Lateral -->
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
        const data = await window.Supa._req('GET', 'exercises_library');
        if (data) {
            this._exercises = data.map(ex => ({
                ...ex,
                numericId: parseInt(ex.id.replace(/\D/g, '')) || Date.now()
            }));
        }
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
            
            const tasks = this._assignedTasks[dateStr] || [];
            const tasksHtml = tasks.map(id => {
                const ex = this._exercises.find(e => e.numericId === id);
                return ex ? `<div class="task-chip" onclick="event.stopPropagation(); DTEngine.openTaskModal(${id})">${ex.title}</div>` : '';
            }).join('');

            html += `
                <div class="macro-day ${typeClass}" onclick="DTEngine.openDrawer('${dateStr}')">
                    <div class="m-day-top">
                        <span class="m-day-num">${d}</span>
                        <span class="m-day-label">${label}</span>
                    </div>
                    <div class="m-day-content">${tasksHtml}</div>
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
            const fut = new Date(current); fut.setDate(current.getDate() + i);
            const futStr = fut.toISOString().split('T')[0];
            if (this._matchDays.has(futStr) || this._manualLabels[futStr] === 'PARTIDO') return `MD-${i}`;
        }
        const yesterday = new Date(current); yesterday.setDate(current.getDate() - 1);
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
        document.getElementById('btn-toggle-filter').innerText = this._showAllExercises ? 'Filtrar por Fase' : 'Ver Toda';
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
            <div class="exercise-card" onclick="DTEngine.assignExercise(${ex.numericId})">
                <div class="ex-info">
                    <span class="ex-id">#${ex.numericId}</span>
                    <h5 class="ex-title">${ex.title}</h5>
                    <p class="ex-meta">${ex.morfociclo_phase} | ${ex.game_moment}</p>
                </div>
                <div class="ex-add-btn">+</div>
            </div>
        `).join('') || '<p class="empty-msg">No hay tareas para esta fase.</p>';
    },

    assignExercise(id) {
        if (!this._assignedTasks[this._selectedDate]) this._assignedTasks[this._selectedDate] = [];
        this._assignedTasks[this._selectedDate].push(id);
        this.generateCalendar();
    },

    openTaskModal(numericId) {
        const task = this._exercises.find(e => e.numericId === numericId);
        if (!task) return;
        this.renderTaskModal(task);
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
                    <div class="m-info-block">
                        <label>Momento del Juego</label>
                        <p>${task.game_moment.replace('_', ' ').toUpperCase()}</p>
                    </div>
                    <div class="m-info-block">
                        <label>Tipo de SSP</label>
                        <p>${task.ssp_type}</p>
                    </div>
                    <div class="m-info-block">
                        <label>Jugadores</label>
                        <p>${task.min_players} - ${task.max_players}</p>
                    </div>
                    <div class="m-info-block">
                        <label>Dimensiones</label>
                        <p>${task.dimensions}</p>
                    </div>
                </div>
                <div class="m-col">
                    <div class="m-info-block">
                        <label>Descripción / Reglas</label>
                        <p class="m-desc">${task.description || 'Sin descripción disponible.'}</p>
                    </div>
                    <div class="m-info-block">
                        <label>Materiales</label>
                        <p>${task.materials || 'Balones, Conos'}</p>
                    </div>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('dt-modal').classList.add('hidden');
    },

    closeDrawer() { document.getElementById('dt-drawer').classList.add('hidden'); }
};
