'use strict';

/* ============================================================
   RAVIX V5 — DT ENGINE (app-dt.js)
   Phase 3.5: Contextual Filtering & Grid Rendering
   ============================================================ */

window.DTEngine = {
    _currentDate: new Date(),
    _matchDays: new Set(),
    _restDays: new Set(),
    _assignedTasks: {}, // { "YYYY-MM-DD": [id1, id2] }
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
                    <div class="header-actions">
                        <button onclick="App.logout()" class="btn-logout">SALIR</button>
                    </div>
                </header>

                <main class="dt-main-content">
                    <section class="dt-dashboard-view">
                        <div class="dt-view-header">
                            <div class="title-group">
                                <h1 class="dt-main-title">Planificación Estratégica</h1>
                                <p class="dt-main-subtitle">${monthName}</p>
                            </div>
                        </div>

                        <div class="calendar-wrapper">
                            <div id="dt-calendar-grid" class="macro-calendar-grid">
                                <!-- Calendar days injected here -->
                            </div>
                        </div>
                    </section>
                </main>

                <!-- Lateral Drawer (Cajón de Tareas) -->
                <div id="dt-drawer" class="drawer-overlay hidden">
                    <div class="drawer-content">
                        <div class="drawer-header">
                            <div class="drawer-title-group">
                                <h3 id="drawer-date-title">Detalle del Día</h3>
                                <p id="drawer-methodology-label" class="methodology-badge"></p>
                            </div>
                            <button class="btn-close" onclick="DTEngine.closeDrawer()">✕</button>
                        </div>
                        <div class="drawer-controls">
                            <button id="btn-toggle-md" class="btn-primary-dt" onclick="DTEngine.toggleMatchDayCurrent()">Fijar Partido (MD)</button>
                            <button class="btn-secondary" onclick="DTEngine.toggleRestCurrent()">Descanso</button>
                        </div>
                        <div class="drawer-body">
                            <div class="library-header">
                                <h4>Biblioteca de Tareas</h4>
                                <button id="btn-filter-toggle" class="btn-text" onclick="DTEngine.toggleFilter()">Ver Toda</button>
                            </div>
                            <div id="library-list" class="exercise-list-container">
                                <!-- Exercises filtered by phase -->
                            </div>
                        </div>
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
                console.log('✅ Biblioteca Sincronizada');
            }
        } catch (e) { console.error("Error fetching library:", e); }
    },

    toggleMatchDayCurrent() {
        if (!this._selectedDate) return;
        if (this._matchDays.has(this._selectedDate)) {
            this._matchDays.delete(this._selectedDate);
        } else {
            this._matchDays.add(this._selectedDate);
            this._restDays.delete(this._selectedDate);
        }
        this.generateCalendar();
        this.updateDrawerUI();
    },

    toggleRestCurrent() {
        if (!this._selectedDate) return;
        if (this._restDays.has(this._selectedDate)) {
            this._restDays.delete(this._selectedDate);
        } else {
            this._restDays.add(this._selectedDate);
            this._matchDays.delete(this._selectedDate);
        }
        this.generateCalendar();
        this.updateDrawerUI();
    },

    updateDrawerUI() {
        const label = this.getMethodologyLabel(this._selectedDate);
        document.getElementById('drawer-methodology-label').innerText = label;
        
        const btnMD = document.getElementById('btn-toggle-md');
        if (this._matchDays.has(this._selectedDate)) {
            btnMD.innerText = 'Quitar Partido';
            btnMD.classList.add('active');
        } else {
            btnMD.innerText = 'Fijar Partido (MD)';
            btnMD.classList.remove('active');
        }
        this.renderLibrary();
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
        ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(n => html += `<div class="macro-day-header">${n}</div>`);

        for (let i = 0; i < startOffset; i++) html += `<div class="macro-day empty"></div>`;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const label = this.getMethodologyLabel(dateStr);
            const typeClass = this.getTypeClass(label);
            
            // Renderizar micro-tareas asignadas
            const tasks = this._assignedTasks[dateStr] || [];
            const tasksHtml = tasks.map(id => {
                const ex = this._exercises.find(e => e.numericId === id);
                return ex ? `<div class="mini-task-pill">${ex.title}</div>` : '';
            }).join('');

            html += `
                <div class="macro-day ${typeClass}" onclick="DTEngine.openDrawer('${dateStr}')">
                    <div class="m-day-top">
                        <span class="m-day-num">${d}</span>
                        <span class="m-day-label">${label}</span>
                    </div>
                    <div class="m-day-content">
                        <div class="assigned-tasks-list">${tasksHtml}</div>
                    </div>
                </div>
            `;
        }
        grid.innerHTML = html;
    },

    getMethodologyLabel(dateStr) {
        if (this._restDays.has(dateStr)) return 'DESCANSO';
        if (this._matchDays.has(dateStr)) return 'PARTIDO (MD)';

        const current = new Date(dateStr + 'T00:00:00');
        let nextMD = null;
        let diffDays = 0;

        for (let i = 1; i <= 7; i++) {
            const future = new Date(current);
            future.setDate(current.getDate() + i);
            const futureStr = future.toISOString().split('T')[0];
            if (this._matchDays.has(futureStr)) {
                nextMD = future;
                diffDays = i;
                break;
            }
        }

        if (nextMD) {
            if (diffDays === 1) return 'MD-1 (ACTIVACIÓN)';
            if (diffDays === 2) return 'MD-2 (VELOCIDAD)';
            if (diffDays === 3) return 'MD-3 (DURACIÓN)';
            if (diffDays === 4) return 'MD-4 (TENSIÓN)';
        }

        const yesterday = new Date(current);
        yesterday.setDate(current.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        if (this._matchDays.has(yesterdayStr)) return 'RECUPERACIÓN (MD+1)';

        return 'ENTRENAMIENTO BASE';
    },

    getTypeClass(label) {
        if (label.includes('PARTIDO')) return 'type-partido';
        if (label.includes('TENSIÓN')) return 'type-tension';
        if (label.includes('DURACIÓN')) return 'type-duracion';
        if (label.includes('VELOCIDAD')) return 'type-velocidad';
        if (label.includes('ACTIVACIÓN')) return 'type-activacion';
        if (label.includes('RECUPERACIÓN')) return 'type-recuperacion';
        if (label.includes('DESCANSO')) return 'type-descanso';
        return '';
    },

    openDrawer(date) {
        this._selectedDate = date;
        this._showAllExercises = false;
        document.getElementById('drawer-date-title').innerText = date;
        this.updateDrawerUI();
        document.getElementById('dt-drawer').classList.remove('hidden');
    },

    closeDrawer() {
        document.getElementById('dt-drawer').classList.add('hidden');
    },

    toggleFilter() {
        this._showAllExercises = !this._showAllExercises;
        const btn = document.getElementById('btn-filter-toggle');
        btn.innerText = this._showAllExercises ? 'Ver Sugeridos' : 'Ver Toda';
        this.renderLibrary();
    },

    renderLibrary() {
        const container = document.getElementById('library-list');
        if (!this._exercises.length) {
            container.innerHTML = '<p class="loading-text">Conectando...</p>';
            return;
        }

        const label = this.getMethodologyLabel(this._selectedDate);
        const phaseMatch = label.match(/MD[-+]\d/);
        const currentPhase = phaseMatch ? phaseMatch[0] : null;

        let filtered = this._exercises;
        if (!this._showAllExercises && currentPhase) {
            filtered = this._exercises.filter(ex => ex.morfociclo_phase === currentPhase);
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No hay tareas específicas para ${currentPhase || 'esta fase'}.</p>
                    <button class="btn-secondary" onclick="DTEngine.toggleFilter()">Ver toda la biblioteca</button>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(ex => `
            <div class="exercise-card" onclick="DTEngine.assignExercise(${ex.numericId})">
                <div class="ex-info">
                    <span class="ex-id">#${ex.numericId}</span>
                    <h5 class="ex-title">${ex.title}</h5>
                    <p class="ex-meta">${ex.game_moment} | ${ex.ssp_type}</p>
                </div>
                <div class="ex-add-btn">+</div>
            </div>
        `).join('');
    },

    assignExercise(numericId) {
        if (!this._assignedTasks[this._selectedDate]) {
            this._assignedTasks[this._selectedDate] = [];
        }
        // Multi-asignación (Regla Fase 3.5)
        this._assignedTasks[this._selectedDate].push(numericId);
        
        console.log(`Asignado: ${numericId} en ${this._selectedDate}`);
        this.generateCalendar(); // Refrescar celdas
    }
};
