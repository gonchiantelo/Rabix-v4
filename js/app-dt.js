'use strict';

/* ============================================================
   RAVIX V5 — DT ENGINE (app-dt.js)
   Phase 3: Tactical Brain & Dynamic Periodization
   ============================================================ */

window.DTEngine = {
    _currentDate: new Date(),
    _matchDayOfWeek: 6, // Default: Sábado (6 en escala 0=L, 6=D) -> Usaremos 0=Lunes, 6=Domingo para facilitar
    _restDays: new Set(),
    _exercises: [],
    _selectedDate: null,

    async renderDashboard() {
        const shell = document.getElementById('app-shell');
        if (!shell) return;

        const monthName = this._currentDate.toLocaleString('es', { month: 'long', year: 'numeric' }).toUpperCase();

        shell.innerHTML = `
            <div class="dt-shell-container">
                <header class="app-header">
                    <div class="brand-name">RAVIX <span class="dt-badge">DT ELITE</span></div>
                    <div class="header-actions">
                        <div class="md-selector-group">
                            <label>Día de Partido:</label>
                            <select id="md-select" onchange="DTEngine.setMatchDay(this.value)">
                                <option value="0">Lunes</option>
                                <option value="1">Martes</option>
                                <option value="2">Miércoles</option>
                                <option value="3">Jueves</option>
                                <option value="4">Viernes</option>
                                <option value="5">Sábado</option>
                                <option value="6" selected>Domingo</option>
                            </select>
                        </div>
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
                            <button class="btn-secondary" onclick="DTEngine.toggleRestCurrent()">Marcar como Descanso</button>
                        </div>
                        <div class="drawer-body">
                            <h4>Biblioteca de Tareas</h4>
                            <div id="library-list" class="exercise-list-container">
                                <p class="loading-text">Cargando biblioteca...</p>
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
            const data = await Supa._req('GET', 'exercises_library');
            if (data) {
                this._exercises = data.map(ex => ({
                    ...ex,
                    // Regla Fase 3: IDs Estrictamente Numéricos
                    numericId: parseInt(ex.id.replace(/\D/g, '')) || Date.now()
                }));
            }
        } catch (e) { console.error("Error fetching library:", e); }
    },

    setMatchDay(val) {
        this._matchDayOfWeek = parseInt(val);
        this.generateCalendar();
    },

    toggleRestCurrent() {
        if (!this._selectedDate) return;
        if (this._restDays.has(this._selectedDate)) {
            this._restDays.delete(this._selectedDate);
        } else {
            this._restDays.add(this._selectedDate);
        }
        this.generateCalendar();
        this.updateDrawerLabel();
    },

    updateDrawerLabel() {
        const label = this.getMethodologyLabel(this._selectedDate);
        document.getElementById('drawer-methodology-label').innerText = label;
    },

    generateCalendar() {
        const grid = document.getElementById('dt-calendar-grid');
        if (!grid) return;

        const year = this._currentDate.getFullYear();
        const month = this._currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Offset (Lunes=0)
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;

        let html = '';
        ['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach(n => html += `<div class="macro-day-header">${n}</div>`);

        for (let i = 0; i < startOffset; i++) html += `<div class="macro-day empty"></div>`;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const label = this.getMethodologyLabel(dateStr);
            const typeClass = this.getTypeClass(label);

            html += `
                <div class="macro-day ${typeClass}" onclick="DTEngine.openDrawer('${dateStr}')">
                    <div class="m-day-top">
                        <span class="m-day-num">${d}</span>
                    </div>
                    <div class="m-day-bottom">
                        <span class="m-day-label">${label}</span>
                    </div>
                </div>
            `;
        }
        grid.innerHTML = html;
    },

    getMethodologyLabel(dateStr) {
        if (this._restDays.has(dateStr)) return 'DESCANSO';

        const date = new Date(dateStr + 'T00:00:00');
        const dayOfWeek = date.getDay() === 0 ? 6 : date.getDay() - 1; // 0=L, 6=D

        // Calcular distancia al Día de Partido
        let diff = dayOfWeek - this._matchDayOfWeek;
        
        if (diff === 0) return 'PARTIDO (MD)';
        if (diff === 1 || diff === -6) return 'RECUPERACIÓN (MD+1)';
        
        // Mapeo dinámico de microciclo
        const cycle = {
            '-1': 'MD-1 (ACTIVACIÓN)',
            '-2': 'MD-2 (VELOCIDAD)',
            '-3': 'MD-3 (DURACIÓN)',
            '-4': 'MD-4 (TENSIÓN)',
            '6': 'MD-1 (ACTIVACIÓN)',
            '5': 'MD-2 (VELOCIDAD)',
            '4': 'MD-3 (DURACIÓN)',
            '3': 'MD-4 (TENSIÓN)'
        };

        const key = diff.toString();
        return cycle[key] || 'PREPARACIÓN';
    },

    getTypeClass(label) {
        if (label.includes('PARTIDO')) return 'type-partido';
        if (label.includes('TENSIÓN')) return 'type-tension';
        if (label.includes('DURACIÓN')) return 'type-duracion';
        if (label.includes('VELOCIDAD')) return 'type-velocidad';
        if (label.includes('ACTIVACIÓN')) return 'type-activacion';
        if (label.includes('DESCANSO')) return 'type-descanso';
        return '';
    },

    openDrawer(date) {
        this._selectedDate = date;
        document.getElementById('drawer-date-title').innerText = date;
        this.updateDrawerLabel();
        document.getElementById('dt-drawer').classList.remove('hidden');
        this.renderLibrary();
    },

    closeDrawer() {
        document.getElementById('dt-drawer').classList.add('hidden');
    },

    renderLibrary() {
        const container = document.getElementById('library-list');
        if (!this._exercises.length) {
            container.innerHTML = '<p class="error-text">No se encontraron ejercicios.</p>';
            return;
        }

        container.innerHTML = this._exercises.map(ex => `
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
        console.log(`Asignando ejercicio ID numérico: ${numericId} para el día ${this._selectedDate}`);
        // Lógica de guardado en Supabase (Próxima Fase o según necesidad)
        alert(`Ejercicio ${numericId} asignado al ${this._selectedDate}`);
    }
};
