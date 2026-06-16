/*
    RAVIX V5 — APP-PLAYER.JS  (Dark Athletic Edition)
    ─────────────────────────────────────────────────────────────
    CONTIENE:
      1. PlayerEngine       → Vista DT: lista de atletas (dentro de #app-shell)
      2. PlayerShellEngine  → Motor exclusivo del Jugador (#player-shell)
      3. PSTimer            → Cronómetro / Countdown flotante de sesión
    ─────────────────────────────────────────────────────────────
    REGLAS:
      - PlayerShellEngine JAMÁS toca #app-shell ni vistas del DT.
      - Toda la lógica Supabase está aquí (wellness, training_logs, team_roster).
      - V4 localStorage eliminado; reemplazado por payload Supabase-ready.
      - RPE / Fatiga se captura SÓLO a nivel de sesión completa en el modal Wellness.
      - El modal de registro de serie sólo pide: Peso · Series · Reps.
*/

/* ══════════════════════════════════════════════════════════
   1. PLAYER ENGINE — Vista del DT (lista de atletas)
      Vive dentro del #app-shell del DT.
══════════════════════════════════════════════════════════ */
window.PlayerEngine = {
    init: function () {
        if (window.App && (window.App.currentRole === 'jugador' || window.App.currentRole === 'player')) {
            if (window.PlayerShellEngine) window.PlayerShellEngine.boot();
            return;
        }
        const targetId = 'view-athletes';
        const target = document.getElementById(targetId);
        if (!target) { console.error('[PLAYER ENGINE] Vista DT #' + targetId + ' no encontrada.'); return; }
        document.querySelectorAll('.view-section').forEach(s => { if (s.id !== targetId) s.style.display = 'none'; });
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
                .from('profiles_athlete').select('*')
                .eq('coach_id', uid).order('created_at', { ascending: false });
            if (error || !Array.isArray(athletes) || athletes.length === 0) {
                grid.innerHTML = `<div class="aw-empty-state"><div class="aw-empty-icon">🏅</div><h3>Sin atletas registrados</h3><p>Los atletas aparecerán aquí una vez que completen su registro.</p></div>`;
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
                <h3 style="font-family:Outfit;margin:0;font-size:1.1rem;">${a.full_name || 'Atleta'}</h3>
                <p style="color:#bf953f;font-weight:900;font-size:11px;margin-top:4px;letter-spacing:1px;">
                    ${(a.sport || '—').toUpperCase()} ${a.position ? '| ' + a.position.toUpperCase() : ''}
                </p>
                <hr style="opacity:0.1;margin:12px 0;">
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:10px;font-weight:700;color:#999;">
                    <div>ESTRUCTURA<br><span style="color:#1a1a2e;font-size:13px;font-weight:800;">${a.weight_kg ? a.weight_kg + 'kg' : '—'} / ${a.height_cm ? a.height_cm + 'cm' : '—'}</span></div>
                    <div>OBJETIVO<br><span style="color:#1a1a2e;font-size:12px;font-weight:800;">${a.goal || '—'}</span></div>
                    <div>NACIMIENTO<br><span style="color:#1a1a2e;font-size:12px;font-weight:800;">${a.birth_date || '—'}</span></div>
                </div>
            </div>
        `).join('');
    }
};


/* ══════════════════════════════════════════════════════════
   2. PS TIMER — Floating session timer
      Controlled by PlayerShellEngine._startTrainingView()
══════════════════════════════════════════════════════════ */
window.PSTimer = {
    _interval: null,
    _seconds: 0,
    _countdown: 0,
    _isCountdown: false,
    _running: false,

    _bar: function () { return document.getElementById('ps-timer-bar'); },
    _timeEl: function () { return document.getElementById('ps-timer-time'); },
    _dotEl: function () { return document.getElementById('ps-timer-dot'); },

    show: function () {
        const bar = this._bar();
        if (bar) { bar.classList.remove('hidden'); }
    },
    hide: function () {
        const bar = this._bar();
        if (bar) { bar.classList.add('hidden'); }
        this.reset();
    },

    toggle: function () {
        if (this._running) this.pause();
        else this.start();
    },

    start: function () {
        if (this._running) return;
        this._running = true;
        const dot = this._dotEl();
        if (dot) { dot.style.background = 'var(--green)'; dot.style.boxShadow = '0 0 6px var(--green-glow)'; }
        this._interval = setInterval(() => {
            if (this._isCountdown) {
                this._countdown--;
                if (this._countdown <= 0) { this.pause(); this._countdown = 0; this._playBeep(); }
                this._render(this._countdown);
            } else {
                this._seconds++;
                this._render(this._seconds);
            }
        }, 1000);
    },

    pause: function () {
        this._running = false;
        clearInterval(this._interval);
        const dot = this._dotEl();
        if (dot) { dot.style.background = 'var(--yellow)'; dot.style.boxShadow = '0 0 6px var(--yellow-glow)'; }
    },

    reset: function () {
        this.pause();
        this._seconds = 0;
        this._countdown = 0;
        this._isCountdown = false;
        this._render(0);
        const dot = this._dotEl();
        if (dot) { dot.style.background = 'var(--text-3)'; dot.style.boxShadow = 'none'; }
    },

    setCountdown: function (secs, btnEl) {
        this.pause();
        this._isCountdown = true;
        this._countdown = secs;
        this._render(secs);
        document.querySelectorAll('.ps-timer-preset').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
        this.start();
    },

    _render: function (totalSecs) {
        const m = String(Math.floor(totalSecs / 60)).padStart(2, '0');
        const s = String(totalSecs % 60).padStart(2, '0');
        const el = this._timeEl();
        if (el) el.textContent = `${m}:${s}`;
    },

    _playBeep: function () {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start(); osc.stop(ctx.currentTime + 0.4);
        } catch (e) { /* audio not available */ }
    }
};


/* ══════════════════════════════════════════════════════════
   3. PLAYER SHELL ENGINE — Motor exclusivo del Jugador
      Gestiona el #player-shell (Mobile-First).
      AISLADO: Jamás toca #app-shell ni vistas del DT.
      Tablas Supabase:
        - team_roster
        - player_wellness
        - player_attendance
        - player_training_logs  ← nueva (series de entrenamiento)
══════════════════════════════════════════════════════════ */
window.PlayerShellEngine = {

    /* ── State ── */
    state: {
        user:            null,
        wellness:        null,
        attendance:      [],
        activeTab:       'home',
        /* Training session state */
        session: {
            active:      false,
            sessionId:   null,   // generated on start
            exercises:   [],     // [{name, sets:[{weight,reps}]}, ...]
            startedAt:   null,
        },
        _logTargetExIdx: null,   // index into session.exercises while modal is open
    },

    /* ────────────────────────────────────────────
       BOOT
    ──────────────────────────────────────────── */
    boot: function () {
        console.log('[PLAYER SHELL] Booting Mundo Atleta...');
        if (!document.querySelector('link[href="css/app-player.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = 'css/app-player.css';
            document.head.appendChild(link);
        }

        let shell = document.getElementById('player-shell');
        if (!shell) {
            shell = this._buildShellDOM();
            document.body.appendChild(shell);
        } else {
            const newShell = this._buildShellDOM();
            shell.replaceWith(newShell);
            shell = newShell;
        }

        const dtAppShell = document.getElementById('app-shell');
        if (dtAppShell) { dtAppShell.style.display = 'none'; dtAppShell.setAttribute('aria-hidden', 'true'); }

        document.body.style.background = '#0a0e1a)';
        document.body.style.color = '#f0f4f8';

        shell.style.cssText = 'display:flex !important; flex-direction:column !important; min-height:100vh !important; width:100vw !important; opacity:1 !important; visibility:visible !important; position:fixed !important; top:0 !important; left:0 !important; z-index:999999 !important;';
        shell.classList.add('ps-active');

        this._fetchPlayerData();
    },

    /* ────────────────────────────────────────────
       BUILD SHELL DOM
    ──────────────────────────────────────────── */
    _buildShellDOM: function () {
        const shell = document.createElement('div');
        shell.id = 'player-shell';
        shell.setAttribute('role', 'main');

        shell.innerHTML = `
            <!-- ══ HEADER ══ -->
            <header class="ps-app-header" id="ps-header">
                <div class="ps-header-brand">
                    <div class="ps-brand-name">RAVI<span style="-webkit-text-fill-color:inherit;">X</span></div>
                    <span class="ps-brand-version">V5</span>
                </div>
                <div class="ps-header-meta">
                    <div class="ps-semaphore" id="ps-header-semaphore" title="Carga Aguda" style="background:var(--green);box-shadow:0 0 10px var(--green-glow);"></div>
                    <button class="ps-header-add-btn" title="Nuevo Registro" onclick="window.PlayerShellEngine._startTrainingView()">+</button>
                    <div class="ps-header-avatar" onclick="window.PlayerShellEngine.switchTab('home')" id="header-user-emoji">👨🏻‍🚀</div>
                </div>
            </header>

            <!-- ══ MAIN CONTENT ══ -->
            <main class="ps-app-main" id="ps-body">
                <div class="ps-view active" id="ps-view-home">
                    <div class="ps-boot" id="ps-boot-screen">
                        <div class="ps-boot-icon">⚡</div>
                        <h1 class="ps-boot-title">Laboratorio Activo</h1>
                        <p class="ps-boot-status" id="ps-boot-status">Sincronizando datos biométricos...</p>
                    </div>
                </div>
            </main>

            <!-- ══ TIMER BAR (flotante, arriba del nav) ══ -->
            <div class="ps-timer-bar hidden" id="ps-timer-bar">
                <button class="ps-timer-display" id="ps-timer-display"
                        onclick="window.PSTimer.toggle()" title="Tap para iniciar / pausar">
                    <span class="ps-timer-dot" id="ps-timer-dot"></span>
                    <span class="ps-timer-time" id="ps-timer-time">00:00</span>
                    <span class="ps-timer-mode-icon">⏱</span>
                </button>
                <div class="ps-timer-presets">
                    <button class="ps-timer-preset" onclick="window.PSTimer.setCountdown(30,this)">30s</button>
                    <button class="ps-timer-preset" onclick="window.PSTimer.setCountdown(60,this)">1m</button>
                    <button class="ps-timer-preset" onclick="window.PSTimer.setCountdown(90,this)">90s</button>
                    <button class="ps-timer-preset" onclick="window.PSTimer.setCountdown(120,this)">2m</button>
                    <button class="ps-timer-preset" onclick="window.PSTimer.setCountdown(180,this)">3m</button>
                </div>
                <button class="ps-timer-reset-btn" onclick="window.PSTimer.reset()" title="Resetear">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="1 4 1 10 7 10"/>
                        <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
                    </svg>
                </button>
            </div>

            <!-- ══ BOTTOM NAV ══ -->
            <nav class="ps-bottom-nav" id="ps-bottom-nav">
                <button class="ps-nav-btn active" id="ps-nav-home"
                        onclick="window.PlayerShellEngine.switchTab('home',this)">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span class="ps-nav-label">Inicio</span>
                </button>
                <button class="ps-nav-btn" id="ps-nav-wellness"
                        onclick="window.PlayerShellEngine.switchTab('wellness',this)">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                    <span class="ps-nav-label">Wellness</span>
                </button>
                <button class="ps-nav-btn" id="ps-nav-attendance"
                        onclick="window.PlayerShellEngine.switchTab('attendance',this)">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span class="ps-nav-label">Asistencia</span>
                </button>
            </nav>

            <!-- ══ MODAL CONTAINER (Bottom Sheets) ══ -->
            <div id="ps-modal-container"></div>
        `;
        return shell;
    },

    /* ────────────────────────────────────────────
       DATA FETCH
    ──────────────────────────────────────────── */
    _fetchPlayerData: async function () {
        const uid = localStorage.getItem('ravix_v5_uid');
        if (!uid) { this._renderHomeView(); return; }

        try {
            this._updateBootStatus('LEYENDO ROSTER...');
            const { data: rosterRows } = await window.supabase
                .from('team_roster').select('*').eq('player_id', uid).limit(1);
            const playerRow = rosterRows && rosterRows.length > 0 ? rosterRows[0] : null;

            if (!playerRow) {
                if (localStorage.getItem('ps_skip_team') === 'true') {
                    this.state.user = null;
                    return this._renderHomeView();
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
            const { data: wellnessRows } = await window.supabase
                .from('player_wellness').select('*')
                .eq('player_id', uid).eq('fecha', today).limit(1);
            if (wellnessRows && wellnessRows.length > 0) this.state.wellness = wellnessRows[0];

            this._updateBootStatus('MICROCICLO LISTO ✓');
            setTimeout(() => this._renderHomeView(), 600);

        } catch (err) {
            console.error('[PSE] _fetchPlayerData:', err);
            setTimeout(() => this._renderHomeView(), 800);
        }
    },

    _hydrateHeader: function (playerRow) {
        const avatarEl = document.getElementById('header-user-emoji');
        if (avatarEl) {
            const name = playerRow?.full_name || window.CurrentUser?.full_name || 'A';
            avatarEl.textContent = name.charAt(0).toUpperCase();
        }
    },

    _updateBootStatus: function (msg) {
        const el = document.getElementById('ps-boot-status');
        if (el) el.textContent = msg;
    },

    /* ────────────────────────────────────────────
       ONBOARDING VIEW
    ──────────────────────────────────────────── */
    _renderOnboardingView: function (isAddingExtraTeam = false) {
        if (isAddingExtraTeam) {
            this._openModal(`
                <div class="ps-modal-handle"></div>
                <div class="ps-modal-header-row">
                    <div>
                        <h3 class="ps-modal-title">Vincular Equipo</h3>
                        <p class="ps-modal-subtitle">Ingresá el código de tu DT.</p>
                    </div>
                    <button class="ps-btn-close-modal" onclick="window.PlayerShellEngine._closeModal()">✕</button>
                </div>
                <div class="ps-onboarding-wrapper" style="padding:0; gap:12px;">
                    <div class="ps-onboarding-icon">🛡️</div>
                </div>
                <div class="ps-form-group">
                    <label class="ps-form-label">Código de Equipo</label>
                    <input type="text" id="onboarding-invite-code" class="ps-onboarding-input"
                           placeholder="Ej: ABC123" autocapitalize="characters" autocomplete="off">
                </div>
                <button class="ps-btn-massive" id="onboarding-connect-btn"
                        onclick="window.PlayerShellEngine._joinTeam(document.getElementById('onboarding-invite-code').value)">
                    CONECTAR AL EQUIPO
                </button>
                <button class="ps-btn-secondary" onclick="window.PlayerShellEngine._closeModal()">Cancelar</button>
            `);
            return;
        }

        const body = document.getElementById('ps-body');
        if (!body) return;
        const nav = document.getElementById('ps-bottom-nav');
        if (nav) nav.style.display = 'none';

        body.innerHTML = `
            <div class="ps-view active" style="min-height:80dvh; justify-content:center; align-items:center;">
                <div class="ps-onboarding-wrapper">
                    <div class="ps-onboarding-icon">🛡️</div>
                    <h2 class="ps-onboarding-title">VINCULACIÓN DE EQUIPO</h2>
                    <p class="ps-onboarding-desc">Ingresá el código holográfico de tu DT para conectarte al equipo.</p>
                    <div class="ps-form-group" style="width:100%;">
                        <input type="text" id="onboarding-invite-code" class="ps-onboarding-input"
                               placeholder="CÓDIGO" autocapitalize="characters" autocomplete="off">
                    </div>
                    <button class="ps-btn-massive" id="onboarding-connect-btn"
                            onclick="window.PlayerShellEngine._joinTeam(document.getElementById('onboarding-invite-code').value)">
                        CONECTAR
                    </button>
                    <button class="ps-btn-secondary" style="margin-top:8px;"
                            onclick="window.PlayerShellEngine._skipOnboarding()">
                        Continuar sin equipo
                    </button>
                </div>
            </div>
        `;
    },

    _skipOnboarding: function () {
        localStorage.setItem('ps_skip_team', 'true');
        const nav = document.getElementById('ps-bottom-nav');
        if (nav) nav.style.display = 'flex';
        this._renderHomeView();
    },

    /* ────────────────────────────────────────────
       MODAL HELPERS
    ──────────────────────────────────────────── */
    _openModal: function (html) {
        const container = document.getElementById('ps-modal-container');
        if (!container) return;
        container.innerHTML = `
            <div class="ps-modal-overlay" id="ps-modal-overlay"
                 onclick="if(event.target===this) window.PlayerShellEngine._closeModal()">
                <div class="ps-modal-sheet">${html}</div>
            </div>
        `;
    },

    _closeModal: function () {
        const overlay = document.getElementById('ps-modal-overlay');
        if (overlay) {
            overlay.style.transition = 'opacity 0.2s ease';
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 220);
        }
    },

    /* ────────────────────────────────────────────
       TAB ROUTING
    ──────────────────────────────────────────── */
    switchTab: function (tabId, btnEl) {
        document.querySelectorAll('.ps-nav-btn').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
        else {
            const btn = document.getElementById('ps-nav-' + tabId);
            if (btn) btn.classList.add('active');
        }
        switch (tabId) {
            case 'home':       this._renderHomeView();       break;
            case 'wellness':   this._openWellnessModal();    break;
            case 'attendance': this._renderAttendanceView(); break;
        }
        this.state.activeTab = tabId;
    },

    /* ────────────────────────────────────────────
       HOME VIEW
    ──────────────────────────────────────────── */
    _renderHomeView: function () {
        const body = document.getElementById('ps-body');
        if (!body) return;

        const player       = this.state.user;
        const firstName    = player?.full_name?.split(' ')[0] || 'Atleta';
        const wellnessDone = !!this.state.wellness;
        const attendance   = this.state.attendance || [];

        const wellnessColor = wellnessDone ? 'var(--green)' : 'var(--text-3)';
        const wellnessVal   = wellnessDone ? '✓' : '—';

        const now     = new Date();
        const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

        // Week tracker (Mon-based)
        const days    = ['L','M','X','J','V','S','D'];
        const dow     = now.getDay();
        const todayIdx = (dow === 0) ? 6 : dow - 1;
        const weekDaysHTML = days.map((d, i) => {
            let cls = 'ps-day-dot';
            if (i === todayIdx)    cls += ' today';
            else if (i < todayIdx) cls += ' rest';
            return `
                <div class="${cls}">
                    <div class="ps-day-dot-circle">${d}</div>
                </div>`;
        }).join('');

        body.innerHTML = `
            <div class="ps-view active" id="ps-view-home">

                <!-- Greeting -->
                <div class="ps-greeting-section">
                    <p class="ps-date-label">${dateStr}</p>
                    <h1 class="ps-greeting">Buenas,&nbsp;${firstName}</h1>
                </div>

                <!-- KPI Grid -->
                <div class="ps-fatigue-metrics">
                    <div class="ps-metric">
                        <span class="ps-metric-value accent">${attendance.length || '0'}</span>
                        <span class="ps-metric-label">Asistencias</span>
                    </div>
                    <div class="ps-metric">
                        <span class="ps-metric-value" style="color:${wellnessColor};">${wellnessVal}</span>
                        <span class="ps-metric-label">Wellness</span>
                    </div>
                    <div class="ps-metric">
                        <span class="ps-metric-value muted">—</span>
                        <span class="ps-metric-label">Carga</span>
                    </div>
                </div>

                <!-- Microciclo Panel -->
                <div class="ps-panel">
                    <div class="ps-panel-header">
                        <h3 class="ps-panel-title">Microciclo Activo</h3>
                        <span class="ps-panel-badge">SEMANA</span>
                    </div>
                    <!-- Today card -->
                    <div class="ps-today-card">
                        <div class="ps-today-card-header">
                            <div>
                                <p class="ps-today-label">HOY</p>
                                <p class="ps-today-title">${now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'short'}).toUpperCase()}</p>
                            </div>
                        </div>
                        <div class="ps-today-scenario">
                            <span class="ps-scenario-emoji">⚽</span>
                            <span class="ps-scenario-label">Recuperación Activa</span>
                        </div>
                        <button class="ps-btn-start-training"
                                onclick="window.PlayerShellEngine._startTrainingView()">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                            INICIAR SESIÓN
                        </button>
                    </div>
                    <!-- Week tracker -->
                    <div class="ps-week-days">${weekDaysHTML}</div>
                </div>

                <!-- Wellness CTA / Done -->
                ${!wellnessDone
                    ? `<div class="ps-cta-card" onclick="window.PlayerShellEngine._openWellnessModal()">
                            <div class="ps-cta-texts">
                                <p class="ps-cta-title">Estado de Hoy</p>
                                <p class="ps-cta-subtitle">Registrar wellness →</p>
                            </div>
                            <span class="ps-cta-icon">🔋</span>
                       </div>`
                    : `<div class="ps-wellness-done-card">
                            <span class="ps-wellness-done-icon">✅</span>
                            <div class="ps-wellness-done-text">
                                <p class="ps-wellness-done-title">Reporte Enviado</p>
                                <p class="ps-wellness-done-sub">Laboratorio completado por hoy</p>
                            </div>
                       </div>`
                }

            </div>
        `;
        this.state.activeTab = 'home';
    },

    /* ────────────────────────────────────────────
       TRAINING VIEW (Motor de Entrenamiento V4)
    ──────────────────────────────────────────── */
    _startTrainingView: function () {
        const body = document.getElementById('ps-body');
        if (!body) return;

        // Init session state
        this.state.session.active    = true;
        this.state.session.sessionId = 'sess_' + Date.now();
        this.state.session.startedAt = new Date().toISOString();
        this.state.session.exercises = this._getDefaultExercises();

        // Show timer bar
        PSTimer.show();
        PSTimer.reset();
        PSTimer.start();

        this._renderTrainingView();

        // Switch active nav to home (no dedicated training tab)
        document.querySelectorAll('.ps-nav-btn').forEach(b => b.classList.remove('active'));
        const homeBtn = document.getElementById('ps-nav-home');
        if (homeBtn) homeBtn.classList.add('active');
    },

    _getDefaultExercises: function () {
        // Default training day — in production this comes from DT microcicle plan
        return [
            { name: 'Sentadilla',       group: 'Piernas',    fatigue: 3, sets: [] },
            { name: 'Press de Banca',   group: 'Pecho',      fatigue: 2, sets: [] },
            { name: 'Peso Muerto',      group: 'Espalda',    fatigue: 3, sets: [] },
            { name: 'Remo con Barra',   group: 'Espalda',    fatigue: 2, sets: [] },
            { name: 'Press Militar',    group: 'Hombros',    fatigue: 2, sets: [] },
            { name: 'Curl de Bíceps',   group: 'Brazos',     fatigue: 1, sets: [] },
        ];
    },

    _renderTrainingView: function () {
        const body = document.getElementById('ps-body');
        if (!body) return;

        const exes = this.state.session.exercises;

        // Mobility Section Logic
        const mobilityHTML = `
            <div class="ps-panel" id="ps-mobility-section" style="margin-bottom: 16px;">
                <div class="ps-panel-header" onclick="this.nextElementSibling.classList.toggle('hidden')">
                    <h3 class="ps-panel-title">Activación & Movilidad</h3>
                    <span class="ps-panel-badge">3 MIN</span>
                </div>
                <div class="ps-mobility-list">
                    <div class="ps-mobility-card"><span class="m-emoji">🪱</span><span class="m-name">Oruga</span><span class="m-dur">30s</span></div>
                    <div class="ps-mobility-card"><span class="m-emoji">🕷️</span><span class="m-name">Spiderman</span><span class="m-dur">30s</span></div>
                    <div class="ps-mobility-card"><span class="m-emoji">🦂</span><span class="m-name">Escorpión</span><span class="m-dur">30s</span></div>
                    <div class="ps-mobility-card"><span class="m-emoji">🧘‍♂️</span><span class="m-name">Cobra a Carpa</span><span class="m-dur">45s</span></div>
                </div>
            </div>
        `;

        const exerciseCardsHTML = exes.map((ex, idx) => {
            const fatigueClass = ['', 'f1', 'f2', 'f3'][ex.fatigue] || 'f2';
            const fatigueLabel = ['', 'BAJA', 'MEDIA', 'ALTA'][ex.fatigue] || 'MEDIA';
            const logged       = ex.sets.length > 0;
            
            // Progression Engine (RIR logic simulation)
            const isProgressed = ex.hasHighRirHistory; // Simulated flag
            const suggestionBanner = isProgressed ? `
                <div class="ps-suggestion-banner" style="margin: 8px 12px 0;">
                    <span style="font-size:16px;">🟢</span>
                    <span>Última sesión RIR ≥ 3. Sugerencia: <b>Subir carga (+2.5kg)</b></span>
                </div>
            ` : '';

            const setsLogHTML = ex.sets.length > 0 ? ex.sets.map((s, si) => `
                <div class="ps-logged-set-row">
                    <span class="ps-set-num">S${si+1}</span>
                    <span class="ps-set-data">${s.weight}kg × ${s.reps} reps</span>
                    <span class="ps-set-tonnage">${(s.weight * s.reps).toFixed(0)} kg</span>
                </div>`).join('') : '';

            return `
                <div class="ps-exercise-card ${logged ? 'logged' : ''}" id="ps-excard-${idx}">
                    <div class="ps-exercise-card-header" onclick="this.parentElement.querySelector('.ps-ex-sets-body').classList.toggle('open')">
                        <div class="ps-ex-fatigue-badge ${fatigueClass}">${fatigueLabel}</div>
                        <div class="ps-exercise-card-info">
                            <p class="ps-ex-name">${ex.name}</p>
                            <p class="ps-ex-group">${ex.group}</p>
                        </div>
                        <span class="ps-ex-log-indicator">${logged ? '✓' : '+'}</span>
                    </div>
                    ${suggestionBanner}
                    <div class="ps-ex-sets-body">
                        <div class="ps-ex-logged-sets" id="ps-sets-log-${idx}">
                            ${setsLogHTML || '<p class="ps-ex-no-sets">Sin series aún</p>'}
                        </div>
                        <button class="ps-btn-add-set"
                                onclick="window.PlayerShellEngine._openLogSetModal(${idx})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            AÑADIR SERIE
                        </button>
                    </div>
                </div>`;
        }).join('');

        body.innerHTML = `
            <div class="ps-view active" id="ps-view-training">

                <!-- Training Header -->
                <div class="ps-train-header">
                    <button class="ps-btn-back" onclick="window.PlayerShellEngine._confirmEndSession()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <polyline points="15 18 9 12 15 6"/>
                        </svg>
                    </button>
                    <div style="flex:1;">
                        <p class="ps-train-scenario-label">Recuperación Activa</p>
                        <p class="ps-train-date-label">${new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'short'})}</p>
                    </div>
                    <button class="ps-btn-finish-session" onclick="window.PlayerShellEngine._confirmEndSession()">
                        FINALIZAR
                    </button>
                </div>

                <!-- Exercise List -->
                <div class="ps-exercise-list" id="ps-exercise-list">
                    ${mobilityHTML}
                    ${exerciseCardsHTML}
                </div>

            </div>
        `;
    },

    /* Opens the "Add Set" bottom sheet — only Weight, Sets, Reps */
    _openLogSetModal: function (exIdx) {
        this.state._logTargetExIdx = exIdx;
        const ex = this.state.session.exercises[exIdx];
        if (!ex) return;

        this._openModal(`
            <div class="ps-modal-handle"></div>
            <div class="ps-modal-header-row">
                <div>
                    <h3 class="ps-modal-title">${ex.name}</h3>
                    <p class="ps-modal-subtitle">${ex.group} · Fatiga ${['','Baja','Media','Alta'][ex.fatigue]}</p>
                </div>
                <button class="ps-btn-close-modal" onclick="window.PlayerShellEngine._closeModal()">✕</button>
            </div>

            <div class="ps-log-form-grid">
                <div class="ps-form-group">
                    <label class="ps-form-label">PESO (kg)</label>
                    <input type="number" inputmode="decimal" class="ps-form-input ps-log-input"
                           id="ps-log-weight" step="0.5" min="0" placeholder="0" autofocus>
                </div>
                <div class="ps-form-group">
                    <label class="ps-form-label">SERIES</label>
                    <input type="number" inputmode="numeric" class="ps-form-input ps-log-input"
                           id="ps-log-sets" min="1" max="20" placeholder="4">
                </div>
                <div class="ps-form-group">
                    <label class="ps-form-label">REPS</label>
                    <input type="number" inputmode="numeric" class="ps-form-input ps-log-input"
                           id="ps-log-reps" min="1" max="50" placeholder="10">
                </div>
            </div>

            <div class="ps-tonnage-preview" id="ps-tonnage-preview">Tonelaje: — kg</div>

            <button class="ps-btn-massive" onclick="window.PlayerShellEngine._saveSet()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                GUARDAR SERIE
            </button>
        `);

        // Live tonnage preview
        requestAnimationFrame(() => {
            const inputs = ['ps-log-weight','ps-log-sets','ps-log-reps'].map(id => document.getElementById(id));
            const preview = document.getElementById('ps-tonnage-preview');
            const update = () => {
                const w = parseFloat(inputs[0]?.value) || 0;
                const s = parseInt(inputs[1]?.value) || 0;
                const r = parseInt(inputs[2]?.value) || 0;
                if (preview) preview.textContent = w && s && r ? `Tonelaje: ${(w * s * r).toFixed(0)} kg` : 'Tonelaje: — kg';
            };
            inputs.forEach(i => { if (i) i.addEventListener('input', update); });
        });
    },

    _saveSet: function () {
        const idx    = this.state._logTargetExIdx;
        const weight = parseFloat(document.getElementById('ps-log-weight')?.value) || 0;
        const sets   = parseInt(document.getElementById('ps-log-sets')?.value) || 0;
        const reps   = parseInt(document.getElementById('ps-log-reps')?.value) || 0;

        if (!weight || !sets || !reps) {
            this._showToast('⚠️ Completa Peso, Series y Reps');
            return;
        }

        const ex = this.state.session.exercises[idx];
        ex.sets.push({ weight, sets, reps, tonnage: weight * sets * reps, loggedAt: new Date().toISOString() });

        this._closeModal();
        this._showToast(`✅ ${ex.name} · ${weight}kg × ${reps} reps`);
        this._renderTrainingView();
    },

    /* Confirm end session — opens RPE capture modal */
    _confirmEndSession: function () {
        this._openModal(`
            <div class="ps-modal-handle"></div>
            <div style="text-align:center; padding:8px 0 4px;">
                <div style="font-size:3rem; margin-bottom:8px;">📊</div>
                <h3 class="ps-modal-title">¿Cómo fue la sesión?</h3>
                <p class="ps-modal-subtitle" style="margin-top:4px;">Registrá tu RPE general antes de cerrar.</p>
            </div>
            <div class="ps-hooper-row" style="border-bottom:none;">
                <div class="ps-hooper-header">
                    <span class="ps-hooper-label">ESFUERZO PERCIBIDO (RPE)</span>
                    <span class="ps-hooper-val" id="ps-end-rpe-display" style="color:var(--yellow);">7</span>
                </div>
                <div class="ps-rpe-slider-wrap">
                    <input type="range" class="ps-rpe-slider" id="ps-end-rpe"
                           min="0" max="10" value="7" step="1"
                           oninput="(function(el){
                               var v=parseInt(el.value);
                               var d=document.getElementById('ps-end-rpe-display');
                               if(d){d.textContent=v; d.style.color=v>=8?'var(--red)':v>=5?'var(--yellow)':'var(--green)';}
                           })(this)">
                </div>
                <div class="ps-rpe-labels"><span>Muy Fácil (0)</span><span>Máximo (10)</span></div>
            </div>
            <button class="ps-btn-massive" onclick="window.PlayerShellEngine._finalizeSession()">
                CONFIRMAR Y CERRAR SESIÓN
            </button>
            <button class="ps-btn-secondary" onclick="window.PlayerShellEngine._closeModal()">
                Seguir entrenando
            </button>
        `);
    },

    /* Finalize session — packages data for Supabase, stops timer */
    _finalizeSession: async function () {
        const rpeEl = document.getElementById('ps-end-rpe');
        const rpe   = rpeEl ? parseInt(rpeEl.value) : 7;
        const uid   = localStorage.getItem('ravix_v5_uid');

        this._closeModal();
        PSTimer.hide();

        const sess = this.state.session;
        const durationSecs = PSTimer._seconds || 0;

        // Build Supabase-ready payload
        const sessionPayload = {
            player_id:    uid,
            team_id:      this.state.user?.team_id || null,
            session_id:   sess.sessionId,
            fecha:        new Date().toISOString().split('T')[0],
            started_at:   sess.startedAt,
            ended_at:     new Date().toISOString(),
            duration_min: Math.round(durationSecs / 60),
            rpe_score:    rpe,
            exercises:    sess.exercises.map(ex => ({
                name:    ex.name,
                group:   ex.group,
                fatigue: ex.fatigue,
                sets:    ex.sets
            })),
            total_tonnage: sess.exercises.reduce((acc, ex) =>
                acc + ex.sets.reduce((a, s) => a + (s.tonnage || 0), 0), 0),
            created_at: new Date().toISOString(),
        };

        // Attempt Supabase insert (non-blocking)
        try {
            if (window.supabase) {
                const { error } = await window.supabase
                    .from('player_training_logs')
                    .insert([sessionPayload]);
                if (error) console.warn('[PSE] training log insert:', error.message);
            }
        } catch (e) {
            console.warn('[PSE] training log failed (will retry later):', e);
        }

        // Reset session state
        this.state.session.active    = false;
        this.state.session.sessionId = null;
        this.state.session.exercises = [];

        this._showToast('🏆 Sesión finalizada — ¡Excelente trabajo!');
        setTimeout(() => this._renderHomeView(), 800);
    },

    /* ────────────────────────────────────────────
       WELLNESS MODAL (Bottom Sheet)
    ──────────────────────────────────────────── */
    _openWellnessModal: function () {
        if (this.state.wellness) {
            const w = this.state.wellness;
            this._openModal(`
                <div class="ps-modal-handle"></div>
                <div class="ps-modal-header-row">
                    <div>
                        <h3 class="ps-modal-title">Wellness de Hoy</h3>
                        <p class="ps-modal-subtitle">Ya completaste el laboratorio.</p>
                    </div>
                    <button class="ps-btn-close-modal" onclick="window.PlayerShellEngine._closeModal()">✕</button>
                </div>
                <div class="ps-wellness-summary">
                    <div class="ps-wellness-row">
                        <span class="ps-wellness-row-label">Sueño</span>
                        <span class="ps-wellness-row-val">${w.sleep_quality || '—'} / 5</span>
                    </div>
                    <div class="ps-wellness-row">
                        <span class="ps-wellness-row-label">Estrés</span>
                        <span class="ps-wellness-row-val">${w.stress_level || '—'} / 5</span>
                    </div>
                    <div class="ps-wellness-row">
                        <span class="ps-wellness-row-label">Fatiga</span>
                        <span class="ps-wellness-row-val">${w.fatigue || '—'} / 5</span>
                    </div>
                    <div class="ps-wellness-row">
                        <span class="ps-wellness-row-label">RPE Sesión</span>
                        <span class="ps-wellness-row-val" style="color:var(--accent);">${w.rpe_score || '—'} / 10</span>
                    </div>
                </div>
                <button class="ps-btn-secondary" onclick="window.PlayerShellEngine._closeModal()">Cerrar</button>
            `);
            return;
        }

        this._wellnessForm = { sleep: 3, stress: 3, fatigue: 3, rpe: 5 };

        this._openModal(`
            <div class="ps-modal-handle"></div>
            <div class="ps-modal-header-row">
                <div>
                    <h3 class="ps-modal-title">Laboratorio Wellness</h3>
                    <p class="ps-modal-subtitle">Escala de Hooper — ¿Cómo llegás hoy?</p>
                </div>
                <button class="ps-btn-close-modal" onclick="window.PlayerShellEngine._closeModal()">✕</button>
            </div>

            ${['sleep|SUEÑO', 'stress|ESTRÉS', 'fatigue|FATIGA'].map(m => {
                const [id, label] = m.split('|');
                return `
                <div class="ps-hooper-row">
                    <div class="ps-hooper-header">
                        <span class="ps-hooper-label">${label}</span>
                        <span class="ps-hooper-val" id="pswl-val-${id}">3</span>
                    </div>
                    <div class="ps-hooper-blocks">
                        ${[1,2,3,4,5].map(n =>
                            `<button class="ps-hooper-btn${n===3?' active':''}" data-val="${n}" data-metric="${id}">${n}</button>`
                        ).join('')}
                    </div>
                </div>`;
            }).join('')}

            <div class="ps-hooper-row">
                <div class="ps-hooper-header">
                    <span class="ps-hooper-label">Esfuerzo Percibido (RPE)</span>
                    <span class="ps-hooper-val" id="pswl-rpe-display" style="color:var(--yellow);">5</span>
                </div>
                <div class="ps-rpe-slider-wrap">
                    <input type="range" class="ps-rpe-slider" id="pswl-rpe-slider"
                           min="0" max="10" value="5" step="1"
                           oninput="window.PlayerShellEngine._onRpeInput(this)">
                </div>
                <div class="ps-rpe-labels"><span>Muy Fácil (0)</span><span>Máximo (10)</span></div>
            </div>

            <button class="ps-btn-massive" id="pswl-submit-btn"
                    onclick="window.PlayerShellEngine._submitWellness()">
                ENVIAR REPORTE AL CUERPO TÉCNICO
            </button>
        `);

        requestAnimationFrame(() => this._setupWellnessInteractions());
    },

    _renderWellnessView: function () {
        this._openWellnessModal();
    },

    _setupWellnessInteractions: function () {
        document.querySelectorAll('.ps-hooper-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const metric = btn.dataset.metric;
                const val    = parseInt(btn.dataset.val);
                btn.closest('.ps-hooper-blocks').querySelectorAll('.ps-hooper-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const valEl = document.getElementById('pswl-val-' + metric);
                if (valEl) valEl.textContent = val;
                if (this._wellnessForm) this._wellnessForm[metric] = val;
            });
        });
    },

    _onRpeInput: function (slider) {
        const val     = parseInt(slider.value);
        const display = document.getElementById('pswl-rpe-display');
        if (!display) return;
        display.textContent = val;
        display.style.color = val >= 8 ? 'var(--red)' : val >= 5 ? 'var(--yellow)' : 'var(--green)';
        if (this._wellnessForm) this._wellnessForm.rpe = val;
    },

    _submitWellness: async function () {
        const btn = document.getElementById('pswl-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'ENVIANDO...'; }

        try {
            const uid  = localStorage.getItem('ravix_v5_uid');
            const form = this._wellnessForm || {};
            const rpeSlider = document.getElementById('pswl-rpe-slider');
            if (rpeSlider) form.rpe = parseInt(rpeSlider.value);

            const payload = {
                player_id:     uid,
                fecha:         new Date().toISOString().split('T')[0],
                sleep_quality: form.sleep  || 3,
                stress_level:  form.stress || 3,
                fatigue:       form.fatigue || 3,
                rpe_score:     form.rpe    || 5,
                created_at:    new Date().toISOString()
            };

            await window.supabase.from('player_wellness').upsert([payload], { onConflict: 'player_id,fecha' });
            this.state.wellness = payload;
            this._closeModal();
            this._showToast('✅ Reporte enviado con éxito');
            setTimeout(() => this._renderHomeView(), 600);
        } catch (err) {
            console.error('[PSE] _submitWellness:', err);
            if (btn) { btn.disabled = false; btn.textContent = 'ENVIAR REPORTE AL CUERPO TÉCNICO'; }
        }
    },

    /* ────────────────────────────────────────────
       ATTENDANCE VIEW (placeholder)
    ──────────────────────────────────────────── */
    _renderAttendanceView: function () {
        const body = document.getElementById('ps-body');
        if (!body) return;
        body.innerHTML = `
            <div class="ps-view active">
                <div class="ps-greeting-section">
                    <p class="ps-date-label">HISTORIAL</p>
                    <h1 class="ps-greeting">Asistencia</h1>
                </div>
                <div class="ps-panel">
                    <div class="ps-panel-header">
                        <h3 class="ps-panel-title">Registro de Sesiones</h3>
                        <span class="ps-panel-badge">${this.state.attendance.length} sesiones</span>
                    </div>
                    <div class="ps-empty-state">
                        <span class="ps-empty-icon">📅</span>
                        Próximamente — historial de asistencia y carga semanal.
                    </div>
                </div>
            </div>
        `;
    },

    /* ────────────────────────────────────────────
       TEAM JOIN
    ──────────────────────────────────────────── */
    _joinTeam: async function (code) {
        if (!code || !code.trim()) return;
        const btn = document.getElementById('onboarding-connect-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'CONECTANDO...'; }

        try {
            const uid       = localStorage.getItem('ravix_v5_uid');
            const upperCode = code.trim().toUpperCase();
            const { data: teamData, error: teamErr } = await window.supabase
                .from('teams').select('id').eq('invite_code', upperCode).limit(1);

            if (teamErr) throw teamErr;
            if (!teamData || teamData.length === 0) {
                if (btn) { btn.disabled = false; btn.textContent = 'CONECTAR'; }
                this._showToast('Código inválido — verificá con tu DT');
                return;
            }

            const { error: insertErr } = await window.supabase
                .from('team_roster').insert([{ team_id: teamData[0].id, player_id: uid }]);
            if (insertErr) throw insertErr;

            this._showToast('¡Vinculado con éxito!');
            const nav = document.getElementById('ps-bottom-nav');
            if (nav) nav.style.display = 'flex';
            this._closeModal();
            setTimeout(() => window.location.reload(), 800);

        } catch (err) {
            console.error('[PSE] _joinTeam:', err);
            this._showToast('Error de vinculación — reintentá');
            if (btn) { btn.disabled = false; btn.textContent = 'CONECTAR'; }
        }
    },

    /* ────────────────────────────────────────────
       TOAST
    ──────────────────────────────────────────── */
    _showToast: function (msg) {
        const prev = document.getElementById('ps-toast');
        if (prev) prev.remove();
        const toast = document.createElement('div');
        toast.id        = 'ps-toast';
        toast.className = 'ps-toast';
        toast.textContent = msg;
        const shell = document.getElementById('player-shell') || document.body;
        shell.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};
