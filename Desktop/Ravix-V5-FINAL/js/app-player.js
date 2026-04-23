'use strict';

/* ============================================================
   RAVIX V5 — PLAYER ENGINE (app-player.js)
   Accessibility · Quick Post-Training Logs
   ============================================================ */

window.PlayerEngine = {
    async init() {
        console.log("Mundo Jugador Iniciado");
        this.renderDashboard();
    },

    renderDashboard() {
        const shell = document.getElementById('app-shell');
        if (!shell) return;

        shell.innerHTML = `
            <div class="player-container">
                <header class="player-header">
                    <h1>HOLA, JUGADOR</h1>
                    <button onclick="App.logout()" class="btn-logout">SALIR</button>
                </header>
                <main class="player-main">
                    <p>Próximamente: Registro de Carga y Wellness</p>
                </main>
            </div>
        `;
    }
};
