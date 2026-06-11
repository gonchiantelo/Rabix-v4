/*
 ╔══════════════════════════════════════════════════════════════╗
 ║  RAVIX V5 — APP-PORTAL.JS                                   ║
 ║  Manager Hub (Portal del DT)                                ║
 ║  PROHIBIDO mezclar con app-dt.js                            ║
 ╚══════════════════════════════════════════════════════════════╝
 
 Responsabilidades:
   1. Renderizar el Hub del DT (#view-dt-hub)
   2. Cargar clubes/proyectos gestionados por el DT
   3. Navegar a un club → activa app-dt.js
   4. Fundar nuevo club → abre modal de creación
*/

window.PortalHub = (() => {
    // ── Estado interno ──────────────────────────────────────────────
    let _user = null;
    let _clubs = [];

    // ── Init público ────────────────────────────────────────────────
    async function init() {
        console.log('[HUB] Inicializando Portal del DT...');

        _user = window.CurrentUser || null;
        await _loadClubs();
        _render();
        _bindEvents();

        // Animar la entrada de las tarjetas con un stagger
        requestAnimationFrame(() => {
            document.querySelectorAll('.hub-club-card').forEach((card, i) => {
                card.style.animationDelay = `${i * 80}ms`;
                card.classList.add('hub-card--animate-in');
            });
        });

        console.log('[HUB] ✅ Renderizado completo.');
    }

    // ── Cargar clubes del DT desde Supabase ──────────────────────────
    async function _loadClubs() {
        try {
            const uid = localStorage.getItem('ravix_v5_uid');
            if (!uid) return;

            // Obtener todos los equipos donde el DT es dueño (owner_id)
            // y también teams donde el DT es miembro via team_members
            const { data: ownedTeams, error: ownErr } = await window.supabase
                .from('teams')
                .select('*')
                .eq('owner_id', uid)
                .order('created_at', { ascending: false });

            if (ownErr) {
                console.warn('[HUB] No se pudieron cargar los equipos:', ownErr.message);
                _clubs = [];
                return;
            }

            _clubs = ownedTeams || [];
            console.log(`[HUB] ${_clubs.length} club(s) cargado(s).`);

            // Obtener partidos disputados en la App (training_logs)
            window.AppInAppMatches = 0;
            if (_clubs.length > 0) {
                try {
                    const teamIds = _clubs.map(c => c.id);
                    const { count, error: countErr } = await window.supabase
                        .from('training_logs')
                        .select('*', { count: 'exact', head: true })
                        .in('team_id', teamIds)
                        .eq('tipo', 'Partido');
                        
                    if (!countErr) window.AppInAppMatches = count || 0;
                } catch(e) {}
            }
            
        } catch (e) {
            console.error('[HUB] Error cargando clubes:', e);
            _clubs = [];
        }
    }

    // ── Renderizado principal del Hub ────────────────────────────────
    function _render() {
        const container = document.getElementById('view-dt-hub');
        if (!container) {
            console.error('[HUB] #view-dt-hub no encontrado en el DOM');
            return;
        }

        const name = _user?.nombre_completo || _user?.name || 'DT RAVIX';
        const license = _user?.licencia || _user?.license || 'CONMEBOL PRO';
        const role = _user?.rol_staff || _user?.staff_role || 'DT Principal';

        // Generar iniciales para avatar
        const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

        // ── MOTOR DE ESTADÍSTICAS HÍBRIDO ──
        const histPartidos = parseInt(_user?.hist_partidos) || 0;
        const histTitulos = parseInt(_user?.hist_titulos) || 0;
        const histTemporadas = parseInt(_user?.hist_temporadas) || 0;
        const histVictorias = parseInt(_user?.hist_victorias) || 0;
        const histEmpates = parseInt(_user?.hist_empates) || 0;

        const inAppMatches = window.AppInAppMatches || 0;
        const totalPartidos = histPartidos + inAppMatches;
        const totalTemporadas = histTemporadas + _clubs.length;
        
        let efectividad = 0;
        if (totalPartidos > 0) {
            efectividad = Math.round(((histVictorias * 3 + histEmpates) / (totalPartidos * 3)) * 100);
        }

        const careerStats = [
            { icon: '⚽', label: 'Partidos Dirigidos', value: totalPartidos },
            { icon: '🏆', label: 'Títulos', value: histTitulos },
            { icon: '📅', label: 'Temporadas', value: totalTemporadas },
            { icon: '📈', label: 'Efectividad', value: efectividad > 0 ? `${efectividad}%` : '0%' },
        ];

        const statsHTML = careerStats.map(s => `
            <div class="hub-stat-card">
                <span class="hub-stat-icon">${s.icon}</span>
                <span class="hub-stat-value">${s.value}</span>
                <span class="hub-stat-label">${s.label}</span>
            </div>
        `).join('');

        // Tarjetas de clubes
        const clubsHTML = _clubs.length > 0
            ? _clubs.map(club => _renderClubCard(club)).join('')
            : `<div class="hub-empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                <p>Aún no gestionas ningún club.<br>Funda tu primera institución.</p>
               </div>`;

        // Tarjeta de fundar club
        const foundClubCard = `
            <div class="hub-club-card hub-club-card--new" id="hub-btn-found" role="button" tabindex="0"
                 aria-label="Fundar nuevo club" onclick="window.PortalHub.openFoundModal()">
                <div class="hub-new-inner">
                    <div class="hub-new-plus">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </div>
                    <p class="hub-new-label">Fundar Nuevo Club</p>
                    <p class="hub-new-sub">Inicia un proyecto desde cero</p>
                </div>
            </div>`;

        container.innerHTML = `
            <!-- ═══ HERO — Portada del DT ═══ -->
            <div class="hub-hero">
                <div class="hub-hero-banner">
                    <div class="hub-hero-banner-overlay"></div>
                    <div class="hub-hero-mesh hub-hero-mesh--1"></div>
                    <div class="hub-hero-mesh hub-hero-mesh--2"></div>
                </div>

                <div class="hub-hero-content">
                    <!-- Avatar -->
                    <div class="hub-avatar-wrap">
                        <div class="hub-avatar" id="hub-avatar-el" style="${_user?.avatar_url ? `background-image: url('${_user.avatar_url}'); background-size: cover; background-position: center;` : ''}">
                            <span class="hub-avatar-initials" style="${_user?.avatar_url ? 'display: none;' : ''}">${initials}</span>
                        </div>
                        <span class="hub-avatar-status" title="Online"></span>
                    </div>

                    <!-- Info -->
                    <div class="hub-hero-info">
                        <p class="hub-hero-role">${role.toUpperCase()}</p>
                        <h1 class="hub-hero-name">${name}</h1>
                        <div class="hub-hero-meta">
                            <span class="hub-license-badge">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                                ${license}
                            </span>
                            <span class="hub-prestige-badge">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                                Prestigio Global
                            </span>
                        </div>
                    </div>

                    <!-- Hub actions -->
                    <div class="hub-hero-actions">
                        <button class="hub-btn-secondary" onclick="window.App.logout()" id="hub-logout-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            Salir
                        </button>
                    </div>
                </div>
            </div>

            <div class="hub-content-wrapper">
                <!-- ═══ CAREER STATS ═══ -->
                <div class="hub-section">
                    <div class="hub-section-header">
                        <h2 class="hub-section-title">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                            Estadísticas de Carrera
                        </h2>
                        <span class="hub-section-tag">GLOBAL · TODOS LOS CLUBS</span>
                    </div>
                    <div class="hub-stats-grid">
                        ${statsHTML}
                    </div>
                </div>

                <!-- ═══ MIS PROYECTOS / CLUBES ═══ -->
                <div class="hub-section hub-section--clubs">
                    <div class="hub-section-header">
                        <h2 class="hub-section-title">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            Mis Proyectos
                        </h2>
                        <span class="hub-section-tag">${_clubs.length} CLUB${_clubs.length !== 1 ? 'S' : ''} ACTIVO${_clubs.length !== 1 ? 'S' : ''}</span>
                    </div>
                    <div class="hub-clubs-grid" id="hub-clubs-grid">
                        ${clubsHTML}
                        ${foundClubCard}
                    </div>
                </div>
            </div>

            <!-- ═══ MODAL: FUNDAR CLUB ═══ -->
            <div class="hub-modal-overlay hidden" id="hub-found-modal" role="dialog" aria-modal="true" aria-label="Fundar nuevo club">
                <div class="hub-modal">
                    <button class="hub-modal-close" onclick="window.PortalHub.closeFoundModal()" aria-label="Cerrar">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <div class="hub-modal-header">
                        <span class="hub-modal-icon">🏗️</span>
                        <h3 class="hub-modal-title">Fundar Nueva Institución</h3>
                        <p class="hub-modal-sub">Define el ADN de tu nuevo proyecto táctico</p>
                    </div>
                    <div class="hub-modal-body">
                        <div class="hub-field-group">
                            <label class="hub-field-label" for="hf-club-name">NOMBRE DEL CLUB</label>
                            <input type="text" id="hf-club-name" class="hub-field-input" placeholder="Ej: Atlético Madrid" maxlength="60">
                        </div>
                        <div class="hub-field-row">
                            <div class="hub-field-group">
                                <label class="hub-field-label" for="hf-league">LIGA / COMPETICIÓN</label>
                                <input type="text" id="hf-league" class="hub-field-input" placeholder="Ej: Primera División">
                            </div>
                            <div class="hub-field-group">
                                <label class="hub-field-label" for="hf-color">COLOR DEL CLUB</label>
                                <div class="hub-color-wrap">
                                    <input type="color" id="hf-color" class="hub-color-input" value="#079FA0">
                                    <span class="hub-color-preview" id="hf-color-preview">#079FA0</span>
                                </div>
                            </div>
                        </div>
                        <div class="hub-field-group">
                            <label class="hub-field-label" for="hf-methodology">METODOLOGÍA BASE</label>
                            <select id="hf-methodology" class="hub-field-input">
                                <option value="Periodización Táctica">Periodización Táctica</option>
                                <option value="Microciclo Estructurado">Microciclo Estructurado</option>
                                <option value="Entrenamiento Integrado">Entrenamiento Integrado</option>
                                <option value="Personalizada">Personalizada</option>
                            </select>
                        </div>
                        <div class="hub-modal-error hidden" id="hub-found-error"></div>
                        <button class="hub-btn-primary" id="hub-found-submit" onclick="window.PortalHub.foundClub()">
                            <span id="hub-found-btn-text">CREAR INSTITUCIÓN</span>
                            <span class="hub-btn-spinner hidden" id="hub-found-spinner"></span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Sync color preview
        const colorInput = document.getElementById('hf-color');
        if (colorInput) {
            colorInput.addEventListener('input', (e) => {
                const preview = document.getElementById('hf-color-preview');
                if (preview) preview.textContent = e.target.value;
            });
        }
    }

    // ── Render de tarjeta de club individual ────────────────────────
    function _renderClubCard(club) {
        const initials = (club.name || 'CL').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        const color = club.primary_color || '#079FA0';

        return `
            <div class="hub-club-card hub-card--animate-in" 
                 data-club-id="${club.id}"
                 onclick="window.PortalHub.enterClub('${club.id}', '${encodeURIComponent(club.name || '')}')"
                 role="button" tabindex="0"
                 aria-label="Entrar al Centro de Comando de ${club.name || 'Club'}">
                <div class="hub-club-card-header">
                    <div class="hub-club-shield" style="--club-color: ${color}">
                        <span>${initials}</span>
                    </div>
                    <div class="hub-club-code">${club.code || '—'}</div>
                </div>
                <div class="hub-club-card-body">
                    <h3 class="hub-club-name">${club.name || 'Club sin nombre'}</h3>
                    <p class="hub-club-meta">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg>
                        Activo
                    </p>
                </div>
                <button class="hub-club-cta">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    Entrar al Centro de Comando
                </button>
            </div>
        `;
    }

    // ── Entrar a un club específico ──────────────────────────────────
    function enterClub(clubId, encodedName) {
        const clubName = decodeURIComponent(encodedName);
        console.log(`[HUB] Entrando al club: ${clubName} (${clubId})`);

        // Persistir el club activo
        localStorage.setItem('ravix_team_id', clubId);
        localStorage.setItem('ravix_active_club_name', clubName);

        // Obtener los datos completos del club y navegar al dashboard
        const club = _clubs.find(c => c.id === clubId);
        if (club) {
            window.CurrentTeam = { ...club, id: clubId };
        }

        // Delegar transición al Router
        _launchDTEngine(clubId);
    }

    // ── Lanzar el motor del DT (app-dt.js) ──────────────────────────
    function _launchDTEngine(clubId) {
        // B. Manipulación de clases estricta (Router Bypass Local)
        const hub = document.getElementById('view-dt-hub');
        const shell = document.getElementById('app-shell');
        
        if (hub) hub.classList.remove('vista-activa');
        if (shell) shell.classList.add('vista-activa');

        // C. Actualiza el hash de la URL a #home
        window.location.hash = '#home';

        // Si DTEngine ya está cargado, redirigir directamente
        if (window.DTEngine) {
            console.log('[HUB] DTEngine ya disponible. Cargando dashboard...');
            // D. Arranque del Motor
            window.DTEngine.renderDashboard();
            return;
        }

        // Cargar CSS del DT si no está cargado
        if (!document.querySelector('link[href="css/styles-dt.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'css/styles-dt.css';
            document.head.appendChild(link);
        }

        // Cargar app-dt.js dinámicamente
        const script = document.createElement('script');
        script.src = 'js/app-dt.js';
        script.onload = () => {
            if (window.DTEngine) {
                // D. Arranque del Motor (post-carga)
                window.DTEngine.renderDashboard();
                console.log('[HUB] ✅ DTEngine cargado y dashboard activo.');
            } else {
                console.error('[HUB] app-dt.js cargó pero no expone DTEngine');
                window.App._showPortalWithError('Error al iniciar el Centro de Comando.');
            }
        };
        script.onerror = () => {
            console.error('[HUB] Error cargando app-dt.js');
            window.App._showPortalWithError('No se pudo cargar el Centro de Comando.');
        };
        document.body.appendChild(script);
    }

    // ── Modal: Fundar club ───────────────────────────────────────────
    function openFoundModal() {
        const modal = document.getElementById('hub-found-modal');
        if (modal) {
            modal.classList.remove('hidden');
            requestAnimationFrame(() => modal.classList.add('hub-modal--open'));
            // Focus primer campo
            setTimeout(() => document.getElementById('hf-club-name')?.focus(), 100);
        }
    }

    function closeFoundModal() {
        const modal = document.getElementById('hub-found-modal');
        if (modal) {
            modal.classList.remove('hub-modal--open');
            setTimeout(() => modal.classList.add('hidden'), 300);
        }
    }

    async function foundClub() {
        const nameEl = document.getElementById('hf-club-name');
        const leagueEl = document.getElementById('hf-league');
        const colorEl = document.getElementById('hf-color');
        const methodEl = document.getElementById('hf-methodology');
        const errorEl = document.getElementById('hub-found-error');
        const btnText = document.getElementById('hub-found-btn-text');
        const spinner = document.getElementById('hub-found-spinner');

        const name = nameEl?.value.trim();
        if (!name) {
            if (errorEl) { errorEl.textContent = 'El nombre del club es requerido.'; errorEl.classList.remove('hidden'); }
            nameEl?.focus();
            return;
        }
        if (errorEl) errorEl.classList.add('hidden');

        // Loading state
        if (btnText) btnText.textContent = 'Creando...';
        if (spinner) spinner.classList.remove('hidden');

        try {
            const uid = localStorage.getItem('ravix_v5_uid');
            const code = 'CU-' + Math.floor(1000 + Math.random() * 9000);
            const color = colorEl?.value || '#079FA0';
            const league = leagueEl?.value.trim() || null;
            const methodology = methodEl?.value || 'Periodización Táctica';

            // Crear el equipo
            const { data: newTeam, error: teamErr } = await window.supabase
                .from('teams')
                .insert([{ name, owner_id: uid, code }])
                .select()
                .single();

            if (teamErr) throw new Error(teamErr.message);

            // Crear config del equipo
            await window.supabase.from('team_configs').insert([{
                team_id: newTeam.id,
                owner_id: uid,
                primary_color: color,
                methodology,
                base_systems: null
            }]);

            // Actualizar el perfil del DT para vincular el club_actual
            // (solo si no tiene ningún club asignado aún)
            if (!_user?.club_actual) {
                await window.supabase
                    .from('profiles_dt')
                    .update({ club_actual: newTeam.id })
                    .eq('id', uid);
            }

            console.log(`[HUB] ✅ Club "${name}" creado con ID: ${newTeam.id}`);

            closeFoundModal();

            // Añadir el nuevo club a la lista y re-renderizar
            _clubs.unshift({ ...newTeam, primary_color: color });
            _render();
            _bindEvents();

        } catch (err) {
            console.error('[HUB] Error al fundar club:', err);
            if (errorEl) {
                errorEl.textContent = 'Error al crear el club: ' + err.message;
                errorEl.classList.remove('hidden');
            }
        } finally {
            if (btnText) btnText.textContent = 'CREAR INSTITUCIÓN';
            if (spinner) spinner.classList.add('hidden');
        }
    }

    // ── Event binding ────────────────────────────────────────────────
    function _bindEvents() {
        // Cerrar modal al click en el overlay
        const overlay = document.getElementById('hub-found-modal');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeFoundModal();
            });
        }

        // Keyboard: Enter en tarjetas de club
        document.querySelectorAll('.hub-club-card[data-club-id]').forEach(card => {
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });

        // Keyboard: Enter en tarjeta de fundar
        const foundCard = document.getElementById('hub-btn-found');
        if (foundCard) {
            foundCard.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openFoundModal();
                }
            });
        }
    }

    // ── API pública ──────────────────────────────────────────────────
    return { init, enterClub, openFoundModal, closeFoundModal, foundClub };
})();
