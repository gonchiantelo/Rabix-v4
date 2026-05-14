/* =========================================
   MUNDO ATLETA - PLAYER ENGINE (Cometti)
========================================= */

window.PlayerEngine = {
    init: function() {
        document.body.classList.add('testing-athlete');

        // Forzar ocultamiento de todo y mostrar Atletas
        document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');

        const view = document.getElementById('view-athletes');
        if (view) {
            view.style.display = 'block';
            this.render();
        }
    },

    render: function() {
        const grid = document.getElementById('athlete-grid');
        if (!grid) return;

        grid.innerHTML = `
            <div class="athlete-card">
                <h3 style="font-family:Outfit; margin:0;">MATEO FERNÁNDEZ</h3>
                <p style="color:#bf953f; font-weight:900; font-size:12px;">FÚTBOL | PIVOTE</p>
                <hr style="opacity:0.1; margin:10px 0;">
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; font-size:10px; font-weight:bold;">
                    <div>ESTRUCTURA<br><span style="color:#666;">78kg / 1.81m</span></div>
                    <div>NERVIOSO<br><span style="color:#666;">CMJ: 52cm</span></div>
                    <div>BIOMEC.<br><span style="color:#666;">VO2: 62</span></div>
                </div>
            </div>
            <div class="athlete-card">
                <h3 style="font-family:Outfit; margin:0;">LUCAS ROMERO</h3>
                <p style="color:#bf953f; font-weight:900; font-size:12px;">NATACIÓN | LIBRE</p>
                <hr style="opacity:0.1; margin:10px 0;">
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; font-size:10px; font-weight:bold;">
                    <div>ESTRUCTURA<br><span style="color:#666;">74kg / 1.85m</span></div>
                    <div>NERVIOSO<br><span style="color:#666;">RSI: 2.6</span></div>
                    <div>BIOMEC.<br><span style="color:#666;">VO2: 71</span></div>
                </div>
            </div>
        `;
    }
};

// Auto-init al cargar el DOM
document.addEventListener('DOMContentLoaded', function() {
    window.PlayerEngine.init();
});
