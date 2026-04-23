'use strict';

/* ============================================================
   RAVIX V5 — DT ENGINE (app-dt.js)
   Elite Deep UI/UX — Monthly Planning
   ============================================================ */

window.DTEngine = {
    _currentDate: new Date(),
    _methodologyLabels: {
        0: 'DESCANSO',
        1: 'RECUPERACIÓN (MD+1)',
        2: 'MD-4 (TENSIÓN)',
        3: 'MD-3 (DURACIÓN)',
        4: 'MD-2 (VELOCIDAD)',
        5: 'MD-1 (ACTIVACIÓN)',
        6: 'PARTIDO (MD)'
    },

    renderDashboard() {
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

                <!-- Lateral Drawer (Cajón) -->
                <div id="dt-drawer" class="drawer-overlay hidden">
                    <div class="drawer-content">
                        <div class="drawer-header">
                            <div class="drawer-title-group">
                                <h3 id="drawer-date-title">Detalle del Día</h3>
                                <p id="drawer-methodology-label" class="methodology-badge">Cargando...</p>
                            </div>
                            <button class="btn-close" onclick="DTEngine.closeDrawer()">✕</button>
                        </div>
                        <div class="drawer-body">
                            <p class="drawer-placeholder">Biblioteca de Tareas próximamente...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.generateCalendar();
    },

    generateCalendar() {
        const grid = document.getElementById('dt-calendar-grid');
        if (!grid) return;

        const year = this._currentDate.getFullYear();
        const month = this._currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Offset para Lunes (0=Domingo -> 6, 1=Lunes -> 0...)
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;

        let html = '';
        const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        dayNames.forEach(name => html += `<div class="macro-day-header">${name}</div>`);

        for (let i = 0; i < startOffset; i++) {
            html += `<div class="macro-day empty"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOfWeek = (startOffset + d - 1) % 7;
            const label = this._methodologyLabels[dayOfWeek] || '';
            const typeClass = this.getTypeClass(label);

            html += `
                <div class="macro-day ${typeClass}" onclick="DTEngine.openDrawer('${dateStr}', '${label}')">
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

    getTypeClass(label) {
        if (label.includes('PARTIDO')) return 'type-partido';
        if (label.includes('TENSIÓN')) return 'type-tension';
        if (label.includes('DURACIÓN')) return 'type-duracion';
        if (label.includes('VELOCIDAD')) return 'type-velocidad';
        if (label.includes('ACTIVACIÓN')) return 'type-activacion';
        if (label.includes('DESCANSO')) return 'type-descanso';
        return '';
    },

    openDrawer(date, label) {
        document.getElementById('drawer-date-title').innerText = date;
        document.getElementById('drawer-methodology-label').innerText = label;
        document.getElementById('dt-drawer').classList.remove('hidden');
    },

    closeDrawer() {
        document.getElementById('dt-drawer').classList.add('hidden');
    }
};

// Auto-init for testing or if manually injected
if (window.DTEngine && document.getElementById('app-shell')) {
    // Note: In a real flow, app-core.js calls this after injection
}
