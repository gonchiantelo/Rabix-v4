/*
    RAVIX V5 — APP-PLAYER.JS
    ─────────────────────────────────────────────────────────────
    ARCHIVO COMPLETAMENTE AISLADO DEL DT.

    CONTIENE:
      1. PlayerEngine    → Vista del DT: lista de atletas del equipo
                           (vive dentro del #app-shell del DT, NO toca el #player-shell)

      2. PlayerShellEngine → Motor exclusivo del Jugador.
                             Construye y gestiona el #player-shell (Mobile-First).
                             Lee de: team_roster, player_wellness, player_attendance.
                             JAMÁS inyecta HTML en vistas tácticas del DT.
    ─────────────────────────────────────────────────────────────
*/

/* ══════════════════════════════════════════════════════════
   1. PLAYER ENGINE — Vista del DT (lista de atletas)
      Vive dentro del #app-shell del DT.
      No importa ninguna clase del entorno jugador.
══════════════════════════════════════════════════════════ */
window.PlayerEngine = {
    init: function () {
        // Si el rol activo es jugador, redirigir al motor correcto
        if (window.App && (window.App.currentRole === 'jugador' || window.App.currentRole === 'player')) {
            if (window.PlayerShellEngine) window.PlayerShellEngine.boot();
            return;
        }

        // Ruta DT: mostrar la vista de atletas dentro del app-shell
        const targetId = 'view-athletes';
        const target = document.getElementById(targetId);
        if (!target) {
            console.error('[PLAYER ENGINE] Vista DT #' + targetId + ' no encontrada.');
            return;
        }

        document.querySelectorAll('.view-section').forEach(s => {
            if (s.id !== targetId) s.style.display = 'none';
        });
        target.style.display = 'block';
        this.loadAthletes();
    },

    loadAthletes: async function () {
        const uid  = localStorage.getItem('ravix_v5_uid');
        const grid = document.getElementById('athlete-grid');
        if (!grid) return;

        grid.innerHTML = '<p class="aw-empty-state">Cargando atletas...</p>';
        try {
            const { data: athletes, error } = await window.supabase
                .from('profiles_athlete')
                .select('*')
                .eq('coach_id', uid)
                .order('created_at', { ascending: false });

            if (error || !Array.isArray(athletes) || athletes.length === 0) {
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

    render: function (athletes) {
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
                    <div>ESTRUCTURA<br><span style="color:#1a1a2e; font-size:13px; font-weight:800;">${a.weight_kg ? a.weight_kg + 'kg' : '—'} / ${a.height_cm ? a.height_cm + 'cm' : '—'}</span></div>
                    <div>OBJETIVO<br><span style="color:#1a1a2e; font-size:12px; font-weight:800;">${a.goal || '—'}</span></div>
                    <div>NACIMIENTO<br><span style="color:#1a1a2e; font-size:12px; font-weight:800;">${a.birth_date || '—'}</span></div>
                </div>
            </div>
        `).join('');
    }
};


/* ══════════════════════════════════════════════════════════
   2. PLAYER SHELL ENGINE — Motor exclusivo del Jugador
      Gestiona el #player-shell (Mobile-First).
      AISLADO: Jamás toca #app-shell ni vistas del DT.
      Tablas Supabase: team_roster, player_wellness, player_attendance
══════════════════════════════════════════════════════════ */
window.PlayerShellEngine = {

    state: {
        user: null,
        wellness: null,
        attendance: [],
        activeTab: 'home',
    },

    boot: function () {
        console.log('[PLAYER SHELL] Booting Mundo Atleta V6...');
        if (!document.querySelector('link[href="css/app-player.css"]')) {
            const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'css/app-player.css';
            document.head.appendChild(link);
        }

        let shell = document.getElementById('player-shell');
        if (!shell) {
            shell = this._buildShellDOM();
            document.body.appendChild(shell);
        } else if (!document.getElementById('ps-body')) {
            const newShell = this._buildShellDOM();
            shell.replaceWith(newShell);
            shell = newShell;
        }

        const dtAppShell = document.getElementById('app-shell');
        if (dtAppShell) { dtAppShell.style.display = 'none'; dtAppShell.setAttribute('aria-hidden', 'true'); }

        document.body.style.background = '#05080f';
        document.body.style.color = '#fff';

        const dtHub = document.getElementById('view-dt-hub');
        if (dtHub) dtHub.classList.remove('vista-activa');

        shell.style.cssText = 'display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: flex-start !important; min-height: 100vh !important; width: 100vw !important; opacity: 1 !important; visibility: visible !important; position: fixed !important; top: 0 !important; left: 0 !important; z-index: 999999 !important; background-color: #05080f !important;';
        shell.classList.add('ps-active');

        this._fetchPlayerData();
    },

    _buildShellDOM: function () {
        const shell = document.createElement('div');
        shell.id = 'player-shell';
        shell.setAttribute('role', 'main');
        
        shell.innerHTML = `
            <header class="ps-header" id="ps-header">
                <div class="ps-header-logo">RAVI<span>X</span></div>
                <div class="ps-header-right">
                    <div class="ps-header-add-btn" onclick="window.PlayerShellEngine._renderOnboardingView(true)">+</div>
                    <div class="ps-header-avatar" id="ps-player-avatar">👤</div>
                </div>
            </header>

            <div class="ps-body" id="ps-body">
                <div class="ps-boot" id="ps-boot-screen">
                    <div class="ps-boot-icon">⚡</div>
                    <h1 style="font-size: 1.5rem; font-weight: 900; margin-bottom: 8px;">Laboratorio Activo</h1>
                    <p style="color: var(--ps-muted); font-size: 0.85rem;" id="ps-boot-status">Sincronizando datos biométricos...</p>
                </div>
            </div>

            <nav class="ps-bottom-nav" id="ps-bottom-nav">
                <button class="ps-nav-btn active" id="ps-nav-home" onclick="window.PlayerShellEngine.switchTab('home', this)">
                    <span class="ps-nav-icon">⌂</span>
                    <span class="ps-nav-label">Inicio</span>
                </button>
                <button class="ps-nav-btn" id="ps-nav-wellness" onclick="window.PlayerShellEngine.switchTab('wellness', this)">
                    <span class="ps-nav-icon">🔋</span>
                    <span class="ps-nav-label">Wellness</span>
                </button>
                <button class="ps-nav-btn" id="ps-nav-attendance" onclick="window.PlayerShellEngine.switchTab('attendance', this)">
                    <span class="ps-nav-icon">📅</span>
                    <span class="ps-nav-label">Asistencia</span>
                </button>
            </nav>
        `;
        return shell;
    },

    _fetchPlayerData: async function () {
        const uid = localStorage.getItem('ravix_v5_uid');
        if (!uid) return;

        try {
            this._updateBootStatus('LEYENDO ROSTER...');
            const { data: rosterRows } = await window.supabase.from('team_roster').select('*').eq('player_id', uid).limit(1);
            const playerRow = rosterRows && rosterRows.length > 0 ? rosterRows[0] : null;

            if (!playerRow) {
                const skipFlag = localStorage.getItem('ravix_v5_skip_onboarding');
                if (skipFlag === 'true') {
                    this.state.user = null;
                    setTimeout(() => this._renderHomeView(), 600);
                    return;
                }
                const nav = document.getElementById('ps-bottom-nav');
                if (nav) nav.style.display = 'none';
                setTimeout(() => this._renderOnboardingView(false), 600);
                return;
            }

            this.state.user = playerRow;
            this._hydrateHeader(playerRow);

            this._updateBootStatus('CARGANDO WELLNESS...');
            const today = new Date().toISOString().split('T')[0];
            const { data: wellnessRows } = await window.supabase.from('player_wellness').select('*').eq('player_id', uid).eq('fecha', today).limit(1);
            if (wellnessRows && wellnessRows.length > 0) this.state.wellness = wellnessRows[0];

            this._updateBootStatus('MICROCICLO LISTO ✓');
            setTimeout(() => this._renderHomeView(), 600);

        } catch (err) {
            console.error(err);
            setTimeout(() => this._renderHomeView(), 1000);
        }
    },

    _hydrateHeader: function (playerRow) {
        const avatarEl = document.getElementById('ps-player-avatar');
        if (avatarEl) {
            const name = playerRow?.full_name || window.CurrentUser?.full_name || 'A';
            avatarEl.textContent = name.charAt(0).toUpperCase();
        }
    },

    _renderOnboardingView: function (isAddingExtraTeam = false) {
        const body = document.getElementById('ps-body');
        if (!body) return;
        
        body.innerHTML = `
            <div class="ps-onboarding-wrapper">
                <div class="ps-onboarding-icon">🛡️</div>
                <h2 class="ps-onboarding-title">VINCULACIÓN DE EQUIPO</h2>
                <p class="ps-onboarding-desc">Ingresa el código holográfico de tu DT.</p>
                
                <input type="text" id="onboarding-invite-code" class="ps-onboarding-input" placeholder="CÓDIGO">
                
                <button class="ps-btn-massive" id="onboarding-connect-btn" onclick="window.PlayerShellEngine._joinTeam(document.getElementById('onboarding-invite-code').value)">
                    CONECTAR
                </button>
                
                <button onclick="window.PlayerShellEngine._skipOnboarding()" style="margin-top:24px; background:transparent; border:none; color:var(--ps-muted); font-weight:800; letter-spacing:1px; cursor:pointer; text-transform:uppercase;">
                    ${isAddingExtraTeam ? 'Cancelar' : 'Continuar sin equipo'}
                </button>
            </div>
        `;
        
        const nav = document.getElementById('ps-bottom-nav');
        if (nav && !isAddingExtraTeam) nav.style.display = 'none';
    },

    _skipOnboarding: function () {
        localStorage.setItem('ravix_v5_skip_onboarding', 'true');
        const nav = document.getElementById('ps-bottom-nav');
        if (nav) nav.style.display = 'flex';
        this._renderHomeView();
    },

    _joinTeam: async function (code) {
        if (!code) return;
        const btn = document.getElementById('onboarding-connect-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'CONECTANDO...'; }

        try {
            const uid = localStorage.getItem('ravix_v5_uid');
            const upperCode = code.trim().toUpperCase();
            const { data: teamData, error: teamErr } = await window.supabase.from('teams').select('id').eq('invite_code', upperCode).limit(1);

            if (teamErr) throw teamErr;

            if (!teamData || teamData.length === 0) {
                if (btn) { btn.disabled = false; btn.textContent = 'CONECTAR'; }
                this._showToast('Código inválido');
                return;
            }

            const { error: insertErr } = await window.supabase.from('team_roster').insert([{ team_id: teamData[0].id, player_id: uid }]);
            if (insertErr) throw insertErr;

            this._showToast('¡Vinculado con éxito!');
            const nav = document.getElementById('ps-bottom-nav');
            if (nav) nav.style.display = 'flex';
            
            // Reload para garantizar que todos los contextos (incluyendo RLS) se refresquen y no haya bucle
            setTimeout(() => {
                window.location.reload();
            }, 800);
            
        } catch (err) {
            console.error('[ONBOARDING ERROR]', err);
            this._showToast('Error de vinculación');
            if (btn) { btn.disabled = false; btn.textContent = 'CONECTAR'; }
        }
    },

    _renderHomeView: function () {
        const body = document.getElementById('ps-body');
        if (!body) return;

        const player = this.state.user;
        const firstName = player?.full_name?.split(' ')[0] || 'Atleta';
        const wellnessDone = !!this.state.wellness;
        
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

        body.innerHTML = `
            <div class="ps-section">
                <p class="ps-date-text">${dateStr}</p>
                <h1 class="ps-greeting">Buenas,<br>${firstName}</h1>
            </div>

            <div class="ps-section">
                <div class="ps-bento-grid">
                    <div class="ps-bento-item">
                        <span class="ps-bento-val" style="color: var(--ps-accent-cyan);">0</span>
                        <span class="ps-bento-label">Asistencias</span>
                    </div>
                    <div class="ps-bento-item">
                        <span class="ps-bento-val" style="color: ${wellnessDone ? 'var(--ps-success)' : 'var(--ps-muted)'};">${wellnessDone ? '✓' : '—'}</span>
                        <span class="ps-bento-label">Wellness</span>
                    </div>
                    <div class="ps-bento-item">
                        <span class="ps-bento-val" style="color: var(--ps-muted);">—</span>
                        <span class="ps-bento-label">Carga</span>
                    </div>
                </div>
            </div>

            <div class="ps-section">
                <div class="ps-card ps-micro-card">
                    <div class="ps-micro-header">
                        <h3 class="ps-micro-title">Microciclo Activo</h3>
                        <span style="font-size:1.2rem;">⚽</span>
                    </div>
                    <p class="ps-micro-desc">Día Libre - Recuperación Activa</p>
                </div>
            </div>

            ${!wellnessDone ? `
            <div class="ps-section">
                <div class="ps-card ps-cta-card" onclick="window.PlayerShellEngine.switchTab('wellness')">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h3 class="ps-cta-title">Laboratorio de Hoy</h3>
                            <p class="ps-cta-subtitle">REGISTRAR ESTADO DE HOY →</p>
                        </div>
                        <span style="font-size:1.8rem; filter: drop-shadow(0 0 10px rgba(191,255,0,0.5));">🔋</span>
                    </div>
                </div>
            </div>` : ''}
        `;
        this.state.activeTab = 'home';
    },

    switchTab: function (tabId, btnEl) {
        document.querySelectorAll('.ps-nav-btn').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
        else {
            const btn = document.getElementById('ps-nav-' + tabId);
            if (btn) btn.classList.add('active');
        }

        switch (tabId) {
            case 'home': this._renderHomeView(); break;
            case 'wellness': this._renderWellnessView(); break;
            case 'attendance': this._renderHomeView(); break;
        }
        this.state.activeTab = tabId;
    },

    _renderWellnessView: function () {
        const body = document.getElementById('ps-body');
        if (!body) return;

        if (this.state.wellness) {
            body.innerHTML = `
                <div class="ps-section">
                    <h2 style="font-size:2rem; font-weight:900; color:var(--ps-success); margin-bottom: 8px;">Reporte Enviado</h2>
                    <p style="color:var(--ps-muted); font-size:0.9rem;">Has completado el laboratorio por hoy.</p>
                </div>
            `;
            return;
        }

        this._wellnessForm = { sleep: 3, stress: 3, fatigue: 3, rpe: 5 };

        body.innerHTML = `
            <div class="ps-section">
                <h1 style="font-size: 2rem; font-weight: 800; line-height: 1.1;">Laboratorio<br><span style="color:var(--ps-accent-cyan);">Wellness</span></h1>
                <p style="color:var(--ps-muted); font-size:0.75rem; margin-top:8px; font-weight:800; letter-spacing:2px;">ESCALA DE HOOPER</p>
            </div>

            <div class="ps-section">
                <div class="ps-card">
                    ${['sleep|SUEÑO', 'stress|ESTRÉS', 'fatigue|FATIGA'].map(metric => {
                        const [id, label] = metric.split('|');
                        return `
                        <div class="ps-hooper-row">
                            <div class="ps-hooper-header">
                                <span class="ps-hooper-label">${label}</span>
                                <span class="ps-hooper-val" id="pswl-val-${id}">3</span>
                            </div>
                            <div class="ps-hooper-blocks">
                                ${[1,2,3,4,5].map(n => `<button class="ps-hooper-btn ${n===3?'active':''}" data-val="${n}" data-metric="${id}">${n}</button>`).join('')}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>

            <div class="ps-section">
                <div class="ps-card">
                    <div class="ps-hooper-header">
                        <span class="ps-hooper-label">ESFUERZO PERCIBIDO (RPE)</span>
                        <span class="ps-hooper-val" id="pswl-rpe-display" style="color:#F59E0B;">5</span>
                    </div>
                    <input type="range" class="ps-rpe-slider" id="pswl-rpe-slider" min="0" max="10" value="5" step="1" oninput="window.PlayerShellEngine._onRpeInput(this)">
                </div>
            </div>

            <div class="ps-section">
                <button class="ps-btn-massive" id="pswl-submit-btn" onclick="window.PlayerShellEngine._submitWellness()">ENVIAR REPORTE AL CUERPO TÉCNICO</button>
            </div>
        `;

        this._setupWellnessInteractions();
    },

    _setupWellnessInteractions: function () {
        document.querySelectorAll('.ps-hooper-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const metric = btn.dataset.metric;
                const val = parseInt(btn.dataset.val);
                btn.parentElement.querySelectorAll('.ps-hooper-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('pswl-val-' + metric).textContent = val;
                this._wellnessForm[metric] = val;
            });
        });
    },

    _onRpeInput: function (slider) {
        const val = parseInt(slider.value);
        const display = document.getElementById('pswl-rpe-display');
        display.textContent = val;
        display.style.color = val >= 8 ? 'var(--ps-danger-light)' : val >= 5 ? '#F59E0B' : 'var(--ps-success)';
        if (this._wellnessForm) this._wellnessForm.rpe = val;
    },

    _submitWellness: async function () {
        const btn = document.getElementById('pswl-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'ENVIANDO...'; }

        try {
            const uid = localStorage.getItem('ravix_v5_uid');
            const form = this._wellnessForm || {};
            const rpeSlider = document.getElementById('pswl-rpe-slider');
            if (rpeSlider) form.rpe = parseInt(rpeSlider.value);

            const payload = {
                player_id: uid,
                fecha: new Date().toISOString().split('T')[0],
                sleep_quality: form.sleep || 3,
                stress_level: form.stress || 3,
                fatigue: form.fatigue || 3,
                rpe_score: form.rpe || 5,
                created_at: new Date().toISOString()
            };

            await window.supabase.from('player_wellness').upsert([payload], { onConflict: 'player_id,fecha' });
            this.state.wellness = payload;
            this._showToast('✅ Reporte enviado con éxito');
            setTimeout(() => this._renderWellnessView(), 800);
        } catch (err) {
            console.error(err);
            if (btn) { btn.disabled = false; btn.textContent = 'ENVIAR REPORTE AL CUERPO TÉCNICO'; }
        }
    },

    _showToast: function (msg) {
        const prev = document.getElementById('ps-toast');
        if (prev) prev.remove();
        const toast = document.createElement('div');
        toast.id = 'ps-toast';
        toast.className = 'ps-toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    _updateBootStatus: function (msg) {
        const el = document.getElementById('ps-boot-status');
        if (el) el.textContent = msg;
    }
};

window.AthleteApp = {

    state: {
        dailyLog: {
            session_type: 'Entrenamiento Club',
            duration_min: 90,
            rpe_score: 5,
            sleep_quality: 3,
            stress_level: 3,
            fatigue: 3,
            muscle_soreness: 3,
            mood: 3
        },
        strength: { sets: [], totalTonnage: 0 },
        readiness: null,
        currentRegime: 'Concéntrico',
    },

    init: function () {
        const targetId = 'view-athlete-dashboard';
        const view = document.getElementById(targetId);
        if (!view) {
            console.error('[ROUTER ERROR] No se encontró la vista: #' + targetId);
            return;
        }

        document.querySelectorAll('.view-section').forEach(s => {
            if (s.id !== targetId) s.style.display = 'none';
        });

        view.style.display = 'flex';

        this.setupDate();
        this.setupUserProfile();
        this.setupDailyLogInteractions();
        this.setupStrengthInteractions();
        setTimeout(() => this.updateReadiness(null), 400);
    },

    setupDate: function () {
        const el = document.getElementById('ad-date');
        if (!el) return;
        const now = new Date();
        el.textContent = now.toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long'
        }).toUpperCase();
    },

    setupUserProfile: function () {
        const user = window.CurrentUser;
        if (!user) return;
        const nameEl = document.getElementById('ad-user-name');
        if (nameEl && user.full_name) nameEl.textContent = user.full_name.split(' ')[0];
        const sportEl = document.getElementById('ad-sport-tag');
        if (sportEl && user.sport) {
            sportEl.textContent = `${user.sport.toUpperCase()}${user.position ? ' · ' + user.position.toUpperCase() : ''}`;
        }
    },

    updateReadiness: function (score) {
        const scoreEl  = document.getElementById('ad-readiness-score');
        const statusEl = document.getElementById('adp-ring-status');
        const ring     = document.getElementById('adp-ring-fill');
        if (!ring) return;

        const CIRC = 2 * Math.PI * 42;

        if (score === null) {
            if (scoreEl)  scoreEl.textContent  = '—';
            if (statusEl) statusEl.textContent = 'SIN DATOS';
            ring.style.strokeDashoffset = CIRC;
            return;
        }

        this.state.readiness = score;
        const clamped = Math.max(0, Math.min(100, score));
        const offset  = CIRC - (clamped / 100) * CIRC;
        ring.style.strokeDashoffset = offset;

        if (scoreEl) {
            let current = parseInt(scoreEl.textContent) || 0;
            const step = Math.ceil(Math.abs(clamped - current) / 20);
            const timer = setInterval(() => {
                if (current < clamped)      current = Math.min(current + step, clamped);
                else if (current > clamped) current = Math.max(current - step, clamped);
                else                        clearInterval(timer);
                scoreEl.textContent = current;
            }, 30);
        }

        if (statusEl) {
            if (score >= 80)      { statusEl.textContent = 'ÓPTIMO';    statusEl.style.color = 'rgba(16,185,129,0.9)'; }
            else if (score >= 60) { statusEl.textContent = 'MODERADO';  statusEl.style.color = 'rgba(245,158,11,0.9)'; }
            else                  { statusEl.textContent = 'PRECAUCIÓN'; statusEl.style.color = 'rgba(239,68,68,0.9)'; }
        }
    },

    setupDailyLogInteractions: function () {
        const segBtns = document.querySelectorAll('#session-type-group .adp-seg-btn');
        segBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                segBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.dailyLog.session_type = btn.dataset.type;
            });
        });

        const hooperRows = document.querySelectorAll('.adp-hooper-row');
        hooperRows.forEach(row => {
            const metric = row.dataset.metric;
            const btns = row.querySelectorAll('.adp-h-btn');
            btns.forEach(btn => {
                btn.addEventListener('click', () => {
                    btns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.state.dailyLog[metric] = parseInt(btn.dataset.val);
                });
            });
        });

        const durationInput = document.getElementById('input-duration');
        if (durationInput) {
            durationInput.addEventListener('input', () => {
                this.state.dailyLog.duration_min = parseInt(durationInput.value) || 0;
            });
        }
    },

    adjustDuration: function (diff) {
        const input = document.getElementById('input-duration');
        if (input) {
            let current = parseInt(input.value) || 0;
            input.value = Math.max(0, current + diff);
            this.state.dailyLog.duration_min = parseInt(input.value);
        }
    },

    updateRangeDisplay: function (rangeId, displayId, value, suffix) {
        const disp = document.getElementById(displayId);
        if (disp) disp.textContent = `${value} ${suffix}`;
        if (rangeId === 'input-rpe') {
            this.state.dailyLog.rpe_score = parseInt(value);
        }
    },

    submitDailyLog: async function () {
        const btn = document.getElementById('btn-submit-daily');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Enviando...`;
            btn.style.opacity = '0.7';
        }

        try {
            const user = window.CurrentUser || window.App?.currentUser;
            if (!user) throw new Error('No hay usuario logueado.');

            const payload = {
                player_id:     user.id,
                team_id:       user.team_id || window.CurrentTeam?.id,
                fecha:         new Date().toISOString().split('T')[0],
                session_type:  this.state.dailyLog.session_type,
                duration_min:  this.state.dailyLog.duration_min,
                rpe_score:     this.state.dailyLog.rpe_score,
                sleep_quality: this.state.dailyLog.sleep_quality,
                stress_level:  this.state.dailyLog.stress_level,
                fatigue:       this.state.dailyLog.fatigue,
                muscle_soreness: this.state.dailyLog.muscle_soreness,
                mood:          this.state.dailyLog.mood
            };

            const { error } = await window.supabase.from('player_daily_logs').insert([payload]);
            if (error) throw error;

            this._showToast('✅ ¡Reporte enviado con éxito!');
            this._updateChip('chip-load', 'chip-load-val', `${payload.duration_min * payload.rpe_score} UA`, true);
            this._updateChip('chip-wellness', 'chip-wellness-val', 'Completado', true);

            if (btn) {
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Reporte Enviado ✓`;
                btn.style.opacity = '1';
                btn.style.background = '#10B981';
            }
        } catch (err) {
            console.error('Error submitDailyLog:', err);
            this._showToast('⚠️ Hubo un error al enviar el reporte.', 'warn');
            if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
        }
    },

    setupStrengthInteractions: function () {
        const regimeBtns = document.querySelectorAll('#strength-regime .adp-regime-btn');
        regimeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                regimeBtns.forEach(b => b.classList.remove('adp-regime-btn--active'));
                btn.classList.add('adp-regime-btn--active');
                this.state.currentRegime = btn.dataset.regime;
            });
        });
    },

    calculateTonnage: function () {
        const sets   = parseInt(document.getElementById('strength-sets')?.value) || 0;
        const reps   = parseInt(document.getElementById('strength-reps')?.value) || 0;
        const weight = parseFloat(document.getElementById('strength-weight')?.value) || 0;
        const ton    = sets * reps * weight;

        const setsP   = document.getElementById('str-sets-preview');
        const repsP   = document.getElementById('str-reps-preview');
        const weightP = document.getElementById('str-weight-preview');
        const result  = document.getElementById('strength-result');

        if (setsP)   setsP.textContent   = sets   || '—';
        if (repsP)   repsP.textContent   = reps   || '—';
        if (weightP) weightP.textContent = weight ? `${weight}kg` : '—';
        if (result)  { result.textContent = ton; result.style.transform = 'scale(1.1)'; setTimeout(() => { result.style.transform = ''; }, 180); }
    },

    saveStrength: function () {
        const sets   = parseInt(document.getElementById('strength-sets')?.value) || 0;
        const reps   = parseInt(document.getElementById('strength-reps')?.value) || 0;
        const weight = parseFloat(document.getElementById('strength-weight')?.value) || 0;

        if (!sets || !reps || !weight) {
            this._showToast('⚠️ Completa Series, Reps y Carga antes de añadir.', 'warn');
            return;
        }

        const tonnage = sets * reps * weight;
        const entry   = { sets, reps, weight, tonnage, regime: this.state.currentRegime };
        this.state.strength.sets.push(entry);
        this.state.strength.totalTonnage += tonnage;

        this._renderSetsLog();
        this._updateChip('chip-strength', 'chip-strength-val', `${this.state.strength.totalTonnage} kg`, true);

        document.getElementById('strength-sets').value   = '';
        document.getElementById('strength-reps').value   = '';
        document.getElementById('strength-weight').value = '';
        this.calculateTonnage();
        this._showToast(`🏋️ Serie añadida · Tonelaje: ${tonnage} kg`);
    },

    _renderSetsLog: function () {
        const empty  = document.getElementById('sets-log-empty');
        const list   = document.getElementById('sets-log-list');
        const total  = document.getElementById('sets-total-row');
        const accum  = document.getElementById('sets-accumulated');
        if (!list) return;

        const sets = this.state.strength.sets;
        if (sets.length === 0) {
            if (empty) empty.style.display = 'flex';
            if (total) total.style.display = 'none';
            list.innerHTML = '';
            return;
        }

        if (empty) empty.style.display = 'none';
        if (total) total.style.display = 'flex';
        if (accum) accum.textContent = `${this.state.strength.totalTonnage} kg`;

        list.innerHTML = sets.map(s => `
            <div class="adp-set-row">
                <span class="adp-set-regime">${s.regime}</span>
                <span class="adp-set-formula">${s.sets}×${s.reps} · ${s.weight}kg</span>
                <span class="adp-set-tonnage">${s.tonnage} kg</span>
            </div>
        `).join('');
    },

    switchTab: function (tabId, btnEl) {
        document.querySelectorAll('.adp-nav-item').forEach(n => n.classList.remove('adp-nav-item--active'));
        if (btnEl) btnEl.classList.add('adp-nav-item--active');
        if (tabId !== 'dashboard') this._showToast('📊 Módulo en construcción. Próximamente.');
    },

    _updateChip: function (chipId, valId, text, done) {
        const chip = document.getElementById(chipId);
        const val  = document.getElementById(valId);
        if (val) val.textContent = text;
        if (chip && done) {
            chip.classList.add('adp-chip--done');
            const dot = chip.querySelector('.adp-chip-dot');
            if (dot) { dot.classList.remove('adp-chip-dot--pending'); dot.classList.add('adp-chip-dot--done'); }
        }
    },

    _showToast: function (message, type = 'success') {
        const prev = document.getElementById('adp-toast');
        if (prev) prev.remove();

        const toast = document.createElement('div');
        toast.id = 'adp-toast';
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'fixed', bottom: '90px', left: '50%',
            transform: 'translateX(-50%) translateY(10px)',
            background: type === 'warn' ? '#1C1C1E' : 'linear-gradient(135deg, #1C1C1E, #2a2a2e)',
            color: '#fff', padding: '12px 20px', borderRadius: '28px',
            fontSize: '13px', fontWeight: '700', fontFamily: "'Inter', sans-serif",
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: '10000',
            opacity: '0', transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
            whiteSpace: 'nowrap',
            border: type === 'warn' ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(191,149,63,0.3)',
        });

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(8px)';
            setTimeout(() => toast.remove(), 350);
        }, 3000);
    }
};
