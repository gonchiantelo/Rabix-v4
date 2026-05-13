'use strict';

/* ============================================================
   RAVIX V5 — ATHLETE ENGINE (app-player.js)
   Mundo Atleta · Laboratorio de Rendimiento Polideportivo
   Principios Biomecánicos Cometti (Estructural / Neuromuscular / Biomecánico)
   ============================================================ */

window.PlayerEngine = {

    /* ── SAMPLE DATA (3 athletes — multi-sport demo) ── */
    _athletes: [
        {
            id: 'ATH-001',
            name: 'Mateo Fernández',
            number: 10,
            sport: 'FÚTBOL',
            role: 'Pivote Ofensivo',
            emoji: '⚽',
            statusClass: 'available',
            // Cometti Pillars
            structural: { weight: '78 kg', height: '1.81 m', imc: '23.8' },
            neuromuscular: { squat1rm: '140 kg', cmjHeight: '52 cm' },
            biomechanical: { flexibility: '++', plyo: 'Alto' },
            // Secondary metrics
            vo2max: '62', sprint10m: '1.68"', agilityT: '9.1"',
            // Recovery
            recovery: 88, recoveryClass: 'optimal', recoveryNote: 'Disponibilidad Sistémica Óptima'
        },
        {
            id: 'ATH-002',
            name: 'Valentina Cruz',
            number: 4,
            sport: 'NATACIÓN',
            role: '100m Estilo Libre',
            emoji: '🏊',
            statusClass: 'caution',
            structural: { weight: '62 kg', height: '1.73 m', imc: '20.7' },
            neuromuscular: { squat1rm: '90 kg', cmjHeight: '38 cm' },
            biomechanical: { flexibility: '+++', plyo: 'Medio' },
            vo2max: '58', sprint10m: '—', agilityT: '—',
            recovery: 64, recoveryClass: 'caution', recoveryNote: 'Carga Acumulada Alta — Monitoreo'
        },
        {
            id: 'ATH-003',
            name: 'Kenji Yamamoto',
            number: 1,
            sport: 'JUDO',
            role: 'Categoria -81 kg',
            emoji: '🥋',
            statusClass: 'available',
            structural: { weight: '80 kg', height: '1.76 m', imc: '25.8' },
            neuromuscular: { squat1rm: '165 kg', cmjHeight: '48 cm' },
            biomechanical: { flexibility: '+', plyo: 'Alto' },
            vo2max: '56', sprint10m: '1.74"', agilityT: '8.6"',
            recovery: 95, recoveryClass: 'optimal', recoveryNote: 'Condición de Competencia'
        }
    ],

    async init() {
        console.log('🏋️ Laboratorio de Rendimiento iniciado.');
        this._injectCSS();
        this.renderDashboard();
    },

    _injectCSS() {
        if (document.getElementById('athletes-css')) return;
        const link = document.createElement('link');
        link.id = 'athletes-css';
        link.rel = 'stylesheet';
        link.href = 'css/styles-athletes.css';
        document.head.appendChild(link);
    },

    renderDashboard() {
        const shell = document.getElementById('app-shell');
        if (!shell) return;

        const total = this._athletes.length;
        const available = this._athletes.filter(a => a.recoveryClass === 'optimal').length;
        const caution  = this._athletes.filter(a => a.recoveryClass === 'caution').length;
        const avgRecovery = Math.round(this._athletes.reduce((s, a) => s + a.recovery, 0) / total);

        shell.innerHTML = `
<div class="athlete-world">

    <!-- ══ HEADER ══ -->
    <header class="aw-header">
        <div class="aw-brand">
            <span class="aw-brand-name">RAVIX V5</span>
            <span class="aw-brand-badge">ATHLETE LAB</span>
        </div>
        <nav class="aw-nav">
            <button class="aw-nav-btn active" id="aw-btn-lab">🔬 Laboratorio</button>
            <button class="aw-nav-btn" id="aw-btn-load" onclick="PlayerEngine._showComingSoon('Carga de Entrenamiento')">📈 Carga</button>
            <button class="aw-nav-btn" id="aw-btn-wellness" onclick="PlayerEngine._showComingSoon('Wellness Diario')">💊 Wellness</button>
            <button class="aw-nav-btn" id="aw-btn-plan" onclick="PlayerEngine._showComingSoon('Plan Individual')">📋 Plan</button>
        </nav>
        <button class="aw-logout-btn" onclick="App.logout()">Salir →</button>
    </header>

    <!-- ══ MAIN CONTENT ══ -->
    <main class="aw-main">

        <!-- Hero -->
        <div class="aw-page-hero">
            <p class="aw-hero-eyebrow">Sistema Polideportivo · Principios Cometti</p>
            <h1 class="aw-hero-title">LABORATORIO DE RENDIMIENTO</h1>
            <p class="aw-hero-subtitle">Evaluación Estructural · Neuromuscular · Biomecánica — Visión clínica del atleta.</p>
        </div>

        <!-- Stats Bar -->
        <div class="aw-stats-bar">
            <div class="aw-stat-pill">
                <span class="aw-stat-icon">👥</span>
                <div>
                    <div class="aw-stat-value">${total}</div>
                    <div class="aw-stat-label">Atletas Activos</div>
                </div>
            </div>
            <div class="aw-stat-pill">
                <span class="aw-stat-icon" style="color:#10b981;">✅</span>
                <div>
                    <div class="aw-stat-value" style="color:#10b981;">${available}</div>
                    <div class="aw-stat-label">Disponibles</div>
                </div>
            </div>
            <div class="aw-stat-pill">
                <span class="aw-stat-icon" style="color:#f59e0b;">⚠️</span>
                <div>
                    <div class="aw-stat-value" style="color:#f59e0b;">${caution}</div>
                    <div class="aw-stat-label">En Monitoreo</div>
                </div>
            </div>
            <div class="aw-stat-pill">
                <span class="aw-stat-icon">⚡</span>
                <div>
                    <div class="aw-stat-value">${avgRecovery}<span style="font-size:0.8rem;">%</span></div>
                    <div class="aw-stat-label">Recuperación Media</div>
                </div>
            </div>
        </div>

        <!-- Section Label -->
        <div class="aw-section-title">Fichas de Laboratorio</div>

        <!-- ══ ATHLETE GRID ══ -->
        <div class="aw-grid">
            ${this._athletes.map(a => this._buildCard(a)).join('')}
        </div>

        <!-- Add Button -->
        <div style="margin-top:32px;text-align:center;">
            <button onclick="PlayerEngine._showComingSoon('Nuevo Atleta')" style="padding:14px 36px;border-radius:12px;border:2px dashed #d4af37;background:rgba(212,175,55,0.04);color:#b38728;font-family:Outfit,sans-serif;font-size:0.85rem;font-weight:800;cursor:pointer;letter-spacing:0.5px;transition:all 0.2s;">
                + REGISTRAR NUEVO ATLETA
            </button>
        </div>

    </main>
</div>`;
    },

    _buildCard(a) {
        const recoveryPct = Math.min(100, Math.max(0, a.recovery));
        return `
<div class="aw-card" onclick="PlayerEngine._openAthlete('${a.id}')">

    <!-- Card Header -->
    <div class="aw-card-header">
        <div class="aw-avatar-wrap">
            <div class="aw-avatar-placeholder">${a.emoji}</div>
            <span class="aw-status-dot ${a.statusClass}"></span>
        </div>
        <div class="aw-card-identity">
            <div class="aw-athlete-name">${a.name}</div>
            <div class="aw-sport-badge">${a.sport} | ${a.role}</div>
        </div>
        <div class="aw-card-number">${a.number}</div>
    </div>

    <!-- Cometti Pillars -->
    <div class="aw-pillars">
        <div class="aw-pillar">
            <div class="aw-pillar-icon">🦴</div>
            <div class="aw-pillar-label">Estructural</div>
            <div class="aw-pillar-value">${a.structural.weight}</div>
            <div class="aw-pillar-sub">${a.structural.height} · IMC ${a.structural.imc}</div>
        </div>
        <div class="aw-pillar" style="border-left:1px solid #f0f4f8;border-right:1px solid #f0f4f8;">
            <div class="aw-pillar-icon">⚡</div>
            <div class="aw-pillar-label">Neuromuscular</div>
            <div class="aw-pillar-value">${a.neuromuscular.squat1rm}</div>
            <div class="aw-pillar-sub">Squat 1RM · CMJ ${a.neuromuscular.cmjHeight}</div>
        </div>
        <div class="aw-pillar">
            <div class="aw-pillar-icon">🤸</div>
            <div class="aw-pillar-label">Biomecánico</div>
            <div class="aw-pillar-value">${a.biomechanical.plyo}</div>
            <div class="aw-pillar-sub">Pliometría · Flex ${a.biomechanical.flexibility}</div>
        </div>
    </div>

    <!-- Secondary Metrics -->
    <div class="aw-metrics">
        <div class="aw-metric">
            <div class="aw-metric-val">${a.vo2max}</div>
            <div class="aw-metric-lbl">VO₂ Máx</div>
        </div>
        <div class="aw-metric">
            <div class="aw-metric-val">${a.sprint10m}</div>
            <div class="aw-metric-lbl">Sprint 10m</div>
        </div>
        <div class="aw-metric">
            <div class="aw-metric-val">${a.agilityT}</div>
            <div class="aw-metric-lbl">Agilidad T</div>
        </div>
    </div>

    <!-- Fatigue Motor -->
    <div class="aw-card-footer">
        <div class="aw-recovery-header">
            <span class="aw-recovery-label">Disponibilidad Sistémica</span>
            <span class="aw-recovery-pct ${a.recoveryClass}">${recoveryPct}% ${a.recoveryClass === 'optimal' ? '· Óptimo' : a.recoveryClass === 'caution' ? '· Monitoreo' : '· Alerta'}</span>
        </div>
        <div class="aw-recovery-bar-wrap">
            <div class="aw-recovery-bar ${a.recoveryClass}" style="width:${recoveryPct}%;"></div>
        </div>
        <div class="aw-recovery-note">${a.recoveryNote}</div>
    </div>

</div>`;
    },

    _openAthlete(id) {
        this._showComingSoon('Ficha Completa del Atleta (Fase 2)');
    },

    _showComingSoon(feature) {
        // Minimal inline toast
        const existing = document.getElementById('aw-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.id = 'aw-toast';
        toast.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:14px 28px;border-radius:12px;font-family:Outfit,sans-serif;font-size:0.85rem;font-weight:700;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.2);letter-spacing:0.3px;';
        toast.innerHTML = '🚧 <strong>' + feature + '</strong> — Próximamente en Fase 2';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2800);
    }
};
