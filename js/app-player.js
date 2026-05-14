/* =========================================
   MUNDO ATLETA - PLAYER ENGINE
========================================= */

window.PlayerEngine = {
    mockData: [
        {
            id: 1,
            name: "Kevin De Bruyne",
            sport: "Fútbol - Mediocampista",
            avatar: "⚽",
            structural: { weight: 76, height: 181, fat: 9.5 },
            neuromuscular: { rsi: 2.8, cmj: 45 },
            fatigue: 85 // Motor de disponibilidad
        },
        {
            id: 2,
            name: "Adam Peaty",
            sport: "Natación - Pecho",
            avatar: "🏊‍♂️",
            structural: { weight: 86, height: 191, fat: 8.0 },
            neuromuscular: { rsi: 2.1, cmj: 52 },
            fatigue: 92
        }
    ],

    init: function() {
        console.log("PlayerEngine Init - Mundo Atleta listo");
        this.renderAthletes();
    },

    renderAthletes: function() {
        const grid = document.getElementById('athletes-grid');
        if (!grid) return;

        grid.innerHTML = '';

        this.mockData.forEach(athlete => {
            const card = document.createElement('div');
            card.className = 'aw-card';
            
            card.innerHTML = `
                <div class="aw-card-header">
                    <div class="aw-avatar">${athlete.avatar}</div>
                    <div class="aw-info">
                        <h2>${athlete.name}</h2>
                        <p>${athlete.sport}</p>
                    </div>
                </div>

                <div class="aw-pillars">
                    <div class="aw-pillar">
                        <div class="aw-pillar-title">Estructural</div>
                        <div class="aw-pillar-value">${athlete.structural.weight} <span class="aw-pillar-unit">kg</span></div>
                        <div class="aw-pillar-value" style="font-size:14px; color:#666; margin-top:5px;">Adiposidad: ${athlete.structural.fat}%</div>
                    </div>
                    <div class="aw-pillar">
                        <div class="aw-pillar-title">Neuromuscular</div>
                        <div class="aw-pillar-value">${athlete.neuromuscular.cmj} <span class="aw-pillar-unit">cm CMJ</span></div>
                        <div class="aw-pillar-value" style="font-size:14px; color:#666; margin-top:5px;">RSI: ${athlete.neuromuscular.rsi}</div>
                    </div>
                </div>

                <div class="aw-fatigue">
                    <div class="aw-fatigue-header">
                        <span class="aw-fatigue-title">Disponibilidad (Motor)</span>
                        <span class="aw-fatigue-percent">${athlete.fatigue}%</span>
                    </div>
                    <div class="aw-progress-bar">
                        <div class="aw-progress-fill" style="width: ${athlete.fatigue}%"></div>
                    </div>
                </div>
            `;
            
            grid.appendChild(card);
        });
    }
};

// Auto-init si la vista está activa, o exponerlo para que el App core lo inicialice.
document.addEventListener('DOMContentLoaded', () => {
    // Si la vista no está oculta al cargar, renderizamos. 
    // Aunque el router principal debería manejar esto, lo dejamos listo.
    window.PlayerEngine.init();
});
