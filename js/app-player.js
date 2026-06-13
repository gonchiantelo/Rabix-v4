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

    /* ── Estado interno ── */
    state: {
        user: null,     // Perfil desde team_roster
        wellness: null, // Último registro de player_wellness
        attendance: [], // Historial de player_attendance
        activeTab: 'home',
    },

    /* ═════════════════════════════════
       BOOT — Punto de entrada único
    ════════════════════════════════= */
    boot: function () {
        console.log('[PLAYER SHELL] Booting Mundo Atleta...');

        // ── 1. Garantizar que el CSS exclusivo esté inyectado ──
        if (!document.querySelector('link[href="css/app-player.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/app-player.css';
            document.head.appendChild(link);
            console.log('[PLAYER SHELL] CSS inyectado: css/app-player.css');
        }

        // ── 2. Garantizar que el #player-shell exista en el DOM ──
        let shell = document.getElementById('player-shell');
        if (!shell) {
            shell = this._buildShellDOM();
            document.body.appendChild(shell);
            console.log('[PLAYER SHELL] #player-shell creado e insertado en el DOM.');
        }

        // ── 3. BIFURCACIÓN DE ROLES: Ocultar el #app-shell del DT ──
        const dtAppShell = document.getElementById('app-shell');
        if (dtAppShell) {
            dtAppShell.style.display = 'none';
            dtAppShell.setAttribute('aria-hidden', 'true');
            console.log('[PLAYER SHELL] #app-shell del DT ocultado.');
        }

        // Ocultar también el Hub del DT
        const dtHub = document.getElementById('view-dt-hub');
        if (dtHub) {
            dtHub.classList.remove('vista-activa');
        }

        // ── 4. Activar el shell ──
        requestAnimationFrame(() => {
            shell.classList.add('ps-active');
        });

        // ── 5. Cargar datos del jugador en background ──
        this._fetchPlayerData();
    },

    /* ═════════════════════════════════
       CONSTRUCCIÓN DEL HTML BASE
    ════════════════════════════════= */
    _buildShellDOM: function () {
        const shell = document.createElement('div');
        shell.id = 'player-shell';
        shell.setAttribute('role', 'main');
        shell.setAttribute('aria-label', 'Portal del Jugador');

        shell.innerHTML = `
            <!-- ═══ HEADER ═══ -->
            <header class="ps-header" id="ps-header">
                <div class="ps-header-brand">
                    <div class="ps-header-logo">RAVI<span>X</span></div>
                    <div class="ps-header-role-pill">
                        <span class="ps-header-role-dot"></span>
                        Jugador
                    </div>
                </div>
                <div class="ps-header-identity">
                    <div class="ps-header-name" id="ps-player-name">—</div>
                    <div class="ps-header-team" id="ps-player-team">—</div>
                </div>
            </header>

            <!-- ═══ SCROLL BODY ═══ -->
            <div class="ps-body" id="ps-body">
                <!-- Vista inicial: Boot Screen -->
                <div class="ps-boot" id="ps-boot-screen">
                    <div class="ps-boot-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" stroke-width="2" stroke-linecap="round">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                        </svg>
                    </div>

                    <div>
                        <div class="ps-boot-badge">Mundo Atleta · RAVIX V5</div>
                    </div>

                    <div>
                        <h1 class="ps-boot-title">
                            Bienvenido al Laboratorio.
                            <em>Cargando tu microciclo...</em>
                        </h1>
                    </div>

                    <p class="ps-boot-desc">
                        Conectando con tu equipo y sincronizando
                        los datos de rendimiento del día.
                    </p>

                    <div class="ps-spinner"></div>

                    <div class="ps-boot-status" id="ps-boot-status">
                        INICIALIZANDO PROTOCOLO COMETTI
                    </div>
                </div>
            </div>

            <!-- ═══ BOTTOM NAV ═══ -->
            <nav class="ps-bottom-nav" id="ps-bottom-nav" aria-label="Navegación principal del jugador">
                <button class="ps-nav-btn ps-nav-active" id="ps-nav-home"
                        onclick="window.PlayerShellEngine.switchTab('home', this)"
                        aria-label="Inicio" aria-current="page">
                    <span class="ps-nav-icon">⚡</span>
                    <span class="ps-nav-label">Inicio</span>
                </button>
                <button class="ps-nav-btn" id="ps-nav-wellness"
                        onclick="window.PlayerShellEngine.switchTab('wellness', this)"
                        aria-label="Wellness">
                    <span class="ps-nav-icon">🔋</span>
                    <span class="ps-nav-label">Wellness</span>
                </button>
                <button class="ps-nav-btn" id="ps-nav-attendance"
                        onclick="window.PlayerShellEngine.switchTab('attendance', this)"
                        aria-label="Asistencia">
                    <span class="ps-nav-icon">📅</span>
                    <span class="ps-nav-label">Asistencia</span>
                </button>
                <button class="ps-nav-btn" id="ps-nav-profile"
                        onclick="window.PlayerShellEngine.switchTab('profile', this)"
                        aria-label="Mi Perfil">
                    <span class="ps-nav-icon">👤</span>
                    <span class="ps-nav-label">Perfil</span>
                </button>
            </nav>
        `;

        return shell;
    },

    /* ═════════════════════════════════
       FETCH — Datos desde Supabase
       Tablas: team_roster, player_wellness, player_attendance
    ════════════════════════════════= */
    _fetchPlayerData: async function () {
        const uid = localStorage.getItem('ravix_v5_uid');
        if (!uid) {
            this._updateBootStatus('Error: Sesión no encontrada.');
            return;
        }

        try {
            this._updateBootStatus('LEYENDO ROSTER DEL EQUIPO...');

            // ── Leer perfil desde team_roster ──
            const { data: rosterRows, error: rosterErr } = await window.supabase
                .from('team_roster')
                .select('*')
                .eq('user_id', uid)
                .limit(1);

            if (rosterErr) throw new Error('team_roster: ' + rosterErr.message);

            const playerRow = rosterRows && rosterRows.length > 0 ? rosterRows[0] : null;
            this.state.user = playerRow;

            // ── Actualizar header con identidad ──
            this._hydrateHeader(playerRow);

            this._updateBootStatus('CARGANDO WELLNESS DEL DÍA...');

            // ── Leer último registro de wellness ──
            const today = new Date().toISOString().split('T')[0];
            const { data: wellnessRows, error: wellnessErr } = await window.supabase
                .from('player_wellness')
                .select('*')
                .eq('player_id', uid)
                .eq('fecha', today)
                .limit(1);

            if (!wellnessErr && wellnessRows && wellnessRows.length > 0) {
                this.state.wellness = wellnessRows[0];
            }

            this._updateBootStatus('VERIFICANDO ASISTENCIA...');

            // ── Leer últimos 7 registros de asistencia ──
            const { data: attendRows, error: attendErr } = await window.supabase
                .from('player_attendance')
                .select('*')
                .eq('player_id', uid)
                .order('fecha', { ascending: false })
                .limit(7);

            if (!attendErr && attendRows) {
                this.state.attendance = attendRows;
            }

            this._updateBootStatus('MICROCICLO LISTO ✓');

            // ── Transición al home view ──
            setTimeout(() => this._renderHomeView(), 600);

        } catch (err) {
            console.error('[PLAYER SHELL] Error cargando datos:', err);
            this._updateBootStatus('⚠️ Error de conexión. Reintentando...');
            // Mostrar home vacío igualmente para no bloquear al usuario
            setTimeout(() => this._renderHomeView(), 1500);
        }
    },

    /* ═════════════════════════════════
       HIDRATACIÓN DEL HEADER
    ════════════════════════════════= */
    _hydrateHeader: function (playerRow) {
        const nameEl = document.getElementById('ps-player-name');
        const teamEl = document.getElementById('ps-player-team');

        if (nameEl) {
            const name = playerRow?.full_name
                || playerRow?.nombre_completo
                || window.CurrentUser?.full_name
                || 'Atleta';
            nameEl.textContent = name.split(' ')[0];
        }

        if (teamEl) {
            const team = playerRow?.team_name
                || window.CurrentTeam?.name
                || playerRow?.equipo
                || 'Mi Equipo';
            teamEl.textContent = team.toUpperCase();
        }
    },

    /* ═════════════════════════════════
       RENDER — Vista HOME
    ════════════════════════════════= */
    _renderHomeView: function () {
        const body = document.getElementById('ps-body');
        if (!body) return;

        const player = this.state.user;
        const wellness = this.state.wellness;
        const attendance = this.state.attendance;

        const firstName = player?.full_name?.split(' ')[0]
            || player?.nombre_completo?.split(' ')[0]
            || 'Atleta';

        const position = player?.position || player?.posicion || '—';
        const sport    = player?.sport    || player?.deporte   || '—';

        const wellnessDone = !!wellness;
        const attendCount  = attendance.length;

        const now = new Date();
        const dateStr = now.toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long'
        }).toUpperCase();

        body.innerHTML = `
            <!-- Date header -->
            <div class="ps-section" style="padding-top: 24px;">
                <p style="font-size: 0.62rem; font-weight: 800; letter-spacing: 3px;
                          color: rgba(191,255,0,0.6); text-transform: uppercase;">${dateStr}</p>
                <h2 style="font-size: 1.5rem; font-weight: 900; letter-spacing: -0.5px;
                           color: #F0F0F0; line-height: 1.2;">
                    Buenas, <span style="color: #BFFF00;">${firstName}</span>
                </h2>
                <p style="font-size: 0.72rem; font-weight: 700; letter-spacing: 2px;
                          color: rgba(255,255,255,0.3); text-transform: uppercase;">
                    ${sport} · ${position}
                </p>
            </div>

            <!-- KPI Pills -->
            <div class="ps-section">
                <div class="ps-stat-row">
                    <div class="ps-stat-pill">
                        <span class="ps-stat-val ps-stat-val--volt">${attendCount}</span>
                        <span class="ps-stat-label">Asistencias</span>
                    </div>
                    <div class="ps-stat-pill">
                        <span class="ps-stat-val ${wellnessDone ? 'ps-stat-val--volt' : ''}">${wellnessDone ? '✓' : '—'}</span>
                        <span class="ps-stat-label">Wellness Hoy</span>
                    </div>
                    <div class="ps-stat-pill">
                        <span class="ps-stat-val ps-stat-val--muted">—</span>
                        <span class="ps-stat-label">Carga Semanal</span>
                    </div>
                </div>
            </div>

            <div class="ps-divider"></div>

            <!-- Microcycle Card -->
            <div class="ps-section">
                <span class="ps-section-label">Microciclo Activo</span>
                <div class="ps-card">
                    <div class="ps-card-inner">
                        <div class="ps-card-header">
                            <div class="ps-card-icon ps-card-icon--volt">⚡</div>
                            <div>
                                <div class="ps-card-title">Sesión de Hoy</div>
                                <div class="ps-card-subtitle">Protocolo del DT</div>
                            </div>
                        </div>
                        <div id="ps-today-session" style="text-align: center; padding: 20px 0;">
                            <div class="ps-empty-icon">📭</div>
                            <div class="ps-card-subtitle" style="margin-top: 8px;">
                                Sin sesión asignada para hoy.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Wellness Quick-Check -->
            <div class="ps-section">
                <span class="ps-section-label">Estado del día</span>
                <div class="ps-card" id="ps-wellness-card">
                    <div class="ps-card-inner">
                        <div class="ps-card-header">
                            <div class="ps-card-icon ps-card-icon--gold">🔋</div>
                            <div>
                                <div class="ps-card-title">Wellness</div>
                                <div class="ps-card-subtitle">ESCALA DE HOOPER</div>
                            </div>
                        </div>
                        ${wellnessDone
                            ? `<div style="display:flex; align-items:center; gap:10px; padding:12px;
                                          background:rgba(191,255,0,0.05); border:1px solid rgba(191,255,0,0.15);
                                          border-radius:12px;">
                                   <span style="font-size:1.5rem;">✅</span>
                                   <div>
                                       <div style="font-size:0.85rem; font-weight:700; color:#F0F0F0;">Reporte enviado</div>
                                       <div style="font-size:0.65rem; font-weight:600; color:rgba(255,255,255,0.4); margin-top:2px;">Hoy ya registraste tu estado.</div>
                                   </div>
                               </div>`
                            : `<button onclick="window.PlayerShellEngine.switchTab('wellness', null)"
                                       style="width:100%; padding:14px; background:rgba(191,255,0,0.1);
                                              border:1px solid rgba(191,255,0,0.25); border-radius:12px;
                                              color:#BFFF00; font-family:'Outfit',sans-serif; font-size:0.85rem;
                                              font-weight:800; letter-spacing:1px; cursor:pointer;
                                              text-transform:uppercase; transition:all 0.2s;">
                                   Registrar Estado de Hoy →
                               </button>`
                        }
                    </div>
                </div>
            </div>

            <!-- Attendance recent -->
            ${attendance.length > 0 ? `
            <div class="ps-section" style="padding-bottom: 16px;">
                <span class="ps-section-label">Asistencia Reciente</span>
                <div class="ps-card">
                    <div class="ps-card-inner">
                        ${attendance.slice(0, 5).map(a => `
                            <div style="display:flex; justify-content:space-between; align-items:center;
                                        padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
                                <span style="font-size:0.82rem; font-weight:600; color:rgba(255,255,255,0.6);">
                                    ${a.fecha || '—'}
                                </span>
                                <span style="font-size:0.72rem; font-weight:800; letter-spacing:1px;
                                             color:${a.presente ? '#10B981' : '#FF4D4D'};">
                                    ${a.presente ? 'PRESENTE' : 'AUSENTE'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>` : ''}
        `;

        this.state.activeTab = 'home';
    },

    /* ═════════════════════════════════
       NAVEGACIÓN DE TABS
    ════════════════════════════════= */
    switchTab: function (tabId, btnEl) {
        // Actualizar estado visual del nav
        document.querySelectorAll('.ps-nav-btn').forEach(b => {
            b.classList.remove('ps-nav-active');
            b.removeAttribute('aria-current');
        });

        if (btnEl) {
            btnEl.classList.add('ps-nav-active');
            btnEl.setAttribute('aria-current', 'page');
        } else {
            // Activar por tabId si no hay elemento
            const navBtn = document.getElementById('ps-nav-' + tabId);
            if (navBtn) {
                navBtn.classList.add('ps-nav-active');
                navBtn.setAttribute('aria-current', 'page');
            }
        }

        switch (tabId) {
            case 'home':
                this._renderHomeView();
                break;
            case 'wellness':
                this._showComingSoon('🔋', 'Wellness', 'Registra tu estado físico diario (Hooper Scale). Próximamente.');
                break;
            case 'attendance':
                this._showComingSoon('📅', 'Asistencia', 'Historial completo de presencias y ausencias. Próximamente.');
                break;
            case 'profile':
                this._showComingSoon('👤', 'Mi Perfil', 'Configuración de tu perfil y datos biométricos. Próximamente.');
                break;
            default:
                this._renderHomeView();
        }

        this.state.activeTab = tabId;
    },

    /* ═════════════════════════════════
       HELPERS
    ════════════════════════════════= */
    _updateBootStatus: function (msg) {
        const el = document.getElementById('ps-boot-status');
        if (el) el.textContent = msg;
    },

    _showComingSoon: function (icon, title, desc) {
        const body = document.getElementById('ps-body');
        if (!body) return;
        body.innerHTML = `
            <div class="ps-boot" style="min-height: calc(100dvh - 132px);">
                <div class="ps-boot-icon" style="font-size: 2rem;">${icon}</div>
                <div>
                    <div class="ps-boot-badge">Módulo en Construcción</div>
                </div>
                <h2 class="ps-boot-title">${title}</h2>
                <p class="ps-boot-desc">${desc}</p>
                <button onclick="window.PlayerShellEngine.switchTab('home', null)"
                        style="padding:12px 28px; background:rgba(191,255,0,0.1);
                               border:1px solid rgba(191,255,0,0.25); border-radius:12px;
                               color:#BFFF00; font-family:'Outfit',sans-serif; font-size:0.82rem;
                               font-weight:800; letter-spacing:1px; cursor:pointer; text-transform:uppercase;">
                    ← Volver al Inicio
                </button>
            </div>
        `;
    },

    logout: function () {
        localStorage.clear();
        location.reload();
    }
};


/* ══════════════════════════════════════════════════════════
   3. ATHLETE APP — Motor legacy del dashboard atleta
      Conservado para compatibilidad con #view-athlete-dashboard
      en index.html (path antiguo). No toca el #player-shell.
══════════════════════════════════════════════════════════ */
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
