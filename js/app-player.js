/*
    MUNDO ATLETA - PLAYER ENGINE (Cometti)
    Sin mockData — datos reales desde Supabase o estado vacío.
*/

window.PlayerEngine = {

    init: function() {
        // Mostrar la vista de atletas
        document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
        const view = document.getElementById('view-athletes');
        if (view) {
            view.style.display = 'block';
            this.loadAthletes();
        }
    },

    loadAthletes: async function() {
        const uid   = localStorage.getItem('ravix_v5_uid');
        const token = localStorage.getItem('ravix_token');
        const grid  = document.getElementById('athlete-grid');
        if (!grid) return;

        grid.innerHTML = '<p class="aw-empty-state">Cargando atletas...</p>';

        try {
            const r = await fetch(
                `${window.SUPABASE_URL}/rest/v1/profiles_athlete?coach_id=eq.${uid}&order=created_at.desc`,
                { headers: { 'apikey': window.SUPABASE_KEY, 'Authorization': `Bearer ${token}` } }
            );
            const athletes = await r.json();

            if (!r.ok || !Array.isArray(athletes) || athletes.length === 0) {
                grid.innerHTML = `
                    <div class="aw-empty-state">
                        <div class="aw-empty-icon">🏅</div>
                        <h3>Sin atletas registrados</h3>
                        <p>Los atletas aparecerán aquí una vez que completen su registro.</p>
                    </div>`;
                return;
            }

            this.render(athletes);
        } catch (e) {
            console.error('🔴 PlayerEngine.loadAthletes:', e);
            grid.innerHTML = `<div class="aw-empty-state"><p>Error al cargar atletas.</p></div>`;
        }
    },

    render: function(athletes) {
        const grid = document.getElementById('athlete-grid');
        if (!grid) return;

        grid.innerHTML = athletes.map(a => `
            <div class="athlete-card">
                <h3 style="font-family:Outfit; margin:0; font-size:1.1rem;">${a.full_name || 'Atleta'}</h3>
                <p style="color:#bf953f; font-weight:900; font-size:11px; margin-top:4px; letter-spacing:1px;">
                    ${(a.sport || '—').toUpperCase()} ${a.position ? '| ' + a.position.toUpperCase() : ''}
                </p>
                <hr style="opacity:0.1; margin:12px 0;">
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; font-size:10px; font-weight:700; color:#999;">
                    <div>
                        ESTRUCTURA<br>
                        <span style="color:#1a1a2e; font-size:13px; font-weight:800;">
                            ${a.weight_kg ? a.weight_kg + 'kg' : '—'} / ${a.height_cm ? a.height_cm + 'cm' : '—'}
                        </span>
                    </div>
                    <div>
                        OBJETIVO<br>
                        <span style="color:#1a1a2e; font-size:12px; font-weight:800;">${a.goal || '—'}</span>
                    </div>
                    <div>
                        NACIMIENTO<br>
                        <span style="color:#1a1a2e; font-size:12px; font-weight:800;">${a.birth_date || '—'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
};
