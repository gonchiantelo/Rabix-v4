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

        // 1. Construcción del Bloque del Perfil
        const dtName = window.CurrentUser?.nombre_completo || window.CurrentUser?.name || 'STAFF';
        const dtLicense = window.CurrentUser?.licencia || window.CurrentUser?.license || 'UEFA PRO';
        const dtAvatar = window.CurrentUser?.avatar_url || '';
        
        const avatarInitial = dtName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

        const roleMap = {
            'head_coach': 'DIRECTOR TÉCNICO',
            'assistant': 'ASISTENTE TÉCNICO',
            'gk_coach': 'ENTRENADOR DE ARQUEROS',
            'fitness_coach': 'PREPARADOR FÍSICO',
            'analyst': 'ANALISTA',
            'medical': 'CUERPO MÉDICO'
        };
        const userRole = window.CurrentUser?.role || 'head_coach';
        const translatedRole = roleMap[userRole] || 'STAFF TÉCNICO';

        const heroBannerHTML = `
            <div id="dt-hero-banner" class="dt-portal-hero">
                <!-- Decoración Dark Premium -->
                <div class="dt-hero-mesh"></div>
                
                <div class="dt-avatar-container">
                    ${dtAvatar ? `<img src="${dtAvatar}" class="dt-avatar-img" alt="Avatar">` : `<span class="dt-avatar-initial">${avatarInitial}</span>`}
                </div>
                
                <div class="dt-hero-info">
                    <p class="dt-hero-subtitle">Portal del Manager</p>
                    <h1 class="dt-hero-title">BIENVENIDO, ${dtName.toUpperCase()} - ${translatedRole}</h1>
                    <div class="dt-hero-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        ${dtLicense}
                    </div>
                </div>
            </div>
        `;

        // 2 & 3. Prevención de Duplicados e Inyección Absoluta
        const hubContainer = document.getElementById('view-dt-hub');
        if (hubContainer && !document.getElementById('dt-hero-banner')) {
            hubContainer.insertAdjacentHTML('afterbegin', heroBannerHTML);
        }

        // Animar la entrada de las tarjetas con un stagger
        requestAnimationFrame(() => {
            document.querySelectorAll('.hub-club-card').forEach((card, i) => {
                card.style.animationDelay = `${i * 80}ms`;
                card.classList.add('hub-card--animate-in');
            });
        });

        console.log('[HUB] ✅ Renderizado completo con Perfil DT.');
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

            // Obtener partidos disputados en la App (teams.match_dates) y Resultados (microcycle_sessions)
            window.AppInAppMatches = 0;
            window.AppInAppWins = 0;
            window.AppInAppDraws = 0;

            if (_clubs.length > 0) {
                const teamIds = _clubs.map(c => c.id);
                try {
                    const { data: matches, error: matchErr } = await window.supabase
                        .from('microcycle_sessions')
                        .select('match_result')
                        .in('team_id', teamIds)
                        .eq('is_match_day', true);

                    if (!matchErr && matches) {
                        matches.forEach(m => {
                            if (m.match_result && m.match_result !== 'Pendiente') {
                                window.AppInAppMatches++;
                                if (m.match_result === 'Victoria') window.AppInAppWins++;
                                else if (m.match_result === 'Empate') window.AppInAppDraws++;
                            }
                        });
                    }
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
        const inAppWins = window.AppInAppWins || 0;
        const inAppDraws = window.AppInAppDraws || 0;

        const totalPartidos = histPartidos + inAppMatches;
        const totalTemporadas = histTemporadas + _clubs.length;
        const totalVictorias = histVictorias + inAppWins;
        const totalEmpates = histEmpates + inAppDraws;
        
        let efectividad = 0;
        if (totalPartidos > 0) {
            efectividad = Math.round(((totalVictorias * 3 + totalEmpates) / (totalPartidos * 3)) * 100);
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

        // Limpiamos el contenedor
        container.innerHTML = '';

        const hubHTML = `
            <!-- ═══ HERO — Portada del DT ═══ -->

            <div class="hub-content-wrapper dt-portal-content">
                <!-- ═══ CAREER STATS ═══ -->
                <div class="hub-section">
                    <div class="hub-section-header">
                        <h3 class="dt-career-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                            TRAYECTORIA DE CARRERA
                        </h3>
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

        container.insertAdjacentHTML('afterbegin', hubHTML);

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
